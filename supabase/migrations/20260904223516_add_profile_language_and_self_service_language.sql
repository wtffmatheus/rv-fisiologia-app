alter table public.profiles
  add column if not exists language text not null default 'pt-BR';

alter table public.profiles
  drop constraint if exists profiles_language_check,
  add constraint profiles_language_check
    check (language in ('pt-BR','en','es','zh-CN','de'));

update public.profiles
set language = 'pt-BR'
where language is null
   or language not in ('pt-BR','en','es','zh-CN','de');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text;
begin
  v_language := coalesce(new.raw_user_meta_data ->> 'language', 'pt-BR');

  if v_language not in ('pt-BR','en','es','zh-CN','de') then
    v_language := 'pt-BR';
  end if;

  insert into public.profiles (id,name,email,role,status,language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name',''),
    coalesce(new.email,''),
    'student',
    'pending',
    v_language
  )
  on conflict (id) do update
  set name = excluded.name,
      email = excluded.email,
      language = excluded.language;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create or replace function public.set_own_language(p_language text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_language not in ('pt-BR','en','es','zh-CN','de') then
    raise exception 'unsupported language';
  end if;

  update public.profiles
  set language = p_language
  where id = v_user_id;

  if not found then
    raise exception 'profile not found';
  end if;

  return p_language;
end;
$$;

revoke all on function public.set_own_language(text) from public, anon;
grant execute on function public.set_own_language(text) to authenticated;
