import { supabase } from './supabase';
import { appStorage } from './storage';
import { authService } from './authService';

export interface DiscountCard {
  id: string;
  partner_id?: string;
  title: string;
  subtitle?: string;
  category: 'food' | 'drinks' | 'shopping' | 'culture' | 'services';
  discount_value: string;
  badge_label?: string;
  description?: string;
  terms?: string;
  max_uses: number;
  uses_count: number;
  remaining_uses: number;
  card_color_primary: string;
  card_color_secondary: string;
  visual_url?: string;
  is_active: boolean;
}

export const DEFAULT_DISCOUNT_CARDS: DiscountCard[] = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    title: 'Le Bibent',
    subtitle: 'Place du Capitole • Brasserie Historique',
    category: 'food',
    discount_value: '1 Coupe Offerte',
    badge_label: 'PRIVILÈGE CAPITOLE',
    description: 'Une coupe de champagne de bienvenue offerte pour tout repas déjeunatoire ou dînatoire.',
    terms: 'Valable tous les jours midi et soir sur présentation de la carte in-app au serveur.',
    max_uses: 3,
    uses_count: 0,
    remaining_uses: 3,
    card_color_primary: '#E84A5F',
    card_color_secondary: '#5C0F0C',
    visual_url: 'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800',
    is_active: true,
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    title: 'La Belle Brune',
    subtitle: 'Saint-Cyprien • Bistronomie Toulousaine',
    category: 'food',
    discount_value: '-15% ADDITION',
    badge_label: 'COUP DE CŒUR LPT',
    description: '-15% sur l\'ensemble de l\'addition hors formules du midi pour vous et votre table.',
    terms: 'Valable du mardi au samedi soir, jusqu\'à 4 personnes par table.',
    max_uses: 5,
    uses_count: 0,
    remaining_uses: 5,
    card_color_primary: '#24242E',
    card_color_secondary: '#1A1A22',
    visual_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    is_active: true,
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    title: 'Chez Magda',
    subtitle: 'Quartier des Carmes • Café de Spécialité',
    category: 'drinks',
    discount_value: 'Pâtisserie Offerte',
    badge_label: 'PAUSE GOURMANDE',
    description: 'Une délicieuse pâtisserie artisanale maison offerte pour toute boisson chaude commandée.',
    terms: 'Valable du mardi au dimanche de 9h à 18h.',
    max_uses: 5,
    uses_count: 0,
    remaining_uses: 5,
    card_color_primary: '#F2B835',
    card_color_secondary: '#B45309',
    visual_url: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
    is_active: true,
  },
  {
    id: 'a4444444-4444-4444-4444-444444444444',
    title: 'Monsieur Georges',
    subtitle: 'Place Saint-Georges • Bar à Cocktails',
    category: 'drinks',
    discount_value: '-20% COCKTAILS',
    badge_label: 'HAPPY HOUR VIP',
    description: '-20% sur toute la carte des créations cocktails d\'auteur de 18h à 21h.',
    terms: 'Valable du mercredi au samedi avant 21h sur présentation de la carte.',
    max_uses: 4,
    uses_count: 0,
    remaining_uses: 4,
    card_color_primary: '#A82840',
    card_color_secondary: '#3B0A08',
    visual_url: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
    is_active: true,
  },
  {
    id: 'a5555555-5555-5555-5555-555555555555',
    title: 'La Maison du Vélo',
    subtitle: 'Canal du Midi • Mobilité & Balades',
    category: 'services',
    discount_value: '1H Vélo Offerte',
    badge_label: 'ÉVASION CANAL',
    description: '1 heure de location de vélo classique ou électrique offerte pour toute demi-journée.',
    terms: 'Valable toute l\'année aux horaires d\'ouverture du centre Canal du Midi.',
    max_uses: 2,
    uses_count: 0,
    remaining_uses: 2,
    card_color_primary: '#059669',
    card_color_secondary: '#064E3B',
    visual_url: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800',
    is_active: true,
  },
];

const CARDS_STORAGE_KEY = 'LPT_USER_DISCOUNT_CARDS_V2';

type CardsListener = (cards: DiscountCard[]) => void;

class DiscountCardsStore {
  private cards: DiscountCard[] = DEFAULT_DISCOUNT_CARDS;
  private listeners: Set<CardsListener> = new Set();
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

  private async loadLocalCache() {
    try {
      const parsed = await appStorage.getJSON<DiscountCard[]>(CARDS_STORAGE_KEY, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.cards = parsed;
        this.notify();
      }
    } catch (e) {
      console.warn('[DiscountCardsStore] Load local error:', e);
    }
  }

  private async saveLocalCache() {
    try {
      await appStorage.setJSON(CARDS_STORAGE_KEY, this.cards);
    } catch (e) {
      console.warn('[DiscountCardsStore] Save local error:', e);
    }
  }

  public async syncWithSupabase() {
    try {
      const userId = await authService.getUserId();

      // 1. Charger les cartes officielles actives
      const { data: dbCards, error: cardsError } = await supabase
        .from('discount_cards')
        .select('*')
        .eq('is_active', true);

      // 2. Charger les utilisations de cet utilisateur / terminal
      const { data: userCards, error: userCardsError } = await supabase
        .from('user_discount_cards')
        .select('discount_card_id, uses_count')
        .or(`user_id.eq.${userId},device_id.eq.${userId}`);

      const usageMap = new Map<string, number>();
      if (!userCardsError && Array.isArray(userCards)) {
        userCards.forEach((uc: any) => {
          usageMap.set(String(uc.discount_card_id), Number(uc.uses_count) || 0);
        });
      }

      const sourceCards = (!cardsError && Array.isArray(dbCards) && dbCards.length > 0)
        ? dbCards
        : DEFAULT_DISCOUNT_CARDS;

      this.cards = sourceCards.map((card: any) => {
        const usesCount = usageMap.get(String(card.id)) || 0;
        const maxUses = Number(card.max_uses) || 5;
        return {
          id: String(card.id),
          partner_id: card.partner_id,
          title: card.title,
          subtitle: card.subtitle,
          category: card.category || 'food',
          discount_value: card.discount_value,
          badge_label: card.badge_label || 'MEMBRE PETIT TOU',
          description: card.description,
          terms: card.terms,
          max_uses: maxUses,
          uses_count: usesCount,
          remaining_uses: Math.max(0, maxUses - usesCount),
          card_color_primary: card.card_color_primary || '#E84A5F',
          card_color_secondary: card.card_color_secondary || '#A82840',
          visual_url: card.visual_url,
          is_active: card.is_active !== false,
        };
      });

      await this.saveLocalCache();
      this.notify();
    } catch (err) {
      console.warn('[DiscountCardsStore] Sync error:', err);
    }
  }

  public async useCard(
    cardId: string
  ): Promise<{ success: boolean; error?: string; remaining_uses: number }> {
    const card = this.cards.find((c) => c.id === cardId);
    if (!card) {
      return { success: false, error: 'Carte introuvable', remaining_uses: 0 };
    }

    if (card.remaining_uses <= 0) {
      return {
        success: false,
        error: 'Toutes les utilisations de cette carte ont été consommées.',
        remaining_uses: 0,
      };
    }

    // 1. Déduction optimiste locale immédiate (0 ms)
    card.uses_count += 1;
    card.remaining_uses = Math.max(0, card.max_uses - card.uses_count);
    await this.saveLocalCache();
    this.notify();

    // 2. Validation serveur atomique RPC
    try {
      const userId = await authService.getUserId();
      const { data, error } = await supabase.rpc('use_discount_card', {
        p_card_id: cardId,
        p_device_id: userId,
      });

      if (!error && data && data.success) {
        card.uses_count = Number(data.uses_count) || card.uses_count;
        card.remaining_uses = Number(data.remaining_uses) || card.remaining_uses;
        await this.saveLocalCache();
        this.notify();
        return { success: true, remaining_uses: card.remaining_uses };
      } else if (error) {
        console.warn('[DiscountCardsStore] RPC use_discount_card fallback:', error);
      }
    } catch (e) {
      console.warn('[DiscountCardsStore] Server error, local count applied:', e);
    }

    return { success: true, remaining_uses: card.remaining_uses };
  }

  public getCards(): DiscountCard[] {
    return this.cards;
  }

  public subscribe(listener: CardsListener): () => void {
    this.listeners.add(listener);
    listener(this.cards);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.cards);
      } catch (e) {}
    });
  }
}

export const discountCardsStore = new DiscountCardsStore();
