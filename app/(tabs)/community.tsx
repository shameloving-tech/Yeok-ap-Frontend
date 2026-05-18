import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
    Dimensions,
    Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';

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
  line2: '#4CAF50',
  line1: '#263238', // 임시 1호선 색상
  border: '#F2F2F7',
};

const SUBWAY_LINES = [
  '전체', '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', 
  '수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '우이신설선', '신림선', 
  '김포골드라인', '경강선', '서해선', '인천1호선', '인천2호선', 'GTX-A'
];

const BASE_URL = 'https://yeok-ap-backend.onrender.com';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [selectedLine, setSelectedLine] = useState('전체');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [station, setStation] = useState('');
  const [direction, setDirection] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = async () => {
    try {
      const lineParam = selectedLine === '전체' ? '' : selectedLine;
      const encodedLine = encodeURIComponent(lineParam);
      const url = `${BASE_URL}/reports?line_name=${encodedLine}`;
      const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!response.ok) throw new Error("서버 응답 오류");
      const data = await response.json();
      setReports(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [selectedLine]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const submitReport = async () => {
    if (!station || !content || !direction) {
      Toast.show({ type: 'error', text1: '알림', text2: '모든 항목을 입력해주세요!' });
      return;
    }
    setSubmitting(true);
    try {
      const formattedStation = station.trim().endsWith('역') ? station.trim() : `${station.trim()}역`;
      const formData = new FormData();
      formData.append('report[line_name]', selectedLine === '전체' ? '2호선' : selectedLine);
      formData.append('report[station_name]', formattedStation);
      formData.append('report[direction]', direction);
      formData.append('report[content]', content);
      formData.append('report[status]', '혼잡');
      if (image) {
        const filename = image.split('/').pop() || 'image.jpg';
        formData.append('report[image]', { uri: image, name: filename, type: 'image/jpeg' } as any);
      }
      const response = await fetch(`${BASE_URL}/reports`, { method: 'POST', body: formData });
      if (response.ok) {
        setIsModalOpen(false);
        setImage(null); setContent(''); setStation(''); setDirection('');
        fetchReports();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const fixImageUrl = (url: string) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const getLineNumber = (lineName: string) => {
    const match = lineName?.match(/(\d+)/);
    return match ? match[1] : 'M';
  };

  const getLineColor = (lineName: string) => {
    if (lineName?.includes('2호선')) return COLORS.line2;
    if (lineName?.includes('1호선')) return '#0052A4';
    if (lineName?.includes('3호선')) return '#EF7C1C';
    if (lineName?.includes('4호선')) return '#00A5DE';
    return COLORS.primary;
  };

  // --- UI 컴포넌트들 ---

  const renderPopularPosts = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>실시간 인기 글</ThemedText>
        <TouchableOpacity><ThemedText style={styles.viewAll}>전체보기</ThemedText></TouchableOpacity>
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
          {['1호선', '2호선'].map(line => (
            <TouchableOpacity 
              key={line} 
              style={[styles.filterChip, selectedLine === line && styles.activeFilterChip]}
              onPress={() => setSelectedLine(line)}
            >
              <View style={[styles.chipDot, { backgroundColor: getLineColor(line) }]} />
              <ThemedText style={[styles.filterText, selectedLine === line && styles.activeFilterText]}>{line}</ThemedText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.filterChip}>
            <Ionicons name="add" size={16} color={COLORS.textSub} />
            <ThemedText style={styles.filterText}>필터</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularScroll}>
        {reports.slice(0, 3).map((item: any) => (
          <View key={item.id} style={styles.popularCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.hotBadge}><ThemedText style={styles.hotText}>HOT</ThemedText></View>
              <View style={[styles.circleLineIconSmall, { backgroundColor: getLineColor(item.line_name) }]}>
                <ThemedText style={styles.circleLineTextSmall}>{getLineNumber(item.line_name)}</ThemedText>
              </View>
              <ThemedText style={styles.cardMeta}>{item.station_name} • 10분 전</ThemedText>
            </View>
            <ThemedText style={styles.popularCardTitle} numberOfLines={1}>{item.content.split('\n')[0]}</ThemedText>
            <ThemedText style={styles.popularCardBody} numberOfLines={2}>{item.content}</ThemedText>
            <View style={styles.cardStats}>
              <View style={styles.statItem}>
                <Ionicons name="thumbs-up-outline" size={14} color={COLORS.textSub} />
                <ThemedText style={styles.statText}>24</ThemedText>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSub} />
                <ThemedText style={styles.statText}>5</ThemedText>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderCategories = () => (
    <View style={styles.categoryRow}>
      <TouchableOpacity style={styles.categoryBox}>
        <View>
          <ThemedText style={styles.categoryLabel}>역 제보</ThemedText>
          <ThemedText style={styles.categoryMain}>전체보기</ThemedText>
        </View>
        <View style={styles.categoryIconCircle}>
           <Ionicons name="subway-outline" size={24} color={COLORS.textSub} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.categoryBox}>
        <View>
          <ThemedText style={styles.categoryLabel}>블라블라</ThemedText>
          <ThemedText style={styles.categoryMain}>전체보기</ThemedText>
        </View>
        <View style={styles.categoryImagePlaceholder} />
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerAvatar}>
        <Ionicons name="happy" size={20} color="white" />
      </View>
      <ThemedText style={styles.headerTitle}>커뮤니티</ThemedText>
      <TouchableOpacity style={styles.headerSearch}>
        <Ionicons name="search" size={24} color={COLORS.textMain} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}
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

            {renderCategories()}
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.feedCard}>
            <View style={styles.feedTopRow}>
              <View style={[styles.circleLineIcon, { backgroundColor: getLineColor(item.line_name) }]}>
                <ThemedText style={styles.circleLineText}>{getLineNumber(item.line_name)}</ThemedText>
              </View>
              <ThemedText style={styles.feedMeta}>{item.station_name} • 2분 전</ThemedText>
              <View style={styles.tagBadge}><ThemedText style={styles.tagText}>블라블라</ThemedText></View>
            </View>
            <ThemedText style={styles.feedTitle}>{item.content.split('\n')[0]}</ThemedText>
            <ThemedText style={styles.feedBody} numberOfLines={2}>{item.content}</ThemedText>
            {item.image_url ? (
              <Image 
                source={{ uri: fixImageUrl(item.image_url) }} 
                style={styles.feedImage} 
                contentFit="cover"
                onLoad={() => console.log("이미지 로드 성공:", fixImageUrl(item.image_url))}
                onError={(e) => console.error("이미지 로드 실패:", fixImageUrl(item.image_url), e)}
              />
            ) : (
              <View style={styles.noImagePlaceholder} />
            )}
            <View style={styles.feedStats}>
              <View style={styles.statItem}>
                <Ionicons name="thumbs-up-outline" size={14} color="#FFD15B" />
                <ThemedText style={styles.statText}>2</ThemedText>
                <Ionicons name="chatbubble-outline" size={14} color={COLORS.textSub} style={{marginLeft: 10}} />
                <ThemedText style={styles.statText}>0</ThemedText>
              </View>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      />

      <TouchableOpacity 
        style={[styles.fab, { bottom: 30 + insets.bottom }]} 
        onPress={() => setIsModalOpen(true)}
      >
        <Ionicons name="pencil" size={24} color="white" />
      </TouchableOpacity>

      {isModalOpen && (
        <View style={styles.modalOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
              <ThemedText style={styles.modalTitle}>제보하기</ThemedText>
              <TouchableOpacity onPress={submitReport} disabled={submitting}>
                <ThemedText style={styles.submitText}>등록</ThemedText>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 20 }}>
              <TextInput style={styles.input} placeholder="역 이름" value={station} onChangeText={setStation} />
              <TextInput style={styles.input} placeholder="방면" value={direction} onChangeText={setDirection} />
              <TextInput style={[styles.input, { height: 100 }]} placeholder="내용" multiline value={content} onChangeText={setContent} />
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImage} contentFit="cover" />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera" size={40} color="#ccc" />
                    <ThemedText style={styles.imagePlaceholderText}>사진 첨부하기</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  sectionContainer: { marginTop: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  viewAll: { fontSize: 14, color: COLORS.textSub, fontWeight: '600' },

  filterWrapper: { marginBottom: 15 },
  filterScroll: { paddingHorizontal: 20, alignItems: 'center', gap: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7' },
  activeFilterChip: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  activeFilterText: { color: 'white' },
  filterSeparator: { width: 1, height: 16, backgroundColor: '#E5E5EA', marginHorizontal: 5 },
  chipDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },

  popularScroll: { paddingHorizontal: 20, gap: 12, paddingBottom: 10 },
  popularCard: { width: width * 0.72, backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F2F2F7', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  hotBadge: { backgroundColor: '#FFF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  hotText: { color: '#FF5252', fontSize: 10, fontWeight: '800' },
  circleLineIconSmall: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  circleLineTextSmall: { color: 'white', fontSize: 10, fontWeight: '800' },
  cardMeta: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },
  popularCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  popularCardBody: { fontSize: 13, color: COLORS.textSub, lineHeight: 18, marginBottom: 15 },
  cardStats: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F2F2F7', paddingTop: 12 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, color: COLORS.textSub, fontWeight: '500' },

  newPostsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 20, marginBottom: 15 },
  sortOptions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortActive: { fontSize: 13, color: COLORS.textMain, fontWeight: '800' },
  sortInactive: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  sortDivider: { fontSize: 12, color: '#E5E5EA' },

  categoryRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 20 },
  categoryBox: { flex: 1, height: 100, backgroundColor: 'white', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#F2F2F7', flexDirection: 'row', justifyContent: 'space-between' },
  categoryLabel: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
  categoryMain: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  categoryIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F2F2F7', justifyContent: 'center', alignItems: 'center', alignSelf: 'flex-end' },
  categoryImagePlaceholder: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F2F2F7', alignSelf: 'flex-end' },

  feedCard: { paddingHorizontal: 20, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  feedTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  circleLineIcon: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  circleLineText: { color: 'white', fontSize: 12, fontWeight: '800' },
  feedMeta: { flex: 1, fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  tagBadge: { backgroundColor: '#F2F2F7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: COLORS.textSub, fontWeight: '700' },
  feedTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain, marginBottom: 8 },
  feedBody: { fontSize: 14, color: COLORS.textSub, lineHeight: 20, marginBottom: 15 },
  feedImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 15 },
  feedStats: { flexDirection: 'row', justifyContent: 'space-between' },

  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    backgroundColor: 'white'
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', color: COLORS.primary },
  headerSearch: { padding: 4 },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 1000 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F2F2F7' },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  submitText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  input: { backgroundColor: '#F2F2F7', borderRadius: 12, padding: 15, marginBottom: 15 },
  imagePicker: { height: 150, backgroundColor: '#F2F2F7', borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  previewImage: { width: '100%', height: '100%' },
  imagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { marginTop: 8, color: COLORS.textSub, fontSize: 13, fontWeight: '500' },
  noImagePlaceholder: { height: 0 }
});
