import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    Share,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';

const SUBWAY_LINES = [
  '1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선', 
  '수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '우이신설선', '신림선', 
  '김포골드라인', '경강선', '서해선', '인천1호선', '인천2호선', 'GTX-A'
];
const BASE_URL = 'http://192.168.45.88:3000';

const LINE_GROUPS = [
  { 
    title: '지하철 (1-9호선)', 
    lines: ['1호선', '2호선', '3호선', '4호선', '5호선', '6호선', '7호선', '8호선', '9호선'] 
  },
  { 
    title: '광역 / 급행', 
    lines: ['수인분당선', '경의중앙선', '공항철도', '신분당선', '경춘선', '경강선', '서해선', 'GTX-A'] 
  },
  { 
    title: '경전철 / 인천', 
    lines: ['우이신설선', '신림선', '김포골드라인', '인천1호선', '인천2호선'] 
  }
];

export default function CommunityScreen() {
  const [selectedLine, setSelectedLine] = useState('2호선');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLinePickerOpen, setIsLinePickerOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState('');
  
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

  const renderGridItem = (line: string) => (
    <TouchableOpacity 
      key={line} 
      style={[styles.gridItem, selectedLine === line && styles.activeGridItem]}
      onPress={() => {
        setSelectedLine(line);
        setIsLinePickerOpen(false);
        setLineSearch('');
      }}
    >
      <ThemedText style={[styles.gridText, selectedLine === line && styles.activeGridText]}>{line}</ThemedText>
    </TouchableOpacity>
  );

  const renderPickerContent = () => {
    if (lineSearch) {
      const filtered = SUBWAY_LINES.filter(l => l.includes(lineSearch));
      return <View style={styles.gridContainer}>{filtered.map(renderGridItem)}</View>;
    }
    return LINE_GROUPS.map(group => (
      <View key={group.title} style={styles.groupSection}>
        <ThemedText style={styles.groupTitle}>{group.title}</ThemedText>
        <View style={styles.gridContainer}>{group.lines.map(renderGridItem)}</View>
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <ThemedText style={styles.headerTitle}>커뮤니티</ThemedText>
          <TouchableOpacity style={styles.allLinesTrigger} onPress={() => setIsLinePickerOpen(true)}>
            <ThemedText style={styles.allLinesText}>전체보기</ThemedText>
            <Ionicons name="chevron-down" size={16} color="#FF9F43" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ height: 60, backgroundColor: '#f2f2f7' }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lineSelector}>
          {SUBWAY_LINES.slice(0, 8).map(line => (
            <TouchableOpacity 
              key={line} 
              style={[styles.lineChip, selectedLine === line && styles.activeLineChip]}
              onPress={() => setSelectedLine(line)}
            >
              <ThemedText style={[styles.lineText, selectedLine === line && styles.activeLineText]}>{line}</ThemedText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.moreLinesBtn} onPress={() => setIsLinePickerOpen(true)}>
            <ThemedText style={styles.moreLinesText}>더보기 +</ThemedText>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {isLinePickerOpen && (
        <View style={styles.linePickerOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.pickerHeader}>
              <ThemedText style={styles.pickerTitle}>노선 선택</ThemedText>
              <TouchableOpacity onPress={() => { setIsLinePickerOpen(false); setLineSearch(''); }}>
                <Ionicons name="close" size={28} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" />
              <TextInput style={styles.lineSearchInput} placeholder="노선 이름 검색" placeholderTextColor="#AEAEB2" value={lineSearch} onChangeText={setLineSearch} />
            </View>
            <ScrollView contentContainerStyle={styles.pickerScroll}>{renderPickerContent()}</ScrollView>
          </SafeAreaView>
        </View>
      )}

      {loading && !refreshing ? (
        <ActivityIndicator size="large" color="#FF9F43" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 120, paddingTop: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} />}
          renderItem={({ item }) => (
            <View style={styles.feedCard}>
              <View style={styles.cardHeader}>
                <Image source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.id}` }} style={styles.profileImg} />
                <View style={styles.headerTextWrapper}>
                  <ThemedText style={styles.userName}>{item.nickname || '익명'}</ThemedText>
                  <ThemedText style={styles.timeText}>{selectedLine} {item.station_name} • 3min ago</ThemedText>
                </View>
                <TouchableOpacity><Ionicons name="ellipsis-horizontal" size={20} color="#AEAEB2" /></TouchableOpacity>
              </View>
              <View style={styles.contentBody}>
                <ThemedText style={styles.mainContentText}>{item.content}</ThemedText>
                <ThemedText style={styles.statusText}>{item.direction} : {item.status}! 😰</ThemedText>
              </View>
              {item.image_url && <Image source={{ uri: item.image_url.replace('localhost', '192.168.45.88').replace('192.168.45.253', '192.168.45.88') }} style={styles.cardImage} />}
              <View style={styles.cardFooter}>
                <View style={styles.snsIcons}>
                  <Ionicons name="logo-instagram" size={18} color="#8E8E93" style={styles.icon} />
                  <Ionicons name="chatbubble-outline" size={18} color="#8E8E93" style={styles.icon} />
                  <Ionicons name="logo-twitter" size={18} color="#8E8E93" style={styles.icon} />
                </View>
                <TouchableOpacity style={styles.talkButton} onPress={() => handleShare(item)}>
                  <ThemedText style={styles.talkText}>TALK</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<ThemedText style={styles.emptyText}>{selectedLine}의 첫 번째 제보자가 되어보세요!</ThemedText>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setIsModalOpen(true)}>
        <Ionicons name="megaphone" size={28} color="white" />
      </TouchableOpacity>

      {isModalOpen && (
        <View style={styles.modalOverlay}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>{selectedLine} 제보하기</ThemedText>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}><Ionicons name="close" size={28} /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <TextInput style={styles.input} placeholder="역 이름" value={station} onChangeText={setStation} />
              <ThemedText style={styles.label}>방면 선택</ThemedText>
              <View style={styles.directionRow}>
                {['상행/내선', '하행/외선'].map(dir => (
                  <TouchableOpacity key={dir} style={[styles.dirBtn, direction === dir && styles.activeDir]} onPress={() => setDirection(dir)}>
                    <ThemedText style={[styles.dirText, direction === dir && styles.activeText]}>{dir === '상행/내선' ? '서울 방면' : '인천 방면'}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={[styles.input, { height: 120, textAlignVertical: 'top' }]} placeholder="현재 상황은 어떤가요?" multiline value={content} onChangeText={setContent} />
              <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
                {image ? <Image source={{ uri: image }} style={styles.preview} /> : <View style={{ alignItems: 'center' }}><Ionicons name="camera" size={40} color="#CCC" /><ThemedText style={{ color: '#AAA', marginTop: 5 }}>사진 첨부 (선택)</ThemedText></View>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={submitReport}><ThemedText style={styles.submitBtnText}>제보 등록하기</ThemedText></TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: { paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#f2f2f7' },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  headerTitle: { fontSize: 34, fontWeight: '800', color: '#1C1C1E', lineHeight: 41 },
  allLinesTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2, gap: 4 },
  allLinesText: { fontSize: 13, fontWeight: '700', color: '#FF9F43' },
  lineSelector: { paddingHorizontal: 20, alignItems: 'center', gap: 10, paddingBottom: 10 },
  lineChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25, backgroundColor: '#e5e5ea' },
  activeLineChip: { backgroundColor: '#FF9F43' },
  lineText: { color: '#8e8e93', fontWeight: 'bold' },
  activeLineText: { color: 'white' },
  moreLinesBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 25, backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e5ea' },
  moreLinesText: { color: '#FF9F43', fontWeight: 'bold' },
  linePickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 200 },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
  pickerTitle: { fontSize: 24, fontWeight: '900', color: '#1C1C1E' },
  searchBarContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', margin: 20, paddingHorizontal: 15, borderRadius: 12, height: 50 },
  lineSearchInput: { flex: 1, marginLeft: 10, fontSize: 16, color: '#1C1C1E' },
  pickerScroll: { paddingBottom: 40 },
  groupSection: { marginBottom: 25 },
  groupTitle: { fontSize: 15, fontWeight: '700', color: '#1C1C1E', marginLeft: 20, marginBottom: 12 },
  gridContainer: { paddingHorizontal: 15, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: { width: '31%', paddingVertical: 15, backgroundColor: '#F2F2F7', borderRadius: 15, alignItems: 'center' },
  activeGridItem: { backgroundColor: '#FF9F43' },
  gridText: { fontSize: 13, fontWeight: '600', color: '#8E8E93' },
  activeGridText: { color: 'white' },
  fab: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF9F43', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowOpacity: 0.3, shadowRadius: 5 },
  feedCard: { backgroundColor: 'white', marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 15, elevation: 3, position: 'relative' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  profileImg: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#F2F2F7' },
  headerTextWrapper: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '700', color: '#1C1C1E' },
  timeText: { fontSize: 12, color: '#8E8E93', marginTop: 2 },
  contentBody: { marginBottom: 15 },
  mainContentText: { fontSize: 18, fontWeight: '800', color: '#1C1C1E', marginBottom: 6, lineHeight: 24 },
  statusText: { fontSize: 14, color: '#FF9F43', fontWeight: '600' },
  cardImage: { width: '100%', height: 220, borderRadius: 16, marginBottom: 15 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  snsIcons: { flexDirection: 'row', gap: 15 },
  icon: { marginRight: 5 },
  talkButton: { backgroundColor: '#FFD600', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', position: 'absolute', right: 15, bottom: 15, elevation: 5, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 5 },
  talkText: { fontSize: 11, fontWeight: '900', color: '#3A3A3C' },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 100 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#EEE' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#1C1C1E' },
  input: { backgroundColor: '#f2f2f7', borderRadius: 12, padding: 16, fontSize: 16, marginBottom: 20 },
  label: { fontSize: 16, fontWeight: 'bold', marginBottom: 12, color: '#1c1c1e' },
  directionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  dirBtn: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1.5, borderColor: '#e5e5ea', alignItems: 'center' },
  activeDir: { backgroundColor: '#FFF4E6', borderColor: '#FF9F43' },
  dirText: { fontWeight: '600', color: '#8e8e93' },
  activeText: { color: '#FF9F43' },
  imageBtn: { height: 180, backgroundColor: '#f2f2f7', borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 30, overflow: 'hidden' },
  preview: { width: '100%', height: '100%' },
  submitBtn: { backgroundColor: '#FF9F43', padding: 20, borderRadius: 15, alignItems: 'center' },
  submitBtnText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  emptyText: { textAlign: 'center', marginTop: 100, color: '#aeaeb2', fontSize: 16 }
});