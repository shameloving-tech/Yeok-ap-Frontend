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

const SUPPORTED_LINES = [
  '2호선', '1호선', '3호선', '4호선', '5호선',
  '6호선', '7호선', '8호선', '9호선',
  '수인분당선', '공항철도', '신분당선', '경의중앙선',
];

const FETCH_MS    = 20_000;
const AVG_SEG_SEC = 150;
const MAX_TRAINS  = 5;

type Train = {
  train_no: string;
  direction: string;
  status_msg: string;
  prev_station: string | null;
  next_station: string;
  barvlDt: number;
  up_down: string;
};

const fmt = (s: number) => {
  if (s <= 0) return '곳 도착';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
};

function TrainCard({ train, color, remaining }: { train: Train; color: string; remaining: number }) {
  const progress = Math.max(0, Math.min(0.96, 1 - remaining / AVG_SEG_SEC));
  const urgent   = remaining <= 30 && remaining > 0;

  return (
    <View style={card.wrap}>
      <View style={card.row}>
        <View style={[card.badge, { borderColor: color }]}>
          <Ionicons name="train-outline" size={11} color={color} />
          <ThemedText style={[card.badgeText, { color }]}>{train.train_no}편성</ThemedText>
        </View>
        <ThemedText style={card.dir}>
          {train.up_down === '상행' ? '↑' : '↓'} {train.direction}
        </ThemedText>
        <View style={[card.timePill, urgent && { backgroundColor: '#FF3B3018' }]}>
          <ThemedText style={[card.timeText, urgent && { color: '#FF3B30' }]}>
            {fmt(remaining)}
          </ThemedText>
        </View>
      </View>

      <View style={card.seg}>
        <View style={card.dot} />
        <View style={card.track}>
          <View style={[card.filled, { flex: Math.max(0.001, progress), backgroundColor: color }]} />
          <View style={[card.trainIcon, { backgroundColor: color }]}>
            <Ionicons name="train" size={9} color="white" />
          </View>
          <View style={[card.empty, { flex: Math.max(0.001, 1 - progress) }]} />
        </View>
        <View style={[card.dot, { backgroundColor: color }]} />
      </View>

      <View style={card.names}>
        <ThemedText style={card.stName} numberOfLines={1}>
          {train.prev_station ?? '?'}
        </ThemedText>
        <ThemedText style={[card.stName, { textAlign: 'right' }]} numberOfLines={1}>
          {train.next_station}
        </ThemedText>
      </View>

      <ThemedText style={card.status} numberOfLines={1}>{train.status_msg}</ThemedText>
    </View>
  );
}

export function TrainLocationSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [line,    setLine]    = useState('2호선');
  const [trains,  setTrains]  = useState<Train[]>([]);
  const [loading, setLoading] = useState(false);
  const [secs,    setSecs]    = useState<Record<string, number>>({});
  const fetchTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTrains = useCallback(async (l: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/trains?line=${encodeURIComponent(l)}`);
      if (!res.ok) return;
      const data: Train[] = await res.json();
      setTrains(data.slice(0, MAX_TRAINS));
      const map: Record<string, number> = {};
      data.forEach(t => { map[t.train_no] = t.barvlDt; });
      setSecs(map);
    } catch (e) {
      console.error('TrainLocationSheet:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setTrains([]);
    loadTrains(line);
    fetchTimer.current = setInterval(() => loadTrains(line), FETCH_MS);
    return () => { if (fetchTimer.current) clearInterval(fetchTimer.current); };
  }, [visible, line, loadTrains]);

  useEffect(() => {
    if (!visible) return;
    countTimer.current = setInterval(() => {
      setSecs(prev => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = Math.max(0, v - 1);
        return next;
      });
    }, 1000);
    return () => { if (countTimer.current) clearInterval(countTimer.current); };
  }, [visible]);

  const color = getLineColor(line);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* 전체를 flex:1로 감싸고 backdrop을 절대위치로 → 시트가 올바른 높이를 가짐 */}
      <View style={s.root}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={[s.lineAccent, { backgroundColor: color }]} />
            <ThemedText style={s.title}>열차 위치</ThemedText>
            <ThemedText style={s.sub}>20초 자동 갱신 · 연착 자동 반영</ThemedText>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabs}
          >
            {SUPPORTED_LINES.map(l => {
              const c = getLineColor(l);
              const active = l === line;
              return (
                <TouchableOpacity
                  key={l}
                  onPress={() => { setLine(l); setTrains([]); }}
                  style={[
                    s.tab,
                    active
                      ? { backgroundColor: c, borderColor: c }
                      : { borderColor: '#E5E5EA' },
                  ]}
                >
                  <View style={[s.tabDot, { backgroundColor: active ? 'white' : c }]} />
                  <ThemedText style={[s.tabText, { color: active ? 'white' : COLORS.textSub }]}>
                    {l}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* body: flex:1로 남은 공간 채움 */}
          <View style={s.body}>
            {loading ? (
              <View style={s.center}>
                <ActivityIndicator color={color} size="large" />
                <ThemedText style={s.hint}>열차 정보를 가져오는 중입니다...</ThemedText>
              </View>
            ) : trains.length === 0 ? (
              <View style={s.center}>
                <Ionicons name="train-outline" size={44} color="#C7C7CC" />
                <ThemedText style={s.hint}>현재 {line} 운행 열차 정보 없음</ThemedText>
                <ThemedText style={[s.hint, { fontSize: 12 }]}>시운 외 시간대이거나 API 응답 없음</ThemedText>
              </View>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: 16, gap: 10 }}
              >
                {trains.map(t => (
                  <TrainCard
                    key={t.train_no}
                    train={t}
                    color={color}
                    remaining={secs[t.train_no] ?? t.barvlDt}
                  />
                ))}
                <View style={s.footer}>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.textSub} />
                  <ThemedText style={s.footerText}>
                    열차 위치는 도착 예상 시간 기반 보간값입니다
                  </ThemedText>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 16, gap: 10,
  },
  lineAccent: { width: 4, height: 20, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  sub: { flex: 1, fontSize: 11, color: COLORS.textSub },
  closeBtn: { padding: 4 },
  tabs: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  tab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, gap: 5,
  },
  tabDot: { width: 8, height: 8, borderRadius: 4 },
  tabText: { fontSize: 12, fontWeight: '700' },
  body: { flex: 1 },
  center: { flex: 1, paddingVertical: 40, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },
  footer: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    justifyContent: 'center', paddingVertical: 8,
  },
  footerText: { fontSize: 11, color: COLORS.textSub },
});

const card = StyleSheet.create({
  wrap: {
    backgroundColor: '#F8F9FB',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EFEFEF',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 8 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  dir: { flex: 1, fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  timePill: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10,
  },
  timeText: { fontSize: 13, fontWeight: '800', color: COLORS.textMain },
  seg: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C7C7CC' },
  track: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 20 },
  filled: { height: 4, borderRadius: 2 },
  trainIcon: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 1, zIndex: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  empty: { height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 },
  names: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  stName: { fontSize: 12, color: COLORS.textSub, fontWeight: '600', maxWidth: '46%' },
  status: { fontSize: 11, color: COLORS.textSub, textAlign: 'center' },
});
