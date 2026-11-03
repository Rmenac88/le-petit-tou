import { supabase } from './supabase';
import { appCache } from './dataCache';
import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import { DEFAULT_TOURISM_URL, TOURISM_SETTING_KEY, parseTourismBanner } from './tourismBannerLogic';

/**
 * Lien de la bannière « Office de tourisme » côté appli : lecture publique du réglage, mémorisé localement pour que le bon
 * lien soit prêt dès le lancement et hors connexion. Sans réglage : l'agenda officiel.
 */

const CACHE_KEY = 'tourismBanner';
const STORAGE_KEY = 'LPT_TOURISM_BANNER_V1';
export const TOURISM_BANNER_CHANGED_EVENT = 'pt_tourism_banner_changed';

/** Dernier lien connu (mémoire puis stockage local) ; agenda officiel par défaut. */
export async function loadStoredTourismUrl(): Promise<string> {
  const cached = appCache.get<string>(CACHE_KEY);
  if (cached) return cached;
  try {
    const raw = await appStorage.getItem(STORAGE_KEY);
    if (raw) {
      const url = parseTourismBanner({ url: raw });
      appCache.set(CACHE_KEY, url);
      return url;
    }
  } catch {}
  return DEFAULT_TOURISM_URL;
}

/** Lien frais depuis la base ; null si le réseau échoue (l'appelant garde ce qu'il affiche). Aucun réglage = lien par défaut. */
export async function fetchTourismUrl(): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', TOURISM_SETTING_KEY).maybeSingle();
    if (error) return null;
    const url = parseTourismBanner(data?.value);
    appCache.set(CACHE_KEY, url);
    appStorage.setItem(STORAGE_KEY, url).catch(() => {});
    return url;
  } catch {
    return null;
  }
}

/** À appeler après une modification depuis le portail : l'accueil se met à jour tout de suite. */
export function announceTourismBannerChanged(): void {
  appCache.invalidate(CACHE_KEY);
  emitAppEvent(TOURISM_BANNER_CHANGED_EVENT);
}
