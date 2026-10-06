import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Search, TrendingUp, MapPin, Star, Utensils, Wine, CakeSlice, ShoppingBag, Scissors, Landmark, Dumbbell, Sun, Leaf } from 'lucide-react-native';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';

import { formatRating } from '../../lib/formatRating';
import dataset from '../../constants/dataset.json';
import { supabase } from '../../lib/supabase';
import { searchIndex } from '../../lib/searchIndex';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';

import { Brand } from '../../constants/brand';
const QUICK_TAGS = [
  { id: '1', name: 'Restaurants', tag: 'Restaurants', icon: Utensils },
  { id: '2', name: 'Bars & Cocktails', tag: 'Bars', icon: Wine },
  { id: '3', name: 'Brunch & Douceurs', tag: 'Brunch', icon: CakeSlice },
  { id: '4', name: 'Shopping & Mode', tag: 'Shopping', icon: ShoppingBag },
  { id: '5', name: 'Beauté & Spa', tag: 'Beauté', icon: Scissors },
  { id: '6', name: 'Culture & Musées', tag: 'Culture', icon: Landmark },
  { id: '7', name: 'Sport & Fitness', tag: 'Sport', icon: Dumbbell },
  { id: '8', name: 'Terrasse & Rooftop', tag: 'Terrasse', icon: Sun },
  { id: '9', name: 'Bio & Terroir', tag: 'Bio', icon: Leaf },
];

const POPULAR_SEARCHES = [
  "Brunch en terrasse Place des Carmes",
  "Bar à cocktails avec rooftop",
  "Crêperie artisanale Garonne",
  "Boutique créateur écoresponsable",
  "Tapas toulousains ambiance chaleureuse",
];

export default function SearchView({
  onSelectSpot,
  onToggleDock,
}: {
  onSelectSpot?: (spotId: string) => void;
  onToggleDock?: (visible: boolean) => void;
}) {
  const [allSpots, setAllSpots] = useState<any[]>(dataset.addresses || []);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(24);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSpotDetail, setSelectedSpotDetail] = useState<SpotDetail | null>(null);

  // La fiche d'adresse a sa propre barre d'actions : le dock se cache pendant qu'elle est ouverte
  useEffect(() => {
    onToggleDock?.(!selectedSpotDetail);
  }, [selectedSpotDetail, onToggleDock]);
  const searchInputRef = useRef<TextInput>(null);

  // Sync latest addresses dynamically from Supabase & Listen to changes
  useEffect(() => {
    const fetchLatestSpots = async () => {
      try {
        const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          setAllSpots(data);
          searchIndex.updateSpots(data);
        }
      } catch (e) {
        console.warn('SearchView fetch spots warning:', e);
      }
    };

    fetchLatestSpots();

    const onAddressesChanged = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setAllSpots(e.detail);
        searchIndex.updateSpots(e.detail);
      } else {
        fetchLatestSpots();
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(query);
      setSearchLimit(24);
    }, 120);
    return () => clearTimeout(handler);
  }, [query]);

  // Sub-millisecond pre-indexed search across all venues
  const filteredSpots = React.useMemo(() => {
    if (!debouncedQuery.trim() && !selectedTag) return [];
    return searchIndex.search(debouncedQuery, selectedTag, searchLimit);
  }, [debouncedQuery, selectedTag, searchLimit, allSpots]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Title Header */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>Cherche, on te trouve la pépite.</Text>
          {query.length === 0 && (
            <Text style={styles.subtitle}>790 adresses testées par des étudiants toulousains.</Text>
          )}
        </View>

        {/* Clean Modern Search Bar */}
        <View style={styles.searchBarWrapper}>
          <Pressable 
            style={styles.searchBarContainer}
            onPress={() => searchInputRef.current?.focus()}
          >
            <Search size={20} color={Brand.inkSoft} strokeWidth={2} style={{ marginRight: 10 }} />
            <TextInput
              ref={searchInputRef}
              placeholder="Ex: Brunch, Tapas, Rooftop..."
              placeholderTextColor={Brand.inkSoft}
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={styles.clearBtn} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
                <X size={16} color={Brand.inkSoft} strokeWidth={2} />
              </Pressable>
            )}
          </Pressable>
        </View>

        {/* Quick Filter Tags Carousel */}
        <View style={styles.sectionWrapper}>
          <Text style={styles.sectionTitle}>Filtres rapides</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScroll}>
            {QUICK_TAGS.map(tag => {
              const IconComp = tag.icon;
              const isSelected = selectedTag === tag.tag;
              return (
                <Pressable
                  key={tag.id}
                  style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                  onPress={() => setSelectedTag(isSelected ? null : tag.tag)}
                >
                  <IconComp size={14} color={isSelected ? Brand.white : Brand.ink} strokeWidth={2} />
                  <Text style={[styles.tagPillText, isSelected && styles.tagPillTextSelected]}>{tag.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Results List */}
        {query.length > 0 || selectedTag ? (
          <View style={styles.sectionWrapper}>
            <Text style={styles.sectionTitle}>
              Résultats ({filteredSpots.length})
            </Text>

            {filteredSpots.length === 0 ? (
              <View style={styles.emptyResultsBox}>
                <Image
                  source={require('../../../assets/images/logo-transparent.png')}
                  style={{ width: 72, height: 74, marginBottom: 12, opacity: 0.9 }}
                  contentFit="contain"
                />
                <Text style={styles.emptyResultsTitle}>Rien de ce côté-là</Text>
                <Text style={styles.emptyResultsSub}>Essaie un autre mot-clé : « brunch », « café », « Carmes ».</Text>
              </View>
            ) : (
              <>
                {filteredSpots.slice(0, searchLimit).map(spot => (
                  <Pressable
                    key={spot.id}
                    style={styles.resultCard}
                    onPress={() => setSelectedSpotDetail({
                      ...spot,
                      description: (spot as any).full_description || spot.description,
                      full_description: (spot as any).full_description || spot.description,
                      breadcrumbs: (spot as any).breadcrumbs || [],
                      tags: spot.tags || [],
                      photos: spot.image_url ? [spot.image_url, ...((spot as any).gallery_urls || [])] : ((spot as any).gallery_urls || []),
                      phone: (spot as any).telephone || (spot as any).phone || '',
                      website: (spot as any).site_web || (spot as any).website || '',
                      hours: (spot as any).horaires || (spot as any).hours || '',
                    })}
                  >
                    <Image source={{ uri: getOptimizedImageUrl(spot.image_url, 350) }} style={styles.resultImage} contentFit="cover" transition={150} cachePolicy="memory-disk" />
                    <View style={styles.resultInfo}>
                      <View style={styles.resultBadgeRow}>
                        <Text style={styles.resultCategory}>{spot.tags ? spot.tags[0] : 'Adresse'}</Text>
                        <View style={styles.ratingBadge}>
                          <Star size={12} color={Brand.chouchou} fill={Brand.chouchou} />
                          <Text style={styles.ratingText}>{formatRating(spot.rating)}</Text>
                        </View>
                      </View>
                      <Text style={styles.resultTitle}>{spot.title}</Text>
                      <Text style={styles.resultDesc} numberOfLines={1}>{spot.description}</Text>
                      <View style={styles.resultMetaRow}>
                        <MapPin size={12} color={Brand.inkSoft} />
                        <Text style={styles.resultMetaText}>{spot.location} • {spot.price_level}</Text>
                      </View>
                    </View>
                  </Pressable>
                ))}

                {filteredSpots.length > searchLimit && (
                  <Pressable
                    style={({ pressed }) => [
                      {
                        width: '100%',
                        paddingVertical: 14,
                        backgroundColor: Brand.ink,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 10,
                        shadowColor: '#24242E',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 2,
                      },
                      pressed && { opacity: 0.85 }
                    ]}
                    onPress={() => setSearchLimit(prev => prev + 20)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '800', color: Brand.white }}>
                      Afficher plus de résultats ({Math.min(searchLimit, filteredSpots.length)} / {filteredSpots.length}) ↓
                    </Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        ) : (
          /* Popular Searches Section when idle */
          <View style={styles.sectionWrapper}>
            <View style={styles.popularHeader}>
              <TrendingUp size={18} color={Brand.primaryDeep} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Recherches populaires</Text>
            </View>

            <View style={styles.popularList}>
              {POPULAR_SEARCHES.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={styles.popularItem}
                  onPress={() => setQuery(item.split(' ')[0])}
                >
                  <Search size={14} color={Brand.inkMute} style={{ marginRight: 10 }} />
                  <Text style={styles.popularItemText}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Address Detail Modal */}
      {selectedSpotDetail && (
        <AddressDetailModal
          spot={selectedSpotDetail}
          onClose={() => setSelectedSpotDetail(null)}
          onGoToMap={(spotId) => {
            setSelectedSpotDetail(null);
            if (onSelectSpot) onSelectSpot(spotId);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.primaryDeep,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  container: {
    flex: 1,
    backgroundColor: Brand.bg,
    width: '100%',
    overflow: 'hidden',
  },
  scrollContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 65 : 40,
    paddingBottom: 130,
    width: '100%',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: Brand.inkSoft,
    fontWeight: '600',
    marginTop: 4,
  },
  searchBarWrapper: {
    marginBottom: 24,
    width: '100%',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Brand.ink,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineWidth: 0,
        outlineColor: 'transparent',
        boxShadow: 'none',
        borderWidth: 0,
      } as any
    }),
  },
  clearBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Brand.inkSoft,
  },
  sectionWrapper: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 12,
  },
  tagsScroll: {
    gap: 10,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.white,
    borderWidth: 0,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    minHeight: 44,
  },
  tagPillSelected: {
    backgroundColor: Brand.primaryDeep,
    borderWidth: 0,
  },
  tagPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
  },
  tagPillTextSelected: {
    color: Brand.white,
  },
  popularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularList: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 0,
    paddingVertical: 8,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0F2',
  },
  popularItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A3A48',
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 20,
    borderWidth: 0,
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  resultImage: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
  },
  resultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  resultBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  resultCategory: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.primaryDeep,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Brand.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 2,
  },
  resultDesc: {
    fontSize: 12,
    color: Brand.inkSoft,
    marginBottom: 6,
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultMetaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  emptyResultsBox: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyResultsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 4,
  },
  emptyResultsSub: {
    fontSize: 13,
    color: Brand.inkSoft,
    textAlign: 'center',
  },
});
