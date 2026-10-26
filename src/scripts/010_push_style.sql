-- ==============================================================================
-- LE PETIT TOU — MIGRATION 010 : NOTIFICATIONS « AUX COULEURS DU PETIT TOU »
--
-- À LANCER APRÈS 007. Atomique (begin/commit) et rejouable.
--
-- Ce que ça change pour l'utilisateur, identique sur Android et iOS :
--   • un titre soigné avec un émoji par type (événement, agenda, nouvelle adresse, annonce) ;
--   • un sous-titre (iOS) et un regroupement par type (iOS : threadId) ;
--   • un canal Android par type (réglable dans les paramètres du téléphone) et, pour les événements et les
--     nouvelles adresses, l'image de l'établissement (Android) ;
--   • les événements indiquent leur date dans le texte.
--
-- Compatibilité : un téléphone dont l'appli n'a pas encore les nouveaux canaux Android NE DOIT PAS recevoir un
-- identifiant de canal inconnu (la notification serait silencieusement perdue). L'appli annonce donc ses canaux
-- à l'inscription (p_channels_v2) ; les autres appareils restent sur le canal « default ».
--
-- Jamais de donnée personnelle dans le message : titre, texte, image publique d'un établissement, identifiant public.
-- Ce que ce script NE prouve PAS : l'affichage sur un appareil réel.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Colonnes
-- ------------------------------------------------------------------------------
alter table public.push_devices add column if not exists channels_v2 boolean not null default false;
alter table public.push_outbox add column if not exists image_url text;

-- ------------------------------------------------------------------------------
-- 2. Style par type de notification (une seule source de vérité côté serveur)
--    Les identifiants de canal doivent correspondre à ceux créés par l'appli (src/lib/pushLogic.ts) :
--    un test unitaire compare les deux listes.
-- ------------------------------------------------------------------------------
create or replace function public._push_style(p_kind text)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select case p_kind
    when 'event' then jsonb_build_object(
      'channel', 'lpt-events', 'emoji', '🎉', 'subtitle', 'Événements de l''association',
      'priority', 'default', 'level', 'active')
    when 'agenda' then jsonb_build_object(
      'channel', 'lpt-agenda', 'emoji', '📅', 'subtitle', 'Agenda des partenaires',
      'priority', 'default', 'level', 'active')
    when 'new_spot' then jsonb_build_object(
      'channel', 'lpt-new-spots', 'emoji', '✨', 'subtitle', 'Nouveautés du guide',
      'priority', 'default', 'level', 'passive')
    else jsonb_build_object(
      'channel', 'lpt-announcements', 'emoji', '📣', 'subtitle', 'Message du Petit Tou',
      'priority', 'high', 'level', 'active')
  end
$$;

-- Ajoute l'émoji du type, sauf si le titre en commence déjà par un (l'admin peut en choisir un)
create or replace function public._push_decorate_title(p_kind text, p_title text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_title ~ '^[←-⯿\U0001F000-\U0001FAFF]' then p_title
    else (public._push_style(p_kind) ->> 'emoji') || ' ' || p_title
  end
$$;

-- ------------------------------------------------------------------------------
-- 3. Inscription : l'appli annonce qu'elle connaît les canaux par type
-- ------------------------------------------------------------------------------
drop function if exists public.register_push_token(text, text, text, boolean, boolean, boolean);

create or replace function public.register_push_token(
  p_device_id text,
  p_token text,
  p_platform text,
  p_notify_events boolean default true,
  p_notify_agenda boolean default true,
  p_notify_new_spots boolean default false,
  p_channels_v2 boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
begin
  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then
    return jsonb_build_object('success', false, 'error', 'JETON_INVALIDE');
  end if;
  if p_platform not in ('ios', 'android') then
    return jsonb_build_object('success', false, 'error', 'PLATEFORME_INVALIDE');
  end if;

  -- un jeton appartient à un seul appareil (réinstallation, changement d'identifiant)
  delete from public.push_devices where token = p_token and device_id <> v_key;

  insert into public.push_devices (device_id, token, platform, notify_events, notify_agenda, notify_new_spots, channels_v2)
  values (v_key, p_token, p_platform, coalesce(p_notify_events, true), coalesce(p_notify_agenda, true),
          coalesce(p_notify_new_spots, false), coalesce(p_channels_v2, false))
  on conflict (device_id) do update
    set token = excluded.token,
        platform = excluded.platform,
        notify_events = excluded.notify_events,
        notify_agenda = excluded.notify_agenda,
        notify_new_spots = excluded.notify_new_spots,
        channels_v2 = excluded.channels_v2,
        updated_at = now(),
        invalid_at = null;

  return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Mise en file : image publique facultative (https uniquement)
-- ------------------------------------------------------------------------------
drop function if exists public._push_enqueue(text, text, text, text, jsonb);

create or replace function public._push_enqueue(
  p_kind text, p_ref text, p_title text, p_body text, p_data jsonb, p_image text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_outbox (kind, ref_id, title, body, data, image_url)
  values (p_kind, p_ref, left(trim(p_title), 60), left(trim(p_body), 140), coalesce(p_data, '{}'::jsonb),
          -- https uniquement, sans espace, 500 caractères au plus (PostgreSQL limite une répétition à 255 : d'où le length())
          case when length(p_image) <= 500 and p_image ~* '^https://[^[:space:]]+$' then p_image else null end)
  on conflict (kind, ref_id) do nothing;
$$;

-- Événement : date dans le texte, image de l'événement si la colonne existe (lecture tolérante via to_jsonb)
create or replace function public.trg_push_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_title text := coalesce(nullif(trim(new.title), ''), 'Un nouvel événement à Toulouse');
  v_date text := null;
begin
  begin
    begin
      v_date := to_char((v_row ->> 'event_date')::date, 'DD/MM');
    exception when others then
      v_date := null;
    end;
    perform public._push_enqueue('event', new.id::text, 'Nouvel événement',
      case when v_date is not null then v_title || ' — le ' || v_date else v_title end,
      jsonb_build_object('kind', 'event', 'id', new.id::text),
      v_row ->> 'image_url');
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.trg_push_new_spot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.is_new is true then
      perform public._push_enqueue('new_spot', new.id::text, 'Nouvelle adresse',
        coalesce(nullif(trim(new.title), ''), 'Une nouvelle adresse à découvrir'),
        jsonb_build_object('kind', 'new_spot', 'id', new.id::text),
        to_jsonb(new) ->> 'image_url');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

-- Annonce admin : identifiant de référence aléatoire. Celui de 007 était dérivé de l'horloge : deux annonces
-- créées dans la même fraction de temps entraient en collision (clé unique) et la seconde échouait.
create or replace function public.admin_send_push(p_code text, p_title text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_title text := trim(coalesce(p_title, ''));
  v_body text := trim(coalesce(p_body, ''));
  v_recipients integer;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if char_length(v_title) not between 1 and 50 or char_length(v_body) not between 1 and 140 then
    return jsonb_build_object('ok', false, 'error', 'invalid: titre 1-50 caractères, message 1-140 caractères');
  end if;
  insert into public.push_outbox (kind, ref_id, title, body, data)
  values ('announcement', gen_random_uuid()::text, v_title, v_body, '{"kind":"announcement"}'::jsonb);
  select count(*) into v_recipients from public.push_devices where invalid_at is null and notify_events;
  return jsonb_build_object('ok', true, 'recipients', v_recipients);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Envoi : message complet par type (même texte sur Android et iOS)
-- ------------------------------------------------------------------------------
create or replace function public.push_send()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids bigint[];
  v_msgs jsonb;
  v_req bigint;
  v_sent integer := 0;
  i integer;
begin
  for i in 1..10 loop
    select array_agg(id order by id) into v_ids from (
      select d.id from public.push_deliveries d
       where d.status = 'pending' and d.attempts < 3
       order by d.id limit 100 for update skip locked) s;
    exit when v_ids is null;

    select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'to', d.token,
               'title', public._push_decorate_title(o.kind, o.title),
               'body', o.body,
               'data', o.data,
               'sound', 'default',
               'priority', st ->> 'priority',
               'ttl', 86400,
               -- Android : canal par type seulement si l'appli l'a créé ; sinon « default » (sinon message perdu)
               'channelId', case when coalesce(dev.channels_v2, false) then st ->> 'channel' else 'default' end,
               -- iOS : sous-titre, regroupement par type, niveau d'importance
               'subtitle', st ->> 'subtitle',
               'threadId', o.kind,
               'interruptionLevel', st ->> 'level',
               -- Android : image d'un établissement seul (pas pour un regroupement « N nouvelles adresses »)
               'richContent', case when o.image_url is not null and o.data ? 'id'
                                   then jsonb_build_object('image', o.image_url) end
             )) order by d.id)
      into v_msgs
      from public.push_deliveries d
      join public.push_outbox o on o.id = d.outbox_id
      left join public.push_devices dev on dev.device_id = d.device_id
      cross join lateral (select public._push_style(o.kind) as st) s
     where d.id = any(v_ids);

    v_req := net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := v_msgs,
      headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb);

    insert into public.push_requests (request_id, kind, delivery_ids) values (v_req, 'send', v_ids);
    update public.push_deliveries set status = 'queued', request_id = v_req, attempts = attempts + 1
     where id = any(v_ids);
    v_sent := v_sent + array_length(v_ids, 1);
  end loop;
  return v_sent;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. Droits
-- ------------------------------------------------------------------------------
revoke all on function public._push_style(text) from public, anon, authenticated;
revoke all on function public._push_decorate_title(text, text) from public, anon, authenticated;
revoke all on function public._push_enqueue(text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.trg_push_event() from public, anon, authenticated;
revoke all on function public.trg_push_new_spot() from public, anon, authenticated;
revoke all on function public.push_send() from public, anon, authenticated;
revoke all on function public.register_push_token(text, text, text, boolean, boolean, boolean, boolean) from public;
grant execute on function public.register_push_token(text, text, text, boolean, boolean, boolean, boolean) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
