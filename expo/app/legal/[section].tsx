import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';

/**
 * Legal documents (terms, privacy policy, vendor agreement).
 *
 * Content is served by the backend's getPublicSiteContent and rendered here,
 * never hardcoded in the app — the same published document backs the website
 * and the app, so legal text can be corrected without shipping a new build,
 * and the two can never drift apart and contradict each other.
 *
 * One parameterised screen rather than one screen per document: they differ
 * only by which section is fetched.
 */

type SiteContentNode =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'bulletList'; items: string[] }
  | { type: 'orderedList'; items: string[] }
  | { type: 'link'; text: string; href: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string };

interface PublicSiteContentResponse {
  success: true;
  sections: Record<string, { content: { nodes: SiteContentNode[] }; version: number }>;
}

/** Route slug → backend section id, plus the title shown in the header. The
 * backend rejects unknown section ids, so this map is also the allowlist. */
const LEGAL_SECTIONS: Record<string, { sectionId: string; title: string }> = {
  terms: { sectionId: 'terms-of-service', title: 'Terms of Use' },
  privacy: { sectionId: 'privacy-policy', title: 'Privacy Policy' },
  'vendor-agreement': { sectionId: 'vendor-terms', title: 'Vendor Agreement' },
  'customer-terms': { sectionId: 'customer-terms', title: 'Customer Terms' },
};

export default function LegalDocumentScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const config = section ? LEGAL_SECTIONS[section] : undefined;

  const [nodes, setNodes] = useState<SiteContentNode[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!config) {
      setError('Unknown document.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const getContent = callable<Record<string, never>, PublicSiteContentResponse>('getPublicSiteContent');
      const res = await getContent({});
      const published = res.data.sections?.[config.sectionId];
      if (!published?.content?.nodes?.length) {
        // Distinguish "not published yet" from "request failed" — the vendor
        // should not be told to retry something that will not change.
        setNodes([]);
      } else {
        setNodes(published.content.nodes);
      }
    } catch (err) {
      console.error('[Legal] Failed to load document:', err);
      setError("Couldn't load this document.");
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} testID="legal-back">
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{config?.title ?? 'Legal'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.centered} testID="legal-loading">
            <ActivityIndicator size="small" color={Colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered} testID="legal-error">
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => void load()} testID="legal-retry">
              <RefreshCw size={15} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : nodes && nodes.length === 0 ? (
          <View style={styles.centered} testID="legal-empty">
            <Text style={styles.emptyTitle}>Not available yet</Text>
            <Text style={styles.emptyBody}>
              This document hasn&apos;t been published yet. It will appear here once it is.
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} testID="legal-content">
            {nodes?.map((node, i) => <LegalNode key={i} node={node} />)}
            <View style={styles.bottomPad} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

function LegalNode({ node }: { node: SiteContentNode }) {
  switch (node.type) {
    case 'heading':
      return (
        <Text style={[styles.heading, node.level === 1 ? styles.h1 : node.level === 2 ? styles.h2 : styles.h3]}>
          {node.text}
        </Text>
      );
    case 'paragraph':
      return <Text style={styles.paragraph}>{node.text}</Text>;
    case 'bulletList':
      return (
        <View style={styles.list}>
          {node.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.bullet}>{'•'}</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'orderedList':
      return (
        <View style={styles.list}>
          {node.items.map((item, i) => (
            <View key={i} style={styles.listRow}>
              <Text style={styles.bullet}>{i + 1}.</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>
      );
    case 'link':
      return (
        <Text style={styles.link} onPress={() => void Linking.openURL(node.href)}>
          {node.text}
        </Text>
      );
    case 'bold':
      return <Text style={[styles.paragraph, styles.bold]}>{node.text}</Text>;
    case 'italic':
      return <Text style={[styles.paragraph, styles.italic]}>{node.text}</Text>;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerTitle: { flex: 1, textAlign: 'center' as const, fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  headerSpacer: { width: 24 },
  centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 32, gap: 10 },
  errorText: { fontSize: 14.5, color: Colors.textSecondary, textAlign: 'center' as const },
  retryButton: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingVertical: 8, paddingHorizontal: 14 },
  retryText: { fontSize: 14.5, fontWeight: '600' as const, color: Colors.primary },
  emptyTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  emptyBody: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' as const, lineHeight: 20 },
  content: { paddingHorizontal: 20, paddingTop: 18 },
  heading: { color: Colors.text, fontWeight: '700' as const, marginTop: 18, marginBottom: 8 },
  h1: { fontSize: 21 },
  h2: { fontSize: 18 },
  h3: { fontSize: 16 },
  paragraph: { fontSize: 14.5, lineHeight: 22, color: Colors.textSecondary, marginBottom: 12 },
  bold: { fontWeight: '700' as const, color: Colors.text },
  italic: { fontStyle: 'italic' as const },
  list: { marginBottom: 12, gap: 6 },
  listRow: { flexDirection: 'row' as const, gap: 8, paddingRight: 8 },
  bullet: { fontSize: 14.5, lineHeight: 22, color: Colors.textSecondary, minWidth: 16 },
  listText: { flex: 1, fontSize: 14.5, lineHeight: 22, color: Colors.textSecondary },
  link: { fontSize: 14.5, lineHeight: 22, color: Colors.primary, fontWeight: '600' as const, marginBottom: 12 },
  bottomPad: { height: 40 },
});
