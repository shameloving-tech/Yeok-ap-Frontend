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
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => setShowAnimatedSplash(false), 500);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SubwayDataProvider>
        <View style={styles.container}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modal" />
            <Stack.Screen name="report/[id]" />
            <Stack.Screen name="best-posts" />
            <Stack.Screen name="notices" />
            <Stack.Screen name="faqs" />
            <Stack.Screen name="notification-settings" />
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
