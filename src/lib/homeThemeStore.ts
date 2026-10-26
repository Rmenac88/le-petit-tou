import { supabase } from './supabase';
import { appCache } from './dataCache';
import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import { DEFAULT_THEME, THEME_SETTING_KEY, parseHomeTheme, type HomeTheme } from './homeThemeLogic';

/**
 * Thème de l'année côté appli : lecture publique du réglage, mémorisé localement pour que le bon thème s'affiche
 * dès le lancement (sans attendre le réseau) et reste là hors connexion.
 */

const CACHE_KEY = 'homeTheme';
const STORAGE_KEY = 'LPT_HOME_THEME_V1';
export const HOME_THEME_CHANGED_EVENT = 'pt_home_theme_changed';

/** Dernier thème connu (mémoire puis stockage local) ; thème d'origine par défaut. */
export async function loadStoredHomeTheme(): Promise<HomeTheme> {
  const cached = appCache.get<HomeTheme>(CACHE_KEY);
  if (cached) return cached;
  try {
    const raw = await appStorage.getItem(STORAGE_KEY);
    if (raw) {
      const theme = parseHomeTheme(JSON.parse(raw));
      appCache.set(CACHE_KEY, theme);
      return theme;
    }
  } catch {}
  return DEFAULT_THEME;
}

/** Thème frais depuis la base ; null si le réseau échoue (l'appelant garde ce qu'il affiche). Aucun réglage = thème d'origine. */
export async function fetchHomeTheme(): Promise<HomeTheme | null> {
  try {
    const { data, error } = await supabase.from('app_settings').select('value').eq('key', THEME_SETTING_KEY).maybeSingle();
    if (error) return null;
    const theme = parseHomeTheme(data?.value);
    appCache.set(CACHE_KEY, theme);
    appStorage.setItem(STORAGE_KEY, JSON.stringify(theme)).catch(() => {});
    return theme;
  } catch {
    return null;
  }
}

/** À appeler après une modification depuis le portail : l'accueil se met à jour tout de suite. */
export function announceHomeThemeChanged(): void {
  appCache.invalidate(CACHE_KEY);
  emitAppEvent(HOME_THEME_CHANGED_EVENT);
}
