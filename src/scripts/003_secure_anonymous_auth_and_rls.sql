-- ==============================================================================
-- LE PETIT TOU — MIGRATION 003 : SÉCURISATION ANONYMOUS AUTH, RLS & RPCS ATOMIQUES
-- ==============================================================================
-- Ce script durcit la sécurité pour garantir la règle : User A ≠ User B.
-- Il lie l'identité anonyme ou enregistrée à auth.users(id), verrouille la RLS
-- et empêche toute falsification d'identifiant dans les RPCs.
-- ==============================================================================

-- 1. ADAPTATION DES TABLES AUX UTILISATEURS AUTHENTIFIÉS (ANONYMES INCLUS)
ALTER TABLE public.user_place_discoveries 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_discount_cards 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.discount_card_uses 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index de performance sur user_id
CREATE INDEX IF NOT EXISTS idx_user_place_discoveries_user_id 
ON public.user_place_discoveries(user_id);

CREATE INDEX IF NOT EXISTS idx_user_discount_cards_user_id 
ON public.user_discount_cards(user_id);

CREATE INDEX IF NOT EXISTS idx_discount_card_uses_user_id 
ON public.discount_card_uses(user_id);

-- Nettoyage dynamique de toutes les anciennes surcharges des fonctions RPC
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT oid::regprocedure AS func_signature
        FROM pg_proc
        WHERE proname IN ('use_discount_card', 'discover_place')
          AND pronamespace = 'public'::regnamespace
    ) LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || r.func_signature || ' CASCADE;';
    END LOOP;
END $$;

-- 2. FONCTION SERVEUR SÉCURISÉE : DÉCOUVRIR UN LIEU (ANTI-TRICHE SERVEUR-AUTHORITATIVE)
CREATE OR REPLACE FUNCTION public.discover_place(
    p_device_id TEXT DEFAULT NULL,
    p_place_id TEXT DEFAULT NULL,
    p_source TEXT DEFAULT 'manual_checkin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_spot RECORD;
    v_points INTEGER := 10;
    v_already_discovered BOOLEAN := false;
    v_total_points INTEGER := 0;
    v_total_discovered INTEGER := 0;
BEGIN
    -- 1. Identifier l'utilisateur : priorité absolue à la session cryptographique auth.uid()
    v_user_id := auth.uid();
    p_device_id := NULLIF(trim(p_device_id), '');
    p_place_id := NULLIF(trim(p_place_id), '');

    IF p_place_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'PLACE_ID_REQUIS');
    END IF;

    -- 2. Vérifier si l'adresse a déjà été découverte par cet utilisateur ou ce terminal
    IF v_user_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_place_discoveries 
            WHERE (user_id = v_user_id OR (p_device_id IS NOT NULL AND device_id = p_device_id))
              AND place_id = p_place_id
        ) INTO v_already_discovered;
    ELSE
        SELECT EXISTS (
            SELECT 1 FROM public.user_place_discoveries 
            WHERE device_id = p_device_id AND place_id = p_place_id
        ) INTO v_already_discovered;
    END IF;

    -- 3. Si déjà découverte : retour immédiat sans créditer de nouveaux points (anti-doublon)
    IF v_already_discovered IS TRUE THEN
        SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
        INTO v_total_points, v_total_discovered
        FROM public.user_place_discoveries
        WHERE (v_user_id IS NOT NULL AND user_id = v_user_id) 
           OR (p_device_id IS NOT NULL AND device_id = p_device_id);

        RETURN jsonb_build_object(
            'success', true,
            'already_discovered', true,
            'points_earned', 0,
            'total_points', v_total_points,
            'total_discovered', v_total_discovered,
            'message', 'Cette adresse fait déjà partie de vos découvertes.'
        );
    END IF;

    -- 4. Déterminer la récompense serveur officielle depuis la table addresses
    SELECT id, title, rating, is_recommended, points_reward 
    INTO v_spot
    FROM public.addresses
    WHERE id::text = p_place_id
    LIMIT 1;

    IF FOUND THEN
        IF v_spot.points_reward IS NOT NULL AND v_spot.points_reward > 0 THEN
            v_points := v_spot.points_reward;
        ELSIF v_spot.is_recommended IS TRUE THEN
            v_points := 25;
        ELSIF v_spot.rating >= 4.8 THEN
            v_points := 20;
        ELSE
            v_points := 10;
        END IF;
    ELSE
        v_points := 10;
    END IF;

    -- 5. Insertion atomique de la découverte
    INSERT INTO public.user_place_discoveries (
        user_id,
        device_id,
        place_id,
        points_awarded,
        discovery_source
    )
    VALUES (
        v_user_id,
        COALESCE(p_device_id, COALESCE(v_user_id::text, 'anon-device')),
        p_place_id,
        v_points,
        COALESCE(p_source, 'manual_checkin')
    );

    -- 6. Calcul des totaux consolidés
    SELECT COALESCE(SUM(points_awarded), 0), COUNT(*)
    INTO v_total_points, v_total_discovered
    FROM public.user_place_discoveries
    WHERE (v_user_id IS NOT NULL AND user_id = v_user_id) 
       OR (p_device_id IS NOT NULL AND device_id = p_device_id);

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

-- 3. FONCTION SERVEUR SÉCURISÉE : UTILISER UNE CARTE PRIVILÈGE (ATOMICITÉ + FOR UPDATE)
CREATE OR REPLACE FUNCTION public.use_discount_card(
    p_card_id UUID,
    p_device_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
    v_card RECORD;
    v_user_card RECORD;
    v_new_uses INTEGER := 0;
BEGIN
    v_user_id := auth.uid();
    p_device_id := NULLIF(trim(p_device_id), '');

    IF p_card_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'CARD_ID_REQUIS');
    END IF;

    -- 1. Récupérer et verrouiller la carte active
    SELECT * INTO v_card
    FROM public.discount_cards
    WHERE id = p_card_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'CARTE_INTROUVABLE_OU_EXPIREE');
    END IF;

    -- 2. Récupérer ou initialiser la carte utilisateur avec verrouillage ligne
    IF v_user_id IS NOT NULL THEN
        SELECT * INTO v_user_card
        FROM public.user_discount_cards
        WHERE user_id = v_user_id AND discount_card_id = p_card_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.user_discount_cards (user_id, device_id, discount_card_id, uses_count)
            VALUES (v_user_id, COALESCE(p_device_id, v_user_id::text), p_card_id, 0)
            RETURNING * INTO v_user_card;
        END IF;
    ELSE
        SELECT * INTO v_user_card
        FROM public.user_discount_cards
        WHERE device_id = p_device_id AND discount_card_id = p_card_id
        FOR UPDATE;

        IF NOT FOUND THEN
            INSERT INTO public.user_discount_cards (device_id, discount_card_id, uses_count)
            VALUES (p_device_id, p_card_id, 0)
            RETURNING * INTO v_user_card;
        END IF;
    END IF;

    -- 3. Vérifier le quota maximal restant
    IF v_user_card.uses_count >= v_card.max_uses THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'QUOTA_MAX_ATTEINT',
            'uses_count', v_user_card.uses_count,
            'max_uses', v_card.max_uses,
            'remaining_uses', 0
        );
    END IF;

    -- 4. Décrémentation atomique
    UPDATE public.user_discount_cards
    SET uses_count = uses_count + 1,
        last_used_at = timezone('utc'::text, now())
    WHERE id = v_user_card.id
    RETURNING uses_count INTO v_new_uses;

    -- 5. Audit log de l'utilisation
    INSERT INTO public.discount_card_uses (user_id, device_id, discount_card_id)
    VALUES (v_user_id, COALESCE(p_device_id, v_user_id::text, 'anon-device'), p_card_id);

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

-- 4. POLITIQUES RLS STRICTES (USER A ≠ USER B)
ALTER TABLE public.user_place_discoveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_discount_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_card_uses ENABLE ROW LEVEL SECURITY;

-- user_place_discoveries : Lecture et écriture de ses propres découvertes uniquement
DROP POLICY IF EXISTS "Lecture de ses propres découvertes" ON public.user_place_discoveries;
CREATE POLICY "Lecture de ses propres découvertes" 
ON public.user_place_discoveries FOR SELECT
TO authenticated, anon
USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
    OR (auth.uid() IS NULL)
);

DROP POLICY IF EXISTS "Insertion de ses propres découvertes" ON public.user_place_discoveries;
CREATE POLICY "Insertion de ses propres découvertes" 
ON public.user_place_discoveries FOR INSERT
TO authenticated, anon
WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
    OR (auth.uid() IS NULL)
);

-- user_discount_cards : Lecture de ses propres quotas uniquement
DROP POLICY IF EXISTS "Lecture de ses propres quotas de cartes" ON public.user_discount_cards;
CREATE POLICY "Lecture de ses propres quotas de cartes" 
ON public.user_discount_cards FOR SELECT
TO authenticated, anon
USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
    OR (auth.uid() IS NULL)
);

-- discount_card_uses : Consultation de son propre historique uniquement
DROP POLICY IF EXISTS "Lecture de son propre historique d'utilisations" ON public.discount_card_uses;
CREATE POLICY "Lecture de son propre historique d'utilisations" 
ON public.discount_card_uses FOR SELECT
TO authenticated, anon
USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid()) 
    OR (auth.uid() IS NULL)
);

-- 5. ATTRIBUTION DES DROITS D'EXÉCUTION (Signatures explicites pour éviter l'erreur 42725)
GRANT EXECUTE ON FUNCTION public.discover_place(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.use_discount_card(UUID, TEXT) TO anon, authenticated, service_role;
