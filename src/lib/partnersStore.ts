import { supabase } from "./supabase";
import { appCache } from "./dataCache";
import { emitAppEvent } from "./appEvents";

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

/**
 * Aucun partenaire fictif : tant que la base n'a pas répondu, ou si elle n'en a aucun, la section
 * « Top Partenaires » reste masquée (une offre affichée doit être une vraie offre).
 */
export const DEFAULT_PARTNERS: SponsoredPartner[] = [];

const STORAGE_KEY = "pt_sponsored_partners_v1";

/**
 * Returns currently stored partners synchronously (0ms latency, zero flicker).
 */
export function getStoredPartners(): SponsoredPartner[] {
  const cached = appCache.get<SponsoredPartner[]>("sponsoredPartners");
  if (cached) return cached;

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
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
    } catch (e) {
      console.warn("Error saving stored partners:", e);
    }
  }
  emitAppEvent("pt_partners_changed", partners);
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

    if (!error && data) {
      saveStoredPartners(data);
      return data;
    }
  } catch (err) {
    console.warn("syncPartnersWithSupabase warning:", err);
  }
  return getStoredPartners();
}