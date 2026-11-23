-- ==============================================================================
-- LE PETIT TOU — ÉTAT DES MIGRATIONS EN PRODUCTION (LECTURE SEULE)
--
-- À coller dans Supabase → SQL Editor → Run. Ne modifie RIEN : une seule ligne de résultat,
-- une colonne par migration (true = appliquée, false = à appliquer).
-- ==============================================================================
select
  to_regprocedure('public.admin_save_offer(text,jsonb)') is not null                      as m013_offres,
  to_regprocedure('public.admin_set_home_theme(text,jsonb)') is not null                  as m014_theme,
  to_regprocedure('public.get_my_lists(text)') is not null                                as m015_listes,
  to_regclass('public.sponsored_partners_public') is not null                             as m016_prix_masque,
  (select count(*) from public.addresses where rating is not null) = 0                    as m017_notes_retirees,
  to_regprocedure('public.purge_old_suggestions(timestamptz)') is not null                as m018_purge_suggestions,
  coalesce((select bool_and(not has_function_privilege('anon', p.oid, 'execute'))
              from pg_proc p
             where p.pronamespace = 'public'::regnamespace and p.proname = 'scan_ticket_secure'), true)
                                                                                          as m019_anciennes_surfaces,
  to_regprocedure('public.admin_set_tourism_banner(text,text)') is not null               as m020_banniere_tourisme,
  exists (select 1 from pg_constraint where conname = 'push_devices_token_length')        as m021_durcissement,
  to_regprocedure('public.catalog_version()') is not null                                 as m022_empreinte_catalogue,
  (select count(*) from public.discount_cards
    where id::text like 'a1111111%' or id::text like 'a2222222%' or id::text like 'a3333333%'
       or id::text like 'a4444444%' or id::text like 'a5555555%')                          as offres_demo_restantes;
