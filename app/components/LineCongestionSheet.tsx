import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';

type Props = {
  visible: boolean;
  lineName: string | null;
  liveStations: any[];
  onClose: () => void;
  onStationPress?: (station: any) => void;
};

const CONGESTION_ORDER: Record<string, number> = { '폭발': 4, '혼잡': 3, '보통': 2, '여유': 1 };
const CONGESTION_COLOR: Record<string, string> = {
  '폭발': '#FF3B30',
  '혼잡': '#FF9500',
  '보통': '#FFCC00',
  '여유': '#34C759',
};
const BAR_RATIO: Record<string, number> = { '폭발': 1, '혼잡': 0.75, '보통': 0.5, '여유': 0.25 };

export function LineCongestionSheet({ visible, lineName, liveStations, onClose, onStationPress }: Props) {
  const insets = useSafeAreaInsets();
  const [allStations, setAllStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!lineName || !visible) return;
    setLoading(true);
    setAllStations([]);
    fetch(`${BASE_URL}/api/v1/stations?line=${encodeURIComponent(lineName)}`)
      .then(r => r.json())
      .then(data => setAllStations(Array.isArray(data) ? data : []))
      .catch(() => setAllStations([]))
      .finally(() => setLoading(false));
  }, [lineName, visible]);

  if (!lineName) return null;

  const lineColor = getLineColor(lineName);

  // 전체 역 + 실시간 데이터 병합, 혼잡도 높은 순 → 없는 역은 뒤로
  const mergedStations = allStations.map(station => {
    const live = liveStations.find(
      s => s.station_name === station.station_name && s.line_name === lineName
    );
    return {
      ...station,
      congestion_level: live?.congestion_level ?? null,
      arrival_message: live?.arrival_message ?? null,
    };
  }).sort((a, b) => {
    const aOrder = CONGESTION_ORDER[a.congestion_level] || 0;
    const bOrder = CONGESTION_ORDER[b.congestion_level] || 0;
    return bOrder - aOrder;
  });

  const liveCount = mergedStations.filter(s => s.congestion_level).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <View style={[styles.lineCircle, { backgroundColor: lineColor }]}>
            <ThemedText style={styles.lineCircleText}>
              {lineName.match(/(\d+)/)?.[1] || lineName.slice(0, 2)}
            </ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>{lineName}</ThemedText>
            <ThemedText style={styles.subtitle}>
              실시간 {liveCount}개 · 전체 {mergedStations.length}개 역
            </ThemedText>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
            <ThemedText style={styles.loadingText}>역 정보 불러오는 중...</ThemedText>
          </View>
        ) : mergedStations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="information-circle-outline" size={36} color={COLORS.textSub} />
            <ThemedText style={styles.emptyText}>역 정보가 없습니다</ThemedText>
          </View>
        ) : (
          <FlatList
            data={mergedStations}
            keyExtractor={(item) => item.station_name}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const level = item.congestion_level;
              const color = level ? CONGESTION_COLOR[level] || '#C7C7CC' : '#E5E5EA';
              const barRatio = level ? (BAR_RATIO[level] ?? 0.1) : 0;
              const hasData = !!level;

              return (
                <TouchableOpacity
                  style={styles.stationRow}
                  activeOpacity={0.7}
                  onPress={() => hasData && onStationPress?.(item)}
                >
                  <View style={styles.stationLeft}>
                    <ThemedText style={styles.stationName} numberOfLines={1}>
                      {item.station_name}
                    </ThemedText>
                    {item.arrival_message ? (
                      <ThemedText style={styles.arrivalMsg} numberOfLines={1}>
                        {item.arrival_message}
                      </ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.barTrack}>
                    {barRatio > 0 && (
                      <View style={[styles.barFill, { flex: barRatio, backgroundColor: color }]} />
                    )}
                    <View style={{ flex: 1 - barRatio }} />
                  </View>
                  <View style={[styles.badge, { backgroundColor: hasData ? color + '22' : '#F2F2F7' }]}>
                    <ThemedText style={[styles.badgeText, { color: hasData ? color : '#C7C7CC' }]}>
                      {level || '정보없음'}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 12,
  },
  lineCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  lineCircleText: { color: 'white', fontSize: 16, fontWeight: '800' },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  loadingWrap: { paddingVertical: 48, alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textSub },
  list: { flexGrow: 0 },
  separator: { height: 1, backgroundColor: '#F2F2F7', marginLeft: 20 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  stationLeft: { width: 96 },
  stationName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  arrivalMsg: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  barTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: '#F2F2F7', flexDirection: 'row', overflow: 'hidden',
  },
  barFill: { borderRadius: 3 },
  badge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
    flexShrink: 0, minWidth: 60, alignItems: 'center',
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSub },
});
