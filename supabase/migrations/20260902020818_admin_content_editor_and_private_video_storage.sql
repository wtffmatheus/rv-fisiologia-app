alter table public.exercises
  add column if not exists instructions text,
  add column if not exists video_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-videos',
  'exercise-videos',
  false,
  209715200,
  array['video/mp4','video/quicktime','video/webm']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rv admin read exercise videos" on storage.objects;
create policy "rv admin read exercise videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and public.is_admin()
);

drop policy if exists "rv admin upload exercise videos" on storage.objects;
create policy "rv admin upload exercise videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exercise-videos'
  and public.is_admin()
);

drop policy if exists "rv admin update exercise videos" on storage.objects;
create policy "rv admin update exercise videos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exercise-videos'
  and public.is_admin()
)
with check (
  bucket_id = 'exercise-videos'
  and public.is_admin()
);

drop policy if exists "rv admin delete exercise videos" on storage.objects;
create policy "rv admin delete exercise videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exercise-videos'
  and public.is_admin()
);

drop policy if exists "rv student read assigned exercise videos" on storage.objects;
create policy "rv student read assigned exercise videos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'exercise-videos'
  and (storage.foldername(name))[1] = 'programs'
  and exists (
    select 1
    from public.student_programs sp
    where sp.student_id = auth.uid()
      and sp.active = true
      and sp.program_id = nullif((storage.foldername(name))[2], '')::bigint
  )
);
