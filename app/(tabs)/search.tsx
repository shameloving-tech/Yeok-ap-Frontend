import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import { saveRecentStation } from './index';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailStation, setDetailStation] = useState<any>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/api/v1/stations?q=${encodeURIComponent(query.trim())}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (item: any) => {
    const payload = { station_name: item.station_name, line_name: item.line };
    await saveRecentStation(payload);
    setDetailStation(payload);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>역 검색</ThemedText>
      </View>

      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={20} color={COLORS.primary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="역 이름을 입력하세요"
          placeholderTextColor={COLORS.textSub}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSub} />
          </TouchableOpacity>
        )}
      </View>

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={48} color={COLORS.textSub} />
          <ThemedText style={styles.emptyText}>'{query}'에 해당하는 역이 없습니다</ThemedText>
        </View>
      )}

      {!query.trim() && (
        <View style={styles.emptyContainer}>
          <Ionicons name="train-outline" size={48} color={COLORS.textSub} />
          <ThemedText style={styles.emptyText}>역 이름을 입력해서 검색하세요</ThemedText>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => `${item.id}`}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
            <View style={[styles.lineBadge, { backgroundColor: getLineColor(item.line) }]}>
              <ThemedText style={styles.lineBadgeText}>{getLineNumber(item.line)}</ThemedText>
            </View>
            <View style={styles.resultInfo}>
              <ThemedText style={styles.stationName}>{item.station_name}</ThemedText>
              <ThemedText style={styles.lineName}>{item.line}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.textSub} />
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <StationDetailModal
        visible={!!detailStation}
        station={detailStation}
        onClose={() => setDetailStation(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.textMain },
  loadingContainer: { padding: 20, alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: COLORS.textSub },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  lineBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  lineBadgeText: { color: 'white', fontSize: 14, fontWeight: '800' },
  resultInfo: { flex: 1 },
  stationName: { fontSize: 16, fontWeight: '700', color: COLORS.textMain },
  lineName: { fontSize: 13, color: COLORS.textSub, marginTop: 2 },
});
