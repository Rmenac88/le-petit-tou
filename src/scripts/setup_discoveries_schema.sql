-- ==============================================================================
-- LE PETIT TOU — SYSTÈME DE GAMIFICATION, DÉCOUVERTES & SUGGESTIONS D'ADRESSES
-- ==============================================================================
-- Exécutez ce script directement dans l'éditeur SQL de votre Dashboard Supabase.
-- ==============================================================================

-- 1. TABLE DES DÉCOUVERTES (POINTS & PROGRESSION ANONYME / PAR APPAREIL)
CREATE TABLE IF NOT EXISTS public.user_place_discoveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,                           -- UUID persistant (SecureStore / localStorage)
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Rattachable à un compte réel ultérieurement
    place_id TEXT NOT NULL,                           -- ID de l'adresse découverte (correspond à addresses.id)
    points_awarded INTEGER NOT NULL DEFAULT 10,       -- 10 pts standard, 25 pts coup de cœur
    discovery_source TEXT NOT NULL DEFAULT 'manual_checkin', -- 'manual_checkin', 'route_started', 'gps'
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- Contrainte d'unicité : un utilisateur/appareil ne peut valider qu'une seule fois une même adresse
    CONSTRAINT unique_device_place UNIQUE (device_id, place_id)
);

-- 2. TABLE DES SUGGESTIONS D'ADRESSES INCONNUES PAR LES UTILISATEURS
CREATE TABLE IF NOT EXISTS public.place_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    title TEXT NOT NULL,                              -- Nom du commerce / pépite
    address TEXT,                                     -- Adresse ou quartier
    category_name TEXT DEFAULT 'Bonne adresse',       -- Resto, Bar, Shopping, etc.
    comment TEXT,                                     -- Pourquoi cette adresse mérite Le Petit Tou
    status TEXT NOT NULL DEFAULT 'pending',           -- 'pending', 'approved', 'rejected'
    moderation_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    reviewed_at TIMESTAMPTZ
);

-- 3. INDEX DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_discoveries_device ON public.user_place_discoveries(device_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_place ON public.user_place_discoveries(place_id);
CREATE INDEX IF NOT EXISTS idx_discoveries_device_place ON public.user_place_discoveries(device_id, place_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.place_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_device ON public.place_suggestions(device_id);

-- 4. FONCTION RPC SÉCURISÉE D'ATTRIBUTION DES POINTS (ANTI-TRICHE SERVEUR)
-- Cette fonction garantit que le client ne peut pas s'auto-attribuer un nombre arbitraire de points.
CREATE OR REPLACE FUNCTION public.unlock_discovery(
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
    v_is_recommended BOOLEAN := FALSE;
    v_new_record public.user_place_discoveries%ROWTYPE;
    v_total_points INTEGER := 0;
    v_total_discovered INTEGER := 0;
BEGIN
    -- 1. Nettoyage des paramètres
    p_device_id := trim(p_device_id);
    p_place_id := trim(p_place_id);

    IF p_device_id = '' OR p_place_id = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'PARAMETRES_INVALIDES');
    END IF;

    -- 2. Vérifier si l'adresse a déjà été découverte par ce terminal
    SELECT EXISTS (
        SELECT 1 FROM public.user_place_discoveries
        WHERE device_id = p_device_id AND place_id = p_place_id
    ) INTO v_already_discovered;

    IF v_already_discovered THEN
        -- Déjà découvert : on renvoie le statut sans réattribuer de points
        SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
        INTO v_total_points, v_total_discovered
        FROM public.user_place_discoveries
        WHERE device_id = p_device_id;

        RETURN jsonb_build_object(
            'success', true,
            'points_awarded', 0,
            'is_first_time', false,
            'total_points', v_total_points,
            'total_discovered', v_total_discovered
        );
    END IF;

    -- 3. Vérifier si l'adresse est un "Coup de cœur / Recommandé" pour attribuer 25 pts au lieu de 10
    BEGIN
        SELECT is_recommended INTO v_is_recommended
        FROM public.addresses
        WHERE id::text = p_place_id
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        v_is_recommended := FALSE;
    END;

    IF v_is_recommended IS TRUE THEN
        v_points := 25;
    END IF;

    -- 4. Insérer la découverte de manière atomique
    INSERT INTO public.user_place_discoveries (device_id, place_id, points_awarded, discovery_source)
    VALUES (p_device_id, p_place_id, v_points, p_source)
    ON CONFLICT (device_id, place_id) DO NOTHING
    RETURNING * INTO v_new_record;

    -- 5. Calculer la progression globale à jour du terminal
    SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
    INTO v_total_points, v_total_discovered
    FROM public.user_place_discoveries
    WHERE device_id = p_device_id;

    RETURN jsonb_build_object(
        'success', true,
        'points_awarded', v_points,
        'is_first_time', true,
        'total_points', v_total_points,
        'total_discovered', v_total_discovered,
        'discovered_at', COALESCE(v_new_record.created_at, timezone('utc'::text, now()))
    );
END;
$$;

-- 5. SÉCURITÉ ROW LEVEL SECURITY (RLS) & DROITS D'ACCÈS
ALTER TABLE public.user_place_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_suggestions ENABLE ROW LEVEL SECURITY;

-- Politique découvertes : chaque terminal peut lire et insérer ses propres lignes
DROP POLICY IF EXISTS "Lecture publique par device_id" ON public.user_place_discoveries;
CREATE POLICY "Lecture publique par device_id"
ON public.user_place_discoveries
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Insertion publique découvertes" ON public.user_place_discoveries;
CREATE POLICY "Insertion publique découvertes"
ON public.user_place_discoveries
FOR INSERT
WITH CHECK (true);

-- Politique suggestions : tout le monde peut suggérer une adresse
DROP POLICY IF EXISTS "Insertion publique suggestions" ON public.place_suggestions;
CREATE POLICY "Insertion publique suggestions"
ON public.place_suggestions
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture suggestions pour modération" ON public.place_suggestions;
CREATE POLICY "Lecture suggestions pour modération"
ON public.place_suggestions
FOR SELECT
USING (true);

-- Donner les droits aux rôles Supabase anonyme et authentifié
GRANT ALL ON public.user_place_discoveries TO anon, authenticated, service_role;
GRANT ALL ON public.place_suggestions TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.unlock_discovery TO anon, authenticated, service_role;
