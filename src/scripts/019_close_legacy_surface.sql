-- ==============================================================================
-- LE PETIT TOU — 019 : fermeture des anciens éléments de la base (audit N-14 / S2-03)
--
-- À lancer dans Supabase -> SQL Editor -> New query -> Run. Aucun secret à remplacer.
-- Résultat attendu : "Success. No rows returned". Relançable sans danger. Atomique.
--
-- Des anciens scripts (billetterie, commerçants) ont laissé des tables et des fonctions que
-- l'appli n'utilise pas et qui restaient accessibles avec la clé publique. Ce script :
--   * retire le droit de les exécuter à la clé publique (les fonctions et déclencheurs internes
--     continuent de fonctionner : le droit n'est contrôlé qu'à la création d'un déclencheur) ;
--   * active la sécurité par ligne (RLS) sur les 4 anciennes tables et leur retire tout droit
--     public. Les données (par exemple les 8 lignes de « spots ») sont CONSERVÉES, rien n'est supprimé ;
--   * retire les droits d'écriture inutiles sur admin_users et partner_events (déjà refusés par RLS).
-- ==============================================================================

begin;

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('generate_ticket_number', 'handle_new_user', 'rls_auto_enable', 'scan_ticket_secure',
                         'schedule_event_reminders', 'tr_notify_new_event', 'tr_notify_new_spot')
  loop
    execute 'revoke execute on function ' || r.sig || ' from public, anon, authenticated';
  end loop;
end
$$;

do $$
declare t text;
begin
  foreach t in array array['spots', 'reviews', 'merchant_notifications', 'merchant_visits'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;

  foreach t in array array['admin_users', 'partner_events'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end
$$;

commit;
