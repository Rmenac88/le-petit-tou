import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Trophy, Sparkles, CreditCard } from 'lucide-react-native';
import styles from './homeStyles';

export interface ProgressionBannerProps {
  discoveryStats: {
    discoveredCount: number;
    totalPlaces: number;
    progressPercentage: number;
    totalPoints: number;
    levelName?: string;
  };
  onOpenWallet?: () => void;
}

const triggerHaptic = () => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  } catch (e) {}
};

export const ProgressionBanner: React.FC<ProgressionBannerProps> = ({
  discoveryStats,
  onOpenWallet,
}) => {
  const getBadgeTitle = () => {
    if (discoveryStats.levelName) return discoveryStats.levelName;
    if (discoveryStats.discoveredCount < 5) return 'Flâneur Toulousain';
    if (discoveryStats.discoveredCount < 15) return 'Explorateur Passionné';
    if (discoveryStats.discoveredCount < 30) return 'Connaisseur Rose';
    return 'Capitole Master';
  };

  return (
    <View style={styles.progressionBarContainer}>
      <View style={styles.progressionContent}>
        <View style={styles.progressionTopRow}>
          <View style={styles.levelBadge}>
            <Trophy size={13} color="#E5A93B" strokeWidth={2.4} style={{ marginRight: 5 }} />
            <Text style={styles.levelBadgeText}>{getBadgeTitle()}</Text>
          </View>

          <View style={styles.pointsBadge}>
            <Sparkles size={11} color="#C52824" strokeWidth={2.4} style={{ marginRight: 4 }} />
            <Text style={styles.pointsBadgeText}>{discoveryStats.totalPoints} pts</Text>
          </View>
        </View>

        <View style={styles.progressGaugeRow}>
          <View style={styles.progressGaugeTrack}>
            <View
              style={[
                styles.progressGaugeFill,
                { width: `${Math.max(4, discoveryStats.progressPercentage)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressGaugeLabel}>
            {discoveryStats.discoveredCount} / {discoveryStats.totalPlaces}
          </Text>
        </View>
      </View>

      {/* Quick Link to Le Petit Tou Wallet */}
      {onOpenWallet && (
        <Pressable
          style={({ pressed }) => [
            styles.privilegeShortcutBtn,
            pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
          ]}
          onPress={() => {
            triggerHaptic();
            onOpenWallet();
          }}
          accessibilityLabel="Ouvrir Le Petit Tou Wallet"
        >
          <CreditCard size={17} color="#C52824" strokeWidth={2.2} />
          <Text style={styles.privilegeShortcutText}>Wallet</Text>
        </Pressable>
      )}
    </View>
  );
};

export default ProgressionBanner;
