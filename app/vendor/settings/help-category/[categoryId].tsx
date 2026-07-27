import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { helpArticles, helpCategories } from '@/mocks/helpData';

export default function HelpCategoryScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  
  const category = helpCategories.find(c => c.id === categoryId);
  const subcategories = helpCategories.filter(c => c.isSubcategory && c.parentCategoryId === categoryId);
  const articles = helpArticles.filter(a => a.categoryId === categoryId);

  const handleArticlePress = (articleId: string) => {
    router.push(`/vendor/settings/help-article/${articleId}` as any);
  };

  const handleSubcategoryPress = (subCategoryId: string) => {
    router.push(`/vendor/settings/help-category/${subCategoryId}` as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: category?.title || 'Help',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {categoryId === 'features-plans' && subcategories.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.glassCard}>
                {subcategories.map((subcat, index) => {
                  const isLast = index === subcategories.length - 1;
                  
                  return (
                    <React.Fragment key={subcat.id}>
                      <TouchableOpacity
                        style={styles.articleRow}
                        onPress={() => handleSubcategoryPress(subcat.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.articleTitle}>{subcat.title}</Text>
                        <ChevronRight size={20} color="#666" />
                      </TouchableOpacity>
                      {!isLast && <View style={styles.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ) : articles.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.glassCard}>
                {articles.map((article, index) => {
                  const isLast = index === articles.length - 1;
                  
                  return (
                    <React.Fragment key={article.id}>
                      <TouchableOpacity
                        style={styles.articleRow}
                        onPress={() => handleArticlePress(article.id)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.articleTitle}>{article.title}</Text>
                        <ChevronRight size={20} color="#666" />
                      </TouchableOpacity>
                      {!isLast && <View style={styles.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No articles available</Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  glassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
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
    fontSize: 17,
    fontWeight: '400' as const,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 16,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  bottomSpacer: {
    height: 40,
  },
});
