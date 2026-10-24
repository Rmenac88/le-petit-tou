import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase } from './supabase';
import { appStorage } from './storage';
import { authService } from './authService';
import {
  DEFAULT_PUSH_PREFERENCES,
  ENABLE_FAILURE_MESSAGES,
  NOTIFICATION_ACCENT,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_GROUP,
  isMissingFunctionError,
  isValidExpoPushToken,
  permissionOutcome,
  targetForNotification,
  type EnableFailure,
  type NotificationTarget,
  type PermissionOutcome,
  type PushPreferences,
} from './pushLogic';

const ENABLED_KEY = 'LPT_PUSH_ENABLED_V1';
const PREFS_KEY = 'LPT_PUSH_PREFS_V1';

/** Les notifications n'existent que sur un vrai téléphone (ni web, ni simulateur : pas de jeton fiable). */
export function isPushSupported(): boolean {
  return Platform.OS !== 'web' && Device.isDevice;
}

let channelsReady: Promise<boolean> | null = null;

/**
 * Crée le groupe et les canaux Android (un par type de message). Renvoie vrai si tous existent : le serveur
 * n'enverra les messages sur un canal dédié qu'aux appareils qui l'annoncent (sinon la notification serait perdue).
 * Sur iOS et le web, il n'y a pas de canaux : renvoie faux.
 */
function ensureChannels(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  if (!channelsReady) {
    channelsReady = (async () => {
      try {
        await Notifications.setNotificationChannelGroupAsync(NOTIFICATION_CHANNEL_GROUP.id, {
          name: NOTIFICATION_CHANNEL_GROUP.name,
        });
        for (const c of NOTIFICATION_CHANNELS) {
          await Notifications.setNotificationChannelAsync(c.id, {
            name: c.name,
            description: c.description,
            importance:
              c.importance === 'high'
                ? Notifications.AndroidImportance.HIGH
                : Notifications.AndroidImportance.DEFAULT,
            groupId: NOTIFICATION_CHANNEL_GROUP.id,
            lightColor: NOTIFICATION_ACCENT,
            enableLights: true,
            enableVibrate: true,
            vibrationPattern: [0, 180, 90, 180],
            sound: 'default',
            showBadge: true,
            // Aucun message ne contient de donnée personnelle : le texte peut s'afficher sur l'écran verrouillé
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
          });
        }
        return true;
      } catch (e) {
        console.warn('[push] canaux Android impossibles:', e);
        return false;
      }
    })();
  }
  return channelsReady;
}

/** À appeler une fois au démarrage : affichage en premier plan et canaux Android. */
export async function configurePush(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    await ensureChannels();
  } catch (e) {
    console.warn('[push] configuration impossible:', e);
  }
}

export interface PushState {
  supported: boolean;
  permission: PermissionOutcome;
  enabled: boolean;
  prefs: PushPreferences;
}

export async function getPushState(): Promise<PushState> {
  const prefs = await appStorage.getJSON<PushPreferences>(PREFS_KEY, DEFAULT_PUSH_PREFERENCES);
  const enabledFlag = (await appStorage.getItem(ENABLED_KEY)) === '1';
  if (!isPushSupported()) {
    return { supported: false, permission: 'can_ask', enabled: false, prefs: { ...DEFAULT_PUSH_PREFERENCES, ...prefs } };
  }
  let permission: PermissionOutcome = 'can_ask';
  try {
    permission = permissionOutcome(await Notifications.getPermissionsAsync());
  } catch {}
  return {
    supported: true,
    permission,
    // « activé » = choisi par l'utilisateur ET toujours autorisé par le système
    enabled: enabledFlag && permission === 'granted',
    prefs: { ...DEFAULT_PUSH_PREFERENCES, ...prefs },
  };
}

function projectId(): string | undefined {
  const fromExtra = (Constants.expoConfig?.extra as any)?.eas?.projectId;
  const fromEas = (Constants as any).easConfig?.projectId;
  return fromExtra || fromEas || undefined;
}

export type EnableResult = { ok: true } | { ok: false; reason: EnableFailure; message: string };
const fail = (reason: EnableFailure): EnableResult => ({ ok: false, reason, message: ENABLE_FAILURE_MESSAGES[reason] });

async function registerWithServer(token: string, prefs: PushPreferences): Promise<boolean> {
  const deviceId = await authService.getUserId();
  const channelsV2 = await ensureChannels();
  const args = {
    p_device_id: deviceId,
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
    p_notify_events: prefs.notify_events,
    p_notify_agenda: prefs.notify_agenda,
    p_notify_new_spots: prefs.notify_new_spots,
  };
  let { data, error } = await supabase.rpc('register_push_token', { ...args, p_channels_v2: channelsV2 });
  // Base pas encore migrée (010) : on s'inscrit quand même, sans le paramètre récent (canal « default »)
  if (isMissingFunctionError(error)) {
    ({ data, error } = await supabase.rpc('register_push_token', args));
  }
  return !error && data?.success === true;
}

/** Demande la permission (au moment où l'utilisateur le choisit), récupère le jeton et l'enregistre côté serveur. */
export async function enablePush(prefs: PushPreferences): Promise<EnableResult> {
  if (!isPushSupported()) return fail('unsupported');
  try {
    let status = await Notifications.getPermissionsAsync();
    if (!status.granted) status = await Notifications.requestPermissionsAsync();
    if (!status.granted) return fail('permission_denied');

    const id = projectId();
    if (!id) return fail('no_project');

    let token: string;
    try {
      token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    } catch (e) {
      console.warn('[push] jeton indisponible:', e);
      return fail('token_error');
    }
    if (!isValidExpoPushToken(token)) return fail('token_error');

    if (!(await registerWithServer(token, prefs))) return fail('server_error');
    await appStorage.setItem(ENABLED_KEY, '1');
    await appStorage.setJSON(PREFS_KEY, prefs);
    return { ok: true };
  } catch (e) {
    console.warn('[push] activation impossible:', e);
    return fail('token_error');
  }
}

export async function updatePushPreferences(prefs: PushPreferences): Promise<EnableResult> {
  try {
    const deviceId = await authService.getUserId();
    const { data, error } = await supabase.rpc('update_push_preferences', {
      p_device_id: deviceId,
      p_notify_events: prefs.notify_events,
      p_notify_agenda: prefs.notify_agenda,
      p_notify_new_spots: prefs.notify_new_spots,
    });
    if (error || data?.success !== true) return fail('server_error');
    await appStorage.setJSON(PREFS_KEY, prefs);
    return { ok: true };
  } catch {
    return fail('server_error');
  }
}

export async function disablePush(): Promise<EnableResult> {
  try {
    const deviceId = await authService.getUserId();
    const { data, error } = await supabase.rpc('unregister_push_token', { p_device_id: deviceId });
    if (error || data?.success !== true) return fail('server_error');
    await appStorage.setItem(ENABLED_KEY, '0');
    return { ok: true };
  } catch {
    return fail('server_error');
  }
}

/** Au démarrage : si l'utilisateur a activé les notifications, on rafraîchit le jeton côté serveur (il peut changer). */
export async function resyncPushRegistration(): Promise<void> {
  try {
    const state = await getPushState();
    if (!state.supported || !state.enabled) return;
    const id = projectId();
    if (!id) return;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    if (isValidExpoPushToken(token)) await registerWithServer(token, state.prefs);
  } catch (e) {
    console.warn('[push] resynchronisation impossible:', e);
  }
}

/** Efface l'état local des notifications (après « Effacer mes données »). */
export async function clearLocalPushState(): Promise<void> {
  await appStorage.removeItem(ENABLED_KEY);
  await appStorage.removeItem(PREFS_KEY);
}

/**
 * Ouvre le bon écran quand l'utilisateur touche une notification (app en arrière-plan ou fermée).
 * Chaque notification n'est traitée qu'une fois.
 */
export function useNotificationNavigation(onTarget: (target: NotificationTarget) => void): void {
  const handled = useRef<string | null>(null);
  const callback = useRef(onTarget);
  callback.current = onTarget;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const key = response.notification.request.identifier;
      if (handled.current === key) return;
      handled.current = key;
      callback.current(targetForNotification(response.notification.request.content.data));
    };
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}
