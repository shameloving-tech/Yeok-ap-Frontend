import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ToastConfig } from 'react-native-toast-message';
import { ThemedText } from '@/components/themed-text';

const ICON: Record<string, any> = {
  success: { name: 'checkmark-circle-outline', color: '#34C759' },
  error: { name: 'close-circle-outline', color: '#FF3B30' },
  info: { name: 'information-circle-outline', color: '#fff' },
};

const ToastItem = ({ type, text1, text2 }: { type: string; text1?: string; text2?: string }) => {
  const icon = ICON[type] || ICON.info;
  return (
    <View style={styles.pill}>
      <Ionicons name={icon.name} size={18} color={icon.color} style={{ marginRight: 8, flexShrink: 0 }} />
      <View style={{ flexShrink: 1 }}>
        {text1 ? <ThemedText style={styles.title}>{text1}</ThemedText> : null}
        {text2 ? <ThemedText style={styles.body}>{text2}</ThemedText> : null}
      </View>
    </View>
  );
};

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => <ToastItem type="success" text1={text1} text2={text2} />,
  error: ({ text1, text2 }) => <ToastItem type="error" text1={text1} text2={text2} />,
  info: ({ text1, text2 }) => <ToastItem type="info" text1={text1} text2={text2} />,
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,30,30,0.88)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    maxWidth: '85%',
  },
  title: { fontSize: 14, fontWeight: '700', color: '#fff' },
  body: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
});
