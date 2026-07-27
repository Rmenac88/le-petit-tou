import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  Platform,
  SafeAreaView,
  FlatList,
  Linking,
} from 'react-native';
import * as Icons from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export interface SpotDetail {
  id: string;
  title: string;
  category?: string;
  location?: string;
  address?: string;
  rating?: number;
  price_level?: string;
  description?: string;
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
}

export default function AddressDetailModal({ spot, onClose, onGoToMap }: AddressDetailModalProps) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);

  if (!spot) return null;

  // Carousel photos (fallback images if spot only has 1 main image)
  const galleryPhotos = spot.photos && spot.photos.length > 0 
    ? spot.photos 
    : [
        spot.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop&q=80',
      ];

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
                <Image key={index} source={{ uri: photo }} style={styles.carouselImage} resizeMode="cover" />
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

            {/* Top Action Buttons (Back & Favorite) */}
            <View style={styles.topActionsRow}>
              <Pressable style={styles.iconCircleBtn} onPress={onClose}>
                <Icons.ArrowLeft size={22} color="#1E293B" strokeWidth={2.5} />
              </Pressable>
              <Pressable style={styles.iconCircleBtn} onPress={() => setIsFavorite(!isFavorite)}>
                <Icons.Heart
                  size={22}
                  color={isFavorite ? '#C52824' : '#1E293B'}
                  fill={isFavorite ? '#C52824' : 'transparent'}
                  strokeWidth={2.5}
                />
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
              {spot.price_level && (
                <Text style={styles.priceText}>{spot.price_level}</Text>
              )}
            </View>

            {/* Name / Title */}
            <Text style={styles.titleText}>{spot.title}</Text>

            {/* Location & Rating */}
            <View style={styles.metaRow}>
              <View style={styles.ratingBox}>
                <Icons.Star size={16} color="#E5A93B" fill="#E5A93B" />
                <Text style={styles.ratingText}>{spot.rating ? spot.rating.toFixed(1) : '4.8'}</Text>
                <Text style={styles.ratingCount}>(124 avis)</Text>
              </View>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.locationSub}>{spot.location || 'Toulouse Centre'}</Text>
            </View>

            {/* Address line */}
            <View style={styles.addressLineRow}>
              <Icons.MapPin size={18} color="#C52824" style={{ marginRight: 6 }} />
              <Text style={styles.addressLineText}>
                {spot.address || '46 Bd Matabiau, 31000 Toulouse'}
              </Text>
            </View>

            {/* Action Buttons Row: Redirect to Map & Native Navigation */}
            <View style={styles.ctaRow}>
              <Pressable
                style={styles.primaryCtaBtn}
                onPress={() => {
                  const targetAddress = spot.address || `${spot.title}, Toulouse`;
                  const scheme = Platform.select({
                    ios: `maps://?q=${encodeURIComponent(targetAddress)}`,
                    android: `geo:0,0?q=${encodeURIComponent(targetAddress)}`,
                    default: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetAddress)}`
                  });
                  Linking.openURL(scheme).catch(() => {
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(targetAddress)}`);
                  });
                }}
              >
                <Icons.Navigation size={20} color="#FFFFFF" strokeWidth={2.5} style={{ marginRight: 8 }} />
                <Text style={styles.primaryCtaText}>Itinéraire (Maps)</Text>
              </Pressable>

              <Pressable
                style={styles.secondaryCtaBtn}
                onPress={() => {
                  onClose();
                  onGoToMap(spot.id);
                }}
              >
                <Icons.MapPin size={20} color="#1E293B" strokeWidth={2.5} style={{ marginRight: 6 }} />
                <Text style={styles.secondaryCtaText}>Carte in-app</Text>
              </Pressable>
            </View>

            {/* Description Section */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeaderTitle}>À propos</Text>
              <Text style={styles.descriptionText}>
                {spot.description ||
                  "Une adresse incontournable sélectionnée avec soin par l'équipe du Petit Tou. Venez vivre une expérience authentique au cœur de Toulouse."}
              </Text>
            </View>

            {/* Practical Info (Hours, Phone, Web) */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionHeaderTitle}>Informations pratiques</Text>
              
              <View style={styles.infoRow}>
                <Icons.Clock size={18} color="#64748B" style={styles.infoIcon} />
                <Text style={styles.infoText}>{spot.hours || 'Mardi - Dimanche : 10:00 - 19:00'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Icons.Phone size={18} color="#64748B" style={styles.infoIcon} />
                <Text style={styles.infoText}>{spot.phone || '+33 5 61 23 45 67'}</Text>
              </View>

              <View style={styles.infoRow}>
                <Icons.Globe size={18} color="#64748B" style={styles.infoIcon} />
                <Text style={styles.infoText}>{spot.website || 'www.lepetittou.com'}</Text>
              </View>
            </View>

            {/* Reviews / Avis (Mock / Future Google/TripAdvisor sync) */}
            <View style={styles.sectionBox}>
              <View style={styles.reviewsHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>Avis & Notes</Text>
                <View style={styles.googleBadge}>
                  <Icons.Sparkles size={14} color="#E5A93B" style={{ marginRight: 4 }} />
                  <Text style={styles.googleBadgeText}>Synchro GMaps / TripAdvisor</Text>
                </View>
              </View>

              {spot.reviews && spot.reviews.length > 0 ? (
                spot.reviews.map((rev) => (
                  <View key={rev.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Text style={styles.reviewAuthor}>{rev.author}</Text>
                      <View style={styles.reviewStars}>
                        <Icons.Star size={14} color="#E5A93B" fill="#E5A93B" />
                        <Text style={styles.reviewRatingVal}>{rev.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.reviewComment}>{rev.comment}</Text>
                    <Text style={styles.reviewDate}>{rev.date} • via {rev.source || 'Google Reviews'}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.emptyReviewsCard}>
                  <Icons.MessageSquareQuote size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
                  <Text style={styles.emptyReviewsTitle}>Aucun avis pour l'instant</Text>
                  <Text style={styles.emptyReviewsSub}>
                    Les avis de Google Maps et TripAdvisor seront importés automatiquement sous peu.
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
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 2,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
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
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: '#C5282415',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#C52824',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    marginBottom: 28,
  },
  primaryCtaBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#C52824',
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
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
    borderWidth: 2.5,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
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
    marginBottom: 28,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
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
    backgroundColor: '#E5A93B15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5A93B',
  },
  googleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#1E293B',
    marginBottom: 12,
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
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
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
});
