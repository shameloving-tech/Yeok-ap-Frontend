import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { Ad } from '@/hooks/useAds';

type Props = {
  ad: Ad;
  style?: object;
};

export function AdBanner({ ad, style }: Props) {
  const handlePress = () => {
    if (ad.link_url) Linking.openURL(ad.link_url);
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={ad.link_url ? 0.8 : 1}
      onPress={handlePress}
      disabled={!ad.link_url}
    >
      <View style={styles.adLabel}>
        <ThemedText style={styles.adLabelText}>AD</ThemedText>
      </View>
      {ad.image_url ? (
        <Image source={{ uri: ad.image_url }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={styles.textOnly}>
          <ThemedText style={styles.title}>{ad.title}</ThemedText>
          {ad.link_url && <Ionicons name="chevron-forward" size={14} color={COLORS.textSub} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F2F2F7',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
  },
  adLabel: {
    position: 'absolute',
    top: 6,
    right: 8,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  adLabelText: { fontSize: 10, color: 'white', fontWeight: '600' },
  image: { width: '100%', height: 80 },
  textOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  title: { fontSize: 14, fontWeight: '500', color: COLORS.textMain, flex: 1 },
});
