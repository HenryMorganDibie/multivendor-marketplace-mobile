import React, { useCallback, useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { mapPasswordChangeError } from '@/lib/auth/authErrors';
import { checkPassword } from '@/constants/passwordPolicy';
import PasswordRequirements from '@/components/PasswordRequirements';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import CustomerHeader from '@/components/CustomerHeader';

export default function PasswordScreen() {
  const router = useRouter();
  const { toastVisible, showToast } = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordCheck = checkPassword(newPassword);

  const handleBackPress = () => {
    router.back();
  };

  const validate = useCallback((): boolean => {
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setFormError('');

    let valid = true;

    if (!currentPassword) {
      setCurrentPasswordError('Enter your current password.');
      valid = false;
    }
    if (!newPassword) {
      setNewPasswordError('Enter a new password.');
      valid = false;
    } else if (!checkPassword(newPassword).valid) {
      setNewPasswordError('Password does not meet the requirements below.');
      valid = false;
    } else if (currentPassword && newPassword === currentPassword) {
      setNewPasswordError('New password must be different from your current password.');
      valid = false;
    }
    if (!confirmPassword) {
      setConfirmPasswordError('Confirm your new password.');
      valid = false;
    } else if (newPassword && confirmPassword !== newPassword) {
      setConfirmPasswordError('Passwords do not match.');
      valid = false;
    }

    return valid;
  }, [currentPassword, newPassword, confirmPassword]);

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;
    if (!validate()) return;

    const user = auth.currentUser;
    if (!user?.email) {
      setFormError('Your session has expired. Please log out and back in.');
      return;
    }

    setIsSubmitting(true);

    // Firebase requires a fresh sign-in before it will accept a password
    // change, so the current password is checked by using it to
    // re-authenticate rather than by a separate, made-up verification step.
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    try {
      await reauthenticateWithCredential(user, credential);
    } catch (reauthError) {
      const mapped = mapPasswordChangeError(reauthError);
      if (mapped.field === 'password') {
        setCurrentPasswordError(mapped.message);
      } else {
        setFormError(mapped.message);
      }
      setIsSubmitting(false);
      return;
    }

    try {
      await updatePassword(user, newPassword);
    } catch (updateError) {
      const mapped = mapPasswordChangeError(updateError);
      if (mapped.field === 'password') {
        setNewPasswordError(mapped.message);
      } else {
        setFormError(mapped.message);
      }
      setIsSubmitting(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast();
    setTimeout(() => router.back(), 1100);
  }, [isSubmitting, validate, currentPassword, newPassword, router, showToast]);

  const canSubmit = !isSubmitting && !!currentPassword && !!newPassword && !!confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <CustomerHeader
        title="Password & Security"
        onBack={handleBackPress}
        backDisabled={isSubmitting}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {formError ? (
          <View style={styles.formErrorBox} testID="password-form-error">
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        ) : null}

        <View style={styles.inputSection}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, styles.inputWithIcon, currentPasswordError ? styles.inputError : null]}
              value={currentPassword}
              onChangeText={(text) => {
                setCurrentPassword(text);
                if (currentPasswordError) setCurrentPasswordError('');
                if (formError) setFormError('');
              }}
              placeholder="Enter current password"
              placeholderTextColor={Colors.textSecondary}
              secureTextEntry={!showPasswords}
              autoCapitalize="none"
              editable={!isSubmitting}
              testID="current-password-input"
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPasswords((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel={showPasswords ? 'Hide passwords' : 'Show passwords'}
            >
              {showPasswords ? (
                <EyeOff size={20} color={Colors.textSecondary} strokeWidth={2} />
              ) : (
                <Eye size={20} color={Colors.textSecondary} strokeWidth={2} />
              )}
            </TouchableOpacity>
          </View>
          {currentPasswordError ? <Text style={styles.errorText}>{currentPasswordError}</Text> : null}
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={[styles.input, newPasswordError ? styles.inputError : null]}
            value={newPassword}
            onChangeText={(text) => {
              setNewPassword(text);
              if (newPasswordError) setNewPasswordError('');
              if (formError) setFormError('');
            }}
            placeholder="Enter new password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            editable={!isSubmitting}
            testID="new-password-input"
          />
          {newPasswordError ? <Text style={styles.errorText}>{newPasswordError}</Text> : null}
          <PasswordRequirements requirements={passwordCheck.requirements} />
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={[styles.input, confirmPasswordError ? styles.inputError : null]}
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (confirmPasswordError) setConfirmPasswordError('');
              if (formError) setFormError('');
            }}
            placeholder="Confirm new password"
            placeholderTextColor={Colors.textSecondary}
            secureTextEntry={!showPasswords}
            autoCapitalize="none"
            editable={!isSubmitting}
            testID="confirm-password-input"
          />
          {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
        </View>

        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Your new password takes effect immediately. Other devices you&apos;re signed in on stay signed in until they sign out or their session expires on its own.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, !canSubmit && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={!canSubmit}
          testID="password-save-button"
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>Change Password</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Toast visible={toastVisible} message="Password changed" />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputRow: {
    position: 'relative' as const,
    justifyContent: 'center' as const,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: Colors.text,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputWithIcon: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute' as const,
    right: 12,
    height: '100%',
    justifyContent: 'center' as const,
  },
  inputError: {
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  formErrorBox: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  formErrorText: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  warningBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
