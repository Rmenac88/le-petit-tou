-- ==============================================================================
-- LE PETIT TOU — MIGRATION 024 : CORRECTIONS DEMANDÉES PAR L'ANALYSE DE SÉCURITÉ DE SUPABASE (23/11/2026)
--
-- À LANCER APRÈS 016 et 019. Atomique (begin/commit) et rejouable. Aucune donnée modifiée.
--
-- 1. « Security Definer View » (niveau ERREUR) : la vue publique des partenaires s'exécutait avec les droits de son
--    créateur. Elle passe en « security invoker » : la clé publique lit seulement les colonnes publiques de la table
--    (jamais price_paid, notify_interval_hours, last_notified_at) et seulement les partenaires actifs (RLS).
--    Le résultat lu par l'appli est identique.
-- 2. « Function Search Path Mutable » : les 6 anciennes fonctions (déjà non exécutables par la clé publique depuis 019)
--    reçoivent un search_path fixe.
-- ==============================================================================

begin;

do $$
declare
  v_col text;
begin
  if to_regclass('public.sponsored_partners_public') is null then
    raise exception 'Lance d''abord 016_hide_partner_price.sql.';
  end if;
  -- Droit de lecture colonne par colonne : exactement les colonnes de la vue publique
  for v_col in
    select a.attname from pg_attribute a
     where a.attrelid = 'public.sponsored_partners_public'::regclass and a.attnum > 0 and not a.attisdropped
  loop
    execute format('grant select (%I) on public.sponsored_partners to anon, authenticated', v_col);
  end loop;
end
$$;

alter table public.sponsored_partners enable row level security;
drop policy if exists "Lecture publique des partenaires actifs" on public.sponsored_partners;
create policy "Lecture publique des partenaires actifs" on public.sponsored_partners
  for select to anon, authenticated using (is_active = true);

alter view public.sponsored_partners_public set (security_invoker = true);

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in ('handle_new_user', 'schedule_event_reminders', 'tr_notify_new_spot', 'generate_ticket_number',
                         'tr_notify_new_event', 'scan_ticket_secure')
  loop
    execute 'alter function ' || r.sig || ' set search_path = public';
  end loop;
end
$$;

commit;

notify pgrst, 'reload schema';
