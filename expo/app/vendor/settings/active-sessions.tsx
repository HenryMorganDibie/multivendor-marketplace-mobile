import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ShieldCheck, LogOut, Info } from 'lucide-react-native';
import LaektivaModal from '@/components/LaektivaModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';

/**
 * Session security.
 *
 * This screen used to list three hardcoded devices — an "iPhone 14 Pro" and a
 * "Samsung Galaxy S23" in Toronto and Montreal — for every vendor, and its
 * log-out buttons only removed the row from local state. Nothing was revoked.
 * A vendor who saw a device they did not recognise could tap "Log out", watch
 * it disappear, and believe they had secured their account while that session
 * stayed live. A security screen that lies is worse than no security screen.
 *
 * Firebase Auth has no per-device session list, and there is no session
 * registry of our own to build one from, so the device list is not something
 * that can be shown honestly today — it is real, separate work. Revoking every
 * session at once is supported, and it is the action that actually matters
 * when a vendor thinks their account is compromised or has left themselves
 * signed in somewhere they no longer control. That is what this screen does
 * now, and it says exactly what it will do.
 */
export default function ActiveSessionsScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);

  const handleConfirmSignOutEverywhere = async () => {
    setShowConfirm(false);
    setIsRevoking(true);
    try {
      const revoke = callable<Record<string, never>, { success: true }>('signOutAllDevices');
      await revoke({});
      // Every refresh token is now invalid, this device's included, so the
      // only coherent next step is back to the sign-in screen.
      await logout();
    } catch (error) {
      const raw = error instanceof Error ? error.message : '';
      Alert.alert(
        'Could not sign out everywhere',
        !raw || raw === 'internal'
          ? 'Could not reach Platform just now. Check your connection and try again.'
          : raw,
      );
      setIsRevoking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Session Security" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <ShieldCheck size={26} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.heroTitle}>Signed in as</Text>
            <Text style={styles.heroEmail}>{user?.identifier || user?.email || '—'}</Text>
          </View>

          <View style={styles.noticeCard}>
            <Info size={16} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={styles.noticeText}>
              Platform can&apos;t yet show a list of the individual devices you&apos;re signed in on.
              What you can do is end every session at once — useful if you&apos;ve used a shared or
              public computer, or think someone else has your password.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.dangerButton, isRevoking && styles.dangerButtonDisabled]}
            onPress={() => setShowConfirm(true)}
            activeOpacity={0.8}
            disabled={isRevoking}
            testID="sign-out-everywhere"
          >
            {isRevoking ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <LogOut size={17} color="#FFFFFF" strokeWidth={2} />
                <Text style={styles.dangerButtonText}>Sign out on all devices</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.footnote}>
            This signs you out everywhere, including here. You&apos;ll need to log in again on each
            device you still use. Changing your password is worth doing too if you think someone
            else knows it.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={showConfirm}
        title="Sign out on all devices?"
        message="Every device signed in to this account will be logged out, including this one. You'll need to log in again."
        primaryButton={{ label: 'Sign out everywhere', onPress: handleConfirmSignOutEverywhere }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowConfirm(false) }}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  hero: { alignItems: 'center' as const, marginTop: 24, marginBottom: 24 },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  heroTitle: { fontSize: 13, color: Colors.textMuted, marginBottom: 4 },
  heroEmail: { fontSize: 16.5, fontWeight: '600' as const, color: Colors.text },
  noticeCard: {
    flexDirection: 'row' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 24,
  },
  noticeText: { flex: 1, fontSize: 13.5, lineHeight: 19.5, color: Colors.textSecondary },
  dangerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
  },
  dangerButtonDisabled: { opacity: 0.6 },
  dangerButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  footnote: { fontSize: 12.5, lineHeight: 18, color: Colors.textMuted, marginTop: 14 },
  bottomSpacer: { height: 60 },
});
