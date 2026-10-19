-- ==============================================================================
-- LE PETIT TOU — MIGRATION 007 : NOTIFICATIONS PUSH (iOS + Android via Expo Push)
--
-- À LANCER APRÈS 006_security_lockdown.sql. Colle tout dans Supabase -> SQL Editor -> Run.
-- Atomique (begin/commit) et rejouable.
--
-- Chaîne complète :
--   événement métier (INSERT dans events / partner_events / addresses, ou annonce admin)
--   -> trigger (jamais bloquant) -> push_outbox (anti-doublon par type + référence)
--   -> push_fanout : destinataires selon préférences, plafond 2 pushs / 24 h / appareil,
--                    heures calmes 21h-8h (Paris), nouvelles adresses regroupées en un seul message
--   -> push_send : lots de 100 vers l'API Expo (pg_net)
--   -> push_collect : lecture des tickets ; DeviceNotRegistered => jeton invalidé ; erreur
--                     temporaire => nouvelle tentative (3 maximum)
--   -> push_receipts : reçus Expo après 15 min (preuve que le fournisseur APNs/FCM a accepté)
--   -> purge : journaux 30 jours ; données d'appareils inactifs 24 mois ; consultations 13 mois
--
-- Ce que ce script NE prouve PAS : l'affichage sur un appareil réel. Un reçu « ok » signifie
-- que Apple/Google a accepté le message, pas que l'utilisateur l'a vu.
--
-- Prérequis dans Supabase (Database -> Extensions) : pg_net et pg_cron activées.
-- ==============================================================================

begin;

do $$
begin
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net non activée (%). Active-la dans Database > Extensions puis relance ce script.', sqlerrm;
  end;
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron non activée (%). Active-la dans Database > Extensions puis relance ce script.', sqlerrm;
  end;
end
$$;

-- ------------------------------------------------------------------------------
-- 1. Tables (aucun accès direct depuis l'appli : tout passe par des fonctions)
-- ------------------------------------------------------------------------------
create table if not exists public.push_devices (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  notify_events boolean not null default true,
  notify_agenda boolean not null default true,
  notify_new_spots boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invalid_at timestamptz
);

create table if not exists public.push_outbox (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('event', 'agenda', 'new_spot', 'announcement')),
  ref_id text not null,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'fanned_out', 'skipped')),
  created_at timestamptz not null default now(),
  unique (kind, ref_id)
);

create table if not exists public.push_deliveries (
  id bigint generated always as identity primary key,
  outbox_id bigint not null references public.push_outbox(id) on delete cascade,
  device_id text not null,
  token text not null,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'failed', 'invalid_token', 'receipt_ok', 'receipt_error')),
  attempts integer not null default 0,
  ticket_id text,
  error text,
  request_id bigint,
  receipt_request_id bigint,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  receipt_checked_at timestamptz,
  unique (outbox_id, device_id)
);
create index if not exists idx_push_deliveries_status on public.push_deliveries (status);
create index if not exists idx_push_deliveries_device on public.push_deliveries (device_id, created_at);

create table if not exists public.push_requests (
  request_id bigint primary key,
  kind text not null check (kind in ('send', 'receipts')),
  delivery_ids bigint[] not null,
  created_at timestamptz not null default now(),
  collected_at timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['push_devices', 'push_outbox', 'push_deliveries', 'push_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- ------------------------------------------------------------------------------
-- 2. Enregistrement des appareils (appelé par l'appli)
-- ------------------------------------------------------------------------------
create or replace function public.register_push_token(
  p_device_id text,
  p_token text,
  p_platform text,
  p_notify_events boolean default true,
  p_notify_agenda boolean default true,
  p_notify_new_spots boolean default false
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

  insert into public.push_devices (device_id, token, platform, notify_events, notify_agenda, notify_new_spots)
  values (v_key, p_token, p_platform, coalesce(p_notify_events, true), coalesce(p_notify_agenda, true),
          coalesce(p_notify_new_spots, false))
  on conflict (device_id) do update
    set token = excluded.token,
        platform = excluded.platform,
        notify_events = excluded.notify_events,
        notify_agenda = excluded.notify_agenda,
        notify_new_spots = excluded.notify_new_spots,
        updated_at = now(),
        invalid_at = null;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.update_push_preferences(
  p_device_id text,
  p_notify_events boolean,
  p_notify_agenda boolean,
  p_notify_new_spots boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_count integer;
begin
  if v_key is null then
    return jsonb_build_object('success', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  update public.push_devices
     set notify_events = coalesce(p_notify_events, notify_events),
         notify_agenda = coalesce(p_notify_agenda, notify_agenda),
         notify_new_spots = coalesce(p_notify_new_spots, notify_new_spots),
         updated_at = now()
   where device_id = v_key;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    return jsonb_build_object('success', false, 'error', 'NON_ENREGISTRE');
  end if;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.get_push_preferences(p_device_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
  v_row public.push_devices;
begin
  if v_key is null then
    return jsonb_build_object('registered', false);
  end if;
  select * into v_row from public.push_devices where device_id = v_key and invalid_at is null;
  if not found then
    return jsonb_build_object('registered', false);
  end if;
  return jsonb_build_object('registered', true, 'notify_events', v_row.notify_events,
    'notify_agenda', v_row.notify_agenda, 'notify_new_spots', v_row.notify_new_spots);
end;
$$;

create or replace function public.unregister_push_token(p_device_id text default null)
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
  delete from public.push_devices where device_id = v_key;
  return jsonb_build_object('success', true);
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Détection des événements métier (triggers JAMAIS bloquants : une erreur ici
--    ne doit pas empêcher d'ajouter une adresse ou un événement)
-- ------------------------------------------------------------------------------
create or replace function public._push_enqueue(
  p_kind text, p_ref text, p_title text, p_body text, p_data jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.push_outbox (kind, ref_id, title, body, data)
  values (p_kind, p_ref, left(trim(p_title), 60), left(trim(p_body), 140), coalesce(p_data, '{}'::jsonb))
  on conflict (kind, ref_id) do nothing;
$$;

create or replace function public.trg_push_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public._push_enqueue('event', new.id::text, 'Nouvel événement',
      coalesce(nullif(trim(new.title), ''), 'Un nouvel événement à Toulouse'),
      jsonb_build_object('kind', 'event', 'id', new.id::text));
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.trg_push_agenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.is_active then
      perform public._push_enqueue('agenda', new.id::text, 'À l''agenda',
        trim(new.title) || ' — ' || to_char(new.start_date, 'DD/MM'),
        jsonb_build_object('kind', 'agenda', 'id', new.id::text, 'spot_id', new.spot_id));
    end if;
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
        jsonb_build_object('kind', 'new_spot', 'id', new.id::text));
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.events') is not null then
    drop trigger if exists push_on_event on public.events;
    create trigger push_on_event after insert on public.events
      for each row execute function public.trg_push_event();
  end if;
  if to_regclass('public.partner_events') is not null then
    drop trigger if exists push_on_agenda on public.partner_events;
    create trigger push_on_agenda after insert on public.partner_events
      for each row execute function public.trg_push_agenda();
  end if;
  if to_regclass('public.addresses') is not null then
    drop trigger if exists push_on_new_spot on public.addresses;
    create trigger push_on_new_spot after insert on public.addresses
      for each row execute function public.trg_push_new_spot();
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 4. Distribution : destinataires, plafond, heures calmes
-- ------------------------------------------------------------------------------
create or replace function public.push_fanout(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c_cap constant integer := 2;                              -- pushs max par appareil et par 24 h
  c_delay constant interval := interval '2 minutes';        -- délai de regroupement des nouveautés
  c_stale constant interval := interval '24 hours';         -- au-delà, une annonce est périmée
  v_hour integer := extract(hour from (p_now at time zone 'Europe/Paris'));
  v_n integer;
  v_first bigint;
  v_total integer := 0;
  v_added integer;
  o record;
begin
  -- annonces périmées : jamais envoyées en retard
  update public.push_outbox set status = 'skipped'
   where status = 'pending' and created_at < p_now - c_stale;

  -- heures calmes (21h-8h Paris) : on garde en attente jusqu'au matin
  if v_hour < 8 or v_hour >= 21 then
    return 0;
  end if;

  -- plusieurs nouvelles adresses => un seul message
  select count(*), min(id) into v_n, v_first
    from public.push_outbox
   where kind = 'new_spot' and status = 'pending' and created_at <= p_now - c_delay;
  if v_n > 1 then
    update public.push_outbox
       set title = v_n || ' nouvelles adresses',
           body = 'Découvre les nouveautés du moment à Toulouse',
           data = '{"kind":"new_spot"}'::jsonb
     where id = v_first;
    update public.push_outbox set status = 'skipped'
     where kind = 'new_spot' and status = 'pending' and created_at <= p_now - c_delay and id <> v_first;
  end if;

  for o in
    select * from public.push_outbox
     where status = 'pending' and (kind = 'announcement' or created_at <= p_now - c_delay)
     order by id
  loop
    insert into public.push_deliveries (outbox_id, device_id, token)
    select o.id, d.device_id, d.token
      from public.push_devices d
     where d.invalid_at is null
       and case o.kind
             when 'event' then d.notify_events
             when 'agenda' then d.notify_agenda
             when 'new_spot' then d.notify_new_spots
             else d.notify_events
           end
       and (o.kind = 'announcement'
            or (select count(*) from public.push_deliveries x
                 where x.device_id = d.device_id
                   and x.status in ('pending', 'queued', 'sent', 'receipt_ok')
                   and x.created_at > p_now - interval '24 hours') < c_cap)
    on conflict (outbox_id, device_id) do nothing;
    get diagnostics v_added = row_count;
    v_total := v_total + v_added;
    update public.push_outbox set status = 'fanned_out' where id = o.id;
  end loop;
  return v_total;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Envoi vers l'API Expo (lots de 100, 1000 messages max par passage)
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

    select jsonb_agg(jsonb_build_object(
             'to', d.token, 'title', o.title, 'body', o.body, 'data', o.data,
             'sound', 'default', 'channelId', 'default', 'ttl', 86400) order by d.id)
      into v_msgs
      from public.push_deliveries d join public.push_outbox o on o.id = d.outbox_id
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
-- 6. Lecture des tickets (acceptation par Expo) et des reçus (acceptation par APNs/FCM)
-- ------------------------------------------------------------------------------
create or replace function public._push_retry(p_ids bigint[], p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_deliveries
     set status = case when attempts >= 3 then 'failed' else 'pending' end,
         error = left(p_error, 200)
   where id = any(p_ids) and status = 'queued';
$$;

create or replace function public.push_collect(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  resp record;
  v_json jsonb;
  v_ticket jsonb;
  v_err text;
  v_did bigint;
  v_idx integer;
  v_done integer := 0;
  v_receipt jsonb;
  v_tid text;
  v_row public.push_deliveries;
begin
  for r in select * from public.push_requests where collected_at is null order by created_at loop
    select * into resp from net._http_response where id = r.request_id;

    if not found then
      if r.created_at < p_now - interval '10 minutes' then
        if r.kind = 'send' then
          perform public._push_retry(r.delivery_ids, 'pas de réponse du fournisseur');
        else
          update public.push_deliveries set receipt_request_id = null where id = any(r.delivery_ids);
        end if;
        update public.push_requests set collected_at = p_now where request_id = r.request_id;
        v_done := v_done + 1;
      end if;
      continue;
    end if;

    begin
      v_json := resp.content::jsonb;
    exception when others then
      v_json := null;
    end;

    if resp.status_code is distinct from 200 or v_json is null or v_json -> 'data' is null then
      if r.kind = 'send' then
        perform public._push_retry(r.delivery_ids, 'HTTP ' || coalesce(resp.status_code::text, '?'));
      else
        update public.push_deliveries set receipt_request_id = null where id = any(r.delivery_ids);
      end if;
      update public.push_requests set collected_at = p_now where request_id = r.request_id;
      v_done := v_done + 1;
      continue;
    end if;

    if r.kind = 'send' then
      v_idx := 0;
      foreach v_did in array r.delivery_ids loop
        v_ticket := v_json -> 'data' -> v_idx;
        v_idx := v_idx + 1;
        if v_ticket is null then
          perform public._push_retry(array[v_did], 'ticket manquant');
        elsif v_ticket ->> 'status' = 'ok' then
          update public.push_deliveries
             set status = 'sent', ticket_id = v_ticket ->> 'id', sent_at = p_now, error = null
           where id = v_did and status = 'queued';
        else
          v_err := coalesce(v_ticket -> 'details' ->> 'error', v_ticket ->> 'message', 'erreur inconnue');
          if v_err = 'DeviceNotRegistered' then
            update public.push_deliveries set status = 'invalid_token', error = v_err where id = v_did;
            update public.push_devices set invalid_at = p_now
             where token = (select token from public.push_deliveries where id = v_did);
          elsif v_err = 'MessageRateExceeded' then
            perform public._push_retry(array[v_did], v_err);
          else
            update public.push_deliveries set status = 'failed', error = left(v_err, 200) where id = v_did;
          end if;
        end if;
      end loop;
    else
      for v_row in select * from public.push_deliveries where id = any(r.delivery_ids) loop
        v_receipt := v_json -> 'data' -> v_row.ticket_id;
        if v_receipt is null then
          -- reçu pas encore prêt : on réessaiera, puis on abandonne après 24 h
          if v_row.sent_at < p_now - interval '24 hours' then
            update public.push_deliveries set receipt_checked_at = p_now, receipt_request_id = null where id = v_row.id;
          else
            update public.push_deliveries set receipt_request_id = null where id = v_row.id;
          end if;
        elsif v_receipt ->> 'status' = 'ok' then
          update public.push_deliveries set status = 'receipt_ok', receipt_checked_at = p_now where id = v_row.id;
        else
          v_err := coalesce(v_receipt -> 'details' ->> 'error', v_receipt ->> 'message', 'erreur inconnue');
          update public.push_deliveries
             set status = 'receipt_error', error = left(v_err, 200), receipt_checked_at = p_now
           where id = v_row.id;
          if v_err = 'DeviceNotRegistered' then
            update public.push_devices set invalid_at = p_now where token = v_row.token;
          end if;
        end if;
      end loop;
    end if;

    update public.push_requests set collected_at = p_now where request_id = r.request_id;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;

create or replace function public.push_receipts(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids bigint[];
  v_tickets jsonb;
  v_req bigint;
begin
  select array_agg(id order by id) into v_ids from (
    select id from public.push_deliveries
     where status = 'sent' and ticket_id is not null and receipt_request_id is null
       and receipt_checked_at is null and sent_at < p_now - interval '15 minutes'
     order by id limit 1000 for update skip locked) s;
  if v_ids is null then
    return 0;
  end if;

  select jsonb_agg(ticket_id order by id) into v_tickets from public.push_deliveries where id = any(v_ids);
  v_req := net.http_post(
    url := 'https://exp.host/--/api/v2/push/getReceipts',
    body := jsonb_build_object('ids', v_tickets),
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb);
  insert into public.push_requests (request_id, kind, delivery_ids) values (v_req, 'receipts', v_ids);
  update public.push_deliveries set receipt_request_id = v_req where id = any(v_ids);
  return array_length(v_ids, 1);
end;
$$;

create or replace function public.push_tick(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fanout integer;
  v_sent integer;
  v_collected integer;
  v_receipts integer;
begin
  v_collected := public.push_collect(p_now);
  v_fanout := public.push_fanout(p_now);
  v_sent := public.push_send();
  v_receipts := public.push_receipts(p_now);
  return jsonb_build_object('collected', v_collected, 'fanout', v_fanout, 'sent', v_sent, 'receipts', v_receipts);
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. Administration : annonce manuelle et statistiques (code admin vérifié côté serveur)
-- ------------------------------------------------------------------------------
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
  values ('announcement', extract(epoch from clock_timestamp())::text, v_title, v_body, '{"kind":"announcement"}'::jsonb);
  select count(*) into v_recipients from public.push_devices where invalid_at is null and notify_events;
  return jsonb_build_object('ok', true, 'recipients', v_recipients);
end;
$$;

create or replace function public.admin_push_stats(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object(
    'ok', true,
    'devices', (select count(*) from public.push_devices where invalid_at is null),
    'ios', (select count(*) from public.push_devices where invalid_at is null and platform = 'ios'),
    'android', (select count(*) from public.push_devices where invalid_at is null and platform = 'android'),
    'pending_messages', (select count(*) from public.push_outbox where status = 'pending'),
    'deliveries_7d', coalesce((select jsonb_object_agg(status, n) from (
        select status, count(*) n from public.push_deliveries
         where created_at > now() - interval '7 days' group by status) s), '{}'::jsonb)
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. Effacement des données : inclut désormais les jetons push
-- ------------------------------------------------------------------------------
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
    delete from public.spot_user_likes where device_id = v_key;
    get diagnostics v_n_likes = row_count;
  end if;
  if to_regclass('public.user_push_tokens') is not null then
    delete from public.user_push_tokens where device_id = v_key or user_id = auth.uid();
  end if;
  delete from public.push_deliveries where device_id = v_key;
  delete from public.push_devices where device_id = v_key;

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
-- 9. Conservation : purge des journaux et des données d'appareils inactifs
--    (durées à valider : voir docs/audit/01-RAPPORT, D-04)
-- ------------------------------------------------------------------------------
create or replace function public.purge_old_data(p_now timestamptz default now())
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deliveries integer;
  v_outbox integer;
  v_requests integer;
  v_devices integer;
  v_views integer := 0;
  v_inactive integer := 0;
  v_ids text[];
begin
  delete from public.push_deliveries where created_at < p_now - interval '30 days';
  get diagnostics v_deliveries = row_count;
  delete from public.push_outbox where created_at < p_now - interval '30 days';
  get diagnostics v_outbox = row_count;
  delete from public.push_requests where created_at < p_now - interval '7 days';
  get diagnostics v_requests = row_count;
  delete from public.push_devices
   where (invalid_at is not null and invalid_at < p_now - interval '30 days')
      or updated_at < p_now - interval '270 days';
  get diagnostics v_devices = row_count;

  if to_regclass('public.address_views') is not null then
    delete from public.address_views where viewed_at < p_now - interval '13 months';
    get diagnostics v_views = row_count;
  end if;

  -- appareils sans aucune activité depuis 24 mois : leurs données sont effacées
  select array_agg(device_id) into v_ids from (
    select device_id, max(ts) last_seen from (
      select device_id, created_at ts from public.user_place_discoveries
      union all select device_id, used_at from public.discount_card_uses
      union all select device_id, last_used_at from public.user_discount_cards where last_used_at is not null
      union all select device_id, created_at from public.spot_user_likes
    ) a group by device_id) b
   where last_seen < p_now - interval '24 months';
  if v_ids is not null then
    delete from public.discount_card_uses where device_id = any(v_ids);
    delete from public.user_discount_cards where device_id = any(v_ids);
    delete from public.user_place_discoveries where device_id = any(v_ids);
    delete from public.spot_user_likes where device_id = any(v_ids);
    v_inactive := array_length(v_ids, 1);
  end if;

  return jsonb_build_object('push_deliveries', v_deliveries, 'push_outbox', v_outbox, 'push_requests', v_requests,
    'push_devices', v_devices, 'address_views', v_views, 'inactive_devices', v_inactive);
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. Droits : les fonctions internes ne sont appelables que par le planificateur
-- ------------------------------------------------------------------------------
revoke all on function public._push_enqueue(text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public._push_retry(bigint[], text) from public, anon, authenticated;
revoke all on function public.trg_push_event() from public, anon, authenticated;
revoke all on function public.trg_push_agenda() from public, anon, authenticated;
revoke all on function public.trg_push_new_spot() from public, anon, authenticated;
revoke all on function public.push_fanout(timestamptz) from public, anon, authenticated;
revoke all on function public.push_send() from public, anon, authenticated;
revoke all on function public.push_collect(timestamptz) from public, anon, authenticated;
revoke all on function public.push_receipts(timestamptz) from public, anon, authenticated;
revoke all on function public.push_tick(timestamptz) from public, anon, authenticated;
revoke all on function public.purge_old_data(timestamptz) from public, anon, authenticated;

revoke all on function public.register_push_token(text, text, text, boolean, boolean, boolean) from public;
revoke all on function public.update_push_preferences(text, boolean, boolean, boolean) from public;
revoke all on function public.get_push_preferences(text) from public;
revoke all on function public.unregister_push_token(text) from public;
revoke all on function public.admin_send_push(text, text, text) from public;
revoke all on function public.admin_push_stats(text) from public;
revoke all on function public.delete_my_data(text) from public;
grant execute on function public.register_push_token(text, text, text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.update_push_preferences(text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.get_push_preferences(text) to anon, authenticated;
grant execute on function public.unregister_push_token(text) to anon, authenticated;
grant execute on function public.admin_send_push(text, text, text) to anon, authenticated;
grant execute on function public.admin_push_stats(text) to anon, authenticated;
grant execute on function public.delete_my_data(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 11. Planification (si pg_cron est active) : envoi chaque minute, purge chaque nuit
-- ------------------------------------------------------------------------------
do $$
begin
  if to_regnamespace('cron') is null then
    raise notice 'pg_cron absente : les notifications ne partiront pas tant qu''elle n''est pas activée (Database > Extensions), puis relance ce script.';
    return;
  end if;
  perform cron.unschedule(jobid) from cron.job where jobname in ('lpt-push-tick', 'lpt-purge');
  perform cron.schedule('lpt-push-tick', '* * * * *', 'select public.push_tick()');
  perform cron.schedule('lpt-purge', '15 3 * * *', 'select public.purge_old_data()');
exception when others then
  raise notice 'Planification impossible (%). Crée les tâches à la main : select cron.schedule(''lpt-push-tick'', ''* * * * *'', ''select public.push_tick()'');', sqlerrm;
end
$$;

commit;

notify pgrst, 'reload schema';
