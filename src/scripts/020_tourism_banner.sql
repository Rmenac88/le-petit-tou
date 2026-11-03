-- ==============================================================================
-- LE PETIT TOU — MIGRATION 020 : BANNIÈRE « OFFICE DE TOURISME DE TOULOUSE » (ACCUEIL)
--
-- À LANCER APRÈS 014 (réglages publics de l'appli). Atomique (begin/commit) et rejouable.
--
-- Un bouton sur l'accueil met en avant l'agenda de l'Office de tourisme. L'adresse vers laquelle il renvoie se règle depuis
-- le portail admin ; sans réglage, l'appli utilise l'agenda officiel (toulouse-tourisme.com).
--
-- Sécurité (aucune protection existante n'est désactivée) :
--   • le réglage est lisible par tous (comme le thème et le fond d'accueil) mais jamais modifiable avec la clé publique :
--     seule admin_set_tourism_banner écrit, après vérification du code admin côté serveur (porte _admin_gate : 10 échecs
--     en 15 minutes => verrouillage) ;
--   • la fonction n'accepte qu'une adresse https de 300 caractères au plus, sans espace ni identifiant, avec un nom de
--     site complet. Tout le reste est refusé, rien n'est écrit. Une adresse vide supprime le réglage (retour au lien par défaut).
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Le réglage rejoint les réglages publics (la liste fermée de clés s'élargit d'une seule clé)
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
  add constraint app_settings_key_check check (key in ('home_background', 'home_theme', 'tourism_banner'));

drop policy if exists "Réglages publics de l'appli" on public.app_settings;
create policy "Réglages publics de l'appli" on public.app_settings
  for select to anon, authenticated using (key in ('home_background', 'home_theme', 'tourism_banner'));

-- ------------------------------------------------------------------------------
-- 2. Écriture réservée à l'admin
-- ------------------------------------------------------------------------------
create or replace function public.admin_set_tourism_banner(p_code text, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url text;
  v_value jsonb;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  v_url := btrim(coalesce(p_url, ''));

  -- Retour au lien par défaut : on retire simplement le réglage.
  if v_url = '' then
    delete from public.app_settings where key = 'tourism_banner';
    return jsonb_build_object('ok', true, 'setting', null);
  end if;

  if length(v_url) > 300 then
    return jsonb_build_object('ok', false, 'error', 'invalid: adresse trop longue (300 caractères au maximum)');
  end if;
  if v_url ~ '[[:space:][:cntrl:]]' then
    return jsonb_build_object('ok', false, 'error', 'invalid: adresse avec espace ou caractère non autorisé');
  end if;
  if v_url !~* '^https://[a-z0-9-]+(\.[a-z0-9-]+)+(:[0-9]{1,5})?([/?#]\S*)?$' then
    return jsonb_build_object('ok', false, 'error', 'invalid: adresse non valide (https://nom-du-site.fr/...)');
  end if;

  v_value := jsonb_build_object('url', v_url);
  insert into public.app_settings (key, value, updated_at) values ('tourism_banner', v_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object('ok', true, 'setting', v_value);
end;
$$;

revoke all on function public.admin_set_tourism_banner(text, text) from public;
grant execute on function public.admin_set_tourism_banner(text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
