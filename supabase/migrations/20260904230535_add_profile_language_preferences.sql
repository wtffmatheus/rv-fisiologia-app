-- JÁ APLICADA EM PRODUÇÃO. Arquivo para sincronizar o histórico do Git.
alter table public.profiles add column if not exists language text not null default 'pt-BR';
alter table public.profiles drop constraint if exists profiles_language_check, add constraint profiles_language_check check (language in ('pt-BR','en','es','zh-CN','de'));
create or replace function public.set_own_language(p_language text) returns text language plpgsql security invoker set search_path = '' as $$
begin
  if p_language not in ('pt-BR','en','es','zh-CN','de') then raise exception 'unsupported language'; end if;
  update public.profiles set language = p_language where id = (select auth.uid());
  if not found then raise exception 'profile not found'; end if;
  return p_language;
end;
$$;
revoke all on function public.set_own_language(text) from public, anon;
grant execute on function public.set_own_language(text) to authenticated, service_role;
