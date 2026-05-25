import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Dimensions
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { LINE_CONFIG, getLineColor } from '@/constants/lines';
import { useSubwayData } from '@/hooks/useSubwayData';

const { width } = Dimensions.get('window');

// ActionCable은 브라우저 이벤트 API를 가정하므로 RN에서 패치 필요
if (typeof global.addEventListener !== 'function') {
  (global as any).addEventListener = () => {};
}
if (typeof global.removeEventListener !== 'function') {
  (global as any).removeEventListener = () => {};
}

const RECENT_STATIONS_KEY = 'recent_stations';

export const saveRecentStation = async (station: any) => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_STATIONS_KEY);
    const existing: any[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter(s => !(s.station_name === station.station_name && s.line_name === station.line_name));
    const updated = [station, ...filtered].slice(0, 10);
    await AsyncStorage.setItem(RECENT_STATIONS_KEY, JSON.stringify(updated));
  } catch {}
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { stationList, isConnected } = useSubwayData();
  const [followedLines, setFollowedLines] = useState<string[]>([]);
  const [showOnlyFollowed, setShowOnlyFollowed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [recentStations, setRecentStations] = useState<any[]>([]);

  useEffect(() => {
    loadPreferences();
    requestLocationPermission();
  }, []);

  const loadPreferences = async () => {
    const [savedLines, savedRecent] = await Promise.all([
      AsyncStorage.getItem('followed_lines'),
      AsyncStorage.getItem(RECENT_STATIONS_KEY),
    ]);
    if (savedLines) setFollowedLines(JSON.parse(savedLines));
    if (savedRecent) setRecentStations(JSON.parse(savedRecent));
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const lastLocation = await Location.getLastKnownPositionAsync({});
      if (lastLocation) setUserLocation(lastLocation);

      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Location.LocationObject;
        setUserLocation(location);
      } catch {
        if (!userLocation) {
          setUserLocation({
            coords: { latitude: 37.4979, longitude: 127.0276 },
            timestamp: Date.now(),
          } as any);
        }
      }
    } catch {}
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const nearestStation = useMemo(() => {
    if (!userLocation || stationList.length === 0) return null;
    let minDistance = Infinity;
    let nearest: any = null;
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
    const levelOrder: Record<string, number> = { '폭발': 4, '혼잡': 3, '보통': 2, '여유': 1 };
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
      const transfers = Array.from(new Set(lineStations.flatMap(s =>
        s.transfer_info ? s.transfer_info.split(',') : []
      ))).filter((t: any) => t.trim() !== line.name).slice(0, 5);
      let msg = '원활하게 운행 중입니다';
      if (worstStation.congestion_level === '폭발' || worstStation.congestion_level === '혼잡') {
        msg = `${worstStation.station_name.replace('역', '')} 매우 혼잡`;
      } else if (worstStation.arrival_message) {
        msg = worstStation.arrival_message;
      }
      return { ...line, status: worstStation.congestion_level || '여유', msg, transfers, detailedTransfers };
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

  const toggleFollow = async (id: string) => {
    const updated = followedLines.includes(id)
      ? followedLines.filter(l => l !== id)
      : [...followedLines, id];
    setFollowedLines(updated);
    await AsyncStorage.setItem('followed_lines', JSON.stringify(updated));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '폭발': return '#FF3B30';
      case '혼잡': return '#FF9500';
      case '보통': return '#FFCC00';
      default: return '#34C759';
    }
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

  const handleNearbyStationPress = async () => {
    if (nearestStation) {
      await saveRecentStation(nearestStation);
      router.push('/(tabs)/search');
    }
  };

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
          <View style={styles.headerRight}>
            <View style={[styles.connectionDot, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]} />
            <TouchableOpacity style={styles.headerIcon}>
              <Ionicons name="search" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
            <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
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

        {/* 노선 혼잡도 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>실시간 혼잡도</ThemedText>
            <View style={[styles.liveDot, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]}>
              <ThemedText style={styles.liveText}>{isConnected ? 'LIVE' : 'OFF'}</ThemedText>
            </View>
          </View>

          {/* 전체 / 즐겨찾기 토글 */}
          <View style={styles.filterToggle}>
            <TouchableOpacity
              style={[styles.toggleBtn, !showOnlyFollowed && styles.toggleBtnActive]}
              onPress={() => setShowOnlyFollowed(false)}
            >
              <ThemedText style={[styles.toggleBtnText, !showOnlyFollowed && styles.toggleBtnTextActive]}>
                전체
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, showOnlyFollowed && styles.toggleBtnActive]}
              onPress={() => setShowOnlyFollowed(true)}
            >
              <Ionicons
                name="heart"
                size={12}
                color={showOnlyFollowed ? 'white' : COLORS.textSub}
                style={{ marginRight: 4 }}
              />
              <ThemedText style={[styles.toggleBtnText, showOnlyFollowed && styles.toggleBtnTextActive]}>
                즐겨찾기 {followedLines.length > 0 ? `(${followedLines.length})` : ''}
              </ThemedText>
            </TouchableOpacity>
          </View>

          {stationList.length === 0 ? (
            <View style={styles.congestionLoading}>
              <ActivityIndicator color={COLORS.primary} />
              <ThemedText style={styles.loadingText}>노선 데이터 수신 중...</ThemedText>
            </View>
          ) : (() => {
            const displayLines = showOnlyFollowed
              ? filteredLines.filter(l => followedLines.includes(l.name))
              : filteredLines;

            if (showOnlyFollowed && displayLines.length === 0) {
              return (
                <View style={styles.emptyFollowed}>
                  <Ionicons name="heart-outline" size={36} color={COLORS.textSub} />
                  <ThemedText style={styles.emptyFollowedText}>즐겨찾기한 노선이 없어요</ThemedText>
                  <ThemedText style={styles.emptyFollowedSub}>노선 목록에서 ♥를 눌러 추가하세요</ThemedText>
                </View>
              );
            }

            return (
              <View style={styles.congestionList}>
                {displayLines.map((line, idx) => (
                  <View key={line.id} style={[styles.lineRow, idx === displayLines.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={[styles.lineCircle, { backgroundColor: line.color }]}>
                      <ThemedText style={styles.lineCircleText}>
                        {line.name.match(/(\d+)/)?.[1] || line.name.slice(0, 2)}
                      </ThemedText>
                    </View>
                    <View style={styles.lineInfo}>
                      <ThemedText style={styles.lineName}>{line.name}</ThemedText>
                      <ThemedText style={styles.lineMsg} numberOfLines={1}>{line.msg}</ThemedText>
                    </View>
                    <TouchableOpacity
                      onPress={() => toggleFollow(line.name)}
                      style={{ marginRight: 10 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons
                        name={followedLines.includes(line.name) ? 'heart' : 'heart-outline'}
                        size={18}
                        color={followedLines.includes(line.name) ? '#FF3B30' : '#C7C7CC'}
                      />
                    </TouchableOpacity>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(line.status) + '22' }]}>
                      <ThemedText style={[styles.statusText, { color: getStatusColor(line.status) }]}>
                        {line.status}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        {/* Recent Stations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>최근 본 역</ThemedText>
            <TouchableOpacity>
              <ThemedText style={styles.seeAllText}>전체보기</ThemedText>
            </TouchableOpacity>
          </View>
          {recentStations.length === 0 ? (
            <View style={styles.emptyRecent}>
              <Ionicons name="train-outline" size={32} color={COLORS.textSub} />
              <ThemedText style={styles.emptyRecentText}>최근 본 역이 없습니다</ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentList}
            >
              {recentStations.slice(0, 10).map((station, idx) => (
                <View key={`${station.station_name}-${idx}`} style={styles.recentCard}>
                  <View style={styles.cardHeader}>
                    <View style={[styles.lineBadge, { backgroundColor: getLineColor(station.line_name) }]}>
                      <ThemedText style={styles.lineBadgeText}>
                        {station.line_name?.match(/(\d+)/)?.[1] || 'M'}
                      </ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => toggleFollow(station.line_name)}>
                      <Ionicons
                        name={followedLines.includes(station.line_name) ? 'heart' : 'heart-outline'}
                        size={20}
                        color={followedLines.includes(station.line_name) ? '#FF3B30' : '#C7C7CC'}
                      />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.cardBody}>
                    <ThemedText style={styles.stationName}>{station.station_name}</ThemedText>
                    <ThemedText style={styles.stationNameSub}>{station.line_name}</ThemedText>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
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
                <TouchableOpacity style={styles.routeBtn} onPress={handleNearbyStationPress}>
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
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMascot: { width: 36, height: 36 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginLeft: 4 },
  headerIcon: { padding: 4 },
  connectionDot: { width: 8, height: 8, borderRadius: 4 },
  content: { flex: 1 },
  searchSection: { paddingHorizontal: 20, marginTop: 20 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBg,
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 50,
  },
  searchIcon: { marginRight: 10 },
  searchText: { fontSize: 16, color: COLORS.primary, fontWeight: '500' },
  noticeSection: { paddingHorizontal: 20, marginTop: 24 },
  noticeCard: {
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  noticeContent: { flex: 1, zIndex: 1, paddingRight: 40 },
  noticeTag: {
    backgroundColor: '#FDE68A',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 10,
  },
  noticeTagText: { fontSize: 11, fontWeight: '700', color: '#8B6E2C' },
  noticeTitle: { fontSize: 18, fontWeight: '800', color: 'white', marginBottom: 8 },
  noticeSub: { fontSize: 13, color: 'white', opacity: 0.9, lineHeight: 18 },
  noticeImageContainer: { position: 'absolute', right: -25, bottom: -30 },
  characterImage: { width: 140, height: 140, opacity: 0.35, transform: [{ rotate: '-15deg' }] },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textMain },
  seeAllText: { fontSize: 14, color: COLORS.secondary, fontWeight: '600' },
  emptyRecent: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyRecentText: { fontSize: 14, color: COLORS.textSub },
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
    elevation: 3,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  lineBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  lineBadgeText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  cardBody: { marginTop: 8 },
  stationName: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  stationNameSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  facilityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  facilityItem: { width: (width - 40) / 4, alignItems: 'center', marginBottom: 20 },
  facilityIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F0F4F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
    elevation: 5,
  },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  nearbyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textMain, marginLeft: 6 },
  nearbyContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nearbyStationName: { fontSize: 24, fontWeight: '900', color: COLORS.textMain },
  nearbyStationInfo: { fontSize: 14, color: COLORS.textSub, marginTop: 4 },
  routeBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  routeBtnText: { color: 'white', fontSize: 14, fontWeight: '700' },
  nearbyLoading: { padding: 10, alignItems: 'center' },
  loadingText: { marginTop: 8, fontSize: 12, color: COLORS.textSub },

  // 노선 혼잡도
  filterToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  toggleBtnTextActive: { color: 'white' },
  emptyFollowed: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyFollowedText: { fontSize: 15, fontWeight: '700', color: COLORS.textSub },
  emptyFollowedSub: { fontSize: 13, color: COLORS.textSub },
  liveDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  liveText: { fontSize: 11, fontWeight: '800', color: 'white' },
  congestionLoading: { paddingVertical: 24, alignItems: 'center', gap: 10 },
  congestionList: {
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lineCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lineCircleText: { color: 'white', fontSize: 13, fontWeight: '800' },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  lineMsg: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 12, fontWeight: '800' },
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
    elevation: 8,
  },
});
