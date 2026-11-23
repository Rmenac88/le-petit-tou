-- ==============================================================================
-- LE PETIT TOU — MIGRATION 023 : LIKES RETROUVÉS, LIMITES ANTI-ABUS, JOURNAL ADMIN
--
-- À LANCER APRÈS 006 (et 007). Atomique (begin/commit) et rejouable. Aucune donnée supprimée, aucune protection retirée.
--
-- 1. get_my_likes : l'appli relit ses likes depuis le serveur (avant : gardés seulement sur le téléphone ; perdus avec
--    le stockage local, et impossibles à retirer ensuite).
-- 2. Limites par identité : 100 nouveaux likes par jour, 5 suggestions d'adresse par jour. Un script qui invente des
--    identités n'est pas arrêté, mais une identité ne peut plus inonder la base à elle seule.
-- 3. Portail admin :
--    • verrouillage PAR SOURCE (adresse IP transmise par l'hébergeur) : 10 échecs en 15 min bloquent cette source ;
--      une limite globale de 100 échecs en 15 min reste là contre les essais répartis. Avant, 10 faux codes envoyés par
--      n'importe qui bloquaient tout le portail, y compris le bon code ;
--    • journal des accès admin réussis (fonction appelée, source, date), gardé 12 mois, jamais lisible par la clé
--      publique. Il dit QUI a utilisé le portail et QUAND (lecture dans Supabase → Table editor → admin_audit_log).
--    Limite connue : l'en-tête d'adresse IP peut être falsifié par un script ; la limite globale reste alors la seule
--    barrière (100 essais par quart d'heure : un code de 16 caractères aléatoires reste impossible à deviner).
-- ==============================================================================

begin;

do $$
begin
  if to_regprocedure('public._lpt_identity(text)') is null or to_regprocedure('public._admin_gate(text)') is null then
    raise exception 'Lance d''abord 006_security_lockdown.sql.';
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 1. Relire ses likes
-- ------------------------------------------------------------------------------
create or replace function public.get_my_likes(p_device_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_key text := public._lpt_identity(p_device_id);
begin
  if v_key is null then
    return jsonb_build_object('ok', false, 'error', 'IDENTITE_INVALIDE');
  end if;
  return jsonb_build_object('ok', true, 'spot_ids', coalesce(
    (select jsonb_agg(l.spot_id order by l.created_at desc)
       from (select spot_id, created_at from public.spot_user_likes
              where device_id = v_key order by created_at desc limit 2000) l), '[]'::jsonb));
end;
$$;
revoke all on function public.get_my_likes(text) from public;
grant execute on function public.get_my_likes(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2a. Like : même règle qu'avant (un like par identité et par adresse) + 100 nouveaux likes par jour et par identité
-- ------------------------------------------------------------------------------
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
    if (select count(*) from public.spot_user_likes
         where device_id = v_key and created_at > now() - interval '1 day') >= 100 then
      return coalesce((select likes_count from public.spot_likes where spot_id = v_spot), 0);
    end if;
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
revoke all on function public.increment_spot_like(text, integer, text) from public;
grant execute on function public.increment_spot_like(text, integer, text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2b. Suggestions : 5 par jour et par identité
-- ------------------------------------------------------------------------------
create or replace function public._limit_place_suggestions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.place_suggestions
       where device_id = new.device_id and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Limite atteinte : 5 suggestions par jour.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public._limit_place_suggestions() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.place_suggestions') is not null then
    drop trigger if exists limit_place_suggestions on public.place_suggestions;
    create trigger limit_place_suggestions before insert on public.place_suggestions
      for each row execute function public._limit_place_suggestions();
  end if;
end
$$;

-- ------------------------------------------------------------------------------
-- 3. Portail admin : verrouillage par source et journal
-- ------------------------------------------------------------------------------
alter table public.admin_login_attempts add column if not exists source text;

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  action text not null,
  source text not null
);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

-- Source de la requête : adresse IP transmise par l'hébergeur ; « inconnu » hors API (SQL Editor, tests)
create or replace function public._request_source()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_headers json;
  v text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  v := coalesce(nullif(trim(v_headers ->> 'cf-connecting-ip'), ''),
                nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''));
  return left(coalesce(v, 'inconnu'), 64);
end;
$$;
revoke all on function public._request_source() from public, anon, authenticated;

create or replace function public._admin_gate(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_ok boolean := false;
  v_source text := public._request_source();
  v_action text;
begin
  delete from public.admin_login_attempts where attempted_at < now() - interval '1 day';

  -- 10 échecs de la même source, ou 100 échecs au total, en 15 minutes : refus (même avec le bon code)
  if (select count(*) from public.admin_login_attempts
        where attempted_at > now() - interval '15 minutes' and coalesce(source, 'inconnu') = v_source) >= 10
     or (select count(*) from public.admin_login_attempts
        where attempted_at > now() - interval '15 minutes') >= 100 then
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
    insert into public.admin_login_attempts (source) values (v_source);
    return false;
  end if;

  v_action := left(coalesce(nullif(current_setting('request.path', true), ''), 'sql'), 120);
  insert into public.admin_audit_log (action, source) values (v_action, v_source);
  delete from public.admin_audit_log where at < now() - interval '12 months';
  return true;
end;
$$;
revoke all on function public._admin_gate(text) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
