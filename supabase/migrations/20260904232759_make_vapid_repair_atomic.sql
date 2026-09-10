create or replace function public.set_admin_push_vapid_config_if_current(p_expected_public_key text, p_public_key text, p_private_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changed boolean;
begin
  update private.admin_push_config
  set vapid_public_key = p_public_key,
      vapid_private_key = p_private_key,
      updated_at = now()
  where singleton = true
    and vapid_public_key = p_expected_public_key;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

revoke all on function public.set_admin_push_vapid_config_if_current(text, text, text) from public, anon, authenticated;
grant execute on function public.set_admin_push_vapid_config_if_current(text, text, text) to service_role;
