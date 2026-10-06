import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import {
  Sparkles,
  RotateCcw,
  CheckCircle,
  Tag,
  ShieldCheck,
  ChevronRight,
  Gift,
  Clock,
  Info,
} from 'lucide-react-native';
import { DiscountCard, discountCardsStore } from '../lib/discountCardsStore';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 380);
const CARD_HEIGHT = 224;

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(12);
      }
    }
  } catch (e) {}
};

interface Props {
  card: DiscountCard;
  onUseSuccess?: (remainingUses: number) => void;
}

export default function DiscountCardItem({ card, onUseSuccess }: Props) {
  const [isUsing, setIsUsing] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  const rotate = useSharedValue(0); // 0 (Recto) -> 180 (Verso)
  const isFlipped = useSharedValue(false);

  const handleFlip = () => {
    triggerHaptic();
    const nextVal = rotate.value === 0 ? 180 : 0;
    rotate.value = withSpring(nextVal, {
      damping: 14,
      stiffness: 90,
      mass: 0.8,
    });
    isFlipped.value = nextVal === 180;
  };

  const handleUseCard = () => {
    if (card.remaining_uses <= 0 || isUsing) return;

    triggerHaptic();

    const confirmUse = async () => {
      setIsUsing(true);
      try {
        const res = await discountCardsStore.useCard(card.id);
        if (res.success) {
          triggerHaptic();
          setSuccessToast(true);
          onUseSuccess?.(res.remaining_uses);
          setTimeout(() => {
            setSuccessToast(false);
            // Flip back after success
            rotate.value = withSpring(0, { damping: 14, stiffness: 90 });
            isFlipped.value = false;
          }, 1800);
        } else {
          const msg = res.error || 'Impossible de valider cet avantage pour le moment.';
          if (Platform.OS === 'web') {
            window.alert(msg);
          } else {
            Alert.alert('Erreur', msg);
          }
        }
      } finally {
        setIsUsing(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        `Présentez cet écran au commerçant (${card.title}) pour valider votre avantage : ${card.discount_value}.\n\nConfirmer l'utilisation immédiate ?`
      );
      if (confirmed) {
        confirmUse();
      }
    } else {
      Alert.alert(
        'Validation commerçant',
        `Présentez cet écran chez ${card.title} pour valider : ${card.discount_value}.\n\nConfirmer l'utilisation de cet avantage ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Valider', style: 'default', onPress: confirmUse },
        ]
      );
    }
  };

  const frontAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(rotate.value, [0, 180], [0, 180])}deg`;
    const opacity = interpolate(rotate.value, [88, 92], [1, 0]);
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity,
      zIndex: rotate.value < 90 ? 2 : 0,
    };
  });

  const backAnimatedStyle = useAnimatedStyle(() => {
    const rotateY = `${interpolate(rotate.value, [0, 180], [180, 360])}deg`;
    const opacity = interpolate(rotate.value, [88, 92], [0, 1]);
    return {
      transform: [{ perspective: 1000 }, { rotateY }],
      opacity,
      zIndex: rotate.value >= 90 ? 2 : 0,
    };
  });

  const isExhausted = card.remaining_uses <= 0;
  const progressRatio = Math.min(1, card.uses_count / (card.max_uses || 1));

  return (
    <View style={styles.cardContainer}>
      {/* ─── RECTO FACE (Face Avant) ─── */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.frontFace,
          { backgroundColor: card.card_color_secondary || '#1E293B' },
          frontAnimatedStyle,
        ]}
      >
        {/* Visual Cover Photo with Dark Luxury Tint */}
        {card.visual_url && (
          <Image
            source={{ uri: getOptimizedImageUrl(card.visual_url, 600, 350) }}
            style={styles.cardCoverImage}
            contentFit="cover"
            transition={300}
          />
        )}
        <View
          style={[
            styles.cardOverlay,
            {
              backgroundColor: card.card_color_primary
                ? `${card.card_color_primary}D9`
                : 'rgba(15, 23, 42, 0.82)',
            },
          ]}
        />

        {/* Card Header: Brand & Badge */}
        <View style={styles.cardHeaderRow}>
          <View style={styles.brandBadge}>
            <Sparkles size={13} color="#E5A93B" strokeWidth={2.5} style={{ marginRight: 5 }} />
            <Text style={styles.brandBadgeText}>LE PETIT TOU</Text>
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {card.badge_label || 'MEMBRE PRIVILÈGE'}
            </Text>
          </View>
        </View>

        {/* Center: Partner Name & Subtitle */}
        <View style={styles.cardCenterBody}>
          <Text style={styles.partnerTitle} numberOfLines={1}>
            {card.title}
          </Text>
          {card.subtitle && (
            <Text style={styles.partnerSubtitle} numberOfLines={1}>
              {card.subtitle}
            </Text>
          )}

          {/* Discount Value Badge */}
          <View style={styles.discountValuePill}>
            <Gift size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
            <Text style={styles.discountValueText}>{card.discount_value}</Text>
          </View>
        </View>

        {/* Footer: Usage Quota & Flip Touch Action */}
        <Pressable
          style={styles.cardFooterRow}
          onPress={handleFlip}
          accessibilityLabel="Retourner la carte pour voir les détails"
        >
          <View style={styles.usageCounterPill}>
            <Text
              style={[
                styles.usageCounterText,
                isExhausted && { color: '#EF4444' },
              ]}
            >
              {isExhausted
                ? 'Épuisée (0 dispo)'
                : `${card.remaining_uses} / ${card.max_uses} utilisations`}
            </Text>
          </View>

          <View style={styles.flipActionPill}>
            <Text style={styles.flipActionText}>Détails & Code</Text>
            <RotateCcw size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </View>
        </Pressable>
      </Animated.View>

      {/* ─── VERSO FACE (Face Arrière) ─── */}
      <Animated.View
        style={[
          styles.cardFace,
          styles.backFace,
          backAnimatedStyle,
        ]}
      >
        {/* Back Header */}
        <View style={styles.backHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.backPartnerTitle} numberOfLines={1}>
              {card.title}
            </Text>
            <Text style={styles.backDiscountValue}>{card.discount_value}</Text>
          </View>

          <Pressable
            style={styles.backFlipBtn}
            onPress={handleFlip}
            accessibilityLabel="Retourner la carte"
          >
            <RotateCcw size={14} color="#64748B" />
          </Pressable>
        </View>

        {/* Usage Progress Gauge */}
        <View style={styles.gaugeContainer}>
          <View style={styles.gaugeHeader}>
            <Text style={styles.gaugeLabel}>Quota disponible</Text>
            <Text style={styles.gaugeValue}>
              {card.remaining_uses} restante{card.remaining_uses > 1 ? 's' : ''} sur {card.max_uses}
            </Text>
          </View>
          <View style={styles.gaugeTrack}>
            <View
              style={[
                styles.gaugeFill,
                {
                  width: `${(1 - progressRatio) * 100}%`,
                  backgroundColor: isExhausted ? '#CBD5E1' : '#10B981',
                },
              ]}
            />
          </View>
        </View>

        {/* Terms & Description */}
        <View style={styles.termsBox}>
          {card.description && (
            <Text style={styles.termsText} numberOfLines={2}>
              {card.description}
            </Text>
          )}
          {card.terms && (
            <View style={styles.termsSubRow}>
              <Info size={11} color="#64748B" style={{ marginRight: 4, marginTop: 1 }} />
              <Text style={styles.termsSubText} numberOfLines={2}>
                {card.terms}
              </Text>
            </View>
          )}
        </View>

        {/* Action Button: Utiliser cet avantage */}
        <View style={styles.backActionArea}>
          {successToast ? (
            <View style={styles.successBanner}>
              <CheckCircle size={16} color="#059669" strokeWidth={2.4} style={{ marginRight: 6 }} />
              <Text style={styles.successBannerText}>Avantage validé avec succès !</Text>
            </View>
          ) : isExhausted ? (
            <View style={styles.exhaustedBtn}>
              <Text style={styles.exhaustedBtnText}>Toutes utilisations consommées</Text>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.useCardBtn,
                pressed && styles.useCardBtnPressed,
              ]}
              onPress={handleUseCard}
              disabled={isUsing}
            >
              {isUsing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <ShieldCheck size={16} color="#FFFFFF" strokeWidth={2.2} style={{ marginRight: 6 }} />
                  <Text style={styles.useCardBtnText}>Utiliser cet avantage</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginVertical: 10,
    alignSelf: 'center',
    position: 'relative',
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 22,
    padding: 18,
    justifyContent: 'space-between',
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 18,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 10px 28px -4px rgba(15, 23, 42, 0.14)',
      } as any,
    }),
  },
  frontFace: {
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  backFace: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  cardCoverImage: {
    ...StyleSheet.absoluteFill,
  },
  cardOverlay: {
    ...StyleSheet.absoluteFill,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 59, 0.35)',
  },
  brandBadgeText: {
    color: '#FAF5EF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  cardCenterBody: {
    zIndex: 2,
    marginVertical: 4,
  },
  partnerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  partnerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 8,
  },
  discountValuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#C52824',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(197, 40, 36, 0.4)',
      } as any,
    }),
  },
  discountValueText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.18)',
  },
  usageCounterPill: {
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  usageCounterText: {
    color: '#FAF5EF',
    fontSize: 11,
    fontWeight: '700',
  },
  flipActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  flipActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Back face styles
  backHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  backPartnerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  backDiscountValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#C52824',
    marginTop: 2,
  },
  backFlipBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gaugeContainer: {
    marginVertical: 4,
  },
  gaugeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  gaugeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  gaugeValue: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
  },
  gaugeTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 3,
  },
  termsBox: {
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 4,
  },
  termsText: {
    fontSize: 11,
    color: '#334155',
    lineHeight: 15,
    fontWeight: '500',
  },
  termsSubRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  termsSubText: {
    fontSize: 10,
    color: '#64748B',
    lineHeight: 14,
    flex: 1,
  },
  backActionArea: {
    marginTop: 2,
  },
  useCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#C52824',
    height: 40,
    borderRadius: 12,
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  useCardBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  useCardBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  exhaustedBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    height: 40,
    borderRadius: 12,
  },
  exhaustedBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    height: 40,
    borderRadius: 12,
  },
  successBannerText: {
    color: '#065F46',
    fontSize: 12,
    fontWeight: '800',
  },
});
