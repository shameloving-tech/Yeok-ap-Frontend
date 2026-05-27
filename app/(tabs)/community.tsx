import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
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
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';
import { getDeviceToken, getOrCreateNickname } from '@/utils/deviceToken';

const { width } = Dimensions.get('window');

const SUBWAY_LINES = [
  '전체', '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선',
  '수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '우이신설선', '신림선',
  '김포골드라인', '경강선', '서해선', '인천1호선', '인천2호선', 'GTX-A',
];

const LIKED_REPORTS_KEY = 'liked_reports';
const REPORTS_CACHE_KEY = (line: string) => `reports_cache_${line}`;

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
  const [selectedLine, setSelectedLine] = useState('전체');
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 제보 작성
  const [station, setStation] = useState('');
  const [postLine, setPostLine] = useState('');
  const [direction, setDirection] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!station || !content || !direction || !postLine) {
      Toast.show({ type: 'error', text1: '알림', text2: '호선을 포함해 모든 항목을 입력해주세요!' });
      return;
    }
    setSubmitting(true);
    try {
      const formattedStation = station.trim().endsWith('역') ? station.trim() : `${station.trim()}역`;
      const fullContent = title.trim() ? `${title.trim()}\n${content}` : content;
      const formData = new FormData();
      formData.append('report[line_name]', postLine);
      formData.append('report[station_name]', formattedStation);
      formData.append('report[direction]', direction);
      formData.append('report[content]', fullContent);
      formData.append('report[status]', '혼잡');
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
        setImage(null); setTitle(''); setContent(''); setStation(''); setDirection(''); setPostLine('');
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
  const renderFeedCard = ({ item }: { item: any }) => {
    const isLiked = likedReports.has(item.id);
    const statusColor: Record<string, string> = { '폭발': '#FF3B30', '혼잡': '#FF9500', '보통': '#FFCC00', '여유': '#34C759' };
    const sc = item.status ? statusColor[item.status] : null;
    return (
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
          {[...reports].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 3).map((item: any) => {
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
              <ThemedText style={styles.formSectionLabel}>현재 역</ThemedText>
              <View style={styles.stationCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lineScrollRow}>
                  <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 2 }}>
                    {SUBWAY_LINES.filter(l => l !== '전체').map(line => (
                      <TouchableOpacity
                        key={line}
                        onPress={() => setPostLine(line)}
                        style={[styles.lineChip, postLine === line && { backgroundColor: getLineColor(line), borderColor: getLineColor(line) }]}
                      >
                        <ThemedText style={[styles.lineChipText, postLine === line && { color: 'white' }]}>{line}</ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>

                <View style={styles.stationInputRow}>
                  <View style={[styles.lineCircleMd, { backgroundColor: postLine ? getLineColor(postLine) : '#C7C7CC' }]}>
                    <ThemedText style={styles.lineCircleMdText}>
                      {postLine ? (postLine.match(/(\d+)/)?.[1] || postLine.slice(0, 2)) : '?'}
                    </ThemedText>
                  </View>
                  <View style={styles.stationTextInputs}>
                    <TextInput
                      style={styles.stationNameInput}
                      placeholder="역 이름"
                      placeholderTextColor={COLORS.textSub}
                      value={station}
                      onChangeText={setStation}
                    />
                    <View style={styles.inputDivider} />
                    <TextInput
                      style={styles.directionInput}
                      placeholder="방면 (예: 교대)"
                      placeholderTextColor={COLORS.textSub}
                      value={direction}
                      onChangeText={setDirection}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.noticeBanner}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.textSub} style={{ marginRight: 8, flexShrink: 0 }} />
                <ThemedText style={styles.noticeText}>불법적인 내용이나 타인에게 불쾌감을 주는 게시글은 삭제될 수 있습니다.</ThemedText>
              </View>

              <ThemedText style={styles.formSectionLabel}>제보 내용</ThemedText>
              <ThemedText style={styles.formSectionSub}>현재 역 주변의 불편사항이나 실시간 정보를 공유해 주세요.</ThemedText>

              <TextInput
                style={styles.titleInput}
                placeholder="제목을 입력해 주세요."
                placeholderTextColor={COLORS.textSub}
                value={title}
                onChangeText={setTitle}
              />
              <TextInput
                style={styles.contentInput}
                placeholder={"제보 내용을 입력해 주세요.\n(예: 3번 출구 에스컬레이터 고장, 열차 지연 등)"}
                placeholderTextColor={COLORS.textSub}
                multiline
                textAlignVertical="top"
                value={content}
                onChangeText={setContent}
              />

              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoAddBtn} onPress={pickImage}>
                  <Ionicons name="image-outline" size={26} color={COLORS.textSub} />
                  <ThemedText style={styles.photoAddText}>1/1</ThemedText>
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
  container: { flex: 1, backgroundColor: 'white' },
  loadingContainer: { padding: 20, alignItems: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.primary },
  headerSearch: { padding: 4 },

  sectionContainer: { marginTop: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  viewAll: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },

  filterWrapper: { marginBottom: 15 },
  filterScroll: { paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.border },
  activeFilterChip: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  activeFilterText: { color: 'white' },
  filterSeparator: { width: 1, height: 16, backgroundColor: '#E5E5EA', marginHorizontal: 5 },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },

  popularScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 10 },
  popularCard: { width: width * 0.72, backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hotBadge: { backgroundColor: '#FF52521A', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#FF525244' },
  hotText: { color: '#FF3B30', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  circleLineIconSmall: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  circleLineTextSmall: { color: 'white', fontSize: 10, fontWeight: '800', lineHeight: 12, includeFontPadding: false } as any,
  cardMeta: { fontSize: 12, color: COLORS.textSub, fontWeight: '500', flex: 1 },
  popularCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  popularCardBody: { fontSize: 13, color: COLORS.textSub, lineHeight: 18, marginBottom: 15 },
  cardStats: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },

  newPostsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 15 },
  sortOptions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortActive: { fontSize: 13, color: COLORS.textMain, fontWeight: '800' },
  sortInactive: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  sortDivider: { fontSize: 12, color: '#E5E5EA' },
  feedCard: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  feedTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  circleLineIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  circleLineText: { color: 'white', fontSize: 12, fontWeight: '800' },
  feedMeta: { fontSize: 14, color: COLORS.textMain, fontWeight: '600' },
  feedMetaSub: { fontSize: 12, color: COLORS.textSub, fontWeight: '400', marginTop: 1 },
  feedNickname: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  tagBadge: { backgroundColor: COLORS.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: COLORS.textSub, fontWeight: '700' },
  statusChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  feedTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  feedBody: { fontSize: 14, color: COLORS.textSub, lineHeight: 20, marginBottom: 12 },
  feedImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 12 },
  feedStats: { flexDirection: 'row', gap: 16 },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },
  statTextActive: { color: COLORS.primary },

  fab: { position: 'absolute', bottom: 16, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: '#F8F9FB', zIndex: 1000 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modalHeaderBtn: { width: 40, alignItems: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  modalBody: { flex: 1, padding: 20 },

  formSectionLabel: { fontSize: 16, fontWeight: '800', color: COLORS.textMain, marginBottom: 6, marginTop: 4 },
  formSectionSub: { fontSize: 13, color: COLORS.textSub, marginBottom: 12 },

  stationCard: {
    backgroundColor: 'white', borderRadius: 20, padding: 16,
    marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
  },
  lineScrollRow: { marginBottom: 14 },
  lineChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.border, backgroundColor: 'white' },
  lineChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSub },

  stationInputRow: { flexDirection: 'row', alignItems: 'center' },
  lineCircleMd: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  lineCircleMdText: { color: 'white', fontSize: 16, fontWeight: '800' },
  stationTextInputs: { flex: 1, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, overflow: 'hidden' },
  stationNameInput: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, paddingHorizontal: 14, paddingVertical: 10 },
  inputDivider: { height: 1, backgroundColor: COLORS.border },
  directionInput: { fontSize: 14, color: COLORS.textSub, paddingHorizontal: 14, paddingVertical: 10 },

  noticeBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: '#F2F2F7', borderRadius: 14, padding: 14, marginBottom: 20,
  },
  noticeText: { flex: 1, fontSize: 13, color: COLORS.textSub, lineHeight: 18 },

  titleInput: {
    backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: COLORS.textMain, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  contentInput: {
    backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 14, color: COLORS.textMain, height: 160, marginBottom: 16,
    borderWidth: 1.5, borderColor: COLORS.border, lineHeight: 22,
  },

  photoRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  photoAddBtn: {
    width: 72, height: 72, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white',
  },
  photoAddText: { fontSize: 11, color: COLORS.textSub, marginTop: 2, fontWeight: '600' },
  photoPreviewWrap: { width: 72, height: 72, borderRadius: 14, overflow: 'visible' },
  photoPreview: { width: 72, height: 72, borderRadius: 14 },
  photoRemoveBtn: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#333', justifyContent: 'center', alignItems: 'center',
  },

  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 18, paddingVertical: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
  },
  submitBtnText: { fontSize: 17, fontWeight: '800', color: 'white' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  commentsSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  commentsHandle: { width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  commentsSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  commentsSheetTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  commentsLoadingContainer: { padding: 40, alignItems: 'center' },
  commentsList: { flexGrow: 0, maxHeight: 340 },
  noComments: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  noCommentsText: { fontSize: 14, color: COLORS.textSub },
  commentItem: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  commentAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  commentTime: { fontSize: 11, color: COLORS.textSub },
  commentText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: COLORS.border },
  commentInput: { flex: 1, backgroundColor: COLORS.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, marginRight: 10 },
  commentSendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
