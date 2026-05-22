import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITE_STATIONS_KEY = 'favorite_stations';

export interface FavoriteStation {
  station_name: string;
  line_name: string;
}

export const getFavoriteStations = async (): Promise<FavoriteStation[]> => {
  try {
    const raw = await AsyncStorage.getItem(FAVORITE_STATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const toggleFavoriteStation = async (s: FavoriteStation): Promise<FavoriteStation[]> => {
  const list = await getFavoriteStations();
  const idx = list.findIndex(
    (x) => x.station_name === s.station_name && x.line_name === s.line_name
  );
  const updated = idx >= 0 ? list.filter((_, i) => i !== idx) : [...list, s];
  await AsyncStorage.setItem(FAVORITE_STATIONS_KEY, JSON.stringify(updated));
  return updated;
};

export const isFavoriteStation = (
  list: FavoriteStation[],
  station_name: string,
  line_name: string
): boolean => list.some((s) => s.station_name === station_name && s.line_name === line_name);
