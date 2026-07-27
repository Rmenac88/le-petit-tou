import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import FloatingDock, { TabType } from '@/components/FloatingDock';
import HomeView from '@/components/views/HomeView';
import SearchView from '@/components/views/SearchView';
import MapView from '@/components/views/MapView';
import FavoritesView from '@/components/views/FavoritesView';
import ProfileView from '@/components/views/ProfileView';

export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [isDockVisible, setIsDockVisible] = useState(true);

  React.useEffect(() => {
    setIsDockVisible(true);
  }, [activeTab]);

  const renderActiveView = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeView
            onChangeTab={setActiveTab}
            onToggleDock={setIsDockVisible}
            onSelectSpot={(id) => {
              setFocusedSpotId(id);
              setActiveTab('map');
            }}
          />
        );
      case 'search':
        return (
          <SearchView
            onSelectSpot={(id) => {
              setFocusedSpotId(id);
              setActiveTab('map');
            }}
          />
        );
      case 'map':
        return (
          <MapView
            focusedSpotId={focusedSpotId}
            clearFocusedSpot={() => setFocusedSpotId(null)}
            onToggleDock={setIsDockVisible}
            onChangeTab={setActiveTab}
          />
        );
      case 'favorites':
        return (
          <FavoritesView
            onChangeTab={setActiveTab}
            onFocusSpot={(id) => {
              setFocusedSpotId(id);
              setActiveTab('map');
            }}
          />
        );
      case 'profile':
        return (
          <ProfileView
            onChangeTab={setActiveTab}
            onToggleDock={setIsDockVisible}
            onFocusSpot={(id) => {
              setFocusedSpotId(id);
              setActiveTab('map');
            }}
          />
        );
      default:
        return <HomeView onToggleDock={setIsDockVisible} />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Soft Ambient Background Glows */}
      <Image
        source={require('../../assets/images/logo-glow.png')}
        style={[styles.glow, styles.glowRed]}
        tintColor="rgba(197, 40, 36, 0.25)"
      />
      <Image
        source={require('../../assets/images/logo-glow.png')}
        style={[styles.glow, styles.glowGold]}
        tintColor="rgba(229, 169, 59, 0.25)"
      />

      {/* Screen Content */}
      <View style={styles.contentContainer}>
        {renderActiveView()}
      </View>

      {/* Floating Tab Navigation */}
      <FloatingDock activeTab={activeTab} onChangeTab={setActiveTab} visible={isDockVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF5EF',
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    paddingBottom: 0,
    width: '100%',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    opacity: 0.6,
  },
  glowRed: {
    top: -120,
    left: -120,
    width: 320,
    height: 320,
  },
  glowGold: {
    bottom: 0,
    right: -140,
    width: 360,
    height: 360,
  },
});


