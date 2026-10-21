-- Diagnostic des éléments HÉRITÉS de la base de production (absents des migrations du dépôt) — LECTURE SEULE.
-- À coller dans Supabase -> SQL Editor -> Run, puis exporter le résultat en CSV. N'affiche aucune donnée personnelle.
select 'fonction' as categorie, p.proname as nom,
       (case when p.prosecdef then 'SECURITY DEFINER' else 'invoker' end) || ' | ' ||
       pg_get_function_arguments(p.oid) || ' | ' || left(regexp_replace(p.prosrc, '\s+', ' ', 'g'), 600) as detail
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
 where p.proname in ('admin_read', 'generate_ticket_number', 'handle_new_user', 'rls_auto_enable',
                     'scan_ticket_secure', 'schedule_event_reminders', 'tr_notify_new_event', 'tr_notify_new_spot')
union all
select 'déclencheur', c.relname || '.' || t.tgname,
       pg_get_triggerdef(t.oid)
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not t.tgisinternal
union all
select 'tâche planifiée', j.jobname, j.schedule || ' | ' || left(regexp_replace(j.command, '\s+', ' ', 'g'), 300)
  from cron.job j
union all
select 'droits anon', c.relname,
       'select=' || has_table_privilege('anon', c.oid, 'select') || ' insert=' || has_table_privilege('anon', c.oid, 'insert') ||
       ' update=' || has_table_privilege('anon', c.oid, 'update') || ' delete=' || has_table_privilege('anon', c.oid, 'delete') ||
       ' | RLS=' || c.relrowsecurity || ' | lignes~' || c.reltuples::bigint
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and c.relname in ('merchant_notifications', 'merchant_visits', 'notification_queue', 'reviews', 'spots',
                     'user_push_tokens', 'admin_users', 'partner_events')
union all
select 'extension', e.extname, e.extversion from pg_extension e
order by 1, 2;
