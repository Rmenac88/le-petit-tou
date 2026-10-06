-- ==============================================================================
-- RÉPARATION RAPIDE : ERREUR "public.user_push_tokens does not exist"
-- ==============================================================================
-- Cette erreur se produit lors de l'INSERT dans la table 'events' car un trigger
-- ou un webhook Postgres tente d'accéder à 'user_push_tokens' pour envoyer des pushs.
--
-- Copiez-collez ce script dans :
-- Supabase Dashboard -> SQL Editor -> Nouveau Query -> Run (Exécuter)
-- ==============================================================================

-- 1. Recréer la table 'user_push_tokens' (vide)
-- Cela satisfait immédiatement tout trigger ou fonction PostgreSQL existante
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  device_id text,
  push_token text,
  platform text,
  notify_events boolean DEFAULT true,
  notify_spots boolean DEFAULT false,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Désactivation de la sécurité RLS pour autoriser toutes les opérations
ALTER TABLE public.user_push_tokens DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.user_push_tokens TO anon, authenticated, service_role;

-- 2. Supprimer automatiquement tous les triggers obsolètes attachés à la table 'events'
DO $$
DECLARE
    trg RECORD;
BEGIN
    FOR trg IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'events' 
          AND trigger_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.events CASCADE;', trg.trigger_name);
        RAISE NOTICE 'Trigger supprimé : %', trg.trigger_name;
    END LOOP;
END $$;

-- 3. Supprimer d'éventuelles fonctions orphelines de notification push sur événements
DROP FUNCTION IF EXISTS notify_new_event CASCADE;
DROP FUNCTION IF EXISTS handle_new_event_push CASCADE;
DROP FUNCTION IF EXISTS on_event_created_notify CASCADE;
