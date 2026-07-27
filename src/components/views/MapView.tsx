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
import * as TaskManager from 'expo-task-manager';
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
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { BACKGROUND_LOCATION_TASK } from '../../app/_layout';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';

// Conditional dynamic imports to prevent native modules breaking the web bundle
let NativeMapView: any = null;
let NativeMarker: any = null;
if (Platform.OS !== 'web') {
  try {
    const Maps = require('react-native-maps');
    NativeMapView = Maps.default;
    NativeMarker = Maps.Marker;
  } catch (e) {
    console.warn('Native maps not loaded', e);
  }
}

// Toulouse Default Center Coordinates
const TOULOUSE_LAT = 43.6047;
const TOULOUSE_LNG = 1.4442;
const { height } = Dimensions.get('window');

// Le Petit Tou recommended mock spots in Toulouse
const PT_SPOTS = [
  { id: '1', name: "Pont Neuf Crêperie", lat: 43.5999, lng: 1.4406, cat: 'food', desc: "Crêpes artisanales au bord de la Garonne.", price_max: 20, ambiance: 'trendy', is_open_now: true },
  { id: '2', name: "Place du Capitole Café", lat: 43.6044, lng: 1.4435, cat: 'shopping', desc: "Le café mythique historique de Toulouse.", price_max: 35, ambiance: 'calm', is_open_now: true },
  { id: '3', name: "Carmes Tapas Bar", lat: 43.5965, lng: 1.4455, cat: 'food', desc: "Meilleurs tapas toulousains ambiance chaleureuse.", price_max: 50, ambiance: 'cosy', is_open_now: true },
  { id: '4', name: "Saint-Cyprien Concept Store", lat: 43.5985, lng: 1.4325, cat: 'shopping', desc: "Boutique créateur écoresponsable.", price_max: 30, ambiance: 'rooftop', is_open_now: false }
];

// Beautiful custom stylized theme for Google Maps (Cream/Slate/Red palette)
const customGoogleMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#FAF5EF" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FAF5EF" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#1E293B" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#D1E2EC" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E2E8F0" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#F1ECE4" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#FAF5EF" }] }
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
};

// Beautiful customized HTML Map for Web rendering (using CartoDB light cream tiles & Leaflet)
const getWebMapHtml = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: -apple-system, sans-serif; }
    .leaflet-container { background: #FAF5EF !important; }
    
    /* Reposition attribution away from bottom navigation & floating buttons */
    .leaflet-bottom.leaflet-right {
      bottom: 110px !important;
      right: 12px !important;
    }
    .leaflet-control-attribution {
      background: rgba(250, 245, 239, 0.85) !important;
      padding: 3px 8px !important;
      border-radius: 6px !important;
      border: 1px solid #1E293B !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      color: #64748B !important;
      box-shadow: 1px 1px 0px #1E293B !important;
    }
    
    /* Custom Neo-Brutalist Categorized Markers */
    .custom-marker {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      border-radius: 16px;
      border: 2.5px solid #1E293B;
      box-shadow: 2px 2px 0px #1E293B;
      color: #FFFFFF;
      font-weight: 900;
      font-size: 14px;
      transition: transform 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.25s ease;
    }
    .custom-marker.active-marker {
      transform: scale(1.35) translateY(-4px);
      box-shadow: 4px 6px 0px #1E293B;
      border-color: #1E293B;
      z-index: 9999 !important;
    }
    .custom-marker.cat-food { background: #C52824; }
    .custom-marker.cat-drinks { background: #E5A93B; }
    .custom-marker.cat-shopping { background: #3B82F6; }
    .custom-marker.cat-beauty { background: #EC4899; }
    .custom-marker.cat-culture { background: #10B981; }
    .custom-marker.cat-sport { background: #6366F1; }
    
    /* Pulse Ring for User Live Location */
    .user-location-marker {
      width: 14px;
      height: 14px;
      border-radius: 7px;
      background: #3B82F6;
      border: 2px solid #FFFFFF;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.4);
      animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
      0% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
      100% { box-shadow: 0 0 0 0px rgba(59, 130, 246, 0); }
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false }).setView([${TOULOUSE_LAT}, ${TOULOUSE_LNG}], 14);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap',
      keepBuffer: 2,
      updateWhenIdle: true,
      maxNativeZoom: 19
    }).addTo(map);

    var userMarker = null;
    var markersGroup = L.layerGroup().addTo(map);
    var currentSelectedId = null;

    function getIconSvg(cat) {
      if (cat === 'food' || cat === 'brunch' || cat === 'lunch' || cat === 'dinner') return '🍴';
      if (cat === 'drinks' || cat === 'bars' || cat === 'cafe') return '☕';
      if (cat === 'shopping' || cat === 'mode') return '🛍️';
      if (cat === 'sport' || cat === 'activites') return '🏋️';
      if (cat === 'culture' || cat === 'loisirs') return '🎨';
      return '📍';
    }

    // Function to render markers from array
    function renderSpots(spotsArray, activeId) {
      currentSelectedId = activeId || currentSelectedId;
      markersGroup.clearLayers();
      spotsArray.forEach(function(s) {
        var catClass = 'cat-' + (s.cat || s.category || 'food');
        var isActive = s.id === currentSelectedId;
        var activeClass = isActive ? ' active-marker' : '';
        var symbol = getIconSvg(s.cat || s.category);

        var customIcon = L.divIcon({
          className: 'custom-icon-wrapper',
          html: '<div class="custom-marker ' + catClass + activeClass + '">' + symbol + '</div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        L.marker([s.lat, s.lng], { icon: customIcon, zIndexOffset: isActive ? 1000 : 0 })
          .addTo(markersGroup)
          .on('click', function() {
            currentSelectedId = s.id;
            renderSpots(spotsArray, s.id);
            window.parent.postMessage(JSON.stringify({ type: 'SPOT_CLICKED', id: s.id }), '*');
          });
      });
    }

    // Initial load
    renderSpots(${JSON.stringify(PT_SPOTS)});

    // Handle incoming postMessages
    window.addEventListener('message', function(event) {
      try {
        var data = JSON.parse(event.data);
        if (data.type === 'USER_LOCATION') {
          var lat = data.lat;
          var lng = data.lng;
          
          if (userMarker) {
            userMarker.setLatLng([lat, lng]);
          } else {
            var userIcon = L.divIcon({
              className: 'user-icon-wrapper',
              html: '<div class="user-location-marker"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
          }
          map.setView([lat, lng], 15);
        } else if (data.type === 'RESET_TOULOUSE') {
          map.setView([${TOULOUSE_LAT}, ${TOULOUSE_LNG}], 13);
        } else if (data.type === 'FOCUS_SPOT') {
          map.setView([data.lat, data.lng], 15);
          renderSpots(data.spots || [], data.id);
        } else if (data.type === 'SELECT_SPOT') {
          currentSelectedId = data.id;
          renderSpots(data.spots || [], data.id);
        } else if (data.type === 'DESELECT_SPOT') {
          currentSelectedId = null;
          renderSpots(data.spots || [], null);
        } else if (data.type === 'UPDATE_SPOTS') {
          renderSpots(data.spots, currentSelectedId);
        }
      } catch(e) {}
    });

    // Signal parent that Map is loaded and ready
    window.parent.postMessage(JSON.stringify({ type: 'MAP_READY' }), '*');

    // Dismiss selected card when clicking anywhere on the background map (Web)
    map.on('click', function(e) {
      currentSelectedId = null;
      window.parent.postMessage(JSON.stringify({ type: 'MAP_CLICKED' }), '*');
    });
  </script>
</body>
</html>
`;

export const getMarkerColor = (category: string) => {
  switch (category || 'food') {
    case 'food': return '#C52824';     // Rouge
    case 'drinks': return '#E5A93B';   // Or
    case 'shopping': return '#3B82F6'; // Bleu
    case 'beauty': return '#EC4899';   // Rose
    case 'culture': return '#10B981';  // Vert
    case 'sport': return '#6366F1';    // Violet/Indigo
    default: return '#C52824';
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
  const color = "#FFFFFF";
  switch (category || 'food') {
    case 'food': return <Utensils size={size} color={color} />;
    case 'drinks': return <Coffee size={size} color={color} />;
    case 'shopping': return <ShoppingBag size={size} color={color} />;
    case 'beauty': return <Sparkles size={size} color={color} />;
    case 'culture': return <Compass size={size} color={color} />;
    case 'sport': return <Trophy size={size} color={color} />;
    default: return <Smile size={size} color={color} />;
  }
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
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<any | null>(null);

  // Supabase User Interactions States
  const [session, setSession] = useState<any>(null);
  const [likedSpotIds, setLikedSpotIds] = useState<string[]>([]);
  const [visitedSpotIds, setVisitedSpotIds] = useState<string[]>([]);

  // Real-time Database loaded/filtered spots list
  const [spots, setSpots] = useState<any[]>(PT_SPOTS);
  const [filteredSpots, setFilteredSpots] = useState<any[]>(PT_SPOTS);

  // Filters State Properties (Matching your design screenshot!)
  const [searchQuery, setSearchQuery] = useState('');
  const [subTab, setSubTab] = useState<'tout' | 'adresses' | 'evenements' | 'articles'>('tout');
  const [budget, setBudget] = useState(50); // €10 to €50+
  const [category, setCategory] = useState<string | null>(null); // 'brunch', 'lunch', 'dinner', 'drinks'
  const [ambiance, setAmbiance] = useState<string | null>(null); // 'cosy', 'rooftop', 'trendy', 'calm'
  const [openOnly, setOpenOnly] = useState(false);

  // Drawer Animation States
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [showFullAddressModal, setShowFullAddressModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (onToggleDock) {
      onToggleDock(!filterSheetVisible && !showFullAddressModal);
    }
  }, [filterSheetVisible, showFullAddressModal, onToggleDock]);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const filterAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  const mapRef = useRef<any>(null);
  const iframeRef = useRef<any>(null);

  useEffect(() => {
    checkPermission();

    // Setup Auth Listener and Load user data from Supabase
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        if (session) {
          fetchUserInteractions(session.user.id);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setSession(session);
        if (session) {
          fetchUserInteractions(session.user.id);
        } else {
          setLikedSpotIds([]);
          setVisitedSpotIds([]);
        }
      });

      // Listen to Leaflet marker clicks on Web
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'SPOT_CLICKED') {
            const spot = spots.find(s => s.id === data.id);
            if (spot) {
              handleSelectSpot(spot);
            }
          } else if (data.type === 'MAP_CLICKED') {
            handleCloseCard();
          } else if (data.type === 'MAP_READY') {
            if (iframeRef.current) {
              iframeRef.current.contentWindow?.postMessage(
                JSON.stringify({ type: 'UPDATE_SPOTS', spots: filteredSpots }),
                '*'
              );
            }
          }
        } catch (e) {}
      };
      window.addEventListener('message', handleWebMessage);

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('message', handleWebMessage);
      };
    }
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

  // Load spots initially and run filtering query
  useEffect(() => {
    loadAndFilterSpots();
  }, [searchQuery, category, ambiance, budget, openOnly]);

  const loadAndFilterSpots = async () => {
    // 1. Try to fetch and query from Supabase table 'spots'
    try {
      if (supabase) {
        let query = supabase.from('spots').select('*');

        if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
        if (category) query = query.eq('category', category);
        if (ambiance) query = query.eq('ambiance', ambiance);
        if (budget < 50) query = query.lte('price_max', budget);
        if (openOnly) query = query.eq('is_open_now', true);

        const { data, error } = await query;
        if (!error && data) {
          setSpots(data);
          setFilteredSpots(data);
          return;
        }
      }
    } catch (err) {
      console.log('DEBUG: spots table does not exist or fetch failed. Falling back to local data.');
    }

    // 2. Local fallback filtering if Supabase table is not configured yet
    let results = PT_SPOTS.filter((s: any) => {
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      // Category filter mapping
      if (category) {
        const spotCat = s.cat || s.category || 'food';
        if (category !== spotCat) return false;
      }

      // Ambiance filter mapping
      if (ambiance && s.ambiance !== ambiance) return false;

      // Budget filter mapping
      if (budget < 50 && s.price_max > budget) return false;

      // Open now filter mapping
      if (openOnly && !s.is_open_now) return false;

      return true;
    });

    setSpots(PT_SPOTS);
    setFilteredSpots(results);
  };

  const fetchUserInteractions = async (userId: string) => {
    try {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('spot_id')
        .eq('user_id', userId);
      if (favs) {
        setLikedSpotIds(favs.map((f: any) => f.spot_id));
      }

      const { data: visits } = await supabase
        .from('user_visits')
        .select('spot_id')
        .eq('user_id', userId);
      if (visits) {
        setVisitedSpotIds(visits.map((v: any) => v.spot_id));
      }
    } catch (err) {
      console.warn('Error fetching user interactions:', err);
    }
  };

  const handleSelectSpot = (spot: any) => {
    triggerHaptic();
    setSelectedSpot(spot);
    if (Platform.OS === 'web' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({ type: 'SELECT_SPOT', id: spot.id, spots: filteredSpots }),
        '*'
      );
    }
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  };

  const handleCloseCard = () => {
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
    }).start(() => setFilterSheetVisible(false));
  };

  const filterDragStart = useRef(0);
  const filterPanResponder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
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

  const checkPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission('granted');
        getUserLocation();
        startBackgroundLocationUpdates();
      } else {
        setLocationPermission('denied');
      }
    } catch (e) {
      console.warn('Error checking location permission', e);
      setLocationPermission('denied');
    }
  };

  const requestPermission = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermission('granted');
        await getUserLocation();
        await startBackgroundLocationUpdates();
      } else {
        setLocationPermission('denied');
      }
    } catch (e) {
      console.warn('Error requesting location permission', e);
      setLocationPermission('denied');
    } finally {
      setLoading(false);
    }
  };

  const getUserLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);

      if (Platform.OS === 'web' && iframeRef.current) {
        iframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ type: 'USER_LOCATION', ...coords }),
          '*'
        );
      }
    } catch (e) {
      console.warn('Error getting position', e);
    }
  };

  const startBackgroundLocationUpdates = async () => {
    if (Platform.OS === 'web') return;
    try {
      const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
      let finalStatus = backgroundStatus;
      if (backgroundStatus !== 'granted') {
        const { status } = await Location.requestBackgroundPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus === 'granted') {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
        if (!isRegistered) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 60000,
            distanceInterval: 10,
            foregroundService: {
              notificationTitle: "Le Petit Tou",
              notificationBody: "Suivi H24 de vos visites actif",
              notificationColor: "#C52824"
            }
          });
          console.log('DEBUG: Background location updates started.');
        }
      }
    } catch (err) {
      console.warn('Could not start background location tracking:', err);
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

  const handleCenterOnMe = () => {
    if (userLocation) {
      if (Platform.OS === 'web') {
        if (iframeRef.current) {
          iframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ type: 'USER_LOCATION', ...userLocation }),
            '*'
          );
        }
      } else if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
      }
    } else {
      getUserLocation();
    }
  };

  const handleOpenItinerary = (spot: any) => {
    const lat = parseFloat(spot.lat);
    const lng = parseFloat(spot.lng);
    const validLat = isNaN(lat) ? 43.6047 : lat;
    const validLng = isNaN(lng) ? 1.4442 : lng;

    const scheme = Platform.select({
      ios: `maps://?daddr=${validLat},${validLng}&q=${encodeURIComponent(spot.name)}`,
      android: `geo:0,0?q=${validLat},${validLng}(${encodeURIComponent(spot.name)})`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`
    });
    Linking.openURL(scheme).catch(() => {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`);
    });
  };

  const handleToggleLike = async (spotId: string) => {
    if (!session) {
      setShowLoginModal(true);
      return;
    }
    const isLiked = likedSpotIds.includes(spotId);
    try {
      if (isLiked) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .match({ user_id: session.user.id, spot_id: spotId });
        if (error) throw error;
        setLikedSpotIds(prev => prev.filter(id => id !== spotId));
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({ user_id: session.user.id, spot_id: spotId });
        if (error) throw error;
        setLikedSpotIds(prev => [...prev, spotId]);
      }
    } catch (e: any) {
      console.warn('Error toggling like:', e.message);
    }
  };

  // --- 1. Asking Location Permission Screen ---
  if (locationPermission === 'denied') {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrapper}>
            <Compass size={40} color="#C52824" />
          </View>
          <Text style={styles.permissionTitle}>Activer la carte ?</Text>
          <Text style={styles.permissionDesc}>
            Autorisez la géolocalisation pour afficher les adresses du Petit Tou à Toulouse les plus proches de vous en direct !
          </Text>

          {loading ? (
            <ActivityIndicator size="small" color="#C52824" style={{ marginTop: 20 }} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.permissionBtn,
                pressed && styles.permissionBtnPressed,
              ]}
              onPress={requestPermission}
            >
              <Text style={styles.permissionBtnText}>Géolocalisez-moi 🧭</Text>
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
          srcDoc={getWebMapHtml()}
          style={styles.webMap}
          title="Petit Tou Web Map"
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
                >
                  <View
                    style={[
                      styles.nativeMarker,
                      { backgroundColor: getMarkerColor(s.cat || s.category) },
                      isSelected && styles.nativeMarkerSelected,
                    ]}
                  >
                    {renderCategoryIcon(s.cat || s.category)}
                  </View>
                </NativeMarker>
              );
            })}
          </NativeMapView>
        )
      )}

      {/* Floating Header Label as a Pressable Button */}
      <Pressable
        style={({ pressed }) => [
          styles.floatingHeader,
          pressed && styles.floatingHeaderPressed,
        ]}
        onPress={handleResetToToulouse}
      >
        <Text style={styles.headerTitle}>Carte du Petit Tou</Text>
        <Text style={styles.headerSubtitle}>Toulouse à portée de main (Vue globale) 🔍</Text>
      </Pressable>

      {/* Animated Bottom Spot Details Card */}
      {selectedSpot && (
        <Animated.View
          style={[
            styles.animatedCardContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <Pressable
            style={[
              styles.detailsCard,
              {
                borderColor: getMarkerColor(selectedSpot.cat || selectedSpot.category),
                shadowColor: getMarkerColor(selectedSpot.cat || selectedSpot.category),
              }
            ]}
            onPress={() => setShowFullAddressModal(true)}
          >
            <View style={styles.cardLeft}>
              {/* Row of Category & Visit tags */}
              <View style={styles.tagsContainer}>
                {/* Category Tag */}
                <View
                  style={[
                    styles.catTag,
                    {
                      backgroundColor: getMarkerColor(selectedSpot.cat || selectedSpot.category),
                      borderColor: '#1E293B',
                      borderWidth: 1.5,
                    }
                  ]}
                >
                  {renderCategoryIcon(selectedSpot.cat || selectedSpot.category)}
                  <Text style={[styles.catTagText, { color: '#FFFFFF', marginLeft: 4 }]}>
                    {getCategoryLabel(selectedSpot.cat || selectedSpot.category)}
                  </Text>
                </View>

                {/* Visit Tag */}
                {visitedSpotIds.includes(selectedSpot.id) && (
                  <View style={styles.visitTag}>
                    <Text style={styles.visitTagText}>Visité 📍</Text>
                  </View>
                )}
              </View>

              <Text style={styles.detailsTitle}>{selectedSpot.name}</Text>
              <Text style={styles.detailsDesc}>{selectedSpot.description || selectedSpot.desc}</Text>
            </View>

            {/* Action Buttons Column */}
            <View style={styles.cardActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.likeBtn,
                  likedSpotIds.includes(selectedSpot.id) ? styles.likeBtnActive : styles.likeBtnInactive,
                  pressed && styles.likeBtnPressed,
                ]}
                onPress={() => handleToggleLike(selectedSpot.id)}
              >
                <Heart
                  size={18}
                  color={likedSpotIds.includes(selectedSpot.id) ? '#FFFFFF' : '#1E293B'}
                  fill={likedSpotIds.includes(selectedSpot.id) ? '#FFFFFF' : 'none'}
                />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.itineraryBtn,
                  {
                    backgroundColor: getMarkerColor(selectedSpot.cat || selectedSpot.category),
                  },
                  pressed && styles.itineraryBtnPressed,
                ]}
                onPress={() => handleOpenItinerary(selectedSpot)}
              >
                <ArrowUpRight size={20} color="#FFFFFF" strokeWidth={2.8} />
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Login Requirement Modal on Map */}
      {showLoginModal && (
        <View style={styles.modalBackdrop}>
          <View style={styles.loginCardModal}>
            <View style={styles.loginModalHeader}>
              <Text style={styles.loginModalHeaderTitle}>CONNEXION REQUISE</Text>
            </View>
            <View style={styles.loginModalBody}>
              <Heart size={36} color="#C52824" style={{ marginBottom: 12 }} />
              <Text style={styles.loginModalTitle}>Ajouter aux favoris</Text>
              <Text style={styles.loginModalSub}>
                Connectez-vous pour sauvegarder vos adresses préférées et y accéder depuis votre profil à tout moment.
              </Text>
              <View style={styles.loginModalBtnRow}>
                <Pressable
                  style={styles.loginModalBtnCancel}
                  onPress={() => setShowLoginModal(false)}
                >
                  <Text style={styles.loginModalBtnCancelText}>Annuler</Text>
                </Pressable>
                <Pressable
                  style={styles.loginModalBtnConfirm}
                  onPress={() => {
                    setShowLoginModal(false);
                    if (onChangeTab) onChangeTab('profile');
                  }}
                >
                  <Text style={styles.loginModalBtnConfirmText}>Se connecter 👤</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Address Detail Modal from Map */}
      {showFullAddressModal && selectedSpot && (
        <AddressDetailModal
          spot={{
            id: selectedSpot.id,
            title: selectedSpot.name || selectedSpot.title,
            description: selectedSpot.description || selectedSpot.desc,
            category: getCategoryLabel(selectedSpot.cat || selectedSpot.category),
            location: selectedSpot.location || 'Toulouse',
            address: selectedSpot.address || `${selectedSpot.name}, Toulouse`,
            rating: selectedSpot.rating || 4.8,
            price_level: selectedSpot.price_max ? `Jusqu'à ${selectedSpot.price_max}€` : '€€',
            image_url: selectedSpot.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
          }}
          onClose={() => setShowFullAddressModal(false)}
          onGoToMap={() => {
            setShowFullAddressModal(false);
          }}
        />
      )}

      {/* Floating Action Buttons Column (GPS + Filter) */}
      <View style={styles.actionsColumn}>
        {/* Sliders Filter Button */}
        <Pressable
          style={({ pressed }) => [
            styles.floatingBtn,
            pressed && styles.floatingBtnPressed,
            filterSheetVisible && styles.filterBtnActive,
          ]}
          onPress={handleOpenFilters}
        >
          <SlidersHorizontal size={22} color={filterSheetVisible ? '#FFFFFF' : '#1E293B'} strokeWidth={2.5} />
        </Pressable>

        {/* Center on Me Button */}
        <Pressable
          style={({ pressed }) => [
            styles.floatingBtn,
            pressed && styles.floatingBtnPressed,
          ]}
          onPress={handleCenterOnMe}
        >
          <Navigation size={22} color="#1E293B" strokeWidth={2.5} />
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
              <X size={20} color="#1E293B" />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.drawerScrollContent} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
            {/* Search Input Bar */}
            <View style={styles.searchBarRow}>
              <View style={styles.searchBarContainer}>
                <Search size={18} color="#64748B" style={styles.searchIcon} />
                <TextInput
                  placeholder="Brunch"
                  placeholderTextColor="#64748B"
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

            {/* Budget Step Slider Section */}
            <Text style={styles.filterLabel}>Budget</Text>
            <View style={styles.sliderContainer}>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderTrackActive, { width: `${((budget - 10) / 40) * 100}%` }]} />
                <View style={[styles.sliderHandle, { left: `${((budget - 10) / 40) * 100}%` }]} />
              </View>
              <View style={styles.sliderLabels}>
                {[10, 20, 30, 40, 50].map((val) => (
                  <Pressable key={val} onPress={() => setBudget(val)} style={styles.sliderLabelBtn}>
                    <Text style={[styles.sliderLabelText, budget === val && styles.sliderLabelTextActive]}>
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
                { label: '🍴 Restauration', value: 'food' },
                { label: '🍹 Bars & Cafés', value: 'drinks' },
                { label: '🛍️ Shopping & Mode', value: 'shopping' },
                { label: '💅 Beauté & Bien-être', value: 'beauty' },
                { label: '🎭 Loisirs & Culture', value: 'culture' },
                { label: '🏆 Sport & Activités', value: 'sport' },
              ].map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setCategory(category === c.value ? null : c.value)}
                  style={[styles.chip, category === c.value && styles.chipActive]}
                >
                  <Text style={[styles.chipText, category === c.value && styles.chipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Ambiance Chips */}
            <Text style={styles.filterLabel}>Ambiance</Text>
            <View style={styles.chipsRow}>
              {[
                { label: 'Cosy', value: 'cosy' },
                { label: 'Rooftop', value: 'rooftop' },
                { label: 'Tendance', value: 'trendy' },
                { label: 'Calme', value: 'calm' },
              ].map((a) => (
                <Pressable
                  key={a.value}
                  onPress={() => setAmbiance(ambiance === a.value ? null : a.value)}
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
    backgroundColor: '#FAF5EF',
  },
  webMap: {
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
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  permissionCard: {
    width: '100%',
    maxWidth: 320,
    padding: 24,
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    alignItems: 'center',
  },
  permissionIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '500',
  },
  permissionBtn: {
    width: '100%',
    height: 48,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#C52824',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBtnPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  permissionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  skipBtn: {
    marginTop: 18,
  },
  skipBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 35,
    left: 20,
    right: 20,
    backgroundColor: '#FAF5EF',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E293B',
    padding: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    zIndex: 89,
  },
  floatingHeaderPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 2, height: 2 },
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
    marginTop: 2,
  },
  
  // Floating Actions Column
  actionsColumn: {
    position: 'absolute',
    bottom: 130, // Positioned beautifully above bottom dock
    right: 20,
    gap: 12,
    zIndex: 90,
  },
  floatingBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  floatingBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  filterBtnActive: {
    backgroundColor: '#C52824',
  },
  gpsBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  nativeMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  nativeMarkerSelected: {
    transform: [{ scale: 1.35 }, { translateY: -4 }],
    shadowOffset: { width: 4, height: 4 },
    borderWidth: 3,
  },
  markerRed: {
    backgroundColor: '#C52824',
  },
  markerGold: {
    backgroundColor: '#E5A93B',
  },
  markerText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
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
    backgroundColor: '#FAF5EF',
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    padding: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    position: 'relative',
  },
  cardAccentRed: {
    borderTopWidth: 6,
    borderTopColor: '#C52824',
  },
  cardAccentGold: {
    borderTopWidth: 6,
    borderTopColor: '#E5A93B',
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
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  tagRed: {
    backgroundColor: '#C52824',
  },
  tagGold: {
    backgroundColor: '#E5A93B',
  },
  catTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  visitTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  visitTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065F46',
    textTransform: 'uppercase',
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  detailsDesc: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 14,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  likeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  likeBtnInactive: {
    backgroundColor: '#FAF5EF',
  },
  likeBtnActive: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
  },
  likeBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  itineraryBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  itineraryBtnRed: {
    backgroundColor: '#C52824',
  },
  itineraryBtnGold: {
    backgroundColor: '#E5A93B',
  },
  itineraryBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },

  // --- Filter Drawer (Slide-up Sheet) Styling ---
  filterDrawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FAF5EF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 3,
    borderColor: '#1E293B',
    zIndex: 100,
    height: '92%',
    shadowColor: '#1E293B',
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
    borderBottomColor: '#E2E8F0',
  },
  drawerIndicator: {
    width: 48,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#CBD5E1',
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
    paddingBottom: 60,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchBarInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#C52824',
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
    backgroundColor: 'rgba(197, 40, 36, 0.08)',
  },
  subTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  subTabTextActive: {
    color: '#C52824',
  },
  divider: {
    height: 2,
    backgroundColor: '#E2E8F0',
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
    fontWeight: '900',
    color: '#1E293B',
  },
  resetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
    marginTop: 10,
  },
  
  // Step Slider Styles
  sliderContainer: {
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    position: 'relative',
    marginVertical: 14,
  },
  sliderTrackActive: {
    height: '100%',
    backgroundColor: '#C52824',
    borderRadius: 3,
  },
  sliderHandle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#C52824',
    borderWidth: 2,
    borderColor: '#FAF5EF',
    position: 'absolute',
    top: -5,
    marginLeft: -8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 1, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabelBtn: {
    alignItems: 'center',
  },
  sliderLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  sliderLabelTextActive: {
    color: '#C52824',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  chipActive: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
    shadowOffset: { width: 0, height: 0 },
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  chipTextActive: {
    color: '#FFFFFF',
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
    fontWeight: '800',
    color: '#1E293B',
  },
  customSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    padding: 3,
    justifyContent: 'center',
  },
  switchActive: {
    backgroundColor: '#1E293B',
  },
  switchInactive: {
    backgroundColor: '#E2E8F0',
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
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
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B', // Golden background color
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitFilterBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  submitFilterBtnText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999,
  },
  loginCardModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FAF5EF',
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  loginModalHeader: {
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    alignItems: 'center',
  },
  loginModalHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  loginModalBody: {
    padding: 24,
    alignItems: 'center',
  },
  loginModalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
  },
  loginModalSub: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  loginModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  loginModalBtnCancel: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginModalBtnCancelText: {
    color: '#1E293B',
    fontWeight: '700',
    fontSize: 14,
  },
  loginModalBtnConfirm: {
    flex: 1.2,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#C52824',
    borderWidth: 2,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  loginModalBtnConfirmText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
