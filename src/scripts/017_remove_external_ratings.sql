-- ==============================================================================
-- LE PETIT TOU — 017 : retrait des notes issues de services tiers (Google, TripAdvisor)
--
-- À lancer dans Supabase -> SQL Editor -> New query -> Run. Aucun secret à remplacer.
-- Résultat attendu : "Success. No rows returned". Relançable sans danger.
--
-- Pourquoi : le droit de republier ces notes n'est pas établi (docs/audit/03 et 13, D2-04).
-- L'appli ne les affiche plus (Features.externalRatings = false) ; ce script efface celles
-- qui restent dans la base pour qu'elles ne soient plus lisibles avec la clé publique.
--
-- ATTENTION, DESTRUCTIF : les notes effacées ne sont pas récupérables par ce script.
-- Si tu veux les garder en interne, fais d'abord une sauvegarde (Database -> Backups)
-- ou exporte la table addresses (Table editor -> Export) avant de lancer.
--
-- Effet sur les points : le barème serveur reste « récompense propre à l'adresse, sinon
-- 25 pour un coup de coeur, sinon 10 » ; la tranche « note >= 4,8 = 20 » ne s'applique plus
-- puisqu'il n'y a plus de note (la comparaison avec le vide ne retient jamais la ligne).
-- ==============================================================================

begin;

alter table public.addresses alter column rating drop not null;
alter table public.addresses alter column rating drop default;

update public.addresses set rating = null where rating is not null;

commit;
