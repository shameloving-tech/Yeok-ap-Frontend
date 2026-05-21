import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';

const LIKED_REPORTS_KEY = 'liked_reports';

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

export default function ReportDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const inputRef = useRef<TextInput>(null);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    fetchReport();
    fetchComments();
    checkLiked();
  }, [id]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`${BASE_URL}/reports/${id}`);
      const data = await res.json();
      setReport(data);
      setLikesCount(data.likes_count || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`${BASE_URL}/reports/${id}/comments`);
      setComments(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const checkLiked = async () => {
    const raw = await AsyncStorage.getItem(LIKED_REPORTS_KEY);
    if (raw) {
      const liked: number[] = JSON.parse(raw);
      setIsLiked(liked.includes(Number(id)));
    }
  };

  const handleLike = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;

    // 즉시 UI 반영
    setIsLiked(!isLiked);
    setLikesCount(prev => prev + (isLiked ? -1 : 1));

    try {
      const res = await fetch(`${BASE_URL}/reports/${id}/like`, {
        method: isLiked ? 'DELETE' : 'POST',
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      const raw = await AsyncStorage.getItem(LIKED_REPORTS_KEY);
      const liked: number[] = raw ? JSON.parse(raw) : [];
      const updated = prevLiked
        ? liked.filter(l => l !== Number(id))
        : [...liked, Number(id)];
      await AsyncStorage.setItem(LIKED_REPORTS_KEY, JSON.stringify(updated));
      setLikesCount(data.likes_count);
    } catch {
      // 실패 시 롤백
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      const nickname = (await AsyncStorage.getItem('user_nickname')) || '익명';
      const res = await fetch(`${BASE_URL}/reports/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: { content: commentText.trim(), nickname } }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, newComment]);
        setCommentText('');
        Keyboard.dismiss();
        if (report) setReport({ ...report, comments_count: (report.comments_count || 0) + 1 });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const [title, ...bodyLines] = (report?.content || '').split('\n');
  const body = bodyLines.join('\n');

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <ThemedText style={{ color: COLORS.textSub }}>게시글을 불러올 수 없습니다.</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>제보 상세</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <FlatList
          data={comments}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={
            <>
              {/* 게시글 본문 */}
              <View style={styles.postCard}>
                {/* 메타 */}
                <View style={styles.postMeta}>
                  <View style={[styles.lineCircle, { backgroundColor: getLineColor(report.line_name) }]}>
                    <ThemedText style={styles.lineCircleText}>{getLineNumber(report.line_name)}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={styles.stationText}>{report.station_name}</ThemedText>
                    <ThemedText style={styles.metaSub}>{report.line_name} · {report.direction} · {getTimeAgo(report.created_at)}</ThemedText>
                  </View>
                  <ThemedText style={styles.nicknameText}>{report.nickname || '익명'}</ThemedText>
                </View>

                {/* 제목 */}
                <ThemedText style={styles.postTitle}>{title}</ThemedText>

                {/* 본문 */}
                {body.trim() ? (
                  <ThemedText style={styles.postBody}>{body}</ThemedText>
                ) : null}

                {/* 이미지 */}
                {report.image_url ? (
                  <Image
                    source={{ uri: fixImageUrl(report.image_url) ?? undefined }}
                    style={styles.postImage}
                    contentFit="cover"
                  />
                ) : null}

                {/* 좋아요/댓글 */}
                <View style={styles.statsRow}>
                  <TouchableOpacity style={styles.statBtn} onPress={handleLike}>
                    <Ionicons
                      name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={18}
                      color={isLiked ? COLORS.primary : COLORS.textSub}
                    />
                    <ThemedText style={[styles.statText, isLiked && { color: COLORS.primary }]}>
                      {likesCount}
                    </ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statBtn} onPress={() => inputRef.current?.focus()}>
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.textSub} />
                    <ThemedText style={styles.statText}>{report.comments_count || comments.length}</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 댓글 헤더 */}
              <View style={styles.commentsHeader}>
                <ThemedText style={styles.commentsTitle}>댓글</ThemedText>
                {commentsLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
              </View>

              {!commentsLoading && comments.length === 0 && (
                <View style={styles.emptyComments}>
                  <Ionicons name="chatbubble-outline" size={32} color={COLORS.textSub} />
                  <ThemedText style={styles.emptyText}>첫 댓글을 남겨보세요!</ThemedText>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <View style={styles.commentItem}>
              <View style={styles.commentAvatar}>
                <ThemedText style={styles.commentAvatarText}>{item.nickname?.[0] || '익'}</ThemedText>
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

        {/* 댓글 입력 */}
        <View style={[styles.commentInputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            ref={inputRef}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  center: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },

  postCard: {
    backgroundColor: 'white', marginBottom: 8, padding: 20,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  postMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 },
  lineCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  lineCircleText: { color: 'white', fontSize: 14, fontWeight: '800', lineHeight: 16, includeFontPadding: false } as any,
  stationText: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  metaSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  nicknameText: { fontSize: 13, color: COLORS.textSub, fontWeight: '600' },

  postTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, marginBottom: 12 },
  postBody: { fontSize: 15, color: COLORS.textMain, lineHeight: 24, marginBottom: 16 },
  postImage: { width: '100%', height: 220, borderRadius: 16, marginBottom: 16 },

  statsRow: { flexDirection: 'row', gap: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F2F2F7' },
  statBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, color: COLORS.textSub, fontWeight: '600' },

  commentsHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  commentsTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },

  emptyComments: { alignItems: 'center', paddingVertical: 40, gap: 10, backgroundColor: 'white' },
  emptyText: { fontSize: 14, color: COLORS.textSub },

  commentItem: {
    flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  commentAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  commentTime: { fontSize: 11, color: COLORS.textSub },
  commentText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },

  commentInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: '#F2F2F7',
    backgroundColor: 'white',
  },
  commentInput: {
    flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: COLORS.textMain, marginRight: 10,
  },
  commentSendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
});
