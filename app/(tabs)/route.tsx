import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { BASE_URL } from '@/constants/config';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { APP_COLORS as COLORS } from '@/constants/theme';

interface Suggestion {
  id: number;
  station_name: string;
  line: string;
}

interface RouteStep {
  type: 'board' | 'travel' | 'transfer' | 'express';
  station: string;
  line: string;
  prev_line?: string;
}

interface RouteResult {
  from: string;
  to: string;
  total_min: number;
  transfers: number;
  stops: number;
  express_active: boolean;
  express_used: boolean;
  steps: RouteStep[];
}

interface Segment {
  line: string;
  stations: string[];
  isExpress: boolean;
}

const groupBySegments = (steps: RouteStep[]): Segment[] => {
  const segments: Segment[] = [];
  for (const step of steps) {
    if (step.type === 'transfer' || segments.length === 0) {
      segments.push({ line: step.line, stations: [step.station], isExpress: false });
    } else {
      const cur = segments[segments.length - 1];
      cur.stations.push(step.station);
      if (step.type === 'express') cur.isExpress = true;
    }
  }
  return segments;
};

const hasLine = (segments: Segment[], lineName: string) =>
  segments.some((s) => s.line.includes(lineName));

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState<Suggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<Suggestion[]>([]);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeField !== 'from' || !from.trim()) {
      setFromSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(from.trim())}`);
        setFromSuggestions(await res.json());
      } catch {
        setFromSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [from, activeField]);

  useEffect(() => {
    if (activeField !== 'to' || !to.trim()) {
      setToSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(to.trim())}`);
        setToSuggestions(await res.json());
      } catch {
        setToSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [to, activeField]);

  const handleSearch = async () => {
    if (!from.trim() || !to.trim()) {
      setError('출발역과 도착역을 모두 입력하세요');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setActiveField(null);
    try {
      const fromName = from.trim().replace(/역$/, '');
      const toName = to.trim().replace(/역$/, '');
      const url = `${BASE_URL}/api/v1/stations/route?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '경로를 찾을 수 없습니다');
      } else {
        setResult(json);
      }
    } catch {
      setError('네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  const swapStations = () => {
    const tmp = from;
    setFrom(to);
    setTo(tmp);
    setResult(null);
  };

  const selectSuggestion = (s: Suggestion) => {
    if (activeField === 'from') {
      setFrom(s.station_name);
      setFromSuggestions([]);
    } else if (activeField === 'to') {
      setTo(s.station_name);
      setToSuggestions([]);
    }
    setActiveField(null);
  };

  const segments = result ? groupBySegments(result.steps) : [];
  const shows9LineExpress = result && hasLine(segments, '9호선');

  const expressBannerText = () => {
    if (!result) return '';
    if (result.express_active && result.express_used) return '현재 급행 운행 중 · 급행 이용 경로';
    if (result.express_active && !result.express_used) return '현재 급행 운행 중 (이 경로는 미이용)';
    return '현재 급행 미운행 시간대';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>길찾기</ThemedText>
      </View>

      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <TextInput
            style={styles.input}
            placeholder="출발역"
            placeholderTextColor={COLORS.textSub}
            value={from}
            onChangeText={(v) => { setFrom(v); setActiveField('from'); }}
            onFocus={() => setActiveField('from')}
            returnKeyType="next"
          />
          {from.length > 0 && (
            <TouchableOpacity onPress={() => { setFrom(''); setFromSuggestions([]); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={swapStations}>
            <Ionicons name="swap-vertical" size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
          <TextInput
            style={styles.input}
            placeholder="도착역"
            placeholderTextColor={COLORS.textSub}
            value={to}
            onChangeText={(v) => { setTo(v); setActiveField('to'); }}
            onFocus={() => setActiveField('to')}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
          {to.length > 0 && (
            <TouchableOpacity onPress={() => { setTo(''); setToSuggestions([]); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
          <Ionicons name="search" size={18} color="white" />
          <ThemedText style={styles.searchBtnText}>경로 검색</ThemedText>
        </TouchableOpacity>
      </View>

      {/* 자동완성 목록 */}
      {activeField && ((activeField === 'from' ? fromSuggestions : toSuggestions).length > 0) && (
        <View style={styles.suggestionBox}>
          <FlatList
            data={activeField === 'from' ? fromSuggestions : toSuggestions}
            keyExtractor={(item) => `${item.id}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                <View style={[styles.lineBadgeSm, { backgroundColor: getLineColor(item.line) }]}>
                  <ThemedText style={styles.lineBadgeSmText}>{getLineNumber(item.line)}</ThemedText>
                </View>
                <ThemedText style={styles.suggestionName}>{item.station_name}</ThemedText>
                <ThemedText style={styles.suggestionLine}>{item.line}</ThemedText>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 결과 */}
      <ScrollView
        style={styles.resultArea}
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        {loading && (
          <View style={styles.statusBox}>
            <ActivityIndicator color={COLORS.primary} />
            <ThemedText style={styles.statusText}>경로 검색 중...</ThemedText>
          </View>
        )}

        {error && (
          <View style={styles.statusBox}>
            <Ionicons name="alert-circle-outline" size={32} color="#FF3B30" />
            <ThemedText style={styles.errorText}>{error}</ThemedText>
          </View>
        )}

        {result && (
          <View>
            {/* 요약 커드: 시간 / 환승 / 정거장 3등분 */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Ionicons name="time-outline" size={18} color={COLORS.primary} />
                <ThemedText style={styles.summaryText}>약 {result.total_min}분</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="swap-horizontal" size={18} color={COLORS.primary} />
                <ThemedText style={styles.summaryText}>환승 {result.transfers}회</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Ionicons name="train-outline" size={18} color={COLORS.primary} />
                <ThemedText style={styles.summaryText}>{result.stops}정거장</ThemedText>
              </View>
            </View>

            {/* 9호선 급행 운행 상태 배너 */}
            {shows9LineExpress && (
              <View style={[
                styles.expressBanner,
                result.express_active ? styles.expressBannerActive : styles.expressBannerInactive,
              ]}>
                <View style={[
                  styles.expressBannerDot,
                  { backgroundColor: result.express_active ? '#34C759' : '#8E8E93' },
                ]} />
                <ThemedText style={[
                  styles.expressBannerText,
                  { color: result.express_active ? '#1C6E33' : '#636366' },
                ]}>
                  9호선 {expressBannerText()}
                </ThemedText>
              </View>
            )}

            {segments.map((seg, idx) => (
              <View key={idx} style={styles.segmentCard}>
                <View style={styles.segmentHeader}>
                  <View style={[styles.lineCircle, { backgroundColor: getLineColor(seg.line) }]}>
                    <ThemedText style={styles.lineCircleText}>{getLineNumber(seg.line)}</ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.segmentTitleRow}>
                      <ThemedText style={styles.segmentLine}>{seg.line}</ThemedText>
                      {seg.isExpress && (
                        <View style={styles.expressBadge}>
                          <ThemedText style={styles.expressBadgeText}>급행</ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.segmentSub}>
                      {seg.isExpress ? '급행 이동' : `${seg.stations.length - 1}정거장 이동`}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.stationList}>
                  {seg.stations.map((station, sIdx) => (
                    <View key={sIdx} style={styles.stationItem}>
                      <View style={[styles.stationDot, { backgroundColor: getLineColor(seg.line) }]} />
                      <ThemedText style={[
                        styles.stationText,
                        (sIdx === 0 || sIdx === seg.stations.length - 1) && styles.stationTextBold,
                      ]}>
                        {station}
                      </ThemedText>
                    </View>
                  ))}
                </View>
                {idx < segments.length - 1 && (
                  <View style={styles.transferBox}>
                    <Ionicons name="arrow-down" size={18} color={COLORS.textSub} />
                    <ThemedText style={styles.transferText}>환승 (약 5분)</ThemedText>
                  </View>
                )}
              </View>
            ))}
            <View style={{ height: 30 }} />
            <ThemedText style={styles.disclaimer}>* 소요시간은 역간 2분/환승 5분 기준 예상치. 실제와 다를 수 있습니다.</ThemedText>
          </View>
        )}

        {!result && !loading && !error && (
          <View style={styles.emptyBox}>
            <Ionicons name="navigate-outline" size={48} color={COLORS.textSub} />
            <ThemedText style={styles.emptyText}>출발역과 도착역을 입력하세요</ThemedText>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  inputCard: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  input: { flex: 1, fontSize: 15, color: COLORS.textMain, paddingVertical: 6 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  swapBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: 'white',
    justifyContent: 'center', alignItems: 'center',
    marginHorizontal: 8,
  },
  searchBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, borderRadius: 12,
    paddingVertical: 12, marginTop: 12, gap: 6,
  },
  searchBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
  suggestionBox: {
    marginHorizontal: 20, marginTop: 10,
    backgroundColor: 'white', borderRadius: 12,
    maxHeight: 220, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  lineBadgeSm: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  lineBadgeSmText: { color: 'white', fontSize: 11, fontWeight: '800' },
  suggestionName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  suggestionLine: { fontSize: 12, color: COLORS.textSub },
  resultArea: { flex: 1, paddingHorizontal: 20, marginTop: 16 },
  statusBox: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  statusText: { fontSize: 14, color: COLORS.textSub },
  errorText: { fontSize: 14, color: '#FF3B30', textAlign: 'center' },
  summaryCard: {
    flexDirection: 'row', backgroundColor: 'white', borderRadius: 14,
    padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  summaryItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  summaryDivider: { width: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  summaryText: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  expressBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 10,
  },
  expressBannerActive: { backgroundColor: '#E8F9EE' },
  expressBannerInactive: { backgroundColor: '#F2F2F7' },
  expressBannerDot: { width: 8, height: 8, borderRadius: 4 },
  expressBannerText: { fontSize: 13, fontWeight: '600' },
  segmentCard: {
    backgroundColor: 'white', borderRadius: 14, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  segmentHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  lineCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  lineCircleText: { color: 'white', fontSize: 13, fontWeight: '800' },
  segmentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  segmentLine: { fontSize: 15, fontWeight: '800', color: COLORS.textMain },
  segmentSub: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },
  expressBadge: {
    backgroundColor: '#FF9500',
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  expressBadgeText: { color: 'white', fontSize: 11, fontWeight: '800' },
  stationList: { paddingLeft: 8, gap: 6 },
  stationItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stationDot: { width: 6, height: 6, borderRadius: 3 },
  stationText: { fontSize: 13, color: COLORS.textMain },
  stationTextBold: { fontWeight: '800' },
  transferBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  transferText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  disclaimer: { fontSize: 11, color: COLORS.textSub, textAlign: 'center', paddingHorizontal: 20 },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 14, color: COLORS.textSub },
});
