import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  Linking,
  PanResponder,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { PLACEHOLDER_PHOTO } from '../constants/placeholder';
import { Image } from 'expo-image';
import {
  Heart,
  Star,
  MapPin,
  Navigation,
  Quote,
  Clock,
  Phone,
  Globe,
  Sparkles,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  X,
  ArrowUpRight,
  Check,
} from 'lucide-react-native';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { discoveryStore } from '../lib/discoveryStore';

import { Brand } from '../constants/brand';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COMPACT_HEIGHT = 165;
const EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.82, 700);

export interface PlaceDetailSheetSpot {
  id: string;
  title: string;
  name?: string;
  category?: string;
  cat?: string;
  location?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  price_level?: string;
  budget_label?: string;
  description?: string;
  full_description?: string;
  desc?: string;
  breadcrumbs?: string[];
  tags?: string[];
  image_url?: string;
  gallery_urls?: string[];
  photos?: string[];
  phone?: string;
  telephone?: string;
  website?: string;
  site_web?: string;
  hours?: string;
  horaires?: string;
  is_recommended?: boolean;
}

interface PlaceDetailSheetProps {
  spot: PlaceDetailSheetSpot | null;
  visible: boolean;
  onClose: () => void;
  onOpenItinerary: (spot: PlaceDetailSheetSpot) => void;
  isFavorite: boolean;
  likesCount?: number;
  onToggleFavorite: (id: string) => void;
  routeLoading?: boolean;
}

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  } catch (e) {}
};

export default function PlaceDetailSheet({
  spot,
  visible,
  onClose,
  onOpenItinerary,
  isFavorite,
  likesCount = 0,
  onToggleFavorite,
  routeLoading = false,
}: PlaceDetailSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Valeur d'animation verticale : 0 = compact, 1 = étendu
  const expandProgress = useRef(new Animated.Value(0)).current;

  // Synchronisation de la découverte
  useEffect(() => {
    if (!spot?.id) return;
    setIsDiscovered(discoveryStore.isDiscovered(spot.id));
    const unsubscribe = discoveryStore.subscribe(() => {
      setIsDiscovered(discoveryStore.isDiscovered(spot.id));
    });
    return () => unsubscribe();
  }, [spot?.id]);

  // Réinitialiser à l'état compact lors de la sélection d'un nouveau spot
  useEffect(() => {
    if (visible && spot) {
      setIsExpanded(false);
      Animated.spring(expandProgress, {
        toValue: 0,
        useNativeDriver: false,
        friction: 8,
        tension: 50,
      }).start();
    }
  }, [spot?.id, visible]);

  const toggleExpand = (targetState?: boolean) => {
    triggerHaptic();
    const nextState = typeof targetState === 'boolean' ? targetState : !isExpanded;
    setIsExpanded(nextState);
    Animated.spring(expandProgress, {
      toValue: nextState ? 1 : 0,
      useNativeDriver: false,
      friction: 8,
      tension: 45,
    }).start();
  };

  const handleDiscover = async () => {
    if (!spot?.id || isDiscovered || isDiscovering) return;
    setIsDiscovering(true);
    triggerHaptic();
    try {
      await discoveryStore.discoverSpot(spot.id, !!spot.is_recommended);
      setIsDiscovered(true);
    } finally {
      setIsDiscovering(false);
    }
  };

  // PanResponder pour le glissement tactile (swipe up / swipe down)
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy < -40) {
          toggleExpand(true); // Swipe Up -> Agrandir
        } else if (gesture.dy > 50) {
          if (isExpanded) {
            toggleExpand(false); // Swipe Down -> Réduire
          } else {
            onClose(); // Swipe Down depuis compact -> Fermer
          }
        }
      },
    })
  ).current;

  if (!visible || !spot) return null;

  const spotName = spot.title || spot.name || 'Adresse Toulouse';
  const categoryLabel = spot.category || spot.cat || 'Sélection';
  const rawReview = spot.full_description || spot.description || spot.desc || "La critique de cette adresse arrive bientôt.";
  const coverPhoto = spot.image_url || PLACEHOLDER_PHOTO;
  const allPhotos = spot.photos && spot.photos.length > 0
    ? spot.photos
    : spot.gallery_urls && spot.gallery_urls.length > 0
    ? [coverPhoto, ...spot.gallery_urls]
    : [coverPhoto];

  // Interpolation de hauteur fluide
  const currentHeight = expandProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [COMPACT_HEIGHT, EXPANDED_HEIGHT],
  });

  return (
    <Animated.View style={[styles.floatingSheet, { height: currentHeight }]}>
      {/* Barre d'accroche Apple (Drag Pill Handle) */}
      <View {...panResponder.panHandlers} style={styles.handleContainer}>
        <View style={styles.dragPill} />
        <Pressable
          style={styles.expandToggleBtn}
          onPress={() => toggleExpand()}
          hitSlop={12}
          accessibilityLabel={isExpanded ? 'Réduire la fiche' : 'Agrandir la fiche'}
        >
          {isExpanded ? (
            <ChevronDown size={20} color={Brand.inkSoft} />
          ) : (
            <ChevronUp size={20} color={Brand.inkSoft} />
          )}
        </Pressable>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          1. ZONE COMPACTE FIXE (Toujours visible en mode réduit et étendu)
      ───────────────────────────────────────────────────────────── */}
      <View style={styles.compactHeaderRow}>
        {/* Miniature Photo */}
        <Pressable onPress={() => toggleExpand(!isExpanded)}>
          <Image
            source={{ uri: getOptimizedImageUrl(coverPhoto, 200) }}
            style={styles.compactThumb}
            contentFit="cover"
            transition={150}
          />
        </Pressable>

        {/* Détails Principaux */}
        <Pressable
          style={styles.compactMeta}
          onPress={() => toggleExpand(!isExpanded)}
        >
          <View style={styles.badgeRow}>
            <View style={styles.catPill}>
              <Text style={styles.catPillText} numberOfLines={1}>{categoryLabel}</Text>
            </View>

            {spot.budget_label && (
              <View style={styles.budgetPill}>
                <Text style={styles.budgetPillText}>{spot.budget_label}</Text>
              </View>
            )}

            {isDiscovered ? (
              <View style={styles.discoveredPill}>
                <Check size={12} color="#166534" strokeWidth={2} />
                <Text style={styles.discoveredPillText}>Découvert</Text>
              </View>
            ) : (
              <View style={styles.pointsBadge}>
                <Text style={styles.pointsBadgeText}>
                  {spot.is_recommended ? '+25 pts' : '+10 pts'}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.spotNameText} numberOfLines={1}>
            {spotName}
          </Text>

          <Text style={styles.spotAddressText} numberOfLines={1}>
            {spot.address || spot.location || 'Toulouse Centre'}
          </Text>
        </Pressable>

        {/* Boutons d'Action Rapide */}
        <View style={styles.compactActionsCol}>
          {/* Bouton Like / Favori */}
          <Pressable
            style={({ pressed }) => [
              styles.compactLikeBtn,
              isFavorite && styles.compactLikeBtnActive,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            onPress={() => onToggleFavorite(spot.id)}
            accessibilityLabel="Ajouter aux favoris"
          >
            <Heart
              size={18}
              color={isFavorite ? Brand.white : Brand.ink}
              fill={isFavorite ? Brand.white : 'none'}
            />
          </Pressable>

          {/* Bouton Itinéraire Rapide */}
          <Pressable
            style={({ pressed }) => [
              styles.compactRouteBtn,
              pressed && { transform: [{ scale: 0.94 }] },
            ]}
            onPress={() => onOpenItinerary(spot)}
            accessibilityLabel="Calculer l'itinéraire"
          >
            {routeLoading ? (
              <ActivityIndicator size="small" color={Brand.white} />
            ) : (
              <ArrowUpRight size={19} color={Brand.white} strokeWidth={2} />
            )}
          </Pressable>
        </View>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          2. ZONE DÉTAILLÉE ÉTENDUE (Accessible en glissant ou tapant)
      ───────────────────────────────────────────────────────────── */}
      {isExpanded && (
        <ScrollView
          style={styles.expandedScrollArea}
          contentContainerStyle={styles.expandedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Carrousel Photos */}
          {allPhotos.length > 1 && (
            <View style={styles.photoCarouselWrapper}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const slideSize = e.nativeEvent.layoutMeasurement.width;
                  const idx = Math.round(e.nativeEvent.contentOffset.x / slideSize);
                  setActivePhotoIndex(idx);
                }}
                scrollEventThrottle={16}
              >
                {allPhotos.map((photo, i) => (
                  <Image
                    key={i}
                    source={{ uri: getOptimizedImageUrl(photo, 600) }}
                    style={styles.carouselPhoto}
                    contentFit="cover"
                  />
                ))}
              </ScrollView>
              <View style={styles.dotsIndicatorRow}>
                {allPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.carouselDot,
                      activePhotoIndex === i && styles.carouselDotActive,
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Bannière de Découverte & Points */}
          <Pressable
            style={[
              styles.discoveryBanner,
              isDiscovered && styles.discoveryBannerActive,
            ]}
            onPress={handleDiscover}
            disabled={isDiscovered || isDiscovering}
          >
            <View style={styles.discoveryIconCircle}>
              {isDiscovered ? (
                <CheckCircle size={22} color="#1FA67A" strokeWidth={2} />
              ) : (
                <Sparkles size={22} color={Brand.chouchou} strokeWidth={2} />
              )}
            </View>
            <View style={{ flex: 1, paddingHorizontal: 10 }}>
              <Text style={styles.discoveryBannerTitle}>
                {isDiscovered ? 'Adresse validée !' : 'Découvrir cette adresse'}
              </Text>
              <Text style={styles.discoveryBannerSub}>
                {isDiscovered
                  ? 'Ajoutée à votre collection Le Petit Tou'
                  : spot.is_recommended
                  ? 'Coup de cœur officiel • +25 points'
                  : 'Gagnez +10 points pour votre progression'}
              </Text>
            </View>
            <View
              style={[
                styles.pointsTag,
                isDiscovered && styles.pointsTagDone,
              ]}
            >
              <Text style={styles.pointsTagText}>
                {isDiscovered ? 'Validé' : spot.is_recommended ? '+25 pts' : '+10 pts'}
              </Text>
            </View>
          </Pressable>

          {/* Avis Écrit Officiel du Petit Tou */}
          <View style={styles.reviewCard}>
            <View style={styles.reviewCardHeader}>
              <Quote size={20} color={Brand.primary} fill={Brand.primary} style={{ marginRight: 6 }} />
              <Text style={styles.reviewCardTitle}>La critique du Petit Tou</Text>
            </View>
            <Text style={styles.reviewCardBody}>{rawReview}</Text>
          </View>

          {/* Informations Pratiques : Téléphone, Web, Horaires */}
          <View style={styles.metaInfoBox}>
            {/* Téléphone */}
            {(spot.phone || spot.telephone) && (
              <Pressable
                style={styles.metaInfoRow}
                onPress={() => Linking.openURL(`tel:${spot.phone || spot.telephone}`)}
              >
                <Phone size={17} color={Brand.primaryDeep} />
                <Text style={styles.metaInfoLink}>
                  {spot.phone || spot.telephone}
                </Text>
              </Pressable>
            )}

            {/* Site Web */}
            {(spot.website || spot.site_web) && (
              <Pressable
                style={styles.metaInfoRow}
                onPress={() => Linking.openURL(spot.website || spot.site_web || '')}
              >
                <Globe size={17} color="#2563EB" />
                <Text style={styles.metaInfoLink} numberOfLines={1}>
                  {spot.website || spot.site_web}
                </Text>
              </Pressable>
            )}

            {/* Horaires */}
            {(spot.hours || spot.horaires) && (
              <View style={styles.metaInfoRow}>
                <Clock size={17} color={Brand.ink} />
                <Text style={styles.metaInfoText}>
                  {spot.hours || spot.horaires}
                </Text>
              </View>
            )}
          </View>

          {/* Tags d'Équipement / Cuisine */}
          {spot.tags && spot.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {spot.tags.map((tag, idx) => (
                <View key={idx} style={styles.tagBadge}>
                  <Text style={styles.tagBadgeText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Boutons d'Action Inférieurs */}
          <View style={styles.bottomActionsRow}>
            <Pressable
              style={styles.primaryMapsBtn}
              onPress={() => onOpenItinerary(spot)}
            >
              <Navigation size={18} color={Brand.white} strokeWidth={2} style={{ marginRight: 8 }} />
              <Text style={styles.primaryMapsBtnText}>Itinéraire GPS</Text>
            </Pressable>

            <Pressable style={styles.closeBtn} onPress={onClose}>
              <X size={18} color={Brand.ink} />
            </Pressable>
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floatingSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Brand.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: Brand.line,
    overflow: 'hidden',
    zIndex: 900,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  handleContainer: {
    width: '100%',
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: Brand.white,
  },
  dragPill: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: '#E3DCE0',
  },
  expandToggleBtn: {
    position: 'absolute',
    right: 16,
    top: 4,
    padding: 4,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  compactThumb: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
  },
  compactMeta: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 3,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  catPill: {
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Brand.primarySoft,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#A82840',
    textTransform: 'uppercase',
  },
  budgetPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Brand.bg,
  },
  budgetPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  discoveredPill: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#DCFCE7',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discoveredPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  pointsBadge: {
    flexShrink: 0,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FFF3D6',
  },
  pointsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
  },
  spotNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.2,
  },
  spotAddressText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  compactActionsCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  compactLikeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.bg,
    borderWidth: 1.5,
    borderColor: Brand.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactLikeBtnActive: {
    backgroundColor: Brand.primaryDeep,
    borderColor: Brand.primary,
  },
  compactRouteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 3,
  },
  expandedScrollArea: {
    flex: 1,
    backgroundColor: Brand.white,
  },
  expandedScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 56,
    gap: 16,
  },
  photoCarouselWrapper: {
    position: 'relative',
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 4,
  },
  carouselPhoto: {
    width: SCREEN_WIDTH - 32,
    height: 190,
    borderRadius: 20,
  },
  dotsIndicatorRow: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  carouselDotActive: {
    backgroundColor: Brand.white,
    width: 14,
  },
  discoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 20,
    padding: 14,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  discoveryBannerActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1FA67A',
    shadowColor: '#059669',
  },
  discoveryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoveryBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 2,
  },
  discoveryBannerSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
    lineHeight: 14,
  },
  pointsTag: {
    backgroundColor: Brand.primaryDeep,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.line,
  },
  pointsTagDone: {
    backgroundColor: '#1FA67A',
    borderColor: '#065F46',
  },
  pointsTagText: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '700',
  },
  reviewCard: {
    backgroundColor: Brand.primarySoft,
    borderRadius: 28,
    padding: 18,
    borderWidth: 0,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A82840',
  },
  reviewCardBody: {
    fontSize: 13,
    lineHeight: 20,
    color: '#3A3A48',
    fontWeight: '500',
  },
  metaInfoBox: {
    backgroundColor: Brand.bg,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Brand.line,
  },
  metaInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaInfoLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563EB',
    flex: 1,
  },
  metaInfoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A4A58',
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    backgroundColor: Brand.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.line,
  },
  tagBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A58',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  primaryMapsBtn: {
    flex: 1,
    height: 48,
    borderRadius: 20,
    backgroundColor: Brand.primaryDeep,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryMapsBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.white,
  },
  closeBtn: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
