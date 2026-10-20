-- ==============================================================================
-- LE PETIT TOU — NOTIFICATIONS : jetons push enregistrés par fonctions sécurisées
--
-- À lancer dans Supabase -> SQL Editor -> New query -> Run.
-- Résultat attendu : "Success. No rows returned". Aucun secret à remplacer.
-- Relancer ce script est sans danger.
--
-- Effet : la table user_push_tokens n'est plus lisible ni modifiable depuis l'appli
-- (jusqu'ici RLS désactivée + tous droits à anon : n'importe qui pouvait lire les jetons
-- de tout le monde). L'appli passe désormais par register_push_token / unregister_push_token.
-- L'envoi de notifications se fait avec la clé service_role (scripts/send_push_notification.py).
-- ==============================================================================

begin;

create table if not exists public.user_push_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid,
  device_id text,
  push_token text,
  platform text,
  notify_events boolean default true,
  notify_spots boolean default false,
  updated_at timestamptz default now() not null
);

-- Un seul jeton par appareil : on garde la ligne la plus récente, puis on l'impose.
delete from public.user_push_tokens a
using public.user_push_tokens b
where a.device_id is not null
  and a.device_id = b.device_id
  and (a.updated_at, a.id) < (b.updated_at, b.id);

delete from public.user_push_tokens where device_id is null or push_token is null;

create unique index if not exists user_push_tokens_device_id_key
  on public.user_push_tokens (device_id);

alter table public.user_push_tokens enable row level security;
drop policy if exists "user_push_tokens_all" on public.user_push_tokens;
revoke all on public.user_push_tokens from anon, authenticated;

-- Anciennes versions éventuelles (types de retour différents) : on les remplace.
drop function if exists public.register_push_token(text, text, text, boolean, boolean);
drop function if exists public.unregister_push_token(text);

create or replace function public.register_push_token(
  p_device_id text,
  p_token text,
  p_platform text,
  p_notify_events boolean,
  p_notify_spots boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_device_id is null or length(p_device_id) < 8 or length(p_device_id) > 128 then
    raise exception 'invalid device id';
  end if;
  if p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception 'invalid push token';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'invalid platform';
  end if;

  insert into public.user_push_tokens
    (user_id, device_id, push_token, platform, notify_events, notify_spots, updated_at)
  values
    (auth.uid(), p_device_id, p_token, p_platform,
     coalesce(p_notify_events, true), coalesce(p_notify_spots, false), now())
  on conflict (device_id) do update set
    user_id = excluded.user_id,
    push_token = excluded.push_token,
    platform = excluded.platform,
    notify_events = excluded.notify_events,
    notify_spots = excluded.notify_spots,
    updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_device_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.user_push_tokens where device_id = p_device_id;
$$;

revoke all on function public.register_push_token(text, text, text, boolean, boolean) from public;
revoke all on function public.unregister_push_token(text) from public;
grant execute on function public.register_push_token(text, text, text, boolean, boolean) to anon, authenticated;
grant execute on function public.unregister_push_token(text) to anon, authenticated;

commit;
