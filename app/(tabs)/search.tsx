import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <Ionicons name="search" size={64} color="#CCC" />
      <ThemedText style={styles.text}>Search is coming soon!</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
  },
  text: {
    marginTop: 20,
    fontSize: 18,
    color: '#8E8E93',
  },
});
