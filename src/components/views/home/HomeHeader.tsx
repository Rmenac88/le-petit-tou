import React, { useRef } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Animated from 'react-native-reanimated';
import { Search } from 'lucide-react-native';
import styles from './homeStyles';

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
  labelStyle,
}) => {
  const searchInputRef = useRef<TextInput>(null);

  return (
    <>
      {/* Header Row — Centered Typographic Brand Header */}
      <View style={styles.header}>
        <Pressable onPress={onTitlePress} hitSlop={14} accessibilityLabel="Le Petit Tou">
          <Text style={styles.brandTitle}>
            <Text style={styles.brandTitleRed}>LE PETIT </Text>
            <Text style={styles.brandTitleDark}>TOU</Text>
          </Text>
        </Pressable>
      </View>

      {/* Clean Modern Search Bar */}
      <View style={styles.brutalistWrapper}>
        <View style={styles.brutalistContainer}>
          {/* Input container */}
          <Pressable 
            style={styles.brutalistInputContainer}
            onPress={() => searchInputRef.current?.focus()}
          >
            <Search color="#888888" size={18} strokeWidth={2.5} style={styles.brutalistSearchIcon} />
            <TextInput
              ref={searchInputRef}
              placeholder="Rechercher une adresse, un lieu..."
              placeholderTextColor="#888888"
              value={searchQuery}
              onChangeText={onSearchChange}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              style={styles.brutalistInput}
            />
          </Pressable>

          {/* Absolute Rotated Brutalist Label (Clickable 7-tap admin portal easter egg) */}
          <Pressable onPress={onTitlePress} hitSlop={10} style={{ zIndex: 10 }}>
            <Animated.View style={[styles.brutalistLabel, labelStyle]}>
              <Text style={styles.brutalistLabelText}>LE PETIT TOU</Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>
    </>
  );
};

export default HomeHeader;
