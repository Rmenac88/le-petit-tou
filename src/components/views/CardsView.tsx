import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Sparkles,
  RotateCcw,
  Palette,
  ShieldCheck,
} from 'lucide-react-native';
import AppleWalletCard, { CardSkin } from '../AppleWalletCard';

import { Brand } from '../../constants/brand';
const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  } catch (e) {}
};

export default function CardsView() {
  const [activeSkin, setActiveSkin] = useState<CardSkin>('sidereal');
  const [isFlipped, setIsFlipped] = useState(false);

  const skins: { id: CardSkin; label: string; dotColor: string }[] = [
    { id: 'sidereal', label: 'Violet sidéral', dotColor: Brand.violet },

  ];

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <View style={styles.container}>
        {/* Apple Wallet Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Ta carte Petit Tou</Text>
          <Text style={styles.subtitle}>
            Ton pass pour les réductions et les bons plans des 790 adresses de Toulouse
          </Text>
        </View>

        {/* Center Stage: The Hero Floating 3D Apple Wallet Card */}
        <View style={styles.heroCardContainer}>
          <AppleWalletCard
            activeSkin={activeSkin}
            onFlipChange={(flipped) => setIsFlipped(flipped)}
          />

          {/* Interactive Flip Hint */}
          <View style={styles.hintWrap}>
            <RotateCcw size={13} color={Brand.inkSoft} style={{ marginRight: 5 }} />
            <Text style={styles.hintText}>
              {isFlipped ? 'Toucher pour voir le recto' : 'Toucher pour retourner la carte'}
            </Text>
          </View>
        </View>

        {skins.length > 1 && (
          <>
        {/* Card Personalization Selector (Skins) */}
        <View style={styles.customizerContainer}>
          <View style={styles.customizerHeader}>
            <Palette size={13} color={Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
            <Text style={styles.customizerTitle}>Finition de la carte</Text>
          </View>

          <View style={styles.skinRow}>
            {skins.map((s) => {
              const isSelected = activeSkin === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[
                    styles.skinPill,
                    isSelected && styles.skinPillSelected,
                  ]}
                  onPress={() => {
                    triggerHaptic();
                    setActiveSkin(s.id);
                  }}
                  accessibilityLabel={`Sélectionner la finition ${s.label}`}
                >
                  <View style={[styles.skinColorDot, { backgroundColor: s.dotColor }]} />
                  <Text
                    style={[
                      styles.skinPillText,
                      isSelected && styles.skinPillTextSelected,
                    ]}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

          </>
        )}

        {/* Discreet Security Badge */}
        <View style={styles.securitySeal}>
          <ShieldCheck size={14} color="#1FA67A" strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={styles.securitySealText}>
            Mémorisé sur cet appareil
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 110, // espace pour le dock
  },
  header: {
    paddingTop: 16,
    alignItems: 'center',
  },
  headerTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(242, 184, 53, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(242, 184, 53, 0.3)',
    marginBottom: 8,
  },
  headerTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B45309',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#24242E',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: Brand.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 290,
    lineHeight: 18,
  },
  heroCardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
  },
  hintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    backgroundColor: Brand.white,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: Brand.line,
    ...Platform.select({
      ios: {
        shadowColor: '#24242E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 8px rgba(43, 29, 70, 0.04)',
      } as any,
    }),
  },
  hintText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  customizerContainer: {
    alignItems: 'center',
    marginTop: 12,
  },
  customizerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  customizerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: Brand.inkSoft,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  skinRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  skinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Brand.line,
  },
  skinPillSelected: {
    backgroundColor: '#24242E',
    borderColor: '#24242E',
    ...Platform.select({
      ios: {
        shadowColor: '#24242E',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 12px rgba(43, 29, 70, 0.12)',
      } as any,
    }),
  },
  skinColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  skinPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  skinPillTextSelected: {
    color: Brand.white,
    fontWeight: '700',
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  securitySealText: {
    fontSize: 12,
    color: '#4A4A58',
    fontWeight: '600',
  },
});
