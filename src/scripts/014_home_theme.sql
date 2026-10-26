-- ==============================================================================
-- LE PETIT TOU — MIGRATION 014 : THÈME DE L'ANNÉE (HAUT DE L'ACCUEIL)
--
-- À LANCER APRÈS 012 (réglages publics de l'appli). Atomique (begin/commit) et rejouable.
--
-- Réunion du 22/10 : « page thème dans le portail pour changer le design chaque année ». L'admin choisit les
-- couleurs (fond, dégradé, accent, texte), les étoiles et les trois phrases du bandeau d'accueil ; l'appli
-- l'applique sans nouveau build. Sans réglage (ou réglage illisible), l'accueil garde le thème « Galaxy ».
--
-- Sécurité (aucune protection existante n'est désactivée) :
--   • le réglage est lisible par tous (comme le fond d'accueil) mais jamais modifiable avec la clé publique : seule
--     admin_set_home_theme écrit, après vérification du code admin côté serveur (porte _admin_gate : 10 échecs en
--     15 minutes => verrouillage) ;
--   • la fonction n'accepte que des couleurs #RRGGBB, un booléen pour les étoiles, des textes courts sans caractère
--     de contrôle et AUCUNE autre clé : une valeur hors forme est refusée, rien n'est écrit.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Le thème rejoint les réglages publics (la liste fermée de clés s'élargit d'une seule clé)
-- ------------------------------------------------------------------------------
do $$
declare
  v_con text;
begin
  for v_con in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.app_settings'::regclass and c.contype = 'c'
  loop
    execute format('alter table public.app_settings drop constraint %I', v_con);
  end loop;
end
$$;
alter table public.app_settings
  add constraint app_settings_key_check check (key in ('home_background', 'home_theme'));

drop policy if exists "Réglages publics de l'appli" on public.app_settings;
create policy "Réglages publics de l'appli" on public.app_settings
  for select to anon, authenticated using (key in ('home_background', 'home_theme'));

-- ------------------------------------------------------------------------------
-- 2. Écriture réservée à l'admin
-- ------------------------------------------------------------------------------
create or replace function public.admin_set_home_theme(p_code text, p_theme jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hex constant text := '^#[0-9a-fA-F]{6}$';
  v_key text;
  v_text text;
  v_value jsonb;
  v_bg2 jsonb;
  v_limits constant jsonb := '{"name": 40, "line1": 40, "line2": 40, "subtitle": 90}';
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  -- Retour au thème d'origine : on retire simplement le réglage.
  if p_theme is null or p_theme = 'null'::jsonb then
    delete from public.app_settings where key = 'home_theme';
    return jsonb_build_object('ok', true, 'setting', null);
  end if;

  if jsonb_typeof(p_theme) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'invalid: thème illisible');
  end if;

  for v_key in select jsonb_object_keys(p_theme) loop
    if v_key not in ('name', 'bg', 'bg2', 'accent', 'text', 'stars', 'line1', 'line2', 'subtitle') then
      return jsonb_build_object('ok', false, 'error', 'invalid: réglage inconnu (' || left(v_key, 30) || ')');
    end if;
  end loop;

  foreach v_key in array array['bg', 'accent', 'text'] loop
    if jsonb_typeof(p_theme -> v_key) is distinct from 'string' or (p_theme ->> v_key) !~ v_hex then
      return jsonb_build_object('ok', false, 'error', 'invalid: couleur « ' || v_key || ' » non valide (format #RRGGBB)');
    end if;
  end loop;

  v_bg2 := p_theme -> 'bg2';
  if v_bg2 is not null and jsonb_typeof(v_bg2) <> 'null'
     and (jsonb_typeof(v_bg2) <> 'string' or (p_theme ->> 'bg2') !~ v_hex) then
    return jsonb_build_object('ok', false, 'error', 'invalid: couleur de dégradé non valide (format #RRGGBB)');
  end if;

  if jsonb_typeof(p_theme -> 'stars') is distinct from 'boolean' then
    return jsonb_build_object('ok', false, 'error', 'invalid: étoiles : oui ou non attendu');
  end if;

  foreach v_key in array array['name', 'line1', 'line2', 'subtitle'] loop
    if jsonb_typeof(p_theme -> v_key) is distinct from 'string' then
      return jsonb_build_object('ok', false, 'error', 'invalid: texte « ' || v_key || ' » manquant');
    end if;
    v_text := btrim(regexp_replace(p_theme ->> v_key, '\s+', ' ', 'g'));
    if v_text = '' then
      return jsonb_build_object('ok', false, 'error', 'invalid: texte « ' || v_key || ' » vide');
    end if;
    if length(v_text) > (v_limits ->> v_key)::int then
      return jsonb_build_object('ok', false, 'error',
        'invalid: texte « ' || v_key || ' » trop long (' || (v_limits ->> v_key) || ' caractères au maximum)');
    end if;
    if v_text ~ '[[:cntrl:]]' then
      return jsonb_build_object('ok', false, 'error', 'invalid: texte « ' || v_key || ' » : caractères non autorisés');
    end if;
  end loop;

  v_value := jsonb_build_object(
    'name', btrim(regexp_replace(p_theme ->> 'name', '\s+', ' ', 'g')),
    'bg', lower(p_theme ->> 'bg'),
    'bg2', case when v_bg2 is null or jsonb_typeof(v_bg2) = 'null' then null else to_jsonb(lower(p_theme ->> 'bg2')) end,
    'accent', lower(p_theme ->> 'accent'),
    'text', lower(p_theme ->> 'text'),
    'stars', (p_theme ->> 'stars')::boolean,
    'line1', btrim(regexp_replace(p_theme ->> 'line1', '\s+', ' ', 'g')),
    'line2', btrim(regexp_replace(p_theme ->> 'line2', '\s+', ' ', 'g')),
    'subtitle', btrim(regexp_replace(p_theme ->> 'subtitle', '\s+', ' ', 'g'))
  );

  insert into public.app_settings (key, value, updated_at) values ('home_theme', v_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object('ok', true, 'setting', v_value);
end;
$$;

revoke all on function public.admin_set_home_theme(text, jsonb) from public;
grant execute on function public.admin_set_home_theme(text, jsonb) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
