-- ==============================================================================
-- LE PETIT TOU — MIGRATION 026 : PLUS DE PLAFOND DE NOTIFICATIONS PAR JOUR
--
-- À LANCER APRÈS 007. Atomique (begin/commit) et rejouable.
--
-- Décision de l'association (23/11/2026) : toutes les notifications partent, quel que soit leur nombre dans la
-- journée. Avant, un téléphone ne recevait que 2 notifications automatiques (événements, agenda, nouvelles adresses)
-- par 24 h, annonces du portail comprises dans le compte ; les suivantes étaient abandonnées sans prévenir.
--
-- Ce qui reste : le regroupement de 2 minutes (plusieurs nouvelles adresses = un seul message), les heures calmes
-- (21 h - 8 h, envoi au matin), les choix de chaque utilisateur (types de messages), l'envoi par lots.
-- La fonction est MODIFIÉE SUR PLACE (son texte actuel en base, une seule valeur change) : si le point de
-- modification est introuvable, la migration s'arrête sans rien changer.
-- ==============================================================================

begin;

do $$
declare
  v_def text;
  v_new text;
  v_old constant text := 'c_cap constant integer := 2;';
  v_nocap constant text := 'c_cap constant integer := 2147483647;';
begin
  if to_regprocedure('public.push_fanout(timestamptz)') is null then
    raise exception 'Lance d''abord 007_push_notifications.sql.';
  end if;
  select pg_get_functiondef('public.push_fanout(timestamptz)'::regprocedure) into v_def;
  if position(v_nocap in v_def) > 0 then
    return; -- déjà appliquée
  end if;
  v_new := replace(v_def, v_old, v_nocap);
  if v_new = v_def then
    raise exception 'push_fanout : plafond introuvable, aucune modification (relire 007 avant de continuer).';
  end if;
  execute v_new;
end
$$;

commit;
