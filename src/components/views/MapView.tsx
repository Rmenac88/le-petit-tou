import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Platform,
  Pressable,
  Linking,
  Animated,
  Alert,
  TextInput,
  Dimensions,
  ScrollView,
  PanResponder,
} from 'react-native';
import * as Location from 'expo-location';
import {
  Compass,
  Navigation,
  ArrowUpRight,
  Heart,
  Utensils,
  ShoppingBag,
  SlidersHorizontal,
  Search,
  X,
  Coffee,
  Sparkles,
  Trophy,
  Smile,
  ChevronRight,
  Wine,
  Scissors,
  Landmark,
  Dumbbell,
  CakeSlice,
  MapPin,
} from 'lucide-react-native';
import { getCategoryIcon } from '../../lib/categoryIcons';
import { supabase } from '../../lib/supabase';
import { appCache } from '../../lib/dataCache';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';
import PlaceDetailSheet from '../PlaceDetailSheet';
import { PLACEHOLDER_PHOTO } from '../../constants/placeholder';
import { classifySpot, getBudgetInfo } from '../../lib/categoryResolver';
import { placesRepository } from '../../lib/placesRepository';
import {
  loadDeviceLikedSpotIds,
  fetchGlobalLikesMap,
  toggleSpotLike,
} from '../../lib/likesStore';
import { discoveryStore } from '../../lib/discoveryStore';

import { formatRating } from '../../lib/formatRating';
import { Brand } from '../../constants/brand';
// Conditional dynamic imports to prevent native modules breaking the web bundle
let NativeMapView: any = null;
let NativeMarker: any = null;
let NativePolyline: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default;
    NativeMarker = Maps.Marker;
    NativePolyline = Maps.Polyline;
  } catch (e) {
    console.warn('Native maps not loaded', e);
  }
}

// Toulouse Default Center Coordinates
const TOULOUSE_LAT = 43.6047;
const TOULOUSE_LNG = 1.4442;
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
const { height } = Dimensions.get('window');


export const estimateSpotBudget = (addr: any) => getBudgetInfo(addr);

const PT_SPOTS = placesRepository.getAllSpotsBaseline();

// Ultra-lean DTO for Web Leaflet map (reduces inline HTML payload from 1.2MB to ~40KB)
const LEAN_MAP_MARKERS = PT_SPOTS.map((s: any) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lng: s.lng,
  cat: s.cat,
  image_url: s.image_url,
}));

// Beautiful custom stylized theme for Google Maps (Cream/Slate/Red palette)
const customGoogleMapStyle = [
  { elementType: "geometry", stylers: [{ color: Brand.bg }] },
  { elementType: "labels.text.stroke", stylers: [{ color: Brand.bg }] },
  { elementType: "labels.text.fill", stylers: [{ color: Brand.ink }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#D1E2EC" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: Brand.white }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: Brand.line }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#F1ECE4" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: Brand.bg }] }
];

// Safe Alert wrapper to prevent runtime crashes on web browser
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
};import { getWebMapHtml } from './map/mapboxHtmlTemplate';

export const getMarkerColor = (category: string) => {
  switch (category || 'food') {
    case 'food': return Brand.primary;     // Rouge
    case 'drinks': return Brand.chouchou;   // Or
    case 'shopping': return Brand.violet; // Bleu
    case 'beauty': return Brand.primary;   // Rose
    case 'culture': return '#1FA67A';  // Vert
    case 'sport': return Brand.violet;    // Violet/Indigo
    default: return Brand.primary;
  }
};

export const getCategoryLabel = (category: string) => {
  switch (category || 'food') {
    case 'food': return 'Restauration';
    case 'drinks': return 'Bars & Cafés';
    case 'shopping': return 'Shopping & Mode';
    case 'beauty': return 'Beauté & Bien-être';
    case 'culture': return 'Loisirs & Culture';
    case 'sport': return 'Sport & Activités';
    default: return 'Autre';
  }
};

export const renderCategoryIcon = (category: string) => {
  const size = 11;
  const color = Brand.white;
  const IconComponent = getCategoryIcon(category, category);
  return <IconComponent size={size} color={color} strokeWidth={2} />;
};

export default function MapView({
  focusedSpotId,
  clearFocusedSpot,
  onToggleDock,
  onChangeTab,
}: {
  focusedSpotId?: string | null;
  clearFocusedSpot?: () => void;
  onToggleDock?: (visible: boolean) => void;
  onChangeTab?: (tab: any) => void;
}) {
  const [locationPermission, setLocationPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [activeRoute, setActiveRoute] = useState<{
    spotId: string;
    spotName: string;
    distanceKm: string;
    durationMin: string;
    isFromUserLocation?: boolean;
    routeCoordinates?: { latitude: number; longitude: number }[];
  } | null>(null);
  const [is3dMode, setIs3dMode] = useState(false);

  // Supabase User Interactions States
  const [session, setSession] = useState<any>(null);
  const [likedSpotIds, setLikedSpotIds] = useState<string[]>([]);
  const [likesMap, setLikesMap] = useState<Record<string, number>>({});
  const [visitedSpotIds, setVisitedSpotIds] = useState<string[]>([]);

  useEffect(() => {
    loadDeviceLikedSpotIds().then(setLikedSpotIds);
    fetchGlobalLikesMap().then(setLikesMap);
    setVisitedSpotIds(discoveryStore.getDiscoveredSpotIds());

    const unsubDiscovery = discoveryStore.subscribe((_stats, discoveredIds) => {
      setVisitedSpotIds(discoveredIds);
    });

    const onLikesUpdated = (e: any) => {
      if (e.detail?.spotId) {
        setLikesMap(prev => ({
          ...prev,
          [e.detail.spotId]: e.detail.newCount,
        }));
        setLikedSpotIds(prev => {
          if (e.detail.wasLiked && !prev.includes(e.detail.spotId)) {
            return [...prev, e.detail.spotId];
          } else if (!e.detail.wasLiked && prev.includes(e.detail.spotId)) {
            return prev.filter(id => id !== e.detail.spotId);
          }
          return prev;
        });
      }
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pt_likes_updated', onLikesUpdated);
      return () => {
        window.removeEventListener('pt_likes_updated', onLikesUpdated);
      };
    }
  }, []);

  // Real-time Database loaded/filtered spots list
  const [spots, setSpots] = useState<any[]>(PT_SPOTS);
  const [filteredSpots, setFilteredSpots] = useState<any[]>(PT_SPOTS);

  // Filters State Properties (Matching your design screenshot!)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [subTab, setSubTab] = useState<'tout' | 'adresses' | 'evenements' | 'articles'>('tout');
  const [budget, setBudget] = useState(50); // €10 to €50+
  const [category, setCategory] = useState<string | null>(null); // 'brunch', 'lunch', 'dinner', 'drinks'
  const [ambiance, setAmbiance] = useState<string | null>(null); // 'cosy', 'rooftop', 'trendy', 'calm'
  const [openOnly, setOpenOnly] = useState(false);

  // Drawer Animation States
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showFullAddressModal, setShowFullAddressModal] = useState(false);


  useEffect(() => {
    if (onToggleDock) {
      // Le dock se cache aussi quand la fiche d'une adresse est ouverte (il masquait ses boutons)
      onToggleDock(!filterSheetVisible && !showFullAddressModal && !selectedSpot);
    }
  }, [filterSheetVisible, showFullAddressModal, selectedSpot, onToggleDock]);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const filterAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  useEffect(() => {
    checkPermission();

    // Listen to Leaflet marker clicks on Web
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SPOT_CLICKED') {
            const spot = spots.find(s => s.id === data.id);
            if (spot) {
              // skipMapFly=true car l'iframe a déjà fait flyTo depuis le click du marqueur
              handleSelectSpot(spot, true);
            }
          } else if (data.type === 'MAP_CLICKED') {
            handleCloseCard();
          } else if (data.type === 'MAP_READY') {
            if (iframeRef.current) {
              iframeRef.current.contentWindow?.postMessage(
                JSON.stringify({ type: 'UPDATE_SPOTS', spots: filteredSpots }),
                '*'
              );
              const currentPos = userLocationRef.current || userLocation;
              if (currentPos) {
                iframeRef.current.contentWindow?.postMessage(
                  JSON.stringify({ type: 'USER_LOCATION', ...currentPos, center: false }),
                  '*'
                );
              }
            }
          } else if (data.type === 'ROUTE_READY') {
            // Réponse de l'iframe après fetch Mapbox Directions (CORS-free)
            const distMeters = data.distance || 0;
            const durSec = data.duration || 0;
            const distanceKm = distMeters < 1000
              ? `${Math.round(distMeters)} m`
              : `${(distMeters / 1000).toFixed(1)} km`;
            const durationMin = `${Math.round(durSec / 60)} min`;
            setRouteLoading(false);
            setActiveRoute({
              spotId: data.spotId || '',
              spotName: data.spotName || '',
              distanceKm,
              durationMin,
              isFromUserLocation: !!data.isFromUserLocation,
            });
          } else if (data.type === 'ROUTE_ERROR') {
            setRouteLoading(false);
            // Fallback vers Google Maps externe si l'API Mapbox échoue
            console.warn('ROUTE_ERROR from iframe:', data.message);
          } else if (data.type === 'PITCH_CHANGED') {
            setIs3dMode(!!data.is3d);
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleWebMessage);

      return () => {
        window.removeEventListener('message', handleWebMessage);
      };
  }, [spots]);

  // Handle auto-focus from Profile view favorites selection
  useEffect(() => {
    if (focusedSpotId) {
      const spot = spots.find(s => s.id === focusedSpotId);
      if (spot) {
        handleSelectSpot(spot);

        if (Platform.OS === 'web') {
          setTimeout(() => {
            if (iframeRef.current) {
              iframeRef.current.contentWindow?.postMessage(
                JSON.stringify({ type: 'FOCUS_SPOT', lat: spot.lat, lng: spot.lng }),
                '*'
              );
            }
          }, 150);
        } else if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: spot.lat,
            longitude: spot.lng,
            latitudeDelta: 0.012,
            longitudeDelta: 0.012,
          });
        }
      }
      if (clearFocusedSpot) {
        clearFocusedSpot();
      }
    }
  }, [focusedSpotId, spots]);

  // Auto-sync filtered spots to web Leaflet map
  useEffect(() => {
    if (Platform.OS === 'web' && iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ type: 'UPDATE_SPOTS', spots: filteredSpots }),
        '*'
      );
    }
  }, [filteredSpots]);


  // 1. Initial load of spots from Supabase or repository (runs only once)
  useEffect(() => {
    const initSpots = async () => {
      // 0ms SWR memory cache check (already populated by HomeView)
      const cached = appCache.get<any[]>('addresses');
      if (cached && cached.length > 0) {
        setSpots(formatRawSpots(cached));
        return;
      }

      let rawSpots: any[] = [];
      try {
        if (supabase) {
          const { data, error } = await supabase
            .from('addresses')
            .select('id, title, category_id, location, address, image_url, rating, price_level, is_recommended, is_new, lat, lng, tags, telephone, site_web, horaires, description, gallery_urls, full_description');
          if (!error && data && data.length > 0) {
            rawSpots = data;
            appCache.set('addresses', data);
          }
        }
      } catch (err) {
        console.log('DEBUG: addresses table fetch fallback.');
      }

      if (rawSpots.length === 0) {
        setSpots(placesRepository.getAllSpotsBaseline());
      } else {
        setSpots(formatRawSpots(rawSpots));
      }
    };

    initSpots();

    const onAddressesChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail) && e.detail.length > 0) {
        setSpots(formatRawSpots(e.detail));
      } else {
        initSpots();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pt_addresses_changed', onAddressesChanged);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pt_addresses_changed', onAddressesChanged);
      }
    };
  }, []);

  const formatRawSpots = (rawSpots: any[]) => {
    return rawSpots.map((addr: any) => placesRepository.formatRawAddress(addr));
  };

  // 2. Synchronous Instant 0ms Filter Engine (Search, Category, Ambiance, Budget, SubTabs)
  useEffect(() => {
    let results = spots.filter((s: any) => {
      // A. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = (s.name || '').toLowerCase().includes(q);
        const matchesDesc = (s.description || '').toLowerCase().includes(q);
        const matchesTag = s.tags && s.tags.some((t: string) => t.toLowerCase().includes(q));
        const matchesCrumbs = s.breadcrumbs && s.breadcrumbs.some((b: string) => b.toLowerCase().includes(q));
        const matchesLoc = (s.location || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesTag && !matchesCrumbs && !matchesLoc) return false;
      }

      // B. SubTabs Filter
      if (subTab === 'articles' && !s.is_recommended) return false;
      if (subTab === 'evenements' && !s.tags?.some((t: string) => ['fete', 'nuit', 'evenement', 'concert', 'spectacle'].some(w => t.toLowerCase().includes(w)))) return false;

      // C. Category Filter
      if (category && s.cat !== category) return false;

      // D. Ambiance Filter
      if (ambiance) {
        const ambTerms: Record<string, string[]> = {
          cosy: ['cosy', 'chaleureux', 'calme', 'intimiste', 'the', 'bistrot', 'salon'],
          rooftop: ['rooftop', 'terrasse', 'vue', 'exterieur', 'patio', 'jardin'],
          trendy: ['tendance', 'trendy', 'concept', 'moderne', 'nouveau', 'jeune', 'style'],
          calm: ['calme', 'detente', 'zen', 'repos', 'paisible', 'coworking', 'lecture'],
        };
        const terms = ambTerms[ambiance] || [];
        const fullBlob = `${s.name} ${s.description} ${(s.tags || []).join(' ')} ${(s.breadcrumbs || []).join(' ')}`.toLowerCase();
        if (!terms.some(t => fullBlob.includes(t))) return false;
      }

      // E. Budget Filter (Exact real-time budget comparison)
      if (budget < 50) {
        if (s.estimated_budget > budget) return false;
      }

      // F. Open Only
      if (openOnly && !s.is_open_now) return false;

      return true;
    });

    setFilteredSpots(results);
  }, [spots, searchQuery, subTab, category, ambiance, budget, openOnly]);

  const handleSelectSpot = (spot: any, skipMapFly = false) => {
    triggerHaptic();
    setSelectedSpot(spot);
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          type: 'SELECT_SPOT',
          id: spot.id,
          lat: spot.lat,
          lng: spot.lng,
          skipFly: skipMapFly, // l'iframe ne refait pas flyTo si déjà fait par le click du marqueur
          spots: filteredSpots,
        }),
        '*'
      );
    } else if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: spot.lat,
        longitude: spot.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 600);
    }
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  // Bouton flèche = reset vue macro Toulouse (pas cycle adresse)
  const handleResetToulouseView = () => {
    triggerHaptic();
    handleCloseCard();
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'RESET_TOULOUSE' }),
        '*'
      );
    } else if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: TOULOUSE_LAT,
        longitude: TOULOUSE_LNG,
        latitudeDelta: 0.07,
        longitudeDelta: 0.07,
      }, 700);
    }
  };

  const handleCloseCard = () => {
    setIsSearchFocused(false);
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'DESELECT_SPOT', spots: filteredSpots }),
        '*'
      );
    }
    Animated.timing(slideAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => setSelectedSpot(null));
  };

  const FILTER_DRAWER_HEIGHT = height * 0.92;
  const FILTER_SNAP_HALF = FILTER_DRAWER_HEIGHT - height * 0.55;
  const FILTER_SNAP_FULL = 0;

  const handleOpenFilters = () => {
    triggerHaptic();
    if (onToggleDock) onToggleDock(false);
    setFilterSheetVisible(true);
    Animated.spring(filterAnim, {
      toValue: FILTER_SNAP_HALF,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  };

  const handleCloseFilters = () => {
    Animated.timing(filterAnim, {
      toValue: Dimensions.get('window').height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setFilterSheetVisible(false);
      if (onToggleDock) onToggleDock(true);
    });
  };

  const filterDragStart = useRef(0);
  const filterPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderTerminationRequest: () => true,
        onPanResponderGrant: () => {
          filterAnim.stopAnimation((val) => {
            filterDragStart.current = val;
          });
        },
        onPanResponderMove: (_, g) => {
          const newY = filterDragStart.current + g.dy;
          filterAnim.setValue(Math.max(FILTER_SNAP_FULL, Math.min(height, newY)));
        },
        onPanResponderRelease: (_, g) => {
          const vy = g.vy;
          let curY = 0;
          filterAnim.stopAnimation((val) => { curY = val; });
          if (vy > 0.5) {
            if (curY > FILTER_SNAP_HALF * 0.7) {
              handleCloseFilters();
            } else {
              Animated.spring(filterAnim, {
                toValue: FILTER_SNAP_HALF,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            }
          } else if (vy < -0.5) {
            Animated.spring(filterAnim, {
              toValue: FILTER_SNAP_FULL,
              useNativeDriver: true,
              tension: 50,
              friction: 8,
            }).start();
          } else {
            const mid = (FILTER_SNAP_FULL + FILTER_SNAP_HALF) / 2;
            if (curY < mid) {
              Animated.spring(filterAnim, {
                toValue: FILTER_SNAP_FULL,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            } else if (curY < FILTER_SNAP_HALF + height * 0.15) {
              Animated.spring(filterAnim, {
                toValue: FILTER_SNAP_HALF,
                useNativeDriver: true,
                tension: 50,
                friction: 8,
              }).start();
            } else {
              handleCloseFilters();
            }
          }
        },
      }),
    []
  );

  const handleResetFilters = () => {
    setSearchQuery('');
    setCategory(null);
    setAmbiance(null);
    setBudget(50);
    setOpenOnly(false);
  };

  // Récupération rigoureuse de la position GPS de l'utilisateur en temps réel
  const getPreciseUserLocation = async (timeoutMs = 7000): Promise<{ lat: number; lng: number } | null> => {
    if (userLocationRef.current) {
      return userLocationRef.current;
    }

    // 1. Sur Web : tentative directe via navigator.geolocation avec HighAccuracy
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        try {
          const coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
            const timeoutId = setTimeout(() => {
              resolve(null);
            }, timeoutMs);

            navigator.geolocation.getCurrentPosition(
              (pos) => {
                clearTimeout(timeoutId);
                const c = {
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                };
                resolve(c);
              },
              (err) => {
                clearTimeout(timeoutId);
                console.warn('[Geolocation Web Warning]', err.message);
                resolve(null);
              },
              {
                enableHighAccuracy: true,
                timeout: timeoutMs,
                maximumAge: 5000,
              }
            );
          });

          if (coords) {
            userLocationRef.current = coords;
            setUserLocation(coords);
            if (iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                JSON.stringify({ type: 'USER_LOCATION', ...coords, center: false }),
                '*'
              );
            }
            return coords;
          }
        } catch (e) {
          console.warn('Navigator geolocation error:', e);
        }
      }
    }

    // 2. Sur Mobile natif ou si le navigateur Web a renvoyé null
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status === 'granted') {
        setLocationPermission('granted');
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        userLocationRef.current = coords;
        setUserLocation(coords);
        if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ type: 'USER_LOCATION', ...coords, center: false }),
            '*'
          );
        }
        return coords;
      } else {
        setLocationPermission('denied');
        return null;
      }
    } catch (err) {
      console.warn('Expo Location error:', err);
      return null;
    }
  };

  const checkPermission = async () => {
    try {
      if (Platform.OS === 'web') {
        setLocationPermission('granted');
        getUserLocation(false);
        return;
      }

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission('granted');
        await getUserLocation(false);
      } else {
        setLocationPermission('denied');
      }
    } catch (e) {
      console.warn('Error checking location permission', e);
      setLocationPermission('granted');
    }
  };

  const requestPermission = async () => {
    try {
      setLoading(true);
      if (Platform.OS === 'web') {
        const coords = await getPreciseUserLocation(8000);
        if (coords) {
          setLocationPermission('granted');
        } else {
          setLocationPermission('denied');
        }
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationPermission('granted');
          await getUserLocation(false);
        } else {
          setLocationPermission('denied');
        }
      }
    } catch (e) {
      console.warn('Error requesting location permission', e);
      setLocationPermission('denied');
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = async (centerMap = false) => {
    try {
      const coords = await getPreciseUserLocation(6000);
      if (coords && centerMap) {
        if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ type: 'USER_LOCATION', ...coords, center: true }),
            '*'
          );
        } else if (mapRef.current) {
          mapRef.current.animateToRegion({
            latitude: coords.lat,
            longitude: coords.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          });
        }
      }
    } catch (e) {
      console.warn('Error getting position', e);
    }
  };

  const handleResetToToulouse = () => {
    if (Platform.OS === 'web') {
      if (iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ type: 'RESET_TOULOUSE' }),
          '*'
        );
      }
    } else if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: TOULOUSE_LAT,
        longitude: TOULOUSE_LNG,
        latitudeDelta: 0.055,
        longitudeDelta: 0.055,
      });
    }
    handleCloseCard();
  };

  const handleCenterOnMe = async () => {
    triggerHaptic();
    let coords = userLocationRef.current || userLocation;
    if (!coords) {
      coords = await getPreciseUserLocation(6000);
    }

    if (coords) {
      if (Platform.OS === 'web') {
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage(
            JSON.stringify({ type: 'USER_LOCATION', ...coords, center: true }),
            '*'
          );
        }
      } else if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
      }
    } else {
      Alert.alert(
        'Position indisponible',
        'Veuillez autoriser la géolocalisation pour centrer la carte sur votre position exacte.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleToggle3D = () => {
    triggerHaptic();
    const next = !is3dMode;
    setIs3dMode(next);
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'SET_3D_MODE', enabled: next }),
        '*'
      );
    } else if (mapRef.current) {
      mapRef.current.animateCamera({
        pitch: next ? 55 : 0,
        heading: next ? -15 : 0,
      });
    }
  };

  // Calcul d'itinéraire hyper rigoureux : basé strictement sur la position GPS de l'utilisateur
  const handleCalculateRoute = async (spot: any) => {
    triggerHaptic();
    setRouteLoading(true);

    // 1. Obtenir impérativement la position exacte en temps réel de l'utilisateur
    let coords = userLocationRef.current || userLocation;
    if (!coords) {
      coords = await getPreciseUserLocation(6000);
    }

    // 2. Si la position est introuvable (refus ou indisponible), ne JAMAIS feindre Capitole silencieusement !
    if (!coords) {
      setRouteLoading(false);
      Alert.alert(
        'Position GPS requise',
        'Pour calculer un itinéraire précis depuis votre position exacte, la géolocalisation doit être activée.\n\nQue souhaitez-vous faire ?',
        [
          {
            text: 'Annuler',
            style: 'cancel',
          },
          {
            text: 'Ouvrir dans Maps',
            onPress: () => handleOpenItinerary(spot),
          },
          {
            text: 'Départ Capitole',
            onPress: () => {
              performRouteCalculation(
                { lat: TOULOUSE_LAT, lng: TOULOUSE_LNG },
                spot,
                false
              );
            },
          },
        ]
      );
      return;
    }

    // 3. Position GPS confirmée : calcul rigoureux depuis la position réelle
    await performRouteCalculation(coords, spot, true);
  };

  const performRouteCalculation = async (
    startCoord: { lat: number; lng: number },
    spot: any,
    isFromUser: boolean
  ) => {
    setRouteLoading(true);
    const endCoord = { lat: spot.lat, lng: spot.lng };

    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      // Mettre à jour le point de position utilisateur sur la carte web
      if (isFromUser) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ type: 'USER_LOCATION', lat: startCoord.lat, lng: startCoord.lng, center: false }),
          '*'
        );
      }

      // Délègue le fetch Mapbox à l'iframe pour éviter le CORS
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          type: 'FETCH_ROUTE',
          startLng: startCoord.lng,
          startLat: startCoord.lat,
          endLng: endCoord.lng,
          endLat: endCoord.lat,
          spotId: spot.id,
          spotName: spot.name || spot.title || '',
          isFromUserLocation: isFromUser,
        }),
        '*'
      );
      // setRouteLoading sera remis à false par ROUTE_READY ou ROUTE_ERROR
    } else {
      // Sur mobile natif (iOS / Android), fetch Mapbox direct
      try {
        const res = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/walking/${startCoord.lng},${startCoord.lat};${endCoord.lng},${endCoord.lat}?geometries=geojson&overview=full&access_token=${MAPBOX_ACCESS_TOKEN}`
        );
        if (!res.ok) throw new Error('Route request failed');
        const data = await res.json();
        if (!data.routes || data.routes.length === 0) throw new Error('Aucun itinéraire trouvé');
        const route = data.routes[0];
        const distMeters = route.distance;
        const durSec = route.duration;
        const coordsList = (route.geometry?.coordinates || []).map((pt: [number, number]) => ({
          latitude: pt[1],
          longitude: pt[0],
        }));

        setActiveRoute({
          spotId: spot.id,
          spotName: spot.name || spot.title,
          distanceKm: distMeters < 1000 ? `${Math.round(distMeters)} m` : `${(distMeters / 1000).toFixed(1)} km`,
          durationMin: `${Math.round(durSec / 60)} min`,
          isFromUserLocation: isFromUser,
          routeCoordinates: coordsList,
        });

        // Ajuster la vue carte pour afficher l'utilisateur et la destination
        if (mapRef.current && coordsList.length > 0) {
          mapRef.current.fitToCoordinates(coordsList, {
            edgePadding: { top: 120, right: 50, bottom: 250, left: 50 },
            animated: true,
          });
        }
      } catch (err: any) {
        console.warn('Error computing itinerary on native:', err);
        handleOpenItinerary(spot);
      } finally {
        setRouteLoading(false);
      }
    }
  };

  const handleClearRoute = () => {
    triggerHaptic();
    setActiveRoute(null);
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'CLEAR_ROUTE' }),
        '*'
      );
    }
  };

  // Ouverture dans Maps externe avec mode piéton et point de départ = position utilisateur
  const handleOpenItinerary = (spot: any) => {
    const spotName = spot.name || spot.title || 'Établissement';
    const lat = spot.lat;
    const lng = spot.lng;
    const currentLoc = userLocationRef.current || userLocation;

    if (lat && lng) {
      if (Platform.OS === 'ios') {
        // iOS Apple Maps avec mode piéton et départ Current Location
        const url = `maps://?saddr=Current%20Location&daddr=${lat},${lng}&dirflg=w`;
        Linking.canOpenURL(url).then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            const webUrl = currentLoc
              ? `https://www.google.com/maps/dir/?api=1&origin=${currentLoc.lat},${currentLoc.lng}&destination=${lat},${lng}&travelmode=walking`
              : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
            Linking.openURL(webUrl);
          }
        }).catch(() => {
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
          Linking.openURL(webUrl);
        });
        return;
      } else if (Platform.OS === 'android') {
        // Android Google Maps avec mode piéton
        const url = `google.navigation:q=${lat},${lng}&mode=w`;
        Linking.canOpenURL(url).then((supported) => {
          if (supported) {
            Linking.openURL(url);
          } else {
            const webUrl = currentLoc
              ? `https://www.google.com/maps/dir/?api=1&origin=${currentLoc.lat},${currentLoc.lng}&destination=${lat},${lng}&travelmode=walking`
              : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
            Linking.openURL(webUrl);
          }
        }).catch(() => {
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
          Linking.openURL(webUrl);
        });
        return;
      } else {
        // Web Google Maps piéton avec coordonnées utilisateur si dispo
        const webUrl = currentLoc
          ? `https://www.google.com/maps/dir/?api=1&origin=${currentLoc.lat},${currentLoc.lng}&destination=${lat},${lng}&travelmode=walking`
          : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
        Linking.openURL(webUrl);
        return;
      }
    }

    // Fallback par adresse si lat/lng absents
    const fullAddress = spot.address && spot.address !== 'Toulouse' && spot.address !== 'Toulouse Centre'
      ? spot.address
      : `${spotName}, Toulouse`;
    const targetQuery = `${spotName}, ${fullAddress}`;

    const scheme = Platform.select({
      ios: `maps://?saddr=Current%20Location&daddr=${encodeURIComponent(targetQuery)}&dirflg=w`,
      android: `google.navigation:q=${encodeURIComponent(targetQuery)}&mode=w`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetQuery)}&travelmode=walking`
    });
    Linking.openURL(scheme).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(targetQuery)}&travelmode=walking`);
    });
  };

  const handleToggleLike = async (spotId: string) => {
    triggerHaptic();
    const { updatedLikedIds, updatedLikesMap } = await toggleSpotLike(
      spotId,
      likesMap,
      likedSpotIds
    );
    setLikedSpotIds(updatedLikedIds);
    setLikesMap(updatedLikesMap);
  };

  // --- 1. Asking Location Permission Screen ---
  if (locationPermission === 'denied') {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrapper}>
            <Compass size={40} color={Brand.primaryDeep} />
          </View>
          <Text style={styles.permissionTitle}>Activer la carte ?</Text>
          <Text style={styles.permissionDesc}>
            Autorisez la géolocalisation pour afficher les adresses du Petit Tou à Toulouse les plus proches de vous en direct !
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color={Brand.primaryDeep} style={{ marginTop: 20 }} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.permissionBtn,
                pressed && styles.permissionBtnPressed,
              ]}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>Géolocalisez-moi</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setLocationPermission('granted');
              handleResetToToulouse();
            }}
            style={styles.skipBtn}
          >
            <Text style={styles.skipBtnText}>Continuer sans géolocalisation (Place du Capitole)</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dynamic Render based on Platform */}
      {Platform.OS === 'web' ? (
        <iframe
          ref={iframeRef}
          srcDoc={getWebMapHtml(MAPBOX_ACCESS_TOKEN)}
          onLoad={() => {
            setTimeout(() => {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ type: 'UPDATE_SPOTS', spots: filteredSpots }),
                '*'
              );
            }, 200);
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            zIndex: 0,
          } as any}
          tabIndex={-1}
        />
      ) : (
        NativeMapView && (
          <NativeMapView
            ref={mapRef}
            style={styles.nativeMap}
            customMapStyle={customGoogleMapStyle}
            initialRegion={{
              latitude: userLocation?.lat || TOULOUSE_LAT,
              longitude: userLocation?.lng || TOULOUSE_LNG,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
            onPress={handleCloseCard}
          >
            {/* Render custom filtered spots */}
            {filteredSpots.map((s) => {
              const isSelected = selectedSpot?.id === s.id;
              return (
                <NativeMarker
                  key={s.id}
                  coordinate={{ latitude: s.lat, longitude: s.lng }}
                  onPress={() => handleSelectSpot(s)}
                  zIndex={isSelected ? 99 : 1}
                  tracksViewChanges={isSelected}
                >
                  <View
                    style={[
                      styles.nativeMarker,
                      { backgroundColor: getMarkerColor(s.cat || s.category) },
                      visitedSpotIds.includes(s.id) && styles.nativeMarkerDiscovered,
                      isSelected && styles.nativeMarkerSelected,
                    ]}
                  >
                    {renderCategoryIcon(s.cat || s.category)}
                    {visitedSpotIds.includes(s.id) && (
                      <View style={styles.discoveredBadgeDot} />
                    )}
                  </View>
                </NativeMarker>
              );
            })}

            {/* Tracé de l'itinéraire piéton sur carte native */}
            {NativePolyline && activeRoute?.routeCoordinates && activeRoute.routeCoordinates.length > 0 && (
              <>
                <NativePolyline
                  coordinates={activeRoute.routeCoordinates}
                  strokeColor={Brand.ink}
                  strokeWidth={7}
                />
                <NativePolyline
                  coordinates={activeRoute.routeCoordinates}
                  strokeColor={Brand.primary}
                  strokeWidth={4.5}
                />
              </>
            )}
          </NativeMapView>
        )
      )}

      {/* Real Neo-Brutalist Search Bar with Live TextInput */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchIconBadge}>
          <Search size={16} color={Brand.white} strokeWidth={2} />
        </View>

        <TextInput
          style={styles.searchInput}
          placeholder={
            filteredSpots && filteredSpots.length > 0
              ? `Rechercher (${filteredSpots.length} adresses)...`
              : "Rechercher une adresse..."
          }
          placeholderTextColor={Brand.inkSoft}
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setIsSearchFocused(true);
          }}
          onFocus={() => setIsSearchFocused(true)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />

        {searchQuery.trim().length > 0 && (
          <Pressable
            style={styles.searchClearBtn}
            onPress={() => {
              setSearchQuery('');
              setIsSearchFocused(false);
            }}
            accessibilityLabel="Effacer la recherche"
          >
            <X size={15} color={Brand.inkSoft} strokeWidth={2} />
          </Pressable>
        )}

        <View style={styles.searchDivider} />

        {/* Bouton Filtres distinct */}
        <Pressable
          style={({ pressed }) => [
            styles.searchFilterBtn,
            pressed && styles.searchFilterBtnPressed,
            filterSheetVisible && styles.searchFilterBtnActive,
          ]}
          onPress={handleOpenFilters}
          accessibilityLabel="Ouvrir les filtres avancés"
        >
          <SlidersHorizontal
            size={17}
            color={filterSheetVisible ? Brand.primary : Brand.ink}
            strokeWidth={2}
          />
        </Pressable>
      </View>

      {/* Instant Autocomplete Suggestions Card (when typing) */}
      {isSearchFocused && searchQuery.trim().length > 0 && (
        <View style={styles.searchSuggestionsCard}>
          <ScrollView
            style={styles.searchSuggestionsScroll}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {filteredSpots.slice(0, 5).map((spot) => (
              <Pressable
                key={spot.id}
                style={({ pressed }) => [
                  styles.suggestionRow,
                  pressed && styles.suggestionRowPressed,
                ]}
                onPress={() => {
                  setIsSearchFocused(false);
                  handleSelectSpot(spot);
                }}
              >
                <View
                  style={[
                    styles.suggestionCatDot,
                    { backgroundColor: getMarkerColor(spot.cat || spot.category) },
                  ]}
                />
                <View style={styles.suggestionTexts}>
                  <Text style={styles.suggestionTitle} numberOfLines={1}>
                    {spot.name || spot.title}
                  </Text>
                  <Text style={styles.suggestionSubtitle} numberOfLines={1}>
                    {spot.address || spot.location || 'Toulouse'}
                  </Text>
                </View>
                <View style={styles.suggestionRating}>
                  <Text style={styles.suggestionRatingText}>{formatRating(spot.rating)}</Text>
                </View>
              </Pressable>
            ))}

            {filteredSpots.length === 0 && (
              <View style={styles.suggestionEmpty}>
                <Text style={styles.suggestionEmptyText}>
                  Aucune adresse trouvée pour "{searchQuery}"
                </Text>
              </View>
            )}

            {filteredSpots.length > 5 && (
              <View style={styles.suggestionFooter}>
                <Text style={styles.suggestionFooterText}>
                  + {filteredSpots.length - 5} autre{filteredSpots.length - 5 > 1 ? 's' : ''} résultat{filteredSpots.length - 5 > 1 ? 's' : ''} sur la carte
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Floating In-Map Itinerary Banner */}
      {activeRoute && (
        <View style={styles.itineraryBanner}>
          <View style={styles.itineraryBannerLeft}>
            <View
              style={[
                styles.itineraryBadge,
                activeRoute.isFromUserLocation && styles.itineraryBadgeGps,
              ]}
            >
              <Navigation size={16} color={Brand.white} strokeWidth={2} />
            </View>
            <View style={styles.itineraryTexts}>
              <View style={styles.itineraryHeaderLine}>
                <Text style={styles.itineraryDuration}>{activeRoute.durationMin}</Text>
                <Text style={styles.itineraryDot}>•</Text>
                <Text style={styles.itineraryDistance}>{activeRoute.distanceKm}</Text>
                <View
                  style={[
                    styles.itineraryOriginBadge,
                    activeRoute.isFromUserLocation
                      ? styles.itineraryOriginBadgeGps
                      : styles.itineraryOriginBadgeManual,
                  ]}
                >
                  <Text style={styles.itineraryOriginBadgeText}>
                    {activeRoute.isFromUserLocation ? 'GPS' : 'Capitole'}
                  </Text>
                </View>
              </View>
              <Text style={styles.itineraryDestination} numberOfLines={1}>
                {activeRoute.isFromUserLocation ? 'Depuis votre position vers ' : 'Vers '}
                <Text style={{ color: Brand.bg, fontWeight: '800' }}>
                  {activeRoute.spotName}
                </Text>
              </Text>
            </View>
          </View>
          <View style={styles.itineraryActions}>
            <Pressable
              style={styles.itineraryExternalBtn}
              onPress={() => {
                if (selectedSpot) {
                  handleOpenItinerary(selectedSpot);
                } else {
                  const target = spots.find((s) => s.id === activeRoute.spotId);
                  if (target) handleOpenItinerary(target);
                }
              }}
            >
              <Text style={styles.itineraryExternalBtnText}>GPS ↗</Text>
            </Pressable>
            <Pressable
              style={styles.itineraryCloseBtn}
              onPress={handleClearRoute}
              accessibilityLabel="Fermer l'itinéraire"
            >
              <X size={16} color={Brand.white} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Floating Category Filter Pills Row (Instant 1-tap filtering directly on the map!) */}
      <View
        style={[
          styles.floatingCategoryBar,
          activeRoute && { top: Platform.OS === 'ios' ? 180 : 160 },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {[
            { label: 'Tous (790)', value: null, icon: Compass, color: Brand.ink },
            { label: 'Restos (286)', value: 'food', icon: Utensils, color: Brand.primaryDeep },
            { label: 'Shopping (231)', value: 'shopping', icon: ShoppingBag, color: Brand.violet },
            { label: 'Bars & Cafés (141)', value: 'drinks', icon: Wine, color: Brand.chouchou },
            { label: 'Beauté (71)', value: 'beauty', icon: Scissors, color: Brand.primary },
            { label: 'Culture (43)', value: 'culture', icon: Landmark, color: '#1FA67A' },
            { label: 'Sport (17)', value: 'sport', icon: Dumbbell, color: Brand.violet },
          ].map((catItem) => {
            const isSelected = category === catItem.value;
            const IconComp = catItem.icon;
            return (
              <Pressable
                key={catItem.label}
                style={[
                  styles.categoryPill,
                  isSelected && {
                    backgroundColor: catItem.color,
                    borderColor: Brand.ink,
                  },
                ]}
                onPress={() => {
                  triggerHaptic();
                  setCategory(isSelected ? null : catItem.value);
                }}
              >
                <IconComp size={14} color={isSelected ? Brand.white : catItem.color} strokeWidth={2} style={{ marginRight: 6 }} />
                <Text
                  style={[
                    styles.categoryPillText,
                    isSelected && styles.categoryPillTextSelected,
                  ]}
                >
                  {catItem.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Apple Maps-like Continuous Tactile Place Detail Sheet */}
      <PlaceDetailSheet
        spot={selectedSpot}
        visible={!!selectedSpot}
        onClose={() => {
          setSelectedSpot(null);
        }}
        onOpenItinerary={(spot) => {
          handleCalculateRoute(spot);
        }}
        isFavorite={selectedSpot ? likedSpotIds.includes(selectedSpot.id) : false}
        likesCount={selectedSpot ? (likesMap[selectedSpot.id] ?? (Number(selectedSpot.likes_count) || 0)) : 0}
        onToggleFavorite={(id) => handleToggleLike(id)}
        routeLoading={routeLoading}
      />

      {/* Address Detail Modal from Map */}
      {showFullAddressModal && selectedSpot && (
        <AddressDetailModal
          spot={{
            id: selectedSpot.id,
            title: selectedSpot.name || selectedSpot.title,
            description: selectedSpot.full_description || selectedSpot.description || selectedSpot.desc,
            full_description: selectedSpot.full_description || selectedSpot.description || selectedSpot.desc,
            breadcrumbs: selectedSpot.breadcrumbs || [],
            tags: selectedSpot.tags || [],
            category: getCategoryLabel(selectedSpot.cat || selectedSpot.category),
            location: selectedSpot.location || 'Toulouse',
            address: selectedSpot.address || `${selectedSpot.name}, Toulouse`,
            lat: selectedSpot.lat,
            lng: selectedSpot.lng,
            rating: selectedSpot.rating || 4.8,
            price_level: selectedSpot.price_max ? `Jusqu'à ${selectedSpot.price_max}€` : '€€',
            image_url: selectedSpot.image_url || PLACEHOLDER_PHOTO,
            photos: selectedSpot.gallery_urls && selectedSpot.gallery_urls.length > 0 ? [selectedSpot.image_url, ...selectedSpot.gallery_urls] : (selectedSpot.image_url ? [selectedSpot.image_url] : []),
            phone: selectedSpot.telephone || selectedSpot.phone || '',
            website: selectedSpot.site_web || selectedSpot.website || '',
            hours: selectedSpot.horaires || selectedSpot.hours || '',
            is_recommended: !!selectedSpot.is_recommended,
          }}
          isFavorite={likedSpotIds.includes(selectedSpot.id)}
          likesCount={likesMap[selectedSpot.id] ?? (Number(selectedSpot.likes_count) || 0)}
          onToggleFavorite={handleToggleLike}
          onClose={() => setShowFullAddressModal(false)}
          onGoToMap={() => {
            setShowFullAddressModal(false);
          }}
        />
      )}

      {/* Floating Action Buttons Row (Perspective 3D, Toulouse Macro, GPS in round buttons) */}
      <View
        style={[
          styles.actionsRow,
          selectedSpot ? { bottom: 185 } : { bottom: 125 },
        ]}
      >
        {/* Bouton Toggle Vue 3D / 2D Perspective */}
        <Pressable
          style={({ pressed }) => [
            styles.floatingRoundBtn,
            styles.perspective3dBtn,
            is3dMode && styles.perspective3dBtnActive,
            pressed && styles.floatingRoundBtnPressed,
          ]}
          onPress={handleToggle3D}
          accessibilityLabel="Basculer perspective 3D"
        >
          <Text style={[styles.perspective3dText, is3dMode && styles.perspective3dTextActive]}>
            {is3dMode ? '2D' : '3D'}
          </Text>
        </Pressable>

        {/* Bouton Reset Vue Macro Toulouse */}
        <Pressable
          style={({ pressed }) => [
            styles.floatingRoundBtn,
            styles.macroViewBtn,
            pressed && styles.floatingRoundBtnPressed,
          ]}
          onPress={handleResetToulouseView}
          accessibilityLabel="Vue d'ensemble Toulouse"
        >
          <Compass size={22} color={Brand.white} strokeWidth={2} />
        </Pressable>

        {/* Center on Me Button */}
        <Pressable
          style={({ pressed }) => [
            styles.floatingRoundBtn,
            pressed && styles.floatingRoundBtnPressed,
          ]}
          onPress={handleCenterOnMe}
          accessibilityLabel="Ma position"
        >
          <Navigation size={20} color={Brand.ink} strokeWidth={2} />
        </Pressable>
      </View>

      {/* --- Filter Drawer (Slide-up Sheet) calqué exactement sur la capture --- */}
      {filterSheetVisible && (
        <Animated.View
          style={[
            styles.filterDrawer,
            { transform: [{ translateY: filterAnim }] }
          ]}
        >
          <View {...filterPanResponder.panHandlers} style={styles.drawerDragZone}>
            <View style={styles.drawerIndicator} />
            <Pressable style={styles.closeDrawerBtn} onPress={handleCloseFilters}>
              <X size={20} color={Brand.ink} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerScrollContent} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {/* Search Input Bar */}
            <View style={styles.searchBarRow}>
              <View style={styles.drawerSearchBarContainer}>
                <Search size={18} color={Brand.inkSoft} style={styles.searchIcon} />
                <TextInput
                  placeholder="Brunch"
                  placeholderTextColor={Brand.inkSoft}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  style={styles.searchBarInput}
                />
              </View>
              <Pressable onPress={() => setSearchQuery('')}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </Pressable>
            </View>

            {/* Sub Tabs Rows */}
            <View style={styles.subTabsContainer}>
              {(['tout', 'adresses', 'evenements', 'articles'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setSubTab(tab)}
                  style={[styles.subTabItem, subTab === tab && styles.subTabItemActive]}
                >
                  <Text style={[styles.subTabText, subTab === tab && styles.subTabTextActive]}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.divider} />

            {/* Filters Sub Title */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeading}>Filtres</Text>
              <Pressable onPress={handleResetFilters}>
                <Text style={styles.resetBtnText}>Réinitialiser</Text>
              </Pressable>
            </View>

            {/* Budget Draggable Range Slider Section */}
            <View style={styles.budgetHeaderRow}>
              <View>
                <Text style={styles.filterLabel}>Budget maximal</Text>
                <Text style={styles.budgetHelperText}>
                  {budget >= 50
                    ? 'Tous les budgets (sans limite)'
                    : `Jusqu'à ${budget}€ par personne`}
                </Text>
              </View>
              <View style={styles.budgetValueBadge}>
                <Text style={styles.budgetValueBadgeText}>
                  {budget >= 50 ? '50€+' : `${budget}€`}
                </Text>
              </View>
            </View>

            <View style={styles.sliderContainer}>
              {/* Stylized Visual Track & Handle */}
              <View style={styles.sliderTrack}>
                <View
                  style={[
                    styles.sliderTrackActive,
                    { width: `${Math.max(0, Math.min(100, ((budget - 10) / 40) * 100))}%` },
                  ]}
                />
                <View
                  style={[
                    styles.sliderHandle,
                    { left: `${Math.max(0, Math.min(100, ((budget - 10) / 40) * 100))}%` },
                  ]}
                />
              </View>

              {/* Native Web Range Input for 60fps Smooth Dragging */}
              {Platform.OS === 'web' && (
                <input
                  type="range"
                  min="10"
                  max="50"
                  step="1"
                  value={budget}
                  onChange={(e: any) => {
                    setBudget(Number(e.target.value));
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: 36,
                    opacity: 0,
                    cursor: 'pointer',
                    zIndex: 20,
                  } as any}
                />
              )}

              {/* Quick Preset Buttons Below */}
              <View style={styles.sliderLabels}>
                {[10, 20, 30, 40, 50].map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => {
                      triggerHaptic();
                      setBudget(val);
                    }}
                    style={[
                      styles.sliderLabelBtn,
                      budget === val && styles.sliderLabelBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.sliderLabelText,
                        budget === val && styles.sliderLabelTextActive,
                      ]}
                    >
                      {val === 50 ? '€ 50+' : `€ ${val}`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Categories Chips */}
            <Text style={styles.filterLabel}>Catégories</Text>
            <View style={styles.chipsRow}>
              {[
                { label: 'Restauration', value: 'food', icon: Utensils },
                { label: 'Bars & Cafés', value: 'drinks', icon: Wine },
                { label: 'Shopping & Mode', value: 'shopping', icon: ShoppingBag },
                { label: 'Beauté & Bien-être', value: 'beauty', icon: Scissors },
                { label: 'Loisirs & Culture', value: 'culture', icon: Landmark },
                { label: 'Sport & Activités', value: 'sport', icon: Dumbbell },
              ].map((c) => {
                const IconComp = c.icon;
                const isSelected = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => {
                      triggerHaptic();
                      setCategory(isSelected ? null : c.value);
                    }}
                    style={[styles.chip, isSelected && styles.chipActive]}
                  >
                    <IconComp size={14} color={isSelected ? Brand.white : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
                    <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Ambiance Chips */}
            <Text style={styles.filterLabel}>Ambiance & Cadre</Text>
            <View style={styles.chipsRow}>
              {[
                { label: 'Cosy & Intimiste', value: 'cosy' },
                { label: 'Rooftop & Terrasse', value: 'rooftop' },
                { label: 'Tendance & Branché', value: 'trendy' },
                { label: 'Calme & Détente', value: 'calm' },
              ].map((a) => (
                <Pressable
                  key={a.value}
                  onPress={() => {
                    triggerHaptic();
                    setAmbiance(ambiance === a.value ? null : a.value);
                  }}
                  style={[styles.chip, ambiance === a.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, ambiance === a.value && styles.chipTextActive]}>
                    {a.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Open Now Toggle */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Ouvert actuellement</Text>
              <Pressable
                style={[styles.customSwitch, openOnly ? styles.switchActive : styles.switchInactive]}
                onPress={() => setOpenOnly(!openOnly)}
              >
                <View style={[styles.switchThumb, openOnly ? styles.thumbActive : styles.thumbInactive]} />
              </Pressable>
            </View>

            {/* Submit Button CTA */}
            <Pressable
              style={({ pressed }) => [
                styles.submitFilterBtn,
                pressed && styles.submitFilterBtnPressed,
              ]}
              onPress={handleCloseFilters}
            >
              <Text style={styles.submitFilterBtnText}>
                Voir les résultats ({filteredSpots.length})
              </Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    backgroundColor: Brand.bg,
  },
  webMap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    borderWidth: 0,
  },
  nativeMap: {
    ...StyleSheet.absoluteFill,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Brand.white,
    padding: 20,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    backgroundColor: Brand.bg,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.line,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
    alignItems: 'center',
  },
  permissionIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: Brand.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '500',
  },
  permissionBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.primaryDeep,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  permissionBtnPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  permissionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.white,
  },
  skipBtn: {
    marginTop: 18,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
    textDecorationLine: 'underline',
  },
  // Dynamic Island Search Pill
  searchBarContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 36,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 440,
    height: 52,
    borderRadius: 20,
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
    zIndex: 99,
  },
  searchIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  searchDivider: {
    width: 1.5,
    height: 24,
    backgroundColor: '#E3DCE0',
    marginRight: 6,
  },
  searchFilterBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchFilterBtnPressed: {
    transform: [{ scale: 0.92 }],
  },
  searchFilterBtnActive: {
    backgroundColor: Brand.primarySoft,
  },

  // Autocomplete Suggestions Dropdown Card
  searchSuggestionsCard: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 94,
    alignSelf: 'center',
    width: '90%',
    maxWidth: 440,
    maxHeight: 280,
    backgroundColor: Brand.bg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Brand.line,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
    zIndex: 98,
    overflow: 'hidden',
  },
  searchSuggestionsScroll: {
    paddingVertical: 6,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  suggestionRowPressed: {
    backgroundColor: '#F1E9DE',
  },
  suggestionCatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  suggestionTexts: {
    flex: 1,
    marginRight: 10,
  },
  suggestionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
  },
  suggestionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Brand.inkSoft,
    marginTop: 2,
  },
  suggestionRating: {
    backgroundColor: '#FFF3D6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  suggestionRatingText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  suggestionEmpty: {
    padding: 16,
    alignItems: 'center',
  },
  suggestionEmptyText: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
  },
  suggestionFooter: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: '#F8F5EE',
    alignItems: 'center',
  },
  suggestionFooterText: {
    fontSize: 12,
    color: Brand.primaryDeep,
    fontWeight: '700',
  },

  // In-Map Route Banner
  itineraryBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 114 : 94,
    left: 16,
    right: 16,
    backgroundColor: Brand.ink,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: Brand.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 95,
  },
  itineraryBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  itineraryBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  itineraryBadgeGps: {
    backgroundColor: '#1FA67A',
  },
  itineraryBadgeIcon: {
    fontSize: 16,
  },
  itineraryOriginBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 6,
    alignSelf: 'center',
  },
  itineraryOriginBadgeGps: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderWidth: 1,
    borderColor: '#1FA67A',
  },
  itineraryOriginBadgeManual: {
    backgroundColor: 'rgba(242, 184, 53, 0.25)',
    borderWidth: 1,
    borderColor: Brand.chouchou,
  },
  itineraryOriginBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.bg,
  },
  itineraryTexts: {
    flex: 1,
  },
  itineraryHeaderLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itineraryDuration: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.bg,
  },
  itineraryDot: {
    fontSize: 12,
    color: Brand.inkSoft,
  },
  itineraryDistance: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.chouchou,
  },
  itineraryDestination: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
    marginTop: 1,
  },
  itineraryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itineraryExternalBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  itineraryExternalBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.bg,
  },
  itineraryCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Floating Category Pills Bar — centré et fixé sous la barre de recherche
  floatingCategoryBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 114 : 98,
    left: 0,
    right: 0,
    zIndex: 89,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
    minHeight: 44,
  },
  categoryPillIcon: {
    fontSize: 13,
    marginRight: 5,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
  },
  categoryPillTextSelected: {
    color: Brand.white,
  },
  
  // Floating Action Buttons — colonne verticale à droite
  actionsRow: {
    position: 'absolute',
    right: 16,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    zIndex: 90,
  },
  floatingRoundBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.bg,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  floatingRoundBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 1, height: 1 },
  },
  macroViewBtn: {
    backgroundColor: Brand.primaryDeep,
  },
  perspective3dBtn: {
    backgroundColor: Brand.bg,
  },
  perspective3dBtnActive: {
    backgroundColor: Brand.chouchou,
    borderColor: Brand.ink,
  },
  perspective3dText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
    letterSpacing: 0.5,
  },
  perspective3dTextActive: {
    color: Brand.white,
  },
  filterBtnActive: {
    backgroundColor: Brand.primaryDeep,
  },
  nativeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Brand.line,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  nativeMarkerSelected: {
    transform: [{ scale: 1.35 }, { translateY: -4 }],
    shadowOffset: { width: 4, height: 4 },
    borderWidth: 1,
  },
  nativeMarkerDiscovered: {
    borderColor: '#1FA67A',
    borderWidth: 2.8,
    shadowColor: '#1FA67A',
    shadowOpacity: 0.6,
  },
  discoveredBadgeDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1FA67A',
    borderWidth: 1.5,
    borderColor: Brand.white,
  },
  markerRed: {
    backgroundColor: Brand.primaryDeep,
  },
  markerGold: {
    backgroundColor: Brand.chouchou,
  },
  markerText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.white,
    lineHeight: 20,
  },

  // --- Bottom Details Card Styling ---
  animatedCardContainer: {
    position: 'absolute',
    bottom: 120, // Positioned just above the floating dock
    left: 20,
    right: 20,
    zIndex: 95,
  },
  detailsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 0,
    padding: 16,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 5,
    position: 'relative',
  },
  cardAccentRed: {
    borderTopWidth: 4,
    borderTopColor: Brand.primary,
  },
  cardAccentGold: {
    borderTopWidth: 4,
    borderTopColor: Brand.chouchou,
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  catTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0,
  },
  tagRed: {
    backgroundColor: Brand.primaryDeep,
  },
  tagGold: {
    backgroundColor: Brand.chouchou,
  },
  catTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.white,
    textTransform: 'uppercase',
  },
  visitTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 0,
  },
  visitTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  budgetTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
    borderWidth: 0,
  },
  budgetTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
  },
  budgetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 4,
  },
  budgetHelperText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.primaryDeep,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 4,
  },
  detailsDesc: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
    lineHeight: 14,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  likeBtn: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 8,
    borderRadius: 21,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 4,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  likeBtnInactive: {
    backgroundColor: Brand.bg,
  },
  likeBtnActive: {
    backgroundColor: Brand.primaryDeep,
    borderColor: Brand.ink,
  },
  likeBtnPressed: {
    transform: [{ scale: 0.96 }],
  },
  itineraryBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  itineraryBtnRed: {
    backgroundColor: Brand.primaryDeep,
  },
  itineraryBtnGold: {
    backgroundColor: Brand.chouchou,
  },
  itineraryBtnPressed: {
    transform: [{ scale: 0.96 }],
  },

  // --- Filter Drawer (Slide-up Sheet) Styling ---
  filterDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Brand.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderColor: Brand.ink,
    zIndex: 100,
    height: '92%',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  drawerDragZone: {
    paddingTop: 4,
    paddingBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottomWidth: 1.5,
    borderBottomColor: Brand.line,
  },
  drawerIndicator: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#E3DCE0',
    marginTop: 8,
    marginBottom: 8,
  },
  closeDrawerBtn: {
    position: 'absolute',
    right: 16,
    top: 8,
  },
  drawerScrollContent: {
    padding: 20,
    paddingBottom: 160,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  drawerSearchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primaryDeep,
  },
  subTabsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  subTabItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  subTabItemActive: {
    backgroundColor: 'rgba(232, 74, 95, 0.08)',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  subTabTextActive: {
    color: Brand.primaryDeep,
  },
  divider: {
    height: 2,
    backgroundColor: Brand.line,
    marginVertical: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ink,
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 12,
    marginTop: 10,
  },
  
  budgetValueBadge: {
    backgroundColor: Brand.primaryDeep,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.line,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  budgetValueBadgeText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 13,
  },
  
  // Draggable Slider Styles
  sliderContainer: {
    marginBottom: 20,
    paddingHorizontal: 6,
    position: 'relative',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Brand.line,
    borderWidth: 1,
    borderColor: '#E3DCE0',
    position: 'relative',
    marginVertical: 14,
  },
  sliderTrackActive: {
    height: '100%',
    backgroundColor: Brand.primaryDeep,
    borderRadius: 4,
  },
  sliderHandle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.bg,
    borderWidth: 3,
    borderColor: Brand.primary,
    position: 'absolute',
    top: -8,
    marginLeft: -11,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabelBtn: {
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Brand.line,
    backgroundColor: Brand.white,
  },
  sliderLabelBtnActive: {
    backgroundColor: 'rgba(232, 74, 95, 0.12)',
    borderColor: Brand.primary,
  },
  sliderLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  sliderLabelTextActive: {
    color: Brand.primaryDeep,
    fontWeight: '800',
  },

  // Chips Styles
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  chipActive: {
    backgroundColor: Brand.primaryDeep,
    borderColor: Brand.ink,
    shadowOffset: { width: 0, height: 0 },
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
  },
  chipTextActive: {
    color: Brand.white,
  },

  // Switch Toggle Styles
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 30,
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  customSwitch: {
    width: 50,
    height: 28,
    borderRadius: 18,
    padding: 3,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: Brand.ink,
  },
  switchInactive: {
    backgroundColor: Brand.line,
    borderWidth: 2,
    borderColor: '#E3DCE0',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Brand.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  thumbActive: {
    alignSelf: 'flex-end',
  },
  thumbInactive: {
    alignSelf: 'flex-start',
  },

  // Submit Button CTA
  submitFilterBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.chouchou, // Golden background color
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    elevation: 3,
  },
  submitFilterBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  submitFilterBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.white,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },

  // Modal Login Requirement Styles
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(43, 29, 70, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999,
  },
  loginCardModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Brand.bg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Brand.line,
    overflow: 'hidden',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
});
