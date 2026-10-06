import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  PanResponder,
  Linking,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import styles from './home/homeStyles';
import HomeHeader from './home/HomeHeader';
import ProgressionBanner from './home/ProgressionBanner';

/**
 * Texte public d'un partenaire : jamais de montant ni de mention commerciale.
 * Filtre aussi les anciennes lignes créées avec le texte automatique « Offre exclusive membre - 150€ ».
 */
const publicPartnerText = (text?: string | null): string => {
  const t = (text || '').trim();
  if (!t || /^offre exclusive membre/i.test(t) || /\d+\s?€\s*(de privil|offert)/i.test(t)) return '';
  return t;
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  } catch (e) {}
};
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import {
  Menu,
  Bell,
  Search,
  Filter,
  X,
  RotateCcw,
  Sparkles,
  Star,
  MapPin,
  Heart,
  ArrowLeft,
  Ticket,
  CheckCircle,
  User,
  AlertTriangle,
  Compass,
  Utensils,
  UtensilsCrossed,
  Wine,
  GlassWater,
  Coffee,
  ShoppingBag,
  Film,
  Activity,
  Sun,
  Leaf,
  ChefHat,
  Home,
  Trophy,
  Dumbbell,
  Tag,
  ShieldCheck,
  CreditCard,
  SlidersHorizontal,
} from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import { PLACEHOLDER_PHOTO } from '../../constants/placeholder';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';
import AdminPortalModal from '../AdminPortalModal';
import AdminPasswordModal from '../AdminPasswordModal';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import dataset from '../../constants/dataset.json';
import { appCache } from '../../lib/dataCache';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';
import { getStoredPartners, syncPartnersWithSupabase, saveStoredPartners } from '../../lib/partnersStore';
import { getCategoryIcon } from '../../lib/categoryIcons';
import {
  loadDeviceLikedSpotIds,
  fetchGlobalLikesMap,
  toggleSpotLike,
} from '../../lib/likesStore';
import { discoveryStore, DiscoveryStats } from '../../lib/discoveryStore';
import { formatRating } from '../../lib/formatRating';
import {
  isAddressInCategory,
  getCategorySpotCount,
  getOrderedPopularCategories,
  CAT_RESTAURANTS,
  CAT_BARS,
  CAT_BOULANGERIES,
  CAT_EPICERIES,
  CAT_NOCTURNE,
  CAT_MODE,
  CAT_BEAUTE,
  CAT_DECO,
  CAT_ARTISANS,
  CAT_CULTURE,
  CAT_LOISIRS,
  CAT_SPORT,
  CAT_HOTELS,
  CAT_SERVICES,
} from '../../lib/categoryResolver';

import { Brand } from '../../constants/brand';
const ALL_EXPANDED_CATEGORIES = [
  { id: 'all', name: 'Toutes les adresses', icon_name: 'Compass', color: Brand.ink },
  { id: 'gourmand-gourmet', name: 'Gourmand & Restauration', icon_name: 'Utensils', color: Brand.primaryDeep },
  { id: 'trinquer-danser', name: 'Trinquer & Bars', icon_name: 'Wine', color: Brand.chouchou },
  { id: 'brunch-douceurs', name: 'Brunch & Douceurs', icon_name: 'CakeSlice', color: '#D97706' },
  { id: 'shopping-beaute', name: 'Shopping & Déco', icon_name: 'ShoppingBag', color: Brand.violet },
  { id: 'beaute-bien-etre', name: 'Beauté & Bien-être', icon_name: 'Scissors', color: Brand.primary },
  { id: 'culture-loisirs', name: 'Culture & Spectacles', icon_name: 'Ticket', color: Brand.violet },
  { id: 'sport-activites', name: 'Sport & Outdoor', icon_name: 'Dumbbell', color: '#1FA67A' },
  { id: 'terrasse', name: 'Terrasse & Rooftop', icon_name: 'Sun', color: '#F59E0B' },
  { id: 'bio-local', name: 'Bio & Écoresponsable', icon_name: 'Leaf', color: '#059669' },
  { id: 'fait-maison', name: 'Fait Maison', icon_name: 'ChefHat', color: '#DC2626' },
  { id: 'vie-pratique', name: 'Vie Pratique & Services', icon_name: 'Home', color: Brand.inkSoft },
];

const FILTER_KEYWORDS_MAP: Record<string, string[]> = {
  'gourmand-gourmet': ['gourmand', 'restauran', 'bistrot', 'brasserie', 'gastrono', 'manger', 'plat', 'recette', 'nourriture'],
  'trinquer-danser': ['trinquer', 'bar', 'biere', 'vin', 'cocktail', 'pub', 'apero', 'fete', 'nuit', 'club', 'cave'],
  'brunch-douceurs': ['brunch', 'patisser', 'boulanger', 'douceur', 'sucre', 'gateau', 'salon de the', 'coffee', 'cafe', 'petit-dejeuner'],
  'shopping-beaute': ['shopping', 'boutique', 'mode', 'vetement', 'deco', 'maison', 'accessoire', 'friperie', 'bijou', 'beaute'],
  'beaute-bien-etre': ['beaute', 'bien-etre', 'coiffeur', 'spa', 'massage', 'soin', 'institut', 'esthetique', 'barbier', 'coiffure'],
  'culture-loisirs': ['culture', 'loisir', 'musee', 'theatre', 'cinema', 'escape', 'exposition', 'art', 'spectacle', 'jeux'],
  'sport-activites': ['sport', 'outdoor', 'fitness', 'yoga', 'pilates', 'escalade', 'danse', 'salle de sport', 'activite'],
  'terrasse': ['terrasse', 'rooftop', 'exterieur', 'patio', 'jardin'],
  'bio-local': ['bio', 'local', 'eco', 'circuit court', 'vegetar', 'vege', 'ecoresponsable'],
  'fait-maison': ['maison', 'artisan', 'traditionnel', 'fait maison'],
  'vie-pratique': ['pratique', 'service', 'coworking', 'transport', 'artisan', 'auto', 'imprimerie', 'pressing', 'reparation'],
};

const normalizeText = (str: string) => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const CATEGORY_SUBTAGS_CONFIG: Record<string, { id: string; label: string; keywords: string[] }[]> = {
  restaurants: [
    { id: 'italien', label: 'Italien & Pizza', keywords: ['italien', 'pizza', 'pates', 'pasta'] },
    { id: 'asiatique', label: 'Asiatique', keywords: ['asiat', 'japon', 'ramen', 'sushi', 'viet', 'chinois', 'thai', 'coreen', 'dim sum'] },
    { id: 'street', label: 'Burgers & Street', keywords: ['burger', 'street', 'tacos', 'fast food', 'kebab', 'street food'] },
    { id: 'bistrot', label: 'Bistrot & Brasserie', keywords: ['bistrot', 'brasserie', 'terroir', 'sud-ouest', 'tradition', 'gastronomie'] },
    { id: 'viande', label: 'Viandes & Grillades', keywords: ['viande', 'grill', 'steak', 'boeuf', 'cote de boeuf'] },
    { id: 'vege', label: 'Végé & Healthy', keywords: ['vege', 'vegan', 'salade', 'healthy', 'vegetar'] },
    { id: 'terrasse', label: 'En Terrasse', keywords: ['terrasse', 'rooftop', 'jardin', 'patio'] },
    { id: 'fait_maison', label: 'Fait Maison', keywords: ['fait maison', 'artisan', 'fait-maison'] },
  ],
  bars: [
    { id: 'cocktails', label: 'Cocktails & Mixo', keywords: ['cocktail', 'mixolog'] },
    { id: 'bieres', label: 'Bières & Pubs', keywords: ['biere', 'beer', 'brasserie', 'pub'] },
    { id: 'vin_tapas', label: 'Vin & Tapas', keywords: ['vin', 'tapas', 'cave', 'planche'] },
    { id: 'terrasse_bar', label: 'En Terrasse', keywords: ['terrasse', 'rooftop'] },
    { id: 'soiree_nuit', label: 'Fête & Soirées', keywords: ['nuit', 'club', 'dj', 'danse', 'nocturne', 'discotheque'] },
    { id: 'cafe_the', label: 'Cafés & Salons de thé', keywords: ['cafe', 'the', 'coffee', 'salon de the'] },
  ],
  boulangeries: [
    { id: 'boulangerie_pain', label: 'Pains & Baguettes', keywords: ['boulanger', 'pain', 'croissant', 'viennois'] },
    { id: 'patisseries', label: 'Pâtisseries & Gâteaux', keywords: ['patiss', 'gateau', 'douceur', 'sucre'] },
    { id: 'brunch', label: 'Brunchs & Cafés', keywords: ['brunch', 'oeuf', 'pancake', 'petit-dejeuner'] },
    { id: 'coffee_shop', label: 'Coffee Shops', keywords: ['coffee', 'salon de the', 'latte', 'cafe'] },
    { id: 'glaces', label: 'Glaciers & Desserts', keywords: ['glace', 'crepe', 'gaufre', 'dessert'] },
  ],
  shopping: [
    { id: 'mode_vetements', label: 'Mode & Vêtements', keywords: ['pret-a-porter', 'mode', 'vetement', 'robe'] },
    { id: 'bijoux_accessoires', label: 'Bijoux & Accessoires', keywords: ['bijou', 'accessoire', 'sac', 'chapeau'] },
    { id: 'deco_maison', label: 'Déco & Design', keywords: ['deco', 'maison', 'mobilier', 'design'] },
    { id: 'vintage_fripes', label: 'Fripes & Vintage', keywords: ['fripe', 'vintage', 'seconde main'] },
    { id: 'cadeaux_artisans', label: 'Cadeaux & Artisans', keywords: ['cadeau', 'createur', 'artisan'] },
  ],
  beaute: [
    { id: 'coiffeurs', label: 'Coiffure & Barbiers', keywords: ['coiff', 'barbier'] },
    { id: 'spa_massages', label: 'Spa & Massages', keywords: ['spa', 'massage', 'relax', 'hammam'] },
    { id: 'soins_ongles', label: 'Onglerie & Soins', keywords: ['ongl', 'manucure', 'soin', 'institut', 'esthet'] },
    { id: 'bio_naturel', label: 'Naturel & Bio', keywords: ['bio', 'naturel'] },
  ],
  culture: [
    { id: 'spectacles_theatre', label: 'Théâtres & Spectacles', keywords: ['theatre', 'spectacle', 'concert'] },
    { id: 'musees_arts', label: 'Musées & Expos', keywords: ['musee', 'expo', 'galerie', 'art'] },
    { id: 'jeux_escape', label: 'Jeux & Escape Games', keywords: ['escape', 'jeu', 'bowling', 'laser', 'arcade'] },
    { id: 'sport_fitness', label: 'Sport & Outdoor', keywords: ['sport', 'fitness', 'escalade', 'yoga', 'salle de sport'] },
  ],
};

const getCategoryGroupKey = (catId: string, catName?: string): string => {
  const cName = normalizeText(catName || '');
  const cId = (catId || '').toLowerCase();
  if (
    cId === CAT_RESTAURANTS ||
    cId === 'gourmand-gourmet' ||
    cName.includes('restauran') ||
    cName.includes('gourmand')
  ) {
    return 'restaurants';
  }
  if (
    cId === CAT_BARS ||
    cId === CAT_NOCTURNE ||
    cId === 'trinquer-danser' ||
    cName.includes('bar') ||
    cName.includes('trinquer') ||
    cName.includes('nocturne') ||
    cName.includes('biere')
  ) {
    return 'bars';
  }
  if (
    cId === CAT_BOULANGERIES ||
    cId === CAT_EPICERIES ||
    cId === 'brunch-douceurs' ||
    cName.includes('boulanger') ||
    cName.includes('patiss') ||
    cName.includes('brunch') ||
    cName.includes('douceur') ||
    cName.includes('epicer')
  ) {
    return 'boulangeries';
  }
  if (
    cId === CAT_MODE ||
    cId === CAT_DECO ||
    cId === CAT_ARTISANS ||
    cId === 'shopping-beaute' ||
    cName.includes('mode') ||
    cName.includes('shop') ||
    cName.includes('deco') ||
    cName.includes('artisan')
  ) {
    return 'shopping';
  }
  if (
    cId === CAT_BEAUTE ||
    cId === 'beaute-bien-etre' ||
    cName.includes('beaut') ||
    cName.includes('bien-etre') ||
    cName.includes('coiff')
  ) {
    return 'beaute';
  }
  if (
    cId === CAT_CULTURE ||
    cId === CAT_LOISIRS ||
    cId === CAT_SPORT ||
    cId === 'culture-loisirs' ||
    cId === 'sport-activites' ||
    cName.includes('cultur') ||
    cName.includes('loisir') ||
    cName.includes('sport') ||
    cName.includes('spectacle')
  ) {
    return 'culture';
  }
  return 'other';
};

const { width, height } = Dimensions.get('window');
const APPLE_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

interface Category {
  id: string;
  name: string;
  slug?: string;
  icon_name: string;
  color: string;
}

interface Address {
  id: string;
  title: string;
  description: string;
  image_url: string;
  rating: number;
  category_id: string;
  price_level: string;
  location: string;
  is_recommended: boolean;
  is_new: boolean;
}

export const DEFAULT_BOOKING_URL = 'https://www.phoenix-egalite-des-chances.com';

export const getEventBookingUrl = (event: any): string => {
  if (event?.booking_url && typeof event.booking_url === 'string' && event.booking_url.trim()) {
    const raw = event.booking_url.trim();
    return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
  }
  return DEFAULT_BOOKING_URL;
};

export const redirectToBookingUrl = (url: string) => {
  const targetUrl = url && (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url || DEFAULT_BOOKING_URL}`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      window.location.href = targetUrl;
    } catch (e) {
      window.open(targetUrl, '_self');
    }
  } else {
    Linking.openURL(targetUrl).catch(() => {
      if (typeof window !== 'undefined') {
        window.location.href = targetUrl;
      }
    });
  }
};

const MOCK_EVENTS = [
  { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: "Soirée de lancement du guide 2026", description: "Soirée exclusive pour découvrir les nouvelles adresses sélectionnées par l'association.", event_date: '2026-05-24', event_time: '19:00', location: 'Quai de la Daurade, Toulouse', price: 25.00, booking_url: DEFAULT_BOOKING_URL, max_places: 150 },
  { id: 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', title: "Toulouse à Table !", description: "Grand banquet toulousain partagé en plein cœur de la ville rose.", event_date: '2026-06-15', event_time: '12:00', location: 'Divers lieux, Toulouse', price: 15.00, booking_url: DEFAULT_BOOKING_URL, max_places: 80 }
];

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Menu,
  Bell,
  Search,
  Filter,
  X,
  RotateCcw,
  Sparkles,
  Star,
  MapPin,
  Heart,
  ArrowLeft,
  Ticket,
  CheckCircle,
  User,
  AlertTriangle,
  Compass,
  Utensils,
  UtensilsCrossed,
  Wine,
  GlassWater,
  Coffee,
  ShoppingBag,
  Film,
  Activity,
  Sun,
  Leaf,
  ChefHat,
  Home,
  Trophy,
  Dumbbell,
  Tag,
};

// Tree-shaked & memoized dynamic icon resolver
interface DynamicIconProps {
  name?: string;
  title?: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function DynamicIcon({ name, title, color, size = 20, strokeWidth = 2.2 }: DynamicIconProps) {
  const IconComponent = getCategoryIcon(title || name, name);
  return <IconComponent color={color} size={size} strokeWidth={strokeWidth} />;
}

export default function HomeView({
  onChangeTab,
  onToggleDock,
  onSelectSpot,
}: {
  onChangeTab?: (tab: any) => void;
  onToggleDock?: (visible: boolean) => void;
  onSelectSpot?: (spotId: string) => void;
}) {
  const [selectedSpotDetail, setSelectedSpotDetail] = useState<SpotDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const searchInputRef = useRef<TextInput>(null);
  
  // Smooth Brutalist Search focus and animation states
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchFocus = useSharedValue(0);
  const searchPulse = useSharedValue(0);

  useEffect(() => {
    if (isSearchFocused) {
      searchFocus.value = withTiming(1, { duration: 300 });
      searchPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: APPLE_EASE }),
          withTiming(0, { duration: 1500, easing: APPLE_EASE })
        ),
        -1,
        true
      );
    } else {
      searchFocus.value = withTiming(0, { duration: 300 });
      searchPulse.value = 0;
    }
  }, [isSearchFocused]);

  // Label animated styles (Neo-Brutalist rotation & color scaling)
  const labelStyle = useAnimatedStyle(() => {
    const rotateVal = (1 - searchFocus.value) * -1.5;
    const scaleVal = 1 + searchFocus.value * 0.05;
    return {
      transform: [
        { rotate: `${rotateVal}deg` },
        { scale: scaleVal }
      ],
      backgroundColor: searchFocus.value > 0.5 ? Brand.primary : Brand.ink // Toulouse Red focus color
    };
  });

  // Border pulsing animated styles
  const borderStyle = useAnimatedStyle(() => {
    return {};
  });
  
  // View Mode for Home vs See All pages
  const [viewMode, setViewMode] = useState<'home' | 'see_all_recommended' | 'see_all_new'>('home');

  // User Gamified Discovery & Points State
  const [discoveryStats, setDiscoveryStats] = useState<DiscoveryStats>(discoveryStore.getStats());

  useEffect(() => {
    const unsub = discoveryStore.subscribe((stats) => {
      setDiscoveryStats({ ...stats });
    });
    return () => unsub();
  }, []);

  // Progressive rendering & Debounced search for max performance
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(24);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 200);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Category & Precision Filtering states
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);
  const [selectedSubTag, setSelectedSubTag] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<'likes' | 'rating' | 'new' | 'recommended'>('likes');
  const [selectedPrice, setSelectedPrice] = useState<'all' | '€' | '€€' | '€€€'>('all');
  const [inCategorySearch, setInCategorySearch] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedSubTag) count++;
    if (selectedPrice !== 'all') count++;
    if (selectedSort !== 'likes') count++;
    if (inCategorySearch.trim().length > 0) count++;
    return count;
  }, [selectedSubTag, selectedPrice, selectedSort, inCategorySearch]);

  const handleCategoryChange = (catId: string | null) => {
    triggerHaptic();
    setSelectedCategoryFilter(prev => (prev === catId ? null : catId));
    setSelectedSubTag(null);
    setSelectedPrice('all');
    setInCategorySearch('');
    setDisplayLimit(24);
  };

  const resetSubFilters = () => {
    triggerHaptic();
    setSelectedSubTag(null);
    setSelectedPrice('all');
    setSelectedSort('likes');
    setInCategorySearch('');
    setDisplayLimit(24);
  };

  const resetAllFilters = () => {
    triggerHaptic();
    setSelectedCategoryFilter(null);
    setSelectedSubTag(null);
    setSelectedSort('likes');
    setSelectedPrice('all');
    setInCategorySearch('');
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setDisplayLimit(24);
    setViewMode('home');
  };

  // Supabase states
  const [categories, setCategories] = useState<Category[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [sponsoredPartners, setSponsoredPartners] = useState<any[]>(() => getStoredPartners());
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  const [bookingEvent, setBookingEvent] = useState<any | null>(null);
  const [successEvent, setSuccessEvent] = useState<any | null>(null);
  const [infoAlert, setInfoAlert] = useState<{ title: string; message: string; type?: 'info' | 'warning' | 'error' } | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const adminTapCountRef = React.useRef(0);
  const adminTapTimerRef = React.useRef<any>(null);

  const handleTitlePress = () => {
    triggerHaptic();
    adminTapCountRef.current += 1;
    if (adminTapTimerRef.current) {
      clearTimeout(adminTapTimerRef.current);
    }

    if (adminTapCountRef.current >= 7) {
      adminTapCountRef.current = 0;
      setShowPasswordModal(true);
      return;
    }

    adminTapTimerRef.current = setTimeout(() => {
      adminTapCountRef.current = 0;
    }, 2500);
  };

  const handleBookEvent = (event: any) => {
    triggerHaptic();
    setBookingEvent(event);
  };

  const handleConfirmBooking = (event: any) => {
    triggerHaptic();
    const targetUrl = getEventBookingUrl(event);
    setBookingEvent(null);
    // Navigation directe immédiate sur confirmation (infaillible, geste utilisateur)
    redirectToBookingUrl(targetUrl);
    setSuccessEvent({ ...event, booking_url: targetUrl });
  };

  // Sécurité auto-redirection si la carte validée est affichée
  useEffect(() => {
    if (!successEvent) {
      setRedirectCountdown(null);
      return;
    }

    const targetUrl = getEventBookingUrl(successEvent);
    setRedirectCountdown(1);

    const redirectTimer = setTimeout(() => {
      redirectToBookingUrl(targetUrl);
    }, 1000);

    return () => {
      clearTimeout(redirectTimer);
    };
  }, [successEvent]);

  // Skeleton pulsing animation value (active only while loading)
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (loading) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 800 }),
          withTiming(0.6, { duration: 800 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = 1;
    }
    return () => {
      cancelAnimation(pulseOpacity);
    };
  }, [loading]);

  // Load Categories & Addresses dynamically from Supabase
  const loadSupabaseData = async (forceRefresh: boolean = false) => {
    try {
      // Sync stored partners immediately (0ms instant response)
      const currentStoredPartners = getStoredPartners();
      setSponsoredPartners(currentStoredPartners);

      if (!forceRefresh) {
        // Check in-memory SWR cache first (0ms instant response)
        const cachedCat = appCache.get<Category[]>('categories');
        const cachedAddr = appCache.get<Address[]>('addresses');
        const cachedEvt = appCache.get<any[]>('events');
        if (cachedCat && cachedAddr && cachedEvt) {
          setCategories(cachedCat);
          setAddresses(cachedAddr);
          setEvents(cachedEvt);
          setLoading(false);
          // Continuer en arrière-plan pour récupérer les données fraîches de Supabase
        }
      }

      setLoading(true);
      
      // Check if keys are set
      const hasUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const hasKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!hasUrl || !hasKey || !supabase) {
        setIsConfigured(false);
        setLoading(false);
        return;
      }

      setIsConfigured(true);

      // Fetch Categories with safe select
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true });
      if (catError) throw catError;

      // Fetch Addresses with explicit projection (Lean DTO)
      const { data: addrData, error: addrError } = await supabase
        .from('addresses')
        .select('id, title, category_id, location, address, image_url, rating, price_level, is_recommended, is_new, lat, lng, tags, telephone, site_web, horaires, description')
        .order('created_at', { ascending: false });
      if (addrError) throw addrError;

      const finalCategories = catData && catData.length > 0 ? catData : (dataset.categories as any);
      setCategories(finalCategories);
      
      const localMap = new Map((dataset.addresses as any[]).map(a => [a.id, a]));
      const rawAddresses = addrData && addrData.length > 0 ? addrData : (dataset.addresses as any);
      const mergedAddresses = rawAddresses.map((dbAddr: any) => {
        const local = localMap.get(dbAddr.id) || {};
        return {
          ...local,
          ...dbAddr,
          telephone: dbAddr.telephone || local.telephone || '',
          site_web: dbAddr.site_web || local.site_web || '',
          horaires: local.horaires || dbAddr.horaires || '',
        };
      });
      setAddresses(mergedAddresses as any);

      // Fetch Events with explicit projection
      let finalEvents = MOCK_EVENTS;
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, title, description, event_date, event_time, location, price, max_participants, image_url, booking_url, max_places')
          .order('event_date', { ascending: true });

        if (!eventsError && eventsData && eventsData.length > 0) {
          finalEvents = eventsData.map((ev: any) => ({
            ...ev,
            booking_url: getEventBookingUrl(ev),
          }));
        } else {
          finalEvents = MOCK_EVENTS;
        }
        setEvents(finalEvents);
      } catch (e) {
        setEvents(MOCK_EVENTS);
      }

      // Fetch & Sync Sponsored Partners (Top Netflix) in background
      try {
        const synced = await syncPartnersWithSupabase();
        if (synced && synced.length > 0) {
          setSponsoredPartners(synced);
        }
      } catch (e) {
        // Fallback already in place
      }

      // Save to in-memory SWR cache (10 min TTL)
      appCache.set('categories', finalCategories);
      appCache.set('addresses', mergedAddresses);
      appCache.set('events', finalEvents);

      setLoading(false);
    } catch (err: any) {
      console.warn('loadSupabaseData failed:', err);
      // Fallback
      setCategories(dataset.categories as any);
      setAddresses(dataset.addresses as any);
      setEvents(MOCK_EVENTS);
      setIsConfigured(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupabaseData();
    loadDeviceLikedSpotIds().then(setFavorites);
    fetchGlobalLikesMap().then(setLikesMap);
    
    // Listen to real-time changes from Admin Portal
    const onPartnersChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSponsoredPartners(e.detail);
      }
    };
    const onAddressesChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        const localMap = new Map((dataset.addresses as any[]).map(a => [a.id, a]));
        const merged = e.detail.map((dbAddr: any) => {
          const local = localMap.get(dbAddr.id) || {};
          return {
            ...local,
            ...dbAddr,
            telephone: dbAddr.telephone || local.telephone || '',
            site_web: dbAddr.site_web || local.site_web || '',
            horaires: local.horaires || dbAddr.horaires || '',
          };
        });
        setAddresses(merged as any);
      } else {
        loadSupabaseData(true);
      }
    };
    const onCategoriesChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setCategories(e.detail);
      } else {
        loadSupabaseData(true);
      }
    };
    const onEventsChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setEvents(e.detail.map((ev: any) => ({
          ...ev,
          booking_url: getEventBookingUrl(ev),
        })));
      } else {
        loadSupabaseData(true);
      }
    };
    const onLikesUpdated = (e: any) => {
      if (e.detail?.spotId) {
        setLikesMap(prev => ({
          ...prev,
          [e.detail.spotId]: e.detail.newCount,
        }));
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pt_partners_changed', onPartnersChanged);
      window.addEventListener('pt_addresses_changed', onAddressesChanged);
      window.addEventListener('pt_categories_changed', onCategoriesChanged);
      window.addEventListener('pt_events_changed', onEventsChanged);
      window.addEventListener('pt_likes_updated', onLikesUpdated);
    }


    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pt_partners_changed', onPartnersChanged);
        window.removeEventListener('pt_addresses_changed', onAddressesChanged);
        window.removeEventListener('pt_categories_changed', onCategoriesChanged);
        window.removeEventListener('pt_events_changed', onEventsChanged);
        window.removeEventListener('pt_likes_updated', onLikesUpdated);
      }
    };
  }, []);

  const isAnyModalOpen = showAllCategories || showFilterModal || !!bookingEvent || !!successEvent || !!infoAlert || !!selectedSpotDetail || showAdminModal || showPasswordModal || showPrivacyPolicy;

  const orderedModalCategories = useMemo(() => {
    return getOrderedPopularCategories(categories, addresses, true);
  }, [categories, addresses]);

  useEffect(() => {
    if (onToggleDock) {
      onToggleDock(!isAnyModalOpen);
    }
  }, [isAnyModalOpen, onToggleDock]);

  // Skeleton pulse style
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const toggleFavorite = async (id: string) => {
    triggerHaptic();
    const { updatedLikedIds, updatedLikesMap } = await toggleSpotLike(
      id,
      likesMap,
      favorites
    );
    setFavorites(updatedLikedIds);
    setLikesMap(updatedLikesMap);
  };

  const categoryBaseAddresses = useMemo(() => {
    const q = debouncedSearchQuery.trim() ? normalizeText(debouncedSearchQuery) : '';
    const keywords = selectedCategoryFilter ? FILTER_KEYWORDS_MAP[selectedCategoryFilter] : null;

    return addresses.filter(addr => {
      if (q) {
        const titleNorm = normalizeText(addr.title);
        const locNorm = normalizeText(addr.location);
        const descNorm = normalizeText(addr.description);
        const tagsNorm = normalizeText(((addr as any).tags || []).join(' '));
        const crumbsNorm = normalizeText(((addr as any).breadcrumbs || []).join(' '));
        const fullDescNorm = normalizeText((addr as any).full_description || '');
        const matchSearch =
          titleNorm.includes(q) ||
          locNorm.includes(q) ||
          descNorm.includes(q) ||
          tagsNorm.includes(q) ||
          crumbsNorm.includes(q) ||
          fullDescNorm.includes(q);
        if (!matchSearch) return false;
      }

      if (selectedCategoryFilter) {
        if (isAddressInCategory(addr, selectedCategoryFilter)) {
          return true;
        }
        if (keywords && Array.isArray(keywords)) {
          const fullSearchableBlob = normalizeText(
            `${addr.title} ${addr.description} ${(addr as any).full_description || ''} ${((addr as any).tags || []).join(' ')} ${((addr as any).breadcrumbs || []).join(' ')}`
          );
          return keywords.some(kw => fullSearchableBlob.includes(normalizeText(kw)));
        }
        return false;
      }

      return true;
    });
  }, [addresses, debouncedSearchQuery, selectedCategoryFilter]);

  const activeCategoryMeta = useMemo(() => {
    if (!selectedCategoryFilter) return null;
    return (
      categories.find(c => c.id === selectedCategoryFilter) ||
      ALL_EXPANDED_CATEGORIES.find(c => c.id === selectedCategoryFilter) ||
      null
    );
  }, [selectedCategoryFilter, categories]);

  const availableSubTags = useMemo(() => {
    if (!selectedCategoryFilter) return [];

    const groupKey = getCategoryGroupKey(selectedCategoryFilter, activeCategoryMeta?.name);
    const presets = CATEGORY_SUBTAGS_CONFIG[groupKey] || [];

    const validPresets: { id: string; label: string; count: number; keywords: string[] }[] = [];

    for (const p of presets) {
      let count = 0;
      for (const addr of categoryBaseAddresses) {
        const fullBlob = normalizeText(
          `${addr.title} ${addr.description} ${(addr as any).full_description || ''} ${((addr as any).tags || []).join(' ')} ${((addr as any).breadcrumbs || []).join(' ')}`
        );
        if (p.keywords.some(kw => fullBlob.includes(normalizeText(kw)))) {
          count++;
        }
      }
      if (count > 0) {
        validPresets.push({
          id: p.id,
          label: p.label,
          count,
          keywords: p.keywords,
        });
      }
    }

    if (validPresets.length >= 2) {
      return validPresets;
    }

    // Dynamic fallback from addresses' tags & breadcrumbs
    const tagCountMap: Record<string, number> = {};
    const IGNORED_TAGS = new Set([
      'toulouse',
      'france',
      'restaurant',
      'restaurants',
      'bar',
      'bars',
      'shopping',
      'beaute',
      'culture',
      'loisirs',
      'ouvert actuellement',
      'guide',
      'le petit tou',
    ]);

    for (const addr of categoryBaseAddresses) {
      const combined = [
        ...((addr as any).tags || []),
        ...((addr as any).breadcrumbs || []),
      ];
      for (const rawTag of combined) {
        const cleanTag = String(rawTag || '').trim();
        const normTag = normalizeText(cleanTag);
        if (!normTag || normTag.length < 3 || IGNORED_TAGS.has(normTag)) continue;
        if (normTag.includes('ouvert actuellement')) continue;
        tagCountMap[cleanTag] = (tagCountMap[cleanTag] || 0) + 1;
      }
    }

    return Object.entries(tagCountMap)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({
        id: normalizeText(tag),
        label: tag,
        count,
        keywords: [tag],
      }));
  }, [selectedCategoryFilter, activeCategoryMeta, categoryBaseAddresses]);

  const categoryFilteredAddresses = useMemo(() => {
    let result = categoryBaseAddresses;

    // In-category search filter
    const subQ = inCategorySearch.trim() ? normalizeText(inCategorySearch) : '';
    if (subQ) {
      result = result.filter(addr => {
        const fullBlob = normalizeText(
          `${addr.title} ${addr.description} ${(addr as any).full_description || ''} ${addr.location || ''} ${((addr as any).tags || []).join(' ')} ${((addr as any).breadcrumbs || []).join(' ')}`
        );
        return fullBlob.includes(subQ);
      });
    }

    // Sub-tag / speciality filter
    if (selectedSubTag) {
      const activePreset = availableSubTags.find(s => s.id === selectedSubTag);
      const keywords = activePreset ? activePreset.keywords : [selectedSubTag];

      result = result.filter(addr => {
        const fullBlob = normalizeText(
          `${addr.title} ${addr.description} ${(addr as any).full_description || ''} ${((addr as any).tags || []).join(' ')} ${((addr as any).breadcrumbs || []).join(' ')}`
        );
        return keywords.some(kw => fullBlob.includes(normalizeText(kw)));
      });
    }

    // Price filter
    if (selectedPrice !== 'all') {
      result = result.filter(addr => addr.price_level === selectedPrice);
    }

    // Sorting
    return [...result].sort((a, b) => {
      const likesA = likesMap[a.id] ?? (Number((a as any).likes_count) || 0);
      const likesB = likesMap[b.id] ?? (Number((b as any).likes_count) || 0);
      const ratingA = a.rating || 0;
      const ratingB = b.rating || 0;

      if (selectedSort === 'rating') {
        if (ratingB !== ratingA) return ratingB - ratingA;
        return likesB - likesA;
      }

      if (selectedSort === 'recommended') {
        if (a.is_recommended && !b.is_recommended) return -1;
        if (!a.is_recommended && b.is_recommended) return 1;
        return likesB - likesA;
      }

      if (selectedSort === 'new') {
        if (a.is_new && !b.is_new) return -1;
        if (!a.is_new && b.is_new) return 1;
        return likesB - likesA;
      }

      // Default: 'likes' descending
      if (likesB !== likesA) return likesB - likesA;
      return ratingB - ratingA;
    });
  }, [
    categoryBaseAddresses,
    inCategorySearch,
    selectedSubTag,
    availableSubTags,
    selectedPrice,
    selectedSort,
    likesMap,
  ]);

  const filteredAddresses = categoryFilteredAddresses;

  const hasAnyActiveSubFilter = Boolean(
    selectedSubTag ||
    (selectedPrice && selectedPrice !== 'all') ||
    (inCategorySearch && inCategorySearch.trim().length > 0) ||
    selectedSort !== 'likes'
  );

  const recommendedAddresses = useMemo(() => {
    return categoryBaseAddresses
      .filter(addr => addr.is_recommended)
      .sort((a, b) => {
        const likesA = likesMap[a.id] ?? (Number((a as any).likes_count) || 0);
        const likesB = likesMap[b.id] ?? (Number((b as any).likes_count) || 0);
        if (likesB !== likesA) {
          return likesB - likesA;
        }
        return (b.rating || 0) - (a.rating || 0);
      });
  }, [categoryBaseAddresses, likesMap]);

  const newAddresses = useMemo(() => {
    return categoryBaseAddresses.filter(addr => addr.is_new);
  }, [categoryBaseAddresses]);

  // Memoized ordered popular categories & spot counts (calculated once per dataset change)
  const orderedPopularCategories = useMemo(() => {
    return getOrderedPopularCategories(categories, addresses, false);
  }, [categories, addresses]);

  const categorySpotCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of categories) {
      counts[cat.id] = getCategorySpotCount(addresses, cat.id);
    }
    return counts;
  }, [categories, addresses]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Main Vertical Scroll Container */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Row & Brutalist Search Bar */}
          <HomeHeader
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSearchFocus={() => setIsSearchFocused(true)}
            onSearchBlur={() => setIsSearchFocused(false)}
            onTitlePress={handleTitlePress}
            labelStyle={labelStyle}
          />

          {/* Personal Progression & Discovery Bar */}
          <ProgressionBanner
            discoveryStats={discoveryStats}
            onOpenWallet={() => onChangeTab?.('cards')}
          />

          {/* Config Alert Banner (Visible only if Supabase environment variables are missing) */}
          {!isConfigured && !loading && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                Veuillez configurer votre fichier `.env` avec vos identifiants Supabase pour synchroniser vos adresses de Toulouse.
              </Text>
            </View>
          )}

          {/* DYNAMIC VIEW ROUTING BASED ON FILTERING & VIEW MODE */}
          {(selectedCategoryFilter || searchQuery.trim().length > 0) ? (
            /* ── 1. ACTIVE FILTERED RESULTS VIEW ── */
            <View style={styles.filteredViewContainer}>
              {/* 1. SIBLING HORIZONTAL CATEGORY SWITCHER */}
              <View style={styles.editorialCategoryScrollWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.editorialCategoryScroll}
                >
                  <Pressable
                    style={[
                      styles.editorialCatPill,
                      selectedCategoryFilter === null && styles.editorialCatPillActive,
                    ]}
                    onPress={() => handleCategoryChange(null)}
                  >
                    <Compass size={14} color={selectedCategoryFilter === null ? Brand.white : Brand.inkSoft} strokeWidth={2} />
                    <Text
                      style={[
                        styles.editorialCatPillText,
                        selectedCategoryFilter === null && styles.editorialCatPillTextActive,
                      ]}
                    >
                      Toutes
                    </Text>
                  </Pressable>

                  {orderedPopularCategories.map(cat => {
                    const isActive = selectedCategoryFilter === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.editorialCatPill,
                          isActive && styles.editorialCatPillActive,
                        ]}
                        onPress={() => handleCategoryChange(cat.id)}
                      >
                        <DynamicIcon
                          name={cat.icon_name}
                          title={cat.name}
                          color={isActive ? Brand.white : cat.color || Brand.inkSoft}
                          size={14}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.editorialCatPillText,
                            isActive && styles.editorialCatPillTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* 2. THE EDITORIAL CATEGORY HERO CARD (LE PETIT TOU MASTERPIECE) */}
              <View style={styles.editorialHeroCard}>
                {/* Top Row: Category Identity & Quick Dismiss */}
                <View style={styles.editorialHeroHeaderRow}>
                  <View style={styles.editorialHeroLeft}>
                    <View
                      style={[
                        styles.editorialIconBox,
                        { backgroundColor: activeCategoryMeta ? `${activeCategoryMeta.color || Brand.primary}15` : Brand.primarySoft },
                      ]}
                    >
                      <DynamicIcon
                        name={activeCategoryMeta?.icon_name || 'Utensils'}
                        title={activeCategoryMeta?.name || 'Catégorie'}
                        color={activeCategoryMeta?.color || Brand.primary}
                        size={24}
                        strokeWidth={2}
                      />
                    </View>

                    <View style={styles.editorialTitleBlock}>
                      <View style={styles.editorialLabelRow}>
                        <Text style={styles.editorialEyebrow}>SÉLECTION LE PETIT TOU</Text>
                        <View style={styles.editorialDot} />
                        <Text style={styles.editorialCountLabel}>
                          {categoryFilteredAddresses.length} adresse{categoryFilteredAddresses.length > 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={styles.editorialTitleText} numberOfLines={1}>
                        {activeCategoryMeta?.name || (searchQuery ? `Recherche : "${searchQuery}"` : 'Toutes les adresses')}
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.editorialCloseBtn}
                    onPress={resetAllFilters}
                    hitSlop={12}
                    accessibilityLabel="Fermer le filtre"
                  >
                    <X size={18} color={Brand.inkSoft} strokeWidth={2} />
                  </Pressable>
                </View>

                {/* Main Action Bar: Prominent Filter & Sort Button + Fast Search */}
                <View style={styles.editorialActionBar}>
                  <Pressable
                    style={[
                      styles.editorialFilterBtn,
                      activeFilterCount > 0 && styles.editorialFilterBtnActive,
                    ]}
                    onPress={() => {
                      triggerHaptic();
                      setShowFilterModal(true);
                    }}
                  >
                    <SlidersHorizontal
                      size={15}
                      color={Brand.white}
                      strokeWidth={2}
                    />
                    <Text
                      style={[
                        styles.editorialFilterBtnText,
                        activeFilterCount > 0 && styles.editorialFilterBtnTextActive,
                      ]}
                    >
                      Filtres & Tri
                    </Text>
                    {activeFilterCount > 0 && (
                      <View style={styles.editorialFilterBadge}>
                        <Text style={styles.editorialFilterBadgeText}>{activeFilterCount}</Text>
                      </View>
                    )}
                  </Pressable>

                  <View style={styles.editorialSearchBox}>
                    <Search size={15} color={Brand.inkMute} strokeWidth={2} style={{ marginRight: 8 }} />
                    <TextInput
                      style={styles.editorialSearchInput}
                      placeholder={
                        activeCategoryMeta
                          ? `Dans ${activeCategoryMeta.name}...`
                          : 'Recherche rapide...'
                      }
                      placeholderTextColor={Brand.inkSoft}
                      value={inCategorySearch}
                      onChangeText={setInCategorySearch}
                    />
                    {inCategorySearch.length > 0 && (
                      <Pressable onPress={() => setInCategorySearch('')} hitSlop={8}>
                        <X size={14} color={Brand.inkSoft} strokeWidth={2} />
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Sub-Category / Speciality Chips (Inside the Hero Card, Seamless) */}
                {availableSubTags.length > 0 && (
                  <View style={styles.editorialSpecialitiesRow}>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.editorialSpecialitiesScroll}
                    >
                      <Pressable
                        style={[
                          styles.editorialSpecialityChip,
                          selectedSubTag === null && styles.editorialSpecialityChipActive,
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedSubTag(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.editorialSpecialityChipText,
                            selectedSubTag === null && styles.editorialSpecialityChipTextActive,
                          ]}
                        >
                          Toutes ({categoryBaseAddresses.length})
                        </Text>
                      </Pressable>

                      {availableSubTags.map(sub => {
                        const isSelected = selectedSubTag === sub.id;
                        return (
                          <Pressable
                            key={sub.id}
                            style={[
                              styles.editorialSpecialityChip,
                              isSelected && styles.editorialSpecialityChipActive,
                            ]}
                            onPress={() => {
                              triggerHaptic();
                              setSelectedSubTag(isSelected ? null : sub.id);
                            }}
                          >
                            <Text
                              style={[
                                styles.editorialSpecialityChipText,
                                isSelected && styles.editorialSpecialityChipTextActive,
                              ]}
                            >
                              {sub.label}
                              <Text style={[styles.editorialSpecialityChipCount, isSelected && styles.editorialSpecialityChipCountActive]}>
                                {' '}({sub.count})
                              </Text>
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* Refined Status Bar: Current Sort & Active Badges */}
                <View style={styles.editorialStatusBar}>
                  <View style={styles.editorialStatusLeft}>
                    <Text style={styles.editorialStatusText}>
                      {selectedSort === 'likes' ? 'Plus aimés' :
                       selectedSort === 'rating' ? 'Mieux notés' :
                       selectedSort === 'recommended' ? 'Coups de cœur' : '🆕 Nouveautés'}
                      {selectedPrice !== 'all' ? ` • Budget ${selectedPrice}` : ''}
                      {inCategorySearch.trim().length > 0 ? ` • "${inCategorySearch}"` : ''}
                    </Text>
                  </View>

                  {hasAnyActiveSubFilter ? (
                    <Pressable style={styles.editorialResetBtn} onPress={resetSubFilters} hitSlop={8}>
                      <RotateCcw size={12} color={Brand.primaryDeep} style={{ marginRight: 4 }} />
                      <Text style={styles.editorialResetText}>Réinitialiser</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.editorialChangeSortBtn}
                      onPress={() => {
                        triggerHaptic();
                        setShowFilterModal(true);
                      }}
                      hitSlop={8}
                    >
                      <Text style={styles.editorialChangeSortText}>Tous les filtres ▾</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* 7. ADDRESS RESULTS LIST OR EMPTY STATE */}
              {categoryFilteredAddresses.length === 0 ? (
                <View style={styles.emptyFilteredBox}>
                  <Sparkles size={36} color="#E3DCE0" style={{ marginBottom: 10 }} />
                  <Text style={styles.emptyFilteredTitle}>Aucune adresse trouvée</Text>
                  <Text style={styles.emptyFilteredSub}>
                    Aucun résultat ne correspond à cette combinaison de filtres.
                  </Text>
                  <Pressable style={styles.emptyResetBtn} onPress={resetSubFilters}>
                    <RotateCcw size={14} color={Brand.white} style={{ marginRight: 6 }} />
                    <Text style={styles.emptyResetBtnText}>Élargir les filtres</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.verticalGridContainer}>
                  {categoryFilteredAddresses.slice(0, displayLimit).map(addr => {
                    const isFav = favorites.includes(addr.id);
                    const likesCount = likesMap[addr.id] ?? (Number((addr as any).likes_count) || 0);
                    return (
                      <Pressable
                        key={addr.id}
                        style={styles.gridCardItem}
                        onPress={() => {
                          const gallery = (addr as any).gallery_urls || [];
                          const allPhotos = addr.image_url ? [addr.image_url, ...gallery] : gallery;
                          setSelectedSpotDetail({
                            id: addr.id,
                            title: addr.title,
                            description: (addr as any).full_description || addr.description,
                            full_description: (addr as any).full_description || addr.description,
                            breadcrumbs: (addr as any).breadcrumbs || [],
                            tags: (addr as any).tags || [],
                            image_url: addr.image_url,
                            photos: allPhotos,
                            rating: addr.rating,
                            category: categories.find(c => c.id === addr.category_id)?.name || ((addr as any).tags ? (addr as any).tags[0] : 'Lieu'),
                            price_level: addr.price_level,
                            location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
                            address: (addr as any).address || addr.location || 'Toulouse',
                            phone: (addr as any).telephone || (addr as any).phone || '',
                            website: (addr as any).site_web || (addr as any).website || '',
                            hours: (addr as any).horaires || (addr as any).hours || '',
                          });
                        }}
                      >
                        <Image
                          source={{ uri: getOptimizedImageUrl(addr.image_url, 400) }}
                          style={styles.gridCardImage}
                          contentFit="cover"
                          transition={150}
                          cachePolicy="memory-disk"
                        />
                        <View style={styles.ratingBadgeGrid}>
                          <Star color={Brand.chouchou} size={11} fill={Brand.chouchou} />
                          <Text style={styles.ratingTextSmall}>
                            {formatRating(addr.rating)}
                          </Text>
                        </View>
                        <View style={styles.gridCardBody}>
                          <View style={styles.cardHeaderMetaRow}>
                            <Text style={styles.gridCardCategory}>
                              {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'}
                            </Text>
                            {addr.price_level ? (
                              <View style={styles.cardPricePill}>
                                <Text style={styles.cardPriceText}>{addr.price_level}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.gridCardTitle} numberOfLines={1}>
                            {addr.title}
                          </Text>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.locationRow}>
                              <MapPin color={Brand.inkSoft} size={12} strokeWidth={2} />
                              <Text style={styles.locationTextSmall}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} accessibilityLabel={favorites.includes(addr.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={styles.favoriteButtonSmall}>
                              <Heart
                                color={isFav ? Brand.primary : Brand.inkMute}
                                fill={isFav ? Brand.primary : 'transparent'}
                                size={15}
                                strokeWidth={2}
                              />
                              {likesCount > 0 && (
                                <Text style={[styles.likeCountTextSmall, isFav && styles.likeCountTextActive]}>
                                  {likesCount}
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}

                  {/* Load More Progressive Pagination Button */}
                  {categoryFilteredAddresses.length > displayLimit && (
                    <Pressable
                      style={({ pressed }) => [
                        styles.loadMoreBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                      onPress={() => setDisplayLimit(prev => prev + 24)}
                    >
                      <Text style={styles.loadMoreBtnText}>
                        Afficher plus d'adresses ({Math.min(displayLimit, categoryFilteredAddresses.length)} / {categoryFilteredAddresses.length}) ↓
                      </Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ) : viewMode === 'see_all_recommended' ? (
            /* ── 2. SEE ALL RECOMMENDED VIEW (CAPPED AT 50) ── */
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
              <View style={styles.seeAllHeaderRow}>
                <Pressable style={styles.backBtn} onPress={() => setViewMode('home')}>
                  <ArrowLeft size={18} color={Brand.ink} strokeWidth={2} style={{ marginRight: 6 }} />
                  <Text style={styles.backBtnText}>Retour</Text>
                </Pressable>
                <Text style={styles.seeAllTitle}>Recommandations ({Math.min(50, recommendedAddresses.length)})</Text>
              </View>

              <View style={styles.verticalGridContainer}>
                {recommendedAddresses.slice(0, 50).map(addr => {
                  const isFav = favorites.includes(addr.id);
                  const likesCount = likesMap[addr.id] ?? (Number((addr as any).likes_count) || 0);
                  return (
                    <Pressable
                      key={addr.id}
                      style={styles.gridCardItem}
                      onPress={() => {
                        const gallery = (addr as any).gallery_urls || [];
                        const allPhotos = addr.image_url ? [addr.image_url, ...gallery] : gallery;
                        setSelectedSpotDetail({
                          id: addr.id,
                          title: addr.title,
                          description: (addr as any).full_description || addr.description,
                          full_description: (addr as any).full_description || addr.description,
                          breadcrumbs: (addr as any).breadcrumbs || [],
                          tags: (addr as any).tags || [],
                          image_url: addr.image_url,
                          photos: allPhotos,
                          rating: addr.rating,
                          category: categories.find(c => c.id === addr.category_id)?.name || ((addr as any).tags ? (addr as any).tags[0] : 'Lieu'),
                          price_level: addr.price_level,
                          location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
                          address: (addr as any).address || addr.location || 'Toulouse',
                          phone: (addr as any).telephone || (addr as any).phone || '',
                          website: (addr as any).site_web || (addr as any).website || '',
                          hours: (addr as any).horaires || (addr as any).hours || '',
                        });
                      }}
                    >
                      <Image source={{ uri: getOptimizedImageUrl(addr.image_url, 400) }} style={styles.gridCardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                      <View style={styles.ratingBadgeGrid}>
                        <Star color={Brand.chouchou} size={11} fill={Brand.chouchou} />
                        <Text style={styles.ratingTextSmall}>{formatRating(addr.rating)}</Text>
                      </View>
                      <View style={styles.gridCardBody}>
                        <Text style={styles.gridCardCategory}>
                          {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                        </Text>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{addr.title}</Text>
                        <View style={styles.cardFooterRow}>
                          <View style={styles.locationRow}>
                            <MapPin color={Brand.inkSoft} size={12} strokeWidth={2} />
                            <Text style={styles.locationTextSmall}>{addr.location}</Text>
                          </View>
                          <Pressable onPress={() => toggleFavorite(addr.id)} accessibilityLabel={favorites.includes(addr.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={styles.favoriteButtonSmall}>
                            <Heart
                              color={isFav ? Brand.primary : Brand.inkMute}
                              fill={isFav ? Brand.primary : 'transparent'}
                              size={15}
                              strokeWidth={2}
                            />
                            {likesCount > 0 && (
                              <Text style={[styles.likeCountTextSmall, isFav && styles.likeCountTextActive]}>
                                {likesCount}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : viewMode === 'see_all_new' ? (
            /* ── 3. SEE ALL NEWEST VIEW (CAPPED AT 50) ── */
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
              <View style={styles.seeAllHeaderRow}>
                <Pressable style={styles.backBtn} onPress={() => setViewMode('home')}>
                  <ArrowLeft size={18} color={Brand.ink} strokeWidth={2} style={{ marginRight: 6 }} />
                  <Text style={styles.backBtnText}>Retour</Text>
                </Pressable>
                <Text style={styles.seeAllTitle}>Nouveautés toulousaines ({Math.min(50, newAddresses.length)})</Text>
              </View>

              <View style={styles.verticalGridContainer}>
                {newAddresses.slice(0, 50).map(addr => {
                  const isFav = favorites.includes(addr.id);
                  const likesCount = likesMap[addr.id] ?? (Number((addr as any).likes_count) || 0);
                  return (
                    <Pressable
                      key={addr.id}
                      style={styles.gridCardItem}
                      onPress={() => {
                        const gallery = (addr as any).gallery_urls || [];
                        const allPhotos = addr.image_url ? [addr.image_url, ...gallery] : gallery;
                        setSelectedSpotDetail({
                          id: addr.id,
                          title: addr.title,
                          description: (addr as any).full_description || addr.description,
                          full_description: (addr as any).full_description || addr.description,
                          breadcrumbs: (addr as any).breadcrumbs || [],
                          tags: (addr as any).tags || [],
                          image_url: addr.image_url,
                          photos: allPhotos,
                          rating: addr.rating,
                          category: categories.find(c => c.id === addr.category_id)?.name || ((addr as any).tags ? (addr as any).tags[0] : 'Lieu'),
                          price_level: addr.price_level,
                          location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
                          address: (addr as any).address || addr.location || 'Toulouse',
                          phone: (addr as any).telephone || (addr as any).phone || '',
                          website: (addr as any).site_web || (addr as any).website || '',
                          hours: (addr as any).horaires || (addr as any).hours || '',
                        });
                      }}
                    >
                      <Image source={{ uri: getOptimizedImageUrl(addr.image_url, 400) }} style={styles.gridCardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                      <View style={styles.ratingBadgeGrid}>
                        <Star color={Brand.chouchou} size={11} fill={Brand.chouchou} />
                        <Text style={styles.ratingTextSmall}>{formatRating(addr.rating)}</Text>
                      </View>
                      <View style={styles.gridCardBody}>
                        <Text style={styles.gridCardCategory}>
                          {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                        </Text>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{addr.title}</Text>
                        <View style={styles.cardFooterRow}>
                          <View style={styles.locationRow}>
                            <MapPin color={Brand.inkSoft} size={12} strokeWidth={2} />
                            <Text style={styles.locationTextSmall}>{addr.location}</Text>
                          </View>
                          <Pressable onPress={() => toggleFavorite(addr.id)} accessibilityLabel={favorites.includes(addr.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={styles.favoriteButtonSmall}>
                            <Heart
                              color={isFav ? Brand.primary : Brand.inkMute}
                              fill={isFav ? Brand.primary : 'transparent'}
                              size={15}
                              strokeWidth={2}
                            />
                            {likesCount > 0 && (
                              <Text style={[styles.likeCountTextSmall, isFav && styles.likeCountTextActive]}>
                                {likesCount}
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            /* ── 4. INITIAL HOME PAGE LAYOUT ── */
            <>
              {/* Popular Categories Section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Catégories populaires</Text>
                {categories.length > 0 && (
                  <Pressable onPress={() => setShowAllCategories(true)}>
                    <Text style={styles.seeAllText}>Voir tout</Text>
                  </Pressable>
                )}
              </View>

              {loading ? (
                /* Categories Skeleton Pulse */
                <Animated.View style={[styles.categoriesScroll, pulseStyle, { flexDirection: 'row' }]}>
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <View key={idx} style={styles.categorySkeleton} />
                  ))}
                </Animated.View>
              ) : categories.length === 0 ? (
                <Text style={styles.emptyText}>Aucune catégorie trouvée</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesScroll}
                >
                  {orderedPopularCategories.map(category => {
                    const isSelected = selectedCategoryFilter === category.id;
                    const spotCount = categorySpotCounts[category.id] || 0;
                    return (
                      <Pressable
                        key={category.id}
                        style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                        onPress={() => handleCategoryChange(category.id)}
                      >
                        <View style={[styles.categoryIconBg, { backgroundColor: `${category.color}15` }]}>
                          <DynamicIcon name={category.icon_name} title={category.name} color={category.color} size={20} />
                        </View>
                        <View>
                          <Text style={[styles.categoryName, isSelected && styles.categoryNameActive]}>{category.name}</Text>
                          <Text style={[styles.categoryCountSub, isSelected && styles.categoryCountSubActive]}>
                            {spotCount} adresse{spotCount > 1 ? 's' : ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* ── TOP PARTENAIRES LE PETIT TOU (STYLE NETFLIX 1..10) ── */}
              {sponsoredPartners.length > 0 && (
                <View style={styles.netflixSection}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Partenaires Le Petit Tou</Text>
                    <View style={styles.netflixOfficialPill}>
                      <Text style={styles.netflixOfficialText}>OFFICIEL</Text>
                    </View>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.netflixScroll}
                  >
                    {sponsoredPartners.map((partner, idx) => {
                      const rankNum = partner.rank_position || idx + 1;
                      return (
                        <Pressable
                          key={partner.id || idx}
                          style={({ pressed }) => [
                            styles.netflixCardWrapper,
                            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                          ]}
                          onPress={() => {
                            if (partner.spot_id) {
                              const found = addresses.find(a => a.id === partner.spot_id);
                              if (found) {
                                const gallery = (found as any).gallery_urls || [];
                                const allPhotos = found.image_url ? [found.image_url, ...gallery] : gallery;
                                setSelectedSpotDetail({
                                  id: found.id,
                                  title: found.title,
                                  description: (found as any).full_description || found.description,
                                  full_description: (found as any).full_description || found.description,
                                  breadcrumbs: (found as any).breadcrumbs || [],
                                  tags: (found as any).tags || [],
                                  image_url: found.image_url,
                                  photos: allPhotos,
                                  rating: found.rating,
                                  category: categories.find(c => c.id === found.category_id)?.name || ((found as any).tags ? (found as any).tags[0] : 'Partenaire'),
                                  location: found.location || 'Toulouse Centre',
                                  address: (found as any).address || `${found.location}, Toulouse`,
                                  phone: (found as any).telephone || '',
                                  website: (found as any).site_web || '',
                                  hours: (found as any).horaires || '',
                                  reviews: (found as any).reviews || [],
                                });
                                return;
                              }
                            }
                            setSelectedSpotDetail({
                              id: partner.id,
                              title: partner.title,
                              description: publicPartnerText(partner.subtitle),
                              full_description: publicPartnerText(partner.subtitle),
                              image_url: partner.image_url,
                              photos: partner.image_url ? [partner.image_url] : [],
                              category: 'Partenaire Officiel',
                              rating: 5.0,
                              location: 'Toulouse',
                            });
                          }}
                        >
                          {/* Giant Netflix Style Number */}
                          <Text style={styles.netflixRankNumber}>{rankNum}</Text>

                          {/* Card Body */}
                          <View style={styles.netflixCardBody}>
                            <Image
                              source={{ uri: partner.image_url || PLACEHOLDER_PHOTO }}
                              style={styles.netflixImage}
                              contentFit="cover"
                              transition={150}
                              cachePolicy="memory-disk"
                            />
                            <View style={styles.netflixBadgePill}>
                              <Text style={styles.netflixBadgeText}>{partner.badge_text || `TOP #${rankNum}`}</Text>
                            </View>
                            <View style={styles.netflixCardInfo}>
                              <Text style={styles.netflixPartnerTitle} numberOfLines={1}>
                                {partner.title}
                              </Text>
                              {!!publicPartnerText(partner.subtitle) && (
                                <Text style={styles.netflixPartnerSubtitle} numberOfLines={2}>
                                  {publicPartnerText(partner.subtitle)}
                                </Text>
                              )}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Recommendations of the Moment (Large Cards) */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Les chouchous du moment</Text>
                <Pressable onPress={() => setViewMode('see_all_recommended')}>
                  <Text style={styles.seeAllText}>Voir tout</Text>
                </Pressable>
              </View>

              {loading ? (
                /* Recommendations Skeleton Pulse */
                <Animated.View style={[styles.cardsScroll, pulseStyle, { flexDirection: 'row' }]}>
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <View key={idx} style={styles.largeCardSkeleton} />
                  ))}
                </Animated.View>
              ) : recommendedAddresses.length === 0 ? (
                <Text style={styles.emptyText}>Aucune recommandation pour l'instant</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsScroll}
                >
                  {recommendedAddresses.slice(0, 12).map(addr => {
                    const isFav = favorites.includes(addr.id);
                    const likesCount = likesMap[addr.id] ?? (Number((addr as any).likes_count) || 0);
                    return (
                      <Pressable
                        key={addr.id}
                        style={styles.largeCard}
                        onPress={() => {
                          const gallery = (addr as any).gallery_urls || [];
                          const allPhotos = addr.image_url ? [addr.image_url, ...gallery] : gallery;
                          setSelectedSpotDetail({
                            id: addr.id,
                            title: addr.title,
                            description: (addr as any).full_description || addr.description,
                            full_description: (addr as any).full_description || addr.description,
                            breadcrumbs: (addr as any).breadcrumbs || [],
                            tags: (addr as any).tags || [],
                            image_url: addr.image_url,
                            photos: allPhotos,
                            rating: addr.rating,
                            category: categories.find(c => c.id === addr.category_id)?.name || ((addr as any).tags ? (addr as any).tags[0] : 'Lieu'),
                            price_level: addr.price_level,
                            location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
                            address: (addr as any).address || addr.location || 'Toulouse',
                            phone: (addr as any).telephone || (addr as any).phone || '',
                            website: (addr as any).site_web || (addr as any).website || '',
                            hours: (addr as any).horaires || (addr as any).hours || '',
                          });
                        }}
                      >
                        <Image source={{ uri: getOptimizedImageUrl(addr.image_url, 600) }} style={styles.largeCardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                        <View style={styles.chouchouBadge}>
                          <Star size={12} color={Brand.ink} fill={Brand.ink} strokeWidth={2} />
                          <Text style={styles.chouchouBadgeText}>CHOUCHOU</Text>
                        </View>
                        <View style={styles.ratingBadge}>
                          <Star color={Brand.chouchou} size={13} fill={Brand.chouchou} />
                          <Text style={styles.ratingText}>{formatRating(addr.rating)}</Text>
                        </View>
                        <View style={styles.largeCardInfo}>
                          <View style={styles.cardHeaderRow}>
                            <Text style={styles.cardCategoryText}>
                              {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'}
                            </Text>
                            <Text style={styles.cardPriceText}>{addr.price_level}</Text>
                          </View>
                          <Text style={styles.cardTitle} numberOfLines={1}>{addr.title}</Text>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.locationRow}>
                              <MapPin color={Brand.inkSoft} size={14} strokeWidth={2} />
                              <Text style={styles.locationText}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} accessibilityLabel={favorites.includes(addr.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={styles.favoriteButton}>
                              <Heart
                                color={isFav ? Brand.primary : Brand.inkMute}
                                fill={isFav ? Brand.primary : 'transparent'}
                                size={17}
                                strokeWidth={2}
                              />
                              {likesCount > 0 && (
                                <Text style={[styles.likeCountText, isFav && styles.likeCountTextActive]}>
                                  {likesCount}
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Novelties section (Smaller Cards) */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Fraîchement testées</Text>
                <Pressable onPress={() => setViewMode('see_all_new')}>
                  <Text style={styles.seeAllText}>Voir tout</Text>
                </Pressable>
              </View>

              {loading ? (
                /* Novelties Skeleton Pulse */
                <Animated.View style={[styles.cardsScroll, pulseStyle, { flexDirection: 'row' }]}>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <View key={idx} style={styles.smallCardSkeleton} />
                  ))}
                </Animated.View>
              ) : newAddresses.length === 0 ? (
                <Text style={styles.emptyText}>Aucune nouveauté pour l'instant</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.cardsScroll}
                >
                  {newAddresses.slice(0, 12).map(addr => {
                    const isFav = favorites.includes(addr.id);
                    const likesCount = likesMap[addr.id] ?? (Number((addr as any).likes_count) || 0);
                    return (
                      <Pressable
                        key={addr.id}
                        style={styles.smallCard}
                        onPress={() => {
                          const gallery = (addr as any).gallery_urls || [];
                          const allPhotos = addr.image_url ? [addr.image_url, ...gallery] : gallery;
                          setSelectedSpotDetail({
                            id: addr.id,
                            title: addr.title,
                            description: (addr as any).full_description || addr.description,
                            full_description: (addr as any).full_description || addr.description,
                            breadcrumbs: (addr as any).breadcrumbs || [],
                            tags: (addr as any).tags || [],
                            image_url: addr.image_url,
                            photos: allPhotos,
                            rating: addr.rating,
                            category: categories.find(c => c.id === addr.category_id)?.name || ((addr as any).tags ? (addr as any).tags[0] : 'Lieu'),
                            price_level: addr.price_level,
                            location: addr.location && addr.location !== 'Toulouse' ? addr.location : 'Toulouse Centre',
                            address: (addr as any).address || addr.location || 'Toulouse',
                            phone: (addr as any).telephone || (addr as any).phone || '',
                            website: (addr as any).site_web || (addr as any).website || '',
                            hours: (addr as any).horaires || (addr as any).hours || '',
                          });
                        }}
                      >
                        <Image source={{ uri: getOptimizedImageUrl(addr.image_url, 360) }} style={styles.smallCardImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                        <View style={styles.carouselPaginatorBadgeSmall}>
                          <View style={[styles.paginatorDotSmall, styles.paginatorDotActive]} />
                          <View style={styles.paginatorDotSmall} />
                          <View style={styles.paginatorDotSmall} />
                        </View>
                        <View style={styles.ratingBadge}>
                          <Star color={Brand.chouchou} size={11} fill={Brand.chouchou} />
                          <Text style={styles.ratingTextSmall}>{formatRating(addr.rating)}</Text>
                        </View>
                        <View style={styles.smallCardInfo}>
                          <Text style={styles.smallCardCategory}>
                            {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                          </Text>
                          <Text style={styles.smallCardTitle} numberOfLines={1}>{addr.title}</Text>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.locationRow}>
                              <MapPin color={Brand.inkSoft} size={12} strokeWidth={2} />
                              <Text style={styles.locationTextSmall}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} accessibilityLabel={favorites.includes(addr.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} style={styles.favoriteButtonSmall}>
                              <Heart
                                color={isFav ? Brand.primary : Brand.inkMute}
                                fill={isFav ? Brand.primary : 'transparent'}
                                size={15}
                                strokeWidth={2}
                              />
                              {likesCount > 0 && (
                                <Text style={[styles.likeCountTextSmall, isFav && styles.likeCountTextActive]}>
                                  {likesCount}
                                </Text>
                              )}
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Association Events Section */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Événements de l'association</Text>
              </View>

              {loading ? (
                <ActivityIndicator size="small" color={Brand.primaryDeep} style={{ marginVertical: 20 }} />
              ) : events.length === 0 ? (
                <Text style={styles.emptyText}>Aucun événement pour l'instant</Text>
              ) : (
                <View style={styles.eventsContainer}>
                  {events.map((event) => {
                    const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
                    let day: number | string = 1;
                    let monthStr = 'JAN';
                    const rawParts = (event.event_date || '').split('-');
                    if (rawParts.length === 3) {
                      const mIdx = parseInt(rawParts[1], 10) - 1;
                      day = parseInt(rawParts[2], 10) || 1;
                      monthStr = months[mIdx >= 0 && mIdx < 12 ? mIdx : 0];
                    } else {
                      const d = new Date(event.event_date);
                      if (!isNaN(d.getTime())) {
                        day = d.getDate();
                        monthStr = months[d.getMonth()];
                      }
                    }

                    const priceNum = parseFloat(event.price || '0');
                    const displayPrice = isNaN(priceNum) || priceNum === 0 ? 'Gratuit' : `${priceNum.toFixed(2)} €`;

                    return (
                      <View key={event.id} style={styles.eventCard}>
                        <View style={styles.eventDateBlock}>
                          <Text style={styles.eventDateDay}>{day}</Text>
                          <Text style={styles.eventDateMonth}>{monthStr}</Text>
                        </View>
                        <View style={styles.eventDetails}>
                          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.eventMeta}>{event.event_time || '19:00'} • {event.location || 'Toulouse'}</Text>
                          <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                          <View style={styles.eventFooter}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                              <Text style={styles.eventPrice}>{displayPrice}</Text>
                              {event.max_places ? (
                                <View style={styles.eventPlacesBadge}>
                                  <Text style={styles.eventPlacesBadgeText}>
                                    {event.max_places} places disponibles
                                  </Text>
                                </View>
                              ) : null}
                            </View>
                            <Pressable 
                              style={({ pressed }) => [
                                styles.bookBtn,
                                pressed && styles.bookBtnPressed,
                              ]}
                              onPress={() => handleBookEvent(event)}
                            >
                              <Text style={styles.bookBtnText}>Réserver</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Brand & RGPD Footer */}
          <View style={styles.homeFooterContainer}>
            <Text style={styles.homeFooterBrand}>LE PETIT TOU</Text>
            <Text style={styles.homeFooterDesc}>
              Le guide des meilleures adresses de Toulouse
            </Text>
            <Pressable
              style={styles.privacyPolicyFooterBtn}
              onPress={() => setShowPrivacyPolicy(true)}
            >
              <ShieldCheck size={14} color={Brand.inkSoft} />
              <Text style={styles.privacyPolicyFooterText}>
                Politique de Confidentialité & RGPD
              </Text>
            </Pressable>
            <Text style={styles.homeFooterCopyright}>
              © 2026 Association Le Petit Tou • TBS Education
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Custom Booking Confirmation Dialog Modal */}
      {bookingEvent && (
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmBody}>
              <View style={styles.confirmKickerRow}>
                <Ticket size={15} color={Brand.primaryDeep} strokeWidth={2} />
                <Text style={styles.confirmKicker}>BILLETTERIE OFFICIELLE</Text>
              </View>

              <Text style={styles.confirmTitle}>{bookingEvent.title}</Text>
              
              <Text style={styles.confirmDesc}>
                Confirmez votre réservation pour être dirigé vers la billetterie partenaire.
              </Text>

              {/* Price & Places Row */}
              <View style={styles.confirmMetaRow}>
                <View style={styles.confirmPricePill}>
                  <Text style={styles.confirmPriceText}>
                    {parseFloat(bookingEvent.price) === 0 ? 'Gratuit' : `${parseFloat(bookingEvent.price).toFixed(2)} €`}
                  </Text>
                </View>
                {bookingEvent.max_places ? (
                  <View style={styles.confirmPlacesPill}>
                    <Text style={styles.confirmPlacesText}>
                      {bookingEvent.max_places} places disponibles
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Notice */}
              <View style={styles.confirmNoticeBox}>
                <Text style={styles.confirmNoticeText}>
                  Redirection automatique vers la billetterie partenaire après confirmation.
                </Text>
              </View>

              {/* Buttons Row */}
              <View style={styles.confirmActionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmCancelBtn,
                    pressed && styles.btnPressed
                  ]}
                  onPress={() => setBookingEvent(null)}
                >
                  <Text style={styles.confirmCancelBtnText}>Annuler</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.confirmSuccessBtn,
                    pressed && styles.btnPressed
                  ]}
                  onPress={() => handleConfirmBooking(bookingEvent)}
                >
                  <Text style={styles.confirmSuccessBtnText}>
                    Confirmer la réservation
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Custom Booking Success Dialog Modal */}
      {successEvent && (
        <View style={styles.modalBackdrop}>
          <View style={styles.successCard}>
            <View style={styles.successBody}>
              <View style={styles.successIconWrapper}>
                <CheckCircle size={32} color={Brand.primaryDeep} strokeWidth={2} />
              </View>

              <Text style={styles.successKicker}>CONFIRMATION</Text>
              <Text style={styles.successTitle}>Réservation confirmée</Text>
              
              <Text style={styles.successEventTitle}>{successEvent.title}</Text>
              
              <Text style={styles.successDesc}>
                Votre place a bien été enregistrée pour cet événement Le Petit Tou.
              </Text>

              {/* Redirection banner */}
              <View style={styles.successNoticeBox}>
                <Text style={styles.successNoticeTitle}>
                  Redirection vers la billetterie en cours...
                </Text>
                <Text style={styles.successNoticeSubtitle}>
                  Ouverture de l'accès partenaire officiel
                </Text>
              </View>

              {/* Immediate Redirection Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryCtaBtn,
                  pressed && styles.btnPressed
                ]}
                onPress={() => {
                  const targetUrl = getEventBookingUrl(successEvent);
                  setSuccessEvent(null);
                  redirectToBookingUrl(targetUrl);
                }}
              >
                <Text style={styles.primaryCtaBtnText}>Accéder à la billetterie maintenant ↗</Text>
              </Pressable>

              {/* Close Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.secondaryCtaBtn,
                  pressed && styles.btnPressed
                ]}
                onPress={() => {
                  setSuccessEvent(null);
                }}
              >
                <Text style={styles.secondaryCtaBtnText}>Fermer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Custom Info/Warning/Error Dialog Modal */}
      {infoAlert && (
        <View style={styles.modalBackdrop}>
          <View style={styles.infoCard}>
            <View style={styles.infoBody}>
              <View style={[
                styles.infoIconWrapper,
                { backgroundColor: infoAlert.type === 'info' ? '#FFF3D6' : Brand.primarySoft }
              ]}>
                {infoAlert.type === 'info' ? (
                  <User size={24} color="#D97706" strokeWidth={2} />
                ) : (
                  <AlertTriangle size={24} color={Brand.primaryDeep} strokeWidth={2} />
                )}
              </View>

              <Text style={styles.infoKicker}>
                {infoAlert.type === 'info' ? 'INFORMATION' : infoAlert.type === 'warning' ? 'ATTENTION' : 'ERREUR'}
              </Text>
              
              <Text style={styles.infoTitle}>{infoAlert.title}</Text>
              <Text style={styles.infoDesc}>{infoAlert.message}</Text>

              {/* Action Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.primaryCtaBtn,
                  pressed && styles.btnPressed
                ]}
                onPress={() => setInfoAlert(null)}
              >
                <Text style={styles.primaryCtaBtnText}>D'accord</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Dedicated Address Detail View Modal */}
      {selectedSpotDetail && (
        <AddressDetailModal
          spot={selectedSpotDetail}
          onClose={() => setSelectedSpotDetail(null)}
          isFavorite={favorites.includes(selectedSpotDetail.id)}
          likesCount={likesMap[selectedSpotDetail.id] ?? (Number((selectedSpotDetail as any).likes_count) || 0)}
          onToggleFavorite={toggleFavorite}
          onGoToMap={(spotId) => {
            setSelectedSpotDetail(null);
            if (onSelectSpot) {
              onSelectSpot(spotId);
            }
          }}
        />
      )}

      {/* ── 1. ALL CATEGORIES MODAL (INSTANT OPEN & CLOSE — 0MS) ── */}
      <Modal
        visible={showAllCategories}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAllCategories(false)}
      >
        <View style={styles.instantModalOverlay}>
          <Pressable
            style={styles.instantModalBackdrop}
            onPress={() => setShowAllCategories(false)}
          />
          <View style={styles.instantModalContent}>
            <View style={styles.instantModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.instantModalTitle}>Toutes les catégories</Text>
                <View style={styles.categoryCountBadge}>
                  <Text style={styles.categoryCountBadgeText}>{categories.length}</Text>
                </View>
              </View>
              <Pressable
                style={styles.instantModalCloseBtn}
                onPress={() => setShowAllCategories(false)}
                hitSlop={12}
              >
                <X color={Brand.ink} size={20} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={styles.categoriesGrid}
            >
              {/* All categories reset */}
              <Pressable
                key="all"
                style={[styles.gridItem, selectedCategoryFilter === null && styles.gridItemSelected]}
                onPress={() => {
                  handleCategoryChange(null);
                  setShowAllCategories(false);
                }}
              >
                <View style={[styles.gridIconBg, { backgroundColor: '#1E293B15' }]}>
                  <Compass color={Brand.ink} size={24} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gridItemLabel, selectedCategoryFilter === null && styles.gridItemLabelSelected]}>
                    Toutes les adresses
                  </Text>
                  <Text style={[styles.gridItemCount, selectedCategoryFilter === null && styles.gridItemCountSelected]}>
                    {addresses.length} adresses
                  </Text>
                </View>
              </Pressable>

              {orderedModalCategories.map(category => {
                const isSelected = selectedCategoryFilter === category.id;
                const spotCount = categorySpotCounts[category.id] || 0;
                return (
                  <Pressable
                    key={category.id}
                    style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                    onPress={() => {
                      handleCategoryChange(category.id);
                      setShowAllCategories(false);
                    }}
                  >
                    <View style={[styles.gridIconBg, { backgroundColor: `${category.color || Brand.primary}20` }]}>
                      <DynamicIcon name={category.icon_name} title={category.name} color={category.color || Brand.primary} size={24} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.gridItemLabel, isSelected && styles.gridItemLabelSelected]} numberOfLines={2}>
                        {category.name}
                      </Text>
                      <Text style={[styles.gridItemCount, isSelected && styles.gridItemCountSelected]}>
                        {spotCount} adresse{spotCount > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── 2. DEDICATED PRECISION FILTER MODAL ── */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.filterModalOverlay}>
          <Pressable
            style={styles.filterModalBackdrop}
            onPress={() => setShowFilterModal(false)}
          />
          <View style={styles.filterModalContent}>
            {/* Modal Header */}
            <View style={styles.filterModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.filterModalIconWrap}>
                  <SlidersHorizontal size={18} color={Brand.primaryDeep} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.filterModalTitle}>Filtres précis</Text>
                  <Text style={styles.filterModalSub}>
                    {activeCategoryMeta?.name || 'Toutes les catégories'}
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.filterModalCloseBtn}
                onPress={() => setShowFilterModal(false)}
                hitSlop={10}
              >
                <X size={20} color={Brand.ink} strokeWidth={2} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.filterModalScroll}
            >
              {/* Section 1: Spécialités & Sous-catégories */}
              {availableSubTags.length > 0 && (
                <View style={styles.filterModalSection}>
                  <Text style={styles.filterModalSectionTitle}>Spécialités & Ambiances</Text>
                  <View style={styles.filterModalChipsGrid}>
                    <Pressable
                      style={[
                        styles.filterModalChip,
                        selectedSubTag === null && styles.filterModalChipActive,
                      ]}
                      onPress={() => {
                        triggerHaptic();
                        setSelectedSubTag(null);
                      }}
                    >
                      <Text
                        style={[
                          styles.filterModalChipText,
                          selectedSubTag === null && styles.filterModalChipTextActive,
                        ]}
                      >
                        Toutes les spécialités
                      </Text>
                    </Pressable>

                    {availableSubTags.map(sub => {
                      const isSelected = selectedSubTag === sub.id;
                      return (
                        <Pressable
                          key={sub.id}
                          style={[
                            styles.filterModalChip,
                            isSelected && styles.filterModalChipActive,
                          ]}
                          onPress={() => {
                            triggerHaptic();
                            setSelectedSubTag(isSelected ? null : sub.id);
                          }}
                        >
                          <Text
                            style={[
                              styles.filterModalChipText,
                              isSelected && styles.filterModalChipTextActive,
                            ]}
                          >
                            {sub.label} ({sub.count})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Section 2: Budget / Fourchette de prix */}
              <View style={styles.filterModalSection}>
                <Text style={styles.filterModalSectionTitle}>Fourchette de prix / Budget</Text>
                <View style={styles.filterModalPriceRow}>
                  {[
                    { id: 'all', label: 'Tous', desc: 'Tout budget' },
                    { id: '€', label: '€', desc: 'Abordable' },
                    { id: '€€', label: '€€', desc: 'Modéré' },
                    { id: '€€€', label: '€€€', desc: 'Gourmet' },
                  ].map(p => {
                    const isSelected = selectedPrice === p.id;
                    return (
                      <Pressable
                        key={p.id}
                        style={[
                          styles.filterModalPriceCard,
                          isSelected && styles.filterModalPriceCardActive,
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedPrice(p.id as any);
                        }}
                      >
                        <Text
                          style={[
                            styles.filterModalPriceLabel,
                            isSelected && styles.filterModalPriceLabelActive,
                          ]}
                        >
                          {p.label}
                        </Text>
                        <Text
                          style={[
                            styles.filterModalPriceDesc,
                            isSelected && styles.filterModalPriceDescActive,
                          ]}
                        >
                          {p.desc}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Section 3: Tri des résultats */}
              <View style={styles.filterModalSection}>
                <Text style={styles.filterModalSectionTitle}>Trier les résultats par</Text>
                <View style={styles.filterModalSortList}>
                  {[
                    { id: 'likes', label: 'Plus aimés', desc: 'Classés selon les likes réels de la communauté Le Petit Tou' },
                    { id: 'rating', label: 'Mieux notés', desc: 'Les meilleures notes Google & Petit Tou en premier' },
                    { id: 'recommended', label: 'Coups de cœur', desc: 'La sélection officielle recommandée par nos rédacteurs' },
                    { id: 'new', label: '🆕 Nouveautés', desc: 'Les adresses les plus récentes de notre guide' },
                  ].map(s => {
                    const isSelected = selectedSort === s.id;
                    return (
                      <Pressable
                        key={s.id}
                        style={[
                          styles.filterModalSortRow,
                          isSelected && styles.filterModalSortRowActive,
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedSort(s.id as any);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.filterModalSortLabel,
                              isSelected && styles.filterModalSortLabelActive,
                            ]}
                          >
                            {s.label}
                          </Text>
                          <Text style={styles.filterModalSortDesc}>{s.desc}</Text>
                        </View>
                        <View
                          style={[
                            styles.filterModalRadio,
                            isSelected && styles.filterModalRadioActive,
                          ]}
                        >
                          {isSelected && <View style={styles.filterModalRadioInner} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            {/* Modal Bottom Fixed Footer */}
            <View style={styles.filterModalFooter}>
              <Pressable
                style={styles.filterModalResetBtn}
                onPress={() => {
                  resetSubFilters();
                }}
              >
                <RotateCcw size={14} color={Brand.inkSoft} style={{ marginRight: 6 }} />
                <Text style={styles.filterModalResetText}>Réinitialiser</Text>
              </Pressable>

              <Pressable
                style={styles.filterModalApplyBtn}
                onPress={() => {
                  triggerHaptic();
                  setShowFilterModal(false);
                }}
              >
                <Text style={styles.filterModalApplyText}>
                  Afficher ({categoryFilteredAddresses.length}) adresses
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Admin Password Security Modal (Triggered by 7 taps on LE PETIT TOU) */}
      <AdminPasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          setShowAdminModal(true);
        }}
      />

      {/* Admin Portal Modal */}
      {showAdminModal && (
        <AdminPortalModal
          visible={showAdminModal}
          onClose={() => {
            setShowAdminModal(false);
            loadSupabaseData(true);
          }}
          onLogout={() => {
            setShowAdminModal(false);
            loadSupabaseData(true);
          }}
        />
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        visible={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
      />
    </View>
  );
}
