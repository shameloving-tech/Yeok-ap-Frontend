import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

import { ThemedText } from '@/components/themed-text';

const COLORS = {
  primary: '#2E6D4D',
  error: '#FF3B30',
  warning: '#FF9500',
  textMain: '#1C1C1E',
  textSub: '#8E8E93',
};

const toastStyle = {
  borderRadius: 16,
  paddingHorizontal: 16,
  paddingVertical: 12,
  height: 'auto' as any,
  minHeight: 60,
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: 8,
  width: '90%' as any,
};

export const toastConfig: ToastConfig = {
  success: ({ text1, text2 }) => (
    <View style={[styles.container, { borderLeftColor: COLORS.primary }]}>
      <View style={[styles.iconWrap, { backgroundColor: COLORS.primary + '18' }]}>
        <Ionicons name="checkmark-circle" size={22} color={COLORS.primary} />
      </View>
      <View style={styles.textWrap}>
        {text1 ? <ThemedText style={styles.title}>{text1}</ThemedText> : null}
        {text2 ? <ThemedText style={styles.body}>{text2}</ThemedText> : null}
      </View>
    </View>
  ),
  error: ({ text1, text2 }) => (
    <View style={[styles.container, { borderLeftColor: COLORS.error }]}>
      <View style={[styles.iconWrap, { backgroundColor: COLORS.error + '18' }]}>
        <Ionicons name="alert-circle" size={22} color={COLORS.error} />
      </View>
      <View style={styles.textWrap}>
        {text1 ? <ThemedText style={styles.title}>{text1}</ThemedText> : null}
        {text2 ? <ThemedText style={styles.body}>{text2}</ThemedText> : null}
      </View>
    </View>
  ),
  info: ({ text1, text2 }) => (
    <View style={[styles.container, { borderLeftColor: '#007AFF' }]}>
      <View style={[styles.iconWrap, { backgroundColor: '#007AFF18' }]}>
        <Ionicons name="information-circle" size={22} color="#007AFF" />
      </View>
      <View style={styles.textWrap}>
        {text1 ? <ThemedText style={styles.title}>{text1}</ThemedText> : null}
        {text2 ? <ThemedText style={styles.body}>{text2}</ThemedText> : null}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    borderLeftWidth: 4,
    paddingHorizontal: 14,
    paddingVertical: 14,
    width: '90%',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  textWrap: { flex: 1 },
  title: { fontSize: 14, fontWeight: '800', color: '#1C1C1E', marginBottom: 2 },
  body: { fontSize: 13, color: '#8E8E93', lineHeight: 18 },
});
