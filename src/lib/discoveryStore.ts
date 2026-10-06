import { supabase } from './supabase';
import { appStorage } from './storage';
import { authService } from './authService';
import dataset from '../constants/dataset.json';

const TOTAL_PLACES_COUNT = dataset.addresses ? dataset.addresses.length : 790;
const DISCOVERIES_STORAGE_KEY = 'LPT_LOCAL_DISCOVERIES_DATA_V2';
const PENDING_SYNC_QUEUE_KEY = 'LPT_PENDING_DISCOVERIES_QUEUE_V2';

export interface DiscoveryStats {
  totalPlaces: number;
  discoveredCount: number;
  undiscoveredCount: number;
  totalPoints: number;
  progressPercentage: number;
}

export interface PlaceSuggestionInput {
  title: string;
  address?: string;
  category_name?: string;
  comment?: string;
}

type DiscoveryListener = (stats: DiscoveryStats, discoveredIds: string[]) => void;

class DiscoveryStore {
  private discoveredIds: Set<string> = new Set();
  private pointsMap: Map<string, number> = new Map();
  private listeners: Set<DiscoveryListener> = new Set();
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
    await this.loadLocalCache();
    this.syncWithSupabase();
  }

  // 1. Chargement instantané depuis le cache local (0 ms)
  private async loadLocalCache() {
    try {
      const parsed = await appStorage.getJSON<{ id: string; points: number }[]>(DISCOVERIES_STORAGE_KEY, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed.forEach((item) => {
          if (item.id) {
            this.discoveredIds.add(String(item.id));
            this.pointsMap.set(String(item.id), Number(item.points) || 10);
          }
        });
        this.notify();
      }
    } catch (e) {
      console.warn('[DiscoveryStore] Error reading local cache:', e);
    }
  }

  // 2. Sauvegarde dans le cache local
  private async saveLocalCache() {
    try {
      const data = Array.from(this.discoveredIds).map((id) => ({
        id,
        points: this.pointsMap.get(id) || 10,
      }));
      await appStorage.setJSON(DISCOVERIES_STORAGE_KEY, data);
    } catch (e) {
      console.warn('[DiscoveryStore] Error saving local cache:', e);
    }
  }

  // 3. Synchronisation avec Supabase (Cloud)
  public async syncWithSupabase() {
    try {
      const userId = await authService.getUserId();

      // Synchroniser d'abord la file d'attente hors-ligne si présente
      await this.flushPendingQueue(userId);

      // Récupérer toutes les découvertes enregistrées pour cet utilisateur / terminal
      const { data, error } = await supabase
        .from('user_place_discoveries')
        .select('place_id, points_awarded')
        .or(`user_id.eq.${userId},device_id.eq.${userId}`);

      if (!error && Array.isArray(data)) {
        data.forEach((row: any) => {
          if (row.place_id) {
            const pId = String(row.place_id);
            this.discoveredIds.add(pId);
            this.pointsMap.set(pId, Number(row.points_awarded) || 10);
          }
        });
        await this.saveLocalCache();
        this.notify();
      }
    } catch (err) {
      console.warn('[DiscoveryStore] Sync with Supabase warning:', err);
    }
  }

  // 4. File d'attente hors-ligne (Offline Queue)
  private async flushPendingQueue(userId: string) {
    try {
      const queue = await appStorage.getJSON<{ placeId: string; points: number; timestamp: number }[]>(
        PENDING_SYNC_QUEUE_KEY,
        []
      );
      if (!queue || queue.length === 0) return;

      const remainingQueue: typeof queue = [];

      for (const item of queue) {
        try {
          const { error } = await supabase.rpc('discover_place', {
            p_place_id: item.placeId,
            p_device_id: userId,
            p_source: 'offline_sync',
          });
          if (error) {
            remainingQueue.push(item);
          }
        } catch {
          remainingQueue.push(item);
        }
      }

      await appStorage.setJSON(PENDING_SYNC_QUEUE_KEY, remainingQueue);
    } catch (e) {
      console.warn('[DiscoveryStore] Flush queue error:', e);
    }
  }

  private async pushToPendingQueue(placeId: string, points: number) {
    try {
      const queue = await appStorage.getJSON<any[]>(PENDING_SYNC_QUEUE_KEY, []);
      queue.push({
        placeId,
        points,
        timestamp: Date.now(),
      });
      await appStorage.setJSON(PENDING_SYNC_QUEUE_KEY, queue);
    } catch (e) {}
  }

  // 5. Action utilisateur : Découvrir un lieu (Optimiste 0 ms + Envoi RPC sécurisé)
  public async discoverSpot(
    spotId: string,
    isRecommended: boolean = false,
    rating: number = 4.8
  ): Promise<{ success: boolean; pointsAwarded: number; isFirstTime: boolean }> {
    const pId = String(spotId);

    // Si déjà découvert : idempotent
    if (this.discoveredIds.has(pId)) {
      return {
        success: true,
        pointsAwarded: this.pointsMap.get(pId) || 10,
        isFirstTime: false,
      };
    }

    // Barème de points officiel :
    // - Coup de cœur Le Petit Tou = 25 pts
    // - Top note (>= 4.8) = 20 pts
    // - Standard = 10 pts
    const points = isRecommended ? 25 : (rating >= 4.8 ? 20 : 10);

    // MISE À JOUR OPTIMISTE IMMÉDIATE (0 ms)
    this.discoveredIds.add(pId);
    this.pointsMap.set(pId, points);
    await this.saveLocalCache();
    this.notify();

    // ENVOI SERVEUR SÉCURISÉ (RPC Supabase avec auth.uid())
    try {
      const userId = await authService.getUserId();
      const res = await supabase.rpc('discover_place', {
        p_place_id: pId,
        p_device_id: userId,
        p_source: 'manual_checkin',
      });

      if (res.error) {
        await this.pushToPendingQueue(pId, points);
      } else if (res.data && res.data.points_earned) {
        const earned = Number(res.data.points_earned) || points;
        this.pointsMap.set(pId, earned);
        await this.saveLocalCache();
        this.notify();
      }
    } catch (e) {
      await this.pushToPendingQueue(pId, points);
    }

    return {
      success: true,
      pointsAwarded: points,
      isFirstTime: true,
    };
  }

  // 6. Vérifier si une adresse est découverte
  public isDiscovered(spotId: string): boolean {
    return this.discoveredIds.has(String(spotId));
  }

  // 7. Obtenir la liste des IDs découverts
  public getDiscoveredSpotIds(): string[] {
    return Array.from(this.discoveredIds);
  }

  // 8. Calculer les statistiques globales de progression
  public getStats(): DiscoveryStats {
    const discoveredCount = this.discoveredIds.size;
    const undiscoveredCount = Math.max(0, TOTAL_PLACES_COUNT - discoveredCount);
    let totalPoints = 0;
    this.pointsMap.forEach((pts) => {
      totalPoints += pts;
    });

    const progressPercentage = TOTAL_PLACES_COUNT > 0
      ? Math.min(100, Math.round((discoveredCount / TOTAL_PLACES_COUNT) * 100))
      : 0;

    return {
      totalPlaces: TOTAL_PLACES_COUNT,
      discoveredCount,
      undiscoveredCount,
      totalPoints,
      progressPercentage,
    };
  }

  // 9. Proposition d'une nouvelle adresse par l'utilisateur
  public async suggestNewPlace(input: PlaceSuggestionInput): Promise<{ success: boolean; error?: string }> {
    try {
      if (!input.title || !input.title.trim()) {
        return { success: false, error: 'Veuillez renseigner le nom de l\'adresse.' };
      }
      const userId = await authService.getUserId();
      const { error } = await supabase.from('place_suggestions').insert({
        device_id: userId,
        title: input.title.trim(),
        address: input.address?.trim() || null,
        category_name: input.category_name?.trim() || null,
        comment: input.comment?.trim() || null,
      });

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Une erreur inattendue est survenue.' };
    }
  }

  // 10. Abonnement aux mises à jour (Pattern Observer pour l'UI réactive)
  public subscribe(listener: DiscoveryListener): () => void {
    this.listeners.add(listener);
    listener(this.getStats(), this.getDiscoveredSpotIds());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const stats = this.getStats();
    const ids = this.getDiscoveredSpotIds();
    this.listeners.forEach((listener) => {
      try {
        listener(stats, ids);
      } catch (e) {}
    });
  }
}

export const discoveryStore = new DiscoveryStore();
