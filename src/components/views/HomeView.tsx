import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Image,
  Pressable,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  Easing,
} from 'react-native-reanimated';
import { GlassView } from 'expo-glass-effect';
import * as Icons from 'lucide-react-native';

import { supabase } from '../../lib/supabase';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';
import dataset from '../../constants/dataset.json';

const ALL_EXPANDED_CATEGORIES = [
  { id: 'all', name: 'Toutes les adresses 🌟', icon_name: 'Compass', color: '#1E293B', badge: '790' },
  { id: 'gourmand-gourmet', name: 'Gourmand & Restauration', icon_name: 'Utensils', color: '#C52824', badge: '🍴' },
  { id: 'trinquer-danser', name: 'Trinquer & Bars', icon_name: 'Wine', color: '#E5A93B', badge: '🍷' },
  { id: 'brunch-douceurs', name: 'Brunch & Douceurs', icon_name: 'Coffee', color: '#D97706', badge: '🥐' },
  { id: 'shopping-beaute', name: 'Shopping & Déco', icon_name: 'ShoppingBag', color: '#8B5CF6', badge: '🛍️' },
  { id: 'beaute-bien-etre', name: 'Beauté & Bien-être', icon_name: 'Sparkles', color: '#EC4899', badge: '💅' },
  { id: 'culture-loisirs', name: 'Culture & Spectacles', icon_name: 'Film', color: '#3B82F6', badge: '🎭' },
  { id: 'sport-activites', name: 'Sport & Outdoor', icon_name: 'Activity', color: '#10B981', badge: '🏃' },
  { id: 'terrasse', name: 'Terrasse & Rooftop', icon_name: 'Sun', color: '#F59E0B', badge: '☀️' },
  { id: 'bio-local', name: 'Bio & Écoresponsable', icon_name: 'Leaf', color: '#059669', badge: '🌿' },
  { id: 'fait-maison', name: 'Fait Maison', icon_name: 'ChefHat', color: '#DC2626', badge: '👨‍🍳' },
  { id: 'vie-pratique', name: 'Vie Pratique & Services', icon_name: 'Home', color: '#64748B', badge: '🏠' },
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

const { width, height } = Dimensions.get('window');
const APPLE_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const DRAWER_HEIGHT = height * 0.92;
const SNAP_HALF = DRAWER_HEIGHT - height * 0.5;
const SNAP_FULL = 0;

interface Category {
  id: string;
  name: string;
  slug?: string;
  icon_name: string; // Lucide icon name string e.g. 'UtensilsCrossed'
  color: string; // Hex color string
}

interface Address {
  id: string;
  title: string;
  description: string;
  image_url: string; // URL string pointing to Supabase Storage
  rating: number;
  category_id: string;
  price_level: string; // '€' | '€€' | '€€€'
  location: string;
  is_recommended: boolean;
  is_new: boolean;
}

const MOCK_EVENTS = [
  { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: "Soirée de lancement du guide 2026", description: "Soirée exclusive pour découvrir les nouvelles adresses sélectionnées par l'association.", event_date: '2026-05-24', event_time: '19:00', location: 'Quai de la Daurade, Toulouse', price: 25.00 },
  { id: 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', title: "Toulouse à Table !", description: "Grand banquet toulousain partagé en plein cœur de la ville rose.", event_date: '2026-06-15', event_time: '12:00', location: 'Divers lieux, Toulouse', price: 15.00 }
];

// Helper component to render Lucide Icons dynamically by string name
interface DynamicIconProps {
  name: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

function DynamicIcon({ name, color, size = 20, strokeWidth = 2.2 }: DynamicIconProps) {
  const IconComponent = (Icons as any)[name];
  if (!IconComponent) return null;
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
      backgroundColor: searchFocus.value > 0.5 ? '#C52824' : '#000000' // Toulouse Red focus color
    };
  });

  // Border pulsing animated styles
  const borderStyle = useAnimatedStyle(() => {
    const color = isSearchFocused
      ? (searchPulse.value > 0.5 ? '#C52824' : '#000000') // Toulouse Red pulsing color
      : '#000000';
    return {
      borderColor: color
    };
  });
  
  // View Mode for Home vs See All pages
  const [viewMode, setViewMode] = useState<'home' | 'see_all_recommended' | 'see_all_new'>('home');

  const resetAllFilters = () => {
    setSelectedCategoryFilter(null);
    setSearchQuery('');
    setViewMode('home');
  };

  // Supabase states
  const [categories, setCategories] = useState<Category[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);

  const [bookingEvent, setBookingEvent] = useState<any | null>(null);
  const [successEvent, setSuccessEvent] = useState<any | null>(null);
  const [infoAlert, setInfoAlert] = useState<{ title: string; message: string; type?: 'info' | 'warning' | 'error' } | null>(null);

  const handleBookEvent = async (event: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setInfoAlert({
          title: "Connexion requise",
          message: "Veuillez vous connecter dans l'onglet Profil pour réserver votre place à cet événement !",
          type: 'info'
        });
        return;
      }
      setBookingEvent(event);
    } catch (e) {
      console.warn(e);
    }
  };

  // Reanimated values for sliding drawer
  const drawerY = useSharedValue(height);
  const overlayOpacity = useSharedValue(0);

  // Skeleton pulsing animation value
  const pulseOpacity = useSharedValue(0.6);

  // Fetch data from Supabase
  const loadSupabaseData = async () => {
    try {
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

      // Fetch Categories
      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*');
      if (catError) throw catError;

      // Fetch Addresses
      const { data: addrData, error: addrError } = await supabase
        .from('addresses')
        .select('*');
      if (addrError) throw addrError;

      setCategories(catData && catData.length > 0 ? catData : (dataset.categories as any));
      setAddresses(addrData && addrData.length > 0 ? (addrData as any) : (dataset.addresses as any));

      // Fetch Events
      try {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .order('event_date', { ascending: true });

        const isProduction = true; // Filter test events
        const isTestEvent = (e: any) => {
          const t = (e.title || '').toLowerCase();
          const d = (e.description || '').toLowerCase();
          return t.includes('test') || d.includes('test') || t.includes('générique');
        };

        if (!eventsError && eventsData && eventsData.length > 0) {
          const cleanEvents = isProduction ? eventsData.filter((e: any) => !isTestEvent(e)) : eventsData;
          setEvents(cleanEvents);
        } else {
          const cleanMock = isProduction ? MOCK_EVENTS.filter((e: any) => !isTestEvent(e)) : MOCK_EVENTS;
          setEvents(cleanMock);
        }
      } catch (e) {
        const isTestEvent = (e: any) => {
          const t = (e.title || '').toLowerCase();
          const d = (e.description || '').toLowerCase();
          return t.includes('test') || d.includes('test') || t.includes('générique');
        };
        setEvents(MOCK_EVENTS.filter((e: any) => !isTestEvent(e)));
      }

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
    
    // Start skeleton pulse loop
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 800 }),
        withTiming(0.6, { duration: 800 })
      ),
      -1,
      true
    );
  }, []);

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  const closeDrawer = () => {
    drawerY.value = withTiming(height, { duration: 250, easing: APPLE_EASE });
    overlayOpacity.value = withTiming(0, { duration: 200, easing: APPLE_EASE });
    setTimeout(() => {
      setShowAllCategories(false);
    }, 220);
  };

  const handleSelectCategoryFromModal = (catItem: any) => {
    if (catItem.id === 'all') {
      setSelectedCategoryFilter(null);
    } else {
      setSelectedCategoryFilter(catItem.id);
    }
    closeDrawer();
  };

  useEffect(() => {
    if (showAllCategories) {
      drawerY.value = withSpring(SNAP_HALF, { damping: 25, stiffness: 200 });
      overlayOpacity.value = withTiming(1, { duration: 300, easing: APPLE_EASE });
    }
  }, [showAllCategories]);

  const drawerDragStart = React.useRef(0);
  const drawerPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
        onPanResponderGrant: () => {
          drawerDragStart.current = drawerY.value;
        },
        onPanResponderMove: (_, g) => {
          const newY = drawerDragStart.current + g.dy;
          drawerY.value = Math.max(SNAP_FULL, Math.min(height, newY));
        },
        onPanResponderRelease: (_, g) => {
          const curY = drawerY.value;
          const vy = g.vy;
          if (vy > 0.5) {
            if (curY > SNAP_HALF * 0.7) {
              closeDrawer();
            } else {
              drawerY.value = withSpring(SNAP_HALF, { damping: 25, stiffness: 200 });
            }
          } else if (vy < -0.5) {
            drawerY.value = withSpring(SNAP_FULL, { damping: 25, stiffness: 200 });
          } else {
            const mid = (SNAP_FULL + SNAP_HALF) / 2;
            if (curY < mid) {
              drawerY.value = withSpring(SNAP_FULL, { damping: 25, stiffness: 200 });
            } else if (curY < SNAP_HALF + height * 0.15) {
              drawerY.value = withSpring(SNAP_HALF, { damping: 25, stiffness: 200 });
            } else {
              closeDrawer();
            }
          }
        },
      }),
    []
  );

  const isAnyModalOpen = showAllCategories || !!bookingEvent || !!successEvent || !!infoAlert || !!selectedSpotDetail;

  useEffect(() => {
    if (onToggleDock) {
      onToggleDock(!isAnyModalOpen);
    }
  }, [isAnyModalOpen, onToggleDock]);

  const drawStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drawerY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    pointerEvents: showAllCategories ? 'auto' : 'none',
  }));

  // Skeleton pulse style
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const toggleFavorite = (id: string) => {
    triggerHaptic();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const filteredAddresses = addresses.filter(addr => {
    if (searchQuery.trim()) {
      const q = normalizeText(searchQuery);
      const titleNorm = normalizeText(addr.title);
      const locNorm = normalizeText(addr.location);
      const descNorm = normalizeText(addr.description);
      const tagsNorm = normalizeText(((addr as any).tags || []).join(' '));
      const matchSearch =
        titleNorm.includes(q) ||
        locNorm.includes(q) ||
        descNorm.includes(q) ||
        tagsNorm.includes(q);
      if (!matchSearch) return false;
    }

    if (selectedCategoryFilter) {
      const catId = addr.category_id;
      const catObj = categories.find(c => c.id === catId);
      const catSlug = catObj?.slug || '';
      const catName = catObj?.name || '';

      if (selectedCategoryFilter === catId || selectedCategoryFilter === catSlug) {
        return true;
      }

      const keywords = FILTER_KEYWORDS_MAP[selectedCategoryFilter] || [selectedCategoryFilter];
      const fullSearchableBlob = normalizeText(
        `${addr.title} ${addr.description} ${(addr as any).full_description || ''} ${((addr as any).tags || []).join(' ')} ${((addr as any).breadcrumbs || []).join(' ')} ${catName} ${catSlug}`
      );

      const matchKeyword = keywords.some(kw => fullSearchableBlob.includes(normalizeText(kw)));
      if (!matchKeyword) return false;
    }

    return true;
  });

  const recommendedAddresses = filteredAddresses.filter(addr => addr.is_recommended);
  const newAddresses = filteredAddresses.filter(addr => addr.is_new);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Main Vertical Scroll Container */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header Row */}
          <View style={styles.header}>
            <Pressable style={styles.headerButton}>
              <Icons.Menu color="#1E293B" size={24} strokeWidth={2} />
            </Pressable>
            
            <Image
              source={require('../../../assets/images/logo.jpg')}
              style={styles.logo}
              resizeMode="contain"
            />
            
            <Pressable style={styles.headerButton}>
              <Icons.Bell color="#1E293B" size={24} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Tagline Hook */}
          <View style={styles.hookContainer}>
            <Text style={styles.hookText}>Découvrez Toulouse</Text>
            <Text style={styles.hookSubtitle}>autrement</Text>
          </View>

          {/* Smooth Brutalist Search Bar (Matching CSS specs!) */}
          <View style={styles.brutalistWrapper}>
            <View style={styles.brutalistContainer}>
              {/* Toulouse Gold Shadow Layer (offset 8, 8) */}
              <View style={[styles.shadowLayer, { backgroundColor: '#E5A93B', top: 8, left: 8 }]} />
              {/* Black Shadow Layer (offset 4, 4) */}
              <View style={[styles.shadowLayer, { backgroundColor: '#000000', top: 4, left: 4 }]} />
              
              {/* Animated Border Input container */}
              <Animated.View style={[styles.brutalistInputContainer, borderStyle]}>
                <Icons.Search color="#888888" size={18} strokeWidth={2.5} style={styles.brutalistSearchIcon} />
                <TextInput
                  placeholder="Rechercher une adresse, un lieu..."
                  placeholderTextColor="#888888"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  style={styles.brutalistInput}
                />
              </Animated.View>

              {/* Absolute Rotated Brutalist Label */}
              <Animated.View style={[styles.brutalistLabel, labelStyle]}>
                <Text style={styles.brutalistLabelText}>LE PETIT TOU</Text>
              </Animated.View>
            </View>
          </View>

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
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
              <View style={styles.activeFilterBanner}>
                <View style={styles.activeFilterLeft}>
                  <Icons.Filter size={18} color="#C52824" style={{ marginRight: 8 }} />
                  <Text style={styles.activeFilterText}>
                    {selectedCategoryFilter
                      ? `Filtre : ${ALL_EXPANDED_CATEGORIES.find(c => c.id === selectedCategoryFilter)?.name || categories.find(c => c.id === selectedCategoryFilter)?.name || selectedCategoryFilter}`
                      : `Recherche : "${searchQuery}"`}
                    <Text style={{ fontWeight: '900', color: '#1E293B' }}> ({filteredAddresses.length} adresses)</Text>
                  </Text>
                </View>
                <Pressable style={styles.clearFilterBtn} onPress={resetAllFilters}>
                  <Icons.X size={16} color="#1E293B" strokeWidth={2.5} />
                </Pressable>
              </View>

              {/* Reset to Initial Home CTA */}
              <Pressable style={styles.resetHomeCtaBtn} onPress={resetAllFilters}>
                <Icons.RotateCcw size={14} color="#C52824" style={{ marginRight: 6 }} />
                <Text style={styles.resetHomeCtaText}>Réinitialiser et afficher la page d'accueil d'origine</Text>
              </Pressable>

              {/* Grid of Filtered Addresses */}
              {filteredAddresses.length === 0 ? (
                <View style={styles.emptyResultsBox}>
                  <Icons.Sparkles size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyText}>Aucune adresse ne correspond à ce filtre.</Text>
                </View>
              ) : (
                <View style={styles.verticalGridContainer}>
                  {filteredAddresses.map(addr => {
                    const isFav = favorites.includes(addr.id);
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
                            phone: (addr as any).telephone || '',
                            website: (addr as any).site_web || '',
                          });
                        }}
                      >
                        <Image source={{ uri: addr.image_url }} style={styles.gridCardImage} resizeMode="cover" />
                        <View style={styles.ratingBadgeGrid}>
                          <Icons.Star color="#E5A93B" size={11} fill="#E5A93B" />
                          <Text style={styles.ratingTextSmall}>{typeof addr.rating === 'number' ? addr.rating.toFixed(1) : addr.rating}</Text>
                        </View>
                        <View style={styles.gridCardBody}>
                          <Text style={styles.gridCardCategory}>
                            {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                          </Text>
                          <Text style={styles.gridCardTitle} numberOfLines={1}>{addr.title}</Text>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.locationRow}>
                              <Icons.MapPin color="#64748B" size={12} strokeWidth={2} />
                              <Text style={styles.locationTextSmall}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} style={styles.favoriteButtonSmall}>
                              <Icons.Heart
                                color={isFav ? '#C52824' : '#94A3B8'}
                                fill={isFav ? '#C52824' : 'transparent'}
                                size={16}
                                strokeWidth={2}
                              />
                            </Pressable>
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : viewMode === 'see_all_recommended' ? (
            /* ── 2. SEE ALL RECOMMENDED VIEW (CAPPED AT 50) ── */
            <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 }}>
              <View style={styles.seeAllHeaderRow}>
                <Pressable style={styles.backBtn} onPress={() => setViewMode('home')}>
                  <Icons.ArrowLeft size={18} color="#1E293B" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.backBtnText}>Retour</Text>
                </Pressable>
                <Text style={styles.seeAllTitle}>⭐ Recommandations ({Math.min(50, recommendedAddresses.length)})</Text>
              </View>

              <View style={styles.verticalGridContainer}>
                {recommendedAddresses.slice(0, 50).map(addr => {
                  const isFav = favorites.includes(addr.id);
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
                          phone: (addr as any).telephone || '',
                          website: (addr as any).site_web || '',
                        });
                      }}
                    >
                      <Image source={{ uri: addr.image_url }} style={styles.gridCardImage} resizeMode="cover" />
                      <View style={styles.ratingBadgeGrid}>
                        <Icons.Star color="#E5A93B" size={11} fill="#E5A93B" />
                        <Text style={styles.ratingTextSmall}>{typeof addr.rating === 'number' ? addr.rating.toFixed(1) : addr.rating}</Text>
                      </View>
                      <View style={styles.gridCardBody}>
                        <Text style={styles.gridCardCategory}>
                          {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                        </Text>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{addr.title}</Text>
                        <View style={styles.cardFooterRow}>
                          <View style={styles.locationRow}>
                            <Icons.MapPin color="#64748B" size={12} strokeWidth={2} />
                            <Text style={styles.locationTextSmall}>{addr.location}</Text>
                          </View>
                          <Pressable onPress={() => toggleFavorite(addr.id)} style={styles.favoriteButtonSmall}>
                            <Icons.Heart
                              color={isFav ? '#C52824' : '#94A3B8'}
                              fill={isFav ? '#C52824' : 'transparent'}
                              size={16}
                              strokeWidth={2}
                            />
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
                  <Icons.ArrowLeft size={18} color="#1E293B" strokeWidth={2.5} style={{ marginRight: 6 }} />
                  <Text style={styles.backBtnText}>Retour</Text>
                </Pressable>
                <Text style={styles.seeAllTitle}>🔥 Nouveautés toulousaines ({Math.min(50, newAddresses.length)})</Text>
              </View>

              <View style={styles.verticalGridContainer}>
                {newAddresses.slice(0, 50).map(addr => {
                  const isFav = favorites.includes(addr.id);
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
                          phone: (addr as any).telephone || '',
                          website: (addr as any).site_web || '',
                        });
                      }}
                    >
                      <Image source={{ uri: addr.image_url }} style={styles.gridCardImage} resizeMode="cover" />
                      <View style={styles.ratingBadgeGrid}>
                        <Icons.Star color="#E5A93B" size={11} fill="#E5A93B" />
                        <Text style={styles.ratingTextSmall}>{typeof addr.rating === 'number' ? addr.rating.toFixed(1) : addr.rating}</Text>
                      </View>
                      <View style={styles.gridCardBody}>
                        <Text style={styles.gridCardCategory}>
                          {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                        </Text>
                        <Text style={styles.gridCardTitle} numberOfLines={1}>{addr.title}</Text>
                        <View style={styles.cardFooterRow}>
                          <View style={styles.locationRow}>
                            <Icons.MapPin color="#64748B" size={12} strokeWidth={2} />
                            <Text style={styles.locationTextSmall}>{addr.location}</Text>
                          </View>
                          <Pressable onPress={() => toggleFavorite(addr.id)} style={styles.favoriteButtonSmall}>
                            <Icons.Heart
                              color={isFav ? '#C52824' : '#94A3B8'}
                              fill={isFav ? '#C52824' : 'transparent'}
                              size={16}
                              strokeWidth={2}
                            />
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
                  {categories.map(category => {
                    const isSelected = selectedCategoryFilter === category.id;
                    return (
                      <Pressable
                        key={category.id}
                        style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                        onPress={() => setSelectedCategoryFilter(isSelected ? null : category.id)}
                      >
                        <View style={[styles.categoryIconBg, { backgroundColor: `${category.color}15` }]}>
                          <DynamicIcon name={category.icon_name} color={category.color} size={20} />
                        </View>
                        <Text style={[styles.categoryName, isSelected && styles.categoryNameActive]}>{category.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              {/* Recommendations of the Moment (Large Cards) */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recommandations du moment</Text>
                <Pressable onPress={() => setViewMode('see_all_recommended')}>
                  <Text style={styles.seeAllText}>Voir tout ({Math.min(50, recommendedAddresses.length)})</Text>
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
                  {recommendedAddresses.map(addr => {
                    const isFav = favorites.includes(addr.id);
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
                            phone: (addr as any).telephone || '',
                            website: (addr as any).site_web || '',
                          });
                        }}
                      >
                        <Image source={{ uri: addr.image_url }} style={styles.largeCardImage} resizeMode="cover" />
                        <View style={styles.carouselPaginatorBadge}>
                          <View style={[styles.paginatorDot, styles.paginatorDotActive]} />
                          <View style={styles.paginatorDot} />
                          <View style={styles.paginatorDot} />
                        </View>
                        <View style={styles.ratingBadge}>
                          <Icons.Star color="#E5A93B" size={13} fill="#E5A93B" />
                          <Text style={styles.ratingText}>{typeof addr.rating === 'number' ? addr.rating.toFixed(1) : addr.rating}</Text>
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
                              <Icons.MapPin color="#64748B" size={14} strokeWidth={2} />
                              <Text style={styles.locationText}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} style={styles.favoriteButton}>
                              <Icons.Heart
                                color={isFav ? '#C52824' : '#94A3B8'}
                                fill={isFav ? '#C52824' : 'transparent'}
                                size={18}
                                strokeWidth={2}
                              />
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
                <Text style={styles.sectionTitle}>Nouveautés toulousaines</Text>
                <Pressable onPress={() => setViewMode('see_all_new')}>
                  <Text style={styles.seeAllText}>Voir tout ({Math.min(50, newAddresses.length)})</Text>
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
                  {newAddresses.map(addr => {
                    const isFav = favorites.includes(addr.id);
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
                            phone: (addr as any).telephone || '',
                            website: (addr as any).site_web || '',
                          });
                        }}
                      >
                        <Image source={{ uri: addr.image_url }} style={styles.smallCardImage} resizeMode="cover" />
                        <View style={styles.carouselPaginatorBadgeSmall}>
                          <View style={[styles.paginatorDotSmall, styles.paginatorDotActive]} />
                          <View style={styles.paginatorDotSmall} />
                          <View style={styles.paginatorDotSmall} />
                        </View>
                        <View style={styles.ratingBadge}>
                          <Icons.Star color="#E5A93B" size={11} fill="#E5A93B" />
                          <Text style={styles.ratingTextSmall}>{typeof addr.rating === 'number' ? addr.rating.toFixed(1) : addr.rating}</Text>
                        </View>
                        <View style={styles.smallCardInfo}>
                          <Text style={styles.smallCardCategory}>
                            {categories.find(c => c.id === addr.category_id)?.name || 'Lieu'} • {addr.price_level}
                          </Text>
                          <Text style={styles.smallCardTitle} numberOfLines={1}>{addr.title}</Text>
                          <View style={styles.cardFooterRow}>
                            <View style={styles.locationRow}>
                              <Icons.MapPin color="#64748B" size={12} strokeWidth={2} />
                              <Text style={styles.locationTextSmall}>{addr.location}</Text>
                            </View>
                            <Pressable onPress={() => toggleFavorite(addr.id)} style={styles.favoriteButtonSmall}>
                              <Icons.Heart
                                color={isFav ? '#C52824' : '#94A3B8'}
                                fill={isFav ? '#C52824' : 'transparent'}
                                size={16}
                                strokeWidth={2}
                              />
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
                <ActivityIndicator size="small" color="#C52824" style={{ marginVertical: 20 }} />
              ) : events.length === 0 ? (
                <Text style={styles.emptyText}>Aucun événement pour l'instant</Text>
              ) : (
                <View style={styles.eventsContainer}>
                  {events.map((event) => {
                    const dateParts = new Date(event.event_date);
                    const day = isNaN(dateParts.getDate()) ? 24 : dateParts.getDate();
                    const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
                    const monthStr = months[isNaN(dateParts.getMonth()) ? 4 : dateParts.getMonth()];

                    return (
                      <GlassView key={event.id} glassEffectStyle="regular" tintColor="#ffffff" style={styles.eventCard}>
                        <View style={styles.eventDateBlock}>
                          <Text style={styles.eventDateDay}>{day}</Text>
                          <Text style={styles.eventDateMonth}>{monthStr}</Text>
                        </View>
                        <View style={styles.eventDetails}>
                          <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                          <Text style={styles.eventMeta}>{event.event_time || '19:00'} • {event.location || 'Toulouse'}</Text>
                          <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                          <View style={styles.eventFooter}>
                            <Text style={styles.eventPrice}>
                              {parseFloat(event.price) === 0 ? 'Gratuit' : `€${parseFloat(event.price).toFixed(2)}`}
                            </Text>
                            <Pressable 
                              style={({ pressed }) => [
                                styles.bookBtn,
                                pressed && styles.bookBtnPressed
                              ]}
                              onPress={() => handleBookEvent(event)}
                            >
                              <Text style={styles.bookBtnText}>Réserver</Text>
                            </Pressable>
                          </View>
                        </View>
                      </GlassView>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Custom Booking Confirmation Dialog Modal (Brutalist style) */}
      {bookingEvent && (
        <View style={styles.modalBackdrop}>
          <GlassView glassEffectStyle="regular" tintColor="#1e293b" style={styles.confirmCard}>
            {/* Header Red Strip */}
            <View style={styles.confirmHeaderStrip}>
              <Text style={styles.confirmHeaderStripText}>CONFIRMATION</Text>
            </View>

            <View style={styles.confirmBody}>
              <Icons.Ticket size={36} color="#C52824" style={{ marginBottom: 12 }} />
              
              <Text style={styles.confirmTitle}>{bookingEvent.title}</Text>
              
              <Text style={styles.confirmDesc}>
                Voulez-vous réserver votre place pour cet événement ?
              </Text>

              {/* Price Tag Pill */}
              <View style={styles.confirmPricePill}>
                <Text style={styles.confirmPriceText}>
                  {parseFloat(bookingEvent.price) === 0 ? 'GRATUIT' : `${parseFloat(bookingEvent.price).toFixed(2)} €`}
                </Text>
              </View>

              <Text style={styles.confirmHint}>
                Votre billet avec QR Code unique sera généré directement dans votre Wallet.
              </Text>

              {/* Buttons Row */}
              <View style={styles.confirmActionsRow}>
                {/* Cancel Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmCancelBtn,
                    pressed && styles.btnPressed
                  ]}
                  onPress={() => setBookingEvent(null)}
                >
                  <Text style={styles.confirmCancelBtnText}>Annuler</Text>
                </Pressable>

                {/* Confirm Button */}
                <Pressable
                  style={({ pressed }) => [
                    styles.confirmSuccessBtn,
                    pressed && styles.btnPressed
                  ]}
                  onPress={async () => {
                    const event = bookingEvent;
                    setBookingEvent(null); // close modal
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      if (!session) return;
                      
                      // Check if already registered
                      const { data: existing } = await supabase
                        .from('event_registrations')
                        .select('id')
                        .eq('user_id', session.user.id)
                        .eq('event_id', event.id);

                      if (existing && existing.length > 0) {
                        setInfoAlert({
                          title: "Déjà réservé",
                          message: "Vous avez déjà réservé un billet pour cet événement dans votre Wallet !",
                          type: 'warning'
                        });
                        return;
                      }

                      // Insert registration ticket
                      const { error } = await supabase
                        .from('event_registrations')
                        .insert({
                          user_id: session.user.id,
                          event_id: event.id,
                          payment_status: 'paid'
                        });

                      if (error) throw error;

                      // Open custom booking success ticket modal
                      setSuccessEvent(event);
                    } catch (e: any) {
                      setInfoAlert({
                        title: "Erreur",
                        message: "Impossible de valider la réservation : " + e.message,
                        type: 'error'
                      });
                    }
                  }}
                >
                  <Text style={styles.confirmSuccessBtnText}>Confirmer 🎫</Text>
                </Pressable>
              </View>
            </View>
          </GlassView>
        </View>
      )}

      {/* Custom Booking Success Dialog Modal (Brutalist style indicating visual wallet confirmation) */}
      {successEvent && (
        <View style={styles.modalBackdrop}>
          <GlassView glassEffectStyle="regular" tintColor="#1e293b" style={styles.successCard}>
            {/* Header Green Strip */}
            <View style={styles.successHeaderStrip}>
              <Text style={styles.successHeaderStripText}>RÉSERVATION VALIDÉE 🎉</Text>
            </View>

            <View style={styles.successBody}>
              <Icons.CheckCircle size={44} color="#10B981" style={{ marginBottom: 12 }} />
              
              <Text style={styles.successTitle}>Félicitations !</Text>
              <Text style={styles.successSubtitle}>Votre place pour</Text>
              
              <Text style={styles.successEventTitle}>{successEvent.title}</Text>
              
              <Text style={styles.successDesc}>
                Votre billet avec QR Code unique a été généré et ajouté avec succès dans votre Wallet de l'application.
              </Text>

              {/* Wallet Direct CTA Button */}
              <Pressable
                style={({ pressed }) => [
                  styles.walletCTA,
                  pressed && styles.walletCTAPressed
                ]}
                onPress={() => {
                  setSuccessEvent(null);
                  if (onChangeTab) {
                    onChangeTab('profile'); // Switch to Profile/Wallet tab automatically!
                  }
                }}
              >
                <Text style={styles.walletCTAText}>Accéder à mon Wallet 🎫</Text>
              </Pressable>
            </View>
          </GlassView>
        </View>
      )}

      {/* Custom Info/Warning/Error Dialog Modal (Brutalist style) */}
      {infoAlert && (
        <View style={styles.modalBackdrop}>
          <GlassView 
            glassEffectStyle="regular" 
            tintColor="#1e293b" 
            style={[
              styles.infoCard, 
              { shadowColor: infoAlert.type === 'info' ? '#E5A93B' : '#C52824' }
            ]}
          >
            {/* Header Strip */}
            <View 
              style={[
                styles.infoHeaderStrip, 
                { backgroundColor: infoAlert.type === 'info' ? '#E5A93B' : '#C52824' }
              ]}
            >
              <Text style={styles.infoHeaderStripText}>
                {infoAlert.type === 'info' ? 'INFORMATION' : infoAlert.type === 'warning' ? 'ATTENTION' : 'ERREUR'}
              </Text>
            </View>

            <View style={styles.infoBody}>
              {infoAlert.type === 'info' ? (
                <Icons.User size={40} color="#E5A93B" style={{ marginBottom: 12 }} />
              ) : (
                <Icons.AlertTriangle size={40} color="#C52824" style={{ marginBottom: 12 }} />
              )}
              
              <Text style={styles.infoTitle}>{infoAlert.title}</Text>
              <Text style={styles.infoDesc}>{infoAlert.message}</Text>

              {/* Action Button */}
              {infoAlert.title === "Connexion requise" ? (
                <View style={styles.confirmActionsRow}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.infoCloseBtnSecondary,
                      pressed && styles.btnPressed
                    ]}
                    onPress={() => setInfoAlert(null)}
                  >
                    <Text style={styles.infoCloseBtnSecondaryText}>Annuler</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.infoCloseBtnPrimary,
                      pressed && styles.btnPressed
                    ]}
                    onPress={() => {
                      setInfoAlert(null);
                      if (onChangeTab) onChangeTab('profile');
                    }}
                  >
                    <Text style={styles.infoCloseBtnPrimaryText}>Se connecter 👤</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.infoCloseBtnSingle,
                    pressed && styles.btnPressed
                  ]}
                  onPress={() => setInfoAlert(null)}
                >
                  <Text style={styles.infoCloseBtnSingleText}>D'accord</Text>
                </Pressable>
              )}
            </View>
          </GlassView>
        </View>
      )}

      {/* Dedicated Address Detail View Modal */}
      {selectedSpotDetail && (
        <AddressDetailModal
          spot={selectedSpotDetail}
          onClose={() => setSelectedSpotDetail(null)}
          onGoToMap={(spotId) => {
            setSelectedSpotDetail(null);
            if (onSelectSpot) {
              onSelectSpot(spotId);
            }
          }}
        />
      )}

      {/* Categories Drawer - Apple-like Glassmorphic slide up */}
      {showAllCategories && (
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <Pressable style={styles.overlayDismiss} onPress={closeDrawer} />
          
          <Animated.View style={[styles.drawerContainer, drawStyle]}>
            <GlassView
              glassEffectStyle="regular"
              tintColor="#ffffff"
              style={styles.drawerGlass}
            >
              <View {...drawerPanResponder.panHandlers} style={styles.drawerDragZone}>
                <View style={styles.grabHandle} />
                <View style={styles.drawerHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.drawerTitle}>Toutes les catégories 📂</Text>
                    <View style={styles.categoryCountBadge}>
                      <Text style={styles.categoryCountBadgeText}>{ALL_EXPANDED_CATEGORIES.length}</Text>
                    </View>
                  </View>
                  <Pressable style={styles.closeButton} onPress={closeDrawer}>
                    <Icons.X color="#1E293B" size={20} strokeWidth={2.5} />
                  </Pressable>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={styles.categoriesGrid}
              >
                {ALL_EXPANDED_CATEGORIES.map(category => {
                  const isSelected = selectedCategoryFilter === category.id;
                  return (
                    <Pressable
                      key={category.id}
                      style={[styles.gridItem, isSelected && styles.gridItemSelected]}
                      onPress={() => handleSelectCategoryFromModal(category)}
                    >
                      <View style={[styles.gridIconBg, { backgroundColor: `${category.color}20` }]}>
                        <DynamicIcon name={category.icon_name} color={category.color} size={24} />
                      </View>
                      <Text style={[styles.gridItemLabel, isSelected && styles.gridItemLabelSelected]}>{category.name}</Text>
                      {category.badge && (
                        <View style={styles.gridItemBadge}>
                          <Text style={styles.gridItemBadgeText}>{category.badge}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </GlassView>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    height: 56,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 40,
  },
  logoT: {
    fontSize: 26,
    fontWeight: '900',
    color: '#C52824',
  },
  logoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  hookContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 16,
  },
  hookText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  hookSubtitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#C52824',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
  brutalistWrapper: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  brutalistContainer: {
    position: 'relative',
    height: 54,
  },
  shadowLayer: {
    position: 'absolute',
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  brutalistInputContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: 54,
    borderRadius: 14,
    borderWidth: 2.5,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  brutalistSearchIcon: {
    marginRight: 10,
  },
  brutalistInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    height: '100%',
  },
  brutalistLabel: {
    position: 'absolute',
    top: -12,
    right: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 3,
    zIndex: 20,
  },
  brutalistLabelText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  alertBanner: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#FEF3C7',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  alertBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
  alertText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C52824',
  },
  categoriesScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  categoryCardActive: {
    backgroundColor: '#1E293B',
    borderColor: '#1E293B',
  },
  categoryIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  categoryNameActive: {
    color: '#FFFFFF',
  },
  categorySkeleton: {
    width: 120,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    marginRight: 12,
  },
  cardsScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  largeCard: {
    width: 280,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  largeCardImage: {
    width: '100%',
    height: 170,
  },
  largeCardSkeleton: {
    width: 280,
    height: 260,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginRight: 16,
  },
  carouselPaginatorBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  carouselPaginatorBadgeSmall: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  paginatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginatorDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  paginatorDotActive: {
    backgroundColor: '#FFFFFF',
    width: 14,
  },
  ratingBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
  },
  ratingTextSmall: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
  },
  largeCardInfo: {
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
  },
  cardPriceText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  locationTextSmall: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  favoriteButtonSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  smallCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  smallCardImage: {
    width: '100%',
    height: 120,
  },
  smallCardSkeleton: {
    width: 200,
    height: 190,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    marginRight: 16,
  },
  smallCardInfo: {
    padding: 12,
  },
  smallCardCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  smallCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  eventsContainer: {
    paddingHorizontal: 20,
    gap: 16,
    marginBottom: 20,
  },
  eventCard: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    padding: 14,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 4,
  },
  eventDateBlock: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDateDay: {
    fontSize: 18,
    fontWeight: '900',
    color: '#C52824',
    lineHeight: 20,
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E293B',
    textTransform: 'uppercase',
  },
  eventDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 2,
  },
  eventMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 4,
  },
  eventDesc: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 16,
    marginBottom: 6,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  eventPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#C52824',
  },
  bookBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bookBtnPressed: {
    backgroundColor: '#C52824',
  },
  bookBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginVertical: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  confirmCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FAF5EF',
  },
  confirmHeaderStrip: {
    height: 36,
    backgroundColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderColor: '#1E293B',
  },
  confirmHeaderStripText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  confirmBody: {
    padding: 20,
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  confirmDesc: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  confirmPricePill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  confirmPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#C52824',
  },
  confirmHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 15,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmCancelBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  confirmSuccessBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  confirmSuccessBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  btnPressed: {
    transform: [{ translateX: 1.5 }, { translateY: 1.5 }],
    shadowOffset: { width: 0.5, height: 0.5 },
  },
  successCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1E293B',
    shadowColor: '#10B981',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FAF5EF',
  },
  successHeaderStrip: {
    height: 36,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderColor: '#1E293B',
  },
  successHeaderStripText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  successBody: {
    padding: 20,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  successSubtitle: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  successEventTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#C52824',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 18,
  },
  successDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  walletCTA: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  walletCTAPressed: {
    transform: [{ translateX: 1.5 }, { translateY: 1.5 }],
    shadowOffset: { width: 0.5, height: 0.5 },
  },
  walletCTAText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  infoCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FAF5EF',
  },
  infoHeaderStrip: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderColor: '#1E293B',
  },
  infoHeaderStripText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  infoBody: {
    padding: 20,
    alignItems: 'center',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  infoDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  infoCloseBtnSingle: {
    width: '100%',
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  infoCloseBtnSingleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  infoCloseBtnPrimary: {
    flex: 1.2,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  infoCloseBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  infoCloseBtnSecondary: {
    flex: 0.8,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  infoCloseBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  overlayDismiss: {
    flex: 1,
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: '#1E293B',
  },
  drawerGlass: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  drawerDragZone: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  grabHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#CBD5E1',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#1E293B',
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesGrid: {
    padding: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridItem: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  gridIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  activeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    boxShadow: '3px 3px 0px #1E293B' as any,
  },
  activeFilterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  activeFilterText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  clearFilterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  categoryCountBadge: {
    backgroundColor: '#C52824',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryCountBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  gridItemSelected: {
    backgroundColor: '#FAF5EF',
    borderColor: '#C52824',
    borderWidth: 3,
  },
  gridItemLabelSelected: {
    color: '#C52824',
    fontWeight: '900',
  },
  gridItemBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  gridItemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  emptyResultsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  resetHomeCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#C52824',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
    borderStyle: 'dashed',
  },
  resetHomeCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C52824',
  },
  verticalGridContainer: {
    gap: 14,
  },
  gridCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 4,
  },
  gridCardImage: {
    width: '100%',
    height: 160,
  },
  ratingBadgeGrid: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  gridCardBody: {
    padding: 14,
  },
  gridCardCategory: {
    fontSize: 11,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  gridCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  seeAllHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  seeAllTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    flex: 1,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    boxShadow: '2px 2px 0px #1E293B' as any,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
});

