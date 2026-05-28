import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BASE_URL } from '@/constants/config';
import { getLineColor } from '@/constants/lines';
import { APP_COLORS as COLORS } from '@/constants/theme';

type SortType = 'hot' | 'comments' | 'line';

const LIKED_REPORTS_KEY = 'liked_reports';

const SORT_TABS: { key: SortType; label: string }[] = [
  { key: 'hot',      label: 'Hot 🔥' },
  { key: 'comments', label: '댓글 많은순 💬' },
  { key: 'line',     label: '호선별 🚇' },
];

const getTimeAgo = (createdAt: string): string => {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
};

export default function BestPostsScreen() {
  const insets = useSafeAreaInsets();
  const [sort, setSort] = useState<SortType>('hot');
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [likedReports, setLikedReports] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchReports();
    loadLiked();
  }, []);

  const loadLiked = async () => {
    const raw = await AsyncStorage.getItem(LIKED_REPORTS_KEY);
    if (raw) setLikedReports(new Set(JSON.parse(raw)));
  };

  const fetchReports = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setFetchError(false);
    try {
      const res = await fetch(`${BASE_URL}/reports`, { headers: { Accept: 'application/json' } });
      if (res.ok) setReports(await res.json());
      else setFetchError(true);
    } catch { setFetchError(true); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const sorted = useMemo(() => {
    const arr = [...reports];
    if (sort === 'hot')      return arr.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    if (sort === 'comments') return arr.sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0));
    return arr.sort((a, b) => a.line_name.localeCompare(b.line_name, 'ko'));
  }, [reports, sort]);

  const handleLike = async (reportId: number) => {
    const isLiked = likedReports.has(reportId);
    const next = new Set(likedReports);
    isLiked ? next.delete(reportId) : next.add(reportId);
    setLikedReports(next);
    setReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, likes_count: (r.likes_count || 0) + (isLiked ? -1 : 1) } : r
    ));
    try {
      const res = await fetch(`${BASE_URL}/reports/${reportId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem(LIKED_REPORTS_KEY, JSON.stringify([...next]));
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, likes_count: data.likes_count } : r));
      }
    } catch {
      // 롤백: 좋아요 상태 & 카운트 원복
      setLikedReports(likedReports);
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, likes_count: (r.likes_count || 0) + (isLiked ? 1 : -1) } : r
      ));
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const rank = index + 1;
    const isTop = rank === 1;
    const isLiked = likedReports.has(item.id);
    const lines = item.content?.split('\n') ?? [];
    const title = lines[0] || '';
    const body  = lines.slice(1).join(' ') || title;

    return (
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => router.push(`/report/${item.id}`)}
        style={[styles.card, isTop && styles.cardTop]}
      >
        {/* 좌측 강조바 (#1의 경우) */}
        {isTop && <View style={styles.topBar} />}

        {/* 순위 */}
        <View style={styles.rankCol}>
          <ThemedText style={[styles.rankNum, isTop && styles.rankNumTop]}>{rank}</ThemedText>
          <ThemedText style={[styles.rankChange, isTop && { color: '#FFB800' }]}>
            {isTop ? '△' : '−'}
          </ThemedText>
        </View>

        {/* 콘텐츠 */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            {/* 호선 배지 */}
            <View style={[styles.lineBadge, { backgroundColor: getLineColor(item.line_name) }]}>
              <ThemedText style={styles.lineBadgeText}>{item.line_name}</ThemedText>
            </View>
            <ThemedText style={styles.stationName}>{item.station_name}</ThemedText>
            <View style={{ flex: 1 }} />
            <ThemedText style={styles.time}>{getTimeAgo(item.created_at)}</ThemedText>
          </View>

          <ThemedText style={styles.postTitle} numberOfLines={1}>{title}</ThemedText>
          {body !== title && (
            <ThemedText style={styles.postBody} numberOfLines={2}>{body}</ThemedText>
          )}

          <View style={styles.stats}>
            <TouchableOpacity
              style={styles.statBtn}
              onPress={(e) => { e.stopPropagation(); handleLike(item.id); }}
            >
              <Ionicons
                name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={15}
                color={isLiked ? COLORS.primary : COLORS.textSub}
              />
              <ThemedText style={[styles.statText, isLiked && styles.statLiked]}>
                {item.likes_count || 0}
              </ThemedText>
            </TouchableOpacity>
            <View style={styles.statBtn}>
              <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSub} />
              <ThemedText style={styles.statText}>{item.comments_count || 0}</ThemedText>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>실시간 인기 글</ThemedText>
        <View style={styles.backBtn} />
      </View>

      {/* 정렬 탭 */}
      <View style={styles.tabRow}>
        {SORT_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, sort === tab.key && styles.tabActive]}
            onPress={() => setSort(tab.key)}
          >
            <ThemedText style={[styles.tabText, sort === tab.key && styles.tabTextActive]}>
              {tab.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : fetchError ? (
        <View style={styles.loading}>
          <Ionicons name="cloud-offline-outline" size={40} color={COLORS.textSub} />
          <ThemedText style={{ color: COLORS.textSub, fontSize: 14, marginTop: 12 }}>데이터를 불러올 수 없습니다</ThemedText>
          <TouchableOpacity onPress={() => fetchReports()} style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 14 }}>
            <ThemedText style={{ color: 'white', fontWeight: '700' }}>다시 시도</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 + insets.bottom, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReports(true)}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.loading}>
              <Ionicons name="document-text-outline" size={40} color={COLORS.textSub} />
              <ThemedText style={{ color: COLORS.textSub, fontSize: 14, marginTop: 12 }}>게시글이 없습니다</ThemedText>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: COLORS.textMain },

  tabRow: {
    flexDirection: 'row', gap: 8,
    backgroundColor: 'white',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tab: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  tabTextActive: { color: 'white' },

  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  cardTop: {
    borderWidth: 1.5, borderColor: '#FFB800',
  },
  topBar: { width: 4, backgroundColor: '#FFB800' },

  rankCol: {
    width: 48, alignItems: 'center',
    paddingTop: 18, gap: 2,
  },
  rankNum: { fontSize: 22, fontWeight: '900', color: COLORS.textSub },
  rankNumTop: { color: '#FFB800' },
  rankChange: { fontSize: 12, color: COLORS.border, fontWeight: '700' },

  content: { flex: 1, padding: 14, paddingLeft: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },

  lineBadge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 8,
  },
  lineBadgeText: { color: 'white', fontSize: 11, fontWeight: '800' },

  stationName: { fontSize: 12, fontWeight: '600', color: COLORS.textSub },
  time: { fontSize: 11, color: COLORS.textSub },

  postTitle: { fontSize: 15, fontWeight: '800', color: COLORS.textMain, marginBottom: 4 },
  postBody: { fontSize: 13, color: COLORS.textSub, lineHeight: 18, marginBottom: 10 },

  stats: { flexDirection: 'row', gap: 14 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  statLiked: { color: COLORS.primary },
});
