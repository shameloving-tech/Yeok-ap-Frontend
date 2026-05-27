import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'favorite_routes_v2';
const RECENT_KEY = 'recent_routes_v2';

export type RouteLabel = '출근' | '퇴근' | '자주 가는 곳' | null;

export interface FavoriteRoute {
  id: string; // `${from}__${to}`
  from: string;
  to: string;
  label: RouteLabel;
  totalMin?: number;
  transfers?: number;
  savedAt: number;
}

export interface RecentRoute {
  from: string;
  to: string;
  totalMin?: number;
  usedAt: number;
}

// ── Favorite Routes ──────────────────────────────────────────
export const getFavoriteRoutes = async (): Promise<FavoriteRoute[]> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveFavoriteRoute = async (
  route: Omit<FavoriteRoute, 'id' | 'savedAt'>
): Promise<FavoriteRoute[]> => {
  const list = await getFavoriteRoutes();
  const id = `${route.from}__${route.to}`;
  const filtered = list.filter(r => r.id !== id);
  const updated = [{ ...route, id, savedAt: Date.now() }, ...filtered];
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
};

export const removeFavoriteRoute = async (id: string): Promise<FavoriteRoute[]> => {
  const list = await getFavoriteRoutes();
  const updated = list.filter(r => r.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
};

export const toggleFavoriteRoute = async (
  route: Omit<FavoriteRoute, 'id' | 'savedAt'>
): Promise<{ list: FavoriteRoute[]; added: boolean }> => {
  const list = await getFavoriteRoutes();
  const id = `${route.from}__${route.to}`;
  const exists = list.some(r => r.id === id);
  if (exists) {
    const updated = list.filter(r => r.id !== id);
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return { list: updated, added: false };
  } else {
    const updated = [{ ...route, id, savedAt: Date.now() }, ...list];
    await AsyncStorage.setItem(KEY, JSON.stringify(updated));
    return { list: updated, added: true };
  }
};

export const updateRouteLabel = async (id: string, label: RouteLabel): Promise<FavoriteRoute[]> => {
  const list = await getFavoriteRoutes();
  const updated = list.map(r => r.id === id ? { ...r, label } : r);
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
  return updated;
};

export const isFavoriteRoute = (list: FavoriteRoute[], from: string, to: string): boolean =>
  list.some(r => r.id === `${from}__${to}`);

// ── Recent Routes ─────────────────────────────────────────────
export const getRecentRoutes = async (): Promise<RecentRoute[]> => {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
};

export const saveRecentRoute = async (route: Omit<RecentRoute, 'usedAt'>): Promise<void> => {
  try {
    const list = await getRecentRoutes();
    const filtered = list.filter(r => !(r.from === route.from && r.to === route.to));
    const updated = [{ ...route, usedAt: Date.now() }, ...filtered].slice(0, 8);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
};
