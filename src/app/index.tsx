import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import FloatingDock, { TabType } from '@/components/FloatingDock';
import HomeView from '@/components/views/HomeView';
import SearchView from '@/components/views/SearchView';
import MapView from '@/components/views/MapView';
import OffersView from '@/components/views/OffersView';
import ProfileView from '@/components/views/ProfileView';
import AgendaView from '@/components/views/AgendaView';

import ErrorBoundary from '@/components/ErrorBoundary';
import { configurePush, resyncPushRegistration, useNotificationNavigation } from '@/lib/pushNotifications';
import { Brand } from '../constants/brand';
import { mark } from '@/lib/startupTrace';
export default function HomeScreen() {
  mark('home-screen-render');
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [focusedSpotId, setFocusedSpotId] = useState<string | null>(null);
  const [isDockVisible, setIsDockVisible] = useState(true);
  const [hasVisitedMap, setHasVisitedMap] = useState(false);
  const [hasVisitedSearch, setHasVisitedSearch] = useState(false);
  const [hasVisitedOffers, setHasVisitedOffers] = useState(false);
  const [hasVisitedProfile, setHasVisitedProfile] = useState(false);
  // Le profil s'ouvre depuis le bouton en haut à droite : « Retour » ramène à l'onglet d'où l'on vient
  const [tabBeforeProfile, setTabBeforeProfile] = useState<TabType>('home');
  const [hasVisitedAgenda, setHasVisitedAgenda] = useState(false);

  React.useEffect(() => {
    setIsDockVisible(true);
    if (activeTab === 'map') setHasVisitedMap(true);
    if (activeTab === 'search') setHasVisitedSearch(true);
    if (activeTab === 'offers') setHasVisitedOffers(true);
    if (activeTab === 'profile') setHasVisitedProfile(true);
    if (activeTab === 'agenda') setHasVisitedAgenda(true);
  }, [activeTab]);

  // Notifications : canal/affichage au démarrage, rafraîchissement du jeton, ouverture du bon écran au toucher
  React.useEffect(() => {
    configurePush().then(resyncPushRegistration);
  }, []);
  useNotificationNavigation((target) => {
    if (target.tab === 'map' && target.spotId) {
      setFocusedSpotId(target.spotId);
      setHasVisitedMap(true);
    }
    setActiveTab(target.tab);
  });

  const openProfile = () => {
    setTabBeforeProfile(activeTab === 'profile' ? tabBeforeProfile : activeTab);
    setActiveTab('profile');
  };

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
            <ErrorBoundary scope="HomeView" compact><HomeView
              onChangeTab={(tab: TabType) => (tab === 'profile' ? openProfile() : setActiveTab(tab))}
              onToggleDock={setIsDockVisible}
              onSelectSpot={handleSelectSpotForMap}
            /></ErrorBoundary>
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
              <ErrorBoundary scope="SearchView" compact><SearchView onSelectSpot={handleSelectSpotForMap} onToggleDock={setIsDockVisible} onOpenProfile={openProfile} /></ErrorBoundary>
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
            <ErrorBoundary scope="MapView"><MapView
              focusedSpotId={focusedSpotId}
              clearFocusedSpot={() => setFocusedSpotId(null)}
              onToggleDock={setIsDockVisible}
              onChangeTab={setActiveTab}
            /></ErrorBoundary>
          </View>
        )}

        {/* Offers Tab (« - % » : offres et réductions) */}
        {hasVisitedOffers && (
          <View
            pointerEvents={activeTab === 'offers' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'offers' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <View style={styles.column}>
              <ErrorBoundary scope="OffersView" compact><OffersView onSelectSpot={handleSelectSpotForMap} onOpenProfile={openProfile} onToggleDock={setIsDockVisible} /></ErrorBoundary>
            </View>
          </View>
        )}

        {/* Profile (bouton en haut à droite) : niveau, carte, listes, réglages */}
        {hasVisitedProfile && (
          <View
            pointerEvents={activeTab === 'profile' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'profile' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <View style={styles.column}>
              <ErrorBoundary scope="ProfileView" compact>
                <ProfileView
                  onBack={() => setActiveTab(tabBeforeProfile)}
                  onSelectSpot={handleSelectSpotForMap}
                  onToggleDock={activeTab === 'profile' ? setIsDockVisible : undefined}
                />
              </ErrorBoundary>
            </View>
          </View>
        )}

        {/* Agenda Tab (Mounted on first visit, then kept in memory for 0ms switch) */}
        {hasVisitedAgenda && (
          <View
            pointerEvents={activeTab === 'agenda' ? 'auto' : 'none'}
            style={[
              styles.tabViewWrapper,
              activeTab === 'agenda' ? styles.tabViewActive : styles.tabViewHidden,
            ]}
          >
            <View style={styles.column}>
              <ErrorBoundary scope="AgendaView" compact><AgendaView onToggleDock={setIsDockVisible} onSelectSpot={handleSelectSpotForMap} onOpenProfile={openProfile} /></ErrorBoundary>
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


