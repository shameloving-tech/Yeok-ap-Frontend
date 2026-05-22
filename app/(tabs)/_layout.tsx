import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { APP_COLORS } from '@/constants/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: APP_COLORS.primary,
        tabBarInactiveTintColor: '#8E8E93',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 60 + insets.bottom,
          paddingTop: 10,
          paddingBottom: insets.bottom,
          borderTopWidth: 1,
          borderTopColor: '#F2F2F7',
          backgroundColor: 'white',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginBottom: 6,
        }
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="route"
        options={{
          title: '길찾기',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="navigate" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '검색',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: '커뮤니티',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="people" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color }) => <Ionicons size={24} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}
