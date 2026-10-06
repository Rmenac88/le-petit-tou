import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Platform,
  SafeAreaView,
  FlatList,
  Linking,
} from 'react-native';
import { Image } from 'expo-image';
import {
  ArrowLeft,
  Heart,
  Star,
  MapPin,
  Navigation,
  Quote,
  Clock,
  Phone,
  Globe,
  Sparkles,
  MessageSquareQuote,
  CheckCircle,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { discoveryStore } from '../lib/discoveryStore';

import { formatRating } from '../lib/formatRating';
import { Brand } from '../constants/brand';
const { width, height } = Dimensions.get('window');

export interface SpotDetail {
  id: string;
  title: string;
  is_recommended?: boolean;
  is_new?: boolean;
  category?: string;
  location?: string;
  address?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  price_level?: string;
  budget_label?: string;
  estimated_budget?: number;
  price_min?: number;
  price_max?: number;
  description?: string;
  full_description?: string;
  breadcrumbs?: string[];
  tags?: string[];
  image_url?: string;
  photos?: string[];
  phone?: string;
  website?: string;
  hours?: string;
  reviews?: Array<{
    id: string;
    author: string;
    avatar?: string;
    rating: number;
    date: string;
    comment: string;
    source?: 'Google' | 'TripAdvisor' | 'Le Petit Tou';
  }>;
}

interface AddressDetailModalProps {
  spot: SpotDetail | null;
  onClose: () => void;
  onGoToMap: (spotId: string) => void;
  isFavorite?: boolean;
  likesCount?: number;
  onToggleFavorite?: (spotId: string) => void;
}

export default function AddressDetailModal({
  spot,
  onClose,
  onGoToMap,
  isFavorite: isFavoriteProp,
  likesCount = 0,
  onToggleFavorite,
}: AddressDetailModalProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [internalFavorite, setInternalFavorite] = useState(false);
  const isFavorite = isFavoriteProp !== undefined ? isFavoriteProp : internalFavorite;
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDiscovered, setIsDiscovered] = useState(() => (spot?.id ? discoveryStore.isDiscovered(spot.id) : false));
  const [isDiscovering, setIsDiscovering] = useState(false);

  useEffect(() => {
    if (!spot?.id) return;
    setIsDiscovered(discoveryStore.isDiscovered(spot.id));
    const unsubscribe = discoveryStore.subscribe(() => {
      setIsDiscovered(discoveryStore.isDiscovered(spot.id));
    });
    return () => unsubscribe();
  }, [spot?.id]);

  const handleDiscover = async () => {
    if (isDiscovered || isDiscovering || !spot?.id) return;
    setIsDiscovering(true);
    try {
      await discoveryStore.discoverSpot(spot.id, !!spot.is_recommended);
      setIsDiscovered(true);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Track view when address detail modal opens (fires once per unique spot)
  useEffect(() => {
    if (!spot?.id) return;
    (async () => {
      try {
        await supabase
          .from('address_views')
          .insert({ spot_id: spot.id, source: 'app' });
      } catch (e) {}
    })();
  }, [spot?.id]);

  if (!spot) return null;

  // Clean full review text
  const rawReviewText = spot.full_description || spot.description ||
    "La critique de cette adresse arrive bientôt.";
  
  // Clean any trailing truncation dots if present
  const cleanedReviewText = rawReviewText.replace(/[\.…\s]+$/, '').trim();
  const isLongDescription = cleanedReviewText.length > 180;
  const displayText = (!isDescriptionExpanded && isLongDescription)
    ? `${cleanedReviewText.slice(0, 180)}...`
    : cleanedReviewText;

  // Carousel photos (only actual photos of the spot, no generic fallbacks)
  const galleryPhotos = spot.photos && spot.photos.length > 0 
    ? spot.photos.filter(p => !!p)
    : (spot.image_url ? [spot.image_url] : []);


  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = Math.round(event.nativeEvent.contentOffset.x / slideSize);
    setActivePhotoIndex(index);
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          
          {/* Header Image Carousel */}
          <View style={styles.carouselContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {galleryPhotos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: getOptimizedImageUrl(photo, 800) }}
                  style={styles.carouselImage}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
              ))}
            </ScrollView>

            {/* Pagination Dots */}
            {galleryPhotos.length > 1 && (
              <View style={styles.paginationDots}>
                {galleryPhotos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      activePhotoIndex === i ? styles.dotActive : styles.dotInactive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Top Action Buttons (Back & Favorite / Likes) */}
            <View style={styles.topActionsRow}>
              <Pressable style={styles.iconCircleBtn} onPress={onClose} accessibilityLabel="Retour">
                <ArrowLeft size={22} color={Brand.ink} strokeWidth={2} />
              </Pressable>
              <Pressable
                style={[
                  styles.iconCircleBtn,
                  likesCount > 0 && styles.iconPillBtn,
                ]}
                accessibilityLabel={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                onPress={() => {
                  if (onToggleFavorite && spot.id) {
                    onToggleFavorite(spot.id);
                  } else {
                    setInternalFavorite(!internalFavorite);
                  }
                }}
              >
                <Heart
                  size={20}
                  color={isFavorite ? Brand.primary : Brand.ink}
                  fill={isFavorite ? Brand.primary : 'transparent'}
                  strokeWidth={2}
                />
                {likesCount > 0 && (
                  <Text style={[styles.likeCountTopText, isFavorite && styles.likeCountTopTextActive]}>
                    {likesCount}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Main Details Body */}
          <View style={styles.bodyContent}>
            
            {/* Category badge & Price */}
            <View style={styles.badgeRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>{spot.category || 'Adresse Toulouse'}</Text>
              </View>
              <View style={styles.budgetBadge}>
                <Text style={styles.budgetText}>{spot.budget_label || spot.price_level || '~20€'}</Text>
              </View>
            </View>

            {/* Name / Title */}
            <Text style={styles.titleText}>{spot.title}</Text>

            {/* Location & Rating */}
            <View style={styles.metaRow}>
              <View style={styles.ratingBox}>
                <Star size={16} color={Brand.chouchou} fill={Brand.chouchou} />
                <Text style={styles.ratingText}>{formatRating(spot.rating)}</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.locationSub}>{spot.location || 'Toulouse Centre'}</Text>
            </View>

            {/* Address line (masquée si on ne connaît que le nom) */}
            {!!spot.address && spot.address !== 'Toulouse' && spot.address !== 'Toulouse Centre' && (
            <View style={styles.addressLineRow}>
              <MapPin size={18} color={Brand.primaryDeep} style={{ marginRight: 6 }} />
              <Text style={styles.addressLineText}>
                {spot.address}
              </Text>
            </View>
            )}

            {/* L'avis du Petit Tou Card */}
            <View style={styles.petitTouReviewCard}>
              <View style={styles.petitTouReviewHeader}>
                <Quote size={22} color={Brand.primary} fill={Brand.primary} style={{ marginRight: 8 }} />
                <Text style={styles.petitTouReviewTitle}>La critique du Petit Tou</Text>
              </View>
              <Text style={styles.petitTouReviewText}>
                {displayText}
              </Text>

              {isLongDescription && (
                <Pressable
                  style={styles.expandToggleBtn}
                  onPress={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                >
                  <Text style={styles.expandToggleText}>
                    {isDescriptionExpanded ? 'Voir moins' : 'Voir plus'}
                  </Text>
                  {isDescriptionExpanded ? (
                    <ChevronUp size={16} color={Brand.primaryDeep} strokeWidth={2} />
                  ) : (
                    <ChevronDown size={16} color={Brand.primaryDeep} strokeWidth={2} />
                  )}
                </Pressable>
              )}
            </View>

            {/* Discovery / Gamification Check-in Banner */}
            <Pressable
              style={[
                styles.discoveryBanner,
                isDiscovered && styles.discoveryBannerDiscovered,
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.discoveryTitle}>
                  {isDiscovered ? 'Adresse déjà découverte !' : 'Découvrir cette adresse'}
                </Text>
                <Text style={styles.discoverySubtitle}>
                  {isDiscovered
                    ? 'Cette pépite est comptabilisée dans votre collection d\'adresses.'
                    : spot.is_recommended
                    ? 'Coup de cœur du Petit Tou • +25 points'
                    : 'Gagnez +10 points pour votre progression.'}
                </Text>
              </View>
              <View style={[styles.discoveryPtsBadge, isDiscovered && styles.discoveryPtsBadgeDiscovered]}>
                {isDiscovered && <Check size={14} color="#065F46" strokeWidth={2} />}
                <Text style={[styles.discoveryPtsText, isDiscovered && styles.discoveryPtsTextDiscovered]}>
                  {isDiscovered ? 'Validé' : spot.is_recommended ? '+25 pts' : '+10 pts'}
                </Text>
              </View>
            </Pressable>

            {/* Breadcrumb Category Chips */}
            {spot.breadcrumbs && spot.breadcrumbs.length > 0 && (
              <View style={styles.breadcrumbChipsRow}>
                {spot.breadcrumbs.map((crumb, idx) => (
                  <View key={idx} style={styles.crumbChip}>
                    <Text style={styles.crumbChipText}>{crumb}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Feature Tags Badges */}
            {spot.tags && spot.tags.length > 0 && (
              <View style={styles.tagsSectionBox}>
                <Text style={styles.sectionHeaderTitle}>Équipements & Services</Text>
                <View style={styles.tagsWrapRow}>
                  {spot.tags.map((tag, idx) => (
                    <View key={idx} style={styles.featureTagBadge}>
                      <Text style={styles.featureTagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Practical Info (Hours, Phone, Web) */}
            <View style={styles.practicalInfoCard}>
              <Text style={styles.sectionHeaderTitle}>Informations pratiques</Text>
              
              <View style={styles.infoRow}>
                <Clock size={18} color={Brand.inkSoft} style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  {spot.hours && spot.hours.trim() ? spot.hours : 'Horaires non communiqués'}
                </Text>
              </View>

              {spot.phone ? (
                <Pressable
                  style={styles.infoRow}
                  onPress={() => {
                    const clean = spot.phone?.replace(/[^\d\+]/g, '');
                    if (clean) Linking.openURL(`tel:${clean}`);
                  }}
                >
                  <Phone size={18} color={Brand.primaryDeep} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: Brand.primaryDeep, fontWeight: '700' }]}>
                    {spot.phone}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.infoRow}>
                  <Phone size={18} color={Brand.inkSoft} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: Brand.inkSoft }]}>
                    Téléphone non renseigné
                  </Text>
                </View>
              )}

              {spot.website ? (
                <Pressable
                  style={styles.infoRow}
                  onPress={() => {
                    let url = spot.website?.trim() || '';
                    if (!url.startsWith('http://') && !url.startsWith('https://')) {
                      url = 'https://' + url;
                    }
                    Linking.openURL(url).catch(() => {});
                  }}
                >
                  <Globe size={18} color={Brand.primaryDeep} style={styles.infoIcon} />
                  <Text
                    style={[styles.infoText, { color: Brand.primaryDeep, fontWeight: '700' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {spot.website.replace(/^https?:\/\//i, '')}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.infoRow}>
                  <Globe size={18} color={Brand.inkSoft} style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: Brand.inkSoft }]}>
                    Site web non renseigné
                  </Text>
                </View>
              )}
            </View>

            {/* Reviews / Avis */}
            <View style={styles.sectionBox}>
              <View style={styles.reviewsHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Avis & Retours</Text>
              </View>

              {spot.reviews && spot.reviews.length > 0 ? (
                spot.reviews.map((rev) => (
                  <View key={rev.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewAuthor}>{rev.author}</Text>
                      <View style={styles.reviewStars}>
                        <Star size={14} color={Brand.chouchou} fill={Brand.chouchou} />
                        <Text style={styles.reviewRatingVal}>{rev.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                    <Text style={styles.reviewDate}>{rev.date}{rev.source ? ` • via ${rev.source}` : ''}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyReviewsCard}>
                  <MessageSquareQuote size={32} color="#E3DCE0" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyReviewsTitle}>Aucun avis pour l'instant</Text>
                  <Text style={styles.emptyReviewsSub}>
                    Soyez le premier à partager votre expérience dans cet établissement lors de votre visite !
                  </Text>
                </View>
              )}
            </View>

          </View>
        </ScrollView>

        {/* Barre d'actions flottante (une main) */}
        <View style={styles.floatingBar}>
            <View style={styles.ctaRow}>
              <Pressable
                style={styles.primaryCtaBtn}
                onPress={() => {
                  const fullAddress = spot.address && spot.address !== 'Toulouse' && spot.address !== 'Toulouse Centre'
                    ? spot.address
                    : 'Toulouse';
                  const spotName = spot.title || 'Établissement';
                  const hasCoords = typeof spot.lat === 'number' && typeof spot.lng === 'number';
                  const destParam = hasCoords ? `${spot.lat},${spot.lng}` : encodeURIComponent(`${spotName}, ${fullAddress}`);

                  const scheme = Platform.select({
                    ios: `maps://?saddr=Current%20Location&daddr=${destParam}&dirflg=w`,
                    android: hasCoords
                      ? `google.navigation:q=${spot.lat},${spot.lng}&mode=w`
                      : `google.navigation:q=${encodeURIComponent(`${spotName}, ${fullAddress}`)}&mode=w`,
                    default: `https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=walking`,
                  });
                  Linking.openURL(scheme).catch(() => {
                    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destParam}&travelmode=walking`);
                  });
                }}
              >
                <Navigation size={20} color={Brand.white} strokeWidth={2} style={{ marginRight: 8 }} />
                <Text style={styles.primaryCtaText}>On y va !</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryCtaBtn}
                onPress={() => {
                  onClose();
                  onGoToMap(spot.id);
                }}
              >
                <MapPin size={20} color={Brand.ink} strokeWidth={2} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryCtaText}>Sur la carte</Text>
              </Pressable>
            </View>

        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: Brand.line,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Brand.bg,
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130,
  },
  carouselContainer: {
    width: width,
    height: 300,
    position: 'relative',
    backgroundColor: Brand.ink,
  },
  carouselImage: {
    width: width,
    height: 300,
  },
  paginationDots: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: Brand.white,
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  topActionsRow: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  iconPillBtn: {
    width: 'auto',
    minWidth: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 6,
  },
  likeCountTopText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  likeCountTopTextActive: {
    color: Brand.primaryDeep,
  },
  bodyContent: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    backgroundColor: Brand.bg,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryBadge: {
    backgroundColor: 'rgba(232, 74, 95, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 28,
    borderWidth: 0,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.primaryDeep,
    letterSpacing: 0.5,
  },
  budgetBadge: {
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 0,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
  },
  ratingCount: {
    fontSize: 13,
    color: Brand.inkSoft,
    fontWeight: '500',
  },
  dotSeparator: {
    marginHorizontal: 8,
    color: '#E3DCE0',
    fontWeight: 'bold',
  },
  locationSub: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  addressLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressLineText: {
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 0,
  },
  primaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Brand.primaryDeep,
    borderRadius: 20,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  secondaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 20,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  secondaryCtaText: {
    color: Brand.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryCtaText: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBox: {
    marginBottom: 24,
  },
  practicalInfoCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 14,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3A3A48',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: Brand.ink,
  },
  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  googleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 184, 53, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0,
  },
  googleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  reviewCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 18,
    borderWidth: 0,
    marginBottom: 12,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewAuthor: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRatingVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
  },
  reviewComment: {
    fontSize: 14,
    color: '#4A4A58',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
  },
  emptyReviewsCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyReviewsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 4,
  },
  emptyReviewsSub: {
    fontSize: 13,
    color: Brand.inkSoft,
    textAlign: 'center',
    lineHeight: 18,
  },
  breadcrumbChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  crumbChip: {
    backgroundColor: Brand.white,
    borderWidth: 0,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  crumbChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
  },
  petitTouReviewCard: {
    backgroundColor: Brand.primarySoft,
    borderWidth: 0,
    borderRadius: 28,
    padding: 20,
    marginBottom: 20,
  },
  petitTouReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  petitTouReviewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#A82840',
  },
  petitTouReviewText: {
    fontSize: 16,
    fontWeight: '500',
    color: Brand.ink,
    lineHeight: 23,
  },
  expandToggleBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(232, 74, 95, 0.08)',
    borderWidth: 0,
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.primaryDeep,
  },
  tagsSectionBox: {
    backgroundColor: Brand.white,
    borderWidth: 0,
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  tagsWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  featureTagBadge: {
    backgroundColor: Brand.bg,
    borderWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
  },
  discoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 18,
    padding: 12,
    marginBottom: 20,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
    gap: 10,
  },
  discoveryBannerDiscovered: {
    backgroundColor: '#F0FDF4',
    borderColor: '#1FA67A',
    shadowColor: '#059669',
  },
  discoveryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoveryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
    marginBottom: 2,
  },
  discoverySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
    lineHeight: 14,
  },
  discoveryPtsBadge: {
    backgroundColor: Brand.primaryDeep,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Brand.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discoveryPtsBadgeDiscovered: {
    backgroundColor: '#1FA67A',
    borderColor: '#065F46',
  },
  discoveryPtsText: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '700',
  },
  discoveryPtsTextDiscovered: {
    color: Brand.white,
  },
});
