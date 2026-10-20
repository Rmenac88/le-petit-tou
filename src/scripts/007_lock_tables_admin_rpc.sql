-- ==============================================================================
-- LE PETIT TOU — VERROUILLAGE DES TABLES + ÉCRITURES ADMIN SÉCURISÉES
--
-- À lancer APRÈS 005 (code admin) et 006 (jetons push), dans
-- Supabase -> SQL Editor -> New query -> Run. Aucun secret à remplacer.
-- Résultat attendu : "Success. No rows returned". Relançable sans danger.
--
-- Ce que ça change :
--  * addresses, categories, events : lecture publique, plus aucune écriture depuis l'appli.
--  * sponsored_partners : table totalement fermée (elle contient le prix payé).
--    L'appli publique lit la vue sponsored_partners_public (sans prix ni notifications).
--  * address_views, place_suggestions : l'appli peut seulement AJOUTER (pas lire).
--  * spot_likes : lecture publique ; les likes passent par increment_spot_like.
--  * Le portail admin écrit via admin_write / admin_read, qui vérifient le code admin.
--
-- IMPORTANT : lance ce script, puis mets l'appli à jour (branche chore/preparation-publication).
-- Une ancienne version de l'appli ne pourrait plus utiliser le portail admin.
-- ==============================================================================

begin;

-- 1. Verrouillage : RLS activée, anciennes règles supprimées, droits d'écriture retirés
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array['addresses','categories','events','sponsored_partners',
                           'address_views','place_suggestions','spot_likes']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- 2. Lecture publique (sans écriture)
do $$
declare t text;
begin
  foreach t in array array['addresses','categories','events','spot_likes']
  loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('grant select on public.%I to anon, authenticated', t);
    execute format('create policy %I on public.%I for select to public using (true)', 'lecture_publique_' || t, t);
  end loop;
end
$$;

-- 3. Ajout seul : vues d'adresses et suggestions
do $$
begin
  if to_regclass('public.address_views') is not null then
    grant insert (spot_id, source) on public.address_views to anon, authenticated;
    create policy "ajout_vue_publique" on public.address_views for insert to public
      with check (source = 'app' and length(spot_id) between 1 and 64);
  end if;
  if to_regclass('public.place_suggestions') is not null then
    grant insert (device_id, title, address, category_name, comment) on public.place_suggestions to anon, authenticated;
    create policy "ajout_suggestion_publique" on public.place_suggestions for insert to public
      with check (
        length(trim(title)) between 1 and 120
        and length(device_id) between 1 and 128
        and coalesce(length(address), 0) <= 200
        and coalesce(length(comment), 0) <= 600
      );
  end if;
end
$$;

-- 4. Partenaires : vue publique sans prix ni réglages de notification
create or replace view public.sponsored_partners_public as
  select id, spot_id, title, subtitle, image_url, badge_text, sponsorship_tier,
         rank_position, starts_at, ends_at, is_active, created_at
  from public.sponsored_partners
  where is_active = true;
revoke all on public.sponsored_partners_public from anon, authenticated;
grant select on public.sponsored_partners_public to anon, authenticated;

-- 5. Likes : fonction atomique (remplace une éventuelle ancienne version)
drop function if exists public.increment_spot_like(text, integer);
create function public.increment_spot_like(p_spot_id text, p_delta integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare new_total integer;
begin
  if p_spot_id is null or length(trim(p_spot_id)) = 0 or length(p_spot_id) > 64 then
    raise exception 'invalid spot id';
  end if;
  if p_delta not in (-1, 1) then
    raise exception 'invalid delta';
  end if;
  insert into public.spot_likes (spot_id, likes_count, updated_at)
  values (p_spot_id, greatest(0, p_delta), now())
  on conflict (spot_id) do update
    set likes_count = greatest(0, public.spot_likes.likes_count + p_delta), updated_at = now()
  returning likes_count into new_total;
  return new_total;
end;
$$;
revoke all on function public.increment_spot_like(text, integer) from public;
grant execute on function public.increment_spot_like(text, integer) to anon, authenticated;

-- 6. Écritures admin : une seule porte, protégée par le code admin
-- (supprime d'abord toute ancienne version, quels que soient ses paramètres)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('admin_write', 'admin_read')
  loop
    execute 'drop function ' || f.sig;
  end loop;
end
$$;

create function public.admin_write(
  p_code text, p_table text, p_op text, p_id text, p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_cols text;
  v_vals text;
  v_sets text;
  v_result jsonb;
begin
  if not public.verify_admin_access(p_code) then
    raise exception 'access denied';
  end if;
  if p_table not in ('addresses','categories','events','sponsored_partners') then
    raise exception 'table not allowed';
  end if;

  if p_op = 'delete' then
    execute format(
      'with d as (delete from public.%I where id::text = $1 returning *) select coalesce(jsonb_agg(to_jsonb(d.*)), ''[]''::jsonb) from d',
      p_table) into v_result using p_id;
    return v_result;
  end if;

  if p_op not in ('insert','update') then
    raise exception 'operation not allowed';
  end if;

  -- Seules les clés qui correspondent à de vraies colonnes sont retenues
  select string_agg(format('%I', k.key), ', '),
         string_agg(format('r.%I', k.key), ', '),
         string_agg(format('%I = r.%I', k.key, k.key), ', ')
    into v_cols, v_vals, v_sets
  from jsonb_object_keys(coalesce(p_payload, '{}'::jsonb)) as k(key)
  join information_schema.columns c
    on c.table_schema = 'public' and c.table_name = p_table and c.column_name = k.key
  where (p_op = 'insert' or k.key not in ('id', 'created_at'));

  if v_cols is null then
    raise exception 'empty payload';
  end if;

  if p_op = 'insert' then
    execute format(
      'with i as (insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r returning *) select coalesce(jsonb_agg(to_jsonb(i.*)), ''[]''::jsonb) from i',
      p_table, v_cols, v_vals, p_table) into v_result using p_payload;
  else
    execute format(
      'with u as (update public.%I as t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id::text = $2 returning t.*) select coalesce(jsonb_agg(to_jsonb(u.*)), ''[]''::jsonb) from u',
      p_table, v_sets, p_table) into v_result using p_payload, p_id;
  end if;
  return v_result;
end;
$$;

create function public.admin_read(p_code text, p_table text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_result jsonb;
begin
  if not public.verify_admin_access(p_code) then
    raise exception 'access denied';
  end if;
  if p_table not in ('sponsored_partners') then
    raise exception 'table not allowed';
  end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(t.*)), ''[]''::jsonb) from public.%I t', p_table) into v_result;
  return v_result;
end;
$$;

revoke all on function public.admin_write(text, text, text, text, jsonb) from public;
revoke all on function public.admin_read(text, text) from public;
grant execute on function public.admin_write(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.admin_read(text, text) to anon, authenticated;

commit;
