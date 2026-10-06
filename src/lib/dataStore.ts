import { supabase } from './supabase';
import { appCache } from './dataCache';
import { searchIndex } from './searchIndex';
import dataset from '../constants/dataset.json';

export interface SpotRecord {
  id: string;
  title: string;
  category_id?: string;
  location?: string;
  address?: string;
  image_url?: string;
  rating?: number;
  price_level?: string;
  is_recommended?: boolean;
  is_new?: boolean;
  lat?: number;
  lng?: number;
  tags?: string[];
  telephone?: string;
  site_web?: string;
  horaires?: string;
  description?: string;
  full_description?: string;
  gallery_urls?: string[];
  breadcrumbs?: string[];
}

export interface CategoryRecord {
  id: string;
  name: string;
  slug?: string;
  icon_name: string;
  color: string;
}

export interface EventRecord {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  location?: string;
  price?: number;
  max_participants?: number;
  image_url?: string;
  address_id?: string;
}

type Listener<T> = (data: T) => void;

class GlobalDataStore {
  private addressListeners: Set<Listener<SpotRecord[]>> = new Set();
  private categoryListeners: Set<Listener<CategoryRecord[]>> = new Set();
  private eventListeners: Set<Listener<EventRecord[]>> = new Set();

  constructor() {
    // Re-index search on initial startup with dataset
    if (dataset && Array.isArray((dataset as any).addresses)) {
      searchIndex.updateSpots((dataset as any).addresses);
    }
  }

  // ── Dispatchers ──
  public notifyAddressesChanged(spots: SpotRecord[]) {
    appCache.invalidate('addresses');
    searchIndex.updateSpots(spots);

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('pt_addresses_changed', { detail: spots }));
      } catch (e) {}
    }
    this.addressListeners.forEach(listener => {
      try { listener(spots); } catch (e) {}
    });
  }

  public notifyCategoriesChanged(categories: CategoryRecord[]) {
    appCache.invalidate('categories');

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('pt_categories_changed', { detail: categories }));
      } catch (e) {}
    }
    this.categoryListeners.forEach(listener => {
      try { listener(categories); } catch (e) {}
    });
  }

  public notifyEventsChanged(events: EventRecord[]) {
    appCache.invalidate('events');

    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('pt_events_changed', { detail: events }));
      } catch (e) {}
    }
    this.eventListeners.forEach(listener => {
      try { listener(events); } catch (e) {}
    });
  }

  // ── Subscriptions ──
  public onAddressesChanged(listener: Listener<SpotRecord[]>): () => void {
    this.addressListeners.add(listener);
    return () => this.addressListeners.delete(listener);
  }

  public onCategoriesChanged(listener: Listener<CategoryRecord[]>): () => void {
    this.categoryListeners.add(listener);
    return () => this.categoryListeners.delete(listener);
  }

  public onEventsChanged(listener: Listener<EventRecord[]>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  // ── Fast Fetch & Sync ──
  public async fetchAndSyncAll() {
    try {
      const [addrRes, catRes, evtRes] = await Promise.all([
        supabase.from('addresses').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name', { ascending: true }),
        supabase.from('events').select('*').order('event_date', { ascending: true }),
      ]);

      if (addrRes.data && addrRes.data.length > 0) {
        this.notifyAddressesChanged(addrRes.data as SpotRecord[]);
      }
      if (catRes.data && catRes.data.length > 0) {
        this.notifyCategoriesChanged(catRes.data as CategoryRecord[]);
      }
      if (evtRes.data && evtRes.data.length > 0) {
        this.notifyEventsChanged(evtRes.data as EventRecord[]);
      }
    } catch (e) {
      console.warn('fetchAndSyncAll error:', e);
    }
  }
}

export const dataStore = new GlobalDataStore();
