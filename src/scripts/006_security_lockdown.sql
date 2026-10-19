-- ==============================================================================
-- LE PETIT TOU — MIGRATION 006 : VERROUILLAGE DE SÉCURITÉ (audit pré-publication)
--
-- À LANCER APRÈS 005_admin_secure_writes.sql (rejoué avec un NOUVEAU code admin).
-- Colle tout dans Supabase -> SQL Editor -> Run. Le script est atomique
-- (begin/commit) et rejouable sans danger.
--
-- Ce que ça corrige (voir docs/audit/) :
--   S-01  addresses / categories / events / sponsored_partners étaient modifiables
--         par n'importe qui possédant la clé publique (RLS désactivée ou ouverte).
--         -> lecture publique seule ; toute écriture passe par admin_write().
--   S-02  le code admin (ancien, public dans l'historique Git) -> doit être changé
--         via 005 ; verrouillage anti force brute (10 échecs / 15 min).
--   S-03  user_place_discoveries & co lisibles/inscriptibles par tout le monde
--         (identifiants d'appareils exposés) -> plus aucun accès direct aux tables ;
--         lecture/écriture uniquement via des fonctions qui exigent l'identifiant
--         de l'appareil (ou la session auth) de l'appelant.
--   S-04  compteur de likes manipulable (delta arbitraire, répétable).
--   S-05  suggestions d'adresses (avec identifiant d'appareil) lisibles par tous.
--   S-06  suppression des données de l'utilisateur (RGPD art. 17) : delete_my_data().
--   S-07  tables address_views / user_push_tokens : RLS réactivée.
--
-- ATTENTION : après ce script, l'ANCIENNE version de l'application (qui écrit
-- directement dans les tables) ne peut plus modifier le catalogue : publie la
-- nouvelle version de l'appli (fournie dans ce dépôt) avant ou en même temps.
-- ==============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- 0. Pré-condition : 005 doit avoir été lancé (empreinte du code admin présente)
do $$
begin
  if to_regclass('public.admin_secrets') is null
     or not exists (select 1 from public.admin_secrets where key = 'admin_code_sha256') then
    raise exception 'Lance d''abord 005_admin_secure_writes.sql avec un NOUVEAU code admin.';
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 1. Vérification du code admin avec verrouillage anti force brute
-- ------------------------------------------------------------------------------
create table if not exists public.admin_login_attempts (
  id bigint generated always as identity primary key,
  attempted_at timestamptz not null default now()
);
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;

-- Porte unique : renvoie true/false SANS lever d'exception (sinon l'échec journalisé
-- serait annulé avec la transaction). 10 échecs en 15 minutes => tout est refusé.
create or replace function public._admin_gate(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_ok boolean := false;
begin
  delete from public.admin_login_attempts where attempted_at < now() - interval '1 day';

  if (select count(*) from public.admin_login_attempts
        where attempted_at > now() - interval '15 minutes') >= 10 then
    return false;
  end if;

  if p_code is not null and length(trim(p_code)) > 0 then
    if auth.uid() is not null
       and exists (select 1 from public.admin_users where id = auth.uid()) then
      v_ok := true;
    else
      select value into v_hash from public.admin_secrets where key = 'admin_code_sha256';
      v_ok := v_hash is not null
              and encode(extensions.digest(trim(p_code), 'sha256'), 'hex') = v_hash;
    end if;
  end if;

  if not v_ok then
    insert into public.admin_login_attempts default values;
  end if;
  return v_ok;
end;
$$;
revoke all on function public._admin_gate(text) from public, anon, authenticated;

create or replace function public.verify_admin_access(access_code text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select public._admin_gate(access_code);
$$;
revoke all on function public.verify_admin_access(text) from public;
grant execute on function public.verify_admin_access(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Catalogue : lecture publique seule, plus aucune écriture directe
-- ------------------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['addresses', 'categories', 'events', 'sponsored_partners'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format(
      'create policy "Lecture publique" on public.%I for select to anon, authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- Écriture admin : une seule fonction, tables et colonnes limitées, code vérifié côté serveur.
-- Renvoie toujours un jsonb : {"ok":true,"rows":[...]} ou {"ok":false,"error":"..."}.
create or replace function public.admin_write(
  p_code text,
  p_table text,
  p_op text,
  p_id text default null,
  p_record jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cols text;
  v_rows jsonb;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_table not in ('addresses', 'categories', 'events', 'sponsored_partners')
     or p_op not in ('insert', 'update', 'delete') then
    return jsonb_build_object('ok', false, 'error', 'invalid: table ou operation non autorisee');
  end if;

  if p_op in ('update', 'delete') and (p_id is null or length(trim(p_id)) = 0) then
    return jsonb_build_object('ok', false, 'error', 'invalid: identifiant manquant');
  end if;

  if p_op in ('insert', 'update') then
    if p_record is null or jsonb_typeof(p_record) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'invalid: enregistrement attendu');
    end if;
    -- Seules les colonnes réelles de la table sont retenues (les autres clés sont ignorées).
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
      into v_cols
      from information_schema.columns c
     where c.table_schema = 'public'
       and c.table_name = p_table
       and c.column_name in (select jsonb_object_keys(p_record))
       and c.column_name <> 'created_at'
       and (p_op = 'insert' or c.column_name <> 'id');
    if v_cols is null then
      return jsonb_build_object('ok', false, 'error', 'invalid: aucune colonne reconnue');
    end if;
  end if;

  begin
    if p_op = 'insert' then
      execute format(
        'with ins as (insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) returning *) '
        || 'select coalesce(jsonb_agg(to_jsonb(ins)), ''[]''::jsonb) from ins', p_table, v_cols)
        into v_rows using p_record;
    elsif p_op = 'update' then
      execute format(
        'with upd as (update public.%1$I t set (%2$s) = (select %2$s from jsonb_populate_record(null::public.%1$I, $1)) '
        || 'where t.id::text = $2 returning t.*) select coalesce(jsonb_agg(to_jsonb(upd)), ''[]''::jsonb) from upd',
        p_table, v_cols)
        into v_rows using p_record, p_id;
    else
      execute format(
        'with del as (delete from public.%1$I t where t.id::text = $1 returning t.*) '
        || 'select coalesce(jsonb_agg(to_jsonb(del)), ''[]''::jsonb) from del', p_table)
        into v_rows using p_id;
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid: ' || sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'rows', v_rows);
end;
$$;
revoke all on function public.admin_write(text, text, text, text, jsonb) from public;
grant execute on function public.admin_write(text, text, text, text, jsonb) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Agenda des partenaires : mêmes fonctions qu'en 005, mais via la porte
--    anti force brute. Un code refusé ne lève plus d'exception (null / -1 / vide)
--    afin que l'échec reste journalisé.
-- ------------------------------------------------------------------------------
drop function if exists public.admin_list_partner_events(text);
create or replace function public.admin_list_partner_events(p_code text)
returns setof public.partner_events
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_gate(p_code) then
    return;
  end if;
  return query select * from public.partner_events order by start_date, start_time;
end;
$$;

create or replace function public.admin_save_partner_event(p_code text, p_event jsonb)
returns public.partner_events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_event ->> 'title', ''));
  v_spot text := trim(coalesce(p_event ->> 'spot_id', ''));
  v_start_date_txt text := nullif(trim(coalesce(p_event ->> 'start_date', '')), '');
  v_until_txt text := nullif(trim(coalesce(p_event ->> 'repeat_weekly_until', '')), '');
  v_start_date date;
  v_start_time text := coalesce(nullif(p_event ->> 'start_time', ''), '19:00');
  v_end_time text := nullif(p_event ->> 'end_time', '');
  v_until date;
  v_description text := nullif(trim(coalesce(p_event ->> 'description', '')), '');
  v_location text := nullif(trim(coalesce(p_event ->> 'location_override', '')), '');
  v_link text := nullif(trim(coalesce(p_event ->> 'link_url', '')), '');
  v_active boolean;
  v_row public.partner_events;
begin
  if not public._admin_gate(p_code) then
    return null;
  end if;

  begin
    v_id := nullif(p_event ->> 'id', '')::uuid;
    v_active := coalesce((p_event ->> 'is_active')::boolean, true);
  exception when others then
    raise exception 'invalid: identifiant ou statut illisible' using errcode = '22023';
  end;

  if v_title = '' or v_spot = '' or v_start_date_txt is null then
    raise exception 'invalid: le titre, l''adresse et la date sont obligatoires' using errcode = '22023';
  end if;
  if length(v_title) > 200 or length(coalesce(v_description, '')) > 2000
     or length(coalesce(v_link, '')) > 500 or length(coalesce(v_location, '')) > 200 then
    raise exception 'invalid: texte trop long' using errcode = '22023';
  end if;
  if v_link is not null and v_link !~* '^https?://' then
    raise exception 'invalid: le lien doit commencer par http:// ou https://' using errcode = '22023';
  end if;
  -- les dates sont validées AVANT toute conversion (sinon 10/11/2026 serait lu comme le 11 octobre)
  if v_start_date_txt !~ '^\d{4}-\d{2}-\d{2}$'
     or (v_until_txt is not null and v_until_txt !~ '^\d{4}-\d{2}-\d{2}$') then
    raise exception 'invalid: la date doit s''ecrire AAAA-MM-JJ' using errcode = '22023';
  end if;
  begin
    v_start_date := v_start_date_txt::date;
    v_until := v_until_txt::date;
  exception when others then
    raise exception 'invalid: cette date n''existe pas dans le calendrier' using errcode = '22023';
  end;
  if v_start_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
     or (v_end_time is not null and v_end_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') then
    raise exception 'invalid: les heures doivent etre au format HH:MM' using errcode = '22023';
  end if;
  if v_end_time is not null and v_end_time <= v_start_time then
    raise exception 'invalid: l''heure de fin doit etre apres l''heure de debut' using errcode = '22023';
  end if;
  if v_until is not null and v_until < v_start_date then
    raise exception 'invalid: la fin de serie doit etre apres la premiere date' using errcode = '22023';
  end if;

  if v_id is null then
    insert into public.partner_events
      (spot_id, title, description, start_date, start_time, end_time,
       repeat_weekly_until, location_override, link_url, is_active)
    values
      (v_spot, v_title, v_description, v_start_date, v_start_time, v_end_time,
       v_until, v_location, v_link, v_active)
    returning * into v_row;
  else
    update public.partner_events
       set spot_id = v_spot, title = v_title, description = v_description,
           start_date = v_start_date, start_time = v_start_time, end_time = v_end_time,
           repeat_weekly_until = v_until, location_override = v_location,
           link_url = v_link, is_active = v_active
     where id = v_id
     returning * into v_row;
    if not found then
      raise exception 'invalid: evenement introuvable' using errcode = '22023';
    end if;
  end if;

  return v_row;
end;
$$;

-- Renvoie le nombre de lignes supprimées, ou -1 si le code admin est refusé.
create or replace function public.admin_delete_partner_event(p_code text, p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if not public._admin_gate(p_code) then
    return -1;
  end if;
  delete from public.partner_events where id = p_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.admin_list_partner_events(text) from public;
revoke all on function public.admin_save_partner_event(text, jsonb) from public;
revoke all on function public.admin_delete_partner_event(text, uuid) from public;
grant execute on function public.admin_list_partner_events(text) to anon, authenticated;
grant execute on function public.admin_save_partner_event(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_partner_event(text, uuid) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Données des utilisateurs : plus aucun accès direct aux tables
-- ------------------------------------------------------------------------------
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['user_place_discoveries', 'user_discount_cards', 'discount_card_uses'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- Les cartes privilège elles-mêmes sont publiques (lecture seule).
do $$
declare pol record;
begin
  if to_regclass('public.discount_cards') is not null then
    alter table public.discount_cards enable row level security;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'discount_cards' loop
      execute format('drop policy %I on public.discount_cards', pol.policyname);
    end loop;
    create policy "Lecture publique" on public.discount_cards
      for select to anon, authenticated using (is_active = true);
    revoke insert, update, delete, truncate on public.discount_cards from anon, authenticated;
  end if;
end
$$;

-- Anti doublon garanti par la base (double soumission, appels concurrents)
create unique index if not exists uq_discoveries_device_place
  on public.user_place_discoveries (device_id, place_id);
create unique index if not exists uq_user_cards_device_card
  on public.user_discount_cards (device_id, discount_card_id);

-- Identité de l'appelant : session Supabase si elle existe, sinon identifiant d'appareil
-- (UUID aléatoire généré par l'appli : il fait office de secret, d'où le contrôle de format).
create or replace function public._lpt_identity(p_device_id text)
returns text
language plpgsql
stable
set search_path = public, auth
as $$
declare
  v text;
begin
  if auth.uid() is not null then
    return auth.uid()::text;
  end if;
  v := nullif(trim(coalesce(p_device_id, '')), '');
  if v is null or v !~* '^[0-9a-f-]{32,40}$' then
    return null;
  end if;
  return lower(v);
end;
$$;
revoke all on function public._lpt_identity(text) from public, anon, authenticated;

-- Nettoyage des anciennes surcharges / fonctions obsolètes
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('discover_place', 'use_discount_card', 'unlock_discovery', 'get_user_progress',
                       'increment_spot_like', 'delete_user_account', 'get_my_discoveries',
                       'get_my_card_usage', 'delete_my_data')
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end
$$;

create or replace function public.get_my_discoveries(p_device_id text default null)
returns table (place_id text, points_awarded integer)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
begin
  if v_key is null then
    return;
  end if;
  return query
    select d.place_id, d.points_awarded
      from public.user_place_discoveries d
     where d.device_id = v_key;
end;
$$;

create or replace function public.get_my_card_usage(p_device_id text default null)
returns table (discount_card_id uuid, uses_count integer)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
begin
  if v_key is null then
    return;
  end if;
  return query
    select u.discount_card_id, u.uses_count
      from public.user_discount_cards u
     where u.device_id = v_key;
end;
$$;

create or replace function public.discover_place(
  p_device_id text default null,
  p_place_id text default null,
  p_source text default 'manual_checkin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_place text := nullif(trim(coalesce(p_place_id, '')), '');
  v_spot record;
  v_points integer;
  v_inserted integer := 0;
  v_total_points integer;
  v_total integer;
begin
  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  if v_place is null then
    return jsonb_build_object('success', false, 'error', 'PLACE_ID_REQUIS');
  end if;

  select id, rating, is_recommended, points_reward
    into v_spot
    from public.addresses
   where id::text = v_place;
  if not found then
    return jsonb_build_object('success', false, 'error', 'ADRESSE_INTROUVABLE');
  end if;

  if v_spot.points_reward is not null and v_spot.points_reward > 0 then
    v_points := v_spot.points_reward;
  elsif v_spot.is_recommended is true then
    v_points := 25;
  elsif v_spot.rating >= 4.8 then
    v_points := 20;
  else
    v_points := 10;
  end if;

  insert into public.user_place_discoveries (user_id, device_id, place_id, points_awarded, discovery_source)
  values (auth.uid(), v_key, v_place, v_points,
          case when p_source in ('manual_checkin', 'offline_sync') then p_source else 'manual_checkin' end)
  on conflict (device_id, place_id) do nothing;
  get diagnostics v_inserted = row_count;

  select coalesce(sum(points_awarded), 0), count(*)
    into v_total_points, v_total
    from public.user_place_discoveries where device_id = v_key;

  return jsonb_build_object(
    'success', true,
    'already_discovered', v_inserted = 0,
    'points_earned', case when v_inserted = 1 then v_points else 0 end,
    'total_points', v_total_points,
    'total_discovered', v_total
  );
end;
$$;

create or replace function public.use_discount_card(
  p_card_id uuid,
  p_device_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_card record;
  v_new_uses integer;
begin
  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  if p_card_id is null then
    return jsonb_build_object('success', false, 'error', 'CARD_ID_REQUIS');
  end if;

  select * into v_card
    from public.discount_cards
   where id = p_card_id and is_active = true
     and (valid_until is null or valid_until > now());
  if not found then
    return jsonb_build_object('success', false, 'error', 'CARTE_INTROUVABLE_OU_EXPIREE');
  end if;

  insert into public.user_discount_cards (user_id, device_id, discount_card_id, uses_count)
  values (auth.uid(), v_key, p_card_id, 0)
  on conflict (device_id, discount_card_id) do nothing;

  -- Décrémentation atomique : la condition uses_count < max_uses est évaluée sous verrou de ligne
  update public.user_discount_cards
     set uses_count = uses_count + 1,
         last_used_at = timezone('utc'::text, now())
   where device_id = v_key and discount_card_id = p_card_id and uses_count < v_card.max_uses
  returning uses_count into v_new_uses;

  if v_new_uses is null then
    select uses_count into v_new_uses
      from public.user_discount_cards where device_id = v_key and discount_card_id = p_card_id;
    return jsonb_build_object('success', false, 'error', 'QUOTA_MAX_ATTEINT',
      'uses_count', v_new_uses, 'max_uses', v_card.max_uses, 'remaining_uses', 0);
  end if;

  insert into public.discount_card_uses (user_id, device_id, discount_card_id)
  values (auth.uid(), v_key, p_card_id);

  return jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'uses_count', v_new_uses,
    'max_uses', v_card.max_uses,
    'remaining_uses', v_card.max_uses - v_new_uses
  );
end;
$$;

-- RGPD art. 17 : l'utilisateur efface lui-même toutes ses données (appareil + compte éventuel)
create or replace function public.delete_my_data(p_device_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_n_disc integer := 0;
  v_n_cards integer := 0;
  v_n_uses integer := 0;
  v_n_sugg integer := 0;
  v_n_likes integer := 0;
begin
  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'IDENTITE_INVALIDE');
  end if;

  delete from public.discount_card_uses where device_id = v_key or user_id = auth.uid();
  get diagnostics v_n_uses = row_count;
  delete from public.user_discount_cards where device_id = v_key or user_id = auth.uid();
  get diagnostics v_n_cards = row_count;
  delete from public.user_place_discoveries where device_id = v_key or user_id = auth.uid();
  get diagnostics v_n_disc = row_count;
  if to_regclass('public.place_suggestions') is not null then
    delete from public.place_suggestions where device_id = v_key;
    get diagnostics v_n_sugg = row_count;
  end if;
  if to_regclass('public.spot_user_likes') is not null then
    -- les compteurs publics de likes ne sont pas rectifiés : le like était anonyme et agrégé
    delete from public.spot_user_likes where device_id = v_key;
    get diagnostics v_n_likes = row_count;
  end if;
  if to_regclass('public.user_push_tokens') is not null then
    delete from public.user_push_tokens where device_id = v_key or user_id = auth.uid();
  end if;

  if auth.uid() is not null then
    delete from public.admin_users where id = auth.uid();
    delete from auth.users where id = auth.uid();
  end if;

  return jsonb_build_object('success', true, 'deleted', jsonb_build_object(
    'discoveries', v_n_disc, 'cards', v_n_cards, 'card_uses', v_n_uses,
    'suggestions', v_n_sugg, 'likes', v_n_likes));
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Likes : un like par appareil et par adresse (idempotent, delta contrôlé)
-- ------------------------------------------------------------------------------
create table if not exists public.spot_user_likes (
  spot_id text not null,
  device_id text not null,
  created_at timestamptz not null default now(),
  primary key (spot_id, device_id)
);
alter table public.spot_user_likes enable row level security;
revoke all on public.spot_user_likes from anon, authenticated;

alter table public.spot_likes enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'spot_likes' loop
    execute format('drop policy %I on public.spot_likes', pol.policyname);
  end loop;
  create policy "Lecture publique" on public.spot_likes for select to anon, authenticated using (true);
  revoke insert, update, delete, truncate on public.spot_likes from anon, authenticated;
end
$$;

create or replace function public.increment_spot_like(
  p_spot_id text,
  p_delta integer default 1,
  p_device_id text default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_spot text := nullif(trim(coalesce(p_spot_id, '')), '');
  v_changed integer := 0;
  v_total integer;
begin
  if v_spot is null or v_key is null or p_delta not in (-1, 1) then
    return 0;
  end if;
  if not exists (select 1 from public.addresses where id::text = v_spot) then
    return 0;
  end if;

  if p_delta = 1 then
    insert into public.spot_user_likes (spot_id, device_id) values (v_spot, v_key)
    on conflict do nothing;
    get diagnostics v_changed = row_count;
  else
    delete from public.spot_user_likes where spot_id = v_spot and device_id = v_key;
    get diagnostics v_changed = row_count;
    v_changed := -v_changed;
  end if;

  insert into public.spot_likes (spot_id, likes_count, updated_at)
  values (v_spot, greatest(0, v_changed), now())
  on conflict (spot_id) do update
    set likes_count = greatest(0, public.spot_likes.likes_count + v_changed),
        updated_at = now()
  returning likes_count into v_total;

  update public.addresses set likes_count = v_total where id::text = v_spot;
  return v_total;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. Droits d'exécution explicites
-- ------------------------------------------------------------------------------
revoke all on function public.get_my_discoveries(text) from public;
revoke all on function public.get_my_card_usage(text) from public;
revoke all on function public.discover_place(text, text, text) from public;
revoke all on function public.use_discount_card(uuid, text) from public;
revoke all on function public.delete_my_data(text) from public;
revoke all on function public.increment_spot_like(text, integer, text) from public;
grant execute on function public.get_my_discoveries(text) to anon, authenticated;
grant execute on function public.get_my_card_usage(text) to anon, authenticated;
grant execute on function public.discover_place(text, text, text) to anon, authenticated;
grant execute on function public.use_discount_card(uuid, text) to anon, authenticated;
grant execute on function public.delete_my_data(text) to anon, authenticated;
grant execute on function public.increment_spot_like(text, integer, text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 7. Tables secondaires
-- ------------------------------------------------------------------------------
-- Statistiques de consultation : insertion seule, aucune lecture publique
do $$
declare pol record;
begin
  if to_regclass('public.address_views') is not null then
    alter table public.address_views enable row level security;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'address_views' loop
      execute format('drop policy %I on public.address_views', pol.policyname);
    end loop;
    revoke all on public.address_views from anon, authenticated;
    grant insert (spot_id, source) on public.address_views to anon, authenticated;
    create policy "Insertion anonyme" on public.address_views
      for insert to anon, authenticated
      with check (char_length(spot_id) between 1 and 64
                  and (source is null or char_length(source) <= 32)
                  and user_id is null);
  end if;

  -- Aucune notification push n'est émise par l'appli : la table reste fermée
  if to_regclass('public.user_push_tokens') is not null then
    alter table public.user_push_tokens enable row level security;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'user_push_tokens' loop
      execute format('drop policy %I on public.user_push_tokens', pol.policyname);
    end loop;
    revoke all on public.user_push_tokens from anon, authenticated;
  end if;

  -- Suggestions : insertion seule, tailles bornées, jamais lisibles depuis l'appli
  if to_regclass('public.place_suggestions') is not null then
    alter table public.place_suggestions enable row level security;
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'place_suggestions' loop
      execute format('drop policy %I on public.place_suggestions', pol.policyname);
    end loop;
    revoke all on public.place_suggestions from anon, authenticated;
    grant insert (device_id, title, address, category_name, comment) on public.place_suggestions to anon, authenticated;
    create policy "Insertion bornee" on public.place_suggestions
      for insert to anon, authenticated
      with check (char_length(title) between 1 and 120
                  and char_length(coalesce(address, '')) <= 200
                  and char_length(coalesce(category_name, '')) <= 80
                  and char_length(coalesce(comment, '')) <= 1000
                  and char_length(device_id) between 16 and 64
                  and status = 'pending');
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 8. Stockage des photos (bucket "etablissements") : images bornées, pas de remplacement
--    ni de suppression depuis l'appli. Ignoré si le schéma storage n'existe pas.
-- ------------------------------------------------------------------------------
do $$
declare pol record;
begin
  if to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null then
    return;
  end if;

  update storage.buckets
     set file_size_limit = 5242880,
         allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
   where id = 'etablissements';

  for pol in
    select policyname from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and (coalesce(qual, '') like '%etablissements%' or coalesce(with_check, '') like '%etablissements%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;

  create policy "etablissements ajout images"
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'etablissements' and (storage.foldername(name))[1] in ('covers', 'gallery'));
end
$$;

commit;

notify pgrst, 'reload schema';
