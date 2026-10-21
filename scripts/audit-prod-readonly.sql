-- Contrôle de la base de PRODUCTION — LECTURE SEULE (aucune modification).
-- À coller dans Supabase -> SQL Editor -> Run. Renvoie un tableau : chaque ligne « FAIL » est un écart.
-- Reproduit en production les contrôles de tests/sql/backend-audit.test.mjs (surface d'attaque, RLS, cron).

with allowed(fn) as (values
  ('admin_delete_partner_event'), ('admin_list_partner_events'), ('admin_push_stats'), ('admin_save_partner_event'),
  ('admin_send_push'), ('admin_write'), ('delete_my_data'), ('discover_place'), ('get_my_card_usage'),
  ('get_my_discoveries'), ('get_push_preferences'), ('increment_spot_like'), ('register_push_token'),
  ('unregister_push_token'), ('update_push_preferences'), ('use_discount_card'), ('verify_admin_access')
),
exposed as (
  select p.proname as fn, r.rolname as role
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
    join pg_roles r on r.rolname in ('anon', 'authenticated')
   where has_function_privilege(r.rolname, p.oid, 'execute')
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')  -- hors extensions
)
select 'FAIL' as statut, 'fonction exécutable par ' || role || ' hors liste blanche' as controle, fn as detail
  from exposed where fn not in (select fn from allowed)
union all
select 'FAIL', 'table publique SANS Row Level Security', c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
union all
select 'FAIL', 'anon peut écrire directement dans la table', c.relname
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
   and (has_table_privilege('anon', c.oid, 'insert') or has_table_privilege('anon', c.oid, 'update')
        or has_table_privilege('anon', c.oid, 'delete'))
   and c.relname in ('addresses', 'categories', 'events', 'sponsored_partners', 'partner_events', 'admin_users',
                     'admin_secrets', 'admin_login_attempts', 'push_devices', 'push_outbox', 'push_deliveries', 'push_requests')
union all
select 'FAIL', 'tâche planifiée absente ou inactive', j.name
  from (values ('lpt-push-tick'), ('lpt-purge')) j(name)
 where not exists (select 1 from cron.job c where c.jobname = j.name and c.active)
union all
select 'FAIL', 'extension manquante', e.name
  from (values ('pg_net'), ('pg_cron'), ('pgcrypto')) e(name)
 where not exists (select 1 from pg_extension x where x.extname = e.name)
union all
select 'INFO', 'tables du schéma public (RLS activée)', string_agg(c.relname, ', ' order by c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
union all
select 'INFO', 'appareils de notification enregistrés (valides)', count(*)::text
  from public.push_devices where invalid_at is null
union all
select 'INFO', 'messages en attente / échecs 7 jours', (select count(*) from public.push_outbox where status = 'pending')::text
       || ' en attente / ' || (select count(*) from public.push_deliveries
                                where status in ('failed', 'receipt_error') and created_at > now() - interval '7 days')::text || ' échecs'
order by 1, 2, 3;
