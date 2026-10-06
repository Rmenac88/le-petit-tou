-- ==============================================================================
-- LE PETIT TOU — SCRIPT GLOBAL SUPABASE : PERFORMANCES, COMMERÇANTS & NOTIFICATIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INDEX DE PERFORMANCE (Accélération requêtes, filtres, GPS & recherche)
-- ------------------------------------------------------------------------------

-- Index composite pour le filtrage rapide par catégorie et tri par note
CREATE INDEX IF NOT EXISTS idx_addresses_category_rating 
ON public.addresses (category_id, rating DESC);

-- Index composite pour les filtres 'is_recommended' et 'is_new'
CREATE INDEX IF NOT EXISTS idx_addresses_flags 
ON public.addresses (is_recommended, is_new);

-- Index composite sur les coordonnées géographiques (lat, lng) pour la carte
CREATE INDEX IF NOT EXISTS idx_addresses_lat_lng 
ON public.addresses (lat, lng);

-- Index sur les dates d'événements pour le tri chronologique
CREATE INDEX IF NOT EXISTS idx_events_event_date 
ON public.events (event_date ASC);

-- Index GIN sur le tableau de tags pour les recherches instantanées
CREATE INDEX IF NOT EXISTS idx_addresses_tags_gin 
ON public.addresses USING GIN (tags);

-- Index sur le nom de catégorie
CREATE INDEX IF NOT EXISTS idx_categories_name 
ON public.categories (name);


-- ------------------------------------------------------------------------------
-- 2. ESPACE COMMERÇANT & TRACKING DE FRÉQUENTATION DYNAMIQUE
-- ------------------------------------------------------------------------------

-- Colonnes commerçant dans la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_slug text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_website text;

-- Table de tracking de fréquentation (vues des fiches commerçants)
CREATE TABLE IF NOT EXISTS public.address_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text DEFAULT 'app',   -- 'home' | 'map' | 'search' | 'favorites' | 'direct'
  viewed_at timestamptz DEFAULT now() NOT NULL
);

-- Index ultra-rapides pour le dashboard commerçant (KPIs et graphique par semaine)
CREATE INDEX IF NOT EXISTS idx_address_views_spot_id 
ON public.address_views (spot_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_views_date 
ON public.address_views (viewed_at DESC);

-- Permissions de lecture/écriture
ALTER TABLE public.address_views DISABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. SYSTÈME DE NOTIFICATIONS PUSH (Tokens & Préférences)
-- ------------------------------------------------------------------------------

-- Table d'enregistrement des tokens Expo Push par appareil / utilisateur
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id text NOT NULL,
  push_token text,
  platform text,
  notify_events boolean DEFAULT true,
  notify_spots boolean DEFAULT false,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user 
ON public.user_push_tokens (user_id);

ALTER TABLE public.user_push_tokens DISABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 4. SYSTÈME PARTENARIATS & TOP SPONSORING NETFLIX
-- ------------------------------------------------------------------------------

-- Table des partenaires mis en avant (Carrousel Netflix Top 10)
CREATE TABLE IF NOT EXISTS public.sponsored_partners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id text,                                    -- ID de l'établissement lié (optionnel)
  title text NOT NULL,                             -- Nom du partenaire
  subtitle text,                                   -- Description courte / offre exclusive
  image_url text,                                  -- Photo de couverture HD
  badge_text text DEFAULT 'PARTENAIRE OFFICIEL',  -- Badge (ex: TOP 1, COUP DE COEUR, PARTENAIRE PREMIUM)
  sponsorship_tier text DEFAULT 'gold',            -- 'platinum' | 'gold' | 'silver' | 'bronze'
  price_paid numeric DEFAULT 0,                    -- Montant du sponsoring en €
  rank_position integer DEFAULT 1,                 -- Position dans le classement Netflix (1, 2, 3...)
  starts_at timestamptz DEFAULT now() NOT NULL,   -- Date de début de la mise en avant
  ends_at timestamptz NOT NULL,                    -- Date de fin (durée du sponsoring)
  notify_interval_hours integer DEFAULT 24,       -- Fréquence d'envoi de notification push (ex: 2h, 12h, 24h)
  last_notified_at timestamptz,                   -- Horodatage de la dernière notification envoyée
  is_active boolean DEFAULT true,                  -- Statut actif / inactif
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index pour le tri et le filtre rapide sur l'accueil
CREATE INDEX IF NOT EXISTS idx_sponsored_partners_rank 
ON public.sponsored_partners (rank_position ASC, is_active);

CREATE INDEX IF NOT EXISTS idx_sponsored_partners_dates 
ON public.sponsored_partners (starts_at, ends_at, is_active);

-- ------------------------------------------------------------------------------
-- 5. POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS PRODUCTION)
-- ------------------------------------------------------------------------------

-- Ajout sécurisé de la valeur 'admin' à l'enum user_role si existant
DO $$ 
BEGIN
  ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin';
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Contrainte d'unicité pour empêcher les doublons de favoris
ALTER TABLE IF EXISTS public.user_favorites 
DROP CONSTRAINT IF EXISTS uq_user_spot;

ALTER TABLE IF EXISTS public.user_favorites 
ADD CONSTRAINT uq_user_spot UNIQUE (user_id, spot_id);

-- Colonnes requises
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS full_description text;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address_id text;

-- 1. Sécurisation et permissions de la table addresses
ALTER TABLE public.addresses DISABLE ROW LEVEL SECURITY;

-- 2. Sécurisation de la table address_views (Vues commerçants)
ALTER TABLE public.address_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enregistrement public des vues" ON public.address_views;
CREATE POLICY "Enregistrement public des vues" 
ON public.address_views FOR INSERT 
TO public 
WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture des vues par le commerçant lié ou l'administrateur" ON public.address_views;
CREATE POLICY "Lecture des vues par le commerçant lié ou l'administrateur" 
ON public.address_views FOR SELECT 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
      AND (profiles.role::text = 'admin' OR profiles.address_id = address_views.spot_id)
  )
);

-- 3. Sécurisation de la table user_push_tokens
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestion des tokens par appareil" ON public.user_push_tokens;
CREATE POLICY "Gestion des tokens par appareil" 
ON public.user_push_tokens FOR ALL 
TO public 
USING (true) 
WITH CHECK (true);

-- 4. Sécurisation de la table sponsored_partners
ALTER TABLE public.sponsored_partners DISABLE ROW LEVEL SECURITY;

-- 5. Sécurisation de la table merchant_offers
ALTER TABLE public.merchant_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Création d'offre par le commerçant" ON public.merchant_offers;
CREATE POLICY "Création d'offre par le commerçant" 
ON public.merchant_offers FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lecture des offres par le commerçant ou l'administrateur" ON public.merchant_offers;
CREATE POLICY "Lecture des offres par le commerçant ou l'administrateur" 
ON public.merchant_offers FOR SELECT 
TO authenticated 
USING (
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() AND profiles.role::text = 'admin'
  )
);

-- 6. Sécurisation des réservations / Wallet Billetterie
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture des billets de l'utilisateur" ON public.event_registrations;
CREATE POLICY "Lecture des billets de l'utilisateur" 
ON public.event_registrations FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Création de réservation par l'utilisateur connecté" ON public.event_registrations;
CREATE POLICY "Création de réservation par l'utilisateur connecté" 
ON public.event_registrations FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- 6. FONCTION ATOMIQUE ANTI-REJEU DE SCAN DE BILLET (SECURITY DEFINER)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION scan_ticket_secure(p_ticket_number TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reg RECORD;
BEGIN
  -- Vérifier si l'utilisateur appelant est admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role::text = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHORIZED', 'message', 'Action réservée aux administrateurs.');
  END IF;

  SELECT * INTO v_reg FROM public.event_registrations 
  WHERE ticket_number = UPPER(TRIM(p_ticket_number)) 
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Billet introuvable.');
  END IF;

  IF v_reg.payment_status = 'scanned' OR v_reg.is_scanned = true THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_SCANNED', 'message', 'Billet déjà validé antérieurement.');
  END IF;

  UPDATE public.event_registrations 
  SET payment_status = 'scanned', is_scanned = true, scanned_at = NOW() 
  WHERE id = v_reg.id;

  RETURN jsonb_build_object('success', true, 'code', 'VALIDATED', 'message', 'Billet validé avec succès.');
END;
$$;


