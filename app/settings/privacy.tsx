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
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ExternalLink, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PrivacyScreen() {
  const router = useRouter();

  const handleBackPress = () => {
    router.back();
  };

  const handleOpenPrivacyPolicy = () => {
    console.log('Opening Privacy Policy');
    Linking.openURL('https://the platform.com/privacy');
  };

  const handleOpenTerms = () => {
    console.log('Opening Terms of Service');
    Linking.openURL('https://the platform.com/terms');
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
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
              the platform collects minimal personal data.
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Payments are not processed by the platform.
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
              <Text style={styles.linkLabel}>Terms of Service</Text>
              <ExternalLink size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
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
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 32,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  linkLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
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
