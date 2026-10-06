-- ==============================================================================
-- LE PETIT TOU — SCRIPT DE SÉCURISATION RLS & CONFORMITÉ STORE / RGPD
-- ==============================================================================

-- 1. Table des rôles administrateurs
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active RLS sur admin_users
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture des admins restreinte"
    ON public.admin_users FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

-- 2. Fonction RPC sécurisée pour vérifier un code admin sans l'exposer dans le bundle
CREATE OR REPLACE FUNCTION public.verify_admin_access(access_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF access_code IS NULL OR length(trim(access_code)) = 0 THEN
        RETURN FALSE;
    END IF;

    -- Vérification directe par rôle utilisateur si authentifié
    IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()) THEN
        RETURN TRUE;
    END IF;

    -- Comparaison sécurisée côté serveur (Clé maître unique ultra-sécurisée)
    IF trim(access_code) = 'LPT#2026_Xk9!v7Qm-Z8t*Toulouse' THEN
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$;

-- 3. Activation de RLS sur toutes les tables de contenu
ALTER TABLE IF EXISTS public.addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sponsored_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 4. Politiques de lecture publique (Les visiteurs de l'application peuvent tout consulter)
DROP POLICY IF EXISTS "Lecture publique des adresses" ON public.addresses;
CREATE POLICY "Lecture publique des adresses"
    ON public.addresses FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Lecture publique des categories" ON public.categories;
CREATE POLICY "Lecture publique des categories"
    ON public.categories FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Lecture publique des evenements" ON public.events;
CREATE POLICY "Lecture publique des evenements"
    ON public.events FOR SELECT
    TO public
    USING (true);

DROP POLICY IF EXISTS "Lecture publique des partenaires" ON public.sponsored_partners;
CREATE POLICY "Lecture publique des partenaires"
    ON public.sponsored_partners FOR SELECT
    TO public
    USING (true);

-- 5. Politiques d'écriture et modification : réservées aux administrateurs vérifiés
DROP POLICY IF EXISTS "Gestion des adresses reservee admin" ON public.addresses;
CREATE POLICY "Gestion des adresses reservee admin"
    ON public.addresses FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'service_role'
    );

DROP POLICY IF EXISTS "Gestion des categories reservee admin" ON public.categories;
CREATE POLICY "Gestion des categories reservee admin"
    ON public.categories FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'service_role'
    );

DROP POLICY IF EXISTS "Gestion des evenements reservee admin" ON public.events;
CREATE POLICY "Gestion des evenements reservee admin"
    ON public.events FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'service_role'
    );

DROP POLICY IF EXISTS "Gestion des partenaires reservee admin" ON public.sponsored_partners;
CREATE POLICY "Gestion des partenaires reservee admin"
    ON public.sponsored_partners FOR ALL
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid())
        OR auth.jwt() ->> 'role' = 'service_role'
    );

-- 6. Politiques RGPD pour les réservations (l'utilisateur ne voit et ne modifie que ses propres billets)
DROP POLICY IF EXISTS "Lecture de ses propres billets" ON public.event_registrations;
CREATE POLICY "Lecture de ses propres billets"
    ON public.event_registrations FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Creation de ses propres billets" ON public.event_registrations;
CREATE POLICY "Creation de ses propres billets"
    ON public.event_registrations FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Suppression de ses propres billets" ON public.event_registrations;
CREATE POLICY "Suppression de ses propres billets"
    ON public.event_registrations FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 7. Fonction RPC de suppression de compte utilisateur (Conformité Apple Guideline 5.1.1(v) & RGPD Art. 17)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    target_user_id UUID;
BEGIN
    target_user_id := auth.uid();
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Non authentifié';
    END IF;

    -- Supprime les données associées de l'utilisateur
    DELETE FROM public.event_registrations WHERE user_id = target_user_id;
    DELETE FROM public.user_push_tokens WHERE user_id = target_user_id;
    DELETE FROM public.admin_users WHERE id = target_user_id;

    -- Supprime le compte de auth.users
    DELETE FROM auth.users WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_access(TEXT) TO anon, authenticated;

-- 8. Table et fonction pour les likes globaux sans compte
CREATE TABLE IF NOT EXISTS public.spot_likes (
    spot_id TEXT PRIMARY KEY,
    likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.spot_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique des likes" ON public.spot_likes;
CREATE POLICY "Lecture publique des likes"
    ON public.spot_likes FOR SELECT
    TO public
    USING (true);

ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_spot_like(p_spot_id TEXT, p_delta INT DEFAULT 1)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_total INTEGER;
BEGIN
    IF p_spot_id IS NULL OR length(trim(p_spot_id)) = 0 THEN
        RETURN 0;
    END IF;

    INSERT INTO public.spot_likes (spot_id, likes_count, updated_at)
    VALUES (p_spot_id, GREATEST(0, p_delta), NOW())
    ON CONFLICT (spot_id)
    DO UPDATE SET 
        likes_count = GREATEST(0, public.spot_likes.likes_count + p_delta),
        updated_at = NOW()
    RETURNING likes_count INTO new_total;

    UPDATE public.addresses
    SET likes_count = new_total
    WHERE id::TEXT = p_spot_id;

    RETURN new_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_spot_like(TEXT, INT) TO anon, authenticated, service_role, public;
