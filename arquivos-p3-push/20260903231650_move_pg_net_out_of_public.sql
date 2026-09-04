-- Correção de segurança do P3 lote 3.
-- JÁ APLICADA no Supabase de produção em 2026-09-03.
-- Move o pg_net para o schema extensions e recria o dispatcher.

drop trigger if exists on_admin_notification_web_push
on public.admin_notifications;

drop function if exists private.dispatch_admin_web_push();

drop extension if exists pg_net;

create extension if not exists pg_net
with schema extensions;

create or replace function private.dispatch_admin_web_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select edge_function_url, webhook_secret
    into v_url, v_secret
  from private.admin_push_config
  where singleton = true;

  if v_url is null or v_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rv-push-secret', v_secret
    ),
    timeout_milliseconds := 4000
  );

  return new;
exception
  when others then
    raise warning 'RV push dispatch failed: %', sqlerrm;
    return new;
end;
$$;

revoke all
on function private.dispatch_admin_web_push()
from public, anon, authenticated;

create trigger on_admin_notification_web_push
after insert on public.admin_notifications
for each row
execute function private.dispatch_admin_web_push();
