import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { BASE_URL } from '@/constants/config';

type Notice = {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  published_at: string | null;
  created_at: string;
};

export default function NoticesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/admin/notices`)
      .then((r) => r.json())
      .then((data: Notice[]) => {
        const published = data.filter((n) => n.published_at);
        setNotices(published);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>공지사항</ThemedText>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : notices.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="megaphone-outline" size={48} color="#C7C7CC" />
          <ThemedText style={styles.emptyText}>등록된 공지사항이 없습니다</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notices.map((notice) => (
            <TouchableOpacity
              key={notice.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => setExpanded(expanded === notice.id ? null : notice.id)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  {notice.pinned && (
                    <View style={styles.pinBadge}>
                      <ThemedText style={styles.pinText}>필독</ThemedText>
                    </View>
                  )}
                  <ThemedText style={styles.cardTitle} numberOfLines={expanded === notice.id ? undefined : 2}>
                    {notice.title}
                  </ThemedText>
                </View>
                <Ionicons
                  name={expanded === notice.id ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#C7C7CC"
                />
              </View>
              <ThemedText style={styles.cardDate}>
                {notice.published_at
                  ? new Date(notice.published_at).toLocaleDateString('ko-KR')
                  : ''}
              </ThemedText>
              {expanded === notice.id && (
                <ThemedText style={styles.cardContent}>{notice.content}</ThemedText>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },

  list: { padding: 20, gap: 12 },

  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textMain, lineHeight: 22 },
  cardDate: { fontSize: 12, color: COLORS.textSub },
  cardContent: { fontSize: 14, color: COLORS.textMain, lineHeight: 22, marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA' },

  pinBadge: { backgroundColor: COLORS.primary + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  pinText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#C7C7CC' },
});
