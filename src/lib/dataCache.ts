/**
 * In-memory Stale-While-Revalidate (SWR) cache for Le Petit Tou.
 * Provides 0ms tab switching across Home, Map, Search, and Favorites.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class InMemoryCache {
  private cache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 10 * 60 * 1000; // 10 minutes

  get<T>(key: string, ttl: number = this.defaultTTL): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }
}

export const appCache = new InMemoryCache();
