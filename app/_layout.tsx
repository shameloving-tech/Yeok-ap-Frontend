import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, useCallback } from 'react';
import { View } from 'react-native';
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
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // 앱 초기화 로직 (폰트 로딩, API 호출 등)
        await new Promise(resolve => setTimeout(resolve, 1500)); // 최소 로딩 시간
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
      // 앱이 준비된 후, 애니메이션을 충분히 보여주기 위해 2.5초 대기
      const timer = setTimeout(() => {
        setIsExiting(true);
        // 페이드 아웃 애니메이션(500ms) 완료 후 컴포넌트 제거
        setTimeout(() => {
          setShowAnimatedSplash(false);
        }, 500);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      // 네이티브 스플래시 화면 숨김
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // 로딩 중이거나 스플래시를 보여줘야 하는 상황이면 화면 렌더링 시작
  if (!appIsReady && !showAnimatedSplash) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
        {/* 메인 앱 컨텐츠 */}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>

        {/* 애니메이션 스플래시 화면을 가장 위에 덮음 */}
        {showAnimatedSplash && <AnimatedSplashScreen isExiting={isExiting} />}
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

  );
}
