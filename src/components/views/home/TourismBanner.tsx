import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowUpRight, CalendarDays } from 'lucide-react-native';

import { Brand, Font, Gradients, Radius, Shadow, Touch, Type } from '../../../constants/brand';
import { safeWebUrl } from '../../../lib/safeLinks';

interface Props {
  /** Adresse https de l'agenda (réglée depuis le portail admin ; agenda officiel par défaut). */
  url: string;
}

/**
 * Bouton « Office de tourisme de Toulouse » de l'accueil : met en avant l'agenda de l'office, partenaire de l'association.
 * Toute la carte est cliquable ; le lien s'ouvre hors de l'appli.
 */
export default function TourismBanner({ url }: Props) {
  const open = () => {
    const safe = safeWebUrl(url);
    if (safe) Linking.openURL(safe).catch(() => {});
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="link"
      accessibilityLabel="Découvrir l'agenda de l'Office de tourisme de Toulouse. S'ouvre dans le navigateur."
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <LinearGradient colors={Gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.watermark} pointerEvents="none">
          <CalendarDays size={150} color={Brand.white} strokeWidth={1.5} />
        </View>
        <Text style={styles.kicker}>OFFICE DE TOURISME DE TOULOUSE</Text>
        <Text style={styles.title}>L'agenda de Toulouse</Text>
        <Text style={styles.subtitle}>Toutes les sorties et événements à ne pas manquer</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText}>Découvrir l'agenda</Text>
          <ArrowUpRight size={18} color={Brand.primaryDeep} strokeWidth={2} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 20, marginTop: 12, marginBottom: 4 },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  card: {
    borderRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: 'hidden',
    ...Shadow.soft,
  },
  watermark: { position: 'absolute', right: -24, bottom: -26, opacity: 0.1 },
  kicker: {
    fontSize: Type.caption,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: Brand.chouchou,
  },
  title: {
    fontFamily: Font.displayBlack,
    fontSize: Type.title2,
    color: Brand.white,
    marginTop: 6,
  },
  subtitle: {
    fontSize: Type.body,
    fontWeight: '500',
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 4,
    maxWidth: 260,
  },
  cta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: Touch.min,
    paddingHorizontal: 18,
    marginTop: 16,
    borderRadius: Radius.pill,
    backgroundColor: Brand.white,
  },
  ctaText: { fontSize: Type.body, fontWeight: '700', color: Brand.primaryDeep },
});
