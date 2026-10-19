-- ==============================================================================
-- LE PETIT TOU — ÉCRITURE SÉCURISÉE DE L'AGENDA + CHANGEMENT DU CODE ADMIN
--
-- À FAIRE AVANT DE LANCER (3 consignes) :
--   1. Plus bas, remplace  CHANGE_MOI  par TON NOUVEAU code admin :
--      long (16 caractères minimum), jamais utilisé ailleurs, différent de l'ancien.
--   2. Colle tout le script dans Supabase -> SQL Editor -> New query -> Run.
--      Résultat attendu : "Success. No rows returned".
--   3. Ne commite JAMAIS la version où tu as écrit ton vrai code : garde le fichier
--      du dépôt tel quel (avec CHANGE_MOI).
--
-- Le script est atomique (begin/commit) : s'il échoue, rien n'est modifié.
-- Après exécution, l'ANCIEN code admin ne fonctionne plus. Le nouveau code n'est
-- stocké que sous forme d'empreinte SHA-256 dans une table illisible depuis l'appli.
-- ==============================================================================

begin;

create extension if not exists pgcrypto with schema extensions;

-- 1. Comptes admin (déjà là chez toi si secure_admin_and_rls.sql a été lancé)
create table if not exists public.admin_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

-- 2. Coffre : empreinte du code admin. RLS activée SANS aucune politique =
--    illisible et inscriptible depuis l'appli ; seules les fonctions ci-dessous y accèdent.
create table if not exists public.admin_secrets (
  key text primary key,
  value text not null
);
alter table public.admin_secrets enable row level security;
revoke all on public.admin_secrets from anon, authenticated;

do $$
declare
  v_code text := 'CHANGE_MOI';   -- <<< REMPLACE ICI (garde les apostrophes)
begin
  if v_code = 'CHANGE_MOI' or length(trim(v_code)) < 16 then
    raise exception 'Remplace CHANGE_MOI par ton nouveau code admin (16 caracteres minimum) avant de lancer ce script.';
  end if;
  insert into public.admin_secrets (key, value)
  values ('admin_code_sha256', encode(extensions.digest(trim(v_code), 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;
end
$$;

-- 3. Vérification du code côté serveur : plus aucun code en clair
create or replace function public.verify_admin_access(access_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if access_code is null or length(trim(access_code)) = 0 then
    return false;
  end if;

  if auth.uid() is not null
     and exists (select 1 from public.admin_users where id = auth.uid()) then
    return true;
  end if;

  select value into v_hash from public.admin_secrets where key = 'admin_code_sha256';
  if v_hash is null then
    return false;
  end if;

  return encode(extensions.digest(trim(access_code), 'sha256'), 'hex') = v_hash;
end;
$$;

-- 4. Lister toutes les dates (actives ou non)
create or replace function public.admin_list_partner_events(p_code text)
returns setof public.partner_events
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.verify_admin_access(p_code) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.partner_events order by start_date, start_time;
end;
$$;

-- 5. Ajouter (sans "id") ou modifier (avec "id") une date
create or replace function public.admin_save_partner_event(p_code text, p_event jsonb)
returns public.partner_events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := nullif(p_event ->> 'id', '')::uuid;
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
  v_active boolean := coalesce((p_event ->> 'is_active')::boolean, true);
  v_row public.partner_events;
begin
  if not public.verify_admin_access(p_code) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if v_title = '' or v_spot = '' or v_start_date_txt is null then
    raise exception 'invalid: le titre, l''adresse et la date sont obligatoires' using errcode = '22023';
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
       set spot_id = v_spot,
           title = v_title,
           description = v_description,
           start_date = v_start_date,
           start_time = v_start_time,
           end_time = v_end_time,
           repeat_weekly_until = v_until,
           location_override = v_location,
           link_url = v_link,
           is_active = v_active
     where id = v_id
     returning * into v_row;
    if not found then
      raise exception 'invalid: evenement introuvable' using errcode = '22023';
    end if;
  end if;

  return v_row;
end;
$$;

-- 6. Retirer une date (renvoie le nombre de lignes supprimées)
create or replace function public.admin_delete_partner_event(p_code text, p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if not public.verify_admin_access(p_code) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  delete from public.partner_events where id = p_id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 7. Qui peut appeler quoi
revoke all on function public.admin_list_partner_events(text) from public;
revoke all on function public.admin_save_partner_event(text, jsonb) from public;
revoke all on function public.admin_delete_partner_event(text, uuid) from public;
grant execute on function public.admin_list_partner_events(text) to anon, authenticated;
grant execute on function public.admin_save_partner_event(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_partner_event(text, uuid) to anon, authenticated;

commit;
