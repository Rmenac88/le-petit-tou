import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Search, SlidersHorizontal, X } from 'lucide-react-native';

import { Brand } from '../constants/brand';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  onFocus?: () => void;
  onBlur?: () => void;
  /** Appelé quand on touche la croix (en plus, le texte est vidé par l'appelant). */
  onClear?: () => void;
  /** Bouton « filtres » à droite ; absent : pas de bouton. */
  onOpenFilters?: () => void;
  filtersActive?: boolean;
  inputRef?: React.Ref<TextInput>;
  /** Positionnement (la carte la pose en surimpression ; l'accueil la place dans le flux). */
  style?: StyleProp<ViewStyle>;
}

/**
 * Barre de recherche unique de l'appli : celle de la carte, reprise telle quelle sur l'accueil
 * (pastille rose à gauche, saisie, croix, séparateur, bouton filtres).
 */
export default function SearchPill({
  value,
  onChangeText,
  placeholder,
  onFocus,
  onBlur,
  onClear,
  onOpenFilters,
  filtersActive,
  inputRef,
  style,
}: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.badge}>
        <Search size={16} color={Brand.white} strokeWidth={2} />
      </View>

      <TextInput
        ref={inputRef}
        style={[styles.input, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : null]}
        placeholder={placeholder}
        placeholderTextColor={Brand.inkSoft}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />

      {value.trim().length > 0 && (
        <Pressable
          style={styles.clearBtn}
          onPress={() => {
            onChangeText('');
            onClear?.();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Effacer la recherche"
        >
          <X size={15} color={Brand.inkSoft} strokeWidth={2} />
        </Pressable>
      )}

      {onOpenFilters && (
        <>
          <View style={styles.divider} />
          <Pressable
            style={({ pressed }) => [styles.filterBtn, pressed && styles.filterBtnPressed, filtersActive && styles.filterBtnActive]}
            onPress={onOpenFilters}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les filtres avancés"
          >
            <SlidersHorizontal size={17} color={filtersActive ? Brand.primary : Brand.ink} strokeWidth={2} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 52,
    borderRadius: 20,
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: Brand.ink,
    paddingVertical: 0,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  divider: {
    width: 1.5,
    height: 24,
    backgroundColor: '#E3DCE0',
    marginRight: 6,
  },
  filterBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnPressed: { transform: [{ scale: 0.92 }] },
  filterBtnActive: { backgroundColor: Brand.primarySoft },
});
