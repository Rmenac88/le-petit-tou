-- ==============================================================================
-- LE PETIT TOU — MIGRATION 022 : EMPREINTE DU CATALOGUE (MOINS DE TRAFIC)
--
-- Indépendante des autres migrations. Atomique (begin/commit) et rejouable. Ne modifie aucune donnée.
--
-- Avant : l'appli retéléchargeait les 789 adresses (environ 350 Ko compressés) à chaque lancement, et la Recherche une
-- seconde fois. Le quota de trafic de l'offre gratuite de Supabase (5 Go par mois) était atteint dès quelques centaines
-- d'utilisateurs actifs par jour.
-- Après : l'appli garde une copie du catalogue et ne demande au lancement que cette empreinte (quelques dizaines
-- d'octets). Le catalogue n'est retéléchargé que s'il a changé.
--
-- Sécurité : la fonction ne lit que ce que la clé publique peut déjà lire (security invoker, mêmes droits que la lecture
-- de la table addresses) et ne renvoie qu'une empreinte MD5 : aucune donnée supplémentaire n'est exposée.
-- Les compteurs de likes sont exclus : un like ne doit pas forcer chaque téléphone à retélécharger le catalogue.
-- ==============================================================================

begin;

create or replace function public.catalog_version()
returns text
language sql
stable
security invoker
set search_path = public
as $$
  select md5(coalesce(string_agg(md5((to_jsonb(a) - 'likes_count')::text), '' order by a.id::text), ''))
    from public.addresses a;
$$;

revoke all on function public.catalog_version() from public;
grant execute on function public.catalog_version() to anon, authenticated;

commit;

notify pgrst, 'reload schema';
