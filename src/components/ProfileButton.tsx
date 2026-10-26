import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { User } from 'lucide-react-native';

import { Brand } from '../constants/brand';

interface Props {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Bouton « profil » en haut à droite des écrans (le profil n'est plus dans la barre du bas). */
export default function ProfileButton({ onPress, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel="Mon profil"
    >
      <User size={20} color={Brand.ink} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: { transform: [{ scale: 0.94 }] },
});
