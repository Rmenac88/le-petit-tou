import { supabase } from './supabase';
import { appCache } from './dataCache';
import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import { BACKGROUND_SETTING_KEY, GALAXY, parseHomeBackground, type HomeBackground } from './homeBackgroundLogic';

/**
 * Fond d'accueil côté appli : lecture publique du réglage, mémorisé localement pour que le bon fond s'affiche
 * dès le lancement (sans attendre le réseau) et reste là hors connexion.
 */

const CACHE_KEY = 'homeBackground';
const STORAGE_KEY = 'LPT_HOME_BG_V1';
export const HOME_BACKGROUND_CHANGED_EVENT = 'pt_home_background_changed';

/** Dernier réglage connu (mémoire puis stockage local) ; Galaxy par défaut. */
export async function loadStoredHomeBackground(): Promise<HomeBackground> {
  const cached = appCache.get<HomeBackground>(CACHE_KEY);
  if (cached) return cached;
  try {
    const raw = await appStorage.getItem(STORAGE_KEY);
    if (raw) {
      const bg = parseHomeBackground(JSON.parse(raw));
      appCache.set(CACHE_KEY, bg);
      return bg;
    }
  } catch {}
  return GALAXY;
}

/** Réglage frais depuis la base ; null si le réseau échoue (l'appelant garde ce qu'il affiche). */
export async function fetchHomeBackground(): Promise<HomeBackground | null> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', BACKGROUND_SETTING_KEY)
      .maybeSingle();
    if (error) return null;
    const bg = parseHomeBackground(data?.value);
    appCache.set(CACHE_KEY, bg);
    appStorage.setItem(STORAGE_KEY, JSON.stringify(bg)).catch(() => {});
    return bg;
  } catch {
    return null;
  }
}

/** À appeler après une modification depuis le portail : l'accueil se met à jour tout de suite. */
export function announceHomeBackgroundChanged(): void {
  appCache.invalidate(CACHE_KEY);
  emitAppEvent(HOME_BACKGROUND_CHANGED_EVENT);
}
