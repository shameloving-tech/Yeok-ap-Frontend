import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import Toast from 'react-native-toast-message';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AnimatedSplashScreen } from '@/components/animated-splash-screen';

// 네이티브 스플래시가 자동으로 숨겨지는 것을 방지
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

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
        // 초기화 로직 및 최소 로딩 시간 (1.5초)
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
      // 1. 네이티브 스플래시를 즉시 숨겨서 커스텀 애니메이션이 보이게 함
      SplashScreen.hideAsync().catch(() => {
        /* ignore error */
      });

      // 2. 애니메이션을 2.5초 동안 보여준 후 페이드 아웃 시작
      const timer = setTimeout(() => {
        setIsExiting(true);
        // 3. 페이드 아웃(500ms) 완료 후 스플래시 컴포넌트 제거
        setTimeout(() => {
          setShowAnimatedSplash(false);
        }, 500);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  // 앱이 아직 준비되지 않았더라도 테마와 기본 구조는 렌더링해야 함
  // 그래야 그 위에 AnimatedSplashScreen을 띄울 수 있음
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <View style={styles.container}>
        {/* 메인 앱 컨텐츠 (스플래시 뒤에 미리 렌더링) */}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ headerShown: false }} />
          <Stack.Screen name="report/[id]" options={{ headerShown: false }} />
        </Stack>

        {/* 커스텀 애니메이션 스플래시 (최상단) */}
        {showAnimatedSplash && <AnimatedSplashScreen isExiting={isExiting} />}
      </View>
      <StatusBar style="auto" />
      <Toast topOffset={60} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
