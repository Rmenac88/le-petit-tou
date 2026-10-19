/**
 * Logique pure des notifications (sans React Native) : testable avec node:test.
 */

export type AppTab = 'home' | 'search' | 'map' | 'cards' | 'agenda';

export interface PushPreferences {
  notify_events: boolean;
  notify_agenda: boolean;
  notify_new_spots: boolean;
}

/** Valeurs proposées à l'activation : événements et agenda oui ; nouvelles adresses sur demande (limite le spam). */
export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  notify_events: true,
  notify_agenda: true,
  notify_new_spots: false,
};

const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;
const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function isValidExpoPushToken(token: unknown): token is string {
  return typeof token === 'string' && EXPO_TOKEN.test(token);
}

export interface NotificationTarget {
  tab: AppTab;
  /** Adresse à ouvrir sur la carte. */
  spotId?: string;
}

/**
 * Écran à ouvrir quand l'utilisateur touche une notification.
 * Le contenu vient du serveur mais est traité comme non fiable : type connu et identifiant au format sûr, sinon accueil.
 */
export function targetForNotification(data: unknown): NotificationTarget {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  switch (d.kind) {
    case 'agenda':
      return { tab: 'agenda' };
    case 'new_spot':
      return typeof d.id === 'string' && SAFE_ID.test(d.id) ? { tab: 'map', spotId: d.id } : { tab: 'home' };
    case 'event':
    case 'announcement':
    default:
      return { tab: 'home' };
  }
}

export type PermissionOutcome = 'granted' | 'can_ask' | 'blocked';

/** Résume l'état de permission du système en trois cas exploitables par l'écran. */
export function permissionOutcome(status: { granted?: boolean; canAskAgain?: boolean } | null | undefined): PermissionOutcome {
  if (status?.granted) return 'granted';
  if (status?.canAskAgain === false) return 'blocked';
  return 'can_ask';
}

export type EnableFailure = 'unsupported' | 'permission_denied' | 'no_project' | 'token_error' | 'server_error';

export const ENABLE_FAILURE_MESSAGES: Record<EnableFailure, string> = {
  unsupported: 'Les notifications ne sont disponibles que sur un téléphone (pas sur le web ni un simulateur).',
  permission_denied: "Les notifications sont refusées dans les réglages de votre téléphone. Autorisez-les puis réessayez.",
  no_project: "Les notifications ne sont pas encore configurées pour cette version de l'application.",
  token_error: "Impossible d'activer les notifications pour le moment. Réessayez dans un instant.",
  server_error: "Le serveur n'a pas pu enregistrer votre choix. Réessayez avec une connexion stable.",
};
