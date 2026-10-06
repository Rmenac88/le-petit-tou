import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { useColorScheme, View, Platform } from 'react-native';
import { useFonts, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { applyBrandTypography } from '@/lib/typography';
import IntroScreen from '@/components/IntroScreen';
import { appStorage } from '@/lib/storage';

const INTRO_SEEN_KEY = 'pt_intro_seen_v1';

applyBrandTypography();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [introFinished, setIntroFinished] = useState(false);
  const [introChecked, setIntroChecked] = useState(false);

  // L'écran d'ouverture ne s'affiche qu'au tout premier lancement
  useEffect(() => {
    appStorage.getItem(INTRO_SEEN_KEY).then((seen) => {
      if (seen) setIntroFinished(true);
      setIntroChecked(true);
    });
  }, []);

  const handleIntroFinish = () => {
    setIntroFinished(true);
    appStorage.setItem(INTRO_SEEN_KEY, '1');
  };
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="dark" />
      {Platform.OS === 'web' && (
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              overflow-x: hidden !important;
              max-width: 100vw !important;
              width: 100% !important;
              height: 100% !important;
              background: #F8F9FA;
              margin: 0 !important;
              padding: 0 !important;
              position: relative !important;
              -webkit-overflow-scrolling: touch !important;
              touch-action: pan-y !important;
              overscroll-behavior-y: none;
            }
            * {
              box-sizing: border-box;
              -webkit-tap-highlight-color: transparent;
            }
            input, textarea, select, [contenteditable] {
              -webkit-tap-highlight-color: transparent !important;
            }
            :focus-visible {
              outline: 2px solid #E84A5F !important;
              outline-offset: 2px;
              border-radius: 8px;
            }
          `
        }} />
      )}
      <View style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        {fontsLoaded && <Stack screenOptions={{ headerShown: false }} />}
        {fontsLoaded && introChecked && !introFinished && <IntroScreen onFinish={handleIntroFinish} />}
      </View>
    </ThemeProvider>
  );
}

