"use client";
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';

const STORAGE_KEY = 'notification_settings';

type NotifSettings = {
  departure: boolean;      // 출발 알림
  congestion: boolean;     // 혼잡도 경보
  comment: boolean;        // 댓글 알림
  notice: boolean;         // 공지사항 알림
};

const DEFAULTS: NotifSettings = {
  departure: true,
  congestion: true,
  comment: true,
  notice: false,
};

async function loadSettings(): Promise<NotifSettings> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
}

async function saveSettings(s: NotifSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export async function getNotifSetting(key: keyof NotifSettings): Promise<boolean> {
  const s = await loadSettings();
  return s[key];
}

type RowProps = {
  icon: string;
  iconColor: string;
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
  last?: boolean;
};

function NotifRow({ icon, iconColor, label, description, value, onToggle, last }: RowProps) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={[styles.iconBox, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
        <ThemedText style={styles.rowDesc}>{description}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E5EA', true: COLORS.primary + '80' }}
        thumbColor={value ? COLORS.primary : '#fff'}
        ios_backgroundColor="#E5E5EA"
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<NotifSettings>(DEFAULTS);
  const [permGranted, setPermGranted] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings().then(setSettings);
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermGranted(status === 'granted');
    });
  }, []);

  const toggle = async (key: keyof NotifSettings, value: boolean) => {
    if (value && !permGranted) {
      Alert.alert(
        '알림 권한 필요',
        '알림을 받으려면 기기 설정에서 역앞 앱의 알림을 허용해주세요.',
        [
          { text: '취소', style: 'cancel' },
          { text: '설정 열기', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await saveSettings(updated);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>알림 설정</ThemedText>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {permGranted === false && (
          <TouchableOpacity style={styles.permBanner} onPress={() => Linking.openSettings()}>
            <Ionicons name="warning-outline" size={16} color="#FF9500" />
            <ThemedText style={styles.permBannerText}>
              알림이 꺼져 있어요. 탭해서 기기 설정에서 허용해주세요.
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color="#FF9500" />
          </TouchableOpacity>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>경로 / 혼잡도</ThemedText>
          <View style={styles.card}>
            <NotifRow
              icon="navigate-outline"
              iconColor={COLORS.primary}
              label="출발 알림"
              description="경로 검색 후 설정한 시간에 출발 알림"
              value={settings.departure}
              onToggle={(v) => toggle('departure', v)}
            />
            <NotifRow
              icon="alert-circle-outline"
              iconColor="#FF3B30"
              label="혼잡도 경보"
              description="즐겨찾기 역이 혼잡·폭발 상태일 때 알림"
              value={settings.congestion}
              onToggle={(v) => toggle('congestion', v)}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>커뮤니티</ThemedText>
          <View style={styles.card}>
            <NotifRow
              icon="chatbubble-outline"
              iconColor="#34C759"
              label="댓글 알림"
              description="내 제보에 댓글이 달렸을 때 알림"
              value={settings.comment}
              onToggle={(v) => toggle('comment', v)}
              last
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>앱 소식</ThemedText>
          <View style={styles.card}>
            <NotifRow
              icon="megaphone-outline"
              iconColor={COLORS.accent}
              label="공지사항 알림"
              description="새로운 공지사항이 등록되면 알림"
              value={settings.notice}
              onToggle={(v) => toggle('notice', v)}
              last
            />
          </View>
        </View>

        <ThemedText style={styles.footer}>
          알림은 기기의 알림 허용 여부에 따라 달라질 수 있어요.
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },

  content: { padding: 20, gap: 0 },

  permBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF950015',
    borderRadius: 12, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#FF950030',
  },
  permBannerText: { flex: 1, fontSize: 13, color: '#FF9500', fontWeight: '500' },

  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: COLORS.textSub,
    marginBottom: 8, marginLeft: 4,
  },
  card: {
    backgroundColor: 'white', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E5EA' },
  iconBox: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: COLORS.textMain },
  rowDesc: { fontSize: 12, color: COLORS.textSub },

  footer: { fontSize: 12, color: COLORS.textSub, textAlign: 'center', marginTop: 8 },
});
