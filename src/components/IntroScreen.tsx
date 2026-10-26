import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import Stars from './Stars';

import { Brand } from '../constants/brand';
interface IntroScreenProps {
  onFinish: () => void;
}

export default function IntroScreen({ onFinish }: IntroScreenProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.85);
  const containerOpacity = useSharedValue(1);

  useEffect(() => {
    // « Réduire les animations » : pas de mouvement, simple apparition brève
    opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 450, easing: Easing.out(Easing.ease) });
    scale.value = withTiming(1, { duration: reduceMotion ? 0 : 600, easing: Easing.out(Easing.back(1.4)) });
    containerOpacity.value = withDelay(
      reduceMotion ? 400 : 700,
      withTiming(0, { duration: reduceMotion ? 150 : 400, easing: Easing.inOut(Easing.ease) }, (finished) => {
        if (finished) runOnJS(onFinish)();
      })
    );
  }, [onFinish, opacity, scale, containerOpacity, reduceMotion]);

  // Filet de sécurité : si l'animation native ne s'exécute pas (ou son rappel ne revient jamais),
  // l'écran d'ouverture opaque ne doit pas rester indéfiniment par-dessus l'appli.
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  useEffect(() => {
    const t = setTimeout(() => finishRef.current(), reduceMotion ? 900 : 2200);
    return () => clearTimeout(t);
  }, [reduceMotion]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));

  return (
    <Animated.View style={[styles.container, containerStyle]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Brand.night }]} />
      <Stars />
      <Animated.Image
        source={require('../../assets/images/logo-transparent.png')}
        style={[styles.logo, logoStyle]}
        resizeMode="contain"
      />
      <Animated.View style={logoStyle}>
        <Text style={styles.tagline}>Pour voir la ville en rose.</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  logo: { width: 190, height: 196, marginBottom: 14 },
  tagline: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF8FA3',
  },
});
