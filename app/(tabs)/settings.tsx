import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

export default function SettingsScreen() {
  const [nickname, setNickname] = useState('익명');

  useFocusEffect(
    useCallback(() => {
      const loadNickname = async () => {
        const savedNickname = await AsyncStorage.getItem('user_nickname');
        if (savedNickname) setNickname(savedNickname);
      };
      loadNickname();
    }, [])
  );

  const renderMenuItem = (icon: any, label: string, href?: string, color: string = '#1C1C1E') => {
    const content = (
      <TouchableOpacity style={styles.menuItem}>
        <View style={styles.menuLeft}>
          <View style={[styles.iconContainer, { backgroundColor: color + '1A' }]}>
            <Ionicons name={icon} size={22} color={color} />
          </View>
          <ThemedText style={styles.menuText}>{label}</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
      </TouchableOpacity>
    );

    if (href) {
      return (
        <Link href={href as any} key={label} asChild>
          {content}
        </Link>
      );
    }
    return <View key={label}>{content}</View>;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText style={styles.headerTitle}>설정</ThemedText>

        {/* 프로필 섹션 */}
        <View style={styles.profileCard}>
          <Image
            source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname}` }}
            style={styles.avatar}
          />
          <View style={styles.profileInfo}>
            <ThemedText style={styles.nickname}>{nickname}</ThemedText>
            <ThemedText style={styles.email}>지하철 제보 마스터</ThemedText>
          </View>
          <Link href="/modal" asChild>
            <TouchableOpacity style={styles.editButton}>
              <ThemedText style={styles.editButtonText}>수정</ThemedText>
            </TouchableOpacity>
          </Link>
        </View>

        {/* 설정 그룹 1: 계정 및 보안 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>계정 설정</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('person-outline', '닉네임 변경', '/modal', '#FF9F43')}
            {renderMenuItem('notifications-outline', '알림 설정', undefined, '#5856D6')}
          </View>
        </View>

        {/* 설정 그룹 2: 앱 정보 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>앱 정보</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('information-circle-outline', '버전 정보 (1.0.0)', undefined, '#34C759')}
            {renderMenuItem('document-text-outline', '이용약관', undefined, '#8E8E93')}
            {renderMenuItem('shield-checkmark-outline', '개인정보처리방침', undefined, '#AF52DE')}
          </View>
        </View>

        {/* 설정 그룹 3: 고객 지원 */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>고객 지원</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('mail-outline', '문의하기', undefined, '#007AFF')}
            {renderMenuItem('star-outline', '앱 평가하기', undefined, '#FFCC00')}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <ThemedText style={styles.logoutText}>로그아웃</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 25,
    color: '#1C1C1E',
    lineHeight: 41, // fontSize 보다 크게 설정하여 잘림 방지
  },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F2F2F7',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 15,
  },
  nickname: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  email: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  editButton: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9F43',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginLeft: 15,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  menuGroup: {
    backgroundColor: 'white',
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F2F2F7',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  logoutButton: {
    marginTop: 10,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
