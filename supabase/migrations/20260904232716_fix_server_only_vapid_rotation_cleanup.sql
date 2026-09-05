-- JÁ APLICADA EM PRODUÇÃO.
create or replace function public.rotate_admin_push_vapid(
  p_public_key text,
  p_private_key text
)
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

  delete from public.admin_push_subscriptions
  where id is not null;
end;
$$;

revoke all on function public.rotate_admin_push_vapid(text, text)
from public, anon, authenticated;

grant execute on function public.rotate_admin_push_vapid(text, text)
to service_role;
