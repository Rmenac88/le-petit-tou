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
} from 'lucide-react-native';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import { discoveryStore } from '../lib/discoveryStore';

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
    "Une adresse incontournable sélectionnée avec soin par l'équipe du Petit Tou. Venez vivre une expérience authentique au cœur de Toulouse.";
  
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
              <Pressable style={styles.iconCircleBtn} onPress={onClose}>
                <ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
              </Pressable>
              <Pressable
                style={[
                  styles.iconCircleBtn,
                  likesCount > 0 && styles.iconPillBtn,
                ]}
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
                  color={isFavorite ? '#C52824' : '#1E293B'}
                  fill={isFavorite ? '#C52824' : 'transparent'}
                  strokeWidth={2.5}
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
                <Star size={16} color="#E5A93B" fill="#E5A93B" />
                <Text style={styles.ratingText}>{spot.rating ? spot.rating.toFixed(1) : '4.8'}</Text>
                <Text style={styles.ratingCount}>(124 avis)</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.locationSub}>{spot.location || 'Toulouse Centre'}</Text>
            </View>

            {/* Address line */}
            <View style={styles.addressLineRow}>
              <MapPin size={18} color="#C52824" style={{ marginRight: 6 }} />
              <Text style={styles.addressLineText}>
                {spot.address && spot.address !== 'Toulouse' && spot.address !== 'Toulouse Centre'
                  ? spot.address 
                  : `${spot.title}, Toulouse`}
              </Text>
            </View>

            {/* Action Buttons Row: Redirect to Map & Native Navigation */}
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
                <Navigation size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={styles.primaryCtaText}>Itinéraire (Maps)</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryCtaBtn}
                onPress={() => {
                  onClose();
                  onGoToMap(spot.id);
                }}
              >
                <MapPin size={20} color="#1E293B" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryCtaText}>Carte in-app</Text>
              </Pressable>
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
                  <CheckCircle size={22} color="#10B981" strokeWidth={2.5} />
                ) : (
                  <Sparkles size={22} color="#E5A93B" strokeWidth={2.5} />
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
                <Text style={[styles.discoveryPtsText, isDiscovered && styles.discoveryPtsTextDiscovered]}>
                  {isDiscovered ? '✓ Validé' : spot.is_recommended ? '+25 pts' : '+10 pts'}
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

            {/* L'avis du Petit Tou Card */}
            <View style={styles.petitTouReviewCard}>
              <View style={styles.petitTouReviewHeader}>
                <Quote size={20} color="#E5A93B" style={{ marginRight: 8 }} />
                <Text style={styles.petitTouReviewTitle}>L'avis du Petit Tou</Text>
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
                    {isDescriptionExpanded ? 'Voir moins ▲' : 'Voir plus ▼'}
                  </Text>
                </Pressable>
              )}
            </View>

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
                <Clock size={18} color="#64748B" style={styles.infoIcon} />
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
                  <Phone size={18} color="#C52824" style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: '#C52824', fontWeight: '700' }]}>
                    {spot.phone}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.infoRow}>
                  <Phone size={18} color="#64748B" style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: '#94A3B8' }]}>
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
                  <Globe size={18} color="#C52824" style={styles.infoIcon} />
                  <Text
                    style={[styles.infoText, { color: '#C52824', fontWeight: '700' }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {spot.website.replace(/^https?:\/\//i, '')}
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.infoRow}>
                  <Globe size={18} color="#64748B" style={styles.infoIcon} />
                  <Text style={[styles.infoText, { color: '#94A3B8' }]}>
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
                        <Star size={14} color="#E5A93B" fill="#E5A93B" />
                        <Text style={styles.reviewRatingVal}>{rev.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                    <Text style={styles.reviewDate}>{rev.date}{rev.source ? ` • via ${rev.source}` : ''}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyReviewsCard}>
                  <MessageSquareQuote size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyReviewsTitle}>Aucun avis pour l'instant</Text>
                  <Text style={styles.emptyReviewsSub}>
                    Soyez le premier à partager votre expérience dans cet établissement lors de votre visite !
                  </Text>
                </View>
              )}
            </View>

          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FAF5EF',
    zIndex: 9999,
  },
  modalContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 60,
  },
  carouselContainer: {
    width: width,
    height: 300,
    position: 'relative',
    backgroundColor: '#1E293B',
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
    backgroundColor: '#FFFFFF',
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
    shadowColor: '#0F172A',
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
    color: '#1E293B',
  },
  likeCountTopTextActive: {
    color: '#C52824',
  },
  bodyContent: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    backgroundColor: '#FAF5EF',
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  categoryBadge: {
    backgroundColor: 'rgba(197, 40, 36, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  budgetBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 0,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  budgetText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },
  titleText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#1E293B',
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
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  ratingCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  dotSeparator: {
    marginHorizontal: 8,
    color: '#CBD5E1',
    fontWeight: 'bold',
  },
  locationSub: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  addressLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  addressLineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  primaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#C52824',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  secondaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  secondaryCtaText: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionBox: {
    marginBottom: 24,
  },
  practicalInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 0,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  sectionHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 14,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#334155',
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
    color: '#1E293B',
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
    backgroundColor: 'rgba(229, 169, 59, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0,
  },
  googleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 0,
    marginBottom: 12,
    shadowColor: '#0F172A',
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
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  reviewStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRatingVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  reviewComment: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  emptyReviewsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 0,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  emptyReviewsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyReviewsSub: {
    fontSize: 13,
    color: '#64748B',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  crumbChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  petitTouReviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#E5A93B',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  petitTouReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  petitTouReviewTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: 0.2,
  },
  petitTouReviewText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    lineHeight: 22,
  },
  expandToggleBtn: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(197, 40, 36, 0.08)',
    borderWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C52824',
  },
  tagsSectionBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    shadowColor: '#0F172A',
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
    backgroundColor: '#FAF5EF',
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  featureTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  discoveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 20,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
    gap: 10,
  },
  discoveryBannerDiscovered: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    shadowColor: '#059669',
  },
  discoveryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  discoveryTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 2,
  },
  discoverySubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 14,
  },
  discoveryPtsBadge: {
    backgroundColor: '#C52824',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  discoveryPtsBadgeDiscovered: {
    backgroundColor: '#10B981',
    borderColor: '#065F46',
  },
  discoveryPtsText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  discoveryPtsTextDiscovered: {
    color: '#FFFFFF',
  },
});
