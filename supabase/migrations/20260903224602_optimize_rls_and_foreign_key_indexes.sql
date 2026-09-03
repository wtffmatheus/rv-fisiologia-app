-- P2 lote 4: performance do banco e consolidacao de RLS
-- Já aplicado em produção no Supabase em 2026-09-03.
-- Este arquivo serve para manter o repositório sincronizado com o banco.

-- Foreign-key covering indexes
create index if not exists exercises_lesson_id_idx
  on public.exercises (lesson_id);

create index if not exists lesson_progress_lesson_id_idx
  on public.lesson_progress (lesson_id);

create index if not exists lessons_week_id_idx
  on public.lessons (week_id);

create index if not exists student_programs_program_id_idx
  on public.student_programs (program_id);

create index if not exists weeks_program_id_idx
  on public.weeks (program_id);

-- PROFILES ---------------------------------------------------
drop policy if exists "admin read all" on public.profiles;
drop policy if exists "user read own" on public.profiles;

create policy "profiles authenticated select"
on public.profiles
for select
to authenticated
using (
  (select private.is_admin())
  or id = (select auth.uid())
);

-- PROGRAMS ---------------------------------------------------
drop policy if exists "admin programs all" on public.programs;
drop policy if exists "student read assigned programs" on public.programs;

create policy "programs authenticated select"
on public.programs
for select
to authenticated
using (
  (select private.is_admin())
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
    and exists (
      select 1
      from public.student_programs sp
      where sp.program_id = programs.id
        and sp.student_id = (select auth.uid())
        and sp.active = true
    )
  )
);

create policy "programs admin insert"
on public.programs
for insert
to authenticated
with check ((select private.is_admin()));

create policy "programs admin update"
on public.programs
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "programs admin delete"
on public.programs
for delete
to authenticated
using ((select private.is_admin()));

-- WEEKS ------------------------------------------------------
drop policy if exists "admin weeks all" on public.weeks;
drop policy if exists "student read assigned weeks" on public.weeks;

create policy "weeks authenticated select"
on public.weeks
for select
to authenticated
using (
  (select private.is_admin())
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
    and exists (
      select 1
      from public.student_programs sp
      where sp.program_id = weeks.program_id
        and sp.student_id = (select auth.uid())
        and sp.active = true
    )
  )
);

create policy "weeks admin insert"
on public.weeks
for insert
to authenticated
with check ((select private.is_admin()));

create policy "weeks admin update"
on public.weeks
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "weeks admin delete"
on public.weeks
for delete
to authenticated
using ((select private.is_admin()));

-- LESSONS ----------------------------------------------------
drop policy if exists "admin lessons all" on public.lessons;
drop policy if exists "student read assigned lessons" on public.lessons;

create policy "lessons authenticated select"
on public.lessons
for select
to authenticated
using (
  (select private.is_admin())
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
    and exists (
      select 1
      from public.weeks w
      join public.student_programs sp
        on sp.program_id = w.program_id
      where w.id = lessons.week_id
        and sp.student_id = (select auth.uid())
        and sp.active = true
    )
  )
);

create policy "lessons admin insert"
on public.lessons
for insert
to authenticated
with check ((select private.is_admin()));

create policy "lessons admin update"
on public.lessons
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "lessons admin delete"
on public.lessons
for delete
to authenticated
using ((select private.is_admin()));

-- EXERCISES --------------------------------------------------
drop policy if exists "admin exercises all" on public.exercises;
drop policy if exists "student read assigned exercises" on public.exercises;

create policy "exercises authenticated select"
on public.exercises
for select
to authenticated
using (
  (select private.is_admin())
  or (
    exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.role = 'student'
        and p.status = 'active'
    )
    and exists (
      select 1
      from public.lessons l
      join public.weeks w
        on w.id = l.week_id
      join public.student_programs sp
        on sp.program_id = w.program_id
      where l.id = exercises.lesson_id
        and sp.student_id = (select auth.uid())
        and sp.active = true
    )
  )
);

create policy "exercises admin insert"
on public.exercises
for insert
to authenticated
with check ((select private.is_admin()));

create policy "exercises admin update"
on public.exercises
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "exercises admin delete"
on public.exercises
for delete
to authenticated
using ((select private.is_admin()));

-- STUDENT PROGRAMS ------------------------------------------
drop policy if exists "admin student programs all" on public.student_programs;
drop policy if exists "student read own program assignment" on public.student_programs;

create policy "student programs authenticated select"
on public.student_programs
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

create policy "student programs admin insert"
on public.student_programs
for insert
to authenticated
with check ((select private.is_admin()));

create policy "student programs admin update"
on public.student_programs
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

create policy "student programs admin delete"
on public.student_programs
for delete
to authenticated
using ((select private.is_admin()));

-- LESSON PROGRESS -------------------------------------------
drop policy if exists "admin lesson progress all" on public.lesson_progress;
drop policy if exists "student read own progress" on public.lesson_progress;
drop policy if exists "student insert own progress" on public.lesson_progress;
drop policy if exists "student update own progress" on public.lesson_progress;

create policy "lesson progress authenticated select"
on public.lesson_progress
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

create policy "lesson progress authenticated insert"
on public.lesson_progress
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

create policy "lesson progress authenticated update"
on public.lesson_progress
for update
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
)
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

create policy "lesson progress admin delete"
on public.lesson_progress
for delete
to authenticated
using ((select private.is_admin()));
