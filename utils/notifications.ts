import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
};

export const scheduleDepartureNotification = async (
  from: string,
  to: string,
  minutesBefore: number,
  totalMin: number,
): Promise<string | null> => {
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚇 출발 시간이에요!',
        body: `${from} → ${to} (${totalMin}분 소요) — 지금 출발하세요`,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutesBefore * 60,
      },
    });
    return id;
  } catch {
    return null;
  }
};

export const cancelNotification = async (id: string) => {
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
};

export const cancelAllNotifications = async () => {
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
};

export type DepartureMinutes = 10 | 20 | 30;
