-- ==============================================================================
-- LE PETIT TOU — MIGRATION 021 : DURCISSEMENT (AUDIT DE SÉCURITÉ DU 23/11/2026)
--
-- À LANCER APRÈS 007 (notifications) ET 019 (anciennes surfaces). Atomique (begin/commit) et rejouable.
-- Ne supprime aucune donnée et ne retire aucune protection existante : elle en ajoute deux.
--
--   • S2-05 : un jeton de notification ne peut plus dépasser 256 caractères (un vrai jeton Expo en fait ~41).
--     Sans cette limite, un script pouvait inscrire des « jetons » de plusieurs mégaoctets et remplir la base.
--     La règle s'applique aux nouvelles inscriptions ; les lignes déjà en base sont contrôlées si possible
--     (si une ancienne ligne est trop longue, elle reste et la règle vaut pour la suite : rien n'échoue).
--   • S2-14 : la table admin_users n'est plus lisible avec la clé publique (elle ne l'était que grâce à la RLS).
--     Le contrôle du code admin (_admin_gate, security definer) n'en dépend pas.
-- ==============================================================================

begin;

do $$
begin
  if to_regclass('public.push_devices') is null then
    raise exception 'Lance d''abord 007_push_notifications.sql (table push_devices).';
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 1. Taille maximale d'un jeton de notification (S2-05)
-- ------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.push_devices'::regclass and conname = 'push_devices_token_length') then
    alter table public.push_devices
      add constraint push_devices_token_length check (char_length(token) <= 256) not valid;
  end if;
  begin
    alter table public.push_devices validate constraint push_devices_token_length;
  exception when check_violation then
    raise notice 'Des jetons de plus de 256 caractères existent déjà : ils restent, la limite vaut pour les nouvelles inscriptions.';
  end;
end
$$;

-- ------------------------------------------------------------------------------
-- 2. admin_users : plus aucun droit pour la clé publique (S2-14)
-- ------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.admin_users') is not null then
    revoke all on public.admin_users from anon, authenticated;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
