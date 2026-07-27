import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Rocket, Package, CreditCard, MessageSquare, Shield, Store, ChevronRight, Search, X, Zap } from 'lucide-react-native';
import { helpCategories, helpArticles } from '@/mocks/helpData';
import HelpCenterHeader from '@/components/HelpCenterHeader';
import { Colors } from '@/constants/colors';

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
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <HelpCenterHeader title="Help Center" onBack={() => router.back()} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.subtitle}>How can we help you run your business?</Text>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search help articles"
              placeholderTextColor={Colors.inputPlaceholder}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={Colors.textTertiary} />
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
                          <ChevronRight size={20} color={Colors.textMuted} style={styles.searchResultChevron} />
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
                            {IconComponent && <IconComponent size={20} color={Colors.primary} />}
                          </View>
                          <Text style={styles.categoryTitle}>{category.title}</Text>
                        </View>
                        <ChevronRight size={20} color={Colors.textMuted} />
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
    paddingHorizontal: 16,
  },
  header: {
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 4,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
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
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  searchResultCategory: {
    fontSize: 13,
    color: Colors.primary,
    marginBottom: 6,
  },
  searchResultPreview: {
    fontSize: 14,
    color: Colors.textTertiary,
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
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  emptySearchSubtext: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  bottomSpacer: {
    height: 40,
  },
});
