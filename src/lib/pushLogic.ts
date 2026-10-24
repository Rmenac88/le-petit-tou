/**
 * Logique pure des notifications (sans React Native) : testable avec node:test.
 */

export type AppTab = 'home' | 'search' | 'map' | 'cards' | 'agenda';

/** Couleur d'accent des notifications Android (même valeur que le plugin expo-notifications dans app.json). */
export const NOTIFICATION_ACCENT = '#E84A5F';

export const NOTIFICATION_CHANNEL_GROUP = { id: 'lpt', name: 'Le Petit Tou' } as const;

export interface NotificationChannelSpec {
  /** Identifiant Android : DOIT correspondre à public._push_style() dans la migration 010 (un test le vérifie). */
  id: string;
  name: string;
  description: string;
  importance: 'default' | 'high';
}

/**
 * Canaux Android (visibles dans les réglages du téléphone, un par type de message). Une fois créé, un canal ne
 * peut plus changer d'importance : ces valeurs sont donc définitives. « default » reçoit les anciens messages.
 */
export const NOTIFICATION_CHANNELS: readonly NotificationChannelSpec[] = [
  { id: 'default', name: 'Le Petit Tou', description: 'Messages du Petit Tou.', importance: 'default' },
  { id: 'lpt-events', name: 'Événements', description: 'Un nouvel événement de l’association est publié.', importance: 'default' },
  { id: 'lpt-agenda', name: 'Agenda des partenaires', description: 'Une nouvelle date est ajoutée à l’agenda.', importance: 'default' },
  { id: 'lpt-new-spots', name: 'Nouvelles adresses', description: 'Des adresses viennent d’arriver dans le guide.', importance: 'default' },
  { id: 'lpt-announcements', name: 'Annonces', description: 'Les messages importants du Petit Tou.', importance: 'high' },
];

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

/**
 * Vrai si l'erreur signifie « cette fonction (ou ce paramètre) n'existe pas côté base » (PGRST202 / 404) :
 * la migration n'est pas encore appliquée. L'appli retente alors sans le paramètre récent.
 */
export function isMissingFunctionError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === 'PGRST202' || /could not find the function|schema cache/i.test(error.message ?? '');
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
