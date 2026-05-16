import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';

const { width } = Dimensions.get('window');

const COLORS = {
  primary: '#2E6D4D',
  secondary: '#548C71',
  background: '#F8F9FB',
  cardBg: '#FFFFFF',
  textMain: '#1C1C1E',
  textSub: '#8E8E93',
  accent: '#FF9F43',
  danger: '#FF3B30',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('익명');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      const loadProfile = async () => {
        const savedNickname = await AsyncStorage.getItem('user_nickname');
        const savedImage = await AsyncStorage.getItem('user_profile_image');
        if (savedNickname) setNickname(savedNickname);
        if (savedImage) setProfileImage(savedImage);
      };
      loadProfile();
    }, [])
  );

  const renderHeader = () => (
    <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('@/assets/images/character_design.svg')} 
            style={styles.headerMascot}
            contentFit="contain"
          />
          <ThemedText style={styles.headerTitle}>설정</ThemedText>
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="settings-outline" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMenuItem = (icon: any, label: string, href?: string, color: string = COLORS.textMain) => {
    const content = (
      <View style={styles.menuItem}>
        <View style={styles.menuLeft}>
          <View style={[styles.iconContainer, { backgroundColor: color + '10' }]}>
            <Ionicons name={icon} size={20} color={color} />
          </View>
          <ThemedText style={styles.menuText}>{label}</ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
      </View>
    );

    if (href) {
      return (
        <Link href={href as any} key={label} asChild>
          <TouchableOpacity>{content}</TouchableOpacity>
        </Link>
      );
    }
    return (
      <TouchableOpacity key={label} activeOpacity={0.6}>
        {content}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderHeader()}
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <Image
            source={profileImage ? { uri: profileImage } : { uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname}` }}
            style={styles.avatar}
            contentFit="cover"
          />
          <View style={styles.profileInfo}>
            <ThemedText style={styles.nickname}>{nickname}</ThemedText>
            <View style={styles.badgeContainer}>
              <View style={styles.proBadge}>
                <ThemedText style={styles.proBadgeText}>지하철 제보 마스터</ThemedText>
              </View>
            </View>
          </View>
          <Link href="/modal" asChild>
            <TouchableOpacity style={styles.editButton}>
              <Ionicons name="pencil" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </Link>
        </View>

        {/* Account Settings */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>계정 관리</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('person-outline', '닉네임 변경', '/modal', COLORS.primary)}
            {renderMenuItem('notifications-outline', '알림 설정', undefined, '#5856D6')}
            {renderMenuItem('shield-outline', '보안 및 로그인', undefined, '#34C759')}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>앱 정보</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('information-circle-outline', '버전 정보 (1.0.0)', undefined, COLORS.textSub)}
            {renderMenuItem('document-text-outline', '이용약관', undefined, COLORS.textSub)}
            {renderMenuItem('lock-closed-outline', '개인정보처리방침', undefined, COLORS.textSub)}
          </View>
        </View>

        {/* Support */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>고객 지원</ThemedText>
          <View style={styles.menuGroup}>
            {renderMenuItem('help-circle-outline', '자주 묻는 질문', undefined, COLORS.accent)}
            {renderMenuItem('mail-outline', '1:1 문의하기', undefined, COLORS.accent)}
            {renderMenuItem('star-outline', '앱 평가하기', undefined, '#FFCC00')}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton}>
          <ThemedText style={styles.logoutText}>로그아웃</ThemedText>
        </TouchableOpacity>
        
        <ThemedText style={styles.footerText}>© 2026 Yeok-Ap. All rights reserved.</ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerWrapper: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12 
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerMascot: { width: 36, height: 36 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginLeft: 4 },
  headerIcon: { padding: 4 },
  scrollContent: { padding: 20, paddingBottom: 60 },
  profileCard: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.background,
  },
  profileInfo: { flex: 1, marginLeft: 16 },
  nickname: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  badgeContainer: { flexDirection: 'row', marginTop: 4 },
  proBadge: { 
    backgroundColor: '#F0F4F2', 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    borderRadius: 8 
  },
  proBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSub,
    marginLeft: 4,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  menuGroup: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FB',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuText: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  logoutButton: {
    marginTop: 10,
    padding: 16,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFEBEB'
  },
  logoutText: { color: COLORS.danger, fontSize: 16, fontWeight: '700' },
  footerText: {
    marginTop: 30,
    textAlign: 'center',
    fontSize: 12,
    color: '#D1D1D6',
  }
});
