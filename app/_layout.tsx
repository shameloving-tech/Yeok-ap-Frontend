import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import { toastConfig } from '@/components/toast-config';
import crashlytics from '@react-native-firebase/crashlytics';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';
import { SubwayDataProvider } from '@/contexts/SubwayDataContext';

SplashScreen.preventAutoHideAsync().catch(() => {});
crashlytics().setCrashlyticsCollectionEnabled(true);

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [appIsReady, setAppIsReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync().catch(() => {});
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => setShowAnimatedSplash(false), 500);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SubwayDataProvider>
        <View style={styles.container}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ headerShown: false }} />
            <Stack.Screen name="report/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="best-posts" options={{ headerShown: false }} />
          </Stack>
          {showAnimatedSplash && <AnimatedSplashScreen isExiting={isExiting} />}
        </View>
        <StatusBar style="auto" />
        <Toast config={toastConfig} topOffset={60} />
      </SubwayDataProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
