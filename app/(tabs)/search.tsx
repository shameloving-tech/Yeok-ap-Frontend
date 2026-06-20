import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS, SHADOW } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';
import { useSubwayDataContext } from '@/contexts/SubwayDataContext';
import {
  FavoriteRoute, RecentRoute, RouteLabel,
  getFavoriteRoutes, getRecentRoutes,
  saveRecentRoute, toggleFavoriteRoute, isFavoriteRoute, updateRouteLabel,
} from '@/utils/favoriteRoutes';
import {
  scheduleDepartureNotification, cancelNotification, DepartureMinutes,
} from '@/utils/notifications';
import { getNotifSetting } from '@/app/notification-settings';

type Station = { id: number; station_name: string; line: string };
type GroupedStation = { station_name: string; lines: { id: number; line: string }[] };
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

const LABELS: { value: RouteLabel; emoji: string; label: string }[] = [
  { value: '출근', emoji: '🏢', label: '출근' },
  { value: '퇴근', emoji: '🏠', label: '퇴근' },
  { value: '자주 가는 곳', emoji: '📍', label: '자주 가는 곳' },
  { value: null, emoji: '🔖', label: '저장만' },
];

const NOTIF_OPTIONS: { mins: DepartureMinutes; label: string }[] = [
  { mins: 10, label: '10분 전' },
  { mins: 20, label: '20분 전' },
  { mins: 30, label: '30분 전' },
];

export default function RouteScreen() {
  const insets = useSafeAreaInsets();
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const [fromStation, setFromStation] = useState<Station | null>(null);
  const [toStation, setToStation] = useState<Station | null>(null);
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [suggestions, setSuggestions] = useState<GroupedStation[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [mode, setMode] = useState<'fastest' | 'min_transfers'>('fastest');
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');
  const fromRef = useRef<TextInput>(null);
  const toRef = useRef<TextInput>(null);
  const { stationList } = useSubwayDataContext();

  // ── 즐겨찾기 & 최근 경로 ─────────────────────────────────
  const [favRoutes, setFavRoutes] = useState<FavoriteRoute[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [labelVisible, setLabelVisible] = useState(false);
  const [notifVisible, setNotifVisible] = useState(false);
  const [notifScheduledMins, setNotifScheduledMins] = useState<DepartureMinutes | null>(null);
  const [notifId, setNotifId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getFavoriteRoutes(), getRecentRoutes()]).then(([favs, recents]) => {
      setFavRoutes(favs);
      setRecentRoutes(recents);
    });
  }, []);

  // 홈에서 경로 카드 탭 시 파라미터로 자동 검색
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  useEffect(() => {
    if (params.from && params.to) {
      setFromText(params.from);
      setToText(params.to);
      setFromStation({ id: 0, station_name: params.from, line: '' });
      setToStation({ id: 0, station_name: params.to, line: '' });
      setTimeout(() => searchRoute('fastest', params.from, params.to), 100);
    }
  }, [params.from, params.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentIsFav = routeResult
    ? isFavoriteRoute(favRoutes, routeResult.from, routeResult.to)
    : false;

  const handleToggleFav = async () => {
    if (!routeResult) return;
    const { list, added } = await toggleFavoriteRoute({
      from: routeResult.from,
      to: routeResult.to,
      label: null,
      totalMin: routeResult.total_min,
      transfers: routeResult.transfers,
    });
    setFavRoutes(list);
    if (added) setLabelVisible(true);
  };

  const handleSelectLabel = async (label: RouteLabel) => {
    if (!routeResult) return;
    const id = `${routeResult.from}__${routeResult.to}`;
    const list = await updateRouteLabel(id, label);
    setFavRoutes(list);
    setLabelVisible(false);
  };

  const handleScheduleNotif = async (mins: DepartureMinutes) => {
    if (!routeResult) return;
    const enabled = await getNotifSetting('departure');
    if (!enabled) {
      Alert.alert('출발 알림 꺼짐', '설정 > 알림 설정에서 출발 알림을 켜주세요.');
      setNotifVisible(false);
      return;
    }
    if (notifId) await cancelNotification(notifId);
    const id = await scheduleDepartureNotification(
      routeResult.from, routeResult.to, mins, routeResult.total_min
    );
    if (id) {
      setNotifId(id);
      setNotifScheduledMins(mins);
      Alert.alert('알림 설정', `출발 ${mins}분 전에 알림을 드릴게요 🔔`);
    } else {
      Alert.alert('알림 권한 필요', '설정 > 역앞에서 알림을 허용해 주세요');
    }
    setNotifVisible(false);
  };

  const handleCancelNotif = async () => {
    if (notifId) { await cancelNotification(notifId); setNotifId(null); }
    setNotifScheduledMins(null);
    setNotifVisible(false);
  };

  // ── 역 자동완성 ─────────────────────────────────────────
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return; }
    setSugLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(q.trim())}`);
      if (!res.ok) { setSuggestions([]); return; }
      const data = await res.json();
      const groupMap = new Map<string, GroupedStation>();
      const groupOrder: string[] = [];
      (data as Station[]).forEach(s => {
        const name = s.station_name.replace(/역$/, '');
        if (!groupMap.has(name)) {
          groupMap.set(name, { station_name: name, lines: [] });
          groupOrder.push(name);
        }
        const entry = groupMap.get(name)!;
        if (!entry.lines.some(l => l.line === s.line)) {
          entry.lines.push({ id: s.id, line: s.line });
        }
      });
      setSuggestions(groupOrder.slice(0, 8).map(n => groupMap.get(n)!));
    } catch { setSuggestions([]); }
    finally { setSugLoading(false); }
  }, []);

  useEffect(() => {
    const q = activeField === 'from' ? fromText : toText;
    if (!q.trim()) { setSuggestions([]); return; }
    const t = setTimeout(() => fetchSuggestions(q), 250);
    return () => clearTimeout(t);
  }, [fromText, toText, activeField, fetchSuggestions]);

  const selectStation = (grouped: GroupedStation) => {
    const displayName = grouped.station_name;
    const repStation: Station = { id: grouped.lines[0]?.id ?? 0, station_name: displayName, line: grouped.lines[0]?.line ?? '' };
    if (activeField === 'from') {
      setFromStation(repStation);
      setFromText(displayName);
      setActiveField('to');
      setTimeout(() => toRef.current?.focus(), 100);
    } else {
      setToStation(repStation);
      setToText(displayName);
      setActiveField(null);
    }
    setSuggestions([]);
  };

  const applyRecentRoute = (r: RecentRoute) => {
    setFromText(r.from);
    setToText(r.to);
    setFromStation({ id: 0, station_name: r.from, line: '' });
    setToStation({ id: 0, station_name: r.to, line: '' });
    setActiveField(null);
    setSuggestions([]);
    // 바로 검색 (현재 선택된 mode 사용)
    setTimeout(() => searchRoute(mode, r.from, r.to), 50);
  };

  const swapStations = () => {
    setFromStation(toStation);
    setToStation(fromStation);
    setFromText(toText);
    setToText(fromText);
    setRouteResult(null);
    setRouteError('');
  };

  const searchRoute = async (
    overrideMode?: 'fastest' | 'min_transfers',
    overrideFrom?: string,
    overrideTo?: string,
  ) => {
    const from = overrideFrom ?? (fromStation?.station_name || fromText.trim());
    const to   = overrideTo   ?? (toStation?.station_name   || toText.trim());
    if (!from || !to) return;
    setRouteLoading(true);
    setRouteError('');
    setRouteResult(null);
    setActiveField(null);
    // 새 경로 검색 시 이전 알림 취소 및 초기화
    if (notifId) cancelNotification(notifId);
    setNotifScheduledMins(null);
    setNotifId(null);
    try {
      const res = await fetch(
        `${BASE_URL}/api/v1/stations/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&mode=${overrideMode ?? mode}`
      );
      if (!res.ok) { setRouteError('경로를 찾을 수 없습니다.'); return; }
      const data = await res.json();
      if (data.error) { setRouteError(data.error); }
      else {
        setRouteResult(data);
        // 최근 경로 저장
        await saveRecentRoute({ from, to, totalMin: data.total_min });
        const recents = await getRecentRoutes();
        setRecentRoutes(recents);
      }
    } catch { setRouteError('네트워크 오류가 발생했습니다.'); }
    finally { setRouteLoading(false); }
  };

  useEffect(() => {
    const from = fromStation?.station_name || fromText.trim();
    const to = toStation?.station_name || toText.trim();
    if (!from || !to) return;
    if (!routeResult) return; // 이전 검색 결과 있을 때만 모드 변경 재검색
    searchRoute(mode);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeText = activeField === 'from' ? fromText : toText;
  const showSuggestions = activeField !== null && suggestions.length > 0;
  const showRecent = activeField !== null && !sugLoading && !suggestions.length && !activeText.trim() && recentRoutes.length > 0;

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

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <TouchableOpacity style={styles.swapBtn} onPress={swapStations}>
            <Ionicons name="swap-vertical" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

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
            onSubmitEditing={() => searchRoute()}
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
          onPress={() => searchRoute()}
          disabled={!fromText.trim() || !toText.trim()}
        >
          <ThemedText style={styles.searchBtnText}>검색</ThemedText>
        </TouchableOpacity>
      </View>

      {/* 역 자동완성 드롭다운 */}
      {showSuggestions && (
        <View style={styles.dropdown}>
          {sugLoading && <ActivityIndicator color={COLORS.primary} style={{ padding: 12 }} />}
          <FlatList
            data={suggestions}
            keyExtractor={item => item.station_name}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.suggestionItem} onPress={() => selectStation(item)}>
                <ThemedText style={styles.suggestionName}>{item.station_name}</ThemedText>
                <View style={styles.suggestionBadgeRow}>
                  {item.lines.map(l => (
                    <View key={l.line} style={[styles.suggestionLineBadge, { backgroundColor: getLineColor(l.line) }]}>
                      <ThemedText style={styles.suggestionBadgeText}>{lineLabel(l.line)}</ThemedText>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* 최근 경로 드롭다운 */}
      {showRecent && (
        <View style={styles.dropdown}>
          <View style={styles.recentHeader}>
            <Ionicons name="time-outline" size={13} color={COLORS.textSub} />
            <ThemedText style={styles.recentHeaderText}>최근 검색</ThemedText>
          </View>
          {recentRoutes.slice(0, 5).map((r) => (
            <TouchableOpacity
              key={`${r.from}-${r.to}-${r.usedAt}`}
              style={styles.recentRouteItem}
              onPress={() => applyRecentRoute(r)}
            >
              <View style={styles.recentRouteStations}>
                <ThemedText style={styles.recentFrom}>{r.from}</ThemedText>
                <Ionicons name="arrow-forward" size={12} color={COLORS.textSub} style={{ marginHorizontal: 4 }} />
                <ThemedText style={styles.recentTo}>{r.to}</ThemedText>
              </View>
              {r.totalMin && (
                <ThemedText style={styles.recentMin}>{r.totalMin}분</ThemedText>
              )}
            </TouchableOpacity>
          ))}
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
            {/* 액션 바: 즐겨찾기 + 알림 */}
            <View style={styles.actionBar}>
              <View style={styles.actionRouteLabel}>
                <ThemedText style={styles.actionFrom}>{routeResult.from}</ThemedText>
                <Ionicons name="arrow-forward" size={12} color={COLORS.textSub} style={{ marginHorizontal: 4 }} />
                <ThemedText style={styles.actionTo}>{routeResult.to}</ThemedText>
              </View>
              <View style={styles.actionBtns}>
                {/* 알림 버튼 */}
                <TouchableOpacity
                  style={[styles.actionBtn, notifScheduledMins !== null && styles.actionBtnActive]}
                  onPress={() => setNotifVisible(true)}
                >
                  <Ionicons
                    name={notifScheduledMins !== null ? 'notifications' : 'notifications-outline'}
                    size={18}
                    color={notifScheduledMins !== null ? COLORS.primary : COLORS.textSub}
                  />
                  {notifScheduledMins !== null && (
                    <ThemedText style={styles.actionBtnBadge}>{notifScheduledMins}분</ThemedText>
                  )}
                </TouchableOpacity>
                {/* 즐겨찾기 버튼 */}
                <TouchableOpacity
                  style={[styles.actionBtn, currentIsFav && styles.actionBtnActive]}
                  onPress={handleToggleFav}
                >
                  <Ionicons
                    name={currentIsFav ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={currentIsFav ? COLORS.primary : COLORS.textSub}
                  />
                </TouchableOpacity>
              </View>
            </View>

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
                        <ThemedText style={styles.stepStationSmall}>{step.station}</ThemedText>
                        <View style={styles.expressPill}>
                          <Ionicons name="flash" size={10} color="#FF9500" />
                          <ThemedText style={styles.expressPillText}>급행</ThemedText>
                        </View>
                      </View>
                    </View>
                  );
                }
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

      {/* ── 즐겨찾기 라벨 선택 모달 ── */}
      <Modal visible={labelVisible} transparent animationType="fade" onRequestClose={() => setLabelVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLabelVisible(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <ThemedText style={styles.modalTitle}>어떤 경로예요?</ThemedText>
            <ThemedText style={styles.modalSub}>라벨을 지정하면 홈에서 바로 접근할 수 있어요</ThemedText>
            <View style={styles.labelGrid}>
              {LABELS.map(l => (
                <TouchableOpacity key={String(l.value)} style={styles.labelBtn} onPress={() => handleSelectLabel(l.value)}>
                  <ThemedText style={styles.labelEmoji}>{l.emoji}</ThemedText>
                  <ThemedText style={styles.labelText}>{l.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── 출발 알림 모달 ── */}
      <Modal visible={notifVisible} transparent animationType="fade" onRequestClose={() => setNotifVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setNotifVisible(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <ThemedText style={styles.modalTitle}>출발 알림 설정</ThemedText>
            <ThemedText style={styles.modalSub}>
              {routeResult ? `${routeResult.from} → ${routeResult.to} (${routeResult.total_min}분)` : ''}
            </ThemedText>
            <View style={styles.notifOptions}>
              {NOTIF_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.mins}
                  style={[styles.notifBtn, notifScheduledMins === o.mins && styles.notifBtnActive]}
                  onPress={() => handleScheduleNotif(o.mins)}
                >
                  <Ionicons name="alarm-outline" size={18} color={notifScheduledMins === o.mins ? 'white' : COLORS.textMain} />
                  <ThemedText style={[styles.notifBtnText, notifScheduledMins === o.mins && { color: 'white' }]}>{o.label}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
            {notifScheduledMins !== null && (
              <TouchableOpacity style={styles.cancelNotifBtn} onPress={handleCancelNotif}>
                <ThemedText style={styles.cancelNotifText}>알림 취소</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain },

  inputCard: {
    margin: 16, backgroundColor: COLORS.cardBg, borderRadius: 16,
    padding: 16, ...SHADOW.md,
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
  modeBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, borderRadius: 999 },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 13, fontWeight: '500', color: COLORS.textSub },
  modeBtnTextActive: { color: 'white' },
  searchBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999 },
  searchBtnDisabled: { backgroundColor: COLORS.border },
  searchBtnText: { color: 'white', fontWeight: '600', fontSize: 14 },

  // 드롭다운 공통
  dropdown: {
    marginHorizontal: 16, backgroundColor: COLORS.cardBg, borderRadius: 14,
    maxHeight: 300, ...SHADOW.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.border, zIndex: 100,
  },

  // 역 자동완성
  suggestionItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  suggestionBadgeRow: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '55%' },
  suggestionLineBadge: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  suggestionBadge: { width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  suggestionBadgeText: { color: 'white', fontSize: 12, fontWeight: '700' },
  suggestionName: { fontSize: 15, fontWeight: '600', color: COLORS.textMain },
  suggestionLine: { fontSize: 12, color: COLORS.textSub, marginTop: 1 },

  // 최근 경로
  recentHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  recentHeaderText: { fontSize: 11, color: COLORS.textSub, fontWeight: '600' },
  recentRouteItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  recentRouteStations: { flexDirection: 'row', alignItems: 'center' },
  recentFrom: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  recentTo: { fontSize: 14, fontWeight: '700', color: COLORS.textMain },
  recentMin: { fontSize: 12, color: COLORS.textSub, fontWeight: '600' },

  results: { flex: 1 },
  centered: { paddingTop: 60, alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, color: COLORS.textSub },
  errorText: { fontSize: 15, color: COLORS.textSub, textAlign: 'center', paddingHorizontal: 40 },
  placeholderText: { fontSize: 15, color: COLORS.textSub },

  resultCard: { margin: 16, backgroundColor: COLORS.cardBg, borderRadius: 16, overflow: 'hidden', ...SHADOW.md },

  // 액션 바
  actionBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  actionRouteLabel: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  actionFrom: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  actionTo: { fontSize: 13, fontWeight: '700', color: COLORS.textMain },
  actionBtns: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  actionBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '12' },
  actionBtnBadge: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  summaryRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '700', color: COLORS.textMain },
  summaryLabel: { fontSize: 12, color: COLORS.textSub, marginTop: 2 },
  summaryDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: COLORS.border },
  expressBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  expressText: { fontSize: 13, fontWeight: '700', color: '#FF9500' },

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
  congestionBadgeText: { fontSize: 11, fontWeight: '600' },

  // 모달 공통
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 14, paddingBottom: 20,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textMain, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.textSub, marginBottom: 20 },

  // 라벨 선택
  labelGrid: { flexDirection: 'row', gap: 12 },
  labelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 16,
    backgroundColor: COLORS.background, borderRadius: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  labelEmoji: { fontSize: 24, marginBottom: 6 },
  labelText: { fontSize: 12, fontWeight: '700', color: COLORS.textMain },

  // 알림 옵션
  notifOptions: { gap: 10, marginBottom: 12 },
  notifBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 14, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  notifBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  notifBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.textMain },
  cancelNotifBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelNotifText: { fontSize: 14, color: '#FF3B30', fontWeight: '600' },
});
