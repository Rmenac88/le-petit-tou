-- ==============================================================================
-- LE PETIT TOU — MIGRATION 008 : FERMETURE DE L'ANCIENNE FILE DE NOTIFICATIONS
--
-- Constat du 21/10/2026 (scripts/audit-prod-readonly.sql + sondes) : la table héritée
-- public.notification_queue (jetons de notification, titres, messages) est LISIBLE et MODIFIABLE
-- par la clé publique de l'appli. N'importe qui pouvait lire les jetons et écrire des messages.
-- Aucun code de ce dépôt ne l'utilise ; le nouveau système (007) a ses propres tables fermées.
--
-- Effet : RLS activée, plus aucun droit pour anon / authenticated. Les envois côté serveur
-- (rôle service_role, scripts Python) continuent de fonctionner. Atomique et rejouable.
-- À lancer dans Supabase -> SQL Editor -> Run. Attendu : "Success. No rows returned".
-- ==============================================================================

begin;

do $$
begin
  if to_regclass('public.notification_queue') is not null then
    alter table public.notification_queue enable row level security;
    revoke all on public.notification_queue from anon, authenticated;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
