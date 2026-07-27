import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Rocket, Package, CreditCard, MessageSquare, Shield, Store, ChevronRight, Search, X, Zap } from 'lucide-react-native';
import { helpCategories, helpArticles } from '@/mocks/helpData';

const iconMap = {
  Rocket,
  Package,
  CreditCard,
  MessageSquare,
  Shield,
  Store,
  Zap,
};

interface SearchResult {
  articleId: string;
  articleTitle: string;
  categoryTitle: string;
  preview: string;
}

export default function HelpCenterScreen() {
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handleCategoryPress = (categoryId: string) => {
    console.log('Navigate to category:', categoryId);
    router.push(`/vendor/settings/help-category/${categoryId}` as any);
  };

  const handleArticlePress = (articleId: string) => {
    router.push(`/vendor/settings/help-article/${articleId}` as any);
  };

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    helpArticles.forEach((article) => {
      const category = helpCategories.find(c => c.id === article.categoryId);
      const titleMatch = article.title.toLowerCase().includes(query);
      const contentMatch = article.content.toLowerCase().includes(query);

      if (titleMatch || contentMatch) {
        const contentLines = article.content.split('\n').filter(line => line.trim());
        let preview = '';

        if (titleMatch) {
          preview = contentLines.slice(0, 2).join(' ').substring(0, 120);
        } else {
          const matchingLine = contentLines.find(line => 
            line.toLowerCase().includes(query)
          );
          preview = matchingLine ? matchingLine.substring(0, 120) : contentLines[0]?.substring(0, 120) || '';
        }

        results.push({
          articleId: article.id,
          articleTitle: article.title,
          categoryTitle: category?.title || 'Help',
          preview: preview.trim() + (preview.length >= 120 ? '...' : ''),
        });
      }
    });

    return results;
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Help Center',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>How can we help you run your business?</Text>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search help articles"
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          {isSearching ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SEARCH RESULTS</Text>
              {searchResults.length > 0 ? (
                <View style={styles.glassCard}>
                  {searchResults.map((result, index) => {
                    const isLast = index === searchResults.length - 1;
                    return (
                      <React.Fragment key={result.articleId}>
                        <TouchableOpacity
                          style={styles.searchResultRow}
                          onPress={() => handleArticlePress(result.articleId)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.searchResultContent}>
                            <Text style={styles.searchResultTitle}>{result.articleTitle}</Text>
                            <Text style={styles.searchResultCategory}>{result.categoryTitle}</Text>
                            <Text style={styles.searchResultPreview} numberOfLines={2}>
                              {result.preview}
                            </Text>
                          </View>
                          <ChevronRight size={20} color="#666" style={styles.searchResultChevron} />
                        </TouchableOpacity>
                        {!isLast && <View style={styles.divider} />}
                      </React.Fragment>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptySearchContainer}>
                  <Text style={styles.emptySearchText}>No articles found</Text>
                  <Text style={styles.emptySearchSubtext}>Try different keywords</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>BROWSE BY TOPIC</Text>
              <View style={styles.glassCard}>
                {helpCategories.filter(c => !c.isSubcategory).map((category, index) => {
                  const IconComponent = iconMap[category.icon as keyof typeof iconMap];
                  const isLast = index === helpCategories.filter(c => !c.isSubcategory).length - 1;
                  
                  return (
                    <React.Fragment key={category.id}>
                      <TouchableOpacity
                        style={styles.categoryRow}
                        onPress={() => handleCategoryPress(category.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.categoryLeft}>
                          <View style={styles.iconContainer}>
                            {IconComponent && <IconComponent size={20} color="#0A84FF" />}
                          </View>
                          <Text style={styles.categoryTitle}>{category.title}</Text>
                        </View>
                        <ChevronRight size={20} color="#666" />
                      </TouchableOpacity>
                      {!isLast && <View style={styles.divider} />}
                    </React.Fragment>
                  );
                })}
              </View>
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
  header: {
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 20,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 2,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  categoryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  categoryLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 68,
  },
  searchResultRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  searchResultContent: {
    flex: 1,
    marginRight: 12,
  },
  searchResultTitle: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  searchResultCategory: {
    fontSize: 13,
    color: '#0A84FF',
    marginBottom: 6,
  },
  searchResultPreview: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  searchResultChevron: {
    flexShrink: 0,
  },
  emptySearchContainer: {
    alignItems: 'center' as const,
    paddingVertical: 60,
  },
  emptySearchText: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptySearchSubtext: {
    fontSize: 15,
    color: '#666',
  },
  bottomSpacer: {
    height: 40,
  },
});
