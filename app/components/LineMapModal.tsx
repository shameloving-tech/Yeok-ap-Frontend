import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Callout, Marker, Polyline, UrlTile } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';
import { BASE_URL } from '@/constants/config';

const LEVEL_COLOR: Record<string, string> = {
  '폭발': '#FF3B30',
  '혼잡': '#FF9500',
  '보통': '#FFCC00',
  '여유': '#34C759',
};

const LEGEND: [string, string][] = [
  ['여유', '#34C759'],
  ['보통', '#FFCC00'],
  ['혼잡', '#FF9500'],
  ['폭발', '#FF3B30'],
  ['정보없음', '#D1D1D6'],
];

const AVG_SEG_SEC = 150;
const TRAIN_FETCH_MS = 20_000;

type Train = {
  train_no: string;
  direction: string;
  status_msg: string;
  prev_station: string | null;
  next_station: string;
  barvlDt: number;
  up_down: string;
};

type Props = {
  visible: boolean;
  lineName: string | null;
  liveStations: any[];
  onClose: () => void;
  onStationPress?: (station: any) => void;
};

// 두 좌표 사이를 progress(0~1)로 선형 보간
function lerp(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }, t: number) {
  return {
    latitude:  a.latitude  + (b.latitude  - a.latitude)  * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function TrainMarker({ coord, color, label }: {
  coord: { latitude: number; longitude: number };
  color: string;
  label: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Marker coordinate={coord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={[tm.outer, { borderColor: color }]}>
        <Animated.View style={[tm.pulse, { backgroundColor: color + '30', transform: [{ scale: pulse }] }]} />
        <View style={[tm.inner, { backgroundColor: color }]}>
          <Ionicons name="train" size={10} color="white" />
        </View>
      </View>
    </Marker>
  );
}

export function LineMapModal({ visible, lineName, liveStations, onClose, onStationPress }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [trains, setTrains] = useState<Train[]>([]);
  const [secs, setSecs] = useState<Record<string, number>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lineStations = liveStations.filter(
    s => s.line_name === lineName && s.latitude && s.longitude
  );

  // 역명 → 좌표 맵
  const coordMap = useRef<Record<string, { latitude: number; longitude: number }>>({});
  useEffect(() => {
    const m: Record<string, { latitude: number; longitude: number }> = {};
    lineStations.forEach(s => {
      const name = s.station_name.endsWith('역') ? s.station_name : `${s.station_name}역`;
      m[name] = { latitude: s.latitude, longitude: s.longitude };
      m[s.station_name] = { latitude: s.latitude, longitude: s.longitude };
    });
    coordMap.current = m;
  }, [lineName, liveStations.length]);

  const fetchTrains = useCallback(async () => {
    if (!lineName) return;
    try {
      const res = await fetch(`${BASE_URL}/api/v1/trains?line=${encodeURIComponent(lineName)}`);
      if (!res.ok) return;
      const data: Train[] = await res.json();
      setTrains(data);
      setSecs(prev => {
        const next: Record<string, number> = {};
        data.forEach(t => {
          const cur = prev[t.train_no];
          next[t.train_no] = cur !== undefined ? Math.min(cur, t.barvlDt) : t.barvlDt;
        });
        return next;
      });
    } catch {}
  }, [lineName]);

  useEffect(() => {
    if (!visible || !lineName) return;
    setTrains([]);
    setSecs({});
    fetchTrains();
    timerRef.current = setInterval(fetchTrains, TRAIN_FETCH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [visible, lineName, fetchTrains]);

  useEffect(() => {
    if (!visible) return;
    countRef.current = setInterval(() => {
      setSecs(prev => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) next[k] = Math.max(0, v - 1);
        return next;
      });
    }, 1000);
    return () => { if (countRef.current) clearInterval(countRef.current); };
  }, [visible, lineName]);

  useEffect(() => {
    if (!visible || lineStations.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        lineStations.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
        { edgePadding: { top: 120, right: 50, bottom: 60, left: 50 }, animated: true }
      );
    }, 500);
    return () => clearTimeout(timer);
  }, [visible, lineName, lineStations.length]);

  if (!lineName) return null;

  const lineColor = getLineColor(lineName);
  const lineNum = lineName.match(/(\d+)/)?.[1] || lineName.slice(0, 2);
  const liveCount = lineStations.filter(s => s.congestion_level).length;

  const polylineCoords = lineStations.map(s => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));

  // 열차 지도 좌표 계산
  const trainMarkers = trains
    .map(t => {
      const remaining = secs[t.train_no] ?? t.barvlDt;
      const progress = Math.max(0, Math.min(0.95, 1 - remaining / AVG_SEG_SEC));
      const prevCoord = t.prev_station ? coordMap.current[t.prev_station] : null;
      const nextCoord = coordMap.current[t.next_station];
      if (!nextCoord) return null;
      const from = prevCoord ?? nextCoord;
      return { key: t.train_no, coord: lerp(from, nextCoord, progress), label: t.train_no };
    })
    .filter(Boolean) as { key: string; coord: { latitude: number; longitude: number }; label: string }[];

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-down" size={26} color={COLORS.textMain} />
          </TouchableOpacity>
          <View style={[styles.lineCircle, { backgroundColor: lineColor }]}>
            <ThemedText style={styles.lineCircleText}>{lineNum}</ThemedText>
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.title}>{lineName} 실시간 지도</ThemedText>
            <ThemedText style={styles.subtitle}>
              역 {liveCount}개 · 열차 {trainMarkers.length}개 운행 중
            </ThemedText>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {LEGEND.map(([label, color]) => (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <ThemedText style={styles.legendLabel}>{label}</ThemedText>
            </View>
          ))}
          {trainMarkers.length > 0 && (
            <View style={styles.legendItem}>
              <Ionicons name="train" size={11} color={lineColor} />
              <ThemedText style={[styles.legendLabel, { color: lineColor }]}>열차</ThemedText>
            </View>
          )}
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          // Android: OSM 타일 사용 (Google Maps 불필요)
          // iOS: Apple Maps 기본 (무료)
          mapType={Platform.OS === 'android' ? 'none' : 'standard'}
          initialRegion={{
            latitude: 37.5665,
            longitude: 126.978,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          showsMyLocationButton={false}
          showsUserLocation={false}
          showsCompass={false}
          toolbarEnabled={false}
        >
          {/* Android OSM 타일 */}
          {Platform.OS === 'android' && (
            <UrlTile
              urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maximumZ={19}
              flipY={false}
            />
          )}

          {/* 노선 연결선 */}
          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={lineColor + 'AA'}
              strokeWidth={4}
            />
          )}

          {/* 역 마커 */}
          {lineStations.map(station => {
            const color = LEVEL_COLOR[station.congestion_level] || '#D1D1D6';
            return (
              <Marker
                key={`${station.station_name}-${station.line_name}`}
                coordinate={{ latitude: station.latitude, longitude: station.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
              >
                <View style={[styles.markerOuter, { borderColor: color }]}>
                  <View style={[styles.markerInner, { backgroundColor: color }]} />
                </View>
                <Callout onPress={() => { onStationPress?.(station); onClose(); }}>
                  <View style={styles.callout}>
                    <ThemedText style={styles.calloutName}>{station.station_name}</ThemedText>
                    <View style={[styles.calloutBadge, { backgroundColor: color + '22' }]}>
                      <ThemedText style={[styles.calloutLevel, { color }]}>
                        {station.congestion_level || '정보없음'}
                      </ThemedText>
                    </View>
                    {station.arrival_message ? (
                      <ThemedText style={styles.calloutMsg} numberOfLines={1}>
                        {station.arrival_message}
                      </ThemedText>
                    ) : null}
                    <ThemedText style={styles.calloutTap}>탭하여 상세보기 →</ThemedText>
                  </View>
                </Callout>
              </Marker>
            );
          })}

          {/* 열차 위치 마커 */}
          {trainMarkers.map(tm => (
            <TrainMarker key={tm.key} coord={tm.coord} color={lineColor} label={tm.label} />
          ))}
        </MapView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    gap: 10,
  },
  closeBtn: { padding: 4 },
  lineCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  lineCircleText: { color: 'white', fontSize: 16, fontWeight: '800' },
  title: { fontSize: 16, fontWeight: '800', color: COLORS.textMain },
  subtitle: { fontSize: 11, color: COLORS.textSub, marginTop: 1 },

  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
    backgroundColor: '#FAFAFA',
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSub },

  map: { flex: 1 },

  markerOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  markerInner: { width: 11, height: 11, borderRadius: 6 },

  callout: { width: 190, padding: 12, gap: 5 },
  calloutName: { fontSize: 15, fontWeight: '800', color: '#1C1C1E' },
  calloutBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 6, marginTop: 2,
  },
  calloutLevel: { fontSize: 12, fontWeight: '700' },
  calloutMsg: { fontSize: 11, color: '#6D6D72', marginTop: 2 },
  calloutTap: { fontSize: 11, color: COLORS.primary, marginTop: 6, fontWeight: '600' },
});

const tm = StyleSheet.create({
  outer: {
    width: 32, height: 32,
    justifyContent: 'center', alignItems: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 28, height: 28, borderRadius: 14,
  },
  inner: {
    width: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.25,
    shadowRadius: 4, elevation: 4,
  },
});
