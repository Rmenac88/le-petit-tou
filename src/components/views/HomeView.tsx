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

const { width, height } = Dimensions.get('window');
const APPLE_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const DRAWER_HEIGHT = height * 0.92;
const SNAP_HALF = DRAWER_HEIGHT - height * 0.5;
const SNAP_FULL = 0;

interface Category {
  id: string;
  name: string;
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

      setCategories(catData || []);
      setAddresses(addrData || []);

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

  const closeDrawer = () => {
    drawerY.value = withTiming(height, { duration: 300, easing: APPLE_EASE });
    overlayOpacity.value = withTiming(0, { duration: 250, easing: APPLE_EASE });
    setShowAllCategories(false);
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

  const filteredAddresses = addresses.filter(addr =>
    addr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    addr.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
    addr.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <View style={styles.alertBannerHeader}>
                <Icons.AlertTriangle color="#E5A93B" size={20} strokeWidth={2} />
                <Text style={styles.alertTitle}>Supabase non connecté</Text>
              </View>
              <Text style={styles.alertText}>
                Veuillez configurer votre fichier `.env` avec vos identifiants Supabase pour synchroniser vos adresses de Toulouse.
              </Text>
            </View>
          )}

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
              {categories.map(category => (
                <Pressable key={category.id} style={styles.categoryCard}>
                  <View style={[styles.categoryIconBg, { backgroundColor: `${category.color}15` }]}>
                    <DynamicIcon name={category.icon_name} color={category.color} size={20} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {/* Recommendations of the Moment (Large Cards) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recommandations du moment</Text>
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
                      setSelectedSpotDetail({
                        id: addr.id,
                        title: addr.title,
                        description: addr.description,
                        image_url: addr.image_url,
                        rating: addr.rating,
                        category: categories.find(c => c.id === addr.category_id)?.name || 'Lieu',
                        price_level: addr.price_level,
                        location: addr.location,
                        address: `${addr.location}, Toulouse`,
                      });
                    }}
                  >
                    <Image source={{ uri: addr.image_url }} style={styles.largeCardImage} resizeMode="cover" />
                    
                    {/* Carousel Paginator Dot Indicator Badge */}
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
                      setSelectedSpotDetail({
                        id: addr.id,
                        title: addr.title,
                        description: addr.description,
                        image_url: addr.image_url,
                        rating: addr.rating,
                        category: categories.find(c => c.id === addr.category_id)?.name || 'Lieu',
                        price_level: addr.price_level,
                        location: addr.location,
                        address: `${addr.location}, Toulouse`,
                      });
                    }}
                  >
                    <Image source={{ uri: addr.image_url }} style={styles.smallCardImage} resizeMode="cover" />
                    
                    {/* Carousel Paginator Dot Indicator Badge */}
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

          {/* Association Events Section (Calquée sur la capture) */}
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
                    {/* Left Date Box */}
                    <View style={styles.eventDateBlock}>
                      <Text style={styles.eventDateDay}>{day}</Text>
                      <Text style={styles.eventDateMonth}>{monthStr}</Text>
                    </View>

                    {/* Details Column */}
                    <View style={styles.eventDetails}>
                      <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                      <Text style={styles.eventMeta}>{event.event_time} • {event.location}</Text>
                      <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
                      
                      {/* Price & Book Row */}
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
                <Text style={styles.drawerTitle}>Toutes les catégories</Text>
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
              {categories.map(category => (
                <Pressable
                  key={category.id}
                  style={styles.gridItem}
                  onPress={() => setShowAllCategories(false)}
                >
                  <View style={[styles.gridIconBg, { backgroundColor: `${category.color}15` }]}>
                    <DynamicIcon name={category.icon_name} color={category.color} size={24} />
                  </View>
                  <Text style={styles.gridItemLabel}>{category.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </GlassView>
        </Animated.View>
      </Animated.View>
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
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    height: 60,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  logo: {
    height: 42,
    width: 120,
    backgroundColor: '#FAF5EF',
  },
  hookContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
  },
  hookText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  hookSubtitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#C52824',
    letterSpacing: -0.5,
    marginTop: -2,
  },
  brutalistWrapper: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 16,
  },
  brutalistContainer: {
    position: 'relative',
    width: '100%',
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: -1,
  },
  brutalistInputContainer: {
    width: '100%',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#000000',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  brutalistSearchIcon: {
    marginRight: 10,
  },
  brutalistInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    height: '100%',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineColor: 'transparent',
        boxShadow: 'none',
      } as any
    }),
  },
  brutalistLabel: {
    position: 'absolute',
    left: 0,
    top: -20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#000000',
    zIndex: 10,
  },
  brutalistLabelText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  alertBanner: {
    marginHorizontal: 20,
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 59, 0.25)',
  },
  alertBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#A16207',
  },
  alertText: {
    fontSize: 13,
    color: '#713F12',
    lineHeight: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C52824',
  },
  categoriesScroll: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 12,
    gap: 10,
  },
  categoryIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  cardsScroll: {
    paddingLeft: 20,
    paddingRight: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    paddingHorizontal: 20,
    fontStyle: 'italic',
  },
  largeCard: {
    width: 250,
    height: 270,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginRight: 16,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  largeCardImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#F1F5F9',
  },
  carouselPaginatorBadge: {
    position: 'absolute',
    bottom: 146,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 10,
  },
  carouselPaginatorBadgeSmall: {
    position: 'absolute',
    bottom: 126,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    zIndex: 10,
  },
  paginatorDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginatorDotSmall: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginatorDotActive: {
    width: 12,
    backgroundColor: '#FFFFFF',
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    paddingVertical: 3,
    paddingHorizontal: 7,
    gap: 4,
    zIndex: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(30, 41, 59, 0.1)',
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  largeCardInfo: {
    padding: 14,
    flex: 1,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCategoryText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardPriceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
    marginBottom: 6,
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
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  favoriteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  smallCard: {
    width: 180,
    height: 220,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  smallCardImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#F1F5F9',
  },
  ratingTextSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
  },
  smallCardInfo: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  smallCardCategory: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  smallCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1,
  },
  locationTextSmall: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  favoriteButtonSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },

  // Skeleton Loader Styles
  categorySkeleton: {
    width: 110,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 12,
  },
  largeCardSkeleton: {
    width: 250,
    height: 270,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 16,
  },
  smallCardSkeleton: {
    width: 180,
    height: 220,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    marginRight: 14,
  },

  // Drawer overlay styles
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.25)',
    zIndex: 9999,
  },
  overlayDismiss: {
    flex: 1,
  },
  drawerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  drawerGlass: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.75)' : '#FFFFFF',
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  drawerDragZone: {
    paddingTop: 12,
  },
  grabHandle: {
    width: 54,
    height: 6,
    backgroundColor: '#94A3B8',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1,
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    paddingBottom: 24,
  },
  gridItem: {
    width: (width - 48 - 16) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridItemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  
  // Association Events Styling
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
    width: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1.5,
    borderColor: '#CBD5E1',
    paddingRight: 10,
    marginRight: 12,
  },
  eventDateDay: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C52824',
  },
  eventDateMonth: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  eventMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  eventDesc: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 14,
    marginBottom: 10,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  eventPrice: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E293B',
  },
  bookBtn: {
    height: 30,
    paddingHorizontal: 16,
    borderRadius: 15,
    borderWidth: 1.8,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B', // Golden background color
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  bookBtnPressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 0.5, height: 0.5 },
  },
  bookBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  
  // Custom Booking Dialog Modal styling (Toulouse Neo-Brutalist)
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
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
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  confirmDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmPricePill: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B', // Golden Capitole color
    marginBottom: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  confirmPriceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  confirmHint: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 14,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
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
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
    backgroundColor: '#C52824', // Toulouse Red
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
  
  // Custom Booking Success Modal styling (Neo-Brutalist Green accent)
  successCard: {
    width: '90%',
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1E293B',
    shadowColor: '#10B981', // Premium green shadow indicating success
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
    backgroundColor: '#E5A93B', // Golden Capitole color
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
  
  // Custom Alert Info/Warning Card styling
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
    backgroundColor: '#E5A93B', // Golden Capitole color
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
    fontWeight: '800',
    color: '#64748B',
  },
});
