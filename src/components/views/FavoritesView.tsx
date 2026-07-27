import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { Heart, MapPin, ArrowUpRight, LogIn, Utensils, ShoppingBag, Star } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { GlassView } from 'expo-glass-effect';

const TOULOUSE_LAT = 43.6047;
const TOULOUSE_LNG = 1.4442;

// Le Petit Tou recommended mock spots in Toulouse with high-res metadata
const PT_SPOTS = [
  {
    id: '1',
    name: "Pont Neuf Crêperie",
    lat: 43.5999,
    lng: 1.4406,
    cat: 'food',
    desc: "Crêpes artisanales au bord de la Garonne.",
    rating: 4.8,
    reviews_count: 142,
    price_min: 10,
    price_max: 20,
    image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&auto=format&fit=crop"
  },
  {
    id: '2',
    name: "Place du Capitole Café",
    lat: 43.6044,
    lng: 1.4435,
    cat: 'shopping',
    desc: "Le café mythique historique de Toulouse.",
    rating: 4.6,
    reviews_count: 320,
    price_min: 5,
    price_max: 15,
    image_url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format&fit=crop"
  },
  {
    id: '3',
    name: "Carmes Tapas Bar",
    lat: 43.5965,
    lng: 1.4455,
    cat: 'food',
    desc: "Meilleurs tapas toulousains ambiance chaleureuse.",
    rating: 4.9,
    reviews_count: 98,
    price_min: 20,
    price_max: 45,
    image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&auto=format&fit=crop"
  },
  {
    id: '4',
    name: "Saint-Cyprien Concept Store",
    lat: 43.5985,
    lng: 1.4325,
    cat: 'shopping',
    desc: "Boutique créateur écoresponsable.",
    rating: 4.7,
    reviews_count: 64,
    price_min: 15,
    price_max: 50,
    image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop"
  }
];

export default function FavoritesView({
  onChangeTab,
  onFocusSpot,
}: {
  onChangeTab?: (tab: any) => void;
  onFocusSpot?: (spotId: string) => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<any[]>([]);

  const [guestFavIds, setGuestFavIds] = useState<string[]>([]);

  // Load guest favorites from localStorage / memory
  useEffect(() => {
    try {
      if (Platform.OS === 'web') {
        const stored = window.localStorage.getItem('LPT_GUEST_FAVORITES');
        if (stored) setGuestFavIds(JSON.parse(stored));
      }
    } catch (e) {}
  }, []);

  const saveGuestFavs = (ids: string[]) => {
    setGuestFavIds(ids);
    try {
      if (Platform.OS === 'web') {
        window.localStorage.setItem('LPT_GUEST_FAVORITES', JSON.stringify(ids));
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        if (session) {
          fetchFavorites(session.user.id);
        } else {
          loadGuestFavorites();
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setSession(session);
        if (session) {
          fetchFavorites(session.user.id);
        } else {
          loadGuestFavorites();
        }
      });

      return () => subscription.unsubscribe();
    } else {
      loadGuestFavorites();
    }
  }, [guestFavIds]);

  const loadGuestFavorites = () => {
    setLoading(true);
    const matched = PT_SPOTS.filter(s => guestFavIds.includes(s.id)).map(s => mapSpotDetails(s));
    setFavorites(matched);
    setLoading(false);
  };

  // Algorithm to map spots data cleanly and assign fallbacks for new database entries
  const mapSpotDetails = (s: any) => {
    const cat = s.category === 'drinks' || s.cat === 'shopping' ? 'shopping' : 'food';
    const defaultImage = cat === 'food'
      ? "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&auto=format&fit=crop"
      : "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop";

    // Deterministic rating based on name length to keep it consistent if null
    const baseRating = s.rating || (4.4 + ((s.name?.length || 5) % 6) * 0.1).toFixed(1);
    const baseReviews = s.reviews_count || (50 + ((s.name?.length || 10) * 7) % 200);

    return {
      id: s.id,
      name: s.name || "Nouvelle adresse",
      lat: s.lat || TOULOUSE_LAT,
      lng: s.lng || TOULOUSE_LNG,
      cat: cat,
      desc: s.description || s.desc || "Aucune description disponible pour le moment.",
      rating: parseFloat(baseRating),
      reviews_count: baseReviews,
      price_min: s.price_min || 10,
      price_max: s.price_max || 30,
      image_url: s.image_url || defaultImage
    };
  };

  const fetchFavorites = async (userId: string) => {
    try {
      setLoading(true);

      const { data: favs, error } = await supabase
        .from('user_favorites')
        .select('spot_id')
        .eq('user_id', userId);

      if (error) throw error;
      if (!favs || favs.length === 0) {
        setFavorites([]);
        return;
      }

      const spotIds = favs.map((f: any) => f.spot_id);

      // Try fetching from server spots table
      try {
        const { data: dbSpots, error: spotsError } = await supabase
          .from('spots')
          .select('*')
          .in('id', spotIds);

        if (!spotsError && dbSpots && dbSpots.length > 0) {
          const formatted = dbSpots.map((s: any) => mapSpotDetails(s));
          setFavorites(formatted);
          return;
        }
      } catch (e) {
        // Fallback to local filtering
      }

      // Fallback
      const matched = PT_SPOTS.filter(s => spotIds.includes(s.id)).map(s => mapSpotDetails(s));
      setFavorites(matched);

    } catch (e) {
      console.warn('Error fetching favorites:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (spotId: string) => {
    if (!session) {
      const updated = guestFavIds.filter(id => id !== spotId);
      saveGuestFavs(updated);
      setFavorites(prev => prev.filter(f => f.id !== spotId));
      return;
    }
    try {
      setFavorites(prev => prev.filter(f => f.id !== spotId));

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .match({ user_id: session.user.id, spot_id: spotId });

      if (error) throw error;
    } catch (e) {
      console.warn('Error removing favorite:', e);
      fetchFavorites(session.user.id);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#C52824" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      {/* Title Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Mes Favoris 🎯</Text>
        <Text style={styles.subtitle}>Vos adresses toulousaines préférées au même endroit</Text>
      </View>

      {/* Guest Sync Banner */}
      {!session && (
        <View style={styles.guestBanner}>
          <View style={styles.guestBannerLeft}>
            <LogIn size={20} color="#C52824" strokeWidth={2.5} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guestBannerTitle}>Mode invité (stockage local)</Text>
              <Text style={styles.guestBannerSub}>Connectez-vous pour synchroniser vos favoris sur tous vos appareils.</Text>
            </View>
          </View>
          <Pressable
            style={styles.guestBannerBtn}
            onPress={() => onChangeTab && onChangeTab('profile')}
          >
            <Text style={styles.guestBannerBtnText}>Connexion</Text>
          </Pressable>
        </View>
      )}

      {favorites.length === 0 ? (
        <View style={styles.emptyCardBox}>
          <View style={styles.iconCircle}>
            <MapPin size={38} color="#E5A93B" />
          </View>
          <Text style={styles.authTitle}>Aucun favori</Text>
          <Text style={styles.authDesc}>
            Vous n'avez pas encore d'adresses favorites enregistrées. Ouvrez la carte de Toulouse et cliquez sur le cœur pour en ajouter !
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.authBtn,
              pressed && styles.authBtnPressed,
            ]}
            onPress={() => onChangeTab && onChangeTab('map')}
          >
            <Text style={styles.authBtnText}>Explorer la carte 🧭</Text>
          </Pressable>
        </View>
      ) : (
        /* Grid of Balanced aspect-ratio Cards (Mi-Carré / Mi-Rectangle) */
        <View style={styles.grid}>
          {favorites.map((spot) => (
            <GlassView key={spot.id} glassEffectStyle="regular" tintColor="#ffffff" style={styles.spotCard}>
              {/* Top section: Image + Overlay Info */}
              <View style={styles.imageWrapper}>
                <Image source={{ uri: spot.image_url }} style={styles.spotImage} />
                
                {/* Category Overlay Tag */}
                <View style={[styles.catTag, spot.cat === 'food' ? styles.tagRed : styles.tagGold]}>
                  {spot.cat === 'food' ? (
                    <Utensils size={10} color="#FFFFFF" />
                  ) : (
                    <ShoppingBag size={10} color="#FFFFFF" />
                  )}
                </View>

                {/* Rating Overlay Tag */}
                <View style={styles.ratingTag}>
                  <Star size={9} color="#E5A93B" fill="#E5A93B" />
                  <Text style={styles.ratingText}>{spot.rating}</Text>
                </View>
              </View>

              {/* Middle Section: Meta Info */}
              <View style={styles.infoWrapper}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {spot.name}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={2}>
                  {spot.desc}
                </Text>
              </View>

              {/* Bottom Row: Price & Actions */}
              <View style={styles.actionRow}>
                {/* Price range indicator */}
                <Text style={styles.priceLabel}>
                  {spot.price_min}-{spot.price_max}€
                </Text>

                {/* Circular Action Buttons */}
                <View style={styles.btnGroup}>
                  {/* Heart off-toggle */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.circleBtn,
                      styles.heartActive,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => handleRemoveFavorite(spot.id)}
                  >
                    <Heart size={13} color="#FFFFFF" fill="#FFFFFF" />
                  </Pressable>

                  {/* Map redirect link */}
                  <Pressable
                    style={({ pressed }) => [
                      styles.circleBtn,
                      spot.cat === 'food' ? styles.mapRed : styles.mapGold,
                      pressed && styles.btnPressed,
                    ]}
                    onPress={() => onFocusSpot && onFocusSpot(spot.id)}
                  >
                    <ArrowUpRight size={14} color="#FFFFFF" strokeWidth={2.8} />
                  </Pressable>
                </View>
              </View>
            </GlassView>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'transparent',
  },
  scrollContainer: {
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 65 : 40,
    paddingBottom: 130,
  },
  header: {
    marginBottom: 20,
    paddingLeft: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  guestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#C52824',
    padding: 12,
    marginBottom: 16,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  guestBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  guestBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  guestBannerSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  guestBannerBtn: {
    backgroundColor: '#C52824',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  guestBannerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCardBox: {
    width: '100%',
    padding: 24,
    backgroundColor: '#FAF5EF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginTop: 10,
  },

  // 2-Column Grid system
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },

  // Premium aspect ratio Card (Mi-Carré / Mi-Rectangle: width 48%, height ~245)
  spotCard: {
    width: '48%',
    height: 245,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },

  // Image wrapper & overlays
  imageWrapper: {
    width: '100%',
    height: 115,
    position: 'relative',
    borderBottomWidth: 2,
    borderBottomColor: '#1E293B',
  },
  spotImage: {
    width: '100%',
    height: '100%',
  },
  catTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagRed: {
    backgroundColor: '#C52824',
  },
  tagGold: {
    backgroundColor: '#E5A93B',
  },
  ratingTag: {
    position: 'absolute',
    top: 8,
    right: 8,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1E293B',
  },

  // Meta Info Layout
  infoWrapper: {
    padding: 10,
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 3,
  },
  cardDesc: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    lineHeight: 13,
  },

  // Bottom action bar
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
  },
  btnGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  circleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.8,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  heartActive: {
    backgroundColor: '#C52824',
  },
  mapRed: {
    backgroundColor: '#C52824',
  },
  mapGold: {
    backgroundColor: '#E5A93B',
  },
  btnPressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 0.5, height: 0.5 },
  },

  // Auth Card Styling
  authCard: {
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
  iconCircle: {
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
  authTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 10,
    textAlign: 'center',
  },
  authDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    fontWeight: '600',
  },
  authBtn: {
    width: '100%',
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#C52824',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authBtnPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  authBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
