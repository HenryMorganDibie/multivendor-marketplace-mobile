import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { customerHelpArticles, customerHelpCategories } from '@/mocks/customerHelpData';
import HelpCenterHeader from '@/components/HelpCenterHeader';
import HelpArticleBody from '@/components/HelpArticleBody';
import { Colors } from '@/constants/colors';

export default function CustomerHelpArticleScreen() {
  const router = useRouter();
  const { articleId } = useLocalSearchParams<{ articleId: string }>();

  const article = customerHelpArticles.find((a) => a.id === articleId);
  const category = article
    ? customerHelpCategories.find((c) => c.id === article.categoryId)
    : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <HelpCenterHeader title="Help" onBack={() => router.back()} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        {article ? (
          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {category ? <Text style={styles.eyebrow}>{category.title}</Text> : null}
            <Text style={styles.title}>{article.title}</Text>
            <View style={styles.articleCard}>
              <HelpArticleBody content={article.content} />
            </View>
          </ScrollView>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Article not found</Text>
          </View>
        )}
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
    paddingBottom: 56,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 6,
    marginHorizontal: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 32,
    letterSpacing: -0.4,
    marginBottom: 20,
    marginHorizontal: 4,
  },
  articleCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textTertiary,
  },
});
