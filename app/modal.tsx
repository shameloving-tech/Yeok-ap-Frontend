import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function SettingsModal() {
  const [nickname, setNickname] = useState('');
  const router = useRouter();

  useEffect(() => {
    loadNickname();
  }, []);

  const loadNickname = async () => {
    const saved = await AsyncStorage.getItem('user_nickname');
    if (saved) setNickname(saved);
  };

  const saveNickname = async () => {
    if (!nickname.trim()) {
      Alert.alert('알림', '닉네임을 입력해주세요!');
      return;
    }
    await AsyncStorage.setItem('user_nickname', nickname.trim());
    Alert.alert('성공', '닉네임이 저장되었습니다!');
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>내 정보 설정</ThemedText>
      <ThemedText style={styles.label}>커뮤니티에서 사용할 닉네임</ThemedText>
      
      <TextInput
        style={styles.input}
        placeholder="닉네임을 입력하세요"
        value={nickname}
        onChangeText={setNickname}
        autoFocus
      />

      <TouchableOpacity style={styles.saveBtn} onPress={saveNickname}>
        <ThemedText style={styles.saveText}>저장하기</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 40,
    textAlign: 'center',
  },
  label: {
    fontSize: 14,
    color: '#8e8e93',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f2f2f7',
    borderRadius: 15,
    padding: 18,
    fontSize: 16,
    marginBottom: 30,
  },
  saveBtn: {
    backgroundColor: '#FF9F43',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
  },
  saveText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
