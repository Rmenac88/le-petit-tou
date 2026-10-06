-- ==============================================================================
-- LE PETIT TOU — SCRIPT DE CORRECTION SUPABASE (PORTAIL ADMIN & BASE DE DONNÉES)
-- ==============================================================================
-- Exécutez ce script dans l'éditeur SQL de votre tableau de bord Supabase :
-- https://supabase.com/dashboard/project/ckesvawakxblsuhmzaeo/sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLE ADDRESSES (Adresses / Établissements)
-- ------------------------------------------------------------------------------

-- Ajout de la colonne full_description si manquante
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS full_description text;

-- Synchronisation des descriptions existantes
UPDATE public.addresses 
SET full_description = description 
WHERE full_description IS NULL AND description IS NOT NULL;

-- S'assurer de la présence des autres colonnes attendues
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS horaires text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS gallery_urls text[];
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS price_level text DEFAULT '€€';
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS is_recommended boolean DEFAULT false;
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS is_new boolean DEFAULT false;

-- Valeur par défaut pour l'identifiant UUID
ALTER TABLE public.addresses ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Configuration des permissions (RLS) : Autoriser la création, modification et suppression
ALTER TABLE public.addresses DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. TABLE CATEGORIES (Catégories)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  icon_name text DEFAULT 'UtensilsCrossed',
  color text DEFAULT '#C52824',
  slug text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon_name text DEFAULT 'UtensilsCrossed';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS color text DEFAULT '#C52824';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.categories ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;

-- Insertion des 19 catégories officielles Le Petit Tou
INSERT INTO public.categories (id, name, icon_name, color, slug) VALUES
  ('ab4a99b2-2f1f-4743-8e6f-93b4eff6349f', 'Artisans & Créateurs locaux', 'Brush', '#E11D48', 'artisans'),
  ('71a09480-03a3-4f4f-b545-586954aa150f', 'Bars, Cafés & Salons de thé', 'Coffee', '#F59E0B', 'bars-cafes'),
  ('edabac3e-6bad-4c34-9dfd-3551da339e63', 'Beauté, Coiffure & Spa', 'Sparkles', '#F43F5E', 'beaute-spa'),
  ('8c2d100c-6ef8-4e8c-a773-35dff93aec96', 'Boulangeries & Pâtisseries', 'Croissant', '#D97706', 'boulangeries'),
  ('27117a0e-6501-5624-ab76-830d537daf2b', 'Culture & Loisirs', 'Music', '#06B6D4', 'culture-loisirs'),
  ('6d206eca-977b-4f94-9e9a-b92fc15b1394', 'Culture, Musées & Galeries', 'Palette', '#6366F1', 'culture'),
  ('3641faf4-4d5d-411d-a767-e6bc7b3c7244', 'Déco, Maison & Fleuristes', 'Home', '#3B82F6', 'deco-maison'),
  ('82607432-b9d9-41c6-9f48-97ed533a8e2c', 'Épiceries Fines & Terroir', 'ShoppingBag', '#10B981', 'epiceries'),
  ('e6134429-8d6e-5d84-bf4e-884e016df958', 'Gourmand Gourmet', 'UtensilsCrossed', '#EF4444', 'gourmand-gourmet'),
  ('bc00b03a-ce3e-4c3d-a017-c961d39aca17', 'Hôtels & Hébergements insolites', 'Bed', '#0EA5E9', 'hotels'),
  ('ac3c90ae-6a65-435b-8884-5fd9e3dc82f8', 'Loisirs, Jeux & Échappées', 'Compass', '#06B6D4', 'loisirs'),
  ('8663316f-b328-4075-bb6d-69b4b32a1d5c', 'Mode, Friperies & Accessoires', 'Shirt', '#EC4899', 'mode'),
  ('5cbc4fe4-d6fe-4e5d-af95-8005c333a066', 'Restaurants & Gastronomie', 'Utensils', '#EF4444', 'restaurants'),
  ('d06ccd60-517e-4e10-8182-565df3285b5e', 'Services & Vie Pratique', 'Wrench', '#64748B', 'services'),
  ('dd6f9ea1-9c77-5ecb-9b8d-d085c7ea9429', 'Shopping & Beauté', 'ShoppingBag', '#10B981', 'shopping-beaute'),
  ('e2a4f899-dadc-4037-bf7e-6d6663afdf14', 'Sport & Bien-être actif', 'Trophy', '#84CC16', 'sport'),
  ('61170f20-77e8-5082-8cc5-2d528e21238f', 'Trinquer & Danser', 'GlassWater', '#8B5CF6', 'trinquer-danser'),
  ('970ec2f9-f1c9-4bc4-97e1-087bac9f4cdd', 'Vie Nocturne & Clubs', 'Wine', '#8B5CF6', 'nocturne'),
  ('75f3a62d-e7b2-5559-b83d-dc97baaa2af3', 'Vie Pratique & Services', 'Home', '#E5A93B', 'vie-pratique')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. TABLE EVENTS (Événements)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time text DEFAULT '19:00',
  location text DEFAULT 'Toulouse',
  price numeric(10, 2) DEFAULT 0.00 NOT NULL,
  max_participants integer DEFAULT 100,
  image_url text,
  address_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Ajout de la colonne address_id si absente
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS address_id text;
ALTER TABLE public.events ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. TABLE SPONSORED_PARTNERS (Top Partenaires Netflix)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.sponsored_partners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id text,
  title text NOT NULL,
  subtitle text,
  image_url text,
  badge_text text DEFAULT 'PARTENAIRE OFFICIEL',
  sponsorship_tier text DEFAULT 'gold',
  price_paid numeric DEFAULT 0,
  rank_position integer DEFAULT 1,
  starts_at timestamptz DEFAULT now() NOT NULL,
  ends_at timestamptz NOT NULL,
  notify_interval_hours integer DEFAULT 24,
  last_notified_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.sponsored_partners ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.sponsored_partners DISABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. RELANCER LE CACHE DU SCHÉMA POSTGREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
