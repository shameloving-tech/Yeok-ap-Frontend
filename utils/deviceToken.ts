import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'device_token';
const NICKNAME_KEY = 'user_nickname';

const AUTO_NICKNAMES = [
  '역앞탐험가', '지하철여행자', '출퇴근마스터', '환승의달인',
  '열차수호자', '지하철덕후', '노선박사', '새벽통근러',
  '지하철매니아', '역명암기왕', '급행열차팬', '막차의왕',
  '환승지킴이', '지하철나침반', '역간수다왕',
];

function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getDeviceToken(): Promise<string> {
  let token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    token = uuidv4();
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
  return token;
}

export async function getOrCreateNickname(): Promise<string> {
  let nickname = await AsyncStorage.getItem(NICKNAME_KEY);
  if (!nickname) {
    const idx = Math.floor(Math.random() * AUTO_NICKNAMES.length);
    nickname = AUTO_NICKNAMES[idx];
    await AsyncStorage.setItem(NICKNAME_KEY, nickname);
  }
  return nickname;
}
