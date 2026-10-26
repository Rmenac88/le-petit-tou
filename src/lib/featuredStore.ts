import { supabase } from './supabase';
import { appCache } from './dataCache';
import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import type { FeaturedRow } from './featuredLogic';

/**
 * Chouchous du Petit Tou côté appli : lecture publique (le serveur ne renvoie que les lignes en cours) avec
 * mémoire locale, pour que la section s'affiche aussitôt au lancement et reste là hors connexion.
 */

const CACHE_KEY = 'featuredSpots';
const STORAGE_KEY = 'LPT_FEATURED_V1';
export const FEATURED_CHANGED_EVENT = 'pt_featured_changed';

function sanitize(rows: unknown): FeaturedRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r: any) => r && typeof r.id === 'string' && typeof r.spot_id === 'string')
    .map((r: any) => ({
      id: r.id,
      spot_id: r.spot_id,
      position: Number(r.position) || 0,
      label: typeof r.label === 'string' ? r.label : null,
      starts_on: typeof r.starts_on === 'string' ? r.starts_on : null,
      ends_on: typeof r.ends_on === 'string' ? r.ends_on : null,
      is_active: r.is_active !== false,
    }));
}

/** Dernière liste connue (mémoire puis stockage local) : instantané, sans réseau. */
export async function loadStoredFeatured(): Promise<FeaturedRow[]> {
  const cached = appCache.get<FeaturedRow[]>(CACHE_KEY);
  if (cached) return cached;
  try {
    const raw = await appStorage.getItem(STORAGE_KEY);
    if (raw) {
      const rows = sanitize(JSON.parse(raw));
      appCache.set(CACHE_KEY, rows);
      return rows;
    }
  } catch {}
  return [];
}

/** Liste fraîche depuis la base ; en cas d'échec réseau, renvoie null (l'appelant garde ce qu'il affiche). */
export async function fetchFeatured(): Promise<FeaturedRow[] | null> {
  try {
    const { data, error } = await supabase
      .from('featured_spots')
      .select('id, spot_id, position, label, starts_on, ends_on, is_active')
      .order('position', { ascending: true });
    if (error) return null;
    const rows = sanitize(data);
    appCache.set(CACHE_KEY, rows);
    appStorage.setItem(STORAGE_KEY, JSON.stringify(rows)).catch(() => {});
    return rows;
  } catch {
    return null;
  }
}

/** À appeler après une modification depuis le portail : l'accueil se rafraîchit sans redémarrer. */
export function announceFeaturedChanged(): void {
  appCache.invalidate(CACHE_KEY);
  emitAppEvent(FEATURED_CHANGED_EVENT);
}
