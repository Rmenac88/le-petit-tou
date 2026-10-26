-- ==============================================================================
-- LE PETIT TOU — MIGRATION 015 : SAUVEGARDE SERVEUR DES LISTES PERSONNELLES
--
-- À LANCER APRÈS 006 (identité d'appareil) ET 007 (effacement des données, purge). Atomique (begin/commit) et
-- rejouable.
--
-- Les listes (« À tester plus tard », « Y retourner », listes créées) restent d'abord enregistrées sur le téléphone ;
-- cette migration ajoute une COPIE sur le serveur, rattachée à l'identifiant de l'installation (le même que les points,
-- les likes et les réductions) : aucune connexion Google ou autre n'est nécessaire.
-- Limite à connaître : l'identifiant est propre à l'installation. Désinstaller l'appli ou changer de téléphone crée un
-- nouveau profil, donc ne restitue pas les listes tant qu'il n'existe pas de vrai compte.
--
-- Sécurité (aucune protection existante n'est désactivée) :
--   • la table n'est ni lisible ni inscriptible directement avec la clé publique (RLS activée, aucun droit) ;
--   • get_my_lists / save_my_lists passent par _lpt_identity : session Supabase si elle existe, sinon l'identifiant
--     d'appareil (UUID aléatoire servant de secret) ; une identité invalide est refusée ;
--   • save_my_lists revérifie tout et ne stocke que ce qu'elle reconstruit : 20 listes au plus, 100 adresses par liste,
--     identifiants sûrs, noms de 30 caractères, une pastille, aucune autre clé, 120 Ko au plus ;
--   • « Effacer mes données » (delete_my_data) efface aussi les listes ; la purge des appareils inactifs (24 mois)
--     aussi. Ces deux fonctions sont MODIFIÉES SUR PLACE (leur texte actuel en base reçoit une ligne de plus) : si le
--     point d'insertion est introuvable, la migration s'arrête sans rien changer plutôt que d'oublier l'effacement.
-- ==============================================================================

begin;

do $$
begin
  if to_regprocedure('public._lpt_identity(text)') is null then
    raise exception 'Lance d''abord 006_security_lockdown.sql (identité d''appareil).';
  end if;
  if to_regprocedure('public.delete_my_data(text)') is null or to_regprocedure('public.purge_old_data(timestamptz)') is null then
    raise exception 'Lance d''abord 007_push_notifications.sql (effacement des données et purge).';
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 1. Table (une ligne par installation)
-- ------------------------------------------------------------------------------
create table if not exists public.user_lists (
  device_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.user_lists enable row level security;
revoke all on public.user_lists from anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Lecture et enregistrement
-- ------------------------------------------------------------------------------
create or replace function public.get_my_lists(p_device_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_data jsonb;
  v_updated timestamptz;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  select l.data, l.updated_at into v_data, v_updated from public.user_lists l where l.device_id = v_key;
  if not found then
    return jsonb_build_object('ok', true, 'data', null, 'updated', 0);
  end if;
  return jsonb_build_object('ok', true, 'data', v_data, 'updated', (extract(epoch from v_updated) * 1000)::bigint);
end;
$$;

create or replace function public.save_my_lists(p_device_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_id constant text := '^[A-Za-z0-9_-]{1,64}$';
  v_item jsonb;
  v_spot jsonb;
  v_spots jsonb;
  v_name text;
  v_emoji text;
  v_lists jsonb := '[]'::jsonb;
  v_seen text[] := '{}';
  v_value jsonb;
  v_updated timestamptz;
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or jsonb_typeof(p_data -> 'lists') is distinct from 'array' then
    return jsonb_build_object('ok', false, 'error', 'invalid: listes illisibles');
  end if;
  if octet_length(p_data::text) > 120000 then
    return jsonb_build_object('ok', false, 'error', 'invalid: listes trop volumineuses');
  end if;
  if jsonb_array_length(p_data -> 'lists') > 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid: trop de listes (20 au maximum)');
  end if;

  for v_item in select * from jsonb_array_elements(p_data -> 'lists') loop
    if jsonb_typeof(v_item) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'invalid: liste illisible');
    end if;
    if jsonb_typeof(v_item -> 'id') is distinct from 'string' or (v_item ->> 'id') !~ v_id then
      return jsonb_build_object('ok', false, 'error', 'invalid: identifiant de liste non valide');
    end if;
    if (v_item ->> 'id') = any (v_seen) then
      return jsonb_build_object('ok', false, 'error', 'invalid: liste en double');
    end if;
    v_seen := v_seen || (v_item ->> 'id');
    if not coalesce((v_item ->> 'kind') = any (array['later', 'return', 'custom']), false) then
      return jsonb_build_object('ok', false, 'error', 'invalid: type de liste inconnu');
    end if;

    v_name := btrim(regexp_replace(coalesce(v_item ->> 'name', ''), '\s+', ' ', 'g'));
    if jsonb_typeof(v_item -> 'name') is distinct from 'string' or v_name = '' or length(v_name) > 30 or v_name ~ '[[:cntrl:]]' then
      return jsonb_build_object('ok', false, 'error', 'invalid: nom de liste non valide (1 à 30 caractères)');
    end if;
    v_emoji := coalesce(v_item ->> 'emoji', '');
    if jsonb_typeof(v_item -> 'emoji') is distinct from 'string' or v_emoji = '' or length(v_emoji) > 16 or v_emoji ~ '[[:cntrl:]]' then
      return jsonb_build_object('ok', false, 'error', 'invalid: pastille non valide');
    end if;

    if jsonb_typeof(v_item -> 'spotIds') is distinct from 'array' or jsonb_array_length(v_item -> 'spotIds') > 100 then
      return jsonb_build_object('ok', false, 'error', 'invalid: adresses de la liste non valides (100 au maximum)');
    end if;
    v_spots := '[]'::jsonb;
    for v_spot in select * from jsonb_array_elements(v_item -> 'spotIds') loop
      if jsonb_typeof(v_spot) <> 'string' or (v_spot #>> '{}') !~ v_id then
        return jsonb_build_object('ok', false, 'error', 'invalid: identifiant d''adresse non valide');
      end if;
      v_spots := v_spots || v_spot;
    end loop;

    if jsonb_typeof(v_item -> 'createdAt') is distinct from 'number' or jsonb_typeof(v_item -> 'updatedAt') is distinct from 'number' then
      return jsonb_build_object('ok', false, 'error', 'invalid: dates de liste non valides');
    end if;
    if (v_item ->> 'createdAt')::numeric not between 0 and 9999999999999
       or (v_item ->> 'updatedAt')::numeric not between 0 and 9999999999999 then
      return jsonb_build_object('ok', false, 'error', 'invalid: dates de liste non valides');
    end if;

    v_lists := v_lists || jsonb_build_array(jsonb_build_object(
      'id', v_item ->> 'id',
      'kind', v_item ->> 'kind',
      'name', v_name,
      'emoji', v_emoji,
      'spotIds', v_spots,
      'createdAt', floor((v_item ->> 'createdAt')::numeric)::bigint,
      'updatedAt', floor((v_item ->> 'updatedAt')::numeric)::bigint));
  end loop;

  v_value := jsonb_build_object('version', 1, 'lists', v_lists);
  insert into public.user_lists as l (device_id, data, updated_at) values (v_key, v_value, now())
  on conflict (device_id) do update set data = excluded.data, updated_at = now()
  returning l.updated_at into v_updated;

  return jsonb_build_object('ok', true, 'updated', (extract(epoch from v_updated) * 1000)::bigint);
end;
$$;

revoke all on function public.get_my_lists(text) from public;
revoke all on function public.save_my_lists(text, jsonb) from public;
grant execute on function public.get_my_lists(text) to anon, authenticated;
grant execute on function public.save_my_lists(text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Effacement des données et purge : une ligne de plus dans les fonctions DÉJÀ en base
--    (on part de leur texte actuel, pas d'une copie : rien d'autre ne change ; rejouable)
-- ------------------------------------------------------------------------------
do $$
declare
  v_def text;
  v_new text;
  -- ajout à la purge : listes supprimées après 24 mois sans modification ni aucune autre activité de l'appareil
  v_purge_add constant text := $sql$-- listes personnelles inactives depuis 24 mois
  delete from public.user_lists ul
   where ul.updated_at < p_now - interval '24 months'
     and not exists (select 1 from public.user_place_discoveries d where d.device_id = ul.device_id and d.created_at >= p_now - interval '24 months')
     and not exists (select 1 from public.spot_user_likes k where k.device_id = ul.device_id and k.created_at >= p_now - interval '24 months')
     and not exists (select 1 from public.discount_card_uses u where u.device_id = ul.device_id and u.used_at >= p_now - interval '24 months');

  $sql$;
  v_purge_anchor constant text := 'return jsonb_build_object(''push_deliveries'', v_deliveries,';
  v_delete_anchor constant text := 'delete from public.push_devices where device_id = v_key;';
begin
  select pg_get_functiondef('public.delete_my_data(text)'::regprocedure) into v_def;
  if position('public.user_lists' in v_def) = 0 then
    v_new := replace(v_def, v_delete_anchor, v_delete_anchor || E'\n  delete from public.user_lists where device_id = v_key;');
    if v_new = v_def then
      raise exception 'delete_my_data : point d''insertion introuvable, aucune modification (relire 007 avant de continuer).';
    end if;
    execute v_new;
  end if;

  select pg_get_functiondef('public.purge_old_data(timestamptz)'::regprocedure) into v_def;
  if position('public.user_lists' in v_def) = 0 then
    v_new := replace(v_def, v_purge_anchor, v_purge_add || v_purge_anchor);
    if v_new = v_def then
      raise exception 'purge_old_data : point d''insertion introuvable, aucune modification (relire 007 avant de continuer).';
    end if;
    execute v_new;
  end if;
end
$$;

commit;

notify pgrst, 'reload schema';
