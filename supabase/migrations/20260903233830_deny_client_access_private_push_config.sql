drop policy if exists "deny client access" on private.admin_push_config;
create policy "deny client access"
on private.admin_push_config
for all
to anon, authenticated
using (false)
with check (false);
