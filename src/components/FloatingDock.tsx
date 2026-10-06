import React, { useEffect } from 'react';
import { StyleSheet, View, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { Home, Search, Map, CreditCard, LucideIcon } from 'lucide-react-native';

import { Brand } from '../constants/brand';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type TabType = 'home' | 'search' | 'map' | 'cards';

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
  accessibilityLabel?: string;
}

const APPLE_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

function TabButton({ Icon, isActive, onPress, color, accessibilityLabel }: TabButtonProps) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const tileOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(isActive ? 1.05 : 1, {
      duration: reduceMotion ? 0 : 250,
      easing: APPLE_EASE,
    });
    tileOpacity.value = withTiming(isActive ? 1 : 0, {
      duration: reduceMotion ? 0 : 250,
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
    scale.value = withTiming(0.95, { duration: reduceMotion ? 0 : 100, easing: APPLE_EASE });
  };

  const handlePressOut = () => {
    scale.value = withTiming(isActive ? 1.05 : 1, { duration: reduceMotion ? 0 : 150, easing: APPLE_EASE });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      style={[styles.tabButton, animatedStyle]}
    >
      {/* Active background indicator */}
      <Animated.View style={[styles.activeGlassTile, tileStyle]} />

      <Icon
        color={color}
        fill={isActive ? 'rgba(232, 74, 95, 0.2)' : 'none'}
        size={22}
        strokeWidth={isActive ? 2.4 : 1.8}
        style={styles.iconStyle}
      />
      {isActive && <View style={styles.activeDot} />}
    </AnimatedPressable>
  );
}

export default function FloatingDock({ activeTab, onChangeTab, visible = true }: FloatingDockProps) {
  const reduceMotion = useReducedMotion();
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : 160, {
      duration: reduceMotion ? 0 : 280,
      easing: APPLE_EASE,
    });
    opacity.value = withTiming(visible ? 1 : 0, {
      duration: reduceMotion ? 0 : 220,
      easing: APPLE_EASE,
    });
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const tabs: {
    type: TabType;
    icon: LucideIcon;
  }[] = [
    { type: 'home', icon: Home },
    { type: 'search', icon: Search },
    { type: 'map', icon: Map },
    { type: 'cards', icon: CreditCard },
  ];

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        animStyle,
        { pointerEvents: visible ? 'auto' : 'none' } as any,
      ]}
    >
      <View style={styles.dockContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.type;

          return (
            <TabButton
              key={tab.type}
              Icon={tab.icon}
              isActive={isActive}
              onPress={() => onChangeTab(tab.type)}
              color={isActive ? Brand.primary : Brand.inkSoft}
              accessibilityLabel={`tab-${tab.type}`}
            />
          );
        })}
      </View>
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
    height: 64,
    borderRadius: 28,
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: 12,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1.5,
    borderColor: Brand.line,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {},
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 8px 24px 0 rgba(43, 29, 70, 0.08)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      } as any,
    }),
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
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
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: 'rgba(232, 74, 95, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 74, 95, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  iconStyle: {
    zIndex: 2,
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Brand.primaryDeep,
  },
});
