import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
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
import { BASE_URL } from '@/constants/config';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { APP_COLORS as COLORS } from '@/constants/theme';
import {
  FavoriteStation,
  getFavoriteStations,
  isFavoriteStation,
  toggleFavoriteStation,
} from '@/utils/favorites';

interface Props {
  visible: boolean;
  station: { station_name: string; line_name: string; congestion_level?: string | null } | null;
  onClose: () => void;
  onFavoritesChanged?: (favs: FavoriteStation[]) => void;
}

type TimelinePoint = { time: string; value: number; level: string };

const LEVEL_COLOR = (level: string) => {
  switch (level) {
    case '폭발':
      return '#FF3B30';
    case '혼잡':
      return '#FF9500';
    case '보통':
      return '#FFCC00';
    case '여유':
      return '#34C759';
    default:
      return '#8E8E93';
  }
};

export const StationDetailModal: React.FC<Props> = ({
  visible,
  station,
  onClose,
  onFavoritesChanged,
}) => {
  const insets = useSafeAreaInsets();
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [favs, setFavs] = useState<FavoriteStation[]>([]);

  useEffect(() => {
    if (!station || !visible) return;
    let cancelled = false;
    setLoading(true);
    setTimeline([]);
    (async () => {
      try {
        const url = `${BASE_URL}/api/v1/stations/timeline?name=${encodeURIComponent(
          station.station_name
        )}&line=${encodeURIComponent(station.line_name)}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled) setTimeline(json.timeline || []);
      } catch {
        if (!cancelled) setTimeline([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    getFavoriteStations().then((f) => {
      if (!cancelled) setFavs(f);
    });
    return () => {
      cancelled = true;
    };
  }, [station, visible]);

  if (!station) return null;

  const isFav = isFavoriteStation(favs, station.station_name, station.line_name);
  const handleToggleFav = async () => {
    const updated = await toggleFavoriteStation({
      station_name: station.station_name,
      line_name: station.line_name,
    });
    setFavs(updated);
    onFavoritesChanged?.(updated);
  };

  const maxValue = Math.max(...timeline.map((t) => t.value), 100);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={[styles.lineBadge, { backgroundColor: getLineColor(station.line_name) }]}>
              <ThemedText style={styles.lineBadgeText}>{getLineNumber(station.line_name)}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.stationName}>{station.station_name}</ThemedText>
              <ThemedText style={styles.lineName}>{station.line_name}</ThemedText>
            </View>
            <TouchableOpacity onPress={handleToggleFav} style={styles.iconBtn}>
              <Ionicons
                name={isFav ? 'heart' : 'heart-outline'}
                size={24}
                color={isFav ? '#FF3B30' : '#C7C7CC'}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <View style={styles.currentBox}>
            <ThemedText style={styles.currentLabel}>현재 혼잡도</ThemedText>
            <View
              style={[
                styles.currentBadge,
                { backgroundColor: LEVEL_COLOR(station.congestion_level || '') + '22' },
              ]}
            >
              <ThemedText
                style={[
                  styles.currentBadgeText,
                  { color: LEVEL_COLOR(station.congestion_level || '') },
                ]}
              >
                {station.congestion_level || '정보없음'}
              </ThemedText>
            </View>
          </View>

          <ThemedText style={styles.chartTitle}>시간대별 혼잡도 (오늘 요일 기준)</ThemedText>
          {loading ? (
            <View style={styles.chartLoading}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : timeline.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="information-circle-outline" size={28} color={COLORS.textSub} />
              <ThemedText style={styles.chartEmptyText}>데이터가 없습니다</ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              <View style={styles.chart}>
                {timeline.map((p, i) => {
                  const heightPct = Math.max((p.value / Math.max(maxValue, 1)) * 100, 2);
                  return (
                    <View key={i} style={styles.barColumn}>
                      <ThemedText style={styles.barValue}>{Math.round(p.value)}</ThemedText>
                      <View style={styles.barWrapper}>
                        <View
                          style={[
                            styles.bar,
                            { height: `${heightPct}%`, backgroundColor: LEVEL_COLOR(p.level) },
                          ]}
                        />
                      </View>
                      <ThemedText style={styles.barLabel}>{p.time}</ThemedText>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <View style={styles.legend}>
            {['여유', '보통', '혼잡', '폭발'].map((lv) => (
              <View key={lv} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: LEVEL_COLOR(lv) }]} />
                <ThemedText style={styles.legendText}>{lv}</ThemedText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 16,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  lineBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lineBadgeText: { color: 'white', fontSize: 15, fontWeight: '700' },
  stationName: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  lineName: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  iconBtn: { padding: 6 },
  currentBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginVertical: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 12,
  },
  currentLabel: { fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  currentBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  currentBadgeText: { fontSize: 14, fontWeight: '600' },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginTop: 18,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  chartLoading: { paddingVertical: 60, alignItems: 'center' },
  chartEmpty: { paddingVertical: 40, alignItems: 'center', gap: 8 },
  chartEmptyText: { fontSize: 14, color: COLORS.textSub },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 200, paddingVertical: 8 },
  barColumn: { width: 26, alignItems: 'center', marginRight: 4 },
  barValue: { fontSize: 9, color: COLORS.textSub, marginBottom: 4, height: 12 },
  barWrapper: {
    width: 14,
    height: 140,
    justifyContent: 'flex-end',
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 4 },
  barLabel: {
    fontSize: 9,
    color: COLORS.textSub,
    marginTop: 4,
    transform: [{ rotate: '-45deg' }],
    width: 36,
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginTop: 18,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textSub },
});
