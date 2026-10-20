/**
 * Logique pure des notifications (sans React ni Expo), testée avec node --test.
 *
 * Règles de la marque :
 *  - tout est facultatif : rien n'est envoyé sans accord explicite de la personne ;
 *  - deux catégories seulement : les événements de l'association et les nouvelles adresses ;
 *  - jamais de notification publicitaire d'un partenaire payant.
 */

export interface NotificationPrefs {
  events: boolean;
  spots: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = { events: true, spots: false };

export function parsePrefs(raw: string | null | undefined): NotificationPrefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { ...DEFAULT_PREFS };
    return {
      events: typeof value.events === 'boolean' ? value.events : DEFAULT_PREFS.events,
      spots: typeof value.spots === 'boolean' ? value.spots : DEFAULT_PREFS.spots,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** Jeton d'envoi Expo : « ExponentPushToken[…] » ou « ExpoPushToken[…] ». */
export function isValidExpoPushToken(token: string | null | undefined): boolean {
  return typeof token === 'string' && /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

/** Identifiant de projet EAS (nécessaire pour obtenir un jeton), lu dans `extra`. */
export function resolveProjectId(extra: any): string | null {
  const id = extra?.eas?.projectId;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export type PushAvailability = 'unsupported' | 'missing-project' | 'ready';

/** Les notifications ne fonctionnent que sur l'appli installée et avec un projet EAS configuré. */
export function pushAvailability(platform: string, projectId: string | null): PushAvailability {
  if (platform === 'web') return 'unsupported';
  return projectId ? 'ready' : 'missing-project';
}
