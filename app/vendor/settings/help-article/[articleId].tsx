import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { helpArticles } from '@/mocks/helpData';

export default function HelpArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  
  const article = helpArticles.find(a => a.id === articleId);

  if (!article) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Article Not Found',
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: '#0A0A0A' },
            headerTintColor: '#FFFFFF',
            headerShadowVisible: false,
          }}
        />
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Article not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const paragraphs = article.content.split('\n\n').filter(p => p.trim());

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Help Article',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.articleCard}>
            <Text style={styles.title}>{article.title}</Text>
            
            {paragraphs.map((paragraph, index) => {
              const isBulletList = paragraph.startsWith('•');
              
              if (isBulletList) {
                const items = paragraph.split('\n');
                return (
                  <View key={index} style={styles.bulletList}>
                    {items.map((item, itemIndex) => (
                      <View key={itemIndex} style={styles.bulletRow}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.bulletText}>
                          {item.replace('•', '').trim()}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              }
              
              return (
                <Text key={index} style={styles.paragraph}>
                  {paragraph}
                </Text>
              );
            })}

            {article.planInfo && (
              <View style={styles.planInfoContainer}>
                <Text style={styles.planInfoText}>Included in: {article.planInfo}</Text>
              </View>
            )}
          </View>

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
  articleCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    marginTop: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 20,
    lineHeight: 32,
  },
  paragraph: {
    fontSize: 16,
    color: '#B8B8B8',
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletList: {
    marginBottom: 16,
  },
  bulletRow: {
    flexDirection: 'row' as const,
    marginBottom: 8,
  },
  bullet: {
    fontSize: 16,
    color: '#0A84FF',
    marginRight: 8,
    marginTop: 2,
  },
  bulletText: {
    fontSize: 16,
    color: '#B8B8B8',
    lineHeight: 24,
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 17,
    color: '#8E8E93',
  },
  bottomSpacer: {
    height: 40,
  },
  planInfoContainer: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  planInfoText: {
    fontSize: 14,
    color: '#0A84FF',
    fontWeight: '500' as const,
  },
});
