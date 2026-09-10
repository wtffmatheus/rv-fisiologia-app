drop function if exists public.set_own_language(text);

create or replace function public.sync_profile_language_from_auth()
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

  update public.profiles
  set language = v_language
  where id = new.id
    and language is distinct from v_language;

  return new;
end;
$$;

revoke all on function public.sync_profile_language_from_auth()
from public, anon, authenticated;

drop trigger if exists on_auth_user_language_updated on auth.users;
create trigger on_auth_user_language_updated
after update of raw_user_meta_data on auth.users
for each row
when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
execute function public.sync_profile_language_from_auth();
