alter table public.admin_push_subscriptions
  add column if not exists language text not null default 'pt-BR';

alter table public.admin_push_subscriptions
  drop constraint if exists admin_push_subscriptions_language_check,
  add constraint admin_push_subscriptions_language_check
    check (language in ('pt-BR','en','es','zh-CN','de'));

update public.admin_push_subscriptions
set language = 'pt-BR'
where language is null
   or language not in ('pt-BR','en','es','zh-CN','de');
