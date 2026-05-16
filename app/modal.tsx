import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';

const COLORS = {
  primary: '#2E6D4D',
  background: '#F8F9FB',
  textMain: '#1C1C1E',
  textSub: '#8E8E93',
};

export default function SettingsModal() {
  const [nickname, setNickname] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const savedNickname = await AsyncStorage.getItem('user_nickname');
    const savedImage = await AsyncStorage.getItem('user_profile_image');
    if (savedNickname) setNickname(savedNickname);
    if (savedImage) setProfileImage(savedImage);
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setProfileImage(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    if (!nickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요!');
      return;
    }
    await AsyncStorage.setItem('user_nickname', nickname.trim());
    if (profileImage) {
      await AsyncStorage.setItem('user_profile_image', profileImage);
    }
    Alert.alert('성공', '프로필이 저장되었습니다!');
    router.back();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={COLORS.textMain} />
          </TouchableOpacity>

          <ThemedText style={styles.title}>내 정보 설정</ThemedText>
          
          {/* Profile Image Section */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} style={styles.imageWrapper}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="camera" size={32} color={COLORS.textSub} />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={14} color="white" />
              </View>
            </TouchableOpacity>
            <ThemedText style={styles.avatarHint}>프로필 사진을 변경하려면 클릭하세요</ThemedText>
          </View>

          <View style={styles.inputSection}>
            <ThemedText style={styles.label}>커뮤니티 닉네임</ThemedText>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color={COLORS.primary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="닉네임을 입력하세요"
                placeholderTextColor="#AEAEB2"
                value={nickname}
                onChangeText={setNickname}
                maxLength={12}
              />
            </View>
            <ThemedText style={styles.helperText}>최대 12자까지 입력 가능합니다.</ThemedText>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
            <ThemedText style={styles.saveText}>저장하기</ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 40,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textMain,
    marginBottom: 40,
    textAlign: 'center',
    lineHeight: 34,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  imageWrapper: {
    position: 'relative',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F2F2F7',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
  },
  editBadge: {
    position: 'absolute',
    right: 5,
    bottom: 5,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'white',
  },
  avatarHint: {
    marginTop: 16,
    fontSize: 13,
    color: COLORS.textSub,
    fontWeight: '500',
  },
  inputSection: {
    marginBottom: 40,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textMain,
    marginBottom: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.textMain,
    fontWeight: '600',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: COLORS.textSub,
    marginLeft: 4,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    marginTop: 'auto',
    marginBottom: 20,
  },
  saveText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
});
