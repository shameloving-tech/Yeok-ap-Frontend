import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  RefreshControl,
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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.72;

const SUPPORTED_LINES = [
  '1호선', '2호선', '3호선', '4호선', '5호선',
  '6호선', '7호선', '8호선', '9호선',
  '수인분당선', '경의중앙선', '공항철도', '신분당선',
];

// 서울 Open API 500건 제한으로 실시간 데이터가 간헐적으로 누락되는 노선
const LIMITED_LINES = new Set(['공항철도', '신분당선']);

const FETCH_MS    = 20_000;
const TIMEOUT_MS  = 15_000;
const AVG_SEG_SEC = 150;
const MAX_TRAINS  = 5;

type Train = {
  train_no: string;
  direction: string;
  status_msg: string;
  prev_prev_station: string | null;
  prev_station: string | null;
  next_station: string;
  next_next_station: string | null;
  barvlDt: number;
  up_down: string;
};

const fmt = (s: number) => {
  if (s <= 0) return '곧 도착';
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

      {/* 4-station track: dot+label per column, connector lines aligned via shared height */}
      <View style={card.stationsRow}>
        <View style={card.stNode}>
          <View style={card.stDotWrap}>
            <View style={[card.stDot, { backgroundColor: '#C7C7CC' }]} />
          </View>
          <ThemedText style={card.stLabel} numberOfLines={1}>
            {train.prev_prev_station ?? ''}
          </ThemedText>
        </View>
        <View style={card.connSmall} />
        <View style={card.stNode}>
          <View style={card.stDotWrap}>
            <View style={[card.stDot, { backgroundColor: '#8E8E93' }]} />
          </View>
          <ThemedText style={card.stLabel} numberOfLines={1}>
            {train.prev_station ?? ''}
          </ThemedText>
        </View>
        <View style={card.mainTrack}>
          <View style={[card.trackFill, { flex: Math.max(0.001, progress), backgroundColor: color }]} />
          <View style={[card.trainIcon, { backgroundColor: color }]}>
            <Ionicons name="train" size={9} color="white" />
          </View>
          <View style={[card.trackEmpty, { flex: Math.max(0.001, 1 - progress) }]} />
        </View>
        <View style={card.stNode}>
          <View style={card.stDotWrap}>
            <View style={[card.stDot, { backgroundColor: color }]} />
          </View>
          <ThemedText style={[card.stLabel, { color, fontWeight: '800' }]} numberOfLines={1}>
            {train.next_station}
          </ThemedText>
        </View>
        <View style={[card.connSmall, { backgroundColor: '#E5E5EA' }]} />
        <View style={card.stNode}>
          <View style={card.stDotWrap}>
            <View style={[card.stDot, { backgroundColor: '#C7C7CC' }]} />
          </View>
          <ThemedText style={card.stLabel} numberOfLines={1}>
            {train.next_next_station ?? ''}
          </ThemedText>
        </View>
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
  const [error,   setError]   = useState(false);
  const [secs,    setSecs]    = useState<Record<string, number>>({});
  const fetchTimer  = useRef<ReturnType<typeof setInterval> | null>(null);
  const countTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadTrains = useCallback(async (l: string) => {
    setLoading(true);
    setError(false);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/trains?line=${encodeURIComponent(l)}`,
        { signal: ctrl.signal },
      );
      clearTimeout(timeout);
      if (!res.ok) {
        setError(true);
        return;
      }
      const data: Train[] = await res.json();
      setTrains(data.slice(0, MAX_TRAINS));
      const map: Record<string, number> = {};
      data.forEach(t => { map[t.train_no] = t.barvlDt; });
      setSecs(map);
    } catch (e) {
      clearTimeout(timeout);
      setError(true);
      console.error('TrainLocationSheet:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    setTrains([]);
    setError(false);
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
  const isLimited = LIMITED_LINES.has(line);

  const handleRetry = () => {
    setTrains([]);
    loadTrains(line);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.root}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={[s.lineAccent, { backgroundColor: color }]} />
            <ThemedText style={s.title}>열차 위치</ThemedText>
            <ThemedText style={s.sub}>
              {isLimited ? '일부 노선 실시간 데이터 제한' : '노선 전체 열차 · 빠른 도착순'}
            </ThemedText>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Ionicons name="close" size={22} color={COLORS.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.tabScroll}
            contentContainerStyle={s.tabContent}
          >
            {SUPPORTED_LINES.map(l => {
              const c = getLineColor(l);
              const active = l === line;
              const limited = LIMITED_LINES.has(l);
              return (
                <TouchableOpacity
                  key={l}
                  onPress={() => { setLine(l); setTrains([]); setError(false); setSecs({}); }}
                  style={[
                    s.tab,
                    active
                      ? { backgroundColor: c, borderColor: c }
                      : { borderColor: '#E5E5EA' },
                    limited && !active && { opacity: 0.55 },
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

          <ScrollView
            style={s.body}
            contentContainerStyle={s.bodyContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={loading && trains.length > 0}
                onRefresh={handleRetry}
                colors={[color]}
                tintColor={color}
              />
            }
          >
            {loading && trains.length === 0 ? (
              <View style={s.center}>
                <ActivityIndicator color={color} size="large" />
                <ThemedText style={s.hint}>열차 정보를 불러오는 중...</ThemedText>
                {isLimited && (
                  <ThemedText style={[s.hint, { fontSize: 12 }]}>
                    이 노선은 데이터가 없을 수 있어요
                  </ThemedText>
                )}
              </View>
            ) : error ? (
              <View style={s.center}>
                <Ionicons name="cloud-offline-outline" size={44} color="#C7C7CC" />
                <ThemedText style={s.hint}>연결에 실패했어요</ThemedText>
                <ThemedText style={[s.hint, { fontSize: 12 }]}>
                  서버가 깨어나는 중이거나 네트워크를 확인해 주세요
                </ThemedText>
                <TouchableOpacity onPress={handleRetry} style={[s.retryBtn, { backgroundColor: color }]}>
                  <ThemedText style={s.retryText}>다시 시도</ThemedText>
                </TouchableOpacity>
              </View>
            ) : trains.length === 0 ? (
              <View style={s.center}>
                <Ionicons name="train-outline" size={44} color="#C7C7CC" />
                <ThemedText style={s.hint}>지금은 운행 정보가 없어요</ThemedText>
                <ThemedText style={[s.hint, { fontSize: 12 }]}>
                  {isLimited
                    ? '이 노선은 실시간 데이터가 지원되지 않을 수 있어요'
                    : '운행이 종료됐거나 잠시 후 다시 확인해 보세요'}
                </ThemedText>
                <TouchableOpacity onPress={handleRetry} style={[s.retryBtn, { backgroundColor: color }]}>
                  <ThemedText style={s.retryText}>새로고침</ThemedText>
                </TouchableOpacity>
              </View>
            ) : (
              <>
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
              </>
            )}
          </ScrollView>
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
    height: SHEET_HEIGHT,
    backgroundColor: 'white',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#E5E5EA',
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, marginBottom: 12, gap: 10,
  },
  lineAccent: { width: 4, height: 20, borderRadius: 2 },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textMain },
  sub: { flex: 1, fontSize: 11, color: COLORS.textSub },
  closeBtn: { padding: 4 },
  tabScroll: { height: 48, flexGrow: 0 },
  tabContent: { paddingHorizontal: 20, gap: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 5,
  },
  tabDot: { width: 8, height: 8, borderRadius: 4 },
  tabText: { fontSize: 12, fontWeight: '700' },
  body: { flex: 1, marginTop: 8 },
  bodyContent: { padding: 16, gap: 10, flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40 },
  hint: { fontSize: 14, color: COLORS.textSub, textAlign: 'center' },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 14,
  },
  retryText: { color: 'white', fontWeight: '700', fontSize: 14 },
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
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
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
  // 4-station track layout
  stationsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stNode: {
    alignItems: 'center',
    width: 52,
  },
  stDotWrap: {
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stDot: { width: 10, height: 10, borderRadius: 5 },
  stLabel: {
    fontSize: 10,
    color: COLORS.textSub,
    fontWeight: '600',
    textAlign: 'center',
    width: 52,
    marginTop: 2,
  },
  // marginTop: (22 - 3) / 2 = 9.5 → centers the line at the same y as the dot center
  connSmall: { width: 16, height: 3, backgroundColor: '#D1D1D6', borderRadius: 1.5, marginTop: 9.5 },
  mainTrack: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 22 },
  trackFill: { height: 4, borderRadius: 2 },
  trackEmpty: { height: 4, backgroundColor: '#E0E0E0', borderRadius: 2 },
  trainIcon: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 1, zIndex: 1,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, elevation: 3,
  },
  status: { fontSize: 11, color: COLORS.textSub, textAlign: 'center' },
});
