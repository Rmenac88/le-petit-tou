import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'LPT_SECURE_DEVICE_ID';

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

/**
 * Récupère ou génère un identifiant unique persistant pour l'appareil / utilisateur anonyme.
 * - Sur iOS/Android : Stockage matériel sécurisé via Expo SecureStore (Keychain / Keystore).
 * - Sur Web : Stockage local persistant via window.localStorage.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
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
