import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme, View, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

import IntroScreen from '@/components/IntroScreen';

export const BACKGROUND_LOCATION_TASK = 'background-location-task';

// Register background task only on native platforms
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }: any) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }
    if (data) {
      const { locations } = data;
      if (locations && locations.length > 0) {
        const location = locations[0];
        const { latitude, longitude } = location.coords;
        console.log('DEBUG: Background location update:', latitude, longitude);

        // Spots coordinates list
        const PT_SPOTS = [
          { id: '1', lat: 43.5999, lng: 1.4406 },
          { id: '2', lat: 43.6044, lng: 1.4435 },
          { id: '3', lat: 43.5965, lng: 1.4455 },
          { id: '4', lat: 43.5985, lng: 1.4325 }
        ];

        const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3; // Earth radius in meters
          const phi1 = (lat1 * Math.PI) / 180;
          const phi2 = (lat2 * Math.PI) / 180;
          const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
          const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) *
              Math.cos(phi2) *
              Math.sin(deltaLambda / 2) *
              Math.sin(deltaLambda / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const userId = session.user.id;
            for (const spot of PT_SPOTS) {
              const distance = getDistance(latitude, longitude, spot.lat, spot.lng);
              if (distance < 50) {
                console.log(`DEBUG: User is within 50m of spot ${spot.id} (${distance.toFixed(1)}m). Logging visit!`);
                await supabase
                  .from('user_visits')
                  .upsert({
                    user_id: userId,
                    spot_id: spot.id,
                    visited_at: new Date().toISOString(),
                  });
              }
            }
          }
        }
      }
    }
  });
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [introFinished, setIntroFinished] = useState(false);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={introFinished ? 'dark' : 'auto'} />
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        {!introFinished && (
          <IntroScreen onFinish={() => setIntroFinished(true)} />
        )}
      </View>
    </ThemeProvider>
  );
}

