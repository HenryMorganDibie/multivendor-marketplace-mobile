import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { customerHelpArticles, customerHelpCategories } from '@/mocks/customerHelpData';
import HelpCenterHeader from '@/components/HelpCenterHeader';
import { Colors } from '@/constants/colors';

export default function CustomerHelpCategoryScreen() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const category = customerHelpCategories.find((c) => c.id === categoryId);
  const articles = customerHelpArticles.filter((a) => a.categoryId === categoryId);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <HelpCenterHeader title={category?.title ?? 'Help'} onBack={() => router.back()} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {category?.description ? (
            <Text style={styles.intro}>{category.description}</Text>
          ) : null}

          {articles.length > 0 ? (
            <View style={styles.card}>
              {articles.map((article, index) => {
                const isLast = index === articles.length - 1;
                return (
                  <React.Fragment key={article.id}>
                    <TouchableOpacity
                      style={styles.articleRow}
                      onPress={() => router.push(`/help-center/article/${article.id}` as any)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.articleTitle}>{article.title}</Text>
                      <ChevronRight size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {!isLast && <View style={styles.divider} />}
                  </React.Fragment>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No articles available</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
  },
  intro: {
    fontSize: 15,
    color: Colors.textTertiary,
    lineHeight: 21,
    marginBottom: 20,
    marginHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  articleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 12,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textTertiary,
  },
});
