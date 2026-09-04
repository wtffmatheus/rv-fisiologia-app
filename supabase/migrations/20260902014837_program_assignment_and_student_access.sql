create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

alter table public.programs enable row level security;
alter table public.weeks enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.student_programs enable row level security;
alter table public.lesson_progress enable row level security;

drop policy if exists "admin programs all" on public.programs;
create policy "admin programs all" on public.programs for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read assigned programs" on public.programs;
create policy "student read assigned programs" on public.programs for select to authenticated using (
  exists (
    select 1 from public.student_programs sp
    where sp.program_id = programs.id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "admin weeks all" on public.weeks;
create policy "admin weeks all" on public.weeks for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read assigned weeks" on public.weeks;
create policy "student read assigned weeks" on public.weeks for select to authenticated using (
  exists (
    select 1 from public.student_programs sp
    where sp.program_id = weeks.program_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "admin lessons all" on public.lessons;
create policy "admin lessons all" on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read assigned lessons" on public.lessons;
create policy "student read assigned lessons" on public.lessons for select to authenticated using (
  exists (
    select 1
    from public.weeks w
    join public.student_programs sp on sp.program_id = w.program_id
    where w.id = lessons.week_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "admin exercises all" on public.exercises;
create policy "admin exercises all" on public.exercises for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read assigned exercises" on public.exercises;
create policy "student read assigned exercises" on public.exercises for select to authenticated using (
  exists (
    select 1
    from public.lessons l
    join public.weeks w on w.id = l.week_id
    join public.student_programs sp on sp.program_id = w.program_id
    where l.id = exercises.lesson_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "admin student programs all" on public.student_programs;
create policy "admin student programs all" on public.student_programs for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read own program assignment" on public.student_programs;
create policy "student read own program assignment" on public.student_programs for select to authenticated using (student_id = auth.uid());

drop policy if exists "admin lesson progress all" on public.lesson_progress;
create policy "admin lesson progress all" on public.lesson_progress for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "student read own progress" on public.lesson_progress;
create policy "student read own progress" on public.lesson_progress for select to authenticated using (student_id = auth.uid());

drop policy if exists "student insert own progress" on public.lesson_progress;
create policy "student insert own progress" on public.lesson_progress for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "student update own progress" on public.lesson_progress;
create policy "student update own progress" on public.lesson_progress for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

create or replace function public.assign_program_to_student(
  p_student_id uuid,
  p_program_id bigint,
  p_starts_at date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  if not exists (select 1 from public.profiles where id = p_student_id and role = 'student') then
    raise exception 'student not found';
  end if;

  if not exists (select 1 from public.programs where id = p_program_id and is_active = true) then
    raise exception 'program not found';
  end if;

  update public.student_programs
  set active = false
  where student_id = p_student_id;

  insert into public.student_programs (student_id, program_id, starts_at, active)
  values (p_student_id, p_program_id, coalesce(p_starts_at, current_date), true)
  on conflict (student_id, program_id)
  do update set starts_at = excluded.starts_at, ends_at = null, active = true;

  update public.profiles
  set status = 'active'
  where id = p_student_id;
end;
$$;

grant execute on function public.assign_program_to_student(uuid, bigint, date) to authenticated;
