import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { getOrCreateNickname } from '@/utils/deviceToken';

export default function ProfileEditScreen() {
  const insets = useSafeAreaInsets();
  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const nick = await getOrCreateNickname();
      setNickname(nick);
      const img = await AsyncStorage.getItem('user_profile_image');
      if (img) setProfileImage(img);
    };
    init();
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });
    if (!result.canceled) setProfileImage(result.assets[0].uri);
  };

  const saveProfile = async () => {
    if (!nickname.trim()) {
      Toast.show({ type: 'error', text1: '알림', text2: '닉네임을 입력해주세요!' });
      return;
    }
    await AsyncStorage.setItem('user_nickname', nickname.trim());
    if (profileImage) await AsyncStorage.setItem('user_profile_image', profileImage);
    Toast.show({ type: 'success', text1: '저장 완료', text2: '프로필이 업데이트됐습니다!' });
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>프로필 편집</ThemedText>
        <TouchableOpacity onPress={saveProfile} style={styles.headerBtn}>
          <ThemedText style={styles.saveText}>저장</ThemedText>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          {/* 아바타 */}
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatar} contentFit="cover" />
            ) : (
              <Image
                source={{ uri: `https://api.dicebear.com/7.x/avataaars/svg?seed=${nickname || 'default'}` }}
                style={styles.avatar}
                contentFit="cover"
              />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </TouchableOpacity>
          <ThemedText style={styles.avatarHint}>탭해서 사진 변경</ThemedText>

          {/* 닉네임 */}
          <View style={styles.inputSection}>
            <ThemedText style={styles.label}>닉네임</ThemedText>
            <View style={styles.inputRow}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.input}
                placeholder="닉네임을 입력하세요"
                placeholderTextColor={COLORS.textSub}
                value={nickname}
                onChangeText={setNickname}
                maxLength={12}
                autoFocus
              />
              <ThemedText style={styles.counter}>{nickname.length}/12</ThemedText>
            </View>
            <ThemedText style={styles.hint}>커뮤니티 제보 시 사용되는 이름입니다.</ThemedText>
          </View>

          {/* 저장 버튼 */}
          <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
            <ThemedText style={styles.saveBtnText}>저장하기</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F2F2F7',
  },
  headerBtn: { width: 56, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.textMain },
  saveText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },

  body: { flex: 1, alignItems: 'center', padding: 32 },

  avatarWrapper: { marginTop: 16, position: 'relative' },
  avatar: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#F2F2F7',
    borderWidth: 3, borderColor: 'white',
  },
  cameraBadge: {
    position: 'absolute', right: 2, bottom: 2,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: 'white',
  },
  avatarHint: { marginTop: 10, fontSize: 13, color: COLORS.textSub, marginBottom: 36 },

  inputSection: { width: '100%', marginBottom: 32 },
  label: { fontSize: 14, fontWeight: '700', color: COLORS.textSub, marginBottom: 10, marginLeft: 2 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'white', borderRadius: 16,
    paddingHorizontal: 16, height: 56,
    borderWidth: 1.5, borderColor: '#E5E5EA',
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.textMain },
  counter: { fontSize: 13, color: COLORS.textSub },
  hint: { marginTop: 8, fontSize: 12, color: COLORS.textSub, marginLeft: 2 },

  saveBtn: {
    width: '100%', height: 56, borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primary, shadowOpacity: 0.25, shadowRadius: 12, elevation: 5,
  },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },
});
