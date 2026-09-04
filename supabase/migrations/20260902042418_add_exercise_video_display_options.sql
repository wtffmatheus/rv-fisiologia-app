alter table public.exercises
  add column if not exists video_ratio text not null default '9:16',
  add column if not exists video_fit text not null default 'cover';

alter table public.exercises
  drop constraint if exists exercises_video_ratio_check,
  add constraint exercises_video_ratio_check
    check (video_ratio in ('9:16','4:5','1:1','16:9'));

alter table public.exercises
  drop constraint if exists exercises_video_fit_check,
  add constraint exercises_video_fit_check
    check (video_fit in ('cover','contain'));

update public.exercises
set video_ratio = '9:16'
where video_ratio is null;

update public.exercises
set video_fit = 'cover'
where video_fit is null;
