create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and status = 'active'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated, service_role;

alter policy "admin exercises all"
on public.exercises
using (private.is_admin())
with check (private.is_admin());

alter policy "admin lesson progress all"
on public.lesson_progress
using (private.is_admin())
with check (private.is_admin());

alter policy "admin lessons all"
on public.lessons
using (private.is_admin())
with check (private.is_admin());

alter policy "admin read all"
on public.profiles
using (private.is_admin());

alter policy "admin update all"
on public.profiles
using (private.is_admin())
with check (private.is_admin());

alter policy "admin programs all"
on public.programs
using (private.is_admin())
with check (private.is_admin());

alter policy "admin student programs all"
on public.student_programs
using (private.is_admin())
with check (private.is_admin());

alter policy "admin weeks all"
on public.weeks
using (private.is_admin())
with check (private.is_admin());

alter policy "rv admin read exercise videos"
on storage.objects
using ((bucket_id = 'exercise-videos'::text) and private.is_admin());

alter policy "rv admin upload exercise videos"
on storage.objects
with check ((bucket_id = 'exercise-videos'::text) and private.is_admin());

alter policy "rv admin update exercise videos"
on storage.objects
using ((bucket_id = 'exercise-videos'::text) and private.is_admin())
with check ((bucket_id = 'exercise-videos'::text) and private.is_admin());

alter policy "rv admin delete exercise videos"
on storage.objects
using ((bucket_id = 'exercise-videos'::text) and private.is_admin());

create or replace function public.assign_program_to_student(
  p_student_id uuid,
  p_program_id bigint,
  p_starts_at date default current_date
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_student_id
      and role = 'student'
  ) then
    raise exception 'student not found';
  end if;

  if not exists (
    select 1
    from public.programs
    where id = p_program_id
      and is_active = true
  ) then
    raise exception 'program not found';
  end if;

  update public.student_programs
  set active = false
  where student_id = p_student_id;

  insert into public.student_programs (student_id, program_id, starts_at, active)
  values (p_student_id, p_program_id, coalesce(p_starts_at, current_date), true)
  on conflict (student_id, program_id)
  do update set
    starts_at = excluded.starts_at,
    ends_at = null,
    active = true;

  update public.profiles
  set status = 'active'
  where id = p_student_id;
end;
$$;

revoke all on function public.assign_program_to_student(uuid, bigint, date) from public;
grant execute on function public.assign_program_to_student(uuid, bigint, date) to authenticated, service_role;

drop function public.is_admin();
