import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { withTimeout } from './fetchWithTimeout';

/** Délai maximal d'une requête vers la base : au-delà, l'appli bascule sur ses données locales. */
const REQUEST_TIMEOUT_MS = 10_000;
/** Les envois de fichiers (photos du portail admin) sont plus longs : délai séparé. */
const UPLOAD_TIMEOUT_MS = 60_000;

const quickFetch = withTimeout((...args) => fetch(...args), REQUEST_TIMEOUT_MS);
const uploadFetch = withTimeout((...args) => fetch(...args), UPLOAD_TIMEOUT_MS);
const supabaseFetch: typeof fetch = (input, init) =>
  (String(typeof input === 'string' ? input : (input as any)?.url ?? input).includes('/storage/v1/')
    ? uploadFetch
    : quickFetch)(input, init);

export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 
  'https://ckesvawakxblsuhmzaeo.supabase.co';

const SUPABASE_ANON_KEY = 
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNrZXN2YXdha3hibHN1aG16YWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3NDAyMjQsImV4cCI6MjA5ODMxNjIyNH0.62JRaNiBqmrt1zEvsJUHjJf6FQ_4NGjxaynLBbxylOI';

/** Vrai dès que l'URL et la clé publique sont connues (variables d'environnement ou valeurs de repli ci-dessus). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Aucune session de connexion n'est utilisée (pas de compte : l'identifiant d'appareil suffit). La bibliothèque
 * relisait pourtant la « session » dans le coffre chiffré AVANT CHAQUE requête, une par une : sur Android, plusieurs
 * secondes d'attente au démarrage et à l'ouverture de chaque écran. La session vit désormais en mémoire seulement.
 */
const memorySession = new Map<string, string>();
const MemoryAuthStorage = {
  getItem: (key: string) => memorySession.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memorySession.set(key, value);
  },
  removeItem: (key: string) => {
    memorySession.delete(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: supabaseFetch },
  auth: {
    storage: MemoryAuthStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});


