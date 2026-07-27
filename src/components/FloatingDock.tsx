import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import { GlassView } from 'expo-glass-effect';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Home, Search, Map, Heart, User, LucideIcon } from 'lucide-react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TabType = 'home' | 'search' | 'map' | 'favorites' | 'profile';

interface FloatingDockProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  visible?: boolean;
}

interface TabButtonProps {
  Icon: LucideIcon;
  isActive: boolean;
  onPress: () => void;
  color: string;
}

const APPLE_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

function TabButton({ Icon, isActive, onPress, color }: TabButtonProps) {
  const scale = useSharedValue(1);
  const tileOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1.05 : 1, {
      duration: 250,
      easing: APPLE_EASE,
    });
    tileOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: 250,
      easing: APPLE_EASE,
    });
  }, [isActive, scale, tileOpacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const tileStyle = useAnimatedStyle(() => ({
    opacity: tileOpacity.value,
    transform: [{ scale: tileOpacity.value }],
  }));

  const handlePressIn = () => {
    scale.value = withTiming(0.95, { duration: 100, easing: APPLE_EASE });
  };

  const handlePressOut = () => {
    scale.value = withTiming(isActive ? 1.05 : 1, { duration: 150, easing: APPLE_EASE });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.tabButton, animatedStyle]}
    >
      {/* Glass tile behind active icons (matches your screenshot) */}
      <Animated.View style={[styles.activeGlassTile, tileStyle]}>
        <View style={styles.tileShine} />
      </Animated.View>

      <Icon
        color={color}
        size={22}
        strokeWidth={isActive ? 2.6 : 2.0}
        style={styles.iconStyle}
      />
      {isActive && <View style={styles.activeDot} />}
    </AnimatedPressable>
  );
}

export default function FloatingDock({ activeTab, onChangeTab, visible = true }: FloatingDockProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 150, {
      duration: 300,
      easing: APPLE_EASE,
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const tabs: {
    type: TabType;
    icon: LucideIcon;
  }[] = [
    { type: 'home', icon: Home },
    { type: 'search', icon: Search },
    { type: 'map', icon: Map },
    { type: 'favorites', icon: Heart },
    { type: 'profile', icon: User },
  ];

  return (
    <Animated.View style={[styles.outerContainer, animStyle]}>
      <GlassView
        glassEffectStyle="regular"
        tintColor="#ffffff"
        style={styles.dockContainer}
      >
        {/* Glass reflection shine across the top half of the dock */}
        <View style={styles.glassShine} />

        {tabs.map((tab) => {
          const isActive = activeTab === tab.type;

          return (
            <TabButton
              key={tab.type}
              Icon={tab.icon}
              isActive={isActive}
              onPress={() => onChangeTab(tab.type)}
              color={isActive ? '#C52824' : '#64748B'}
            />
          );
        })}
      </GlassView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 34,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 1000,
  },
  dockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 72,
    borderRadius: 36,
    width: '100%',
    maxWidth: 420,
    paddingHorizontal: 12,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.92)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {},
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 12px 36px 0 rgba(30, 41, 59, 0.18)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      } as any,
    }),
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    pointerEvents: 'none',
    zIndex: -1,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  activeGlassTile: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  tileShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderTopLeftRadius: 11,
    borderTopRightRadius: 11,
  },
  iconStyle: {
    zIndex: 2,
  },
  activeDot: {
    position: 'absolute',
    bottom: -2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C52824',
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
});
