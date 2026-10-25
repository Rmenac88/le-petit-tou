import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2, Clock, MapPin, X } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import { OFFER_CATEGORIES, parseDiscount, readableTextOn, validityLabel, type Offer } from '../../lib/offersLogic';
import { discountCardsStore } from '../../lib/discountCardsStore';
import { OFFER_CATEGORY_ICONS } from './offerCategoryIcons';

interface Props {
  offer: Offer | null;
  nowMs: number;
  /** Adresse concernée connue du guide : affiche « Voir l'adresse ». */
  canOpenSpot: boolean;
  onOpenSpot: (spotId: string) => void;
  onClose: () => void;
}

type Step = 'idle' | 'confirm' | 'busy' | 'done';

/** Fiche d'une offre : détail, conditions, utilisations restantes, et utilisation en deux temps (confirmation). */
export default function OfferDetailSheet({ offer, nowMs, canOpenSpot, onOpenSpot, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState('');
  const [validatedAt, setValidatedAt] = useState('');
  // la carte du store est mise à jour en place : on relit les utilisations restantes à chaque changement
  const [remainingRaw, setRemaining] = useState(offer?.remaining_uses ?? 0);
  const remaining = Math.min(remainingRaw, offer?.max_uses ?? remainingRaw);

  useEffect(() => {
    setStep('idle');
    setError('');
    setRemaining(offer?.remaining_uses ?? 0);
  }, [offer?.id]);
  useEffect(() => {
    if (!offer) return;
    return discountCardsStore.subscribe((cards) => {
      const fresh = cards.find((c) => c.id === offer.id);
      if (fresh) setRemaining(fresh.remaining_uses);
    });
  }, [offer?.id]);

  if (!offer) return null;
  const d = parseDiscount(offer.discount_value);
  const ink = readableTextOn(offer.card_color_primary);
  const Icon = OFFER_CATEGORY_ICONS[offer.category];
  const categoryLabel = OFFER_CATEGORIES.find((c) => c.id === offer.category)?.label ?? '';
  const validity = validityLabel(offer.valid_until, nowMs);
  const exhausted = remaining <= 0 && step !== 'done';

  const confirmUse = async () => {
    setStep('busy');
    setError('');
    const res = await discountCardsStore.useCard(offer.id);
    if (res.success) {
      const now = new Date();
      setValidatedAt(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setStep('done');
    } else {
      setError(res.error ?? 'Impossible de valider cette offre pour le moment.');
      setStep('idle');
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <ScrollView style={styles.scroller} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            <LinearGradient colors={[offer.card_color_primary, offer.card_color_secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              {offer.visual_url ? <Image source={{ uri: offer.visual_url }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : null}
              {offer.visual_url ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(26,26,34,0.45)' }]} /> : null}
              <View style={styles.heroTop}>
                <View style={styles.heroChip}>
                  <Icon size={14} color={ink} strokeWidth={2.2} />
                  <Text style={[styles.heroChipText, { color: ink }]}>{categoryLabel}</Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer">
                  <X size={18} color={Brand.ink} />
                </Pressable>
              </View>
              <View style={styles.heroBottom}>
                <Text style={[styles.heroBig, { color: offer.visual_url ? '#FFFFFF' : ink }]} numberOfLines={d.numeric ? 1 : 2} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {d.big}
                </Text>
                {d.small ? <Text style={[styles.heroSmall, { color: offer.visual_url ? '#FFFFFF' : ink }]}>{d.small}</Text> : null}
              </View>
            </LinearGradient>

            <View style={styles.body}>
              <View style={styles.badges}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{offer.badge_label}</Text>
                </View>
                {validity ? (
                  <View style={[styles.badge, styles.badgeSoft]}>
                    <Clock size={12} color={Brand.inkSoft} strokeWidth={2.2} />
                    <Text style={[styles.badgeText, { color: Brand.inkSoft }]}>{validity}</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.title}>{offer.title}</Text>
              {offer.subtitle ? <Text style={styles.subtitle}>{offer.subtitle}</Text> : null}
              {offer.description ? <Text style={styles.description}>{offer.description}</Text> : null}

              {offer.terms ? (
                <View style={styles.terms}>
                  <Text style={styles.termsTitle}>Conditions</Text>
                  <Text style={styles.termsText}>{offer.terms}</Text>
                </View>
              ) : null}

              <View style={styles.meter}>
                <View style={styles.meterTop}>
                  <Text style={styles.meterLabel}>Utilisations restantes</Text>
                  <Text style={styles.meterValue}>{remaining} / {offer.max_uses}</Text>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, (remaining / offer.max_uses) * 100))}%`, backgroundColor: offer.card_color_primary }]} />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            {step === 'done' ? (
              <View style={styles.done}>
                <CheckCircle2 size={28} color={Brand.successDeep} strokeWidth={2.2} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.doneTitle}>Offre validée à {validatedAt}</Text>
                  <Text style={styles.doneSub}>Il te reste {remaining} utilisation{remaining > 1 ? 's' : ''}. Montre cet écran à l'équipe.</Text>
                </View>
              </View>
            ) : step === 'confirm' || step === 'busy' ? (
              <View style={{ gap: 12 }}>
                <Text style={styles.confirmText}>
                  Montre cet écran à l'équipe de {offer.title} <Text style={{ fontWeight: '800' }}>avant de payer</Text>. Une utilisation sera décomptée.
                </Text>
                <View style={styles.actions}>
                  <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setStep('idle')} disabled={step === 'busy'} accessibilityRole="button">
                    <Text style={styles.btnGhostText}>Annuler</Text>
                  </Pressable>
                  <Pressable style={[styles.btn, styles.btnPrimary]} onPress={confirmUse} disabled={step === 'busy'} accessibilityRole="button">
                    {step === 'busy' ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnPrimaryText}>Valider l'offre</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  {canOpenSpot && offer.partner_id ? (
                    <Pressable
                      style={[styles.btn, styles.btnGhost]}
                      onPress={() => {
                        onClose();
                        onOpenSpot(offer.partner_id as string);
                      }}
                      accessibilityRole="button"
                    >
                      <MapPin size={16} color={Brand.ink} strokeWidth={2.2} />
                      <Text style={styles.btnGhostText} numberOfLines={1}>Adresse</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.btn, styles.btnPrimary, exhausted && styles.btnDisabled]}
                    onPress={() => !exhausted && setStep('confirm')}
                    disabled={exhausted}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: exhausted }}
                  >
                    <Text style={styles.btnPrimaryText}>{exhausted ? 'Offre épuisée' : 'Utiliser cette offre'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  scroller: { flexShrink: 1, minHeight: 0 },
  hero: { height: 200, padding: 16, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  heroChipText: { fontSize: 12, fontWeight: '800' },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center' },
  heroBottom: { gap: 2 },
  heroBig: { fontSize: 56, lineHeight: 60, fontWeight: '900', letterSpacing: -2 },
  heroSmall: { fontSize: 14, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { padding: 20, gap: 10 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Brand.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  badgeSoft: { backgroundColor: Brand.bg },
  badgeText: { fontSize: 11.5, fontWeight: '800', color: Brand.primaryInk, letterSpacing: 0.3 },
  title: { fontFamily: Font.display, fontSize: 26, lineHeight: 30, color: Brand.ink },
  subtitle: { fontSize: 14, fontWeight: '600', color: Brand.inkSoft, marginTop: -4 },
  description: { fontSize: 15, lineHeight: 22, color: Brand.ink, fontWeight: '500' },
  terms: { backgroundColor: Brand.bg, borderRadius: 16, padding: 14, gap: 4 },
  termsTitle: { fontSize: 12, fontWeight: '800', color: Brand.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  termsText: { fontSize: 13.5, lineHeight: 20, color: Brand.ink, fontWeight: '500' },
  meter: { gap: 8, marginTop: 4 },
  meterTop: { flexDirection: 'row', justifyContent: 'space-between' },
  meterLabel: { fontSize: 13, fontWeight: '700', color: Brand.inkSoft },
  meterValue: { fontSize: 13, fontWeight: '800', color: Brand.ink },
  track: { height: 8, borderRadius: 4, backgroundColor: Brand.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  footer: { backgroundColor: Brand.white, borderTopWidth: 1, borderTopColor: Brand.line, paddingHorizontal: 20, paddingTop: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12 },
  btnGhost: { backgroundColor: Brand.bg },
  btnGhostText: { fontSize: 15, fontWeight: '800', color: Brand.ink },
  btnPrimary: { backgroundColor: Brand.primaryDeep, flex: 1.4 },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: Brand.white },
  btnDisabled: { backgroundColor: '#8A8A96' },
  confirmText: { fontSize: 14, lineHeight: 20, color: Brand.ink, fontWeight: '500' },
  error: { fontSize: 13, lineHeight: 18, color: Brand.primaryInk, fontWeight: '700' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#E7F5EF', borderRadius: 18, padding: 14 },
  doneTitle: { fontSize: 15, fontWeight: '800', color: '#0C5B41' },
  doneSub: { fontSize: 13, lineHeight: 18, color: '#0C5B41', fontWeight: '500', marginTop: 2 },
});
