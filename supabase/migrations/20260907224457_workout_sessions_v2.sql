create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'apple_watch',
  workout_type text not null default 'workout',
  planned_duration_minutes smallint,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_status_check check (status in ('active','completed','cancelled')),
  constraint workout_sessions_planned_duration_check check (planned_duration_minutes is null or planned_duration_minutes between 1 and 720),
  constraint workout_sessions_time_check check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists workout_sessions_one_active_per_student
  on public.workout_sessions(student_id)
  where status = 'active';

create index if not exists workout_sessions_student_started_idx
  on public.workout_sessions(student_id, started_at desc);

create index if not exists workout_sessions_student_status_idx
  on public.workout_sessions(student_id, status, started_at desc);

alter table public.health_samples
  add column if not exists workout_session_id uuid references public.workout_sessions(id) on delete set null;

create index if not exists health_samples_session_metric_time_idx
  on public.health_samples(workout_session_id, metric, measured_at asc)
  where workout_session_id is not null;

alter table public.workout_sessions enable row level security;

revoke all on table public.workout_sessions from anon;
revoke insert, update, delete on table public.workout_sessions from authenticated;
grant select on table public.workout_sessions to authenticated;
grant all on table public.workout_sessions to service_role;

alter table public.health_samples enable row level security;
grant select on table public.health_samples to authenticated;

drop policy if exists "workout sessions authenticated select" on public.workout_sessions;
create policy "workout sessions authenticated select"
on public.workout_sessions
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

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workout_sessions'
  ) then
    alter publication supabase_realtime add table public.workout_sessions;
  end if;
end
$$;
