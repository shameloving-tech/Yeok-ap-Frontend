import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';
import { getDeviceToken, getOrCreateNickname } from '@/utils/deviceToken';

const LIKED_REPORTS_KEY = 'liked_reports';
const FLAGGED_REPORTS_KEY = 'flagged_reports';
const FLAGGED_COMMENTS_KEY = 'flagged_comments';

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

  const [myNickname, setMyNickname] = useState('');
  const [myDeviceToken, setMyDeviceToken] = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const [comments, setComments] = useState<any[]>([]);
  const [flaggedComments, setFlaggedComments] = useState<Set<number>>(new Set());
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // 메뉴
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [commentMenu, setCommentMenu] = useState<{ id: number; isOwn: boolean; content: string } | null>(null);

  // 수정
  const [editPostOpen, setEditPostOpen] = useState(false);
  const [editPostContent, setEditPostContent] = useState('');
  const [editCommentOpen, setEditCommentOpen] = useState(false);
  const [editCommentTarget, setEditCommentTarget] = useState<{ id: number; content: string } | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');

  useEffect(() => {
    const init = async () => {
      const nick = await getOrCreateNickname();
      setMyNickname(nick);
      const token = await getDeviceToken();
      setMyDeviceToken(token);
      const rawFlags = await AsyncStorage.getItem(FLAGGED_COMMENTS_KEY);
      if (rawFlags) setFlaggedComments(new Set(JSON.parse(rawFlags)));
    };
    init();
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
    if (raw) setIsLiked((JSON.parse(raw) as number[]).includes(Number(id)));
  };

  const handleLike = async () => {
    const prevLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!isLiked);
    setLikesCount(prev => prev + (isLiked ? -1 : 1));
    try {
      const res = await fetch(`${BASE_URL}/reports/${id}/like`, { method: isLiked ? 'DELETE' : 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw = await AsyncStorage.getItem(LIKED_REPORTS_KEY);
      const liked: number[] = raw ? JSON.parse(raw) : [];
      const updated = prevLiked ? liked.filter(l => l !== Number(id)) : [...liked, Number(id)];
      await AsyncStorage.setItem(LIKED_REPORTS_KEY, JSON.stringify(updated));
      setLikesCount(data.likes_count);
    } catch {
      setIsLiked(prevLiked);
      setLikesCount(prevCount);
    }
  };

  // 게시글 삭제
  const handleDeletePost = () => {
    setPostMenuOpen(false);
    Alert.alert('삭제', '이 글을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          await fetch(`${BASE_URL}/reports/${id}?device_token=${encodeURIComponent(myDeviceToken)}`, { method: 'DELETE' });
          Toast.show({ type: 'success', text1: '삭제되었습니다' });
          router.back();
        },
      },
    ]);
  };

  // 게시글 신고
  const handleFlagPost = () => {
    setPostMenuOpen(false);
    Alert.alert('신고', '이 글을 신고하시겠습니까?\n신고한 글은 표시되지 않습니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '신고', style: 'destructive',
        onPress: async () => {
          const raw = await AsyncStorage.getItem(FLAGGED_REPORTS_KEY);
          const flagged: number[] = raw ? JSON.parse(raw) : [];
          if (!flagged.includes(Number(id))) {
            await AsyncStorage.setItem(FLAGGED_REPORTS_KEY, JSON.stringify([...flagged, Number(id)]));
          }
          Toast.show({ type: 'success', text1: '신고 완료' });
          router.back();
        },
      },
    ]);
  };

  // 게시글 수정
  const handleEditPost = () => {
    setPostMenuOpen(false);
    setEditPostContent(report?.content || '');
    setEditPostOpen(true);
  };

  const submitEditPost = async () => {
    if (!editPostContent.trim()) return;
    const res = await fetch(`${BASE_URL}/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: { content: editPostContent.trim(), device_token: myDeviceToken } }),
    });
    if (res.ok) {
      setReport((prev: any) => ({ ...prev, content: editPostContent.trim() }));
      setEditPostOpen(false);
      Toast.show({ type: 'success', text1: '수정되었습니다' });
    }
  };

  // 댓글 디룰 메뉴
  const openCommentMenu = (item: any) => {
    setCommentMenu({ id: item.id, isOwn: item.device_token === myDeviceToken, content: item.content });
  };

  // 댓글 삭제
  const handleDeleteComment = () => {
    const target = commentMenu;
    setCommentMenu(null);
    Alert.alert('삭제', '이 댓글을 삭제하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제', style: 'destructive',
        onPress: async () => {
          if (!target) return;
          await fetch(`${BASE_URL}/reports/${id}/comments/${target.id}?device_token=${encodeURIComponent(myDeviceToken)}`, { method: 'DELETE' });
          setComments(prev => prev.filter(c => c.id !== target.id));
          if (report) setReport((r: any) => ({ ...r, comments_count: Math.max(0, (r.comments_count || 1) - 1) }));
          Toast.show({ type: 'success', text1: '삭제되었습니다' });
        },
      },
    ]);
  };

  // 댓글 신고
  const handleFlagComment = () => {
    const target = commentMenu;
    setCommentMenu(null);
    Alert.alert('신고', '이 댓글을 신고하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '신고', style: 'destructive',
        onPress: async () => {
          if (!target) return;
          const updated = new Set(flaggedComments);
          updated.add(target.id);
          setFlaggedComments(updated);
          await AsyncStorage.setItem(FLAGGED_COMMENTS_KEY, JSON.stringify([...updated]));
          setComments(prev => prev.filter(c => c.id !== target.id));
          Toast.show({ type: 'success', text1: '신고 완료' });
        },
      },
    ]);
  };

  // 댓글 수정
  const handleEditComment = () => {
    if (!commentMenu) return;
    setEditCommentTarget(commentMenu);
    setEditCommentContent(commentMenu.content);
    setCommentMenu(null);
    setEditCommentOpen(true);
  };

  const submitEditComment = async () => {
    if (!editCommentTarget || !editCommentContent.trim()) return;
    const res = await fetch(`${BASE_URL}/reports/${id}/comments/${editCommentTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: { content: editCommentContent.trim(), device_token: myDeviceToken } }),
    });
    if (res.ok) {
      setComments(prev => prev.map(c => c.id === editCommentTarget.id ? { ...c, content: editCommentContent.trim() } : c));
      setEditCommentOpen(false);
      Toast.show({ type: 'success', text1: '수정되었습니다' });
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    try {
      const nickname = myNickname || '익명';
      const token = await getDeviceToken();
      const res = await fetch(`${BASE_URL}/reports/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: { content: commentText.trim(), nickname, device_token: token } }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments(prev => [...prev, newComment]);
        setCommentText('');
        Keyboard.dismiss();
        if (report) setReport((r: any) => ({ ...r, comments_count: (r.comments_count || 0) + 1 }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const isMyPost = !!myDeviceToken && !!report?.device_token && report.device_token === myDeviceToken;
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>제보 상세</ThemedText>
        <TouchableOpacity style={styles.backBtn} onPress={() => setPostMenuOpen(true)}>
          <Ionicons name="ellipsis-vertical" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <FlatList
          data={comments.filter(c => !flaggedComments.has(c.id))}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={
            <>
              <View style={styles.postCard}>
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
                <ThemedText style={styles.postTitle}>{title}</ThemedText>
                {body.trim() ? <ThemedText style={styles.postBody}>{body}</ThemedText> : null}
                {report.image_url ? (
                  <Image source={{ uri: fixImageUrl(report.image_url) ?? undefined }} style={styles.postImage} contentFit="cover" />
                ) : null}
                <View style={styles.statsRow}>
                  <TouchableOpacity style={styles.statBtn} onPress={handleLike}>
                    <Ionicons name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'} size={18} color={isLiked ? COLORS.primary : COLORS.textSub} />
                    <ThemedText style={[styles.statText, isLiked && { color: COLORS.primary }]}>{likesCount}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.statBtn} onPress={() => inputRef.current?.focus()}>
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.textSub} />
                    <ThemedText style={styles.statText}>{report.comments_count || comments.length}</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.commentsHeader}>
                <ThemedText style={styles.commentsTitle}>댓글</ThemedText>
                {commentsLoading && <ActivityIndicator size="small" color={COLORS.primary} />}
              </View>
              {!commentsLoading && comments.filter(c => !flaggedComments.has(c.id)).length === 0 && (
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
                  <TouchableOpacity onPress={() => openCommentMenu(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 4 }}>
                    <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.textSub} />
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.commentText}>{item.content}</ThemedText>
              </View>
            </View>
          )}
        />

        <View style={[styles.commentInputRow, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            ref={inputRef}
            style={styles.commentInput}
            placeholder="됓글을 입력하세요..."
            placeholderTextColor={COLORS.textSub}
            value={commentText}
            onChangeText={setCommentText}
            returnKeyType="send"
            onSubmitEditing={submitComment}
          />
          <TouchableOpacity onPress={submitComment} style={styles.commentSendBtn} disabled={!commentText.trim() || commentSubmitting}>
            {commentSubmitting
              ? <ActivityIndicator size="small" color={COLORS.primary} />
              : <Ionicons name="send" size={20} color={commentText.trim() ? COLORS.primary : COLORS.textSub} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 게시글 옵션 메뉴 */}
      <Modal visible={postMenuOpen} transparent animationType="fade" onRequestClose={() => setPostMenuOpen(false)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setPostMenuOpen(false)} />
        <View style={[styles.optionsSheet, { paddingBottom: insets.bottom + 8 }]}>
          {isMyPost ? (
            <>
              <TouchableOpacity style={styles.optionRow} onPress={handleEditPost}>
                <Ionicons name="create-outline" size={22} color={COLORS.textMain} />
                <ThemedText style={styles.optionText}>수정하기</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={handleDeletePost}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <ThemedText style={[styles.optionText, { color: '#FF3B30' }]}>삭제하기</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.optionRow} onPress={handleFlagPost}>
              <Ionicons name="flag-outline" size={22} color="#FF3B30" />
              <ThemedText style={[styles.optionText, { color: '#FF3B30' }]}>신고하기</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.optionRow, styles.optionCancel]} onPress={() => setPostMenuOpen(false)}>
            <ThemedText style={styles.optionCancelText}>취소</ThemedText>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 댓글 옵션 메뉴 */}
      <Modal visible={commentMenu !== null} transparent animationType="fade" onRequestClose={() => setCommentMenu(null)}>
        <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={() => setCommentMenu(null)} />
        <View style={[styles.optionsSheet, { paddingBottom: insets.bottom + 8 }]}>
          {commentMenu?.isOwn ? (
            <>
              <TouchableOpacity style={styles.optionRow} onPress={handleEditComment}>
                <Ionicons name="create-outline" size={22} color={COLORS.textMain} />
                <ThemedText style={styles.optionText}>수정하기</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity style={styles.optionRow} onPress={handleDeleteComment}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
                <ThemedText style={[styles.optionText, { color: '#FF3B30' }]}>삭제하기</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.optionRow} onPress={handleFlagComment}>
              <Ionicons name="flag-outline" size={22} color="#FF3B30" />
              <ThemedText style={[styles.optionText, { color: '#FF3B30' }]}>신고하기</ThemedText>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.optionRow, styles.optionCancel]} onPress={() => setCommentMenu(null)}>
            <ThemedText style={styles.optionCancelText}>취소</ThemedText>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* 게시글 수정 모달 */}
      <Modal visible={editPostOpen} transparent animationType="slide" onRequestClose={() => setEditPostOpen(false)}>
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalHeader, { paddingTop: insets.top + 14 }]}>
            <TouchableOpacity onPress={() => setEditPostOpen(false)} style={styles.editHeaderBtn}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <ThemedText style={styles.editModalTitle}>글 수정</ThemedText>
            <TouchableOpacity style={styles.editHeaderBtn} onPress={submitEditPost}>
              <ThemedText style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16 }}>완료</ThemedText>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.editInput}
            multiline
            textAlignVertical="top"
            value={editPostContent}
            onChangeText={setEditPostContent}
            placeholder="내용을 입력하세요"
            placeholderTextColor={COLORS.textSub}
            autoFocus
          />
        </View>
      </Modal>

      {/* 댓글 수정 모달 */}
      <Modal visible={editCommentOpen} transparent animationType="slide" onRequestClose={() => setEditCommentOpen(false)}>
        <View style={styles.editModalOverlay}>
          <View style={[styles.editModalHeader, { paddingTop: insets.top + 14 }]}>
            <TouchableOpacity onPress={() => setEditCommentOpen(false)} style={styles.editHeaderBtn}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <ThemedText style={styles.editModalTitle}>됓글 수정</ThemedText>
            <TouchableOpacity style={styles.editHeaderBtn} onPress={submitEditComment}>
              <ThemedText style={{ color: COLORS.primary, fontWeight: '700', fontSize: 16 }}>완료</ThemedText>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.editInput}
            multiline
            textAlignVertical="top"
            value={editCommentContent}
            onChangeText={setEditCommentContent}
            placeholder="내용을 입력하세요"
            placeholderTextColor={COLORS.textSub}
            autoFocus
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  postCard: { backgroundColor: 'white', marginBottom: 8, padding: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
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
  commentsHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  commentsTitle: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  emptyComments: { alignItems: 'center', paddingVertical: 40, gap: 10, backgroundColor: 'white' },
  emptyText: { fontSize: 14, color: COLORS.textSub },
  commentItem: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  commentAvatarText: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  commentContent: { flex: 1 },
  commentMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  commentNickname: { fontSize: 13, fontWeight: '700', color: COLORS.textMain, marginRight: 6 },
  commentTime: { fontSize: 11, color: COLORS.textSub, flex: 1 },
  commentText: { fontSize: 14, color: COLORS.textMain, lineHeight: 20 },
  commentInputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F2F2F7', backgroundColor: 'white' },
  commentInput: { flex: 1, backgroundColor: '#F2F2F7', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, marginRight: 10 },
  commentSendBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  // 디룰 메뉴
  menuBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  optionsSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 18, gap: 14 },
  optionText: { fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  optionCancel: { borderTopWidth: 1, borderTopColor: '#F2F2F7', marginTop: 4, justifyContent: 'center' },
  optionCancelText: { fontSize: 16, fontWeight: '600', color: COLORS.textSub, flex: 1, textAlign: 'center' },
  // 수정 모달
  editModalOverlay: { flex: 1, backgroundColor: 'white' },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  editHeaderBtn: { width: 50, alignItems: 'center' },
  editModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  editInput: { flex: 1, padding: 20, fontSize: 15, color: COLORS.textMain, lineHeight: 24 },
});
