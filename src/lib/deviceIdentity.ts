import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as ExpoCrypto from 'expo-crypto';
import { secureUuid } from './secureUuid';

const DEVICE_ID_KEY = 'LPT_SECURE_DEVICE_ID';

/** Identifiant tiré d'un générateur cryptographique (il sert de secret d'accès aux données de l'installation). */
const generateUUID = (): string => {
  const native: any = typeof crypto !== 'undefined' ? crypto : undefined;
  return secureUuid({
    randomUUID:
      native && typeof native.randomUUID === 'function'
        ? () => native.randomUUID()
        : () => ExpoCrypto.randomUUID(),
    getRandomValues:
      native && typeof native.getRandomValues === 'function'
        ? (b) => native.getRandomValues(b)
        : (b) => ExpoCrypto.getRandomValues(b),
  });
};

/**
 * Récupère ou génère un identifiant unique persistant pour l'appareil / utilisateur anonyme.
 * - Sur iOS/Android : Stockage matériel sécurisé via Expo SecureStore (Keychain / Keystore).
 * - Sur Web : Stockage local persistant via window.localStorage.
 */
const loadOrCreateDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        let id = window.localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
          id = generateUUID();
          window.localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
      }
      return generateUUID();
    }

    // Plateforme Mobile Native
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!id) {
      id = generateUUID();
      await SecureStore.setItemAsync(DEVICE_ID_KEY, id, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    }
    return id;
  } catch (error) {
    console.warn('[DeviceIdentity] Fallback generate device ID:', error);
    return generateUUID();
  }
};

let cachedDeviceId: string | null = null;

/**
 * Identifiant d'appareil, mémorisé pour toute la session : si le stockage sécurisé est indisponible, l'identifiant
 * de secours reste le même (sinon chaque like ou action compterait comme un nouvel appareil).
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  if (!cachedDeviceId) cachedDeviceId = await loadOrCreateDeviceId();
  return cachedDeviceId;
};

/**
 * Restauration d'un profil (code de récupération) : ce téléphone adopte l'identifiant donné. L'appelant a déjà vérifié
 * le code (recoveryLogic.decideRestore) et vidé les copies locales ; l'appli doit être relancée ensuite.
 */
export const replaceDeviceId = async (deviceId: string): Promise<void> => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  } else {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
  }
  cachedDeviceId = deviceId;
};
