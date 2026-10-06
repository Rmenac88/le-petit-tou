import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import FloatingDock, { TabType } from '@/components/FloatingDock';
import HomeView from '@/components/views/HomeView';
import SearchView from '@/components/views/SearchView';
import MapView from '@/components/views/MapView';
import CardsView from '@/components/views/CardsView';

import { Brand } from '../constants/brand';
export default function HomeScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [hasVisitedMap, setHasVisitedMap] = useState(false);
  const [hasVisitedSearch, setHasVisitedSearch] = useState(false);
  const [hasVisitedCards, setHasVisitedCards] = useState(false);

  React.useEffect(() => {
    setIsDockVisible(true);
    if (activeTab === 'map') setHasVisitedMap(true);
    if (activeTab === 'search') setHasVisitedSearch(true);
    if (activeTab === 'cards') setHasVisitedCards(true);
  }, [activeTab]);

  const handleSelectSpotForMap = (id: string) => {
    setFocusedSpotId(id);
    setHasVisitedMap(true);
    setActiveTab('map');
  };

  return (
    <View style={styles.container}>
      {/* Screen Content: Persistent 0ms Tab Views */}
      <View style={styles.contentContainer}>
        {/* Home Tab */}
        <View
          pointerEvents={activeTab === 'home' ? 'auto' : 'none'}
          style={[
            styles.tabViewWrapper,
            activeTab === 'home' ? styles.tabViewActive : styles.tabViewHidden,
          ]}
        >
          <View style={styles.column}>
            <HomeView
              onChangeTab={setActiveTab}
              onToggleDock={setIsDockVisible}
              onSelectSpot={handleSelectSpotForMap}
            />
          </View>
        </View>

        {/* Search Tab (Mounted on first visit, then kept in memory for 0ms switch) */}
        {hasVisitedSearch && (
          <View
            pointerEvents={activeTab === 'search' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'search' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <View style={styles.column}>
              <SearchView onSelectSpot={handleSelectSpotForMap} onToggleDock={setIsDockVisible} />
            </View>
          </View>
        )}

        {/* Map Tab (Mounted on first visit, then kept in memory for 0ms switch) */}
        {hasVisitedMap && (
          <View
            pointerEvents={activeTab === 'map' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'map' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <MapView
              focusedSpotId={focusedSpotId}
              clearFocusedSpot={() => setFocusedSpotId(null)}
              onToggleDock={setIsDockVisible}
              onChangeTab={setActiveTab}
            />
          </View>
        )}

        {/* Cards Tab (Mounted on first visit, then kept in memory for 0ms switch) */}
        {hasVisitedCards && (
          <View
            pointerEvents={activeTab === 'cards' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'cards' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <View style={styles.column}>
              <CardsView />
            </View>
          </View>
        )}
      </View>

      {/* Floating Tab Navigation */}
      <FloatingDock activeTab={activeTab} onChangeTab={setActiveTab} visible={isDockVisible} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Brand.bg,
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
  // Colonne de lecture centrée sur tablette et bureau (la carte reste pleine largeur)
  column: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  tabViewWrapper: {
    ...StyleSheet.absoluteFill,
  },
  tabViewActive: {
    zIndex: 1,
    opacity: 1,
  },
  tabViewHidden: {
    zIndex: 0,
    opacity: 0,
  },
});


