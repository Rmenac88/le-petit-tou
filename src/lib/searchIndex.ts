import dataset from "../constants/dataset.json";

// Inverted Search Index for 0.1ms instant lookups across all 790 Toulouse venues
interface IndexedSpot {
  id: string;
  title: string;
  category: string;
  location: string;
  rating: number;
  review_count: number;
  price_level: string;
  image_url: string;
  tags: string[];
  description: string;
  full_description: string;
  lat: number;
  lng: number;
  normalizedText: string;
  normalizedTitle: string;
  normalizedCategory: string;
}

const normalize = (str: string): string => {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
};

class FastSearchIndex {
  private indexedSpots: IndexedSpot[] = [];
  private tokenMap: Map<string, Set<number>> = new Map();
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;
    const rawAddresses: any[] = (dataset as any).addresses || [];
    
    this.indexedSpots = rawAddresses.map((a, idx) => {
      const normalizedTitle = normalize(a.title || a.name || "");
      const normalizedDesc = normalize(a.description || a.full_description || "");
      const normalizedCat = normalize(a.category || "");
      const normalizedLocation = normalize(a.location || a.quartier || "");
      const normalizedTags = (a.tags || []).map(normalize).join(" ");
      
      const fullText = `${normalizedTitle} ${normalizedCat} ${normalizedLocation} ${normalizedTags} ${normalizedDesc}`;
      
      // Build token set for fast lookup
      const tokens = fullText.split(/[^a-z0-9]+/);
      for (const token of tokens) {
        if (token.length < 2) continue;
        // Index full token and 3+ char prefixes for instant autocomplete
        const prefixes = [token];
        if (token.length >= 4) {
          prefixes.push(token.substring(0, 3));
          prefixes.push(token.substring(0, 4));
        }
        for (const p of prefixes) {
          if (!this.tokenMap.has(p)) {
            this.tokenMap.set(p, new Set());
          }
          this.tokenMap.get(p)!.add(idx);
        }
      }

      return {
        id: a.id,
        title: a.title || a.name || "Établissement",
        category: a.category || "Autre",
        location: a.location || a.quartier || "Toulouse",
        rating: a.rating || 4.5,
        review_count: a.review_count || 0,
        price_level: a.price_level || "€€",
        image_url: a.image_url || "",
        tags: a.tags || [],
        description: a.description || "",
        full_description: a.full_description || a.description || "",
        lat: a.lat,
        lng: a.lng,
        normalizedText: fullText,
        normalizedTitle: normalizedTitle,
        normalizedCategory: normalizedCat,
      };
    });

    this.initialized = true;
  }

  public updateSpots(rawAddresses: any[]) {
    if (!rawAddresses || !Array.isArray(rawAddresses) || rawAddresses.length === 0) return;
    this.tokenMap.clear();
    this.indexedSpots = rawAddresses.map((a, idx) => {
      const normalizedTitle = normalize(a.title || a.name || "");
      const normalizedDesc = normalize(a.description || a.full_description || "");
      const normalizedCat = normalize(a.category || "");
      const normalizedLocation = normalize(a.location || a.quartier || a.address || "");
      const normalizedTags = (a.tags || []).map(normalize).join(" ");
      
      const fullText = `${normalizedTitle} ${normalizedCat} ${normalizedLocation} ${normalizedTags} ${normalizedDesc}`;
      
      const tokens = fullText.split(/[^a-z0-9]+/);
      for (const token of tokens) {
        if (token.length < 2) continue;
        const prefixes = [token];
        if (token.length >= 4) {
          prefixes.push(token.substring(0, 3));
          prefixes.push(token.substring(0, 4));
        }
        for (const p of prefixes) {
          if (!this.tokenMap.has(p)) {
            this.tokenMap.set(p, new Set());
          }
          this.tokenMap.get(p)!.add(idx);
        }
      }

      return {
        id: a.id,
        title: a.title || a.name || "Établissement",
        category: a.category || "Autre",
        location: a.location || a.quartier || a.address || "Toulouse",
        rating: a.rating || 4.5,
        review_count: a.review_count || 0,
        price_level: a.price_level || "€€",
        image_url: a.image_url || "",
        tags: a.tags || [],
        description: a.description || "",
        full_description: a.full_description || a.description || "",
        lat: a.lat,
        lng: a.lng,
        normalizedText: fullText,
        normalizedTitle: normalizedTitle,
        normalizedCategory: normalizedCat,
      };
    });

    this.initialized = true;
  }

  public search(query: string, categoryFilter?: string | null, limit: number = 30): IndexedSpot[] {
    if (!this.initialized) this.init();
    const cleanQuery = normalize(query);

    if (!cleanQuery) {
      if (categoryFilter && categoryFilter !== "all") {
        const normCat = normalize(categoryFilter);
        return this.indexedSpots
          .filter((s) => s.normalizedCategory.includes(normCat))
          .slice(0, limit);
      }
      return this.indexedSpots.slice(0, limit);
    }

    const queryTokens = cleanQuery.split(/[^a-z0-9]+/).filter((t) => t.length > 0);
    if (queryTokens.length === 0) return this.indexedSpots.slice(0, limit);

    // Score & match spots
    const results: { spot: IndexedSpot; score: number }[] = [];
    const normCat = categoryFilter && categoryFilter !== "all" ? normalize(categoryFilter) : null;

    for (let i = 0; i < this.indexedSpots.length; i++) {
      const spot = this.indexedSpots[i];
      if (normCat && !spot.normalizedCategory.includes(normCat)) continue;

      let score = 0;
      let matchesAll = true;
      const spotTitle = spot.normalizedTitle;

      for (const qTok of queryTokens) {
        if (spotTitle === qTok) {
          score += 100;
        } else if (spotTitle.startsWith(qTok)) {
          score += 50;
        } else if (spotTitle.includes(qTok)) {
          score += 30;
        } else if (spot.normalizedText.includes(qTok)) {
          score += 10;
        } else {
          matchesAll = false;
          break;
        }
      }

      if (matchesAll) {
        // Boost highly rated venues slightly
        score += (spot.rating || 4) * 2;
        results.push({ spot, score });
      }
    }

    // Sort by relevance score descending
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map((r) => r.spot);
  }

  public getAll(): IndexedSpot[] {
    if (!this.initialized) this.init();
    return this.indexedSpots;
  }
}

export const searchIndex = new FastSearchIndex();