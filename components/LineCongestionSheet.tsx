import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';

// 혼잡도 데이터가 제공되지 않는 노선 (서울교통공사 외 운영사)
const UNSUPPORTED_CONGESTION_LINES = new Set([
  '인천1호선', '인천2호선', '김포골드라인', '서해선', '경강선', 'GTX-A',
]);

type Props = {
  visible: boolean;
  lineName: string | null;
  liveStations: any[];     // WebSocket 실시간 데이터 (fallback용)
  onClose: () => void;
  onStationPress?: (station: any) => void;
};

const ITEM_W   = 72;   // 역 슬롯 너비
const MAP_H    = 210;  // 노선도 영역 높이
const LINE_Y   = 105;  // 트랙 수직 중심
const DOT_N    = 22;   // 기본 점 크기
const DOT_S    = 32;   // 선택된 점 크기
const PAD_H    = 24;   // 좌우 패딩

const LEVEL_COLOR: Record<string, string> = {
  '폭발': '#FF3B30',
  '혼잡': '#FF9500',
  '보통': '#FFCC00',
  '여유': '#34C759',
};

const LEGEND: [string, string][] = [
  ['여유', '#34C759'],
  ['보통', '#FFCC00'],
  ['혼잡', '#FF9500'],
  ['폭발', '#FF3B30'],
];

type ArrivalItem = { line: string; direction: string | null; message: string | null; destination: string | null; seconds: number };

export function LineCongestionSheet({ visible, lineName, liveStations, onClose, onStationPress }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [arrivalsLoading, setArrivalsLoading] = useState(false);

  const isUnsupported = lineName ? UNSUPPORTED_CONGESTION_LINES.has(lineName) : false;

  useEffect(() => {
    if (!lineName || !visible) { setSelected(null); return; }
    let cancelled = false;
    setLoading(true);
    setStations([]);
    setSelected(null);
    setArrivals([]);
    setFetchError(false);
    fetch(`${BASE_URL}/api/v1/stations/line_map?line=${encodeURIComponent(lineName)}`)
      .then(r => { if (!r.ok) throw new Error('api'); return r.json(); })
      .then((data: any[]) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('api');
        setStations(data);
        const worst = data.findIndex(s => s.congestion_level === '폭발' || s.congestion_level === '혼잡');
        if (worst > 3) {
          setTimeout(() => { scrollRef.current?.scrollTo({ x: (worst - 2) * ITEM_W, animated: true }); }, 400);
        }
      })
      .catch(() => { if (!cancelled) setFetchError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [lineName, visible, retryCount]);

  // 역 탭 시 실시간 도착 정보 조회
  useEffect(() => {
    if (!selected) { setArrivals([]); return; }
    let cancelled = false;
    setArrivalsLoading(true);
    setArrivals([]);
    fetch(`${BASE_URL}/api/v1/stations/arrivals?name=${encodeURIComponent(selected)}`)
      .then(r => r.json())
      .then(data => { if (!cancelled) setArrivals(data.arrivals || []); })
      .catch(() => { if (!cancelled) setArrivals([]); })
      .finally(() => { if (!cancelled) setArrivalsLoading(false); });
    return () => { cancelled = true; };
  }, [selected]);

  const lineColor = lineName ? getLineColor(lineName) : '#8E8E93';
  const lineNum   = lineName ? (lineName.match(/(\d+)/)?.[1] || lineName.slice(0, 2)) : '';
  const selectedData = stations.find(s => s.station_name === selected);
  const liveCount    = stations.filter(s => s.congestion_level).length;

  const formatSeconds = (sec: number) => {
    if (sec <= 0) return '곧 도착';
    if (sec < 60) return `${sec}초`;
    return `${Math.floor(sec / 60)}분 후`;
  };

  return (
    <Modal visible={visible && !!lineName} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
        {/* Handle */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.lineCircle, { backgroundColor: lineColor }]}>
            <ThemedText style={styles.lineCircleText}>{lineNum}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>{lineName} 노선도</ThemedText>
            <ThemedText style={styles.subtitle}>
              {loading ? '불러오는 중...' : `실시간 ${liveCount}개 · 총 ${stations.length}개 역`}
            </ThemedText>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {LEGEND.map(([label, color]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <ThemedText style={styles.legendLabel}>{label}</ThemedText>
            </View>
          ))}
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#D1D1D6' }]} />
            <ThemedText style={styles.legendLabel}>정보없음</ThemedText>
          </View>
        </View>

        {/* 미지원 노선 안내 배너 */}
        {isUnsupported && (
          <View style={styles.unsupportedBanner}>
            <Ionicons name="information-circle-outline" size={15} color="#FF9500" />
            <ThemedText style={styles.unsupportedText}>
              이 노선은 실시간 혼잡도 데이터가 지원되지 않습니다
            </ThemedText>
          </View>
        )}

        {/* 노선도 맵 */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={lineColor} size="large" />
          </View>
        ) : fetchError ? (
          <View style={styles.loadingBox}>
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.textSub} />
            <ThemedText style={styles.emptyText}>데이터를 불러올 수 없습니다</ThemedText>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setRetryCount(c => c + 1)}
            >
              <ThemedText style={[styles.retryText, { color: lineColor }]}>다시 시도</ThemedText>
            </TouchableOpacity>
          </View>
        ) : stations.length === 0 ? (
          <View style={styles.loadingBox}>
            <Ionicons name="map-outline" size={36} color={COLORS.textSub} />
            <ThemedText style={styles.emptyText}>노선 정보를 불러올 수 없습니다</ThemedText>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mapScroll}
            contentContainerStyle={{ paddingHorizontal: PAD_H }}
          >
            <View style={{ width: stations.length * ITEM_W, height: MAP_H }}>

              {/* 트랙 배경 */}
              <View style={[
                styles.track,
                {
                  top: LINE_Y - 3,
                  left: ITEM_W / 2,
                  width: (stations.length - 1) * ITEM_W,
                  backgroundColor: lineColor + '40',
                }
              ]} />
              {/* 트랙 foreground (혼잡도 있는 구간 강조 위해 얇게) */}
              <View style={[
                styles.track,
                {
                  top: LINE_Y - 1,
                  left: ITEM_W / 2,
                  width: (stations.length - 1) * ITEM_W,
                  height: 3,
                  backgroundColor: lineColor + '60',
                }
              ]} />

              {/* 역별 렌더링 */}
              {stations.map((station, idx) => {
                const level    = station.congestion_level as string | null;
                const dotColor = level ? (LEVEL_COLOR[level] || '#8E8E93') : '#D1D1D6';
                const isSel    = selected === station.station_name;
                const isAbove  = idx % 2 === 0;
                const shortName = station.station_name.replace('역', '');
                const dotSize  = isSel ? DOT_S : DOT_N;
                const dotTop   = LINE_Y - dotSize / 2;

                return (
                  <TouchableOpacity
                    key={station.station_name}
                    style={[styles.stationHit, { left: idx * ITEM_W }]}
                    onPress={() => setSelected(isSel ? null : station.station_name)}
                    activeOpacity={0.7}
                  >
                    {/* 역명 위 */}
                    {isAbove && (
                      <View style={[styles.namePlate, { bottom: MAP_H - LINE_Y + DOT_N / 2 + 6 }]}>
                        <ThemedText
                          style={[styles.stName, isSel && { color: lineColor, fontWeight: '700' }]}
                          numberOfLines={2}
                        >
                          {shortName}
                        </ThemedText>
                      </View>
                    )}

                    {/* 점 */}
                    <View style={[
                      styles.dot,
                      {
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: dotColor,
                        top: dotTop,
                        left: (ITEM_W - dotSize) / 2,
                        borderColor: isSel ? lineColor : 'white',
                        borderWidth: isSel ? 3 : 2.5,
                      },
                      isSel && {
                        shadowColor: dotColor,
                        shadowOpacity: 0.6,
                        shadowRadius: 8,
                        elevation: 6,
                      },
                    ]} />

                    {/* 역명 아래 */}
                    {!isAbove && (
                      <View style={[styles.namePlate, { top: LINE_Y + DOT_N / 2 + 6 }]}>
                        <ThemedText
                          style={[styles.stName, isSel && { color: lineColor, fontWeight: '700' }]}
                          numberOfLines={2}
                        >
                          {shortName}
                        </ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* 선택 역 상세 패널 */}
        {selectedData ? (
          <View style={styles.detailPanel}>
            {/* 역명 + 혼잡도 배지 */}
            <View style={styles.detailRow}>
              <View style={styles.detailLeft}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <ThemedText style={styles.detailName}>{selectedData.station_name}</ThemedText>
                  {selectedData.congestion_level ? (
                    <View style={[styles.detailBadge, { backgroundColor: (LEVEL_COLOR[selectedData.congestion_level] || '#8E8E93') + '22' }]}>
                      <ThemedText style={[styles.detailBadgeText, { color: LEVEL_COLOR[selectedData.congestion_level] || '#8E8E93' }]}>
                        {selectedData.congestion_level}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={[styles.detailBadge, { backgroundColor: COLORS.surfaceSecondary }]}>
                      <ThemedText style={[styles.detailBadgeText, { color: COLORS.textTertiary }]}>정보없음</ThemedText>
                    </View>
                  )}
                </View>

                {/* 실시간 도착 정보 */}
                {arrivalsLoading ? (
                  <ActivityIndicator size="small" color={lineColor} style={{ alignSelf: 'flex-start' }} />
                ) : arrivals.length > 0 ? (
                  <View style={styles.arrivalList}>
                    {arrivals.slice(0, 3).map((a, i) => (
                      <View key={i} style={styles.arrivalRow}>
                        <ThemedText style={styles.arrivalDir} numberOfLines={1}>
                          {a.destination ?? a.direction ?? ''}
                        </ThemedText>
                        <ThemedText style={[styles.arrivalTime, { color: a.seconds <= 60 ? COLORS.danger : lineColor }]}>
                          {formatSeconds(a.seconds)}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.detailMsg}>도착 예정 열차 없음</ThemedText>
                )}
              </View>

              <TouchableOpacity
                style={[styles.detailBtn, { backgroundColor: lineColor }]}
                onPress={() => { setSelected(null); onStationPress?.(selectedData); }}
              >
                <ThemedText style={styles.detailBtnText}>상세</ThemedText>
                <Ionicons name="chevron-forward" size={14} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.hintBox}>
            <Ionicons name="hand-left-outline" size={14} color={COLORS.textSub} />
            <ThemedText style={styles.hintText}>역을 탭하면 도착 정보를 확인할 수 있어요</ThemedText>
          </View>
        )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 0,
    maxHeight: SCREEN_HEIGHT * 0.88,
  },
  handle: {
    width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2,
    alignSelf: 'center', marginTop: 14, marginBottom: 2,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.divider,
    gap: 12,
  },
  lineCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  lineCircleText: { color: 'white', fontSize: 16, fontWeight: '700' },
  title: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  subtitle: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textSub },

  // Map
  loadingBox: { height: MAP_H, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSub },
  mapScroll: { height: MAP_H },

  track: { position: 'absolute', height: 5 },
  stationHit: {
    position: 'absolute',
    width: ITEM_W,
    height: MAP_H,
  },
  dot: { position: 'absolute' },
  namePlate: {
    position: 'absolute',
    left: 0,
    width: ITEM_W,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  stName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMain,
    textAlign: 'center',
    lineHeight: 14,
  },

  // Detail panel
  detailPanel: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  detailLeft: { flex: 1 },
  detailName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  detailBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  detailBadgeText: { fontSize: 12, fontWeight: '600' },
  detailMsg: { fontSize: 12, color: COLORS.textSub },
  arrivalList: { gap: 4 },
  arrivalRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrivalDir: { fontSize: 13, color: COLORS.textSub, flex: 1 },
  arrivalTime: { fontSize: 13, fontWeight: '600' },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
  },
  detailBtnText: { fontSize: 13, fontWeight: '600', color: 'white' },

  // Hint
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.divider,
  },
  hintText: { fontSize: 12, color: COLORS.textSub },

  // Unsupported line banner
  unsupportedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF9F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#FFE5B4',
  },
  unsupportedText: { fontSize: 12, color: '#B37400', flex: 1 },

  // Retry button
  retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surfaceSecondary },
  retryText: { fontSize: 14, fontWeight: '600' },
});
