import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS, SHADOW } from '@/constants/theme';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';
import { getDeviceToken, getOrCreateNickname } from '@/utils/deviceToken';
import { AdBanner } from '@/components/AdBanner';
import { useAds } from '@/hooks/useAds';

const { width } = Dimensions.get('window');

const SUBWAY_LINES = [
  '전체', '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선',
  '수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '우이신설선', '신림선',
  '김포골드라인', '경강선', '서해선', '인천1호선', '인천2호선', 'GTX-A',
];


const LIKED_REPORTS_KEY = 'liked_reports';
const REPORTS_CACHE_KEY = (line: string) => `reports_cache_${line}`;

const hotScore = (r: any): number => {
  const ageH = Math.max((Date.now() - new Date(r.created_at).getTime()) / 3_600_000, 0.01);
  return (r.likes_count * 3 + r.comments_count * 1.5 + 1) / Math.pow(ageH + 2, 1.5);
};

const getTimeAgo = (createdAt: string): string => {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
};

const fixImageUrl = (url: string): string | null => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const feedAd = useAds('feed_between');
  const [selectedLine, setSelectedLine] = useState('전체');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 제보 작성
  const [station, setStation] = useState('');
  const [postLine, setPostLine] = useState('');
  const [direction, setDirection] = useState('');
  const [content, setContent] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stationSuggestions, setStationSuggestions] = useState<Array<{ station_name: string; line: string }>>([]);
  const [stationSearching, setStationSearching] = useState(false);
  const [neighborStations, setNeighborStations] = useState<{ prev: string | null; next: string | null }>({ prev: null, next: null });
  const [neighborLoading, setNeighborLoading] = useState(false);
  const stationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 좋아요
  const [likedReports, setLikedReports] = useState<Set<number>>(new Set());

  // 댓글
  const [commentsReportId, setCommentsReportId] = useState<number | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    loadReports();
    loadLikedReports();
  }, [selectedLine]);

  const loadLikedReports = async () => {
    const raw = await AsyncStorage.getItem(LIKED_REPORTS_KEY);
    if (raw) setLikedReports(new Set(JSON.parse(raw)));
  };

  const loadReports = async () => {
    setLoading(true);
    const cached = await AsyncStorage.getItem(REPORTS_CACHE_KEY(selectedLine));
    if (cached) {
      setReports(JSON.parse(cached));
      setLoading(false);
    }
    await fetchReports();
  };

  const fetchReports = async () => {
    try {
      const lineParam = selectedLine === '전체' ? '' : selectedLine;
      const url = `${BASE_URL}/reports?line_name=${encodeURIComponent(lineParam)}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('서버 응답 오류');
      const data = await response.json();
      setReports(data);
      await AsyncStorage.setItem(REPORTS_CACHE_KEY(selectedLine), JSON.stringify(data));
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ─── 좋아요 ──────────────────────────────────────────────────
  const handleLike = async (reportId: number) => {
    const isLiked = likedReports.has(reportId);
    const updatedSet = new Set(likedReports);
    isLiked ? updatedSet.delete(reportId) : updatedSet.add(reportId);
    setLikedReports(updatedSet);
    setReports(prev => prev.map(r =>
      r.id === reportId ? { ...r, likes_count: (r.likes_count || 0) + (isLiked ? -1 : 1) } : r
    ));
    try {
      const res = await fetch(`${BASE_URL}/reports/${reportId}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      await AsyncStorage.setItem(LIKED_REPORTS_KEY, JSON.stringify([...updatedSet]));
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, likes_count: data.likes_count } : r
      ));
    } catch {
      setLikedReports(likedReports);
      setReports(prev => prev.map(r =>
        r.id === reportId ? { ...r, likes_count: (r.likes_count || 0) + (isLiked ? 1 : -1) } : r
      ));
    }
  };

  // ─── 댓글 ────────────────────────────────────────────────────
  const openComments = async (reportId: number) => {
    setCommentsReportId(reportId);
    setCommentsLoading(true);
    setComments([]);
    try {
      const res = await fetch(`${BASE_URL}/reports/${reportId}/comments`);
      setComments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const closeComments = () => {
    setCommentsReportId(null);
    setComments([]);
    setCommentText('');
  };

  const submitComment = async () => {
    if (!commentText.trim() || commentsReportId === null) return;
    setCommentSubmitting(true);
    try {
      const nickname = await getOrCreateNickname();
      const token = await getDeviceToken();
      const res = await fetch(`${BASE_URL}/reports/${commentsReportId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: { content: commentText.trim(), nickname, device_token: token } }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, newComment]);
        setCommentText('');
        setReports(prev =>
          prev.map(r =>
            r.id === commentsReportId ? { ...r, comments_count: (r.comments_count || 0) + 1 } : r
          )
        );
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  // ─── 역 자동완성 ─────────────────────────────────────────────
  const onStationChange = (text: string) => {
    setStation(text);
    if (stationDebounceRef.current) clearTimeout(stationDebounceRef.current);
    if (!text.trim()) { setStationSuggestions([]); return; }
    stationDebounceRef.current = setTimeout(async () => {
      setStationSearching(true);
      try {
        const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        setStationSuggestions(Array.isArray(data) ? data.slice(0, 5) : []);
      } catch {}
      finally { setStationSearching(false); }
    }, 300);
  };

  const fetchNeighborStations = async (stationName: string, line: string) => {
    setNeighborLoading(true);
    setNeighborStations({ prev: null, next: null });
    try {
      const res = await fetch(`${BASE_URL}/api/v1/stations/line_map?line=${encodeURIComponent(line)}`);
      const data: Array<{ station_name: string; order: number }> = await res.json();
      const idx = data.findIndex(s => s.station_name === stationName);
      if (idx === -1) return;
      setNeighborStations({
        prev: idx > 0 ? data[idx - 1].station_name : null,
        next: idx < data.length - 1 ? data[idx + 1].station_name : null,
      });
    } catch {}
    finally { setNeighborLoading(false); }
  };

  const selectStation = (s: { station_name: string; line: string }) => {
    setStation(s.station_name);
    if (s.line !== postLine) setDirection('');
    setPostLine(s.line);
    setStationSuggestions([]);
    fetchNeighborStations(s.station_name, s.line);
  };

  // ─── 제보 작성 ───────────────────────────────────────────────
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const submitReport = async () => {
    if (!station.trim() || !content.trim() || !postLine || !reportStatus) {
      Toast.show({ type: 'error', text1: '알림', text2: '혼잡도, 호선, 역 이름, 내용을 모두 입력해주세요!' });
      return;
    }
    setSubmitting(true);
    try {
      const formattedStation = station.trim().endsWith('역') ? station.trim() : `${station.trim()}역`;
      const formData = new FormData();
      formData.append('report[line_name]', postLine);
      formData.append('report[station_name]', formattedStation);
      formData.append('report[direction]', direction.trim() || '전체 방면');
      formData.append('report[content]', content);
      formData.append('report[status]', reportStatus);
      const nickname = await getOrCreateNickname();
      const token = await getDeviceToken();
      formData.append('report[nickname]', nickname);
      formData.append('report[device_token]', token);
      if (image) {
        const filename = image.split('/').pop() || 'image.jpg';
        const ext = filename.split('.').pop()?.toLowerCase() ?? '';
        const mimeMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp' };
        const mimeType = mimeMap[ext] ?? 'image/jpeg';
        formData.append('report[image]', { uri: image, name: filename, type: mimeType } as any);
      }
      const response = await fetch(`${BASE_URL}/reports`, { method: 'POST', body: formData });
      if (response.ok) {
        const result = await response.json();
        if (result.id) {
          const raw = await AsyncStorage.getItem('my_report_ids');
          const ids: number[] = raw ? JSON.parse(raw) : [];
          ids.push(result.id);
          await AsyncStorage.setItem('my_report_ids', JSON.stringify(ids));
        }
        setIsPostModalOpen(false);
        setImage(null); setContent(''); setStation(''); setDirection(''); setPostLine(''); setReportStatus(null); setStationSuggestions([]); setNeighborStations({ prev: null, next: null });
        await AsyncStorage.removeItem(REPORTS_CACHE_KEY(selectedLine));
        await AsyncStorage.removeItem(REPORTS_CACHE_KEY('전체'));
        fetchReports();
        Toast.show({ type: 'success', text1: '제보 완료', text2: '제보가 등록되었습니다!' });
      } else {
        const err = await response.json();
        Toast.show({ type: 'error', text1: '등록 실패', text2: err.errors?.join(', ') || '오류가 발생했습니다' });
      }
    } catch (e) {
      console.error(e);
      Toast.show({ type: 'error', text1: '오류', text2: '네트워크 오류가 발생했습니다.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── 렌더 헬퍼 ───────────────────────────────────────────────
  const renderFeedCard = ({ item, index }: { item: any; index: number }) => {
    const isLiked = likedReports.has(item.id);
    const statusColor: Record<string, string> = { '폭발': '#FF3B30', '혼잡': '#FF9500', '보통': '#FFCC00', '여유': '#34C759' };
    const sc = item.status ? statusColor[item.status] : null;
    return (
      <>
        {feedAd && index === 4 && <AdBanner ad={feedAd} />}
        <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/report/${item.id}`)} style={styles.feedCard}>
        <View style={styles.feedTopRow}>
          <View style={[styles.circleLineIcon, { backgroundColor: getLineColor(item.line_name) }]}>
            <ThemedText style={styles.circleLineText}>{getLineNumber(item.line_name)}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.feedMeta}>{item.station_name} · {item.line_name}</ThemedText>
            <ThemedText style={styles.feedMetaSub}>{getTimeAgo(item.created_at)} · {item.nickname || '익명'}</ThemedText>
          </View>
          {sc && (
            <View style={[styles.statusChip, { backgroundColor: sc + '1A', borderColor: sc + '55' }]}>
              <View style={[styles.statusDot, { backgroundColor: sc }]} />
              <ThemedText style={[styles.statusChipText, { color: sc }]}>{item.status}</ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={styles.feedTitle} numberOfLines={1}>{item.content.split('\n')[0]}</ThemedText>
        {item.content.includes('\n') && (
          <ThemedText style={styles.feedBody} numberOfLines={2}>{item.content.split('\n').slice(1).join('\n')}</ThemedText>
        )}
        {item.image_url ? (
          <Image
            source={{ uri: fixImageUrl(item.image_url) ?? undefined }}
            style={styles.feedImage}
            contentFit="cover"
          />
        ) : null}
        <View style={styles.feedStats}>
          <TouchableOpacity style={styles.statBtn} onPress={(e) => { e.stopPropagation(); handleLike(item.id); }}>
            <Ionicons
              name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
              size={15}
              color={isLiked ? COLORS.primary : COLORS.textSub}
            />
            <ThemedText style={[styles.statText, isLiked && styles.statTextActive]}>
              {item.likes_count || 0}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.statBtn} onPress={() => router.push(`/report/${item.id}`)}>
            <Ionicons name="chatbubble-outline" size={15} color={COLORS.textSub} />
            <ThemedText style={styles.statText}>{item.comments_count || 0}</ThemedText>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
      </>
    );
  };

  const renderPopularPosts = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>실시간 인기 글</ThemedText>
        <TouchableOpacity onPress={() => router.push('/best-posts')}>
          <ThemedText style={styles.viewAll}>전체보기</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity
            style={[styles.filterChip, selectedLine === '전체' && styles.activeFilterChip]}
            onPress={() => setSelectedLine('전체')}
          >
            <ThemedText style={[styles.filterText, selectedLine === '전체' && styles.activeFilterText]}>전체</ThemedText>
          </TouchableOpacity>
          <View style={styles.filterSeparator} />
          {SUBWAY_LINES.filter(l => l !== '전체').map(line => (
            <TouchableOpacity
              key={line}
              style={[styles.filterChip, selectedLine === line && styles.activeFilterChip]}
              onPress={() => setSelectedLine(line)}
            >
              <View style={[styles.chipDot, { backgroundColor: getLineColor(line) }]} />
              <ThemedText style={[styles.filterText, selectedLine === line && styles.activeFilterText]}>{line}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}><ActivityIndicator color={COLORS.primary} /></View>
      ) : (
        {(() => {
          const popularItems = [...reports]
            .filter(r => r.likes_count >= 1 || r.comments_count >= 2)
            .sort((a, b) => hotScore(b) - hotScore(a))
            .slice(0, 5);

          if (popularItems.length === 0) {
            return (
              <View style={styles.popularEmpty}>
                <Ionicons name="flame-outline" size={32} color={COLORS.textSub} />
                <ThemedText style={styles.popularEmptyText}>아직 인기 글이 없어요</ThemedText>
                <ThemedText style={styles.popularEmptySubText}>좋아요를 받은 글이 여기에 나타나요</ThemedText>
              </View>
            );
          }

          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
              {popularItems.map((item: any) => {
                const isLiked = likedReports.has(item.id);
                return (
                  <TouchableOpacity key={item.id} activeOpacity={0.85} onPress={() => router.push(`/report/${item.id}`)} style={styles.popularCard}>
                    <View style={styles.cardHeaderRow}>
                      <View style={styles.hotBadge}><ThemedText style={styles.hotText}>HOT</ThemedText></View>
                      <View style={[styles.circleLineIconSmall, { backgroundColor: getLineColor(item.line_name) }]}>
                        <ThemedText style={styles.circleLineTextSmall}>{getLineNumber(item.line_name)}</ThemedText>
                      </View>
                      <ThemedText style={styles.cardMeta}>{item.station_name} · {getTimeAgo(item.created_at)} · {item.nickname || '익명'}</ThemedText>
                    </View>
                    <ThemedText style={styles.popularCardTitle} numberOfLines={1}>{item.content.split('\n')[0]}</ThemedText>
                    <ThemedText style={styles.popularCardBody} numberOfLines={2}>{item.content}</ThemedText>
                    <View style={styles.cardStats}>
                      <TouchableOpacity style={styles.statBtn} onPress={(e) => { e.stopPropagation(); handleLike(item.id); }}>
                        <Ionicons
                          name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                          size={14}
                          color={isLiked ? COLORS.primary : COLORS.textSub}
                        />
                        <ThemedText style={[styles.statText, isLiked && styles.statTextActive]}>
                          {item.likes_count || 0}
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.statBtn} onPress={() => router.push(`/report/${item.id}`)}>
                        <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSub} />
                        <ThemedText style={styles.statText}>{item.comments_count || 0}</ThemedText>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          );
        })()}
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Image
          source={require('@/assets/images/character_design.svg')}
          style={{ width: 36, height: 36 }}
          contentFit="contain"
        />
        <ThemedText style={styles.headerTitle}>커뮤니티</ThemedText>
        <TouchableOpacity style={styles.headerSearch}>
          <Ionicons name="search" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>

      {/* 피드 */}
      <FlatList
        data={reports}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />}
        ListHeaderComponent={
          <>
            {renderPopularPosts()}
            <View style={styles.newPostsHeader}>
              <ThemedText style={styles.sectionTitle}>신규 글</ThemedText>
              <View style={styles.sortOptions}>
                <ThemedText style={styles.sortActive}>최신순</ThemedText>
                <ThemedText style={styles.sortDivider}>|</ThemedText>
                <ThemedText style={styles.sortInactive}>거리순</ThemedText>
              </View>
            </View>
          </>
        }
        renderItem={renderFeedCard}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      />

      {/* 제보 FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: 16 + insets.bottom }]}
        onPress={() => setIsPostModalOpen(true)}
      >
        <Ionicons name="pencil" size={24} color="white" />
      </TouchableOpacity>

      {/* ── 제보 작성 모달 — Modal 사용으로 Android 뒤로가기 처리 ── */}
      <Modal
        visible={isPostModalOpen}
        animationType="slide"
        onRequestClose={() => setIsPostModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8F9FB' }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsPostModalOpen(false)} style={styles.modalHeaderBtn}>
                <Ionicons name="close" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>제보하기</ThemedText>
              <View style={styles.modalHeaderBtn} />
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* 혼잡도 선택 */}
              <ThemedText style={styles.formSectionLabel}>지금 혼잡도 <ThemedText style={styles.formRequired}>*</ThemedText></ThemedText>
              <View style={styles.statusRow}>
                {(['여유', '보통', '혼잡', '폭발'] as const).map((s) => {
                  const COLOR: Record<string, string> = { '여유': '#34C759', '보통': '#FFCC00', '혼잡': '#FF9500', '폭발': '#FF3B30' };
                  const selected = reportStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => setReportStatus(s)}
                      style={[styles.statusSelectChip, { borderColor: COLOR[s] }, selected && { backgroundColor: COLOR[s] }]}
                    >
                      <View style={[styles.statusSelectDot, { backgroundColor: selected ? 'white' : COLOR[s] }]} />
                      <ThemedText style={[styles.statusSelectText, selected && { color: 'white', fontWeight: '700' }]}>{s}</ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 내용 */}
              <ThemedText style={[styles.formSectionLabel, { marginTop: 16 }]}>제보 내용 <ThemedText style={styles.formRequired}>*</ThemedText></ThemedText>
              <TextInput
                style={styles.contentInput}
                placeholder={"무슨 일이 있나요?\n(예: 3번 출구 에스컬레이터 고장, 열차 지연 등)"}
                placeholderTextColor={COLORS.textSub}
                multiline
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
                autoFocus
              />

              {/* 역 정보 */}
              <ThemedText style={[styles.formSectionLabel, { marginTop: 16 }]}>역 정보 <ThemedText style={styles.formRequired}>*</ThemedText></ThemedText>

              {/* 역 이름 입력 + 자동완성 */}
              <View style={styles.stationInputWrap}>
                <View style={styles.stationInputRow}>
                  <View style={[styles.lineCircleMd, { backgroundColor: postLine ? getLineColor(postLine) : '#C7C7CC' }]}>
                    <ThemedText style={styles.lineCircleMdText}>
                      {postLine ? (postLine.match(/(\d+)/)?.[1] || postLine.slice(0, 2)) : '?'}
                    </ThemedText>
                  </View>
                  <TextInput
                    style={styles.stationNameInput}
                    placeholder="역 이름 검색"
                    placeholderTextColor={COLORS.textSub}
                    value={station}
                    onChangeText={onStationChange}
                  />
                  {stationSearching && <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 12 }} />}
                </View>
                {stationSuggestions.length > 0 && (
                  <View style={styles.suggestionList}>
                    {stationSuggestions.map((s, i) => (
                      <TouchableOpacity
                        key={`${s.station_name}-${s.line}-${i}`}
                        style={[styles.suggestionItem, i < stationSuggestions.length - 1 && styles.suggestionDivider]}
                        onPress={() => selectStation(s)}
                      >
                        <View style={[styles.suggestionDot, { backgroundColor: getLineColor(s.line) }]} />
                        <ThemedText style={styles.suggestionText}>{s.station_name}</ThemedText>
                        <ThemedText style={styles.suggestionLine}>{s.line}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* 방면 선택 — 역 선택 후 인접역 기반으로 노출 */}
              {postLine && (neighborLoading || neighborStations.prev || neighborStations.next) && (
                <View style={styles.directionRow}>
                  {neighborLoading ? (
                    <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
                  ) : (
                    [neighborStations.prev, neighborStations.next].filter(Boolean).map((d) => {
                      const label = `${d!.replace(/역$/, '')} 방면`;
                      const selected = direction === label;
                      return (
                        <TouchableOpacity
                          key={d}
                          onPress={() => setDirection(selected ? '' : label)}
                          style={[
                            styles.directionChip,
                            selected && { backgroundColor: getLineColor(postLine), borderColor: getLineColor(postLine) },
                          ]}
                        >
                          <ThemedText style={[styles.directionChipText, selected && { color: 'white', fontWeight: '700' }]}>
                            {label}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}

              {/* 사진 */}
              <View style={[styles.photoRow, { marginTop: 16 }]}>
                <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={26} color={COLORS.textSub} />
                  <ThemedText style={styles.photoAddText}>사진 추가</ThemedText>
                </TouchableOpacity>
                {image && (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: image }} style={styles.photoPreview} contentFit="cover" />
                    <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => setImage(null)}>
                      <Ionicons name="close" size={12} color="white" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={styles.noticeBanner}>
                <Ionicons name="information-circle-outline" size={16} color={COLORS.textSub} style={{ marginRight: 8, flexShrink: 0 }} />
                <ThemedText style={styles.noticeText}>불법적인 내용이나 타인에게 불쾌감을 주는 게시글은 삭제될 수 있습니다.</ThemedText>
              </View>

              <TouchableOpacity
                style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={submitReport}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="white" style={{ marginRight: 8 }} />
                    <ThemedText style={styles.submitBtnText}>제보하기</ThemedText>
                  </>
                )}
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
      </Modal>

      {/* ── 댓글 바텀시트 ── */}
      <Modal
        visible={commentsReportId !== null}
        transparent
        animationType="slide"
        onRequestClose={closeComments}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeComments} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.commentsSheet}
        >
          <View style={styles.commentsHandle} />
          <View style={styles.commentsSheetHeader}>
            <ThemedText style={styles.commentsSheetTitle}>댓글</ThemedText>
            <TouchableOpacity onPress={closeComments}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          {commentsLoading ? (
            <View style={styles.commentsLoadingContainer}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item) => item.id.toString()}
              style={styles.commentsList}
              ListEmptyComponent={
                <View style={styles.noComments}>
                  <Ionicons name="chatbubble-outline" size={36} color={COLORS.textSub} />
                  <ThemedText style={styles.noCommentsText}>첫 댓글을 남겨보세요!</ThemedText>
                </View>
              }
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View style={styles.commentAvatar}>
                    <ThemedText style={styles.commentAvatarText}>
                      {item.nickname?.[0] || '익'}
                    </ThemedText>
                  </View>
                  <View style={styles.commentContent}>
                    <View style={styles.commentMeta}>
                      <ThemedText style={styles.commentNickname}>{item.nickname || '익명'}</ThemedText>
                      <ThemedText style={styles.commentTime}>{getTimeAgo(item.created_at)}</ThemedText>
                    </View>
                    <ThemedText style={styles.commentText}>{item.content}</ThemedText>
                  </View>
                </View>
              )}
            />
          )}

          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="댓글을 입력하세요..."
              placeholderTextColor={COLORS.textSub}
              value={commentText}
              onChangeText={setCommentText}
              returnKeyType="send"
              onSubmitEditing={submitComment}
            />
            <TouchableOpacity
              onPress={submitComment}
              style={styles.commentSendBtn}
              disabled={!commentText.trim() || commentSubmitting}
            >
              {commentSubmitting
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Ionicons name="send" size={20} color={commentText.trim() ? COLORS.primary : COLORS.textSub} />
              }
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { padding: 20, alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  headerSearch: { padding: 4 },

  sectionContainer: { marginTop: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  viewAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  filterWrapper: { marginBottom: 14 },
  filterScroll: { paddingHorizontal: 20, alignItems: 'center', gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: COLORS.divider },
  activeFilterChip: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  activeFilterText: { color: 'white' },
  filterSeparator: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: COLORS.border, marginHorizontal: 4 },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },

  popularEmpty: { alignItems: 'center', paddingVertical: 28, gap: 6, marginHorizontal: 20 },
  popularEmptyText: { fontSize: 14, fontWeight: '700', color: COLORS.textSub },
  popularEmptySubText: { fontSize: 12, color: COLORS.textSub },
  popularScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 10 },
  popularCard: { width: width * 0.72, backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, ...SHADOW.sm },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  hotBadge: { backgroundColor: COLORS.danger + '15', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginRight: 8 },
  hotText: { color: COLORS.danger, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  circleLineIconSmall: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  circleLineTextSmall: { color: 'white', fontSize: 10, fontWeight: '700', lineHeight: 12, includeFontPadding: false } as any,
  cardMeta: { fontSize: 12, color: COLORS.textSub, fontWeight: '400', flex: 1 },
  popularCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  popularCardBody: { fontSize: 13, color: COLORS.textSub, lineHeight: 18, marginBottom: 14 },
  cardStats: { flexDirection: 'row', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.divider, paddingTop: 12 },

  newPostsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 14 },
  sortOptions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortActive: { fontSize: 13, color: COLORS.textMain, fontWeight: '700' },
  sortInactive: { fontSize: 13, color: COLORS.textSub, fontWeight: '400' },
  sortDivider: { fontSize: 12, color: COLORS.border },
  feedCard: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider, backgroundColor: 'white' },
  feedTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  circleLineIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  circleLineText: { color: 'white', fontSize: 11, fontWeight: '700' },
  feedMeta: { fontSize: 14, color: COLORS.textMain, fontWeight: '600' },
  feedMetaSub: { fontSize: 12, color: COLORS.textSub, fontWeight: '400', marginTop: 1 },
  feedNickname: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  tagBadge: { backgroundColor: COLORS.divider, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontWeight: '600' },
  feedTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  feedBody: { fontSize: 14, color: COLORS.textSub, lineHeight: 20, marginBottom: 10 },
  feedImage: { width: '100%', height: 200, borderRadius: 14, marginBottom: 10 },
  feedStats: { flexDirection: 'row', gap: 16 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  statTextActive: { color: COLORS.primary },

  fab: { position: 'absolute', bottom: 16, right: 20, width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', ...SHADOW.lg },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.background, zIndex: 1000 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'white', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  modalHeaderBtn: { width: 40, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  modalBody: { flex: 1, padding: 20 },

  formSectionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 8, marginTop: 4 },
  formSectionSub: { fontSize: 13, color: COLORS.textSub, marginBottom: 12 },
  formRequired: { color: COLORS.danger, fontSize: 14 },

  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  statusSelectChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
    backgroundColor: 'white', gap: 5,
  },
  statusSelectDot: { width: 7, height: 7, borderRadius: 4 },
  statusSelectText: { fontSize: 13, fontWeight: '500', color: COLORS.textMain },

  stationInputWrap: {
    backgroundColor: 'white', borderRadius: 12, marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  stationInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4 },
  lineCircleMd: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  lineCircleMdText: { color: 'white', fontSize: 13, fontWeight: '700' },
  stationNameInput: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textMain, paddingVertical: 10 },

  suggestionList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  suggestionDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  suggestionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  suggestionText: { flex: 1, fontSize: 14, color: COLORS.textMain, fontWeight: '500' },
  suggestionLine: { fontSize: 12, color: COLORS.textSub },

  directionRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  directionChip: {
    flex: 1, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: 'white', alignItems: 'center',
  },
  directionChipText: { fontSize: 13, color: COLORS.textMain },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.divider, borderRadius: 12, padding: 12, marginBottom: 20,
  },
  noticeText: { flex: 1, fontSize: 12, color: COLORS.textSub, lineHeight: 17 },

  contentInput: {
    backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: COLORS.textMain, height: 130, marginBottom: 0,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, lineHeight: 22,
  },

  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoAddBtn: {
    width: 72, height: 72, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white',
  },
  photoAddText: { fontSize: 11, color: COLORS.textSub, marginTop: 2, fontWeight: '500' },
  photoPreviewWrap: { width: 72, height: 72, borderRadius: 12, overflow: 'visible' },
  photoPreview: { width: 72, height: 72, borderRadius: 12 },
  photoRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: COLORS.textMain, justifyContent: 'center', alignItems: 'center',
  },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 999, paddingVertical: 16,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { fontSize: 16, fontWeight: '700', color: 'white' },

  modalBackdrop: { flex: 1, backgroundColor: COLORS.overlay },
  commentsSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  commentsHandle: { width: 36, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  commentsSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  commentsSheetTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  commentsLoadingContainer: { padding: 40, alignItems: 'center' },
  commentsList: { flexGrow: 0, maxHeight: 340 },
  noComments: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  noCommentsText: { fontSize: 14, color: COLORS.textSub },
  commentItem: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  commentAvatarText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentNickname: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  commentTime: { fontSize: 11, color: COLORS.textSub },
  commentText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  commentInput: { flex: 1, backgroundColor: COLORS.divider, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, marginRight: 10 },
  commentSendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
