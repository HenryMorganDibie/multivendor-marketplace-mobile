import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleBackPress = () => {
    router.back();
  };

  const handleOpenPrivacyPolicy = () => {
    console.log('Opening Privacy Policy');
    Linking.openURL('https://example.com/privacy');
  };

  const handleOpenTerms = () => {
    console.log('Opening Terms of Use');
    Linking.openURL('https://example.com/terms');
  };

  const handleOpenBlockedUsers = () => {
    router.push('/settings/blocked-users' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy & Data</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionFirst}>
          <Text style={styles.sectionHeading}>Blocking</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleOpenBlockedUsers}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Blocked users</Text>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Your Data</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Platform collects minimal personal data.
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Payments are not processed by Platform.
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Contact cards are shared only when you choose.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Legal</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleOpenPrivacyPolicy}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Privacy Policy</Text>
              <ExternalLink size={18} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.linkRow}
              onPress={handleOpenTerms}
              activeOpacity={0.7}
            >
              <Text style={styles.linkLabel}>Terms of Use</Text>
              <ExternalLink size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
  },
  sectionFirst: {
    marginTop: 16,
  },
  section: {
    marginTop: 28,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minHeight: 52,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  linkLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  bottomSpacer: {
    height: 40,
  },
});
