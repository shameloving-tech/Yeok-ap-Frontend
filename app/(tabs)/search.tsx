import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { StationDetailModal } from '@/components/StationDetailModal';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor, getLineNumber } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';
import { useSubwayDataContext } from '@/contexts/SubwayDataContext';

type Station = { id: number; station_name: string; line: string };
type RouteStep = { type: string; station: string; line: string; prev_line?: string };
type RouteResult = {
  from: string; to: string; total_min: number;
  transfers: number; stops: number;
  express_active: boolean; express_used: boolean;
  steps: RouteStep[];
};

function lineLabel(line: string) {
  return line?.match(/(\d+)/)?.[1] || line?.slice(0, 2) || 'M';
}

const CONGESTION_COLOR: Record<string, string> = {
  '혼잡': '#FF9500',
  '폭발': '#FF3B30',
};

function getCongestion(stationList: any[], stationName: string, lineName: string): string | null {
  const nameA = stationName.endsWith('역') ? stationName : `${stationName}역`;
  const nameB = stationName.endsWith('역') ? stationName.slice(0, -1) : stationName;
  const found = stationList.find(
    s => (s.station_name === nameA || s.station_name === nameB) && s.line_name === lineName
  );
  const level = found?.congestion_level;
  return level && CONGESTION_COLOR[level] ? level : null;
}

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [suggestions, setSuggestions] = useState<Station[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [mode, setMode] = useState<'fastest' | 'min_transfers'>('fastest');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);
  const { stationList } = useSubwayDataContext();

  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      // Deduplicate: treat "강남" and "강남역" as same station
      const seen = new Set<string>();
      const deduped = (data as Station[]).filter(s => {
        const key = s.station_name.replace(/역$/, '');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setSuggestions(deduped.slice(0, 8));
    } catch { setSuggestions([]); }
    finally { setSugLoading(false); }
  }, []);

  useEffect(() => {
    const q = activeField === 'from' ? fromText : toText;
    if (!q.trim()) { setSuggestions([]); return; }
    const t = setTimeout(() => fetchSuggestions(q), 250);
    return () => clearTimeout(t);
  }, [fromText, toText, activeField, fetchSuggestions]);

  const selectStation = (station: Station) => {
    const displayName = station.station_name.replace(/역$/, '');
    if (activeField === 'from') {
      setFromStation({ ...station, station_name: displayName });
      setFromText(displayName);
      setActiveField('to');
      setTimeout(() => toRef.current?.focus(), 100);
    } else {
      setToStation({ ...station, station_name: displayName });
      setToText(displayName);
      setActiveField(null);
    }
    setSuggestions([]);
  };

  const swapStations = () => {
    setFromStation(toStation);
    setToStation(fromStation);
    setFromText(toText);
    setToText(fromText);
    setRouteResult(null);
    setRouteError('');
  };

  const searchRoute = async () => {
    const from = fromStation?.station_name || fromText.trim();
    const to = toStation?.station_name || toText.trim();
    if (!from || !to) return;
    setRouteLoading(true);
    setRouteError('');
    setRouteResult(null);
    setActiveField(null);
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/stations/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${mode}`
      );
      const data = await res.json();
      if (data.error) { setRouteError(data.error); }
      else { setRouteResult(data); }
    } catch { setRouteError('네트워크 오류가 발생했습니다.'); }
    finally { setRouteLoading(false); }
  };

  const showSuggestions = activeField !== null && suggestions.length > 0;

  const handleSelect = async (item: any) => {
    const payload = { station_name: item.station_name, line_name: item.line };
    await saveRecentStation(payload);
    setDetailStation(payload);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>길찾기</ThemedText>
      </View>

      {/* Input Card */}
      <View style={styles.inputCard}>
        {/* From */}
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <TextInput
            ref={fromRef}
            style={styles.input}
            placeholder="출발역"
            placeholderTextColor={COLORS.textSub}
            value={fromText}
            onChangeText={t => { setFromText(t); setFromStation(null); }}
            onFocus={() => setActiveField('from')}
            returnKeyType="next"
            onSubmitEditing={() => toRef.current?.focus()}
          />
          {fromText.length > 0 && (
            <TouchableOpacity onPress={() => { setFromText(''); setFromStation(null); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>

        {/* Divider + Swap */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={swapStations}>
            <Ionicons name="swap-vertical" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* To */}
        <View style={styles.inputRow}>
          <View style={[styles.dot, { backgroundColor: '#FF3B30' }]} />
          <TextInput
            ref={toRef}
            style={styles.input}
            placeholder="도착역"
            placeholderTextColor={COLORS.textSub}
            value={toText}
            onChangeText={t => { setToText(t); setToStation(null); }}
            onFocus={() => setActiveField('to')}
            returnKeyType="search"
            onSubmitEditing={searchRoute}
          />
          {toText.length > 0 && (
            <TouchableOpacity onPress={() => { setToText(''); setToStation(null); }}>
              <Ionicons name="close-circle" size={18} color={COLORS.textSub} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Mode toggle + Search button */}
      <View style={styles.controlRow}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'fastest' && styles.modeBtnActive]}
            onPress={() => setMode('fastest')}
          >
            <Ionicons name="flash" size={14} color={mode === 'fastest' ? 'white' : COLORS.textSub} style={{ marginRight: 4 }} />
            <ThemedText style={[styles.modeBtnText, mode === 'fastest' && styles.modeBtnTextActive]}>빠른길</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'min_transfers' && styles.modeBtnActive]}
            onPress={() => setMode('min_transfers')}
          >
            <Ionicons name="git-branch" size={14} color={mode === 'min_transfers' ? 'white' : COLORS.textSub} style={{ marginRight: 4 }} />
            <ThemedText style={[styles.modeBtnText, mode === 'min_transfers' && styles.modeBtnTextActive]}>환승 적게</ThemedText>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.searchBtn, (!fromText.trim() || !toText.trim()) && styles.searchBtnDisabled]}
          onPress={searchRoute}
          disabled={!fromText.trim() || !toText.trim()}
        >
          <ThemedText style={styles.searchBtnText}>검색</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Autocomplete dropdown */}
      {showSuggestions && (
        <View style={styles.dropdown}>
          {sugLoading && <ActivityIndicator color={COLORS.primary} style={{ padding: 12 }} />}
          <FlatList
            data={suggestions}
            keyExtractor={item => `${item.id}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => selectStation(item)}>
                <View style={[styles.suggestionBadge, { backgroundColor: getLineColor(item.line) }]}>
                  <ThemedText style={styles.suggestionBadgeText}>{lineLabel(item.line)}</ThemedText>
                </View>
                <View>
                  <ThemedText style={styles.suggestionName}>{item.station_name}</ThemedText>
                  <ThemedText style={styles.suggestionLine}>{item.line}</ThemedText>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Results */}
      <ScrollView
        style={styles.results}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {routeLoading && (
          <View style={styles.centered}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <ThemedText style={styles.loadingText}>경로를 찾는 중...</ThemedText>
          </View>
        )}

        {routeError ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={48} color={COLORS.textSub} />
            <ThemedText style={styles.errorText}>{routeError}</ThemedText>
          </View>
        ) : null}

        {routeResult && !routeLoading && (
          <View style={styles.resultCard}>
            {/* Summary */}
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryValue}>{routeResult.total_min}분</ThemedText>
                <ThemedText style={styles.summaryLabel}>소요시간</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryValue}>{routeResult.transfers}회</ThemedText>
                <ThemedText style={styles.summaryLabel}>환승</ThemedText>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <ThemedText style={styles.summaryValue}>{routeResult.stops}</ThemedText>
                <ThemedText style={styles.summaryLabel}>정거장</ThemedText>
              </View>
              {routeResult.express_used && (
                <>
                  <View style={styles.summaryDivider} />
                  <View style={[styles.summaryItem, styles.expressBadge]}>
                    <Ionicons name="flash" size={14} color="#FF9500" />
                    <ThemedText style={styles.expressText}>급행</ThemedText>
                  </View>
                </>
              )}
            </View>

            {/* 혼잡도 경보 배너 */}
            {(() => {
              const warnings = routeResult.steps
                .filter(s => s.type === 'board' || s.type === 'transfer')
                .map(s => ({ station: s.station, line: s.line, level: getCongestion(stationList, s.station, s.line) }))
                .filter(w => w.level !== null);
              if (warnings.length === 0) return null;
              return (
                <View style={styles.congestionBanner}>
                  <Ionicons name="warning" size={15} color="#FF9500" />
                  <ThemedText style={styles.congestionBannerText}>
                    {warnings.map(w => `${w.station}(${w.line}) ${w.level}`).join(' · ')} 주의
                  </ThemedText>
                </View>
              );
            })()}

            {/* Steps */}
            <View style={styles.stepsContainer}>
              {routeResult.steps.map((step, idx) => {
                const congestion = (step.type === 'board' || step.type === 'transfer')
                  ? getCongestion(stationList, step.station, step.line) : null;
                if (step.type === 'board') {
                  return (
                    <View key={idx} style={styles.step}>
                      <View style={[styles.stepDot, { backgroundColor: getLineColor(step.line) }]} />
                      <View style={styles.stepContent}>
                        <View style={styles.stationRow}>
                          <ThemedText style={styles.stepStation}>{step.station}</ThemedText>
                          {congestion && (
                            <View style={[styles.congestionBadge, { backgroundColor: CONGESTION_COLOR[congestion] + '22' }]}>
                              <ThemedText style={[styles.congestionBadgeText, { color: CONGESTION_COLOR[congestion] }]}>{congestion}</ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={[styles.linePill, { backgroundColor: getLineColor(step.line) + '22' }]}>
                          <ThemedText style={[styles.linePillText, { color: getLineColor(step.line) }]}>{step.line} 탑승</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                }
                if (step.type === 'transfer') {
                  return (
                    <View key={idx} style={styles.step}>
                      <View style={styles.stepLineTransfer} />
                      <View style={[styles.stepDot, { backgroundColor: getLineColor(step.line), borderWidth: 2, borderColor: 'white' }]} />
                      <View style={styles.stepContent}>
                        <View style={styles.stationRow}>
                          <ThemedText style={styles.stepStation}>{step.station}</ThemedText>
                          {congestion && (
                            <View style={[styles.congestionBadge, { backgroundColor: CONGESTION_COLOR[congestion] + '22' }]}>
                              <ThemedText style={[styles.congestionBadgeText, { color: CONGESTION_COLOR[congestion] }]}>{congestion}</ThemedText>
                            </View>
                          )}
                        </View>
                        <View style={styles.transferRow}>
                          <Ionicons name="swap-horizontal" size={12} color={COLORS.textSub} />
                          <ThemedText style={styles.transferText}>{step.line} 환승</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                }
                if (step.type === 'express') {
                  return (
                    <View key={idx} style={styles.step}>
                      <View style={[styles.stepLine, { backgroundColor: getLineColor(step.line) + '44' }]} />
                      <View style={[styles.stepDotSmall, { backgroundColor: getLineColor(step.line) }]} />
                      <View style={styles.stepContent}>
                        <ThemedText style={[styles.stepStationSmall]}>{step.station}</ThemedText>
                        <View style={styles.expressPill}>
                          <Ionicons name="flash" size={10} color="#FF9500" />
                          <ThemedText style={styles.expressPillText}>급행</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                }
                // travel
                return (
                  <View key={idx} style={styles.step}>
                    <View style={[styles.stepLine, { backgroundColor: getLineColor(step.line) + '44' }]} />
                    <View style={[styles.stepDotSmall, { backgroundColor: getLineColor(step.line) + '88' }]} />
                    <ThemedText style={styles.stepStationSmall}>{step.station}</ThemedText>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {!routeResult && !routeLoading && !routeError && (
          <View style={styles.centered}>
            <Ionicons name="subway-outline" size={64} color={COLORS.textSub} style={{ opacity: 0.4 }} />
            <ThemedText style={styles.placeholderText}>출발역과 도착역을 입력하세요</ThemedText>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.primary },

  inputCard: {
    margin: 16, backgroundColor: 'white', borderRadius: 20,
    padding: 16, elevation: 3,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 44 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border, marginLeft: 22 },
  swapBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
    marginLeft: 12,
  },

  controlRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8, gap: 12 },
  modeToggle: {
    flex: 1, flexDirection: 'row', backgroundColor: COLORS.border,
    borderRadius: 12, padding: 3,
  },
  modeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.textSub },
  modeBtnTextActive: { color: 'white' },
  searchBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
  searchBtnDisabled: { backgroundColor: COLORS.border },
  searchBtnText: { color: 'white', fontWeight: '800', fontSize: 15 },

  dropdown: {
    marginHorizontal: 16, backgroundColor: 'white', borderRadius: 16,
    maxHeight: 280, elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16,
    borderWidth: 1, borderColor: COLORS.border, zIndex: 100,
  },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  suggestionBadge: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  suggestionBadgeText: { color: 'white', fontSize: 13, fontWeight: '800' },
  suggestionName: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  suggestionLine: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },

  results: { flex: 1 },
  centered: { paddingTop: 60, alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: COLORS.textSub },
  errorText: { fontSize: 15, color: COLORS.textSub, textAlign: 'center', paddingHorizontal: 40 },
  placeholderText: { fontSize: 15, color: COLORS.textSub },

  resultCard: { margin: 16, backgroundColor: 'white', borderRadius: 20, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '900', color: COLORS.textMain },
  summaryLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: COLORS.border },
  expressBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expressText: { fontSize: 13, fontWeight: '800', color: '#FF9500' },

  stepsContainer: { padding: 20 },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2, position: 'relative' },
  stepDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12, marginTop: 4, zIndex: 1 },
  stepDotSmall: { width: 8, height: 8, borderRadius: 4, marginRight: 12, marginTop: 6, marginLeft: 3, zIndex: 1 },
  stepLine: { position: 'absolute', left: 6, top: -8, width: 2, height: 24, zIndex: 0 },
  stepLineTransfer: { position: 'absolute', left: 6, top: -8, width: 2, height: 24, backgroundColor: COLORS.border, zIndex: 0 },
  stepContent: { flex: 1, paddingBottom: 12 },
  stepStation: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  stepStationSmall: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
  linePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginTop: 4 },
  linePillText: { fontSize: 12, fontWeight: '700' },
  transferRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  transferText: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },
  expressPill: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  expressPillText: { fontSize: 11, color: '#FF9500', fontWeight: '700' },

  congestionBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF3E0', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#FFE0B2',
  },
  congestionBannerText: { fontSize: 12, color: '#E65100', fontWeight: '600', flex: 1 },
  stationRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  congestionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  congestionBadgeText: { fontSize: 11, fontWeight: '800' },
});
