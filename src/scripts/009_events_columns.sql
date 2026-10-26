-- ==============================================================================
-- LE PETIT TOU — MIGRATION 009 : colonnes d'événements lues et écrites par l'appli
--
-- L'accueil lit events.booking_url et events.max_places ; le portail admin les écrit. Ces colonnes existent
-- en production mais aucune migration du dépôt ne les créait : une NOUVELLE base (autre projet Supabase)
-- afficherait une liste d'événements vide. Rejouable, sans effet si elles existent déjà.
-- À lancer dans Supabase -> SQL Editor -> Run. Attendu : "Success. No rows returned".
-- ==============================================================================
begin;

do $$
begin
  if to_regclass('public.events') is not null then
    alter table public.events add column if not exists booking_url text;
    alter table public.events add column if not exists max_places integer;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
