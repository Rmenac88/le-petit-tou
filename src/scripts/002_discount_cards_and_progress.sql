-- ==============================================================================
-- LE PETIT TOU — MIGRATION 002 : CARTES DE RÉDUCTION, UTILISATIONS & PROGRESSION
-- ==============================================================================
-- Exécutez ce script dans l'éditeur SQL de votre Dashboard Supabase.
-- ==============================================================================

-- 1. EXTENSION DE LA TABLE ADDRESSES AVEC BARÈME DE POINTS VARIABLE
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS points_reward INTEGER DEFAULT 10;

-- Initialisation des points selon la réputation et le statut du spot
UPDATE public.addresses
SET points_reward = CASE 
    WHEN rating >= 4.9 AND is_recommended IS TRUE THEN 35
    WHEN is_recommended IS TRUE THEN 25
    WHEN rating >= 4.8 THEN 20
    ELSE 10
END
WHERE points_reward IS NULL OR points_reward = 10;

-- 2. TABLE DES CARTES DE RÉDUCTION (OFFRES & AVANTAGES PARTENAIRES)
CREATE TABLE IF NOT EXISTS public.discount_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id TEXT,                                 -- Liaison optionnelle avec addresses ou sponsored_partners
    title TEXT NOT NULL,                             -- Nom du partenaire (ex: Le Bibent)
    subtitle TEXT,                                   -- Quartier ou spécialité (ex: Capitole • Brasserie Historique)
    category TEXT NOT NULL DEFAULT 'food',           -- 'food' | 'drinks' | 'shopping' | 'culture' | 'services'
    discount_value TEXT NOT NULL,                    -- Réduction (ex: '-20%', '1 Coupe Offerte')
    badge_label TEXT DEFAULT 'MEMBRE PETIT TOU',     -- Badge supérieur (ex: 'PRIVILÈGE VIP')
    description TEXT,                                -- Détail de l'offre
    terms TEXT DEFAULT 'Sur présentation de cette carte in-app au moment de l''addition. Valable 1 fois par visite.',
    max_uses INTEGER NOT NULL DEFAULT 5,             -- Nombre limite d'utilisations autorisées
    card_color_primary TEXT DEFAULT '#C52824',       -- Couleur de fond principale
    card_color_secondary TEXT DEFAULT '#8B1A17',     -- Couleur du dégradé
    visual_url TEXT,                                 -- Image de couverture HD
    is_active BOOLEAN NOT NULL DEFAULT true,
    valid_until TIMESTAMPTZ DEFAULT timezone('utc'::text, now() + interval '1 year'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. TABLE D'ATTRIBUTION DES CARTES PAR APPAREIL (COMPTEUR D'UTILISATIONS)
CREATE TABLE IF NOT EXISTS public.user_discount_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    discount_card_id UUID NOT NULL REFERENCES public.discount_cards(id) ON DELETE CASCADE,
    uses_count INTEGER NOT NULL DEFAULT 0,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_used_at TIMESTAMPTZ,

    CONSTRAINT unique_user_card UNIQUE (device_id, discount_card_id)
);

-- 4. TABLE D'HISTORIQUE DE TRAÇABILITÉ DES UTILISATIONS
CREATE TABLE IF NOT EXISTS public.discount_card_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    discount_card_id UUID NOT NULL REFERENCES public.discount_cards(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 5. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_discount_cards_active ON public.discount_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_user_discount_cards_device ON public.user_discount_cards(device_id);
CREATE INDEX IF NOT EXISTS idx_user_discount_cards_card ON public.user_discount_cards(discount_card_id);
CREATE INDEX IF NOT EXISTS idx_discount_card_uses_device ON public.discount_card_uses(device_id);
CREATE INDEX IF NOT EXISTS idx_discount_card_uses_date ON public.discount_card_uses(used_at DESC);

-- 6. RPC SERVEUR : CONSOMMER UNE UTILISATION DE CARTE (SÉCURITÉ ANTI-TRICHE)
CREATE OR REPLACE FUNCTION public.use_discount_card(
    p_device_id TEXT,
    p_card_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card RECORD;
    v_user_card RECORD;
    v_new_uses INTEGER := 0;
BEGIN
    p_device_id := trim(p_device_id);
    IF p_device_id = '' OR p_card_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PARAMETRES_INVALIDES');
    END IF;

    -- 1. Récupérer la carte et vérifier son statut actif
    SELECT * INTO v_card
    FROM public.discount_cards
    WHERE id = p_card_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'CARTE_INTROUVABLE_OU_EXPIREE');
    END IF;

    -- 2. Récupérer ou initialiser la carte utilisateur
    SELECT * INTO v_user_card
    FROM public.user_discount_cards
    WHERE device_id = p_device_id AND discount_card_id = p_card_id;

    IF NOT FOUND THEN
        INSERT INTO public.user_discount_cards (device_id, discount_card_id, uses_count)
        VALUES (p_device_id, p_card_id, 0)
        RETURNING * INTO v_user_card;
    END IF;

    -- 3. Vérifier que le quota maximal n'est pas dépassé
    IF v_user_card.uses_count >= v_card.max_uses THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'QUOTA_MAX_ATTEINT',
            'uses_count', v_user_card.uses_count,
            'max_uses', v_card.max_uses,
            'remaining_uses', 0
        );
    END IF;

    -- 4. Incrémenter le compteur de manière atomique
    UPDATE public.user_discount_cards
    SET uses_count = uses_count + 1,
        last_used_at = timezone('utc'::text, now())
    WHERE id = v_user_card.id
    RETURNING uses_count INTO v_new_uses;

    -- 5. Enregistrer la trace d'utilisation
    INSERT INTO public.discount_card_uses (device_id, discount_card_id)
    VALUES (p_device_id, p_card_id);

    RETURN jsonb_build_object(
        'success', true,
        'card_id', p_card_id,
        'title', v_card.title,
        'discount_value', v_card.discount_value,
        'uses_count', v_new_uses,
        'max_uses', v_card.max_uses,
        'remaining_uses', v_card.max_uses - v_new_uses,
        'used_at', timezone('utc'::text, now())
    );
END;
$$;

-- 7. RPC SERVEUR : PROGRESSION UTILISATEUR GLOBALE (AGRÉGATION 1 REQUÊTE)
CREATE OR REPLACE FUNCTION public.get_user_progress(
    p_device_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_places INTEGER := 790;
    v_discovered_count INTEGER := 0;
    v_total_points INTEGER := 0;
    v_recent_discoveries JSONB := '[]'::jsonb;
    v_active_cards_count INTEGER := 0;
BEGIN
    p_device_id := trim(p_device_id);

    -- Nombre total d'adresses réel en base
    SELECT COUNT(*) INTO v_total_places FROM public.addresses;
    IF v_total_places = 0 THEN v_total_places := 790; END IF;

    -- Découvertes de l'appareil
    SELECT COUNT(*), COALESCE(SUM(points_awarded), 0)
    INTO v_discovered_count, v_total_points
    FROM public.user_place_discoveries
    WHERE device_id = p_device_id;

    -- Dernières découvertes avec titres
    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_recent_discoveries
    FROM (
        SELECT d.place_id, a.title, d.points_awarded, d.created_at
        FROM public.user_place_discoveries d
        LEFT JOIN public.addresses a ON a.id::text = d.place_id
        WHERE d.device_id = p_device_id
        ORDER BY d.created_at DESC
        LIMIT 5
    ) sub;

    -- Nombre de cartes de réduction actives disponibles
    SELECT COUNT(*) INTO v_active_cards_count
    FROM public.discount_cards
    WHERE is_active = true;

    RETURN jsonb_build_object(
        'places_total', v_total_places,
        'places_discovered', v_discovered_count,
        'places_remaining', GREATEST(0, v_total_places - v_discovered_count),
        'total_points', v_total_points,
        'progress_percentage', ROUND((v_discovered_count::numeric / GREATEST(1, v_total_places)::numeric) * 100, 1),
        'active_cards_count', v_active_cards_count,
        'recent_discoveries', v_recent_discoveries
    );
END;
$$;

-- 8. SYNCHRONISATION FONCTION DISCOVER_PLACE UNIFIÉE
CREATE OR REPLACE FUNCTION public.discover_place(
    p_device_id TEXT,
    p_place_id TEXT,
    p_source TEXT DEFAULT 'manual_checkin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_already_discovered BOOLEAN;
    v_points INTEGER := 10;
    v_spot RECORD;
    v_total_points INTEGER := 0;
    v_total_discovered INTEGER := 0;
BEGIN
    p_device_id := trim(p_device_id);
    p_place_id := trim(p_place_id);

    IF p_device_id = '' OR p_place_id = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'PARAMETRES_INVALIDES');
    END IF;

    -- Déjà découvert ?
    SELECT EXISTS (
        SELECT 1 FROM public.user_place_discoveries
        WHERE device_id = p_device_id AND place_id = p_place_id
    ) INTO v_already_discovered;

    IF v_already_discovered THEN
        SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
        INTO v_total_points, v_total_discovered
        FROM public.user_place_discoveries
        WHERE device_id = p_device_id;

        RETURN jsonb_build_object(
            'success', true,
            'already_discovered', true,
            'points_earned', 0,
            'total_points', v_total_points,
            'total_discovered', v_total_discovered
        );
    END IF;

    -- Récupération des points configurés pour cette adresse
    BEGIN
        SELECT points_reward, is_recommended INTO v_spot
        FROM public.addresses
        WHERE id::text = p_place_id
        LIMIT 1;

        IF FOUND AND v_spot.points_reward IS NOT NULL THEN
            v_points := v_spot.points_reward;
        ELSIF FOUND AND v_spot.is_recommended IS TRUE THEN
            v_points := 25;
        ELSE
            v_points := 10;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        v_points := 10;
    END;

    -- Insertion atomique
    INSERT INTO public.user_place_discoveries (device_id, place_id, points_awarded, discovery_source)
    VALUES (p_device_id, p_place_id, v_points, p_source)
    ON CONFLICT (device_id, place_id) DO NOTHING;

    -- Totaux
    SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
    INTO v_total_points, v_total_discovered
    FROM public.user_place_discoveries
    WHERE device_id = p_device_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_discovered', false,
        'points_earned', v_points,
        'total_points', v_total_points,
        'total_discovered', v_total_discovered,
        'discovered_at', timezone('utc'::text, now())
    );
END;
$$;

-- 9. SÉCURITÉ RLS SUR TOUTES LES NOUVELLES TABLES
ALTER TABLE public.discount_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_discount_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_card_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des cartes de réduction" ON public.discount_cards;
CREATE POLICY "Lecture publique des cartes de réduction"
ON public.discount_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Lecture des utilisations de l'appareil" ON public.user_discount_cards;
CREATE POLICY "Lecture des utilisations de l'appareil"
ON public.user_discount_cards FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insertion des utilisations" ON public.user_discount_cards;
CREATE POLICY "Insertion des utilisations"
ON public.user_discount_cards FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture de l'historique des utilisations" ON public.discount_card_uses;
CREATE POLICY "Lecture de l'historique des utilisations"
ON public.discount_card_uses FOR SELECT USING (true);

-- Permissions d'exécution
GRANT ALL ON public.discount_cards TO anon, authenticated, service_role;
GRANT ALL ON public.user_discount_cards TO anon, authenticated, service_role;
GRANT ALL ON public.discount_card_uses TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_discount_card TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_progress TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.discover_place TO anon, authenticated, service_role;

-- 10. JEU DE DONNÉES INITIAL : 5 CARTES PRIVILÈGES OFFICIELLES LE PETIT TOU
INSERT INTO public.discount_cards (id, title, subtitle, category, discount_value, badge_label, description, terms, max_uses, card_color_primary, card_color_secondary, visual_url)
VALUES
(
    'a1111111-1111-1111-1111-111111111111',
    'Le Bibent',
    'Place du Capitole • Brasserie Historique',
    'food',
    '1 Coupe Offerte',
    'PRIVILÈGE CAPITOLE',
    'Une coupe de champagne de bienvenue offerte pour tout repas déjeunatoire ou dînatoire.',
    'Valable tous les jours midi et soir sur présentation de la carte in-app au serveur.',
    3,
    '#C52824',
    '#5C0F0C',
    'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800'
),
(
    'a2222222-2222-2222-2222-222222222222',
    'La Belle Brune',
    'Saint-Cyprien • Bistronomie Toulousaine',
    'food',
    '-15% ADDITION',
    'COUP DE CŒUR LPT',
    '-15% sur l''ensemble de l''addition hors formules du midi pour vous et votre table.',
    'Valable du mardi au samedi soir, jusqu''à 4 personnes par table.',
    5,
    '#0F172A',
    '#1E293B',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800'
),
(
    'a3333333-3333-3333-3333-333333333333',
    'Chez Magda',
    'Quartier des Carmes • Café de Spécialité',
    'drinks',
    'Pâtisserie Offerte',
    'PAUSE GOURMANDE',
    'Une délicieuse pâtisserie artisanale maison offerte pour toute boisson chaude commandée.',
    'Valable du mardi au dimanche de 9h à 18h.',
    5,
    '#E5A93B',
    '#B45309',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800'
),
(
    'a4444444-4444-4444-4444-444444444444',
    'Monsieur Georges',
    'Place Saint-Georges • Bar à Cocktails',
    'drinks',
    '-20% COCKTAILS',
    'HAPPY HOUR VIP',
    '-20% sur toute la carte des créations cocktails d''auteur de 18h à 21h.',
    'Valable du mercredi au samedi avant 21h sur présentation de la carte.',
    4,
    '#8B1A17',
    '#3B0A08',
    'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800'
),
(
    'a5555555-5555-5555-5555-555555555555',
    'La Maison du Vélo',
    'Canal du Midi • Mobilité & Balades',
    'services',
    '1H Vélo Offerte',
    'ÉVASION CANAL',
    '1 heure de location de vélo classique ou électrique offerte pour toute demi-journée.',
    'Valable toute l''année aux horaires d''ouverture du centre Canal du Midi.',
    2,
    '#059669',
    '#064E3B',
    'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'
)
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subtitle = EXCLUDED.subtitle,
    discount_value = EXCLUDED.discount_value,
    badge_label = EXCLUDED.badge_label,
    terms = EXCLUDED.terms,
    max_uses = EXCLUDED.max_uses,
    visual_url = EXCLUDED.visual_url;
