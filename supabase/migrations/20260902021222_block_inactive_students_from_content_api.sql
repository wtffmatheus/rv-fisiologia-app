drop policy if exists "student read assigned programs" on public.programs;
create policy "student read assigned programs" on public.programs for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
  and exists (
    select 1 from public.student_programs sp
    where sp.program_id = programs.id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "student read assigned weeks" on public.weeks;
create policy "student read assigned weeks" on public.weeks for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
  and exists (
    select 1 from public.student_programs sp
    where sp.program_id = weeks.program_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "student read assigned lessons" on public.lessons;
create policy "student read assigned lessons" on public.lessons for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
  and exists (
    select 1
    from public.weeks w
    join public.student_programs sp on sp.program_id = w.program_id
    where w.id = lessons.week_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "student read assigned exercises" on public.exercises;
create policy "student read assigned exercises" on public.exercises for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
  and exists (
    select 1
    from public.lessons l
    join public.weeks w on w.id = l.week_id
    join public.student_programs sp on sp.program_id = w.program_id
    where l.id = exercises.lesson_id
      and sp.student_id = auth.uid()
      and sp.active = true
  )
);

drop policy if exists "student read own program assignment" on public.student_programs;
create policy "student read own program assignment" on public.student_programs for select to authenticated using (
  student_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
);

drop policy if exists "student read own progress" on public.lesson_progress;
create policy "student read own progress" on public.lesson_progress for select to authenticated using (
  student_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
);

drop policy if exists "student insert own progress" on public.lesson_progress;
create policy "student insert own progress" on public.lesson_progress for insert to authenticated with check (
  student_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
);

drop policy if exists "student update own progress" on public.lesson_progress;
create policy "student update own progress" on public.lesson_progress for update to authenticated using (
  student_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
) with check (
  student_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
);

drop policy if exists "rv student read assigned exercise videos" on storage.objects;
create policy "rv student read assigned exercise videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = 'programs'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student' and p.status = 'active')
  and exists (
    select 1
    from public.student_programs sp
    where sp.student_id = auth.uid()
      and sp.active = true
      and sp.program_id = nullif((storage.foldername(name))[2], '')::bigint
  )
);
