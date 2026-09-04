alter table private.admin_push_config enable row level security;

revoke all on private.admin_push_config from public, anon, authenticated;

comment on table private.admin_push_config is 'Private server-only Web Push configuration. Client roles have no direct grants or RLS policies.';
