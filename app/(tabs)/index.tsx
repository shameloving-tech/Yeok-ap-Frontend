import { Ionicons } from '@expo/vector-icons';
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

import { ThemedText } from '@/components/themed-text';

// 모바일 환경 호환성 패치 
if (typeof global.addEventListener !== 'function') {
  (global as any).addEventListener = () => {};
}
if (typeof global.removeEventListener !== 'function') {
  (global as any).removeEventListener = () => {};
}

const SERVER_URL = 'ws://192.168.45.88:3000/cable';
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

export default function HomeScreen() {
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

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    } catch (error) {
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

  const renderLineItem = (line: any) => {
    const isFollowed = followedLines.includes(line.id);
    const isExpanded = expandedLine === line.id;
    return (
      <View key={line.id} style={styles.lineItemContainer}>
        <TouchableOpacity style={[styles.lineItem, isExpanded && styles.expandedItem]} onPress={() => setExpandedLine(isExpanded ? null : line.id)} activeOpacity={0.7}>
          <View style={[styles.lineBadge, { backgroundColor: line.color }]}><ThemedText style={styles.lineBadgeText}>{line.name[0]}</ThemedText></View>
          <View style={styles.lineInfo}>
            <View style={styles.lineHeader}>
              <ThemedText style={styles.lineName}>{line.name}</ThemedText>
              <View style={[styles.statusTag, { backgroundColor: getStatusColor(line.status) + '20' }]}><ThemedText style={[styles.statusTagText, { color: getStatusColor(line.status) }]}>{line.status}</ThemedText></View>
            </View>
            <View style={styles.msgRow}>
              <ThemedText style={styles.lineMsg} numberOfLines={1}>{line.msg}</ThemedText>
              {!isExpanded && line.transfers && line.transfers.length > 0 && (
                <View style={styles.transferDots}>{line.transfers.map((t: string) => <View key={t} style={[styles.tDot, { backgroundColor: getTransferColor(t) }]} />)}</View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => toggleFollow(line.id)} style={styles.followBtn}><Ionicons name={isFollowed ? "star" : "star-outline"} size={22} color={isFollowed ? "#FFCC00" : "#C7C7CC"} /></TouchableOpacity>
        </TouchableOpacity>
        {isExpanded && (
          <View style={styles.detailsContainer}>
            <ThemedText style={styles.detailsTitle}>주요 환승역 연계 정보</ThemedText>
            {line.detailedTransfers && line.detailedTransfers.length > 0 ? (
              line.detailedTransfers.map((dt: any, idx: number) => (
                <View key={idx} style={styles.transferStationRow}>
                  <ThemedText style={styles.transferStationName}>{dt.stationName}</ThemedText>
                  <View style={styles.transferLineList}>
                    {dt.lines.map((tl: any, lIdx: number) => (
                      <View key={lIdx} style={[styles.miniLineTag, { borderColor: getTransferColor(tl.name) + '40' }]}>
                        <ThemedText style={[styles.miniLineText, { color: getTransferColor(tl.name) }]}>{tl.name}</ThemedText>
                        <View style={[styles.miniStatusDot, { backgroundColor: getStatusColor(tl.status) }]} />
                      </View>
                    ))}
                  </View>
                </View>
              ))
            ) : <ThemedText style={styles.noDataText}>실시간 환승 정보가 없습니다.</ThemedText>}
            <TouchableOpacity style={styles.viewCommunityBtn}>
              <ThemedText style={styles.viewCommunityText}>{line.name} 커뮤니티 보기</ThemedText>
              <Ionicons name="arrow-forward" size={14} color="#FF9F43" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const handleToggleSearch = () => {
    if (isSearchMode) setSearchQuery('');
    setIsSearchMode(!isSearchMode);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF9F43', '#FFBD69']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerTop}>
            {isSearchMode ? (
              <View style={styles.searchBarContainer}>
                <Ionicons name="search" size={20} color="white" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="노선 또는 환승역 검색"
                  placeholderTextColor="rgba(255,255,255,0.7)"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus
                />
                <TouchableOpacity onPress={handleToggleSearch}>
                  <Ionicons name="close-circle" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View>
                  <ThemedText style={styles.headerTitle}>역앞</ThemedText>
                  <ThemedText style={styles.headerSub}>{isConnected ? '● 실시간 데이터 수신 중' : '○ 서버 연결 확인 중...'}</ThemedText>
                </View>
                <TouchableOpacity style={styles.searchBtn} onPress={handleToggleSearch}>
                  <Ionicons name="search" size={24} color="white" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </SafeAreaView>
      </LinearGradient>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {!isSearchMode && searchQuery === '' && (
          <>
            <View style={styles.nearestSection}>
              <View style={styles.sectionHeader}>
                <Ionicons name="location" size={16} color="#FF9F43" />
                <ThemedText style={[styles.sectionTitle, { marginLeft: 4 }]}>내 주변 역 정보</ThemedText>
              </View>
              {nearestStation ? (
                <View style={styles.nearestCard}>
                  <View style={styles.nearestTop}>
                    <View style={[styles.nearestLineBadge, { backgroundColor: getTransferColor(nearestStation.line_name) }]}>
                      <ThemedText style={styles.nearestLineText}>{nearestStation.line_name[0]}</ThemedText>
                    </View>
                    <View style={styles.nearestInfo}>
                      <ThemedText style={styles.nearestName}>{nearestStation.station_name}</ThemedText>
                      <ThemedText style={styles.nearestDistance}>{(nearestStation.distance * 1000).toFixed(0)}m 거리</ThemedText>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: getStatusColor(nearestStation.congestion_level) + '20' }]}>
                      <ThemedText style={[styles.statusTagText, { color: getStatusColor(nearestStation.congestion_level) }]}>
                        {nearestStation.congestion_level}
                      </ThemedText>
                    </View>
                  </View>
                  <View style={styles.nearestArrival}>
                    <Ionicons name="train" size={16} color="#8E8E93" />
                    <ThemedText style={styles.arrivalMsg} numberOfLines={1}>{nearestStation.arrival_message}</ThemedText>
                  </View>
                </View>
              ) : (
                <View style={styles.loadingNearest}>
                  <ActivityIndicator size="small" color="#FF9F43" />
                  <ThemedText style={styles.loadingText}>
                    {locationError || (!userLocation ? 'GPS 신호를 잡고 있습니다...' : '서버에서 역 정보를 가져오고 있습니다...')}
                  </ThemedText>
                </View>
              )}
            </View>

            {followedLines.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}><ThemedText style={styles.sectionTitle}>관심 노선</ThemedText><ThemedText style={styles.countText}>{followedLines.length}</ThemedText></View>
                {filteredLines.filter(l => followedLines.includes(l.id)).map(renderLineItem)}
              </View>
            )}
          </>
        )}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>{isSearchMode ? '검색 결과' : '수도권 노선'}</ThemedText>
            <ThemedText style={styles.countText}>
              {isSearchMode ? filteredLines.length : filteredLines.filter(l => !followedLines.includes(l.id)).length}
            </ThemedText>
          </View>
          {isSearchMode 
            ? filteredLines.map(renderLineItem)
            : filteredLines.filter(l => !followedLines.includes(l.id)).map(renderLineItem)
          }
          {isSearchMode && filteredLines.length === 0 && (
            <View style={styles.emptySearchResult}>
              <Ionicons name="search-outline" size={48} color="#C7C7CC" />
              <ThemedText style={styles.emptySearchText}>검색 결과가 없습니다.</ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, minHeight: 48 },
  headerTitle: { fontSize: 28, fontWeight: '900', color: 'white' },
  headerSub: { fontSize: 12, color: 'white', opacity: 0.8 },
  searchBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  searchBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: 'white', fontSize: 16, fontWeight: '600' },
  content: { flex: 1 },
  nearestSection: { marginTop: 24, paddingHorizontal: 16 },
  nearestCard: { backgroundColor: 'white', padding: 16, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
  nearestTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  nearestLineBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  nearestLineText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  nearestInfo: { flex: 1, marginLeft: 12 },
  nearestName: { fontSize: 18, fontWeight: '800', color: '#1C1C1E' },
  nearestDistance: { fontSize: 12, color: '#8E8E93', marginTop: 1 },
  nearestArrival: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 12, borderRadius: 12 },
  arrivalMsg: { marginLeft: 8, fontSize: 14, color: '#48484A', fontWeight: '500', flex: 1 },
  loadingNearest: { backgroundColor: 'white', padding: 20, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  loadingText: { marginLeft: 10, color: '#8E8E93', fontSize: 14 },
  section: { marginTop: 24, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingLeft: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#8E8E93' },
  countText: { fontSize: 13, color: '#AEAEB2', marginLeft: 6 },
  lineItemContainer: { marginBottom: 12 },
  lineItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  expandedItem: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, shadowOpacity: 0 },
  lineBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  lineBadgeText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  lineInfo: { flex: 1, marginLeft: 16 },
  lineHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  lineName: { fontSize: 17, fontWeight: '700', color: '#1C1C1E' },
  statusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
  statusTagText: { fontSize: 11, fontWeight: '700' },
  lineMsg: { fontSize: 14, color: '#8E8E93', flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  transferDots: { flexDirection: 'row', gap: 4, marginLeft: 10 },
  tDot: { width: 8, height: 8, borderRadius: 4 },
  followBtn: { padding: 8 },
  detailsContainer: { backgroundColor: 'white', padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, borderTopWidth: 1, borderTopColor: '#F2F2F7', marginTop: -1 },
  detailsTitle: { fontSize: 13, fontWeight: '700', color: '#8E8E93', marginBottom: 15, textTransform: 'uppercase' },
  transferStationRow: { marginBottom: 12 },
  transferStationName: { fontSize: 15, fontWeight: '600', color: '#1C1C1E', marginBottom: 6 },
  transferLineList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  miniLineTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, backgroundColor: '#F8F9FA' },
  miniLineText: { fontSize: 11, fontWeight: '700', marginRight: 4 },
  miniStatusDot: { width: 6, height: 6, borderRadius: 3 },
  noDataText: { fontSize: 14, color: '#AEAEB2', textAlign: 'center', marginVertical: 10 },
  viewCommunityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 15, paddingVertical: 10, backgroundColor: '#FFF9F2', borderRadius: 12 },
  viewCommunityText: { fontSize: 13, fontWeight: '700', color: '#FF9F43', marginRight: 5 },
  emptySearchResult: { alignItems: 'center', justifyContent: 'center', marginTop: 40, opacity: 0.5 },
  emptySearchText: { marginTop: 12, fontSize: 16, color: '#8E8E93' }
});