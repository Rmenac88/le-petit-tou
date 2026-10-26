import { supabase } from './supabase';
import { appStorage } from './storage';
import { authService } from './authService';
import { clearChunked, loadChunked, saveChunked } from './chunkedStorage';
import { isOfferVisible, normalizeOffer, sortOffers, type Offer } from './offersLogic';

/** Une offre (carte de réduction) telle que l'appli l'affiche. */
export type DiscountCard = Offer;

/** Dernière liste connue, gardée sur le téléphone pour un affichage immédiat (même hors connexion). */
const CARDS_STORAGE_KEY = 'LPT_OFFERS_CACHE_V3';
/** Ancien cache (versions précédentes, qui contenait des cartes d'exemple) : effacé. */
const LEGACY_CARDS_STORAGE_KEY = 'LPT_USER_DISCOUNT_CARDS_V2';

export type OffersStatus = 'idle' | 'loading' | 'ready' | 'error';
type CardsListener = (cards: DiscountCard[], status: OffersStatus) => void;

/**
 * Offres affichées dans l'onglet « - % ». Jamais d'offre fictive : seule la base fait foi (les cartes d'exemple de la
 * migration 002 sont écartées par isOfferVisible). Sans connexion, la dernière liste connue reste affichée.
 */
class DiscountCardsStore {
  private cards: DiscountCard[] = [];
  private status: OffersStatus = 'idle';
  private listeners: Set<CardsListener> = new Set();
  private started = false;

  /** Démarre le chargement une seule fois : cache local d'abord, base ensuite. */
  start() {
    if (this.started) return;
    this.started = true;
    this.loadLocalCache().finally(() => this.syncWithSupabase());
  }

  private async loadLocalCache() {
    try {
      appStorage.removeItem(LEGACY_CARDS_STORAGE_KEY).catch(() => {});
      const text = await loadChunked(appStorage, CARDS_STORAGE_KEY);
      const parsed = text ? JSON.parse(text) : [];
      if (Array.isArray(parsed)) {
        const now = Date.now();
        const cached = parsed
          .map((row) => normalizeOffer(row, Number(row?.uses_count) || 0))
          .filter((o): o is Offer => !!o && isOfferVisible(o, now));
        if (cached.length > 0 && this.cards.length === 0) {
          this.cards = sortOffers(cached);
          this.notify();
        }
      }
    } catch (e) {
      console.warn('[DiscountCardsStore] Load local error:', e);
    }
  }

  private async saveLocalCache() {
    try {
      await saveChunked(appStorage, CARDS_STORAGE_KEY, JSON.stringify(this.cards));
    } catch (e) {
      console.warn('[DiscountCardsStore] Save local error:', e);
    }
  }

  /** Recharge les offres depuis la base. Renvoie false si elle est injoignable (la liste en cache reste affichée). */
  public async syncWithSupabase(): Promise<boolean> {
    this.status = this.cards.length > 0 ? this.status : 'loading';
    this.notify();
    try {
      const userId = await authService.getUserId();
      const { data: dbCards, error: cardsError } = await supabase
        .from('discount_cards')
        .select('*')
        .eq('is_active', true);
      if (cardsError || !Array.isArray(dbCards)) throw cardsError ?? new Error('offres illisibles');

      // Utilisations de CET appareil (la fonction serveur ne renvoie que les siennes)
      const usageMap = new Map<string, number>();
      const { data: userCards, error: usageError } = await supabase.rpc('get_my_card_usage', { p_device_id: userId });
      if (!usageError && Array.isArray(userCards)) {
        userCards.forEach((uc: any) => usageMap.set(String(uc.discount_card_id), Number(uc.uses_count) || 0));
      }

      const now = Date.now();
      this.cards = sortOffers(
        dbCards
          .map((row: any) => normalizeOffer(row, usageMap.get(String(row.id)) || 0))
          .filter((o): o is Offer => !!o && isOfferVisible(o, now))
      );
      this.status = 'ready';
      await this.saveLocalCache();
      this.notify();
      return true;
    } catch (err) {
      console.warn('[DiscountCardsStore] Sync error:', err);
      this.status = this.cards.length > 0 ? 'ready' : 'error';
      this.notify();
      return false;
    }
  }

  public async useCard(
    cardId: string
  ): Promise<{ success: boolean; error?: string; remaining_uses: number }> {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) {
      return { success: false, error: 'Offre introuvable', remaining_uses: 0 };
    }

    if (card.remaining_uses <= 0) {
      return {
        success: false,
        error: 'Toutes les utilisations de cette offre ont été consommées.',
        remaining_uses: 0,
      };
    }

    // 1. Déduction optimiste locale immédiate (0 ms), annulée si le serveur refuse
    const previousUses = card.uses_count;
    card.uses_count += 1;
    card.remaining_uses = Math.max(0, card.max_uses - card.uses_count);
    this.notify();

    const rollback = async (serverUses?: number) => {
      card.uses_count = serverUses ?? previousUses;
      card.remaining_uses = Math.max(0, card.max_uses - card.uses_count);
      this.notify();
    };

    // 2. Validation serveur atomique (RPC) : seule source de vérité du quota
    try {
      const userId = await authService.getUserId();
      const { data, error } = await supabase.rpc('use_discount_card', {
        p_card_id: cardId,
        p_device_id: userId,
      });

      if (error) {
        console.warn('[DiscountCardsStore] RPC use_discount_card error:', error);
        await rollback();
        return { success: false, error: 'Connexion impossible : réessayez dans un instant.', remaining_uses: card.remaining_uses };
      }
      if (data && data.success) {
        card.uses_count = Number(data.uses_count) || card.uses_count;
        card.remaining_uses = Math.max(0, Number(data.remaining_uses));
        await this.saveLocalCache();
        this.notify();
        return { success: true, remaining_uses: card.remaining_uses };
      }
      // Refus serveur (quota atteint, offre expirée, identité invalide) : on s'aligne sur le serveur
      await rollback(typeof data?.uses_count === 'number' ? Number(data.uses_count) : undefined);
      const quota = data?.error === 'QUOTA_MAX_ATTEINT';
      return {
        success: false,
        error: quota
          ? 'Toutes les utilisations de cette offre ont été consommées.'
          : 'Cette offre n\'est plus utilisable.',
        remaining_uses: card.remaining_uses,
      };
    } catch (e) {
      console.warn('[DiscountCardsStore] Server error:', e);
      await rollback();
      return { success: false, error: 'Connexion impossible : réessayez dans un instant.', remaining_uses: card.remaining_uses };
    }
  }

  // Effacement local après suppression côté serveur : les compteurs repartent de zéro
  public async resetLocal(): Promise<void> {
    await clearChunked(appStorage, CARDS_STORAGE_KEY);
    await appStorage.removeItem(LEGACY_CARDS_STORAGE_KEY);
    this.cards = [];
    this.status = 'idle';
    this.notify();
    if (this.started) await this.syncWithSupabase();
  }

  public getCards(): DiscountCard[] {
    return this.cards;
  }

  public getStatus(): OffersStatus {
    return this.status;
  }

  public subscribe(listener: CardsListener): () => void {
    this.listeners.add(listener);
    listener(this.cards, this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.cards, this.status);
      } catch (e) {}
    });
  }
}

export const discountCardsStore = new DiscountCardsStore();
