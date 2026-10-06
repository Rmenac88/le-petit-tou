import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useColorScheme, View, Platform } from 'react-native';

export default function RootLayout() {
  const colorScheme = useColorScheme();

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
              outline: none !important;
              box-shadow: none !important;
              -webkit-tap-highlight-color: transparent !important;
            }
            input:focus, textarea:focus, select:focus, [contenteditable]:focus {
              outline: none !important;
              box-shadow: none !important;
            }
          `
        }} />
      )}
      <View style={{ flex: 1, width: '100%', overflow: 'hidden' }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </ThemeProvider>
  );
}

