import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet, Platform } from 'react-native';
import { Search } from 'lucide-react-native';
import Stars from '../../Stars';

import { Brand } from '../../../constants/brand';
export interface HomeHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
  onTitlePress: () => void;
  labelStyle?: any;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onTitlePress,
}) => {
  const searchInputRef = useRef<TextInput>(null);

  return (
    <>
      {/* Marque : logo + descripteur statutaire (accès discret au portail membres : 7 appuis) */}
      <Pressable onPress={onTitlePress} hitSlop={14} accessibilityLabel="Le Petit Tou" style={styles.brandRow}>
        <Image
          source={require('../../../../assets/images/logo-transparent.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View>
          <Text style={styles.brandKicker}>Votre city-guide gratuit</Text>
          <Text style={styles.brandCity}>Toulouse · par des étudiants</Text>
        </View>
      </Pressable>

      {/* Hero violet sidéral */}
      <View style={styles.hero}>
        <Stars />
        <Text style={styles.heroTitle}>Pour voir la ville</Text>
        <Text style={[styles.heroTitle, styles.heroTitleAccent]}>en rose.</Text>
        <Text style={styles.heroSub}>Les bonnes adresses, testées pour de vrai.</Text>

        <Pressable style={styles.search} onPress={() => searchInputRef.current?.focus()}>
          <Search color={Brand.primary} size={20} strokeWidth={2} style={{ marginRight: 10 }} />
          <TextInput
            ref={searchInputRef}
            placeholder="Un resto, un bar, une pépite…"
            placeholderTextColor={Brand.inkSoft}
            value={searchQuery}
            onChangeText={onSearchChange}
            onFocus={onSearchFocus}
            onBlur={onSearchBlur}
            style={[styles.searchInput, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
          />
        </Pressable>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  logo: { width: 46, height: 48 },
  brandKicker: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.primaryDeep,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  brandCity: {
    fontSize: 13,
    fontWeight: '600',
    color: Brand.inkSoft,
    marginTop: 2,
  },
  hero: {
    backgroundColor: Brand.night,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    overflow: 'hidden',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 26,
    elevation: 8,
  },
  heroGlow: {
    position: 'absolute',
    right: -60,
    bottom: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(238, 59, 101, 0.45)',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Brand.white,
    lineHeight: 36,
  },
  heroTitleAccent: {
    color: '#FF8FA3',
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
    marginTop: 8,
  },
  search: {
    marginTop: 20,
    height: 54,
    borderRadius: 27,
    backgroundColor: Brand.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
    height: '100%',
  },
});

export default HomeHeader;
