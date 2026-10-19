-- ==============================================================================
-- LE PETIT TOU — AGENDA DES PARTENAIRES : table partner_events
-- (déjà exécuté une fois dans Supabase le 2026-10-19 ; ce fichier le documente.
--  Le relancer est sans danger : tout est "if not exists".)
-- ==============================================================================

create table if not exists public.partner_events (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  title text not null,
  description text,
  start_date date not null,
  start_time text not null default '19:00',
  end_time text,
  repeat_weekly_until date,
  location_override text,
  link_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint partner_events_repeat_check
    check (repeat_weekly_until is null or repeat_weekly_until >= start_date)
);

create index if not exists idx_partner_events_start on public.partner_events (start_date);
create index if not exists idx_partner_events_spot on public.partner_events (spot_id);

alter table public.partner_events enable row level security;

-- Lecture publique des dates actives. Aucune politique d'écriture : toute écriture
-- passe par les fonctions admin_* de 005_admin_secure_writes.sql.
drop policy if exists "Lecture publique agenda partenaires" on public.partner_events;
create policy "Lecture publique agenda partenaires"
  on public.partner_events for select
  to public
  using (is_active = true);
