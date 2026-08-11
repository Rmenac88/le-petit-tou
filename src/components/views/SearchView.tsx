import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  Pressable,
  Image,
  Platform,
} from 'react-native';
import { Search, Sparkles, TrendingUp, MapPin, Star, Utensils, Coffee, ShoppingBag, Dumbbell, Tag } from 'lucide-react-native';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';

import dataset from '../../constants/dataset.json';

const QUICK_TAGS = [
  { id: '1', name: 'Restaurants 🍴', tag: 'Restaurants', icon: Utensils },
  { id: '2', name: 'Bars & Cafés ☕', tag: 'Bars & Cafés', icon: Coffee },
  { id: '3', name: 'Brunch & Douceurs 🥐', tag: 'Brunch & Douceurs', icon: Coffee },
  { id: '4', name: 'Shopping & Déco 🛍️', tag: 'Shopping & Déco', icon: ShoppingBag },
  { id: '5', name: 'Beauté 💆', tag: 'Beauté & Bien-être', icon: Sparkles },
  { id: '6', name: 'Culture & Loisirs 🎨', tag: 'Culture & Loisirs', icon: Dumbbell },
  { id: '7', name: 'Terrasse ☀️', tag: 'Terrasse ☀️', icon: Tag },
  { id: '8', name: 'Bio & Local 🌿', tag: 'Bio & Local 🌿', icon: Tag },
];

const POPULAR_SEARCHES = [
  "Brunch en terrasse Place des Carmes",
  "Bar à cocktails avec rooftop",
  "Crêperie artisanale Garonne",
  "Boutique créateur écoresponsable",
  "Tapas toulousains ambiance chaleureuse",
];

const ALL_SPOTS = dataset.addresses || [];

export default function SearchView({
  onSelectSpot,
}: {
  onSelectSpot?: (spotId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSpotDetail, setSelectedSpotDetail] = useState<SpotDetail | null>(null);

  // Dynamic search filtering across 790 spots
  const filteredSpots = ALL_SPOTS.filter(s => {
    if (selectedTag) {
      if (!s.tags || !s.tags.includes(selectedTag)) return false;
    }
    if (!query.trim()) return selectedTag ? true : false;
    const q = query.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q) ||
      (s.tags && s.tags.some(t => t.toLowerCase().includes(q)))
    );
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Title Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Recherche 🔍</Text>
          <Text style={styles.subtitle}>Trouvez les meilleures adresses de Toulouse</Text>
        </View>

        {/* Neo-Brutalist Search Bar */}
        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBarContainer}>
            <Search size={20} color="#1E293B" strokeWidth={2.5} style={{ marginRight: 10 }} />
            <TextInput
              placeholder="Ex: Brunch, Tapas, Rooftop..."
              placeholderTextColor="#94A3B8"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </Pressable>
            )}
          </View>
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
                  <IconComp size={14} color={isSelected ? '#FFFFFF' : '#1E293B'} strokeWidth={2.2} />
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
                <Sparkles size={32} color="#CBD5E1" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyResultsTitle}>Aucune adresse trouvée</Text>
                <Text style={styles.emptyResultsSub}>Essayez un autre mot-clé comme "Brunch", "Café" ou "Carmes".</Text>
              </View>
            ) : (
              filteredSpots.map(spot => (
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
                    phone: (spot as any).telephone || '',
                    website: (spot as any).site_web || '',
                  })}
                >
                  <Image source={{ uri: spot.image_url }} style={styles.resultImage} />
                  <View style={styles.resultInfo}>
                    <View style={styles.resultBadgeRow}>
                      <Text style={styles.resultCategory}>{spot.tags ? spot.tags[0] : 'Adresse'}</Text>
                      <View style={styles.ratingBadge}>
                        <Star size={12} color="#E5A93B" fill="#E5A93B" />
                        <Text style={styles.ratingText}>{spot.rating}</Text>
                      </View>
                    </View>
                    <Text style={styles.resultTitle}>{spot.title}</Text>
                    <Text style={styles.resultDesc} numberOfLines={1}>{spot.description}</Text>
                    <View style={styles.resultMetaRow}>
                      <MapPin size={12} color="#64748B" />
                      <Text style={styles.resultMetaText}>{spot.location} • {spot.price_level}</Text>
                    </View>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : (
          /* Popular Searches Section when idle */
          <View style={styles.sectionWrapper}>
            <View style={styles.popularHeader}>
              <TrendingUp size={18} color="#C52824" strokeWidth={2.5} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Recherches populaires</Text>
            </View>

            <View style={styles.popularList}>
              {POPULAR_SEARCHES.map((item, idx) => (
                <Pressable
                  key={idx}
                  style={styles.popularItem}
                  onPress={() => setQuery(item.split(' ')[0])}
                >
                  <Search size={14} color="#94A3B8" style={{ marginRight: 10 }} />
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
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
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
    fontSize: 28,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    paddingHorizontal: 16,
    height: 54,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    ...Platform.select({
      web: {
        outlineStyle: 'none',
        outlineColor: 'transparent',
        boxShadow: 'none',
      } as any
    }),
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
  },
  sectionWrapper: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  tagsScroll: {
    gap: 10,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  tagPillSelected: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
  },
  tagPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  tagPillTextSelected: {
    color: '#FFFFFF',
  },
  popularHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  popularList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    paddingVertical: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  popularItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  popularItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    padding: 12,
    marginBottom: 12,
    gap: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  resultImage: {
    width: 84,
    height: 84,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#C52824',
    textTransform: 'uppercase',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 2,
  },
  resultDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  resultMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultMetaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyResultsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
  },
  emptyResultsTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  emptyResultsSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
});
