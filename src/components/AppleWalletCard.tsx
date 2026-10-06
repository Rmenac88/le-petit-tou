import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import Stars from './Stars';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import {
  Sparkles,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  QrCode,
  Wifi,
} from 'lucide-react-native';
import { getOrCreateDeviceId } from '../lib/deviceIdentity';
import { authService } from '../lib/authService';
import { discoveryStore } from '../lib/discoveryStore';

import { Brand } from '../constants/brand';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 40, 360);
// Format Apple Wallet / Carte bancaire ISO/IEC 7810 (ratio ~ 1.586 : 1)
const CARD_HEIGHT = Math.round(CARD_WIDTH / 1.586);

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  } catch (e) {}
};

export type CardSkin = 'sidereal' | 'titanium' | 'crimson' | 'obsidian';

interface Props {
  activeSkin: CardSkin;
  customImageUrl?: string | null;
  onFlipChange?: (isFlipped: boolean) => void;
}

export default function AppleWalletCard({
  activeSkin,
  customImageUrl,
  onFlipChange,
}: Props) {
  const [deviceId, setDeviceId] = useState<string>('PT-2026-TLS');
  const [stats, setStats] = useState(discoveryStore.getStats());

  useEffect(() => {
    authService.getEffectiveUserId().then((id) => {
      if (id) {
        // Formate un ID court et élégant de type PT • 8942 • 790
        const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        setDeviceId(`PT • ${clean.slice(0, 4)} • ${clean.slice(4, 8)}`);
      }
    });

    const unsub = discoveryStore.subscribe((s) => {
      setStats({ ...s });
    });
    return () => unsub();
  }, []);

  // Shared Value pour l'animation 3D de rotation Apple (0 -> 180 deg)
  const rotateY = useSharedValue(0);

  const handleFlip = () => {
    triggerHaptic();
    const nextValue = rotateY.value === 0 ? 180 : 0;
    rotateY.value = withSpring(nextValue, {
      damping: 15,
      stiffness: 90,
      mass: 0.9,
    });
    onFlipChange?.(nextValue === 180);
  };

  // Face avant (Recto)
  const frontAnimatedStyle = useAnimatedStyle(() => {
    const deg = `${interpolate(rotateY.value, [0, 180], [0, 180])}deg`;
    const opacity = interpolate(rotateY.value, [88, 92], [1, 0]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: deg },
      ],
      opacity,
      zIndex: rotateY.value < 90 ? 2 : 0,
    };
  });

  // Face arrière (Verso)
  const backAnimatedStyle = useAnimatedStyle(() => {
    const deg = `${interpolate(rotateY.value, [0, 180], [180, 360])}deg`;
    const opacity = interpolate(rotateY.value, [88, 92], [0, 1]);
    return {
      transform: [
        { perspective: 1200 },
        { rotateY: deg },
      ],
      opacity,
      zIndex: rotateY.value >= 90 ? 2 : 0,
    };
  });

  // Texture d'arrière-plan selon le skin
  const renderBackground = () => {
    if (customImageUrl) {
      return (
        <Image
          source={{ uri: customImageUrl }}
          style={styles.cardCover}
          contentFit="cover"
          transition={300}
        />
      );
    }

    if (activeSkin === 'sidereal') {
      return (
        <View style={[styles.cardCover, { backgroundColor: Brand.night }]}>
          <Stars />
        </View>
      );
    }

    if (activeSkin === 'titanium') {
      return (
        <Image
          source={require('../../assets/images/wallet/card_titanium.jpg')}
          style={styles.cardCover}
          contentFit="cover"
          transition={300}
        />
      );
    }

    if (activeSkin === 'crimson') {
      return (
        <Image
          source={require('../../assets/images/wallet/card_crimson.jpg')}
          style={styles.cardCover}
          contentFit="cover"
          transition={300}
        />
      );
    }

    // Obsidian skin (pure deep slate & gold glow)
    return (
      <View style={[styles.cardCover, { backgroundColor: '#0B0F19' }]}>
        <View style={styles.obsidianGlowRed} />
        <View style={styles.obsidianGlowGold} />
      </View>
    );
  };

  return (
    <Pressable
      style={styles.cardContainer}
      onPress={handleFlip}
      accessibilityLabel="Retourner la carte Le Petit Tou Wallet"
    >
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── RECTO FACE (Face Avant Apple Wallet) ─────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Animated.View style={[styles.cardFace, styles.frontFace, frontAnimatedStyle]}>
        {/* Full-bleed Texture Background */}
        {renderBackground()}

        {/* Frosted Glass Overlay with Chamfered Gold Border */}
        <View style={styles.glassLayer} />

        {/* TOP ROW: Brand typography & Contactless symbol */}
        <View style={styles.topRow}>
          <View style={styles.brandTitleWrap}>
            <Text style={styles.brandTitleGold}>LE PETIT TOU</Text>
            <Text style={styles.brandSubtitle}>PASS PRIVILÈGE • TOULOUSE</Text>
          </View>

          {/* Contactless waves icon */}
          <View style={styles.nfcWrap}>
            <Wifi size={22} color={Brand.chouchou} style={{ transform: [{ rotate: '90deg' }] }} strokeWidth={2} />
          </View>
        </View>

        {/* CENTER ROW: Authentic Gold EMV Chip & Holographic Badge */}
        <View style={styles.centerRow}>
          {/* Detailed EMV Chip Simulation */}
          <View style={styles.emvChip}>
            <View style={styles.emvLineH} />
            <View style={styles.emvLineV} />
            <View style={styles.emvInnerCore} />
          </View>

          {/* Hologram Badge */}
          <View style={styles.hologramBadge}>
            <Sparkles size={11} color={Brand.chouchou} strokeWidth={2} style={{ marginRight: 4 }} />
            <Text style={styles.hologramText}>OFFICIEL 2026</Text>
          </View>
        </View>

        {/* BOTTOM ROW: Member status, Points & Cardholder Device ID */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.cardholderLabel}>TITULAIRE DU PASS</Text>
            <Text style={styles.cardholderName}>MEMBRE PRIVILÈGE</Text>
            <Text style={styles.cardholderId}>{deviceId}</Text>
          </View>

          <View style={styles.pointsBadgeWrap}>
            <Text style={styles.pointsValueText}>{stats.totalPoints} PTS</Text>
            <Text style={styles.pointsSubText}>
              {stats.discoveredCount} ADRESSE{stats.discoveredCount > 1 ? 'S' : ''}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ─── VERSO FACE (Face Arrière Apple Wallet) ────────────── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <Animated.View style={[styles.cardFace, styles.backFace, backAnimatedStyle]}>
        {/* Full-bleed Texture Background */}
        {renderBackground()}

        {/* Back Matte Shade Layer */}
        <View style={styles.backShadeLayer} />

        {/* Magnetic Stripe (Full-width deep obsidian stripe) */}
        <View style={styles.magneticStripe} />

        {/* Signature & Security Strip */}
        <View style={styles.signatureRow}>
          <View style={styles.signatureStrip}>
            <Text style={styles.signaturePattern}>
              LE PETIT TOU • TOULOUSE • LE PETIT TOU • TOULOUSE
            </Text>
          </View>
          <View style={styles.cvvBox}>
            <Text style={styles.cvvText}>790</Text>
          </View>
        </View>

        {/* Pass Scan & Security Info */}
        <View style={styles.backContentRow}>
          <View style={styles.qrCodeBox}>
            <QrCode size={52} color={Brand.white} strokeWidth={1.8} />
          </View>

          <View style={styles.backInfoTextWrap}>
            <Text style={styles.backInfoTitle}>Validité Commerçants</Text>
            <Text style={styles.backInfoDesc}>
              Présentez cet écran chez les commerçants partenaires Le Petit Tou pour bénéficier de vos privilèges exclusifs.
            </Text>
            <View style={styles.secureSealRow}>
              <ShieldCheck size={12} color="#1FA67A" strokeWidth={2} style={{ marginRight: 4 }} />
              <Text style={styles.secureSealText}>Certifié Le Petit Tou 2026</Text>
            </View>
          </View>
        </View>

        {/* Flip Back Hint */}
        <View style={styles.backFooterRow}>
          <RotateCcw size={12} color="rgba(255, 255, 255, 0.7)" style={{ marginRight: 5 }} />
          <Text style={styles.backFooterHint}>Toucher pour retourner</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignSelf: 'center',
    position: 'relative',
    borderRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: Brand.ink,
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.28,
        shadowRadius: 26,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 20px 48px -10px rgba(0, 0, 0, 0.35), 0 8px 16px -6px rgba(0, 0, 0, 0.2)',
      } as any,
    }),
  },
  cardFace: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    overflow: 'hidden',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  frontFace: {
    padding: 20,
    justifyContent: 'space-between',
    backgroundColor: '#24242E',
  },
  backFace: {
    backgroundColor: '#24242E',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  cardCover: {
    ...StyleSheet.absoluteFill,
  },
  glassLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(43, 29, 70, 0.42)',
    borderWidth: 1,
    borderColor: 'rgba(242, 184, 53, 0.25)',
    borderRadius: 20,
  },
  backShadeLayer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(11, 15, 25, 0.82)',
  },
  obsidianGlowRed: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(232, 74, 95, 0.35)',
  },
  obsidianGlowGold: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(242, 184, 53, 0.25)',
  },

  // ─── Front Face Layout ───
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  brandTitleWrap: {
    flex: 1,
  },
  brandTitleGold: {
    color: Brand.bg,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2.2,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  brandSubtitle: {
    color: Brand.chouchou,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 2,
  },
  nfcWrap: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  centerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
    marginVertical: 4,
  },
  emvChip: {
    width: 44,
    height: 34,
    borderRadius: 7,
    backgroundColor: '#D4AF37',
    borderWidth: 1,
    borderColor: '#B8860B',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  emvLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#8B6508',
  },
  emvLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#8B6508',
  },
  emvInnerCore: {
    width: 16,
    height: 14,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#8B6508',
    backgroundColor: '#E5C158',
  },
  hologramBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 184, 53, 0.45)',
  },
  hologramText: {
    color: Brand.bg,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 2,
  },
  cardholderLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardholderName: {
    color: Brand.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardholderId: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
    marginTop: 2,
  },
  pointsBadgeWrap: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(43, 29, 70, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pointsValueText: {
    color: Brand.chouchou,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pointsSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // ─── Back Face Layout ───
  magneticStripe: {
    height: 38,
    backgroundColor: '#090D16',
    width: '100%',
    marginTop: 14,
    zIndex: 2,
    borderTopWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  signatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginTop: 8,
    zIndex: 2,
  },
  signatureStrip: {
    flex: 1,
    height: 24,
    backgroundColor: Brand.line,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  signaturePattern: {
    color: Brand.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  cvvBox: {
    width: 38,
    height: 24,
    backgroundColor: Brand.white,
    borderRadius: 4,
    marginLeft: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cvvText: {
    color: '#24242E',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  backContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 2,
    marginVertical: 4,
  },
  qrCodeBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    marginRight: 14,
  },
  backInfoTextWrap: {
    flex: 1,
  },
  backInfoTitle: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  backInfoDesc: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 12,
    lineHeight: 13,
    marginTop: 2,
  },
  secureSealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  secureSealText: {
    color: '#1FA67A',
    fontSize: 12,
    fontWeight: '700',
  },
  backFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  backFooterHint: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
});
