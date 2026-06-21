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
  station: {
    station_name: string;
    line_name: string;
    congestion_level?: string | null;
    arrival_message?: string | null;
  } | null;
  onClose: () => void;
  onFavoritesChanged?: (favs: FavoriteStation[]) => void;
}

type TimelinePoint = { time: string; value: number; level: string };
type ArrivalItem = { seconds: number; message: string; destination?: string; updn?: number };

const LEVEL_COLOR = (level: string) => {
  switch (level) {
    case '폭발': return '#FF3B30';
    case '혼잡': return '#FF9500';
    case '보통': return '#FFCC00';
    case '여유': return '#34C759';
    default:     return '#8E8E93';
  }
};

const fmtSec = (sec: number) => {
  if (sec <= 0) return '곧 도착';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}분 ${s}초 후` : `${s}초 후`;
};

const dirLabel = (lineName: string, updn?: number): string => {
  if (updn === undefined || updn === null) return '';
  if (lineName === '2호선') return updn === 0 ? '내선순환' : '외선순환';
  return updn === 0 ? '상행' : '하행';
};

export const StationDetailModal: React.FC<Props> = ({
  visible,
  station,
  onClose,
  onFavoritesChanged,
}) => {
  const insets = useSafeAreaInsets();
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [favs, setFavs] = useState<FavoriteStation[]>([]);

  useEffect(() => {
    if (!station || !visible) return;
    let cancelled = false;
    setLoading(true);
    setTimeline([]);
    setArrivals([]);

    const sName = encodeURIComponent(station.station_name);
    const sLine = encodeURIComponent(station.line_name);

    Promise.all([
      fetch(`${BASE_URL}/api/v1/stations/timeline?name=${sName}&line=${sLine}`).then(r => r.json()).catch(() => ({})),
      fetch(`${BASE_URL}/api/v1/stations/arrivals?name=${sName}&line=${sLine}`).then(r => r.json()).catch(() => ({})),
    ]).then(([timelineRes, arrivalsRes]) => {
      if (cancelled) return;
      setTimeline(timelineRes.timeline || []);
      setArrivals(arrivalsRes.arrivals || []);
      setLoading(false);
    });

    getFavoriteStations().then((f) => { if (!cancelled) setFavs(f); });
    return () => { cancelled = true; };
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

  // updn(0=상행/내선, 1=하행/외선) 기준으로 방향별 첫 열차만 추출
  const directionGroups: ArrivalItem[] = (() => {
    const seen = new Set<number>();
    const groups: ArrivalItem[] = [];
    for (const a of arrivals) {
      const key = a.updn ?? 99;
      if (!seen.has(key)) {
        seen.add(key);
        groups.push(a);
      }
      if (groups.length >= 2) break;
    }
    return groups;
  })();

  // 방향별 첫 열차에 이미 표시된 것 제외한 추가 열차
  const extraArrivals = arrivals.filter(a => !directionGroups.includes(a)).slice(0, 4);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.handle} />

          {/* 헤더 */}
          <View style={styles.header}>
            <View style={[styles.lineBadge, { backgroundColor: getLineColor(station.line_name) }]}>
              <ThemedText style={styles.lineBadgeText}>{getLineNumber(station.line_name)}</ThemedText>
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.stationName}>{station.station_name}</ThemedText>
              <ThemedText style={styles.lineName}>{station.line_name}</ThemedText>
            </View>
            <TouchableOpacity onPress={handleToggleFav} style={styles.iconBtn}>
              <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={24} color={isFav ? '#FF3B30' : '#C7C7CC'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={26} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          {/* 열차 도착 (양방향) + 혼잡도 */}
          <View style={styles.infoRow}>
            {/* 양방향 열차 */}
            <View style={[styles.infoCard, { flex: 2 }]}>
              <View style={styles.infoCardTop}>
                <Ionicons name="train-outline" size={14} color={COLORS.primary} />
                <ThemedText style={styles.infoCardLabel}>열차 도착</ThemedText>
              </View>
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 8 }} />
              ) : directionGroups.length === 0 ? (
                <ThemedText style={styles.arrivalNoData}>정보없음</ThemedText>
              ) : (
                <View style={styles.directionPair}>
                  {directionGroups.map((d, i) => (
                    <View key={i} style={[styles.directionItem, i > 0 && styles.directionItemBorder]}>
                      <View style={styles.directionHeader}>
                        {dirLabel(station.line_name, d.updn) ? (
                          <View style={styles.dirLabelBadge}>
                            <ThemedText style={styles.dirLabelText}>{dirLabel(station.line_name, d.updn)}</ThemedText>
                          </View>
                        ) : null}
                        {d.destination ? (
                          <ThemedText style={styles.directionDest} numberOfLines={1}>{d.destination}행</ThemedText>
                        ) : null}
                      </View>
                      <ThemedText style={styles.directionTime}>{fmtSec(d.seconds)}</ThemedText>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 현재 혼잡도 */}
            <View style={styles.infoCard}>
              <View style={styles.infoCardTop}>
                <Ionicons name="people-outline" size={14} color={COLORS.primary} />
                <ThemedText style={styles.infoCardLabel}>현재 혼잡도</ThemedText>
              </View>
              <View style={[styles.congestionBadge, { backgroundColor: LEVEL_COLOR(station.congestion_level || '') + '22' }]}>
                <ThemedText style={[styles.congestionText, { color: LEVEL_COLOR(station.congestion_level || '') }]}>
                  {station.congestion_level || '정보없음'}
                </ThemedText>
              </View>
            </View>
          </View>

          {/* 이후 도착 열차 칩 (방향별 추가 열차) */}
          {extraArrivals.length > 0 && (
            <View style={styles.nextArrivalsRow}>
              {extraArrivals.map((a, i) => (
                <View key={i} style={styles.nextArrivalChip}>
                  <Ionicons name="time-outline" size={11} color={COLORS.textSub} />
                  <ThemedText style={styles.nextArrivalText}>{fmtSec(a.seconds)}</ThemedText>
                  {a.destination ? (
                    <ThemedText style={styles.nextArrivalDir}>{a.destination}</ThemedText>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* 시간대별 혼잡도 차트 */}
          <ThemedText style={styles.chartTitle}>시간대별 혼잡도 (오늘 요일 기준)</ThemedText>
          {loading ? (
            <View style={styles.chartLoading}><ActivityIndicator color={COLORS.primary} /></View>
          ) : timeline.length === 0 ? (
            <View style={styles.chartEmpty}>
              <Ionicons name="information-circle-outline" size={28} color={COLORS.textSub} />
              <ThemedText style={styles.chartEmptyText}>데이터가 없습니다</ThemedText>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chartScroll}
            >
              <View style={styles.chart}>
                {timeline.map((p, i) => {
                  const heightPct = Math.max((p.value / Math.max(maxValue, 1)) * 100, 2);
                  return (
                    <View key={i} style={styles.barColumn}>
                      <ThemedText style={styles.barValue}>{Math.round(p.value)}</ThemedText>
                      <View style={styles.barWrapper}>
                        <View style={[styles.bar, { height: `${heightPct}%`, backgroundColor: LEVEL_COLOR(p.level) }]} />
                      </View>
                      <View style={styles.barLabelWrap}>
                        <ThemedText style={styles.barLabel}>{p.time}</ThemedText>
                      </View>
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
    maxHeight: '90%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  lineBadge: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  lineBadgeText: { color: 'white', fontSize: 15, fontWeight: '700' },
  stationName: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  lineName: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  iconBtn: { padding: 6 },

  infoRow: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 8 },
  infoCard: {
    flex: 1, backgroundColor: COLORS.surfaceSecondary ?? '#F8F9FB',
    borderRadius: 14, padding: 14, minHeight: 80,
  },
  infoCardTop: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  infoCardLabel: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  arrivalTime: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  arrivalDir: { fontSize: 11, color: COLORS.textSub, marginTop: 3, lineHeight: 15 },
  arrivalNoData: { fontSize: 13, color: COLORS.textSub, marginTop: 4 },
  congestionBadge: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, marginTop: 4 },
  congestionText: { fontSize: 16, fontWeight: '700' },

  nextArrivalsRow: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 8 },
  nextArrivalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceSecondary ?? '#F8F9FB',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  nextArrivalText: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  nextArrivalDir: { fontSize: 10, color: COLORS.textSub },

  directionPair: { flexDirection: 'row', marginTop: 4, width: '100%' },
  directionItem: { flex: 1, paddingRight: 6 },
  directionItemBorder: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#E0E0E0', paddingLeft: 10, paddingRight: 0 },
  directionHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' },
  dirLabelBadge: { backgroundColor: COLORS.primary + '18', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  dirLabelText: { fontSize: 10, color: COLORS.primary, fontWeight: '700' },
  directionDest: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  directionTime: { fontSize: 15, fontWeight: '800', color: COLORS.primary },

  chartTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textMain, marginTop: 12, marginBottom: 10, paddingHorizontal: 20 },
  chartLoading: { paddingVertical: 40, alignItems: 'center' },
  chartEmpty: { paddingVertical: 30, alignItems: 'center', gap: 8 },
  chartEmptyText: { fontSize: 14, color: COLORS.textSub },

  chartScroll: { paddingHorizontal: 20, paddingBottom: 8, paddingTop: 16 },
  chart: { flexDirection: 'row', alignItems: 'flex-start' },
  barColumn: { width: 30, alignItems: 'center', marginRight: 2 },
  barValue: { fontSize: 8, color: COLORS.textSub, marginBottom: 2, height: 11 },
  barWrapper: {
    width: 14, height: 120,
    justifyContent: 'flex-end',
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 4 },
  barLabelWrap: { height: 40, paddingTop: 10, alignItems: 'center', marginTop: 4 },
  barLabel: {
    fontSize: 8,
    color: COLORS.textSub,
    transform: [{ rotate: '-40deg' }],
    width: 32,
    textAlign: 'center',
  },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 4, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: COLORS.textSub },
});
