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

import { ThemedText } from '@/components/themed-text';

const { width } = Dimensions.get('window');

const getHostUrl = () => {
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
};

const HOST = getHostUrl();
const COLORS = {
  primary: '#2E6D4D',
  secondary: '#548C71',
  background: '#F8F9FB',
  cardBg: '#FFFFFF',
  textMain: '#1C1C1E',
  textSub: '#8E8E93',
  accent: '#FF9F43',
};

const SUBWAY_LINES = [
  '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', 
  '수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '우이신설선', '신림선', 
  '김포골드라인', '경강선', '서해선', '인천1호선', '인천2호선', 'GTX-A'
];
const BASE_URL = `http://${HOST}:3000`; // 로컬 환경에 맞게 자동 설정

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const [selectedLine, setSelectedLine] = useState('2호선');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [station, setStation] = useState('');
  const [direction, setDirection] = useState('');
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const response = await fetch(`${BASE_URL}/reports?line_name=${selectedLine}`);
      const data = await response.json();
      setReports(data);
    } catch (e) {
      console.error("피드 로딩 실패:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
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
      Alert.alert("알림", "모든 항목을 입력해주세요!");
      return;
    }
    const formattedStation = station.trim().endsWith('역') ? station.trim() : `${station.trim()}역`;
    const savedNickname = await AsyncStorage.getItem('user_nickname');

    const formData = new FormData();
    formData.append('report[line_name]', selectedLine);
    formData.append('report[station_name]', formattedStation);
    formData.append('report[nickname]', savedNickname || '익명');
    formData.append('report[direction]', direction);
    formData.append('report[content]', content);
    formData.append('report[status]', '혼잡');

    if (image) {
      const filename = image.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image`;
      formData.append('image', { uri: image, name: filename, type } as any);
    }

    try {
      const response = await fetch(`${BASE_URL}/reports`, { method: 'POST', body: formData });
      if (response.ok) {
        Alert.alert("성공", "제보가 등록되었습니다!");
        setIsModalOpen(false);
        setImage(null); setContent(''); setStation(''); setDirection('');
        fetchReports();
      }
    } catch (e) {
      Alert.alert("에러", "서버 연결 실패");
    }
  };

  const handleShare = async (item: any) => {
    try {
      const message = `[역앞] 지하철 제보 알림! 🚇\n\n📍 ${selectedLine} ${item.station_name}\n📢 상황: ${item.content}\n\n지금 '역앞' 앱에서 확인해보세요!`;
      await Share.share({ message });
    } catch (error) {
      console.error("공유 실패:", error);
    }
  };

  const fixImageUrl = (url: string) => {
    if (!url) return null;
    
    // 만약 이미 http로 시작하는 절대 경로라면, 호스트 부분을 BASE_URL의 호스트로 교체
    if (url.startsWith('http')) {
      return url.replace(/^http:\/\/[^/]+/, BASE_URL);
    }
    
    // /rails/active_storage/... 같은 상대 경로라면 BASE_URL을 앞에 붙여줌
    return `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const renderHeader = () => (
    <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Image 
            source={require('@/assets/images/character_design.svg')} 
            style={styles.headerMascot}
            contentFit="contain"
          />
          <ThemedText style={styles.headerTitle}>커뮤니티</ThemedText>
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.textMain} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.lineSelectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lineSelector}>
          {SUBWAY_LINES.map(line => (
            <TouchableOpacity 
              key={line} 
              style={[styles.lineChip, selectedLine === line && styles.activeLineChip]}
              onPress={() => setSelectedLine(line)}
            >
              <ThemedText style={[styles.lineText, selectedLine === line && styles.activeLineText]}>{line}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <ThemedText style={styles.loadingText}>소식을 가져오는 중...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <View style={styles.feedCard}>
              <View style={styles.cardHeader}>
                <Image 
                  source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.nickname || item.id}` }} 
                  style={styles.profileImg} 
                />
                <View style={styles.headerTextWrapper}>
                  <ThemedText style={styles.userName}>{item.nickname || '익명'}</ThemedText>
                  <ThemedText style={styles.timeText}>{selectedLine} {item.station_name} • 방금 전</ThemedText>
                </View>
                <TouchableOpacity style={styles.moreIcon}>
                  <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textSub} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.contentBody}>
                <ThemedText style={styles.mainContentText}>{item.content}</ThemedText>
                <View style={styles.statusBadge}>
                   <Ionicons name="warning-outline" size={14} color={COLORS.accent} />
                   <ThemedText style={styles.statusText}>{item.direction} : {item.status}</ThemedText>
                </View>
              </View>

              {item.image_url && (
                <Image 
                  source={{ uri: fixImageUrl(item.image_url) }} 
                  style={styles.cardImage} 
                  contentFit="cover"
                />
              )}


              <View style={styles.cardFooter}>
                <View style={styles.interactionBar}>
                  <TouchableOpacity style={styles.footerBtn}>
                    <Ionicons name="heart-outline" size={20} color={COLORS.textSub} />
                    <ThemedText style={styles.footerBtnText}>좋아요</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.footerBtn}>
                    <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSub} />
                    <ThemedText style={styles.footerBtnText}>댓글</ThemedText>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.shareBtn} onPress={() => handleShare(item)}>
                  <Ionicons name="share-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color="#D1D1D6" />
              <ThemedText style={styles.emptyText}>{selectedLine}의 첫 번째 제보자가 되어보세요!</ThemedText>
            </View>
          }
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
        <Ionicons name="add" size={32} color="white" />
      </TouchableOpacity>

      {isModalOpen && (
        <View style={styles.modalOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close" size={28} color={COLORS.textMain} />
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>{selectedLine} 제보</ThemedText>
              <TouchableOpacity onPress={submitReport}>
                <ThemedText style={styles.submitText}>등록</ThemedText>
              </TouchableOpacity>
            </View>
            
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>역 이름</ThemedText>
                <TextInput 
                  style={styles.input} 
                  placeholder="어느 역인가요?" 
                  placeholderTextColor="#AEAEB2"
                  value={station} 
                  onChangeText={setStation} 
                />
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>방면</ThemedText>
                <View style={styles.directionRow}>
                  {['상행/내선', '하행/외선'].map(dir => (
                    <TouchableOpacity 
                      key={dir} 
                      style={[styles.dirBtn, direction === dir && styles.activeDir]} 
                      onPress={() => setDirection(dir)}
                    >
                      <ThemedText style={[styles.dirText, direction === dir && styles.activeDirText]}>
                        {dir === '상행/내선' ? '서울/내선 방면' : '인천/외선 방면'}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <ThemedText style={styles.label}>상세 내용</ThemedText>
                <TextInput 
                  style={[styles.input, styles.textArea]} 
                  placeholder="현재 지하철 상황을 공유해주세요." 
                  placeholderTextColor="#AEAEB2"
                  multiline 
                  value={content} 
                  onChangeText={setContent} 
                />
              </View>

              <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.previewImage} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Ionicons name="camera-outline" size={40} color="#AEAEB2" />
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
  lineSelectorContainer: { paddingBottom: 12 },
  lineSelector: { paddingHorizontal: 20, gap: 8 },
  lineChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F2F2F7' },
  activeLineChip: { backgroundColor: COLORS.primary },
  lineText: { color: COLORS.textSub, fontWeight: '600', fontSize: 13 },
  activeLineText: { color: 'white' },
  listContent: { padding: 16, paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSub, fontSize: 14 },
  feedCard: { 
    backgroundColor: 'white', 
    borderRadius: 24, 
    padding: 16, 
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  profileImg: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F7' },
  headerTextWrapper: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  timeText: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  moreIcon: { padding: 4 },
  contentBody: { marginBottom: 16 },
  mainContentText: { fontSize: 16, color: COLORS.textMain, lineHeight: 22, marginBottom: 8 },
  statusBadge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF9F2', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 8,
    alignSelf: 'flex-start'
  },
  statusText: { fontSize: 12, color: COLORS.accent, fontWeight: '700', marginLeft: 4 },
  cardImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7'
  },
  interactionBar: { flexDirection: 'row', gap: 16 },
  footerBtn: { flexDirection: 'row', alignItems: 'center' },
  footerBtnText: { fontSize: 13, color: COLORS.textSub, marginLeft: 4, fontWeight: '500' },
  shareBtn: { padding: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { marginTop: 16, fontSize: 15, color: COLORS.textSub, textAlign: 'center' },
  fab: { 
    position: 'absolute', 
    bottom: 30, 
    right: 20, 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: COLORS.primary, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8
  },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 1000 },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#F2F2F7' 
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  submitText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  modalScroll: { padding: 20 },
  inputGroup: { marginBottom: 24 },
  label: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginBottom: 10 },
  input: { 
    backgroundColor: '#F2F2F7', 
    borderRadius: 12, 
    padding: 16, 
    fontSize: 15, 
    color: COLORS.textMain 
  },
  textArea: { height: 120, textAlignVertical: 'top' },
  directionRow: { flexDirection: 'row', gap: 10 },
  dirBtn: { 
    flex: 1, 
    padding: 14, 
    borderRadius: 12, 
    borderWidth: 1.5, 
    borderColor: '#F2F2F7', 
    alignItems: 'center' 
  },
  activeDir: { backgroundColor: '#F0F4F2', borderColor: COLORS.primary },
  dirText: { fontSize: 14, fontWeight: '600', color: COLORS.textSub },
  activeDirText: { color: COLORS.primary },
  imagePicker: { 
    height: 200, 
    backgroundColor: '#F2F2F7', 
    borderRadius: 16, 
    overflow: 'hidden', 
    marginBottom: 40 
  },
  imagePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { marginTop: 8, color: '#AEAEB2', fontSize: 14 },
  previewImage: { width: '100%', height: '100%' }
});