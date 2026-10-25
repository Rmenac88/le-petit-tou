import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, Image, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Stars from '../../Stars';
import SearchPill from '../../SearchPill';
import ProfileButton from '../../ProfileButton';

import { Brand } from '../../../constants/brand';
import { DEFAULT_THEME, resolveTheme, type ResolvedTheme } from '../../../lib/homeThemeLogic';

const ORIGINAL_THEME = resolveTheme(DEFAULT_THEME);

export interface HomeHeaderProps {
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
  onTitlePress: () => void;
  labelStyle?: any;
  /** Image de fond choisie dans le portail ; absente ou illisible : thème Galaxy d'origine. */
  backgroundUri?: string | null;
  /** Thème de l'année (couleurs, étoiles, phrases) ; absent : thème d'origine. */
  theme?: ResolvedTheme;
  /** Nombre d'adresses du guide (affiché dans la barre de recherche, comme sur la carte). */
  totalSpots?: number;
  /** Bouton « filtres » de la barre de recherche. */
  onOpenFilters?: () => void;
  /** Bouton « profil » en haut à droite. */
  onOpenProfile?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchFocus,
  onSearchBlur,
  onTitlePress,
  backgroundUri,
  theme = ORIGINAL_THEME,
  totalSpots,
  onOpenFilters,
  onOpenProfile,
}) => {
  const searchInputRef = useRef<TextInput>(null);
  const searchPlaceholder = totalSpots && totalSpots > 0 ? `Rechercher (${totalSpots} adresses)...` : 'Rechercher une adresse...';
  // Le fond personnalisé ne remplace Galaxy qu'une fois chargé ; en cas d'échec, Galaxy reste affiché
  const [bgLoaded, setBgLoaded] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  useEffect(() => {
    setBgLoaded(false);
    setBgFailed(false);
  }, [backgroundUri]);
  const showImage = !!backgroundUri && !bgFailed;

  return (
    <>
      {/* Marque : logo + descripteur statutaire (accès discret au portail membres : 7 appuis) ; profil à droite */}
      <View style={styles.topRow}>
        <Pressable onPress={onTitlePress} hitSlop={14} accessibilityLabel="Le Petit Tou" style={styles.brandRow}>
          <Image
            source={require('../../../../assets/images/logo-transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandText}>
            <Text style={styles.brandKicker} numberOfLines={1}>Votre city-guide gratuit</Text>
            <Text style={styles.brandCity} numberOfLines={1}>Toulouse · par des étudiants</Text>
          </View>
        </Pressable>
        {onOpenProfile && <ProfileButton onPress={onOpenProfile} style={styles.profileBtn} />}
      </View>

      {/* Hero aux couleurs du thème (violet sidéral par défaut) */}
      <View style={[styles.hero, { backgroundColor: theme.backgrounds[0] }]}>
        {theme.backgrounds.length > 1 && (
          <LinearGradient
            pointerEvents="none"
            colors={[theme.backgrounds[0], theme.backgrounds[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        {theme.showStars && !(showImage && bgLoaded) && <Stars />}
        {showImage && (
          <>
            <ExpoImage
              source={{ uri: backgroundUri as string }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={400}
              onLoad={() => setBgLoaded(true)}
              onError={() => setBgFailed(true)}
              accessible={false}
            />
            {/* Voile à la teinte du thème : garde le texte lisible quelle que soit l'image */}
            {bgLoaded && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} />}
          </>
        )}
        <Text style={[styles.heroTitle, { color: theme.titleColor }]}>{theme.line1}</Text>
        <Text style={[styles.heroTitle, { color: theme.accentColor }]}>{theme.line2}</Text>
        <Text style={[styles.heroSub, { color: theme.subtitleColor }]}>{theme.subtitle}</Text>

        <SearchPill
          style={styles.search}
          inputRef={searchInputRef}
          value={searchQuery}
          placeholder={searchPlaceholder}
          onChangeText={onSearchChange}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
          onOpenFilters={onOpenFilters}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  brandRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
  },
  brandText: { flex: 1, minWidth: 0 },
  profileBtn: { marginLeft: 8 },
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
  heroSub: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  search: {
    marginTop: 20,
  },
});

export default HomeHeader;
