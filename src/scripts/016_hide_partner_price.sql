-- ==============================================================================
-- LE PETIT TOU — 009 : le montant payé par les partenaires reste interne
--
-- À lancer APRÈS 006 à 015. Dans Supabase -> SQL Editor -> New query -> Run.
-- Résultat attendu : "Success. No rows returned". Relançable sans danger. Aucun secret à remplacer.
--
-- Pourquoi : 006 donne la lecture publique des 4 tables du catalogue, ce qui rend
-- sponsored_partners.price_paid (ce que le partenaire paie) lisible avec la clé publique.
-- Ce script :
--   * ferme la lecture directe de sponsored_partners au public ;
--   * crée la vue sponsored_partners_public (sans prix ni réglages de notification) que lit l'appli ;
--   * crée admin_read, qui renvoie toute la table au portail admin après vérification du code
--     (même porte et même verrouillage anti force brute que admin_write).
-- ==============================================================================

begin;

-- 1. Vue publique : uniquement les colonnes affichables, partenaires actifs seulement
do $$
declare
  v_cols text;
begin
  select string_agg(format('%I', column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'sponsored_partners'
    and column_name in ('id', 'spot_id', 'title', 'subtitle', 'image_url', 'badge_text',
                        'sponsorship_tier', 'rank_position', 'starts_at', 'ends_at',
                        'is_active', 'created_at');
  if v_cols is null then
    raise exception 'table sponsored_partners introuvable';
  end if;
  execute format(
    'create or replace view public.sponsored_partners_public as select %s from public.sponsored_partners where is_active = true',
    v_cols);
end
$$;
revoke all on public.sponsored_partners_public from anon, authenticated;
grant select on public.sponsored_partners_public to anon, authenticated;

-- 2. Fermeture de la lecture directe de la table (prix inclus)
revoke all on public.sponsored_partners from anon, authenticated;
drop policy if exists "Lecture publique" on public.sponsored_partners;

-- 3. Lecture admin : remplace toute ancienne version, quels que soient ses paramètres
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'admin_read'
  loop
    execute 'drop function if exists ' || r.sig || ' cascade';
  end loop;
end
$$;

create function public.admin_read(p_code text, p_table text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_table is distinct from 'sponsored_partners' then
    return jsonb_build_object('ok', false, 'error', 'invalid: table non autorisée');
  end if;
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  return jsonb_build_object(
    'ok', true,
    'rows', coalesce((select jsonb_agg(to_jsonb(t.*) order by t.rank_position, t.created_at)
                        from public.sponsored_partners t), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_read(text, text) from public;
grant execute on function public.admin_read(text, text) to anon, authenticated;

commit;
