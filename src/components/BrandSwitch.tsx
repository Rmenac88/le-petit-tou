import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet } from 'react-native';

import { Brand } from '../constants/brand';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const THUMB = 26;
const PADDING = 3;

interface Props {
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

/**
 * Interrupteur aux couleurs du Petit Tou : même aspect sur Android, iOS et web (l'interrupteur natif change d'un
 * système à l'autre), zone de toucher agrandie, animation fluide sans coût pour le fil JavaScript.
 */
export default function BrandSwitch({ value, onValueChange, disabled, accessibilityLabel }: Props) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [value, progress]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, TRACK_WIDTH - THUMB - PADDING * 2] });

  return (
    <Pressable
      onPress={() => {
        if (!disabled) onValueChange(!value);
      }}
      hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      aria-checked={value}
      style={[styles.track, disabled && styles.disabled]}
    >
      <Animated.View pointerEvents="none" style={[styles.trackOn, { opacity: progress }]} />
      <Animated.View pointerEvents="none" style={[styles.thumb, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: '#DAD3D8',
    padding: PADDING,
    justifyContent: 'center',
  },
  trackOn: {
    ...StyleSheet.absoluteFill,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: Brand.primary,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: Brand.white,
    shadowColor: '#2B1D46',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  disabled: { opacity: 0.45 },
});
