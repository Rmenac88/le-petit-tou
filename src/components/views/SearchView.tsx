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

const QUICK_TAGS = [
  { id: '1', name: 'Restaurants', cat: 'food', icon: Utensils },
  { id: '2', name: 'Bars & Cafés', cat: 'drinks', icon: Coffee },
  { id: '3', name: 'Shopping', cat: 'shopping', icon: ShoppingBag },
  { id: '4', name: 'Activités & Sport', cat: 'sport', icon: Dumbbell },
  { id: '5', name: 'Gratuit / Bons plans', cat: 'free', icon: Tag },
];

const POPULAR_SEARCHES = [
  "Brunch en terrasse Place des Carmes",
  "Bar à cocktails avec rooftop",
  "Crêperie artisanale Garonne",
  "Boutique créateur écoresponsable",
  "Tapas toulousains ambiance chaleureuse",
];

const MOCK_SEARCH_SPOTS = [
  {
    id: '1',
    title: "Pont Neuf Crêperie",
    category: "Restauration",
    cat: "food",
    location: "Capitole, Toulouse",
    address: "Pont Neuf, 31000 Toulouse",
    rating: 4.8,
    price_level: "€10-20",
    description: "Crêpes artisanales au bord de la Garonne avec produits locaux bio.",
    image_url: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=500&auto=format&fit=crop"
  },
  {
    id: '2',
    title: "Place du Capitole Café",
    category: "Bars & Cafés",
    cat: "drinks",
    location: "Capitole, Toulouse",
    address: "Place du Capitole, 31000 Toulouse",
    rating: 4.6,
    price_level: "€5-15",
    description: "Le café mythique historique au cœur de Toulouse.",
    image_url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=500&auto=format&fit=crop"
  },
  {
    id: '3',
    title: "Carmes Tapas Bar",
    category: "Restauration",
    cat: "food",
    location: "Carmes, Toulouse",
    address: "Rue des Filatiers, 31000 Toulouse",
    rating: 4.9,
    price_level: "€20-45",
    description: "Meilleurs tapas toulousains ambiance chaleureuse et vins bio.",
    image_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=500&auto=format&fit=crop"
  },
  {
    id: '4',
    title: "Saint-Cyprien Concept Store",
    category: "Shopping",
    cat: "shopping",
    location: "Saint-Cyprien, Toulouse",
    address: "Place Saint-Cyprien, 31300 Toulouse",
    rating: 4.7,
    price_level: "€15-50",
    description: "Boutique créateur écoresponsable et friperie vintage.",
    image_url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop"
  }
];

export default function SearchView({
  onSelectSpot,
}: {
  onSelectSpot?: (spotId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedSpotDetail, setSelectedSpotDetail] = useState<SpotDetail | null>(null);

  // Dynamic search filtering
  const filteredSpots = MOCK_SEARCH_SPOTS.filter(s => {
    if (selectedTag && selectedTag !== 'free') {
      if (s.cat !== selectedTag) return false;
    }
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      s.location.toLowerCase().includes(q)
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
              const isSelected = selectedTag === tag.cat;
              return (
                <Pressable
                  key={tag.id}
                  style={[styles.tagPill, isSelected && styles.tagPillSelected]}
                  onPress={() => setSelectedTag(isSelected ? null : tag.cat)}
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
                  onPress={() => setSelectedSpotDetail(spot)}
                >
                  <Image source={{ uri: spot.image_url }} style={styles.resultImage} />
                  <View style={styles.resultInfo}>
                    <View style={styles.resultBadgeRow}>
                      <Text style={styles.resultCategory}>{spot.category}</Text>
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
