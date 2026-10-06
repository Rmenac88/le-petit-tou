-- ==============================================================================
-- LE PETIT TOU — POSTGRESQL / SUPABASE PERFORMANCE INDEXES & SPATIAL OPTIMIZATION
-- ==============================================================================

-- 1. Index composite pour le filtrage rapide par catégorie et tri par note
CREATE INDEX IF NOT EXISTS idx_addresses_category_rating 
ON public.addresses (category_id, rating DESC);

-- 2. Index composite pour les filtres 'is_recommended' et 'is_new'
CREATE INDEX IF NOT EXISTS idx_addresses_flags 
ON public.addresses (is_recommended, is_new);

-- 3. Index composite sur les coordonnées géographiques (lat, lng) pour le bounding-box rapide
CREATE INDEX IF NOT EXISTS idx_addresses_lat_lng 
ON public.addresses (lat, lng);

-- 4. Index sur les dates d'événements pour le tri chronologique
CREATE INDEX IF NOT EXISTS idx_events_event_date 
ON public.events (event_date ASC);

-- 5. Index GIN sur le tableau de tags pour les recherches instantanées
CREATE INDEX IF NOT EXISTS idx_addresses_tags_gin 
ON public.addresses USING GIN (tags);

-- 6. Index B-Tree sur les catégories
CREATE INDEX IF NOT EXISTS idx_categories_slug 
ON public.categories (slug);
