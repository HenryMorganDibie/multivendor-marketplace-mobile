import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Copy, Share2 } from 'lucide-react-native';
import { safeShare } from '@/utils/share';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

export default function InviteVendorsScreen() {
  const router = useRouter();
  const { toastVisible, showToast } = useToast();
  const referralCode = 'VN7K2M9P';
  const successfulReferrals = 0;
  const rewardsEarned = '0 months credit';
  const remainingEligibility = '2 rewards remaining this year';

  const handleCopyCode = async () => {
    await Clipboard.setStringAsync(referralCode);
    showToast();
    console.log('Referral code copied:', referralCode);
  };

  const handleShareCode = async () => {
    await safeShare({
      message: `Join Platform as a vendor and grow your business! Use my referral code: ${referralCode}\n\nhttps://platform.app/vendor?ref=${referralCode}`,
    });
    console.log('Share sheet opened with referral code');
  };

  const handleShareLink = async () => {
    await safeShare({
      message: `Join Platform as a vendor and grow your business! Use my referral code: ${referralCode}\n\nhttps://platform.app/vendor?ref=${referralCode}`,
    });
    console.log('Share invite link opened');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Invite Vendors" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>Your Referral Program</Text>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Referral Code</Text>
            </View>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>{referralCode}</Text>
            </View>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleCopyCode}
                activeOpacity={0.7}
              >
                <Copy size={20} color={Colors.primary} />
                <Text style={styles.iconButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={handleShareCode}
                activeOpacity={0.7}
              >
                <Share2 size={20} color={Colors.primary} />
                <Text style={styles.iconButtonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Referral Stats</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Successful referrals this year</Text>
              <Text style={styles.statValue}>{successfulReferrals}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Rewards earned this year</Text>
              <Text style={styles.statValue}>{rewardsEarned}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Remaining eligibility</Text>
              <Text style={styles.statValue}>{remainingEligibility}</Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>How It Works</Text>
            </View>
            <Text style={styles.howItWorksText}>
              When a vendor you refer completes verification and becomes a paying subscriber, you receive a subscription credit.
            </Text>
            <Text style={styles.howItWorksText}>
              Maximum: 2 rewards per year.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleShareLink}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Share Invite Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCopyCode}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Copy Referral Code</Text>
          </TouchableOpacity>
        </ScrollView>
      <Toast visible={toastVisible} />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
  },
  codeContainer: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  codeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  iconButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    flex: 1,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  howItWorksText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.primary,
  },
});
