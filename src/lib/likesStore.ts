import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { emitAppEvent } from './appEvents';
import { getOrCreateDeviceId } from './deviceIdentity';

const LIKES_STORAGE_KEY = 'LPT_DEVICE_LIKED_SPOTS';

// Helper de persistance locale (SecureStore sur mobile, localStorage sur web)
const storage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
        return null;
      }
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
        return;
      }
      await SecureStore.setItemAsync(key, value);
    } catch (e) {}
  },
};

// Efface les likes mémorisés sur cet appareil (effacement des données, RGPD)
export const clearDeviceLikedSpotIds = async (): Promise<void> => {
  await storage.setItem(LIKES_STORAGE_KEY, '[]');
};

// Charge la liste des identifiants likés par ce terminal
export const loadDeviceLikedSpotIds = async (): Promise<string[]> => {
  try {
    const raw = await storage.getItem(LIKES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

// Sauvegarde la liste des likes de l'appareil
export const saveDeviceLikedSpotIds = async (spotIds: string[]): Promise<void> => {
  try {
    await storage.setItem(LIKES_STORAGE_KEY, JSON.stringify(spotIds));
  } catch (e) {}
};

// Récupère les compteurs globaux de likes depuis Supabase
export const fetchGlobalLikesMap = async (): Promise<Record<string, number>> => {
  const map: Record<string, number> = {};
  try {
    // 1. Interroge la table spot_likes
    const { data: spotLikes, error: spotLikesError } = await supabase
      .from('spot_likes')
      .select('spot_id, likes_count');

    if (!spotLikesError && spotLikes && Array.isArray(spotLikes)) {
      spotLikes.forEach((item: any) => {
        if (item.spot_id) {
          map[String(item.spot_id)] = Math.max(0, Number(item.likes_count) || 0);
        }
      });
      return map;
    }

    // 2. Fallback si spot_likes n'a pas encore été créée : lecture de addresses.likes_count
    const { data: addresses, error: addrError } = await supabase
      .from('addresses')
      .select('id, likes_count');

    if (!addrError && addresses && Array.isArray(addresses)) {
      addresses.forEach((item: any) => {
        if (item.id && typeof item.likes_count === 'number') {
          map[String(item.id)] = Math.max(0, item.likes_count);
        }
      });
    }
  } catch (err) {
    console.warn('Could not fetch global likes:', err);
  }
  return map;
};

// Bascule le like d'un spot : met à jour localement immédiatement et envoie l'incrément à Supabase
export const toggleSpotLike = async (
  spotId: string,
  currentLikesMap: Record<string, number>,
  currentLikedIds: string[]
): Promise<{ updatedLikedIds: string[]; updatedLikesMap: Record<string, number> }> => {
  const idStr = String(spotId);
  const wasLiked = currentLikedIds.includes(idStr);
  const currentCount = currentLikesMap[idStr] || 0;

  // Calcul optimiste immédiat
  const delta = wasLiked ? -1 : 1;
  const newCount = Math.max(0, currentCount + delta);
  
  const updatedLikedIds = wasLiked
    ? currentLikedIds.filter((id) => id !== idStr)
    : [...currentLikedIds, idStr];

  const updatedLikesMap = {
    ...currentLikesMap,
    [idStr]: newCount,
  };

  // Persiste les likes de cet appareil en local
  saveDeviceLikedSpotIds(updatedLikedIds);

  // Synchronise les vues ouvertes (accueil, carte)
  emitAppEvent('pt_likes_updated', { spotId: idStr, newCount, wasLiked: !wasLiked });

  // Synchronisation distante via fonction serveur (un like par appareil, delta contrôlé côté base)
  (async () => {
    try {
      const deviceId = await getOrCreateDeviceId();
      const { error } = await supabase.rpc('increment_spot_like', {
        p_spot_id: idStr,
        p_delta: delta,
        p_device_id: deviceId,
      });
      if (error) console.warn('RPC increment_spot_like error:', error.message);
    } catch (rpcErr) {
      console.warn('RPC increment_spot_like error:', rpcErr);
    }
  })();

  return { updatedLikedIds, updatedLikesMap };
};
