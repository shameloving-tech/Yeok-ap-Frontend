import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useEffect, useRef } from 'react';
import { Modal, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Callout, Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LineCongestionSheet } from '@/components/LineCongestionSheet';
import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getLineColor } from '@/constants/lines';

// Android MapView는 Google Maps API 키가 필요합니다.
// 키가 없으면 LineCongestionSheet(수평 노선도)로 폴백합니다.
const hasGoogleMapsKey =
  Platform.OS !== 'android' ||
  !!(Constants.expoConfig?.android as any)?.config?.googleMaps?.apiKey;

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

type Props = {
  visible: boolean;
  lineName: string | null;
  liveStations: any[];
  onClose: () => void;
  onStationPress?: (station: any) => void;
};

export function LineMapModal({ visible, lineName, liveStations, onClose, onStationPress }: Props) {
  // 모든 훅은 조건부 반환 전에 호출 (Rules of Hooks)
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const lineStations = liveStations.filter(
    s => s.line_name === lineName && s.latitude && s.longitude
  );

  useEffect(() => {
    if (!hasGoogleMapsKey || !visible || lineStations.length === 0) return;
    const timer = setTimeout(() => {
      mapRef.current?.fitToCoordinates(
        lineStations.map(s => ({ latitude: s.latitude, longitude: s.longitude })),
        { edgePadding: { top: 120, right: 50, bottom: 60, left: 50 }, animated: true }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [visible, lineName, lineStations.length]);

  // Google Maps API 키 없으면 수평 노선도로 폴백 (hooks 이후 조건부 반환 OK)
  if (!hasGoogleMapsKey) {
    return (
      <LineCongestionSheet
        visible={visible}
        lineName={lineName}
        liveStations={liveStations}
        onClose={onClose}
        onStationPress={onStationPress}
      />
    );
  }

  if (!lineName) return null;

  const lineColor = getLineColor(lineName);
  const lineNum = lineName.match(/(\d+)/)?.[1] || lineName.slice(0, 2);
  const liveCount = lineStations.filter(s => s.congestion_level).length;

  const polylineCoords = lineStations.map(s => ({
    latitude: s.latitude,
    longitude: s.longitude,
  }));

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
            <ThemedText style={styles.title}>{lineName} 혼잡도 지도</ThemedText>
            <ThemedText style={styles.subtitle}>
              실시간 {liveCount}개 역 · 총 {lineStations.length}개 역
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
        </View>

        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 37.5665,
            longitude: 126.978,
            latitudeDelta: 0.15,
            longitudeDelta: 0.15,
          }}
          showsMyLocationButton={false}
        >
          {/* 노선 연결선 */}
          {polylineCoords.length > 1 && (
            <Polyline
              coordinates={polylineCoords}
              strokeColor={lineColor + '80'}
              strokeWidth={3}
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
