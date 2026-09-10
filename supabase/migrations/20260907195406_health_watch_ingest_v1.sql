create table public.health_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'iPhone / Atalhos',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index health_ingest_tokens_one_active_per_student_idx
  on public.health_ingest_tokens(student_id)
  where revoked_at is null;

alter table public.health_ingest_tokens enable row level security;
revoke all on table public.health_ingest_tokens from anon, authenticated;
grant all on table public.health_ingest_tokens to service_role;

create table public.health_samples (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  metric text not null,
  value double precision not null,
  unit text not null,
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  dedupe_key text not null unique,
  raw_payload jsonb not null default '{}'::jsonb,
  constraint health_samples_source_length check (char_length(source) between 2 and 40),
  constraint health_samples_metric_length check (char_length(metric) between 2 and 60),
  constraint health_samples_unit_length check (char_length(unit) between 1 and 24),
  constraint health_samples_value_finite check (value > '-Infinity'::float8 and value < 'Infinity'::float8)
);

create index health_samples_student_metric_measured_idx
  on public.health_samples(student_id, metric, measured_at desc);
create index health_samples_student_received_idx
  on public.health_samples(student_id, received_at desc);

alter table public.health_samples enable row level security;

grant select on table public.health_samples to authenticated;
revoke insert, update, delete on table public.health_samples from authenticated;

create policy "health samples authenticated select"
on public.health_samples
for select
to authenticated
using (
  (select private.is_admin())
  or (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
  )
);

create table public.blood_pressure_readings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  systolic smallint not null,
  diastolic smallint not null,
  pulse smallint,
  source text not null default 'omron_hem_6221',
  measured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  note text,
  constraint blood_pressure_systolic_technical_range check (systolic between 40 and 350),
  constraint blood_pressure_diastolic_technical_range check (diastolic between 20 and 250),
  constraint blood_pressure_pulse_technical_range check (pulse is null or pulse between 20 and 300),
  constraint blood_pressure_source_length check (char_length(source) between 2 and 40),
  constraint blood_pressure_note_length check (note is null or char_length(note) <= 300)
);

create index blood_pressure_student_measured_idx
  on public.blood_pressure_readings(student_id, measured_at desc);

alter table public.blood_pressure_readings enable row level security;
grant select, insert on table public.blood_pressure_readings to authenticated;
revoke update, delete on table public.blood_pressure_readings from authenticated;

create policy "blood pressure authenticated select"
on public.blood_pressure_readings
for select
to authenticated
using (
  (select private.is_admin())
  or (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
  )
);

create policy "blood pressure authenticated insert"
on public.blood_pressure_readings
for insert
to authenticated
with check (
  (select private.is_admin())
  or (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
  )
);

create or replace function public.rotate_own_health_ingest_token(
  p_label text default 'iPhone / Atalhos'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text;
  v_hash text;
  v_id uuid;
  v_created_at timestamptz := now();
  v_label text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role = 'student'
      and p.status = 'active'
  ) then
    raise exception 'active_student_required';
  end if;

  v_label := left(coalesce(nullif(btrim(p_label), ''), 'iPhone / Atalhos'), 60);
  v_token := 'rvh_' || encode(extensions.gen_random_bytes(24), 'hex');
  v_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

  update public.health_ingest_tokens
  set revoked_at = now()
  where student_id = v_uid
    and revoked_at is null;

  insert into public.health_ingest_tokens (
    student_id,
    token_hash,
    label,
    created_at
  ) values (
    v_uid,
    v_hash,
    v_label,
    v_created_at
  )
  returning id into v_id;

  return jsonb_build_object(
    'token', v_token,
    'token_id', v_id,
    'label', v_label,
    'created_at', v_created_at
  );
end;
$$;

revoke all on function public.rotate_own_health_ingest_token(text) from public, anon;
grant execute on function public.rotate_own_health_ingest_token(text) to authenticated;

create or replace function public.get_own_health_ingest_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'configured', true,
        'token_id', t.id,
        'label', t.label,
        'created_at', t.created_at,
        'last_used_at', t.last_used_at
      )
      from public.health_ingest_tokens t
      where t.student_id = auth.uid()
        and t.revoked_at is null
      order by t.created_at desc
      limit 1
    ),
    jsonb_build_object('configured', false)
  );
$$;

revoke all on function public.get_own_health_ingest_status() from public, anon;
grant execute on function public.get_own_health_ingest_status() to authenticated;

create or replace function public.revoke_own_health_ingest_token()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.health_ingest_tokens
  set revoked_at = now()
  where student_id = auth.uid()
    and revoked_at is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

revoke all on function public.revoke_own_health_ingest_token() from public, anon;
grant execute on function public.revoke_own_health_ingest_token() to authenticated;

alter publication supabase_realtime add table public.health_samples;
alter publication supabase_realtime add table public.blood_pressure_readings;
