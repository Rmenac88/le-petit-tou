import { supabase } from './supabase';
import { appCache } from './dataCache';
import dataset from '../constants/dataset.json';
import { classifySpot, getBudgetInfo } from './categoryResolver';

const TOULOUSE_LAT = 43.6047;
const TOULOUSE_LNG = 1.4442;

export interface MapSpotDTO {
  id: string;
  name: string;
  title: string;
  lat: number;
  lng: number;
  cat: string;
  category: string;
  rating: number;
  price_level: string;
  budget_label: string;
  points_reward: number;
  is_recommended: boolean;
  is_new: boolean;
  image_url?: string;
}

export interface FullSpotDetailDTO extends MapSpotDTO {
  desc: string;
  description: string;
  full_description: string;
  gallery_urls: string[];
  photos: string[];
  location: string;
  address: string;
  phone: string;
  website: string;
  hours: string;
  tags: string[];
  breadcrumbs: string[];
  likes_count?: number;
  estimated_budget?: number;
  price_min?: number;
  price_max?: number;
}

// Lookup titre normalisé → {lat, lng} depuis dataset.json
const DATASET_COORDS_LOOKUP: Record<string, { lat: number; lng: number }> = {};
const DATASET_ADDR_LOOKUP: Record<string, { lat: number; lng: number }> = {};
((dataset as any)?.addresses || []).forEach((a: any) => {
  if (a.lat && a.lng) {
    const normTitle = (a.title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (normTitle) DATASET_COORDS_LOOKUP[normTitle] = { lat: Number(a.lat), lng: Number(a.lng) };
    const normAddr = (a.address || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 20);
    if (normAddr) DATASET_ADDR_LOOKUP[normAddr] = { lat: Number(a.lat), lng: Number(a.lng) };
  }
});

class PlacesRepository {
  private memoryMapSpots: MapSpotDTO[] | null = null;
  private memoryFullSpots: FullSpotDetailDTO[] | null = null;
  private memoryDetailsCache = new Map<string, FullSpotDetailDTO>();

  constructor() {
    this.initOfflineBaseline();
  }

  /**
   * Résout les coordonnées GPS fiables avec fallback hiérarchique
   */
  public resolveCoordinates(addr: any): { lat: number; lng: number } {
    const parsedLat = parseFloat(addr.lat);
    const parsedLng = parseFloat(addr.lng);
    let resolvedLat = !isNaN(parsedLat) && parsedLat !== 0 ? parsedLat : 0;
    let resolvedLng = !isNaN(parsedLng) && parsedLng !== 0 ? parsedLng : 0;

    if (!resolvedLat || !resolvedLng) {
      const normTitle = (addr.title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const fromTitle = DATASET_COORDS_LOOKUP[normTitle];
      if (fromTitle) {
        resolvedLat = fromTitle.lat;
        resolvedLng = fromTitle.lng;
      } else {
        const normAddr = (addr.address || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '').slice(0, 20);
        const fromAddr = DATASET_ADDR_LOOKUP[normAddr];
        if (fromAddr) {
          resolvedLat = fromAddr.lat;
          resolvedLng = fromAddr.lng;
        }
      }
    }

    if (!resolvedLat || !resolvedLng) {
      resolvedLat = TOULOUSE_LAT;
      resolvedLng = TOULOUSE_LNG;
    }

    return { lat: resolvedLat, lng: resolvedLng };
  }

  /**
   * Formate une adresse brute (Supabase ou dataset) en DTO complet
   */
  public formatRawAddress(addr: any): FullSpotDetailDTO {
    const coords = this.resolveCoordinates(addr);
    const budgetInfo = getBudgetInfo(addr);
    const cat = classifySpot(addr);
    const gallery = addr.gallery_urls || [];
    const photos = addr.image_url ? [addr.image_url, ...gallery] : gallery;

    return {
      id: String(addr.id),
      name: addr.title || 'Adresse Toulousaine',
      title: addr.title || 'Adresse Toulousaine',
      lat: coords.lat,
      lng: coords.lng,
      cat,
      category: addr.tags && addr.tags.length > 0 ? addr.tags[0] : 'Adresse',
      desc: addr.description || '',
      description: addr.full_description || addr.description || '',
      full_description: addr.full_description || addr.description || '',
      image_url: addr.image_url,
      gallery_urls: gallery,
      photos: photos,
      rating: Number(addr.rating) || 4.8,
      price_level: budgetInfo.priceLevel,
      budget_label: budgetInfo.budgetLabel,
      estimated_budget: budgetInfo.estimatedBudget,
      price_min: budgetInfo.priceMin,
      price_max: budgetInfo.priceMax,
      location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
      address: addr.address || (addr.location ? `${addr.location}, Toulouse` : 'Toulouse'),
      phone: addr.telephone || '',
      website: addr.site_web || '',
      hours: addr.horaires || '',
      tags: addr.tags || [],
      breadcrumbs: addr.breadcrumbs || [],
      points_reward: addr.is_recommended ? 25 : (addr.rating >= 4.8 ? 20 : 10),
      is_recommended: !!addr.is_recommended,
      is_new: !!addr.is_new,
      likes_count: Number(addr.likes_count) || 0,
    };
  }

  // 1. Initialise immédiatement les 789 spots hors-ligne à 0ms
  private initOfflineBaseline() {
    const rawList = (dataset as any)?.addresses || [];
    this.memoryFullSpots = rawList.map((addr: any) => this.formatRawAddress(addr));
    this.memoryMapSpots = this.memoryFullSpots!.map((s) => ({
      id: s.id,
      name: s.name,
      title: s.title,
      lat: s.lat,
      lng: s.lng,
      cat: s.cat,
      category: s.category,
      rating: s.rating,
      price_level: s.price_level,
      budget_label: s.budget_label,
      points_reward: s.points_reward,
      is_recommended: s.is_recommended,
      is_new: s.is_new,
      image_url: s.image_url,
    }));
  }

  /**
   * Retourne la baseline complète des 789 spots (0ms synchrone)
   */
  public getAllSpotsBaseline(): FullSpotDetailDTO[] {
    if (!this.memoryFullSpots) {
      this.initOfflineBaseline();
    }
    return this.memoryFullSpots || [];
  }

  // 2. Récupère la liste optimisée pour la carte et les listes (léger < 50 Ko)
  public async getMapSpots(forceRefresh = false): Promise<MapSpotDTO[]> {
    if (!forceRefresh && this.memoryMapSpots && this.memoryMapSpots.length > 0) {
      return this.memoryMapSpots;
    }

    const cached = appCache.get<MapSpotDTO[]>('lpt_map_spots_v2');
    if (!forceRefresh && cached && cached.length > 0) {
      this.memoryMapSpots = cached;
      return cached;
    }

    try {
      // Sélectionne uniquement les colonnes nécessaires au rendu de la carte
      const { data, error } = await supabase
        .from('addresses')
        .select('id, title, lat, lng, rating, is_recommended, is_new, points_reward, image_url, tags')
        .order('rating', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const mapped = data.map((addr: any) => {
          const cat = classifySpot(addr);
          return {
            id: String(addr.id),
            name: addr.title,
            title: addr.title,
            lat: Number(addr.lat) || TOULOUSE_LAT,
            lng: Number(addr.lng) || TOULOUSE_LNG,
            cat,
            category: addr.tags && addr.tags.length > 0 ? addr.tags[0] : 'Adresse',
            rating: Number(addr.rating) || 4.8,
            price_level: '€€',
            budget_label: '€€',
            points_reward: Number(addr.points_reward) || (addr.is_recommended ? 25 : 10),
            is_recommended: !!addr.is_recommended,
            is_new: !!addr.is_new,
            image_url: addr.image_url,
          };
        });

        this.memoryMapSpots = mapped;
        appCache.set('lpt_map_spots_v2', mapped);
        return mapped;
      }
    } catch (e) {
      console.warn('[PlacesRepository] Supabase fetch fallback to baseline:', e);
    }

    return this.memoryMapSpots || [];
  }

  // 3. Récupère le détail complet d'une adresse à la demande (0 Ko inutile téléchargé au démarrage)
  public async getSpotDetail(spotId: string): Promise<FullSpotDetailDTO | null> {
    const id = String(spotId);
    if (this.memoryDetailsCache.has(id)) {
      return this.memoryDetailsCache.get(id)!;
    }

    // Chercher d'abord dans le dataset local pour un affichage instantané
    const local = ((dataset as any)?.addresses || []).find((a: any) => String(a.id) === id);

    let detail: FullSpotDetailDTO | null = null;
    if (local) {
      const budgetInfo = getBudgetInfo(local);
      const cat = classifySpot(local);
      detail = {
        id: String(local.id),
        name: local.title,
        title: local.title,
        lat: Number(local.lat) || TOULOUSE_LAT,
        lng: Number(local.lng) || TOULOUSE_LNG,
        cat,
        category: local.tags && local.tags.length > 0 ? local.tags[0] : 'Adresse',
        desc: local.description || '',
        description: local.full_description || local.description || '',
        full_description: local.full_description || local.description || '',
        image_url: local.image_url,
        gallery_urls: local.gallery_urls || [],
        photos: local.image_url ? [local.image_url, ...(local.gallery_urls || [])] : (local.gallery_urls || []),
        rating: Number(local.rating) || 4.8,
        price_level: budgetInfo.priceLevel,
        budget_label: budgetInfo.budgetLabel,
        location: local.location || 'Toulouse',
        address: local.address || `${local.location || local.title}, Toulouse`,
        phone: local.telephone || '',
        website: local.site_web || '',
        hours: local.horaires || '',
        tags: local.tags || [],
        breadcrumbs: local.breadcrumbs || [],
        points_reward: local.is_recommended ? 25 : (local.rating >= 4.8 ? 20 : 10),
        is_recommended: !!local.is_recommended,
        is_new: !!local.is_new,
      };
      this.memoryDetailsCache.set(id, detail);
    }

    // Enrichir de manière transparente avec Supabase si connecté
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        const budgetInfo = getBudgetInfo(data);
        const cat = classifySpot(data);
        detail = {
          id: String(data.id),
          name: data.title,
          title: data.title,
          lat: Number(data.lat) || (detail?.lat ?? TOULOUSE_LAT),
          lng: Number(data.lng) || (detail?.lng ?? TOULOUSE_LNG),
          cat,
          category: data.tags && data.tags.length > 0 ? data.tags[0] : 'Adresse',
          desc: data.description || '',
          description: data.full_description || data.description || '',
          full_description: data.full_description || data.description || '',
          image_url: data.image_url || detail?.image_url,
          gallery_urls: data.gallery_urls || detail?.gallery_urls || [],
          photos: data.image_url ? [data.image_url, ...(data.gallery_urls || [])] : (detail?.photos || []),
          rating: Number(data.rating) || detail?.rating || 4.8,
          price_level: budgetInfo.priceLevel,
          budget_label: budgetInfo.budgetLabel,
          location: data.location || detail?.location || 'Toulouse',
          address: data.address || detail?.address || 'Toulouse',
          phone: data.telephone || detail?.phone || '',
          website: data.site_web || detail?.website || '',
          hours: data.horaires || detail?.hours || '',
          tags: data.tags || detail?.tags || [],
          breadcrumbs: data.breadcrumbs || detail?.breadcrumbs || [],
          points_reward: Number(data.points_reward) || detail?.points_reward || 10,
          is_recommended: !!data.is_recommended,
          is_new: !!data.is_new,
          likes_count: Number(data.likes_count) || 0,
        };
        this.memoryDetailsCache.set(id, detail);
      }
    } catch {}

    return detail;
  }
}

export const placesRepository = new PlacesRepository();
