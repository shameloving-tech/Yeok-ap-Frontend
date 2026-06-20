import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
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
import { StationDetailModal } from '@/components/StationDetailModal';
import { TrainLocationSheet } from '@/app/components/TrainLocationSheet';
import { LineMapModal } from '@/app/components/LineMapModal';
import { APP_COLORS as COLORS, SHADOW } from '@/constants/theme';
import { LINE_CONFIG, getLineColor, getLineNumber } from '@/constants/lines';
import { useSubwayDataContext } from '@/contexts/SubwayDataContext';
import { FavoriteStation, getFavoriteStations } from '@/utils/favorites';
import { FavoriteRoute, getFavoriteRoutes } from '@/utils/favoriteRoutes';
import { AdBanner } from '@/components/AdBanner';
import { useAds } from '@/hooks/useAds';

const { width } = Dimensions.get('window');

if (typeof global.addEventListener !== 'function') {
  (global as any).addEventListener = () => {};
}
if (typeof global.removeEventListener !== 'function') {
  (global as any).removeEventListener = () => {};
}

const RECENT_STATIONS_KEY = 'recent_stations';
const MAX_NEARBY_KM = 5;

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
  const homeBannerAd = useAds('home_banner');
  const { stationList, isConnected } = useSubwayDataContext();
  const [followedLines, setFollowedLines] = useState<string[]>([]);
  const [showOnlyFollowed, setShowOnlyFollowed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<Location.LocationObject | null>(null);
  const [locationLoaded, setLocationLoaded] = useState(false);
  const [recentStations, setRecentStations] = useState<any[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [detailStation, setDetailStation] = useState<any>(null);
  const [trainSheetOpen, setTrainSheetOpen] = useState(false);
  const [congestionLine, setCongestionLine] = useState<string | null>(null);
  const [favRoutes, setFavRoutes] = useState<FavoriteRoute[]>([]);

  const openStationDetail = (station: any) => setDetailStation(station);

  useEffect(() => {
    loadPreferences();
    requestLocationPermission();
  }, []);

  // 다른 탭에서 경로 저장 후 돌아왔을 때 최신 데이터 반영
  useFocusEffect(useCallback(() => {
    getFavoriteRoutes().then(setFavRoutes);
  }, []));

  const loadPreferences = async () => {
    const [savedLines, savedRecent, savedFavs, savedFavRoutes] = await Promise.all([
      AsyncStorage.getItem('followed_lines'),
      AsyncStorage.getItem(RECENT_STATIONS_KEY),
      getFavoriteStations(),
      getFavoriteRoutes(),
    ]);
    if (savedLines) setFollowedLines(JSON.parse(savedLines));
    if (savedRecent) setRecentStations(JSON.parse(savedRecent));
    setFavoriteStations(savedFavs);
    setFavRoutes(savedFavRoutes);
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationLoaded(true);
        return;
      }

      const lastLocation = await Location.getLastKnownPositionAsync({});
      if (lastLocation) setUserLocation(lastLocation);

      try {
        const location = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
        ]) as Location.LocationObject;
        setUserLocation(location);
      } catch {
        // GPS timeout — keep last known position (may be null if first run)
      }
    } catch {}
    finally {
      setLocationLoaded(true);
    }
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
    if (minDistance > MAX_NEARBY_KM) return null;
    return nearest;
  }, [userLocation, stationList]);

  const favoriteStationsWithStatus = useMemo(() => {
    return favoriteStations.map(fav => {
      const live = stationList.find(s => s.station_name === fav.station_name && s.line_name === fav.line_name);
      const notOperating = live?.arrival_message === "운행 종료";
      return {
        station_name: fav.station_name,
        line_name: fav.line_name,
        congestion_level: notOperating ? null : (live?.congestion_level ?? null),
        arrival_message: live?.arrival_message ?? null,
      };
    });
  }, [favoriteStations, stationList]);

  const processedLines = useMemo(() => {
    const levelOrder: Record<string, number> = { '폭발': 4, '혼잡': 3, '보통': 2, '여유': 1 };
    return LINE_CONFIG.map(line => {
      const lineStations = stationList.filter(s => s.line_name === line.name);

      // 백엔드가 막차 감지 시 arrival_message = "운행 종료" 세팅
      if (lineStations.length > 0 && lineStations.every(s => s.arrival_message === "운행 종료")) {
        return { ...line, status: '운행종료', msg: '운행 종료 · 첫차 05:30~', transfers: [], detailedTransfers: [] };
      }
      if (lineStations.length === 0) {
        return { ...line, status: '정보없음', msg: '혼잡도 정보 없음', transfers: [], detailedTransfers: [] };
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
            return { name: tName.trim(), status: targetLineData?.congestion_level ?? '정보없음' };
          })
        })).slice(0, 3);
      const transfers = Array.from(new Set(lineStations.flatMap(s =>
        s.transfer_info ? s.transfer_info.split(',') : []
      ))).filter((t: any) => t.trim() !== line.name).slice(0, 5);
      let msg = worstStation.congestion_level ? '원활하게 운행 중입니다' : '혼잡도 정보 없음';
      if (worstStation.congestion_level === '폭발' || worstStation.congestion_level === '혼잡') {
        msg = `${worstStation.station_name.replace(/역$/, '')} 매우 혼잡`;
      } else if (worstStation.congestion_level === '보통') {
        msg = '일부 구간 혼잡';
      }
      return { ...line, status: worstStation.congestion_level ?? '정보없음', msg, transfers, detailedTransfers };
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
      case '여유': return '#34C759';
      case '운행종료': return '#8E8E93';
      default: return '#8E8E93';
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
        <View style={styles.searchSection}>
          <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/(tabs)/search')}>
            <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
            <ThemedText style={styles.searchText}>어느 역으로 갈까요?</ThemedText>
          </TouchableOpacity>
        </View>

        {homeBannerAd && (
          <AdBanner ad={homeBannerAd} style={{ marginHorizontal: 16, marginTop: 8 }} />
        )}

        {/* ── 즐겨찾기 경로 ── */}
        {favRoutes.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>저장된 경로</ThemedText>
              <ThemedText style={styles.sectionSub}>{favRoutes.length}개</ThemedText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
              {favRoutes.map((r) => {
                const hour = new Date().getHours();
                const isCommute = (r.label === '출근' && hour >= 6 && hour < 10) ||
                                  (r.label === '퇴근' && hour >= 17 && hour < 22);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.routeCard, isCommute && styles.routeCardCommute]}
                    onPress={() => router.push({ pathname: '/(tabs)/search', params: { from: r.from, to: r.to } })}
                  >
                    {r.label && (
                      <View style={[styles.routeLabel, isCommute && styles.routeLabelCommute]}>
                        <ThemedText style={[styles.routeLabelText, isCommute && { color: 'white' }]}>
                          {r.label === '출근' ? '🏢' : r.label === '퇴근' ? '🏠' : '📍'} {r.label}
                        </ThemedText>
                      </View>
                    )}
                    <ThemedText style={styles.routeFrom} numberOfLines={1}>{r.from}</ThemedText>
                    <View style={styles.routeArrow}>
                      <View style={styles.routeArrowLine} />
                      <Ionicons name="chevron-forward" size={10} color={COLORS.textSub} />
                    </View>
                    <ThemedText style={styles.routeTo} numberOfLines={1}>{r.to}</ThemedText>
                    {r.totalMin && (
                      <ThemedText style={styles.routeMin}>{r.totalMin}분</ThemedText>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {favoriteStationsWithStatus.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>즐겨찾기 역</ThemedText>
              <ThemedText style={styles.sectionSub}>{favoriteStationsWithStatus.length}개</ThemedText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentList}>
              {favoriteStationsWithStatus.map((fav, idx) => (
                <TouchableOpacity
                  key={`${fav.station_name}-${fav.line_name}-${idx}`}
                  style={styles.recentCard}
                  onPress={() => openStationDetail(fav)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.lineBadge, { backgroundColor: getLineColor(fav.line_name) }]}>
                      <ThemedText style={styles.lineBadgeText}>{getLineNumber(fav.line_name)}</ThemedText>
                    </View>
                    <Ionicons name="heart" size={18} color="#FF3B30" />
                  </View>
                  <View style={styles.cardBody}>
                    <ThemedText style={styles.stationName}>{fav.station_name}</ThemedText>
                    <ThemedText style={styles.stationNameSub}>{fav.line_name}</ThemedText>
                  </View>
                  {fav.arrival_message === "운행 종료" ? (
                    <View style={[styles.miniBadge, { backgroundColor: '#8E8E9322' }]}>
                      <ThemedText style={[styles.miniBadgeText, { color: '#8E8E93' }]}>운행종료</ThemedText>
                    </View>
                  ) : fav.congestion_level ? (
                    <View style={[styles.miniBadge, { backgroundColor: getStatusColor(fav.congestion_level) + '22' }]}>
                      <ThemedText style={[styles.miniBadgeText, { color: getStatusColor(fav.congestion_level) }]}>
                        {fav.congestion_level}
                      </ThemedText>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>실시간 혼잡도</ThemedText>
            <View style={[styles.liveDot, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]}>
              <ThemedText style={styles.liveText}>{isConnected ? 'LIVE' : 'OFF'}</ThemedText>
            </View>
          </View>

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
                  <TouchableOpacity
                    key={line.id}
                    style={[styles.lineRow, idx === displayLines.length - 1 && { borderBottomWidth: 0 }]}
                    activeOpacity={0.7}
                    onPress={() => setCongestionLine(line.name)}
                  >
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
                      onPress={(e) => { e.stopPropagation(); toggleFollow(line.name); }}
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
                    <Ionicons name="chevron-forward" size={14} color="#C7C7CC" style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </View>

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
                <TouchableOpacity
                  key={`${station.station_name}-${idx}`}
                  style={styles.recentCard}
                  onPress={() => openStationDetail(station)}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.lineBadge, { backgroundColor: getLineColor(station.line_name) }]}>
                      <ThemedText style={styles.lineBadgeText}>{getLineNumber(station.line_name)}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textSub} />
                  </View>
                  <View style={styles.cardBody}>
                    <ThemedText style={styles.stationName}>{station.station_name}</ThemedText>
                    <ThemedText style={styles.stationNameSub}>{station.line_name}</ThemedText>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

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
                <TouchableOpacity style={styles.routeBtn} onPress={() => openStationDetail(nearestStation)}>
                  <ThemedText style={styles.routeBtnText}>상세</ThemedText>
                </TouchableOpacity>
              </View>
            ) : locationLoaded ? (
              <View style={styles.nearbyEmpty}>
                <Ionicons name="location-outline" size={28} color={COLORS.textSub} />
                <ThemedText style={styles.nearbyEmptyText}>주변 5km 이내에 지하철역이 없습니다</ThemedText>
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

      <TouchableOpacity
        style={[styles.fab, { bottom: 16 }]}
        onPress={() => setTrainSheetOpen(true)}
      >
        <Ionicons name="train" size={24} color="white" />
      </TouchableOpacity>

      <TrainLocationSheet visible={trainSheetOpen} onClose={() => setTrainSheetOpen(false)} />

      <LineMapModal
        visible={!!congestionLine}
        lineName={congestionLine}
        liveStations={stationList}
        onClose={() => setCongestionLine(null)}
        onStationPress={(station) => openStationDetail(station)}
      />

      <StationDetailModal
        visible={!!detailStation}
        station={detailStation}
        onClose={() => setDetailStation(null)}
        onFavoritesChanged={setFavoriteStations}
      />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerMascot: { width: 32, height: 32 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary, marginLeft: 6 },
  headerIcon: { padding: 4 },
  connectionDot: { width: 7, height: 7, borderRadius: 4 },
  content: { flex: 1 },
  searchSection: { paddingHorizontal: 20, marginTop: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.searchBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
  },
  searchIcon: { marginRight: 10 },
  searchText: { fontSize: 15, color: COLORS.textSub, fontWeight: '400' },
  noticeSection: { paddingHorizontal: 20, marginTop: 16 },
  noticeCard: {
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  noticeContent: { flex: 1, zIndex: 1, paddingRight: 40 },
  noticeTag: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  noticeTagText: { fontSize: 11, fontWeight: '600', color: 'white' },
  noticeTitle: { fontSize: 17, fontWeight: '700', color: 'white', marginBottom: 6 },
  noticeSub: { fontSize: 13, color: 'white', opacity: 0.85, lineHeight: 18 },
  noticeImageContainer: { position: 'absolute', right: -25, bottom: -30 },
  characterImage: { width: 130, height: 130, opacity: 0.28, transform: [{ rotate: '-15deg' }] },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  sectionSub: { fontSize: 13, color: COLORS.textSub, fontWeight: '500' },
  seeAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  emptyRecent: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyRecentText: { fontSize: 14, color: COLORS.textSub },
  recentList: { paddingRight: 20 },
  routeCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 148,
    ...SHADOW.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  routeCardCommute: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  routeLabel: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 3,
    marginBottom: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border,
  },
  routeLabelCommute: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  routeLabelText: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },
  routeFrom: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  routeArrow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  routeArrowLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginRight: 2 },
  routeTo: { fontSize: 14, fontWeight: '700', color: COLORS.textMain, marginBottom: 6 },
  routeMin: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  recentCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 148,
    ...SHADOW.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  lineBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  lineBadgeText: { color: 'white', fontSize: 13, fontWeight: '700' },
  cardBody: { marginTop: 4 },
  stationName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  stationNameSub: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  miniBadge: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  facilityGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  facilityItem: { width: (width - 40) / 4, alignItems: 'center', marginBottom: 20 },
  facilityIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  facilityName: { fontSize: 12, color: COLORS.textMain, fontWeight: '500' },
  nearbyCard: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 20,
    ...SHADOW.md,
  },
  nearbyHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  nearbyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textMain, marginLeft: 6 },
  nearbyContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nearbyStationName: { fontSize: 20, fontWeight: '700', color: COLORS.textMain },
  nearbyStationInfo: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },
  routeBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  routeBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  nearbyLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  nearbyEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  nearbyEmptyText: { fontSize: 14, color: COLORS.textSub },
  loadingText: { fontSize: 12, color: COLORS.textSub },
  filterToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.divider,
    borderRadius: 10,
    padding: 3,
    marginBottom: 14,
    alignSelf: 'flex-start',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  toggleBtnActive: { backgroundColor: COLORS.primary },
  toggleBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textSub },
  toggleBtnTextActive: { color: 'white' },
  emptyFollowed: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyFollowedText: { fontSize: 15, fontWeight: '600', color: COLORS.textSub },
  emptyFollowedSub: { fontSize: 13, color: COLORS.textSub },
  liveDot: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  liveText: { fontSize: 10, fontWeight: '700', color: 'white', letterSpacing: 0.5 },
  congestionLoading: { paddingVertical: 24, alignItems: 'center', gap: 10 },
  congestionList: {
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  lineCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lineCircleText: { color: 'white', fontSize: 12, fontWeight: '700' },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 14, fontWeight: '600', color: COLORS.textMain },
  lineMsg: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.lg,
  },
});
