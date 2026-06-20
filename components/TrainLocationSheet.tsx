import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_COLORS as COLORS } from '@/constants/theme';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://yeok-ap-backend.onrender.com';

const SUPPORTED_LINES = [
  '2호선', '1호선', '3호선', '4호선', '5호선',
  '6호선', '7호선', '8호선', '9호선',
  '수인분당선', '공항철도', '신분당선', '경의중앙선',
];

const LINE_COLORS: Record<string, string> = {
  '1호선': '#0052A4',
  '2호선': '#009246',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
  '수인분당선': '#FABE00',
  '공항철도': '#0090D2',
  '신분당선': '#D4003B',
  '경의중앙선': '#77C4A3',
};

const FETCH_MS = 20_000;
const AVG_SEG_SEC = 150;

type Train = {
  train_no: string;
  direction: string;
  status_msg: string;
  prev_station: string | null;
  next_station: string;
  barvlDt: number;
  up_down: string;
};

function TrainCard({ train, lineColor }: { train: Train; lineColor: string }) {
  const [remaining, setRemaining] = useState(train.barvlDt);

  useEffect(() => {
    setRemaining(train.barvlDt);
    const interval = setInterval(() => {
      setRemaining(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [train.barvlDt]);

  const progress = Math.max(0, Math.min(0.96, 1 - remaining / AVG_SEG_SEC));
  const isUrgent = remaining <= 60;

  const formatTime = (sec: number) => {
    if (sec <= 0) return '도착 중';
    if (sec <= 30) return '곧 도착';
    if (sec < 60) return `${sec}초`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s === 0 ? `${m}분` : `${m}분 ${s}초`;
  };

  return (
    <View style={cardStyles.container}>
      <View style={cardStyles.header}>
        <View style={[cardStyles.directionBadge, { backgroundColor: lineColor + '22' }]}>
          <Text style={[cardStyles.directionText, { color: lineColor }]}>{train.direction}</Text>
        </View>
        <View style={[cardStyles.timeBadge, isUrgent && { backgroundColor: '#FF3B30' }]}>
          <Text style={[cardStyles.timeText, isUrgent && { color: 'white' }]}>{formatTime(remaining)}</Text>
        </View>
      </View>

      <View style={cardStyles.segment}>
        <View style={cardStyles.stationDot} />
        <View style={cardStyles.trackContainer}>
          <View style={[cardStyles.trackFilled, { flex: progress }]} />
          <View style={cardStyles.trainIcon}>
            <Text style={cardStyles.trainEmoji}>🚇</Text>
          </View>
          <View style={[cardStyles.trackEmpty, { flex: 1 - progress }]} />
        </View>
        <View style={cardStyles.stationDot} />
      </View>

      <View style={cardStyles.stationLabels}>
        <Text style={cardStyles.stationLabel} numberOfLines={1}>
          {train.prev_station ?? '??'}
        </Text>
        <Text style={cardStyles.stationLabel} numberOfLines={1}>
          {train.next_station}
        </Text>
      </View>

      <Text style={cardStyles.statusMsg} numberOfLines={1}>{train.status_msg}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  directionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  directionText: { fontSize: 13, fontWeight: '600' },
  timeBadge: {
    backgroundColor: COLORS.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  timeText: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  stationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3A3A3C',
  },
  trackContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 4,
    marginHorizontal: 4,
  },
  trackFilled: {
    height: 4,
    backgroundColor: '#3A3A3C',
    minWidth: 0,
  },
  trainIcon: {
    marginHorizontal: -6,
    zIndex: 1,
  },
  trainEmoji: { fontSize: 20, lineHeight: 24 },
  trackEmpty: {
    height: 4,
    backgroundColor: '#D1D1D6',
    minWidth: 0,
  },
  stationLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  stationLabel: {
    fontSize: 12,
    color: '#636366',
    maxWidth: '45%',
  },
  statusMsg: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
});

interface TrainLocationSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function TrainLocationSheet({ visible, onClose }: TrainLocationSheetProps) {
  const insets = useSafeAreaInsets();
  const [selectedLine, setSelectedLine] = useState(SUPPORTED_LINES[0]);
  const [trains, setTrains] = useState<Train[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedLineRef = useRef(selectedLine);

  useEffect(() => { selectedLineRef.current = selectedLine; }, [selectedLine]);

  const loadTrains = useCallback(async (line: string) => {
    setLoading(true);
    setError(null);
    try {
      const encoded = encodeURIComponent(line);
      const res = await fetch(`${API_BASE}/api/v1/trains?line=${encoded}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Train[] = await res.json();
      setTrains(data);
    } catch {
      setError('열차 정보를 불러오지 못했습니다');
      setTrains([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    loadTrains(selectedLine);
    intervalRef.current = setInterval(() => loadTrains(selectedLineRef.current), FETCH_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, selectedLine, loadTrains]);

  const lineColor = LINE_COLORS[selectedLine] ?? COLORS.primary;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={sheetStyles.overlay}>
        <TouchableOpacity style={sheetStyles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[sheetStyles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={sheetStyles.handle} />

          <View style={[sheetStyles.accentBar, { backgroundColor: lineColor }]} />
          <View style={sheetStyles.headerRow}>
            <View>
              <Text style={sheetStyles.title}>열차 위치보기</Text>
              <Text style={sheetStyles.subtitle}>{selectedLine} · 근접 열차 최대 5개</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#3A3A3C" />
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={sheetStyles.tabList}
            style={sheetStyles.tabScroll}
          >
            {SUPPORTED_LINES.map(line => (
              <TouchableOpacity
                key={line}
                style={[
                  sheetStyles.tab,
                  selectedLine === line && { backgroundColor: LINE_COLORS[line] ?? COLORS.primary },
                ]}
                onPress={() => {
                  setSelectedLine(line);
                  setTrains([]);
                }}
              >
                <Text style={[
                  sheetStyles.tabText,
                  selectedLine === line && { color: 'white' },
                ]}>{line}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            style={sheetStyles.trainList}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {loading && trains.length === 0 ? (
              <View style={sheetStyles.center}>
                <ActivityIndicator color={lineColor} />
                <Text style={sheetStyles.centerText}>열차 정보 수신 중...</Text>
              </View>
            ) : error ? (
              <View style={sheetStyles.center}>
                <Ionicons name="alert-circle-outline" size={36} color="#FF3B30" />
                <Text style={sheetStyles.centerText}>{error}</Text>
                <TouchableOpacity
                  style={[sheetStyles.retryBtn, { borderColor: lineColor }]}
                  onPress={() => loadTrains(selectedLine)}
                >
                  <Text style={[sheetStyles.retryText, { color: lineColor }]}>다시 시도</Text>
                </TouchableOpacity>
              </View>
            ) : trains.length === 0 ? (
              <View style={sheetStyles.center}>
                <Ionicons name="train-outline" size={36} color="#8E8E93" />
                <Text style={sheetStyles.centerText}>현재 운행 중인 열차가 없습니다</Text>
              </View>
            ) : (
              trains.map(train => (
                <TrainCard key={train.train_no} train={train} lineColor={lineColor} />
              ))
            )}
            <Text style={sheetStyles.footnote}>열차 위치는 도착 예상 시간 기반 보간값입니다</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#C7C7CC',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  accentBar: {
    height: 3,
    marginHorizontal: 16,
    borderRadius: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },
  subtitle: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  tabScroll: { maxHeight: 50 },
  tabList: { paddingHorizontal: 16, gap: 8, alignItems: 'center', height: 44 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.border,
  },
  tabText: { fontSize: 13, fontWeight: '500', color: COLORS.textSub },
  trainList: { flex: 1 },
  center: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  centerText: { fontSize: 14, color: COLORS.textSub, fontWeight: '500' },
  retryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8, marginTop: 4 },
  retryText: { fontSize: 14, fontWeight: '600' },
  footnote: { fontSize: 11, color: '#AEAEB2', textAlign: 'center', marginTop: 8, marginBottom: 4 },
});
