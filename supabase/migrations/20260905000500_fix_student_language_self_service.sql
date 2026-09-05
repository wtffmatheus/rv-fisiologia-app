-- JÁ APLICADA EM PRODUÇÃO.
-- Corrige a troca de idioma do próprio aluno sem abrir UPDATE geral em profiles.

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
grant execute on function public.set_own_language(text)
to authenticated, service_role;
