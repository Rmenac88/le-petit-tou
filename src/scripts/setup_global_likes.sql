-- ==============================================================================
-- LE PETIT TOU — COMPTEUR GLOBAL DE LIKES SANS COMPTE UTILISATEUR
-- ==============================================================================

-- 1. Table dédiée pour stocker le total des likes par spot
CREATE TABLE IF NOT EXISTS public.spot_likes (
    spot_id TEXT PRIMARY KEY,
    likes_count INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Active la sécurité Row Level Security
ALTER TABLE public.spot_likes ENABLE ROW LEVEL SECURITY;

-- Tout le monde (anonyme et authentifié) peut lire les compteurs de likes
DROP POLICY IF EXISTS "Lecture publique des likes" ON public.spot_likes;
CREATE POLICY "Lecture publique des likes"
    ON public.spot_likes FOR SELECT
    TO public
    USING (true);

-- Ajoute également la colonne likes_count à la table addresses si elle existe
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0;

-- 2. Procédure stockée RPC atomique pour incrémenter ou décrémenter (+1 ou -1)
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

    -- 1. Met à jour ou insère dans spot_likes
    INSERT INTO public.spot_likes (spot_id, likes_count, updated_at)
    VALUES (p_spot_id, GREATEST(0, p_delta), NOW())
    ON CONFLICT (spot_id)
    DO UPDATE SET 
        likes_count = GREATEST(0, public.spot_likes.likes_count + p_delta),
        updated_at = NOW()
    RETURNING likes_count INTO new_total;

    -- 2. Synchronise également sur la table addresses si présente
    UPDATE public.addresses
    SET likes_count = new_total
    WHERE id::TEXT = p_spot_id;

    RETURN new_total;
END;
$$;

-- 3. Autorise l'exécution de la fonction par n'importe quel visiteur anonyme de l'app
GRANT EXECUTE ON FUNCTION public.increment_spot_like(TEXT, INT) TO anon, authenticated, service_role, public;
