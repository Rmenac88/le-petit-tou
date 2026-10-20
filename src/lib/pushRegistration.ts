import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { appStorage } from './storage';
import { getOrCreateDeviceId } from './deviceIdentity';
import {
  isValidExpoPushToken,
  parsePrefs,
  pushAvailability,
  resolveProjectId,
  type NotificationPrefs,
  type PushAvailability,
} from './pushPrefs.ts';

/**
 * Inscription aux notifications push.
 * - Jamais automatique : tout part d'un geste explicite dans l'écran « Notifications ».
 * - Le jeton est envoyé à Supabase par la fonction `register_push_token` (la table
 *   `user_push_tokens` n'est ni lisible ni modifiable directement depuis l'appli).
 */

const PREFS_KEY = 'pt_push_prefs_v1';
const ENABLED_KEY = 'pt_push_enabled_v1';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export interface PushState {
  availability: PushAvailability;
  permission: PermissionState;
  /** Vrai si cet appareil est inscrit et que la personne n'a pas désactivé. */
  enabled: boolean;
  prefs: NotificationPrefs;
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'denied' | 'network' };

const projectId = () => resolveProjectId(Constants.expoConfig?.extra);

/** À appeler une fois au démarrage : comment afficher une notification reçue appli ouverte. */
export function configureNotificationHandler() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function readPermission(): Promise<PermissionState> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'undetermined';
  }
}

export async function loadPushState(): Promise<PushState> {
  const availability = pushAvailability(Platform.OS, projectId());
  const prefs = parsePrefs(await appStorage.getItem(PREFS_KEY));
  if (availability !== 'ready') {
    return { availability, permission: 'undetermined', enabled: false, prefs };
  }
  const permission = await readPermission();
  const enabled = permission === 'granted' && (await appStorage.getItem(ENABLED_KEY)) === '1';
  return { availability, permission, enabled, prefs };
}

/** Obtient le jeton et l'enregistre côté serveur avec les préférences choisies. */
async function registerWithServer(prefs: NotificationPrefs): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Le Petit Tou',
        importance: Notifications.AndroidImportance.DEFAULT,
        lightColor: '#E84A5F',
      });
    }
    const id = projectId();
    if (!id || !supabase) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
    if (!isValidExpoPushToken(token)) return false;
    const deviceId = await getOrCreateDeviceId();
    const { error } = await supabase.rpc('register_push_token', {
      p_device_id: deviceId,
      p_token: token,
      p_platform: Platform.OS,
      p_notify_events: prefs.events,
      p_notify_spots: prefs.spots,
    });
    return !error;
  } catch {
    return false;
  }
}

/** Demande l'autorisation puis inscrit l'appareil. À appeler uniquement depuis un geste de la personne. */
export async function enablePush(prefs: NotificationPrefs): Promise<EnableResult> {
  if (pushAvailability(Platform.OS, projectId()) !== 'ready') {
    return { ok: false, reason: 'unavailable' };
  }
  let permission = await readPermission();
  if (permission !== 'granted') {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      permission = status === 'granted' ? 'granted' : 'denied';
    } catch {
      return { ok: false, reason: 'network' };
    }
  }
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const registered = await registerWithServer(prefs);
  if (!registered) return { ok: false, reason: 'network' };
  await appStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  await appStorage.setItem(ENABLED_KEY, '1');
  return { ok: true };
}

/** Change les catégories reçues (l'appareil doit déjà être inscrit). */
export async function updatePushPrefs(prefs: NotificationPrefs): Promise<boolean> {
  const registered = await registerWithServer(prefs);
  if (registered) await appStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  return registered;
}

/** Désinscrit l'appareil : le jeton est supprimé côté serveur. */
export async function disablePush(): Promise<boolean> {
  try {
    if (supabase) {
      const deviceId = await getOrCreateDeviceId();
      const { error } = await supabase.rpc('unregister_push_token', { p_device_id: deviceId });
      if (error) return false;
    }
    await appStorage.setItem(ENABLED_KEY, '0');
    return true;
  } catch {
    return false;
  }
}

export function openSystemSettings() {
  Linking.openSettings().catch(() => {});
}
