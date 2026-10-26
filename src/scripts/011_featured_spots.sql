-- ==============================================================================
-- LE PETIT TOU — MIGRATION 011 : « LES CHOUCHOUS DU PETIT TOU »
--
-- À LANCER APRÈS 006 (porte d'accès admin). Atomique (begin/commit) et rejouable.
--
-- Une sélection éditoriale d'adresses, choisie par l'association, affichée tout en bas de l'accueil.
--   • featured_spots : une ligne par adresse choisie (ordre, mention facultative, dates de début/fin d'affichage).
--   • Lecture publique : UNIQUEMENT les lignes actives et dans leur période (RLS) ; aucune écriture directe.
--   • Gestion : fonctions admin_*_featured, protégées par le code admin comme le reste du portail
--     (porte _admin_gate : 10 échecs en 15 minutes => verrouillage).
--
-- Les dates sont des jours calendaires à l'heure de Paris (début inclus, fin incluse).
-- ==============================================================================

begin;

create table if not exists public.featured_spots (
  id uuid primary key default gen_random_uuid(),
  spot_id text not null,
  position integer not null default 100 check (position between 0 and 9999),
  label text check (label is null or char_length(label) between 1 and 40),
  starts_on date,
  ends_on date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint featured_spots_period_ok check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create unique index if not exists featured_spots_spot_key on public.featured_spots (spot_id);
create index if not exists featured_spots_order_idx on public.featured_spots (position, created_at);

alter table public.featured_spots enable row level security;

-- Jour courant à Paris (une seule définition, utilisée par la politique de lecture)
create or replace function public._lpt_today()
returns date
language sql
stable
set search_path = public
as $$ select (now() at time zone 'Europe/Paris')::date $$;
grant execute on function public._lpt_today() to anon, authenticated;

drop policy if exists "Chouchous du Petit Tou en cours" on public.featured_spots;
create policy "Chouchous du Petit Tou en cours" on public.featured_spots
  for select to anon, authenticated
  using (
    is_active
    and (starts_on is null or starts_on <= public._lpt_today())
    and (ends_on is null or ends_on >= public._lpt_today())
  );

revoke all on public.featured_spots from anon, authenticated;
grant select on public.featured_spots to anon, authenticated;

-- ------------------------------------------------------------------------------
-- Lecture complète (admin)
-- ------------------------------------------------------------------------------
create or replace function public.admin_list_featured(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(to_jsonb(f) order by f.position, f.created_at) from public.featured_spots f), '[]'::jsonb));
end;
$$;

-- ------------------------------------------------------------------------------
-- Ajout (sans "id") ou modification (avec "id")
-- ------------------------------------------------------------------------------
create or replace function public.admin_save_featured(p_code text, p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_spot text := trim(coalesce(p_item ->> 'spot_id', ''));
  v_label text := nullif(trim(coalesce(p_item ->> 'label', '')), '');
  v_start_txt text := nullif(trim(coalesce(p_item ->> 'starts_on', '')), '');
  v_end_txt text := nullif(trim(coalesce(p_item ->> 'ends_on', '')), '');
  v_pos_txt text := nullif(trim(coalesce(p_item ->> 'position', '')), '');
  v_start date;
  v_end date;
  v_pos integer;
  v_active boolean;
  v_row public.featured_spots;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid: enregistrement attendu');
  end if;

  -- identifiant et booléen : validés avant toute conversion (jamais d'exception brute vers l'appli)
  if nullif(trim(coalesce(p_item ->> 'id', '')), '') is not null then
    if (p_item ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid: identifiant illisible');
    end if;
    v_id := (p_item ->> 'id')::uuid;
  end if;
  if p_item ? 'is_active' and (p_item ->> 'is_active') not in ('true', 'false') then
    return jsonb_build_object('ok', false, 'error', 'invalid: actif doit valoir vrai ou faux');
  end if;
  v_active := coalesce((p_item ->> 'is_active')::boolean, true);

  if v_spot = '' then
    return jsonb_build_object('ok', false, 'error', 'invalid: choisis une adresse');
  end if;
  if not exists (select 1 from public.addresses where id::text = v_spot) then
    return jsonb_build_object('ok', false, 'error', 'invalid: cette adresse n''existe pas');
  end if;
  if v_label is not null and char_length(v_label) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid: la mention fait 40 caractères au plus');
  end if;

  if v_pos_txt is null then
    v_pos := null;
  elsif v_pos_txt !~ '^\d{1,4}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid: l''ordre est un nombre entre 0 et 9999');
  else
    v_pos := v_pos_txt::integer;
  end if;

  if (v_start_txt is not null and v_start_txt !~ '^\d{4}-\d{2}-\d{2}$')
     or (v_end_txt is not null and v_end_txt !~ '^\d{4}-\d{2}-\d{2}$') then
    return jsonb_build_object('ok', false, 'error', 'invalid: les dates s''écrivent AAAA-MM-JJ');
  end if;
  begin
    v_start := v_start_txt::date;
    v_end := v_end_txt::date;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'invalid: cette date n''existe pas dans le calendrier');
  end;
  if v_start is not null and v_end is not null and v_end < v_start then
    return jsonb_build_object('ok', false, 'error', 'invalid: la fin doit être après le début');
  end if;

  if v_id is null then
    if exists (select 1 from public.featured_spots where spot_id = v_spot) then
      return jsonb_build_object('ok', false, 'error', 'invalid: cette adresse est déjà dans les chouchous du Petit Tou');
    end if;
    insert into public.featured_spots (spot_id, position, label, starts_on, ends_on, is_active)
    values (v_spot,
            coalesce(v_pos, (select coalesce(max(position), 0) + 10 from public.featured_spots)),
            v_label, v_start, v_end, v_active)
    returning * into v_row;
  else
    if exists (select 1 from public.featured_spots where spot_id = v_spot and id <> v_id) then
      return jsonb_build_object('ok', false, 'error', 'invalid: cette adresse est déjà dans les chouchous du Petit Tou');
    end if;
    update public.featured_spots
       set spot_id = v_spot,
           position = coalesce(v_pos, position),
           label = v_label,
           starts_on = v_start,
           ends_on = v_end,
           is_active = v_active,
           updated_at = now()
     where id = v_id
     returning * into v_row;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid: cet élément n''existe plus');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'row', to_jsonb(v_row));
end;
$$;

-- ------------------------------------------------------------------------------
-- Retrait
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_featured(p_code text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_id is null or p_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid: identifiant illisible');
  end if;
  delete from public.featured_spots where id = p_id::uuid;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

revoke all on function public.admin_list_featured(text) from public;
revoke all on function public.admin_save_featured(text, jsonb) from public;
revoke all on function public.admin_delete_featured(text, text) from public;
grant execute on function public.admin_list_featured(text) to anon, authenticated;
grant execute on function public.admin_save_featured(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_featured(text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
