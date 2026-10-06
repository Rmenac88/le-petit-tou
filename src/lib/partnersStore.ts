import { supabase } from "./supabase";
import { appCache } from "./dataCache";

export interface SponsoredPartner {
  id: string;
  rank_position: number;
  title: string;
  subtitle: string;
  image_url: string;
  badge_text: string;
  price_paid?: number;
  sponsorship_tier?: string;
  starts_at?: string;
  ends_at?: string;
  notify_interval_hours?: number;
  is_active: boolean;
  spot_id?: string;
}

export const DEFAULT_PARTNERS: SponsoredPartner[] = [
  {
    id: "sp-1",
    rank_position: 1,
    title: "Le Bibent",
    subtitle: "1 Coupe de champagne offerte pour tout repas membre Le Petit Tou",
    image_url: "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?w=800",
    badge_text: "TOP #1 PARTENAIRE",
    price_paid: 300,
    notify_interval_hours: 2,
    is_active: true,
  },
  {
    id: "sp-2",
    rank_position: 2,
    title: "La Belle Brune",
    subtitle: "-15% sur toute la carte sur présentation du guide",
    image_url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
    badge_text: "TOP #2 COUP DE COEUR",
    price_paid: 200,
    notify_interval_hours: 12,
    is_active: true,
  },
  {
    id: "sp-3",
    rank_position: 3,
    title: "Chez Magda",
    subtitle: "Pâtisseries artisanales & Café de spécialité à prix d'ami",
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
    badge_text: "TOP #3 COEUR DE VILLE",
    price_paid: 180,
    notify_interval_hours: 24,
    is_active: true,
  },
];

const STORAGE_KEY = "pt_sponsored_partners_v1";

/**
 * Returns currently stored partners synchronously (0ms latency, zero flicker).
 */
export function getStoredPartners(): SponsoredPartner[] {
  const cached = appCache.get<SponsoredPartner[]>("sponsoredPartners");
  if (cached && cached.length > 0) return cached;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          appCache.set("sponsoredPartners", parsed);
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Error reading stored partners:", e);
    }
  }

  appCache.set("sponsoredPartners", DEFAULT_PARTNERS);
  return DEFAULT_PARTNERS;
}

/**
 * Saves partners locally and notifies any listening components.
 */
export function saveStoredPartners(partners: SponsoredPartner[]): void {
  appCache.set("sponsoredPartners", partners);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(partners));
      window.dispatchEvent(new CustomEvent("pt_partners_changed", { detail: partners }));
    } catch (e) {
      console.warn("Error saving stored partners:", e);
    }
  }
}

/**
 * Asynchronously synchronizes partners with Supabase and persists updates.
 */
export async function syncPartnersWithSupabase(): Promise<SponsoredPartner[]> {
  try {
    const { data, error } = await supabase
      .from("sponsored_partners")
      .select("*")
      .eq("is_active", true)
      .order("rank_position", { ascending: true });

    if (!error && data && data.length > 0) {
      saveStoredPartners(data);
      return data;
    }
  } catch (err) {
    console.warn("syncPartnersWithSupabase warning:", err);
  }
  return getStoredPartners();
}