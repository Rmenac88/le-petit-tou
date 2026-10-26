-- ==============================================================================
-- LE PETIT TOU — MIGRATION 012 : FOND DE L'ACCUEIL PERSONNALISABLE
--
-- À LANCER APRÈS 006 (porte d'accès admin). Atomique (begin/commit) et rejouable.
--
-- L'admin téléverse une image depuis le portail ; elle remplace le thème « Galaxy » sur l'accueil, sans nouveau
-- build de l'appli. Le thème Galaxy reste le repli (aucune image, image illisible, retour demandé par l'admin).
--
-- Sécurité de l'envoi (aucune désactivation de protection existante) :
--   1. L'admin demande un « billet » d'envoi (admin_request_upload) : le code admin est vérifié côté serveur
--      (porte _admin_gate : 10 échecs en 15 minutes => verrouillage). Le billet fixe le chemin EXACT du fichier,
--      vaut 10 minutes et ne sert qu'à un seul fichier (un nom ne peut exister qu'une fois dans le stockage).
--   2. Le stockage n'accepte un envoi dans le dossier « app-backgrounds » que si le billet est valide (politique
--      RESTRICTIVE : elle s'applique en plus de toute politique plus large déjà présente en production).
--      Modifier ou supprimer un fichier de ce dossier est interdit à la clé publique.
--   3. Le dossier limite la taille (2 Mo) et le type (JPEG, PNG, WebP) côté stockage ; admin_set_home_background
--      revérifie la taille et le type du fichier réellement reçu avant de l'afficher.
--
-- Lecture publique : seul le réglage « home_background » (mode + chemin du fichier + date) est lisible.
-- Les anciens fichiers restent dans le dossier (la suppression directe n'est pas permise par le stockage Supabase) ;
-- ils pèsent au plus 2 Mo chacun et seul l'admin peut en ajouter.
-- ==============================================================================

begin;

-- ------------------------------------------------------------------------------
-- 1. Réglages publics
-- ------------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key check (key in ('home_background')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

drop policy if exists "Réglages publics de l'appli" on public.app_settings;
create policy "Réglages publics de l'appli" on public.app_settings
  for select to anon, authenticated using (key = 'home_background');

revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. Billets d'envoi (illisibles et inscriptibles depuis l'appli)
-- ------------------------------------------------------------------------------
create table if not exists public.upload_tickets (
  path text primary key,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamp with time zone
);
alter table public.upload_tickets enable row level security;
revoke all on public.upload_tickets from anon, authenticated;

-- Appelée par la politique de stockage (qui s'exécute avec les droits de l'appelant) : ne révèle qu'un oui/non
-- pour un chemin aléatoire de 128 bits, impossible à deviner.
create or replace function public._upload_ticket_ok(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.upload_tickets t
     where t.path = p_name and t.used_at is null and t.expires_at > now())
$$;
revoke all on function public._upload_ticket_ok(text) from public;
grant execute on function public._upload_ticket_ok(text) to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Dossier de stockage et politiques
-- ------------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Stockage Supabase absent : le dossier app-backgrounds n''a pas été créé (activer Storage puis relancer ce script).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('app-backgrounds', 'app-backgrounds', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true,
        file_size_limit = 2097152,
        allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

  -- Autorisation d'envoyer dans ce dossier (nécessaire pour qu'une politique permissive existe)…
  drop policy if exists "app-backgrounds : envoi" on storage.objects;
  create policy "app-backgrounds : envoi" on storage.objects
    for insert to anon, authenticated
    with check (bucket_id = 'app-backgrounds');

  -- …mais RESTREINTE par un billet valide, quelles que soient les autres politiques déjà en place.
  drop policy if exists "app-backgrounds : billet obligatoire" on storage.objects;
  create policy "app-backgrounds : billet obligatoire" on storage.objects
    as restrictive for insert to anon, authenticated
    with check (bucket_id <> 'app-backgrounds' or public._upload_ticket_ok(name));

  -- Aucun écrasement ni suppression par la clé publique dans ce dossier.
  drop policy if exists "app-backgrounds : pas de modification" on storage.objects;
  create policy "app-backgrounds : pas de modification" on storage.objects
    as restrictive for update to anon, authenticated
    using (bucket_id <> 'app-backgrounds')
    with check (bucket_id <> 'app-backgrounds');

  drop policy if exists "app-backgrounds : pas de suppression" on storage.objects;
  create policy "app-backgrounds : pas de suppression" on storage.objects
    as restrictive for delete to anon, authenticated
    using (bucket_id <> 'app-backgrounds');
end
$$;

-- ------------------------------------------------------------------------------
-- 4. Fonctions admin
-- ------------------------------------------------------------------------------
create or replace function public.admin_request_upload(p_code text, p_ext text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_ext text := lower(trim(coalesce(p_ext, '')));
  v_path text;
  v_live integer;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if v_ext not in ('jpg', 'png', 'webp') then
    return jsonb_build_object('ok', false, 'error', 'invalid: format d''image non pris en charge (JPEG, PNG ou WebP)');
  end if;

  delete from public.upload_tickets where expires_at < now() - interval '1 day';
  select count(*) into v_live from public.upload_tickets where used_at is null and expires_at > now();
  if v_live >= 20 then
    return jsonb_build_object('ok', false, 'error', 'invalid: trop d''envois en attente, réessaie dans quelques minutes');
  end if;

  v_path := 'home/' || to_char(now(), 'YYYYMMDD') || '-' || replace(gen_random_uuid()::text, '-', '') || '.' || v_ext;
  insert into public.upload_tickets (path, expires_at) values (v_path, now() + interval '10 minutes');

  return jsonb_build_object('ok', true, 'bucket', 'app-backgrounds', 'path', v_path,
                            'expires_in', 600, 'max_bytes', 2097152);
end;
$$;

create or replace function public.admin_set_home_background(p_code text, p_mode text, p_path text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_meta jsonb;
  v_size bigint;
  v_mime text;
  v_value jsonb;
begin
  if not public._admin_gate(p_code) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;

  if p_mode = 'galaxy' then
    v_value := jsonb_build_object('mode', 'galaxy');
  elsif p_mode = 'image' then
    if p_path is null or p_path !~ '^home/\d{8}-[0-9a-f]{32}\.(jpg|png|webp)$' then
      return jsonb_build_object('ok', false, 'error', 'invalid: chemin d''image illisible');
    end if;
    if not exists (select 1 from public.upload_tickets where path = p_path) then
      return jsonb_build_object('ok', false, 'error', 'invalid: aucun envoi n''a été autorisé pour cette image');
    end if;
    select o.metadata into v_meta
      from storage.objects o where o.bucket_id = 'app-backgrounds' and o.name = p_path;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'invalid: l''image n''a pas été reçue, recommence l''envoi');
    end if;
    begin
      v_size := (v_meta ->> 'size')::bigint;
    exception when others then
      v_size := null;
    end;
    v_mime := v_meta ->> 'mimetype';
    if v_size is null or v_size <= 0 or v_size > 2097152 then
      return jsonb_build_object('ok', false, 'error', 'invalid: image trop lourde (2 Mo au maximum)');
    end if;
    if v_mime is null or v_mime not in ('image/jpeg', 'image/png', 'image/webp') then
      return jsonb_build_object('ok', false, 'error', 'invalid: format d''image non pris en charge (JPEG, PNG ou WebP)');
    end if;
    update public.upload_tickets set used_at = coalesce(used_at, now()) where path = p_path;
    v_value := jsonb_build_object('mode', 'image', 'path', p_path, 'updated', extract(epoch from now())::bigint);
  else
    return jsonb_build_object('ok', false, 'error', 'invalid: mode inconnu (galaxy ou image)');
  end if;

  insert into public.app_settings (key, value, updated_at) values ('home_background', v_value, now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object('ok', true, 'setting', v_value);
end;
$$;

revoke all on function public.admin_request_upload(text, text) from public;
revoke all on function public.admin_set_home_background(text, text, text) from public;
grant execute on function public.admin_request_upload(text, text) to anon, authenticated;
grant execute on function public.admin_set_home_background(text, text, text) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
