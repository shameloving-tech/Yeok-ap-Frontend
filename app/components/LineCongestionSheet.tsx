import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export function LineCongestionSheet({ visible, lineName, liveStations, onClose, onStationPress }: Props) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState(false);

  const isUnsupported = lineName ? UNSUPPORTED_CONGESTION_LINES.has(lineName) : false;

  const loadStations = useCallback((name: string) => {
    setLoading(true);
    setStations([]);
    setSelected(null);
    setFetchError(false);

    fetch(`${BASE_URL}/api/v1/stations/line_map?line=${encodeURIComponent(name)}`)
      .then(r => {
        if (!r.ok) throw new Error('api');
        return r.json();
      })
      .then((data: any[]) => {
        if (!Array.isArray(data)) throw new Error('api');
        setStations(data);
        const worst = data.findIndex(s => s.congestion_level === '폭발' || s.congestion_level === '혼잡');
        if (worst > 3) {
          setTimeout(() => {
            scrollRef.current?.scrollTo({ x: (worst - 2) * ITEM_W, animated: true });
          }, 400);
        }
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!lineName || !visible) { setSelected(null); return; }
    loadStations(lineName);
  }, [lineName, visible, loadStations]);

  if (!lineName) return null;

  const lineColor = getLineColor(lineName);
  const lineNum   = lineName.match(/(\d+)/)?.[1] || lineName.slice(0, 2);
  const selectedData = stations.find(s => s.station_name === selected);
  const liveCount    = stations.filter(s => s.congestion_level).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              onPress={() => lineName && loadStations(lineName)}
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
                          style={[styles.stName, isSel && { color: lineColor, fontWeight: '800' }]}
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
                          style={[styles.stName, isSel && { color: lineColor, fontWeight: '800' }]}
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
            <View style={styles.detailLeft}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <ThemedText style={styles.detailName}>{selectedData.station_name}</ThemedText>
                {selectedData.congestion_level ? (
                  <View style={[styles.detailBadge, { backgroundColor: (LEVEL_COLOR[selectedData.congestion_level] || '#8E8E93') + '22' }]}>
                    <ThemedText style={[styles.detailBadgeText, { color: LEVEL_COLOR[selectedData.congestion_level] || '#8E8E93' }]}>
                      {selectedData.congestion_level}
                    </ThemedText>
                  </View>
                ) : (
                  <View style={[styles.detailBadge, { backgroundColor: '#F2F2F7' }]}>
                    <ThemedText style={[styles.detailBadgeText, { color: '#C7C7CC' }]}>정보없음</ThemedText>
                  </View>
                )}
              </View>
              {selectedData.arrival_message ? (
                <ThemedText style={styles.detailMsg} numberOfLines={1}>
                  {selectedData.arrival_message}
                </ThemedText>
              ) : (
                <ThemedText style={styles.detailMsg}>실시간 도착 정보 없음</ThemedText>
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
        ) : (
          <View style={styles.hintBox}>
            <Ionicons name="hand-left-outline" size={14} color={COLORS.textSub} />
            <ThemedText style={styles.hintText}>역을 탭하면 혼잡도를 확인할 수 있어요</ThemedText>
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
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 0,
  },
  handle: {
    width: 40, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2,
    alignSelf: 'center', marginTop: 14, marginBottom: 2,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
    gap: 12,
  },
  lineCircle: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
  lineCircleText: { color: 'white', fontSize: 18, fontWeight: '800' },
  title: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },

  // Legend
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
    gap: 12,
  },
  detailLeft: { flex: 1 },
  detailName: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  detailBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  detailBadgeText: { fontSize: 12, fontWeight: '800' },
  detailMsg: { fontSize: 12, color: COLORS.textSub },
  detailBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
  },
  detailBtnText: { fontSize: 13, fontWeight: '700', color: 'white' },

  // Hint
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
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
    borderBottomWidth: 1,
    borderBottomColor: '#FFE5B4',
  },
  unsupportedText: { fontSize: 12, color: '#B37400', flex: 1 },

  // Retry button
  retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: '#F2F2F7' },
  retryText: { fontSize: 14, fontWeight: '700' },
});
