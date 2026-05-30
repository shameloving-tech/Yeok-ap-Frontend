import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { APP_COLORS as COLORS } from '@/constants/theme';
import { BASE_URL } from '@/constants/config';

type Faq = {
  id: number;
  category: string;
  question: string;
  answer: string;
  position: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  usage: '이용',
  error: '오류',
  account: '계정',
  etc: '기타',
};

const CATEGORY_COLORS: Record<string, string> = {
  usage: '#007AFF',
  error: '#FF3B30',
  account: '#34C759',
  etc: '#8E8E93',
};

export default function FaqsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetch(`${BASE_URL}/admin/faqs`)
      .then((r) => r.json())
      .then((data: Faq[]) => setFaqs(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ['all', ...Array.from(new Set(faqs.map((f) => f.category)))];
  const filtered = selectedCategory === 'all' ? faqs : faqs.filter((f) => f.category === selectedCategory);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textMain} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>자주 묻는 질문</ThemedText>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={COLORS.primary} />
      ) : faqs.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="help-circle-outline" size={48} color="#C7C7CC" />
          <ThemedText style={styles.emptyText}>등록된 FAQ가 없습니다</ThemedText>
        </View>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryBar}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, selectedCategory === cat && styles.categoryChipActive]}
                onPress={() => { setSelectedCategory(cat); setExpanded(null); }}
                activeOpacity={0.7}
              >
                <ThemedText
                  style={[styles.categoryChipText, selectedCategory === cat && styles.categoryChipTextActive]}
                >
                  {cat === 'all' ? '전체' : (CATEGORY_LABELS[cat] ?? cat)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView contentContainerStyle={styles.list}>
            {filtered.map((faq) => (
              <TouchableOpacity
                key={faq.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => setExpanded(expanded === faq.id ? null : faq.id)}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.questionRow}>
                    <ThemedText style={styles.qMark}>Q</ThemedText>
                    <ThemedText style={styles.question}>{faq.question}</ThemedText>
                  </View>
                  <Ionicons
                    name={expanded === faq.id ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="#C7C7CC"
                  />
                </View>
                <View style={styles.categoryRow}>
                  <View style={[styles.catBadge, { backgroundColor: (CATEGORY_COLORS[faq.category] ?? '#8E8E93') + '18' }]}>
                    <ThemedText style={[styles.catBadgeText, { color: CATEGORY_COLORS[faq.category] ?? '#8E8E93' }]}>
                      {CATEGORY_LABELS[faq.category] ?? faq.category}
                    </ThemedText>
                  </View>
                </View>
                {expanded === faq.id && (
                  <View style={styles.answerBox}>
                    <ThemedText style={styles.aMark}>A</ThemedText>
                    <ThemedText style={styles.answer}>{faq.answer}</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },

  categoryBar: { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
  categoryChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, backgroundColor: 'white',
    borderWidth: 1, borderColor: '#E5E5EA',
  },
  categoryChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryChipText: { fontSize: 12, fontWeight: '500', color: COLORS.textSub },
  categoryChipTextActive: { color: 'white', fontWeight: '700' },

  list: { padding: 20, paddingTop: 4, gap: 10 },

  card: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  questionRow: { flex: 1, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  qMark: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  question: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textMain, lineHeight: 22 },

  categoryRow: { flexDirection: 'row' },
  catBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },

  answerBox: {
    flexDirection: 'row', gap: 8,
    marginTop: 8, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E5EA',
  },
  aMark: { fontSize: 15, fontWeight: '800', color: COLORS.accent },
  answer: { flex: 1, fontSize: 14, color: COLORS.textMain, lineHeight: 22 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, color: '#C7C7CC' },
});
