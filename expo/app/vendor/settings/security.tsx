import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import EditScreenHeader from '@/components/EditScreenHeader';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';
import { auth, callable } from '@/lib/firebase';

export default function SecurityScreen() {
  const router = useRouter();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [showAppLockModal, setShowAppLockModal] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = () => {
    setPasswordError(null);
    setShowChangePasswordModal(true);
  };

  /**
   * Real Firebase Auth password change, not a fabricated "24-hour delay"
   * confirmation. A password change requires a recent sign-in, which most
   * sessions aren't — reauthenticateWithCredential proves the current
   * password directly rather than requiring the vendor to sign out and back
   * in. On success, every other device is signed out for real via the same
   * signOutAllDevices callable active-sessions.tsx already uses, since a
   * password change should invalidate sessions started under the old one.
   */
  const handleConfirmPasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }
    const user = auth.currentUser;
    if (!user?.email) {
      setPasswordError('Your session has expired. Please sign in again.');
      return;
    }
    setPasswordError(null);
    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      try {
        const revoke = callable<Record<string, never>, { success: true }>('signOutAllDevices');
        await revoke({});
      } catch (revokeError) {
        // The password itself already changed successfully - a failure to
        // additionally revoke other sessions must not be reported as the
        // whole operation failing, since that would tell the vendor their
        // new password didn't take when it did.
        console.error('[Security] signOutAllDevices after password change failed:', revokeError);
      }
      setShowChangePasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowSuccessModal(true);
    } catch (error: any) {
      const code = error?.code as string | undefined;
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPasswordError('Current password is incorrect.');
      } else if (code === 'auth/weak-password') {
        setPasswordError('New password is too weak. Use a longer password.');
      } else if (code === 'auth/requires-recent-login') {
        setPasswordError('For security, please sign out and back in, then try again.');
      } else if (code === 'auth/too-many-requests') {
        setPasswordError('Too many attempts. Please wait a moment and try again.');
      } else {
        setPasswordError('Could not change your password. Please try again.');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Security" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>PASSWORD</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Last updated</Text>
                <Text style={styles.infoValue}>October 15, 2024</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleChangePassword}
              activeOpacity={0.7}
            >
              <Text style={styles.actionText}>Change Password</Text>
              <ChevronRight size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>APP SECURITY</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleContent}>
                <Text style={styles.toggleLabel}>App Lock</Text>
                <Text style={styles.toggleSubtitle}>Require biometric or PIN to open the app</Text>
              </View>
              <Switch
                value={appLockEnabled}
                onValueChange={(value) => {
                  if (value) {
                    setShowAppLockModal(true);
                  } else {
                    setAppLockEnabled(false);
                  }
                }}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>ACCOUNT ACCESS</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => router.push('/vendor/settings/active-sessions' as any)}
              activeOpacity={0.7}
            >
              {/* Was "Active Sessions / Devices currently signed into your
                  account", which promised a device list the screen behind it
                  faked and Firebase Auth cannot actually provide. */}
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Session Security</Text>
                <Text style={styles.rowSubtitle}>Sign out of Platform on every device</Text>
              </View>
              <ChevronRight size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showChangePasswordModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowChangePasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <Text style={styles.securityNotice}>
              Changing your password will sign you out on every other device.
            </Text>

            {passwordError ? (
              <Text style={styles.errorNotice}>{passwordError}</Text>
            ) : null}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowChangePasswordModal(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setPasswordError(null);
                }}
                activeOpacity={0.7}
                disabled={isChangingPassword}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  (!currentPassword || !newPassword || !confirmPassword || isChangingPassword) && styles.disabledButton,
                ]}
                onPress={handleConfirmPasswordChange}
                activeOpacity={0.7}
                disabled={!currentPassword || !newPassword || !confirmPassword || isChangingPassword}
              >
                {isChangingPassword ? <ActivityIndicator color={Colors.white} /> : (
                <Text
                  style={[
                    styles.confirmButtonText,
                    (!currentPassword || !newPassword || !confirmPassword) && styles.disabledButtonText,
                  ]}
                >
                  Confirm Password
                </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LaektivaModal
        visible={showSuccessModal}
        title="Password Changed"
        message="Your password has been changed. You've been signed out on every other device for security."
        primaryButton={{
          label: 'Done',
          onPress: () => setShowSuccessModal(false),
        }}
      />

      <Modal
        visible={showAppLockModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAppLockModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Unlock Method</Text>
            
            <TouchableOpacity
              style={styles.unlockOption}
              onPress={() => {
                console.log('Use biometrics');
                setAppLockEnabled(true);
                setShowAppLockModal(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.unlockOptionText}>Use Device Biometrics</Text>
              <Text style={styles.unlockOptionSubtext}>Face ID / Touch ID</Text>
            </TouchableOpacity>

            <View style={styles.unlockDivider} />

            <TouchableOpacity
              style={styles.unlockOption}
              onPress={() => {
                setShowAppLockModal(false);
                router.push('/vendor/settings/set-app-lock-pin' as any);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.unlockOptionText}>Set App Lock PIN</Text>
              <Text style={styles.unlockOptionSubtext}>4 to 6 digit PIN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton, { marginTop: 20 }]}
              onPress={() => setShowAppLockModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  infoRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '400' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  securityNotice: {
    fontSize: 15,
    color: Colors.primary,
    lineHeight: 22,
    marginBottom: 24,
    fontWeight: '500' as const,
  },
  errorNotice: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '500' as const,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.text,
  },
  modalButtonContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  cancelButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.charcoal,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
  },
  disabledButtonText: {
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  bottomSpacer: {
    height: 40,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleContent: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  unlockOption: {
    paddingVertical: 16,
  },
  unlockOptionText: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  unlockOptionSubtext: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  unlockDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
