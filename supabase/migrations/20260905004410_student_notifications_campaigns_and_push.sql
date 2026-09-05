-- JÁ APLICADA EM PRODUÇÃO.
-- Migration real: 20260905004410_student_notifications_campaigns_and_push

create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.student_notification_campaigns (
  id bigint generated always as identity primary key,
  created_by uuid not null references public.profiles(id) on delete restrict,
  audience text not null check (audience in ('student','all')),
  student_id uuid references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  schedule_type text not null check (schedule_type in ('now','once','daily')),
  scheduled_for timestamptz,
  daily_time time,
  timezone text not null default 'America/Sao_Paulo',
  active boolean not null default true,
  next_run_at timestamptz,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_notification_campaign_target_check check (
    (audience = 'all' and student_id is null) or
    (audience = 'student' and student_id is not null)
  ),
  constraint student_notification_campaign_schedule_check check (
    (schedule_type = 'now' and scheduled_for is null and daily_time is null) or
    (schedule_type = 'once' and scheduled_for is not null and daily_time is null) or
    (schedule_type = 'daily' and scheduled_for is null and daily_time is not null)
  )
);

create table if not exists public.student_notifications (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('access_approved','custom')),
  title text not null check (char_length(title) between 1 and 80),
  message text not null check (char_length(message) between 1 and 500),
  metadata jsonb not null default '{}'::jsonb,
  campaign_id bigint references public.student_notification_campaigns(id) on delete set null,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.student_push_subscriptions (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  language text not null default 'pt-BR'
    check (language in ('pt-BR','en','es','zh-CN','de')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_notifications_student_created_idx
  on public.student_notifications(student_id, created_at desc);

create index if not exists student_notifications_student_unread_idx
  on public.student_notifications(student_id, read_at, created_at desc);

create index if not exists student_push_subscriptions_student_active_idx
  on public.student_push_subscriptions(student_id, active);

create index if not exists student_notification_campaigns_due_idx
  on public.student_notification_campaigns(active, next_run_at)
  where active = true;

alter table public.student_notification_campaigns enable row level security;
alter table public.student_notifications enable row level security;
alter table public.student_push_subscriptions enable row level security;

drop policy if exists "student notifications select"
  on public.student_notifications;

create policy "student notifications select"
on public.student_notifications
for select
to authenticated
using (
  student_id = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists "student notification campaigns admin select"
  on public.student_notification_campaigns;

create policy "student notification campaigns admin select"
on public.student_notification_campaigns
for select
to authenticated
using ((select private.is_admin()));

drop policy if exists "student push subscriptions select own"
  on public.student_push_subscriptions;

create policy "student push subscriptions select own"
on public.student_push_subscriptions
for select
to authenticated
using (student_id = (select auth.uid()));

drop policy if exists "student push subscriptions insert own"
  on public.student_push_subscriptions;

create policy "student push subscriptions insert own"
on public.student_push_subscriptions
for insert
to authenticated
with check (student_id = (select auth.uid()));

drop policy if exists "student push subscriptions update own"
  on public.student_push_subscriptions;

create policy "student push subscriptions update own"
on public.student_push_subscriptions
for update
to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

drop policy if exists "student push subscriptions delete own"
  on public.student_push_subscriptions;

create policy "student push subscriptions delete own"
on public.student_push_subscriptions
for delete
to authenticated
using (student_id = (select auth.uid()));

grant select on public.student_notifications to authenticated;
grant select on public.student_notification_campaigns to authenticated;
grant select, insert, update, delete
  on public.student_push_subscriptions to authenticated;

grant all
  on public.student_notifications,
     public.student_notification_campaigns,
     public.student_push_subscriptions
  to service_role;

grant usage, select
  on sequence public.student_notifications_id_seq
  to service_role;

grant usage, select
  on sequence public.student_notification_campaigns_id_seq
  to service_role;

grant usage, select
  on sequence public.student_push_subscriptions_id_seq
  to authenticated, service_role;

create table if not exists private.student_push_config (
  singleton boolean primary key default true check (singleton),
  edge_function_url text not null,
  updated_at timestamptz not null default now()
);

insert into private.student_push_config(singleton, edge_function_url)
values (
  true,
  'https://ilnlnkcxajkarwviynbm.supabase.co/functions/v1/student-web-push'
)
on conflict (singleton) do update
set edge_function_url = excluded.edge_function_url,
    updated_at = now();

revoke all
  on private.student_push_config
  from public, anon, authenticated;

create or replace function private.next_student_campaign_run(
  p_daily_time time,
  p_timezone text,
  p_reference timestamptz default now()
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_local_date date;
  v_candidate timestamptz;
begin
  if p_daily_time is null then
    raise exception 'daily time required';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = p_timezone
  ) then
    raise exception 'invalid timezone';
  end if;

  v_local_date := (p_reference at time zone p_timezone)::date;
  v_candidate := (v_local_date + p_daily_time) at time zone p_timezone;

  if v_candidate <= p_reference then
    v_candidate :=
      ((v_local_date + 1) + p_daily_time) at time zone p_timezone;
  end if;

  return v_candidate;
end;
$$;

create or replace function private.dispatch_student_web_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select s.edge_function_url, a.webhook_secret
    into v_url, v_secret
  from private.student_push_config s
  cross join private.admin_push_config a
  where s.singleton = true
    and a.singleton = true;

  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rv-push-secret', v_secret
    ),
    timeout_milliseconds := 4000
  );

  return new;
exception
  when others then
    raise warning 'RV student push dispatch failed: %', sqlerrm;
    return new;
end;
$$;

revoke all
  on function private.dispatch_student_web_push()
  from public, anon, authenticated;

drop trigger if exists on_student_notification_web_push
  on public.student_notifications;

create trigger on_student_notification_web_push
after insert on public.student_notifications
for each row
execute function private.dispatch_student_web_push();

create or replace function private.notify_student_access_approved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
  v_message text;
begin
  if new.role <> 'student'
     or new.status <> 'active'
     or old.status = 'active' then
    return new;
  end if;

  case coalesce(new.language, 'pt-BR')
    when 'en' then
      v_title := 'Access approved';
      v_message :=
        'Your RV access has been approved. Your training program is now available.';
    when 'es' then
      v_title := 'Acceso aprobado';
      v_message :=
        'Tu acceso a RV fue aprobado. Tu programa de entrenamiento ya está disponible.';
    when 'zh-CN' then
      v_title := '访问已批准';
      v_message := '你的 RV 访问权限已获批准。训练计划现在可以使用。';
    when 'de' then
      v_title := 'Zugang freigegeben';
      v_message :=
        'Dein RV-Zugang wurde freigegeben. Dein Trainingsprogramm ist jetzt verfügbar.';
    else
      v_title := 'Acesso liberado';
      v_message :=
        'Seu acesso à RV foi liberado. Seu programa de treino já está disponível.';
  end case;

  insert into public.student_notifications(
    student_id,
    kind,
    title,
    message,
    metadata
  )
  values (
    new.id,
    'access_approved',
    v_title,
    v_message,
    jsonb_build_object(
      'previous_status', old.status,
      'new_status', new.status
    )
  );

  return new;
end;
$$;

revoke all
  on function private.notify_student_access_approved()
  from public, anon, authenticated;

drop trigger if exists on_student_access_approved_notification
  on public.profiles;

create trigger on_student_access_approved_notification
after update of status on public.profiles
for each row
execute function private.notify_student_access_approved();

create or replace function private.deliver_student_notification_campaign(
  p_campaign_id bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.student_notification_campaigns%rowtype;
  v_run_at timestamptz;
  v_run_key text;
  v_inserted integer := 0;
begin
  select *
    into v_campaign
  from public.student_notification_campaigns
  where id = p_campaign_id
  for update;

  if not found
     or not v_campaign.active
     or v_campaign.next_run_at is null then
    return 0;
  end if;

  if v_campaign.next_run_at > now() then
    return 0;
  end if;

  v_run_at := v_campaign.next_run_at;
  v_run_key :=
    to_char(
      v_run_at at time zone 'UTC',
      'YYYYMMDDHH24MISS'
    );

  insert into public.student_notifications(
    student_id,
    kind,
    title,
    message,
    metadata,
    campaign_id,
    dedupe_key,
    created_at
  )
  select
    p.id,
    'custom',
    v_campaign.title,
    v_campaign.message,
    jsonb_build_object(
      'campaign_id', v_campaign.id,
      'audience', v_campaign.audience,
      'schedule_type', v_campaign.schedule_type
    ),
    v_campaign.id,
    'campaign:' ||
      v_campaign.id::text ||
      ':' ||
      v_run_key ||
      ':' ||
      p.id::text,
    now()
  from public.profiles p
  where p.role = 'student'
    and p.status = 'active'
    and (
      v_campaign.audience = 'all'
      or p.id = v_campaign.student_id
    )
  on conflict (dedupe_key) do nothing;

  get diagnostics v_inserted = row_count;

  if v_campaign.schedule_type = 'daily' then
    update public.student_notification_campaigns
    set last_run_at = now(),
        next_run_at =
          private.next_student_campaign_run(
            v_campaign.daily_time,
            v_campaign.timezone,
            greatest(now(), v_run_at) + interval '1 second'
          ),
        updated_at = now()
    where id = v_campaign.id;
  else
    update public.student_notification_campaigns
    set last_run_at = now(),
        next_run_at = null,
        active = false,
        updated_at = now()
    where id = v_campaign.id;
  end if;

  return v_inserted;
end;
$$;

revoke all
  on function private.deliver_student_notification_campaign(bigint)
  from public, anon, authenticated;

create or replace function private.process_due_student_notification_campaigns()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_total integer := 0;
begin
  for v_row in
    select id
    from public.student_notification_campaigns
    where active = true
      and next_run_at is not null
      and next_run_at <= now()
    order by next_run_at
    limit 100
  loop
    v_total :=
      v_total +
      private.deliver_student_notification_campaign(v_row.id);
  end loop;

  return v_total;
end;
$$;

revoke all
  on function private.process_due_student_notification_campaigns()
  from public, anon, authenticated;

create or replace function public.create_student_notification_campaign(
  p_audience text,
  p_student_id uuid,
  p_title text,
  p_message text,
  p_schedule_type text default 'now',
  p_scheduled_for timestamptz default null,
  p_daily_time time default null,
  p_timezone text default 'America/Sao_Paulo'
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_next timestamptz;
  v_admin_id uuid;
begin
  if not private.is_admin() then
    raise exception 'not authorized';
  end if;

  v_admin_id := (select auth.uid());

  if p_audience not in ('student','all') then
    raise exception 'invalid audience';
  end if;

  if p_audience = 'student' then
    if p_student_id is null
       or not exists (
         select 1
         from public.profiles
         where id = p_student_id
           and role = 'student'
           and status = 'active'
       ) then
      raise exception 'active student required';
    end if;
  else
    p_student_id := null;
  end if;

  p_title := btrim(coalesce(p_title, ''));
  p_message := btrim(coalesce(p_message, ''));

  if char_length(p_title) not between 1 and 80 then
    raise exception 'invalid title';
  end if;

  if char_length(p_message) not between 1 and 500 then
    raise exception 'invalid message';
  end if;

  if p_schedule_type = 'now' then
    v_next := now();
    p_scheduled_for := null;
    p_daily_time := null;

  elsif p_schedule_type = 'once' then
    if p_scheduled_for is null
       or p_scheduled_for <= now() then
      raise exception 'future scheduled time required';
    end if;

    v_next := p_scheduled_for;
    p_daily_time := null;

  elsif p_schedule_type = 'daily' then
    if p_daily_time is null then
      raise exception 'daily time required';
    end if;

    if not exists (
      select 1
      from pg_catalog.pg_timezone_names
      where name = p_timezone
    ) then
      raise exception 'invalid timezone';
    end if;

    v_next :=
      private.next_student_campaign_run(
        p_daily_time,
        p_timezone,
        now()
      );

    p_scheduled_for := null;
  else
    raise exception 'invalid schedule type';
  end if;

  insert into public.student_notification_campaigns(
    created_by,
    audience,
    student_id,
    title,
    message,
    schedule_type,
    scheduled_for,
    daily_time,
    timezone,
    active,
    next_run_at
  )
  values (
    v_admin_id,
    p_audience,
    p_student_id,
    p_title,
    p_message,
    p_schedule_type,
    p_scheduled_for,
    p_daily_time,
    coalesce(
      nullif(p_timezone, ''),
      'America/Sao_Paulo'
    ),
    true,
    v_next
  )
  returning id into v_id;

  if p_schedule_type = 'now' then
    perform
      private.deliver_student_notification_campaign(v_id);
  end if;

  return v_id;
end;
$$;

revoke all
  on function public.create_student_notification_campaign(
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    time,
    text
  )
  from public, anon;

grant execute
  on function public.create_student_notification_campaign(
    text,
    uuid,
    text,
    text,
    text,
    timestamptz,
    time,
    text
  )
  to authenticated, service_role;

create or replace function public.cancel_student_notification_campaign(
  p_campaign_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.student_notification_campaigns
  set active = false,
      next_run_at = null,
      updated_at = now()
  where id = p_campaign_id;
end;
$$;

revoke all
  on function public.cancel_student_notification_campaign(bigint)
  from public, anon;

grant execute
  on function public.cancel_student_notification_campaign(bigint)
  to authenticated, service_role;

create or replace function public.mark_own_student_notification_read(
  p_notification_id bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.student_notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and student_id = (select auth.uid());
end;
$$;

revoke all
  on function public.mark_own_student_notification_read(bigint)
  from public, anon;

grant execute
  on function public.mark_own_student_notification_read(bigint)
  to authenticated, service_role;

create or replace function public.mark_all_own_student_notifications_read()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.student_notifications
  set read_at = now()
  where student_id = (select auth.uid())
    and read_at is null;
end;
$$;

revoke all
  on function public.mark_all_own_student_notifications_read()
  from public, anon;

grant execute
  on function public.mark_all_own_student_notifications_read()
  to authenticated, service_role;

create or replace function public.register_student_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text,
  p_language text default 'pt-BR'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student_id uuid;
begin
  v_student_id := (select auth.uid());

  if v_student_id is null
     or not exists (
       select 1
       from public.profiles
       where id = v_student_id
         and role = 'student'
         and status in ('pending','active')
     ) then
    raise exception 'student access required';
  end if;

  if p_language not in (
    'pt-BR',
    'en',
    'es',
    'zh-CN',
    'de'
  ) then
    p_language := 'pt-BR';
  end if;

  if coalesce(p_endpoint, '') = ''
     or coalesce(p_p256dh, '') = ''
     or coalesce(p_auth, '') = '' then
    raise exception 'invalid subscription';
  end if;

  update public.student_push_subscriptions
  set active = false,
      updated_at = now()
  where endpoint = p_endpoint
    and student_id <> v_student_id;

  update public.admin_push_subscriptions
  set active = false,
      updated_at = now()
  where endpoint = p_endpoint;

  insert into public.student_push_subscriptions(
    student_id,
    endpoint,
    p256dh,
    auth,
    user_agent,
    language,
    active,
    updated_at
  )
  values (
    v_student_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent,
    p_language,
    true,
    now()
  )
  on conflict (endpoint) do update
  set student_id = excluded.student_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_agent = excluded.user_agent,
      language = excluded.language,
      active = true,
      updated_at = now();
end;
$$;

revoke all
  on function public.register_student_push_subscription(
    text,
    text,
    text,
    text,
    text
  )
  from public, anon;

grant execute
  on function public.register_student_push_subscription(
    text,
    text,
    text,
    text,
    text
  )
  to authenticated, service_role;

create or replace function public.disable_own_student_push_subscription(
  p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.student_push_subscriptions
  where student_id = (select auth.uid())
    and endpoint = p_endpoint;
end;
$$;

revoke all
  on function public.disable_own_student_push_subscription(text)
  from public, anon;

grant execute
  on function public.disable_own_student_push_subscription(text)
  to authenticated, service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'student_notifications'
  ) then
    alter publication supabase_realtime
      add table public.student_notifications;
  end if;
end;
$$;

do $$
declare
  v_job record;
begin
  for v_job in
    select jobid
    from cron.job
    where jobname = 'rv-student-notification-campaigns'
  loop
    perform cron.unschedule(v_job.jobid);
  end loop;

  perform cron.schedule(
    'rv-student-notification-campaigns',
    '* * * * *',
    'select private.process_due_student_notification_campaigns();'
  );
end;
$$;
