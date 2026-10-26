import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Brand } from '../../constants/brand';
import { OFFER_CATEGORIES, parseDiscount, readableTextOn, validityLabel, type Offer } from '../../lib/offersLogic';
import { OFFER_CATEGORY_ICONS } from './offerCategoryIcons';

interface Props {
  offer: Offer;
  nowMs: number;
  onPress: () => void;
}

const STUB_WIDTH = 112;
const NOTCH = 18;

/**
 * Carte d'offre en forme de ticket : l'avantage en grand sur la partie colorée (couleurs choisies par l'association),
 * le détail à droite, séparés par une perforation.
 */
export default function OfferCard({ offer, nowMs, onPress }: Props) {
  const d = parseDiscount(offer.discount_value);
  const ink = readableTextOn(offer.card_color_primary);
  const Icon = OFFER_CATEGORY_ICONS[offer.category];
  const categoryLabel = OFFER_CATEGORIES.find((c) => c.id === offer.category)?.label ?? '';
  const validity = validityLabel(offer.valid_until, nowMs);
  const exhausted = offer.remaining_uses <= 0;
  const dots = offer.max_uses <= 6 ? Array.from({ length: offer.max_uses }, (_, i) => i < offer.remaining_uses) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, exhausted && styles.cardExhausted, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${offer.title}, ${offer.discount_value}${exhausted ? ', offre épuisée' : ''}`}
    >
      <LinearGradient colors={[offer.card_color_primary, offer.card_color_secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.stub}>
        <Icon size={16} color={ink} strokeWidth={2.2} style={{ opacity: 0.85 }} />
        <Text
          style={[styles.big, { color: ink }, !d.numeric && styles.bigText]}
          numberOfLines={d.numeric ? 1 : 3}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {d.big}
        </Text>
        {d.small ? (
          <Text style={[styles.small, { color: ink }]} numberOfLines={2}>
            {d.small}
          </Text>
        ) : null}
      </LinearGradient>

      {/* perforation */}
      <View style={styles.perforation} pointerEvents="none">
        <View style={[styles.notch, styles.notchTop]} />
        <View style={styles.dashes} />
        <View style={[styles.notch, styles.notchBottom]} />
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={styles.category} numberOfLines={1}>{categoryLabel}</Text>
          {validity ? (
            <View style={[styles.pill, validity === 'Dernier jour' || validity.startsWith('Encore') ? styles.pillUrgent : null]}>
              <Text style={[styles.pillText, validity === 'Dernier jour' || validity.startsWith('Encore') ? styles.pillTextUrgent : null]} numberOfLines={1}>
                {validity}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.title} numberOfLines={2}>{offer.title}</Text>
        {offer.subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{offer.subtitle}</Text> : null}

        <View style={styles.usesRow}>
          {exhausted ? (
            <Text style={styles.exhausted}>Offre épuisée</Text>
          ) : (
            <>
              {dots && (
                <View style={styles.dots}>
                  {dots.map((on, i) => (
                    <View key={i} style={[styles.dot, on && { backgroundColor: offer.card_color_primary }]} />
                  ))}
                </View>
              )}
              <Text style={styles.uses} numberOfLines={1}>
                Encore {offer.remaining_uses} fois
              </Text>
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    minHeight: 132,
    backgroundColor: Brand.white,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 3,
  },
  cardExhausted: { opacity: 0.6 },
  pressed: { transform: [{ scale: 0.985 }] },
  stub: { width: STUB_WIDTH, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  big: { fontSize: 32, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  bigText: { fontSize: 17, lineHeight: 21, letterSpacing: -0.2, fontWeight: '800' },
  small: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', textAlign: 'center', opacity: 0.9 },
  perforation: { position: 'absolute', left: STUB_WIDTH - NOTCH / 2, top: 0, bottom: 0, width: NOTCH, alignItems: 'center' },
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2, backgroundColor: Brand.bg },
  notchTop: { top: -NOTCH / 2 },
  notchBottom: { bottom: -NOTCH / 2 },
  dashes: { position: 'absolute', top: NOTCH, bottom: NOTCH, width: 0, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)' },
  body: { flex: 1, minWidth: 0, paddingVertical: 14, paddingLeft: 20, paddingRight: 14, gap: 4, justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  category: { flexShrink: 1, fontSize: 11, fontWeight: '800', color: Brand.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  pill: { backgroundColor: Brand.bg, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  pillUrgent: { backgroundColor: Brand.primarySofter },
  pillText: { fontSize: 11, fontWeight: '800', color: Brand.inkSoft },
  pillTextUrgent: { color: Brand.primaryInk },
  title: { fontSize: 16, lineHeight: 20, fontWeight: '800', color: Brand.ink, marginTop: 2 },
  subtitle: { fontSize: 12.5, fontWeight: '600', color: Brand.inkSoft },
  usesRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Brand.line },
  uses: { flex: 1, fontSize: 12, fontWeight: '700', color: Brand.inkSoft },
  exhausted: { fontSize: 12, fontWeight: '800', color: Brand.primaryInk },
});
