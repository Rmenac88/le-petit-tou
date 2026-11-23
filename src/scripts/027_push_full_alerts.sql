-- ==============================================================================
-- LE PETIT TOU — MIGRATION 027 : TOUTES LES NOTIFICATIONS AVEC SON ET BANDEAU
--
-- À LANCER APRÈS 010 (styles des notifications). Atomique (begin/commit) et rejouable.
--
-- Avant : seules les annonces du portail apparaissaient en bandeau (canal Android d'importance haute, priorité
-- « high »). Événements, agenda et nouvelles adresses arrivaient avec le son mais seulement en icône dans la barre
-- d'état ; sur iPhone, les nouvelles adresses étaient « discrètes » (ni son ni bandeau).
-- Après : tous les types partent en priorité haute, en mode « actif » sur iPhone, et sur Android dans de NOUVEAUX
-- canaux d'importance haute (un canal Android ne peut plus changer d'importance une fois créé sur le téléphone).
--
-- À SAVOIR : les nouveaux canaux sont créés par la version de l'appli qui accompagne cette migration
-- (src/lib/pushLogic.ts). Un téléphone resté sur une ancienne version ne connaît pas ces canaux : réinstaller l'APK.
-- ==============================================================================

begin;

create or replace function public._push_style(p_kind text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'event' then jsonb_build_object(
      'channel', 'lpt-evenements', 'emoji', '🎉', 'subtitle', 'Événements de l''association',
      'priority', 'high', 'level', 'active')
    when 'agenda' then jsonb_build_object(
      'channel', 'lpt-rendez-vous', 'emoji', '📅', 'subtitle', 'Agenda des partenaires',
      'priority', 'high', 'level', 'active')
    when 'new_spot' then jsonb_build_object(
      'channel', 'lpt-adresses', 'emoji', '✨', 'subtitle', 'Nouveautés du guide',
      'priority', 'high', 'level', 'active')
    else jsonb_build_object(
      'channel', 'lpt-announcements', 'emoji', '📣', 'subtitle', 'Message du Petit Tou',
      'priority', 'high', 'level', 'active')
  end
$$;
revoke all on function public._push_style(text) from public, anon, authenticated;

commit;
