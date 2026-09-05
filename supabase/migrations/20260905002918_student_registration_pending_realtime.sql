-- JÁ APLICADA EM PRODUÇÃO em 2026-09-05.
-- Fluxo de cadastro próprio + Realtime do status do perfil.

create table if not exists public.student_registration_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  email_hash text not null,
  successful boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.student_registration_attempts
  enable row level security;

revoke all on table public.student_registration_attempts
  from public, anon, authenticated;

grant select, insert, update, delete
  on table public.student_registration_attempts
  to service_role;

grant usage, select
  on sequence public.student_registration_attempts_id_seq
  to service_role;

create index if not exists
  student_registration_attempts_ip_created_idx
  on public.student_registration_attempts
  (ip_hash, created_at desc);

create index if not exists
  student_registration_attempts_email_created_idx
  on public.student_registration_attempts
  (email_hash, created_at desc);

create index if not exists
  student_registration_attempts_created_idx
  on public.student_registration_attempts
  (created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'profiles'
  ) then
    alter publication supabase_realtime
      add table public.profiles;
  end if;
end;
$$;
