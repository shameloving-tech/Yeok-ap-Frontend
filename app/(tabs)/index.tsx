import { Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome6 } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createConsumer } from '@rails/actioncable';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  SafeAreaView,
  TextInput,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';

const { width } = Dimensions.get('window');

// New Design Colors
const COLORS = {
  primary: '#2E6D4D',
  secondary: '#548C71',
  background: '#F8F9FB',
  searchBg: '#DBE5F9',
  cardBg: '#FFFFFF',
  textMain: '#1C1C1E',
  textSub: '#8E8E93',
  noticeBg: '#548C71',
  noticeTag: '#FEE5A5',
  line2: '#00A84D',
  line1: '#0052A4',
};

// 모바일 환경 호환성 패치 
if (typeof global.addEventListener !== 'function') {
  (global as any).addEventListener = () => {};
}
if (typeof global.removeEventListener !== 'function') {
  (global as any).removeEventListener = () => {};
}

import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 로컬 개발 환경용 서버 주소 설정
const getHostUrl = () => {
  if (Platform.OS === 'android') return '10.0.2.2'; // 안드로이드 에뮬레이터
  return 'localhost'; // iOS 시뮬레이터 및 웹
};

const HOST = getHostUrl();
const SERVER_URL = `ws://${HOST}:3000/cable`;
const LINE_CONFIG = [
  { id: '1호선', name: '1호선', color: '#0052A4' },
  { id: '2호선', name: '2호선', color: '#00A84D' },
  { id: '3호선', name: '3호선', color: '#EF7C1C' },
  { id: '4호선', name: '4호선', color: '#00A4E3' },
  { id: '5호선', name: '5호선', color: '#996CAC' },
  { id: '6호선', name: '6호선', color: '#CD7C2F' },
  { id: '7호선', name: '7호선', color: '#747F00' },
  { id: '8호선', name: '8호선', color: '#E6186C' },
  { id: '9호선', name: '9호선', color: '#BDB092' },
  { id: '수인분당선', name: '수인분당선', color: '#FFB100' },
  { id: '경의중앙선', name: '경의중앙선', color: '#77C4A3' },
  { id: '공항철도', name: '공항철도', color: '#0090D2' },
  { id: '신분당선', name: '신분당선', color: '#D4003B' },
  { id: '경춘선', name: '경춘선', color: '#0C8E72' },
  { id: '우이신설선', name: '우이신설선', color: '#B0CE18' },
  { id: '신림선', name: '신림선', color: '#6789CA' },
  { id: '김포골드라인', name: '김포골드라인', color: '#AD8605' },
  { id: '경강선', name: '경강선', color: '#003DA5' },
  { id: '서해선', name: '서해선', color: '#81A914' },
  { id: '인천1호선', name: '인천1호선', color: '#7CA8D5' },
  { id: '인천2호선', name: '인천2호선', color: '#ED8B00' },
  { id: 'GTX-A', name: 'GTX-A', color: '#9A6262' },
];

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [followedLines, setFollowedLines] = useState<string[]>([]);
  const [expandedLine, setExpandedLine] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stationList, setStationList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const consumerRef = useRef<any>(null);

  useEffect(() => {
    loadFollowedLines();
    requestLocationPermission();

    consumerRef.current = createConsumer(SERVER_URL);
    const subscription = consumerRef.current.subscriptions.create(
      { channel: "CongestionChannel" },
      {
        connected() { setIsConnected(true); },
        disconnected() { setIsConnected(false); },
        received(data: any) {
          if (data && data.stations && data.stations.length > 0) {
            setStationList(data.stations);
          }
        }
      }
    );
    return () => {
      subscription.unsubscribe();
      consumerRef.current.disconnect();
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('위치 권한 필요');
        return;
      }

      // 더 빠른 응답을 위해 마지막 위치를 시도
      let lastLocation = await Location.getLastKnownPositionAsync({});
      if (lastLocation) setUserLocation(lastLocation);

      // 2. 현재 위치를 타임아웃 5초로 시도
      try {
        let location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]) as Location.LocationObject;
        setUserLocation(location);
      } catch (e) {
        // GPS 실패 시 강남역을 기본 위치로 설정 (테스트용)
        if (!userLocation) {
          setUserLocation({
            coords: { latitude: 37.4979, longitude: 127.0276 },
            timestamp: Date.now()
          } as any);
          setLocationError('GPS 연결 실패 (강남역 기준)');
        }
      }
    } catch (error) {
      console.warn('위치 획득 실패:', error);
      setLocationError('위치 획득 실패');
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const nearestStation = useMemo(() => {
    if (!userLocation || stationList.length === 0) return null;
    let minDistance = Infinity;
    let nearest = null;
    stationList.forEach(station => {
      const distance = calculateDistance(
        userLocation.coords.latitude,
        userLocation.coords.longitude,
        station.latitude,
        station.longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearest = { ...station, distance };
      }
    });
    return nearest;
  }, [userLocation, stationList]);

  const processedLines = useMemo(() => {
    const levelOrder: Record<string, number> = { '폭발': 4, '혼잡': 3, '보통': 2, '여유': 1, '정보 없음': 0 };
    return LINE_CONFIG.map(line => {
      const lineStations = stationList.filter(s => s.line_name === line.name);
      if (lineStations.length === 0) {
        return { ...line, status: '보통', msg: '운행 정보 확인 중', transfers: [], detailedTransfers: [] };
      }
      const worstStation = lineStations.reduce((prev, curr) => 
        (levelOrder[curr.congestion_level] || 0) > (levelOrder[prev.congestion_level] || 0) ? curr : prev
      );
      const detailedTransfers = lineStations
        .filter(s => s.transfer_info && s.transfer_info.length > 0)
        .map(s => ({
          stationName: s.station_name,
          lines: s.transfer_info.split(',').map((tName: string) => {
            const targetLineData = stationList.find(st => st.line_name === tName.trim());
            return { name: tName.trim(), status: targetLineData?.congestion_level || '보통' };
          })
        })).slice(0, 3);
      const transfers = Array.from(new Set(lineStations.flatMap(s => s.transfer_info ? s.transfer_info.split(',') : []))).filter(t => t.trim() !== line.name).slice(0, 5);
      let msg = '원활하게 운행 중입니다';
      if (worstStation.congestion_level === '폭발' || worstStation.congestion_level === '혼잡') {
        msg = `${worstStation.station_name.replace('역', '')} 매우 혼잡`;
      } else if (worstStation.arrival_message !== '정보 없음') {
        msg = worstStation.arrival_message;
      }
      return { ...line, status: worstStation.congestion_level, msg, transfers, detailedTransfers };
    });
  }, [stationList]);

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return processedLines;
    const query = searchQuery.trim().toLowerCase();
    return processedLines.filter(line => 
      line.name.toLowerCase().includes(query) || 
      line.transfers.some((t: string) => t.toLowerCase().includes(query))
    );
  }, [processedLines, searchQuery]);

  const loadFollowedLines = async () => {
    const saved = await AsyncStorage.getItem('followed_lines');
    if (saved) setFollowedLines(JSON.parse(saved));
  };

  const toggleFollow = async (id: string) => {
    const updated = followedLines.includes(id) ? followedLines.filter(l => l !== id) : [...followedLines, id];
    setFollowedLines(updated);
    await AsyncStorage.setItem('followed_lines', JSON.stringify(updated));
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case '폭발': return '#FF3B30';
      case '혼잡': return '#FF9500';
      case '보통': return '#FFCC00';
      default: return '#34C759';
    }
  };

  const getTransferColor = (name: string) => {
    const found = LINE_CONFIG.find(l => name.trim().includes(l.name));
    return found ? found.color : '#AEAEB2';
  };

  const FACILITIES = [
    { id: 'restaurant', name: '맛집', icon: 'restaurant', type: 'MaterialIcons' },
    { id: 'cafe', name: '카페', icon: 'cafe', type: 'Ionicons' },
    { id: 'store', name: '편의점', icon: 'store', type: 'MaterialIcons' },
    { id: 'pharmacy', name: '약국', icon: 'medical', type: 'Ionicons' },
    { id: 'parking', name: '주차장', icon: 'local-parking', type: 'MaterialIcons' },
    { id: 'toilet', name: '화장실', icon: 'wc', type: 'MaterialIcons' },
    { id: 'atm', name: 'ATM', icon: 'atm', type: 'MaterialIcons' },
    { id: 'more', name: '더보기', icon: 'grid', type: 'Ionicons' },
  ];

  const RECENT_STATIONS = [
    { id: 'gangnam', name: '강남역', nameEng: 'Gangnam', line: '2호선', color: COLORS.line2, lineNum: '2' },
    { id: 'seoul', name: '서울역', nameEng: 'Seoul Stn.', line: '1호선', color: COLORS.line1, lineNum: '1' },
    { id: 'hongik', name: '홍대입구역', nameEng: 'Hongik Univ.', line: '2호선', color: COLORS.line2, lineNum: '2' },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image 
              source={require('@/assets/images/character_design.svg')} 
              style={styles.headerMascot}
              contentFit="contain"
            />
            <ThemedText style={styles.headerTitle}>역앞</ThemedText>
          </View>
          <TouchableOpacity style={styles.headerIcon}>
            <Ionicons name="search" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <TouchableOpacity style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#4A69BD" style={styles.searchIcon} />
            <ThemedText style={styles.searchText}>어느 역으로 갈까요?</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Notice Banner */}
        <View style={styles.noticeSection}>
          <LinearGradient
            colors={[COLORS.secondary, '#4A7C63']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.noticeCard}
          >
            <View style={styles.noticeContent}>
              <View style={styles.noticeTag}>
                <ThemedText style={styles.noticeTagText}>Notice</ThemedText>
              </View>
              <ThemedText style={styles.noticeTitle}>오늘부터 강남역 주변 할인 혜택 시작!</ThemedText>
              <ThemedText style={styles.noticeSub}>역앞 캐릭터 '역이'와 함께 새로운 맛집 지도를 확인해보세요.</ThemedText>
            </View>
            <View style={styles.noticeImageContainer}>
              <Image 
                source={require('@/assets/images/character_design.svg')} 
                style={styles.characterImage}
                contentFit="contain"
              />
            </View>
          </LinearGradient>
        </View>

        {/* Recent Stations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>최근 본 역</ThemedText>
            <TouchableOpacity>
              <ThemedText style={styles.seeAllText}>전체보기</ThemedText>
            </TouchableOpacity>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.recentList}
          >
            {RECENT_STATIONS.map((station) => (
              <View key={station.id} style={styles.recentCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.lineBadge, { backgroundColor: station.color }]}>
                    <ThemedText style={styles.lineBadgeText}>{station.lineNum}</ThemedText>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="heart-outline" size={20} color="#C7C7CC" />
                  </TouchableOpacity>
                </View>
                <View style={styles.cardBody}>
                  <ThemedText style={styles.stationName}>{station.name}</ThemedText>
                  <ThemedText style={styles.stationNameEng}>{station.nameEng}</ThemedText>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Facility Search */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>주변 시설 찾기</ThemedText>
          <View style={styles.facilityGrid}>
            {FACILITIES.map((facility) => (
              <TouchableOpacity key={facility.id} style={styles.facilityItem}>
                <View style={styles.facilityIconContainer}>
                  {facility.type === 'MaterialIcons' ? (
                    <MaterialIcons name={facility.icon as any} size={24} color={COLORS.primary} />
                  ) : (
                    <Ionicons name={facility.icon as any} size={24} color={COLORS.primary} />
                  )}
                </View>
                <ThemedText style={styles.facilityName}>{facility.name}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby Station Card */}
        <View style={styles.section}>
          <View style={styles.nearbyCard}>
             <View style={styles.nearbyHeader}>
               <Ionicons name="location" size={18} color={COLORS.primary} />
               <ThemedText style={styles.nearbyTitle}>현재 내 주변 역</ThemedText>
             </View>
             {nearestStation ? (
               <View style={styles.nearbyContent}>
                 <View>
                   <ThemedText style={styles.nearbyStationName}>{nearestStation.station_name}</ThemedText>
                   <ThemedText style={styles.nearbyStationInfo}>
                     {nearestStation.line_name} · 도보 {(nearestStation.distance * 15).toFixed(0)}분
                   </ThemedText>
                 </View>
                 <TouchableOpacity style={styles.routeBtn}>
                   <ThemedText style={styles.routeBtnText}>길찾기</ThemedText>
                 </TouchableOpacity>
               </View>
             ) : (
               <View style={styles.nearbyLoading}>
                 <ActivityIndicator size="small" color={COLORS.primary} />
                 <ThemedText style={styles.loadingText}>위치 정보를 확인 중입니다...</ThemedText>
               </View>
             )}
          </View>
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="map" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  headerWrapper: { backgroundColor: 'white' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerMascot: { width: 36, height: 36 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginLeft: 4 },
  headerIcon: { padding: 4 },
  content: { flex: 1 },
  searchSection: { paddingHorizontal: 20, marginTop: 20 },
  searchBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.searchBg, 
    borderRadius: 25, 
    paddingHorizontal: 16, 
    height: 50 
  },
  searchIcon: { marginRight: 10 },
  searchText: { fontSize: 16, color: '#4A69BD', fontWeight: '500' },
  noticeSection: { paddingHorizontal: 20, marginTop: 24 },
  noticeCard: { 
    borderRadius: 20, 
    padding: 20, 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    overflow: 'hidden'
  },
  noticeContent: { flex: 1, zIndex: 1, paddingRight: 40 },
  noticeTag: { 
    backgroundColor: '#FDE68A', 
    alignSelf: 'flex-start', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 8,
    marginBottom: 10
  },
  noticeTagText: { fontSize: 11, fontWeight: '700', color: '#8B6E2C' },
  noticeTitle: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 8 },
  noticeSub: { fontSize: 13, color: 'white', opacity: 0.9, lineHeight: 18 },
  noticeImageContainer: { position: 'absolute', right: -25, bottom: -30 },
  characterImage: { 
    width: 140, 
    height: 140, 
    opacity: 0.35, 
    transform: [{ rotate: '-15deg' }] 
  },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  seeAllText: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },
  recentList: { paddingRight: 20 },
  recentCard: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    marginRight: 16, 
    width: 150,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  lineBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  lineBadgeText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cardBody: { marginTop: 8 },
  stationName: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  stationNameEng: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  facilityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  facilityItem: { width: (width - 40) / 4, alignItems: 'center', marginBottom: 20 },
  facilityIconContainer: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: '#F0F4F2', 
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 8
  },
  facilityName: { fontSize: 13, color: COLORS.textMain, fontWeight: '600' },
  nearbyCard: { 
    backgroundColor: 'white', 
    borderRadius: 24, 
    padding: 20,
    borderLeftWidth: 6,
    borderLeftColor: COLORS.primary,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 5
  },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  nearbyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginLeft: 6 },
  nearbyContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nearbyStationName: { fontSize: 24, fontWeight: '900', color: COLORS.textMain },
  nearbyStationInfo: { fontSize: 14, color: COLORS.textSub, marginTop: 4 },
  routeBtn: { 
    backgroundColor: COLORS.primary, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20 
  },
  routeBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  nearbyLoading: { padding: 10, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: COLORS.textSub },
  fab: { 
    position: 'absolute', 
    right: 20, 
    bottom: 30, 
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
  }
});