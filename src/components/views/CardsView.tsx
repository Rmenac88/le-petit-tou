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
  const [activeSkin, setActiveSkin] = useState<CardSkin>('titanium');
  const [isFlipped, setIsFlipped] = useState(false);

  const skins: { id: CardSkin; label: string; dotColor: string }[] = [
    { id: 'titanium', label: 'Titane Brossé', dotColor: '#D4AF37' },
    { id: 'crimson', label: 'Pourpre & Or', dotColor: '#C52824' },
    { id: 'obsidian', label: 'Obsidienne', dotColor: '#1E293B' },
  ];

  return (
    <SafeAreaView style={styles.safeContainer} edges={['top']}>
      <View style={styles.container}>
        {/* Apple Wallet Header */}
        <View style={styles.header}>
          <View style={styles.headerTag}>
            <Sparkles size={12} color="#E5A93B" strokeWidth={2.5} style={{ marginRight: 5 }} />
            <Text style={styles.headerTagText}>APPLE WALLET PASS</Text>
          </View>
          <Text style={styles.title}>Le Petit Tou Wallet</Text>
          <Text style={styles.subtitle}>
            Votre pass membre privilégié pour les 790 adresses de Toulouse
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
            <RotateCcw size={13} color="#94A3B8" style={{ marginRight: 5 }} />
            <Text style={styles.hintText}>
              {isFlipped ? 'Toucher pour voir le recto' : 'Toucher pour retourner la carte'}
            </Text>
          </View>
        </View>

        {/* Card Personalization Selector (Skins) */}
        <View style={styles.customizerContainer}>
          <View style={styles.customizerHeader}>
            <Palette size={13} color="#64748B" strokeWidth={2.2} style={{ marginRight: 6 }} />
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

        {/* Discreet Security Badge */}
        <View style={styles.securitySeal}>
          <ShieldCheck size={14} color="#10B981" strokeWidth={2.4} style={{ marginRight: 6 }} />
          <Text style={styles.securitySealText}>
            Pass sécurisé sans contact • Mémorisé sur cet appareil
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FAF5EF',
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
    backgroundColor: 'rgba(229, 169, 59, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 59, 0.3)',
    marginBottom: 8,
  },
  headerTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B45309',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
      web: {
        boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
      } as any,
    }),
  },
  hintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  skinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  skinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  skinPillSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
    ...Platform.select({
      ios: {
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)',
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
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  skinPillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  securitySeal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  securitySealText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
});
