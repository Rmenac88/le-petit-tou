-- ==============================================================================
-- LE PETIT TOU — MIGRATION 013 : OFFRES ET RÉDUCTIONS (onglet « - % »)
--
-- À LANCER APRÈS 006 (porte d'accès admin). Atomique (begin/commit) et rejouable.
--
-- Les offres sont les « cartes de réduction » existantes (table discount_cards, déjà utilisée par use_discount_card
-- pour compter les utilisations par téléphone). Ce script ajoute :
--   • l'ordre d'affichage (sort_order) et, si besoin, les colonnes que l'appli lit ;
--   • la lecture publique limitée aux offres ACTIVES et NON EXPIRÉES ;
--   • la gestion depuis le portail admin (admin_list_offers / admin_save_offer / admin_delete_offer), protégée par le
--     code admin comme le reste du portail (porte _admin_gate : 10 échecs en 15 minutes => verrouillage).
--
-- Aucune écriture directe n'est possible depuis l'appli. La date de fin est un jour calendaire (heure de Paris),
-- inclus : « jusqu'au 31/12 » reste valable toute la journée du 31.
--
-- Les cinq cartes d'exemple de la migration 002 (identifiants a111…, a222…, …) sont des données de démonstration :
-- l'appli ne les affiche pas ; on peut les désactiver ou les supprimer depuis le portail.
-- ==============================================================================

begin;

-- Colonnes lues par l'appli (no-op si elles existent déjà, comme en production)
alter table public.discount_cards add column if not exists partner_id text;
alter table public.discount_cards add column if not exists subtitle text;
alter table public.discount_cards add column if not exists category text not null default 'food';
alter table public.discount_cards add column if not exists discount_value text not null default '';
alter table public.discount_cards add column if not exists badge_label text default 'MEMBRE PETIT TOU';
alter table public.discount_cards add column if not exists description text;
alter table public.discount_cards add column if not exists terms text;
alter table public.discount_cards add column if not exists card_color_primary text default '#C93049';
alter table public.discount_cards add column if not exists card_color_secondary text default '#8E1F37';
alter table public.discount_cards add column if not exists visual_url text;
alter table public.discount_cards add column if not exists created_at timestamptz not null default now();
alter table public.discount_cards add column if not exists sort_order integer not null default 0;

-- Lecture publique : offres actives et non expirées uniquement
alter table public.discount_cards enable row level security;
drop policy if exists "Lecture publique" on public.discount_cards;
create policy "Lecture publique" on public.discount_cards
  for select to anon, authenticated
  using (is_active = true and (valid_until is null or valid_until > now()));
revoke insert, update, delete, truncate on public.discount_cards from anon, authenticated;
grant select on public.discount_cards to anon, authenticated;

-- ------------------------------------------------------------------------------
-- Lecture complète (admin) : toutes les offres, avec le nombre total d'utilisations
-- ------------------------------------------------------------------------------
create or replace function public.admin_list_offers(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object('ok', true, 'offers', coalesce((
    select jsonb_agg(
             to_jsonb(d) || jsonb_build_object(
               'uses_total', (select coalesce(sum(u.uses_count), 0) from public.user_discount_cards u where u.discount_card_id = d.id),
               'valid_until_date', case when d.valid_until is null then null
                 else to_char(((d.valid_until at time zone 'Europe/Paris') - interval '1 second')::date, 'YYYY-MM-DD') end,
               'expired', (d.valid_until is not null and d.valid_until <= now()))
             order by d.sort_order, d.created_at desc)
    from public.discount_cards d), '[]'::jsonb));
end;
$$;

-- ------------------------------------------------------------------------------
-- Ajout (sans "id") ou modification (avec "id")
-- ------------------------------------------------------------------------------
create or replace function public.admin_save_offer(p_code text, p_offer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_offer ->> 'title', ''));
  v_subtitle text := nullif(trim(coalesce(p_offer ->> 'subtitle', '')), '');
  v_category text := coalesce(nullif(trim(coalesce(p_offer ->> 'category', '')), ''), 'food');
  v_value text := trim(coalesce(p_offer ->> 'discount_value', ''));
  v_badge text := coalesce(nullif(trim(coalesce(p_offer ->> 'badge_label', '')), ''), 'MEMBRE PETIT TOU');
  v_desc text := nullif(trim(coalesce(p_offer ->> 'description', '')), '');
  v_terms text := nullif(trim(coalesce(p_offer ->> 'terms', '')), '');
  v_max_txt text := nullif(trim(coalesce(p_offer ->> 'max_uses', '')), '');
  v_c1 text := coalesce(nullif(trim(coalesce(p_offer ->> 'card_color_primary', '')), ''), '#C93049');
  v_c2 text := coalesce(nullif(trim(coalesce(p_offer ->> 'card_color_secondary', '')), ''), '#8E1F37');
  v_visual text := nullif(trim(coalesce(p_offer ->> 'visual_url', '')), '');
  v_partner text := nullif(trim(coalesce(p_offer ->> 'partner_id', '')), '');
  v_until_txt text := nullif(trim(coalesce(p_offer ->> 'valid_until', '')), '');
  v_sort_txt text := nullif(trim(coalesce(p_offer ->> 'sort_order', '')), '');
  v_max integer;
  v_sort integer;
  v_until timestamptz;
  v_until_day date;
  v_active boolean;
  v_row public.discount_cards;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_offer is null or jsonb_typeof(p_offer) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid: enregistrement attendu');
  end if;

  if nullif(trim(coalesce(p_offer ->> 'id', '')), '') is not null then
    if (p_offer ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid: identifiant illisible');
    end if;
    v_id := (p_offer ->> 'id')::uuid;
  end if;
  if p_offer ? 'is_active' and (p_offer ->> 'is_active') not in ('true', 'false') then
    return jsonb_build_object('ok', false, 'error', 'invalid: actif doit valoir vrai ou faux');
  end if;
  v_active := coalesce((p_offer ->> 'is_active')::boolean, true);

  if v_title = '' or char_length(v_title) > 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid: le nom de l''offre fait de 1 à 80 caractères');
  end if;
  if v_subtitle is not null and char_length(v_subtitle) > 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid: le sous-titre fait 80 caractères au plus');
  end if;
  if v_category not in ('food', 'drinks', 'shopping', 'culture', 'services') then
    return jsonb_build_object('ok', false, 'error', 'invalid: catégorie inconnue');
  end if;
  if v_value = '' or char_length(v_value) > 40 then
    return jsonb_build_object('ok', false, 'error', 'invalid: l''avantage (ex. -20%) fait de 1 à 40 caractères');
  end if;
  if char_length(v_badge) > 30 then
    return jsonb_build_object('ok', false, 'error', 'invalid: le badge fait 30 caractères au plus');
  end if;
  if (v_desc is not null and char_length(v_desc) > 400) or (v_terms is not null and char_length(v_terms) > 400) then
    return jsonb_build_object('ok', false, 'error', 'invalid: la description et les conditions font 400 caractères au plus');
  end if;

  if v_max_txt is null then
    v_max := 5;
  elsif v_max_txt !~ '^\d{1,3}$' or v_max_txt::integer not between 1 and 99 then
    return jsonb_build_object('ok', false, 'error', 'invalid: le nombre d''utilisations est entre 1 et 99');
  else
    v_max := v_max_txt::integer;
  end if;
  if v_sort_txt is null then
    v_sort := 0;
  elsif v_sort_txt !~ '^-?\d{1,3}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid: l''ordre est un nombre entre -999 et 999');
  else
    v_sort := v_sort_txt::integer;
  end if;

  if v_c1 !~ '^#[0-9A-Fa-f]{6}$' or v_c2 !~ '^#[0-9A-Fa-f]{6}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid: les couleurs s''écrivent #RRGGBB');
  end if;
  if v_visual is not null and (char_length(v_visual) > 500 or v_visual !~* '^https://[^[:space:]]+$') then
    return jsonb_build_object('ok', false, 'error', 'invalid: l''image doit être une adresse https');
  end if;
  if v_partner is not null and not exists (select 1 from public.addresses where id::text = v_partner) then
    return jsonb_build_object('ok', false, 'error', 'invalid: cette adresse n''existe pas');
  end if;

  if v_until_txt is null then
    v_until := null;
  else
    if v_until_txt !~ '^\d{4}-\d{2}-\d{2}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid: la date de fin s''écrit AAAA-MM-JJ');
    end if;
    begin
      v_until_day := v_until_txt::date;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid: cette date n''existe pas dans le calendrier');
    end;
    if v_until_day > (now() at time zone 'Europe/Paris')::date + 1095 then
      return jsonb_build_object('ok', false, 'error', 'invalid: la date de fin est trop lointaine (3 ans au plus)');
    end if;
    -- fin incluse : valable jusqu'à minuit (heure de Paris) du jour suivant
    v_until := ((v_until_day + 1)::timestamp) at time zone 'Europe/Paris';
  end if;

  if v_id is null then
    insert into public.discount_cards
      (partner_id, title, subtitle, category, discount_value, badge_label, description, terms, max_uses,
       card_color_primary, card_color_secondary, visual_url, is_active, valid_until, sort_order)
    values
      (v_partner, v_title, v_subtitle, v_category, v_value, v_badge, v_desc,
       coalesce(v_terms, 'Sur présentation de cette carte in-app au moment de l''addition. Valable 1 fois par visite.'),
       v_max, v_c1, v_c2, v_visual, v_active, v_until, v_sort)
    returning * into v_row;
  else
    update public.discount_cards
       set partner_id = v_partner, title = v_title, subtitle = v_subtitle, category = v_category,
           discount_value = v_value, badge_label = v_badge, description = v_desc, terms = v_terms,
           max_uses = v_max, card_color_primary = v_c1, card_color_secondary = v_c2, visual_url = v_visual,
           is_active = v_active, valid_until = v_until, sort_order = v_sort
     where id = v_id
     returning * into v_row;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid: cette offre n''existe plus');
    end if;
  end if;

  return jsonb_build_object('ok', true, 'offer', to_jsonb(v_row));
end;
$$;

-- ------------------------------------------------------------------------------
-- Suppression (les compteurs d'utilisation de cette offre disparaissent avec elle)
-- ------------------------------------------------------------------------------
create or replace function public.admin_delete_offer(p_code text, p_id text)
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
  delete from public.discount_cards where id = p_id::uuid;
  get diagnostics v_count = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_count);
end;
$$;

revoke all on function public.admin_list_offers(text) from public;
revoke all on function public.admin_save_offer(text, jsonb) from public;
revoke all on function public.admin_delete_offer(text, text) from public;
grant execute on function public.admin_list_offers(text) to anon, authenticated;
grant execute on function public.admin_save_offer(text, jsonb) to anon, authenticated;
grant execute on function public.admin_delete_offer(text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
