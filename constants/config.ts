import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getDevHost = (): string => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return hostUri.split(':')[0];
  if (Platform.OS === 'android') return '10.0.2.2';
  return 'localhost';
};

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_HOST) return process.env.EXPO_PUBLIC_API_HOST;
  if (__DEV__) return `http://${getDevHost()}:3000`;
  return 'https://yeok-ap-backend.onrender.com';
};

const getWsUrl = (): string => {
  if (process.env.EXPO_PUBLIC_WS_URL) return process.env.EXPO_PUBLIC_WS_URL;
  if (__DEV__) return `ws://${getDevHost()}:3000/cable`;
  return 'wss://yeok-ap-backend.onrender.com/cable';
};

export const BASE_URL = getBaseUrl();
export const WS_URL = getWsUrl();
