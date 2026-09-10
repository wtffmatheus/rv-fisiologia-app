create or replace function public.set_admin_push_vapid_config(p_public_key text, p_private_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.admin_push_config
  set vapid_public_key = p_public_key,
      vapid_private_key = p_private_key,
      updated_at = now()
  where singleton = true;
end;
$$;

revoke all on function public.set_admin_push_vapid_config(text, text) from public, anon, authenticated;
grant execute on function public.set_admin_push_vapid_config(text, text) to service_role;
