import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';

type Props = {
  visible: boolean;
  lineName: string | null;
  stations: any[];
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

export function LineCongestionSheet({ visible, lineName, stations, onClose, onStationPress }: Props) {
  const insets = useSafeAreaInsets();
  if (!lineName) return null;

  const lineStations = stations
    .filter(s => s.line_name === lineName)
    .sort((a, b) => (CONGESTION_ORDER[b.congestion_level] || 0) - (CONGESTION_ORDER[a.congestion_level] || 0));

  const lineColor = getLineColor(lineName);
  const worstLevel = lineStations[0]?.congestion_level;

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
              역별 혼잡도 · 총 {lineStations.length}개 역
            </ThemedText>
          </View>
          {worstLevel && (
            <View style={[styles.worstBadge, { backgroundColor: (CONGESTION_COLOR[worstLevel] || '#C7C7CC') + '22' }]}>
              <ThemedText style={[styles.worstBadgeText, { color: CONGESTION_COLOR[worstLevel] || '#C7C7CC' }]}>
                최고 {worstLevel}
              </ThemedText>
            </View>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
        </View>

        {lineStations.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="information-circle-outline" size={36} color={COLORS.textSub} />
            <ThemedText style={styles.emptyText}>혼잡도 정보가 없습니다</ThemedText>
          </View>
        ) : (
          <FlatList
            data={lineStations}
            keyExtractor={(item) => `${item.station_name}-${item.line_name}`}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => {
              const level = item.congestion_level || '정보없음';
              const color = CONGESTION_COLOR[level] || '#C7C7CC';
              const barWidth = ({ '폭발': 1, '혼잡': 0.75, '보통': 0.5, '여유': 0.25 } as any)[level] ?? 0;
              return (
                <TouchableOpacity
                  style={styles.stationRow}
                  activeOpacity={0.7}
                  onPress={() => onStationPress?.(item)}
                >
                  <View style={styles.stationLeft}>
                    <ThemedText style={styles.stationName} numberOfLines={1}>{item.station_name}</ThemedText>
                    {item.arrival_message ? (
                      <ThemedText style={styles.arrivalMsg} numberOfLines={1}>{item.arrival_message}</ThemedText>
                    ) : null}
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { flex: barWidth, backgroundColor: color }]} />
                    <View style={{ flex: 1 - barWidth }} />
                  </View>
                  <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                    <ThemedText style={[styles.badgeText, { color }]}>{level}</ThemedText>
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
  handle: { width: 36, height: 4, backgroundColor: '#E5E5EA', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
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
  worstBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexShrink: 0 },
  worstBadgeText: { fontSize: 12, fontWeight: '800' },
  list: { flexGrow: 0 },
  separator: { height: 1, backgroundColor: '#F2F2F7', marginLeft: 20 },
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  stationLeft: { width: 90 },
  stationName: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  arrivalMsg: { fontSize: 11, color: COLORS.textSub, marginTop: 2 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F2F2F7', flexDirection: 'row', overflow: 'hidden' },
  barFill: { borderRadius: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, flexShrink: 0, minWidth: 52, alignItems: 'center' },
  badgeText: { fontSize: 12, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 14, color: COLORS.textSub },
});
