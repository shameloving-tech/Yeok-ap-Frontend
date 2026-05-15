import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        // Pre-load fonts, make any API calls you need to do here
        // For now, let's just wait for a bit to simulate loading
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // This tells the splash screen to hide immediately! If we need this to stay longer,
      // we can omit this or call it later.
      await SplashScreen.hideAsync();
      
      // Keep the animated splash for a bit longer if needed, or just let it be.
      // Here we might want to fade it out.
      setTimeout(() => {
        setShowAnimatedSplash(false);
      }, 500); // Small delay to ensure smooth transition
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  if (showAnimatedSplash) {
    return (
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <AnimatedSplashScreen />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

import { View } from 'react-native';
