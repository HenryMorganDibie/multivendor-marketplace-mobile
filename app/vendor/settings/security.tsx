import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';

export default function SecurityScreen() {
  const router = useRouter();
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [showAppLockModal, setShowAppLockModal] = useState(false);

  const handleChangePassword = () => {
    setShowChangePasswordModal(true);
  };

  const handleConfirmPasswordChange = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return;
    }
    if (newPassword !== confirmPassword) {
      console.log('Passwords do not match');
      return;
    }
    console.log('Password change request submitted');
    setShowChangePasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowSuccessModal(true);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Security',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
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
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Active Sessions</Text>
                <Text style={styles.rowSubtitle}>Devices currently signed into your account</Text>
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
              Password changes require email confirmation and a 24-hour security delay.
            </Text>

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
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  (!currentPassword || !newPassword || !confirmPassword) && styles.disabledButton,
                ]}
                onPress={handleConfirmPasswordChange}
                activeOpacity={0.7}
                disabled={!currentPassword || !newPassword || !confirmPassword}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    (!currentPassword || !newPassword || !confirmPassword) && styles.disabledButtonText,
                  ]}
                >
                  Confirm Password
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LaektivaModal
        visible={showSuccessModal}
        title="Password Change Requested"
        message="A confirmation email has been sent to your registered email address. Your password will be changed after confirmation and a 24-hour security delay. All sessions will be logged out."
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
              <Text style={styles.unlockOptionSubtext}>4–6 digit PIN</Text>
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
