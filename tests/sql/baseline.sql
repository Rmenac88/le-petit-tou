-- Reproduction de l'état "à risque" décrit dans docs/audit : schéma minimal Supabase + tables du
-- projet avec les protections affaiblies par fix_admin_and_database_schema.sql, 003 et consorts.
-- Utilisé uniquement par tests/sql/security-lockdown.test.mjs (base PGlite jetable, aucune donnée réelle).

create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;

create table auth.users (id uuid primary key default gen_random_uuid());
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

grant usage on schema public, auth, extensions to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant all on all tables in schema auth to anon, authenticated; -- comme Supabase : protégé par ses propres règles

-- Catalogue : RLS DÉSACTIVÉE comme fix_admin_and_database_schema.sql
create table public.addresses (
  id uuid primary key default gen_random_uuid(), title text not null, description text,
  rating numeric, is_recommended boolean default false, points_reward integer default 10,
  likes_count integer not null default 0, category_id text, lat double precision, lng double precision,
  created_at timestamptz not null default now());
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null,
  slug text, color text, icon_name text, created_at timestamptz not null default now());
create table public.events (id uuid primary key default gen_random_uuid(), title text not null,
  event_date date, location text, created_at timestamptz not null default now());
create table public.sponsored_partners (id uuid primary key default gen_random_uuid(), title text not null,
  price_paid numeric default 0, rank_position integer default 1, is_active boolean default true,
  created_at timestamptz not null default now());
grant all on public.addresses, public.categories, public.events, public.sponsored_partners to anon, authenticated;

-- Agenda (004)
create table public.partner_events (
  id uuid primary key default gen_random_uuid(), spot_id text not null, title text not null, description text,
  start_date date not null, start_time text not null default '19:00', end_time text,
  repeat_weekly_until date, location_override text, link_url text, is_active boolean not null default true,
  created_at timestamptz not null default now());
alter table public.partner_events enable row level security;
create policy "Lecture publique agenda partenaires" on public.partner_events for select to public using (is_active = true);

-- Admin (005, avec un code de TEST uniquement)
create table public.admin_users (id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null, role text not null default 'admin', created_at timestamptz not null default now());
alter table public.admin_users enable row level security;
create table public.admin_secrets (key text primary key, value text not null);
alter table public.admin_secrets enable row level security;
revoke all on public.admin_secrets from anon, authenticated;
insert into public.admin_secrets values ('admin_code_sha256', encode(extensions.digest('Code-De-Test-Synthetique-01', 'sha256'), 'hex'));
create function public.verify_admin_access(access_code text) returns boolean language sql security definer
  set search_path = public, extensions as
  $$ select encode(extensions.digest(trim(access_code), 'sha256'), 'hex') = (select value from public.admin_secrets where key='admin_code_sha256') $$;
create function public.admin_save_partner_event(p_code text, p_event jsonb) returns public.partner_events
  language plpgsql security definer as $$ begin raise exception 'old'; end $$;

-- Cartes privilège / découvertes (002, 003, setup_discoveries_schema) avec les politiques "OR auth.uid() IS NULL"
create table public.discount_cards (id uuid primary key default gen_random_uuid(), title text not null,
  max_uses integer not null default 5, is_active boolean not null default true,
  valid_until timestamptz default now() + interval '1 year');
create table public.user_discount_cards (id uuid primary key default gen_random_uuid(), device_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  discount_card_id uuid not null references public.discount_cards(id) on delete cascade,
  uses_count integer not null default 0, assigned_at timestamptz not null default now(), last_used_at timestamptz,
  constraint unique_user_card unique (device_id, discount_card_id));
create table public.discount_card_uses (id uuid primary key default gen_random_uuid(), device_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  discount_card_id uuid not null references public.discount_cards(id) on delete cascade,
  used_at timestamptz not null default now());
create table public.user_place_discoveries (id uuid primary key default gen_random_uuid(), device_id text not null,
  user_id uuid references auth.users(id) on delete set null, place_id text not null,
  points_awarded integer not null default 10, discovery_source text not null default 'manual_checkin',
  created_at timestamptz not null default now(), constraint unique_device_place unique (device_id, place_id));
alter table public.user_place_discoveries enable row level security;
alter table public.user_discount_cards enable row level security;
alter table public.discount_card_uses enable row level security;
create policy "ouvert" on public.user_place_discoveries for select to anon, authenticated
  using ((auth.uid() is not null and user_id = auth.uid()) or auth.uid() is null);
create policy "ouvert-ins" on public.user_place_discoveries for insert to anon, authenticated with check (true);
create policy "ouvert" on public.user_discount_cards for select to anon, authenticated
  using ((auth.uid() is not null and user_id = auth.uid()) or auth.uid() is null);
create policy "ouvert" on public.discount_card_uses for select to anon, authenticated
  using ((auth.uid() is not null and user_id = auth.uid()) or auth.uid() is null);
grant all on public.discount_cards, public.user_discount_cards, public.discount_card_uses,
  public.user_place_discoveries to anon, authenticated;

create table public.spot_likes (spot_id text primary key, likes_count integer not null default 0 check (likes_count >= 0),
  updated_at timestamptz not null default now());
alter table public.spot_likes enable row level security;
create policy "Lecture publique des likes" on public.spot_likes for select to public using (true);
create function public.increment_spot_like(p_spot_id text, p_delta int default 1) returns integer
  language plpgsql security definer as $$ begin return 0; end $$;
grant execute on function public.increment_spot_like(text, int) to anon, authenticated;

create table public.place_suggestions (id uuid primary key default gen_random_uuid(), device_id text not null,
  title text not null, address text, category_name text default 'Bonne adresse', comment text,
  status text not null default 'pending', moderation_notes text, created_at timestamptz not null default now(),
  reviewed_at timestamptz);
alter table public.place_suggestions enable row level security;
create policy "ins" on public.place_suggestions for insert with check (true);
create policy "sel" on public.place_suggestions for select using (true);
grant all on public.place_suggestions to anon, authenticated;

create table public.address_views (id uuid primary key default gen_random_uuid(), spot_id text not null,
  user_id uuid references auth.users(id) on delete set null, source text default 'app',
  viewed_at timestamptz not null default now());
grant all on public.address_views to anon, authenticated; -- RLS désactivée (merchant_system.sql)

create table public.user_push_tokens (id uuid primary key default gen_random_uuid(), user_id uuid, device_id text,
  push_token text, platform text, updated_at timestamptz not null default now());
grant all on public.user_push_tokens to anon, authenticated; -- RLS désactivée (fix_user_push_tokens.sql)
