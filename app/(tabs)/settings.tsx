import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS, SHADOW } from '@/constants/theme';
import { getOrCreateNickname } from '@/utils/deviceToken';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

type RowProps = {
  icon: string;
  iconColor: string;
  label: string;
  value?: string;
  href?: string;
  onPress?: () => void;
  danger?: boolean;
  last?: boolean;
};

function Row({ icon, iconColor, label, value, href, onPress, danger, last }: RowProps) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <ThemedText style={[styles.rowLabel, danger && { color: COLORS.danger }]}>{label}</ThemedText>
      <View style={styles.rowRight}>
        {value ? <ThemedText style={styles.rowValue}>{value}</ThemedText> : null}
        {!danger && <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />}
      </View>
    </View>
  );

  if (href) return <Link href={href as any} asChild><TouchableOpacity activeOpacity={0.6}>{content}</TouchableOpacity></Link>;
  return <TouchableOpacity activeOpacity={0.6} onPress={onPress}>{content}</TouchableOpacity>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // 프로필 수정 후 돌아올 때도 최신 정보 반영 (useFocusEffect)
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const nick = await getOrCreateNickname();
        setNickname(nick);
        const img = await AsyncStorage.getItem('user_profile_image');
        setProfileImage(img);
      };
      load();
    }, [])
  );

  const handleLogout = () =>
    Alert.alert('로그아웃', '정말 로그아웃 하시겠어요?\n즐겨찾기, 최근 기록이 모두 삭제됩니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          const allKeys = await AsyncStorage.getAllKeys();
          // device_token은 커뮤니티 글 작성자 식별에 사용되므로 로그아웃 후에도 유지
          const keepKeys = ['device_token'];
          await AsyncStorage.multiRemove(
            allKeys.filter(k => !keepKeys.includes(k))
          );
          setNickname('');
          setProfileImage(null);
        },
      },
    ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>설정</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* 프로필 카드 */}
        <Link href="/modal" asChild>
          <TouchableOpacity style={styles.profileCard} activeOpacity={0.7}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileAvatar} contentFit="cover" />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                <ThemedText style={styles.profileAvatarText}>{nickname?.[0] || '역'}</ThemedText>
              </View>
            )}
            <View style={styles.profileInfo}>
              <ThemedText style={styles.profileNickname}>{nickname || '닉네임 없음'}</ThemedText>
              <ThemedText style={styles.profileSub}>프로필 편집 →</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C7C7CC" />
          </TouchableOpacity>
        </Link>

        <Section title="계정 관리">
          <Row icon="person-outline"    iconColor={COLORS.primary}  label="프로필 수정"   href="/modal" />
          <Row icon="shield-checkmark-outline" iconColor="#34C759"  label="계정 보안"     last />
        </Section>

        <Section title="앱 설정">
          <Row icon="notifications-outline" iconColor="#5856D6" label="알림 설정" href="/notification-settings" last />
        </Section>

        <Section title="고객지원">
          <Row icon="megaphone-outline"     iconColor={COLORS.accent} label="공지사항" href="/notices" />
          <Row icon="help-circle-outline"   iconColor={COLORS.accent} label="자주 묻는 질문" href="/faqs" />
          <Row icon="mail-outline"          iconColor={COLORS.accent} label="1:1 문의하기" last />
        </Section>

        <Section title="정보">
          <Row
            icon="information-circle-outline"
            iconColor={COLORS.textSub}
            label="앱 버전"
            value={`v${APP_VERSION} (최신)`}
            last
          />
        </Section>

        {/* 로그아웃 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
          <ThemedText style={styles.logoutText}>로그아웃</ThemedText>
        </TouchableOpacity>

        {/* 하단 브랜딩 */}
        <View style={styles.branding}>
          <Image
            source={require('@/assets/images/character_design.svg')}
            style={styles.brandingMascot}
            contentFit="contain"
          />
          <ThemedText style={styles.brandingText}>YEOK-AP SUBWAY COMMUNITY</ThemedText>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },

  content: { paddingHorizontal: 20, paddingBottom: 40 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    gap: 14,
    ...SHADOW.md,
  },
  profileAvatar: { width: 56, height: 56, borderRadius: 28 },
  profileAvatarFallback: { backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center' },
  profileAvatarText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  profileInfo: { flex: 1 },
  profileNickname: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 3 },
  profileSub: { fontSize: 13, color: COLORS.textSub },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSub,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    ...SHADOW.sm,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  iconBox: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: '500', color: COLORS.textMain },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 14, color: COLORS.textSub },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 32,
    ...SHADOW.sm,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: COLORS.danger },

  branding: { alignItems: 'center', gap: 8 },
  brandingMascot: { width: 56, height: 56, opacity: 0.6 },
  brandingText: { fontSize: 11, fontWeight: '700', color: '#C7C7CC', letterSpacing: 1.5 },
});
