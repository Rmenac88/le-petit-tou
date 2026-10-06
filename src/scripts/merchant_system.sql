-- ==============================================================================
-- LE PETIT TOU — SYSTÈME COMMERÇANT & TRACKING FRÉQUENTATION
-- ==============================================================================

-- 1. Colonnes commerçant dans la table profiles existante
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_slug text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS business_website text;

-- 2. Table de tracking de fréquentation
CREATE TABLE IF NOT EXISTS public.address_views (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  source text DEFAULT 'app',   -- 'home' | 'map' | 'search' | 'favorites' | 'direct'
  viewed_at timestamptz DEFAULT now() NOT NULL
);

-- 3. Index pour les requêtes de dashboard (très rapide)
CREATE INDEX IF NOT EXISTS idx_address_views_spot_id 
ON public.address_views (spot_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_address_views_date 
ON public.address_views (viewed_at DESC);

-- 4. Permissions
ALTER TABLE public.address_views DISABLE ROW LEVEL SECURITY;
