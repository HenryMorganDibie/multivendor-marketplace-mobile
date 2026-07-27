import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { helpArticles, helpCategories } from '@/mocks/helpData';
import HelpCenterHeader from '@/components/HelpCenterHeader';
import { Colors } from '@/constants/colors';

export default function HelpCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();

  const category = helpCategories.find((c) => c.id === categoryId);
  const subcategories = helpCategories.filter(
    (c) => c.isSubcategory && c.parentCategoryId === categoryId
  );
  const articles = helpArticles.filter((a) => a.categoryId === categoryId);

  const handleArticlePress = (articleId: string) => {
    router.push(`/vendor/settings/help-article/${articleId}` as any);
  };

  const handleSubcategoryPress = (subCategoryId: string) => {
    router.push(`/vendor/settings/help-category/${subCategoryId}` as any);
  };

  const showSubcategories = categoryId === 'features-plans' && subcategories.length > 0;
  const rows = showSubcategories ? subcategories : articles;

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
          {rows.length > 0 ? (
            <View style={styles.card}>
              {rows.map((row, index) => {
                const isLast = index === rows.length - 1;
                return (
                  <React.Fragment key={row.id}>
                    <TouchableOpacity
                      style={styles.articleRow}
                      onPress={() =>
                        showSubcategories
                          ? handleSubcategoryPress(row.id)
                          : handleArticlePress(row.id)
                      }
                      activeOpacity={0.6}
                    >
                      <Text style={styles.articleTitle}>{row.title}</Text>
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
