import React, { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Camera, Lock, Info, Mail, Phone } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import LaektivaModal from '@/components/LaektivaModal';
import PhotoActionSheet from '@/components/PhotoActionSheet';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';

const FIRST_NAME_REGEX = /^[A-Za-z]{2,20}$/;
const LAST_INITIAL_REGEX = /^[A-Za-z]{1}$/;

function maskContact(value: string): string {
  if (!value) return 'Not set';
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    const visible = name.slice(0, 2);
    return `${visible}${'\u2022'.repeat(Math.max(name.length - 2, 1))}@${domain}`;
  }
  if (value.length < 6) return value;
  const last4 = value.slice(-4);
  return `${'\u2022'.repeat(value.length - 4)} ${last4}`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, updateUserProfile } = useAuth();

  const [firstName, setFirstName] = useState<string>('');
  const [lastInitial, setLastInitial] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPhotoSheet, setShowPhotoSheet] = useState<boolean>(false);
  const [showRemovePhotoModal, setShowRemovePhotoModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [firstNameError, setFirstNameError] = useState<string>('');
  const [lastInitialError, setLastInitialError] = useState<string>('');
  const [firstNameTouched, setFirstNameTouched] = useState<boolean>(false);
  const [lastInitialTouched, setLastInitialTouched] = useState<boolean>(false);
  const [firstNameFocused, setFirstNameFocused] = useState<boolean>(false);
  const [lastInitialFocused, setLastInitialFocused] = useState<boolean>(false);

  useEffect(() => {
    if (user?.firstName) setFirstName(user.firstName);
    if (user?.lastName) setLastInitial(user.lastName.charAt(0).toUpperCase());
  }, [user]);

  const validateFirstName = useCallback((value: string) => {
    if (!value.trim()) return 'First name is required.';
    if (!FIRST_NAME_REGEX.test(value.trim())) {
      if (value.trim().length < 2) return 'Minimum 2 characters.';
      if (value.trim().length > 20) return 'Maximum 20 characters.';
      return 'Letters only, no numbers or symbols.';
    }
    return '';
  }, []);

  const validateLastInitial = useCallback((value: string) => {
    if (!value.trim()) return 'Last initial is required.';
    if (!LAST_INITIAL_REGEX.test(value.trim())) return 'One letter only, no symbols.';
    return '';
  }, []);

  const handleFirstNameChange = useCallback((text: string) => {
    setFirstName(text);
    if (firstNameTouched) setFirstNameError(validateFirstName(text));
  }, [firstNameTouched, validateFirstName]);

  const handleLastInitialChange = useCallback((text: string) => {
    const letter = text.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
    setLastInitial(letter);
    if (lastInitialTouched) setLastInitialError(validateLastInitial(letter));
  }, [lastInitialTouched, validateLastInitial]);

  const handleFirstNameBlur = useCallback(() => {
    setFirstNameFocused(false);
    setFirstNameTouched(true);
    setFirstNameError(validateFirstName(firstName));
  }, [firstName, validateFirstName]);

  const handleLastInitialBlur = useCallback(() => {
    setLastInitialFocused(false);
    setLastInitialTouched(true);
    setLastInitialError(validateLastInitial(lastInitial));
  }, [lastInitial, validateLastInitial]);

  const displayNamePreview = firstName.trim()
    ? lastInitial ? `${firstName.trim()} ${lastInitial}.` : firstName.trim()
    : '';

  const isFormValid =
    FIRST_NAME_REGEX.test(firstName.trim()) &&
    LAST_INITIAL_REGEX.test(lastInitial.trim());

  const unsavedChanges = useUnsavedChanges({ firstName, lastInitial }, false);

  const handleBackPress = useCallback(() => {
    if (!unsavedChanges.handleExitAttempt()) return;
    router.back();
  }, [unsavedChanges, router]);

  const handleSave = useCallback(async () => {
    setFirstNameTouched(true);
    setLastInitialTouched(true);
    const fnError = validateFirstName(firstName);
    const liError = validateLastInitial(lastInitial);
    setFirstNameError(fnError);
    setLastInitialError(liError);
    if (fnError || liError) return;

    setIsSaving(true);
    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastInitial || undefined,
      });
      unsavedChanges.resetChanges();
      router.back();
    } catch (error) {
      console.error('Failed to update profile:', error);
    } finally {
      setIsSaving(false);
    }
  }, [firstName, lastInitial, validateFirstName, validateLastInitial, updateUserProfile, unsavedChanges, router]);

  const initials = (user?.firstName?.charAt(0) ?? '') + (user?.lastName?.charAt(0) ?? '');

  const identifier = user?.identifier ?? '';
  const isEmail = identifier.includes('@');
  const email = isEmail ? identifier : 'Not set';
  const phone = !isEmail && identifier ? maskContact(identifier) : 'Not set';

  const handleConfirmDelete = useCallback(() => {
    setShowDeleteModal(false);
    router.push('/settings/delete-account' as any);
  }, [router]);

  const handleRemovePhoto = useCallback(() => {
    setShowPhotoSheet(false);
    setShowRemovePhotoModal(true);
  }, []);

  const handleConfirmRemovePhoto = useCallback(() => {
    console.log('Photo removed');
    setShowRemovePhotoModal(false);
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton} testID="profile-back">
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ── */}
        <TouchableOpacity
          style={styles.avatarSection}
          onPress={() => setShowPhotoSheet(true)}
          activeOpacity={0.82}
          testID="profile-avatar"
        >
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || 'U'}</Text>
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={12} color={Colors.white} strokeWidth={2.5} />
            </View>
          </View>
          <Text style={styles.changePhotoLabel}>Change Photo</Text>
        </TouchableOpacity>

        {/* ── Form Fields ── */}
        <View style={styles.formSection}>
          {/* First Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              First Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                firstNameFocused && styles.inputFocused,
                firstNameError ? styles.inputError : null,
              ]}
              value={firstName}
              onChangeText={handleFirstNameChange}
              onFocus={() => setFirstNameFocused(true)}
              onBlur={handleFirstNameBlur}
              placeholder="Your first name"
              placeholderTextColor={Colors.inputPlaceholder}
              autoCapitalize="words"
              maxLength={20}
              testID="profile-first-name"
            />
            {firstNameError
              ? <Text style={styles.errorText}>{firstNameError}</Text>
              : <Text style={styles.helperText}>Letters only · 2–20 characters</Text>
            }
          </View>

          {/* Last Initial */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Last Initial <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                lastInitialFocused && styles.inputFocused,
                lastInitialError ? styles.inputError : null,
              ]}
              value={lastInitial}
              onChangeText={handleLastInitialChange}
              onFocus={() => setLastInitialFocused(true)}
              onBlur={handleLastInitialBlur}
              placeholder="e.g. D"
              placeholderTextColor={Colors.inputPlaceholder}
              autoCapitalize="characters"
              maxLength={1}
              testID="profile-last-initial"
            />
            {lastInitialError
              ? <Text style={styles.errorText}>{lastInitialError}</Text>
              : <Text style={styles.helperText}>One letter only</Text>
            }
          </View>

          {/* Display Name Preview */}
          {displayNamePreview ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Info size={13} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.previewHeaderLabel}>Display Name Preview</Text>
              </View>
              <View style={styles.previewRow}>
                <View style={styles.previewCol}>
                  <Text style={styles.previewColLabel}>You see</Text>
                  <Text style={styles.previewColValue}>{displayNamePreview}</Text>
                </View>
                <View style={styles.previewDivider} />
                <View style={styles.previewCol}>
                  <Text style={styles.previewColLabel}>Vendors see</Text>
                  <Text style={styles.previewColValue}>{displayNamePreview}</Text>
                </View>
              </View>
              <View style={styles.previewFooter}>
                <Text style={styles.previewFooterText}>
                  Your full last name is never shared with vendors
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Account Contact (read-only) ── */}
        <View style={styles.accountSection}>
          <Text style={styles.groupLabel}>ACCOUNT</Text>
          <View style={styles.accountCard}>
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Mail size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Email</Text>
                <Text style={[styles.contactValue, email === 'Not set' && styles.contactValueEmpty]}>
                  {email}
                </Text>
              </View>
              <Lock size={14} color={Colors.textMuted} strokeWidth={2} />
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.contactRow}>
              <View style={styles.contactIconWrap}>
                <Phone size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.contactTextWrap}>
                <Text style={styles.contactLabel}>Phone Number</Text>
                <Text style={[styles.contactValue, phone === 'Not set' && styles.contactValueEmpty]}>
                  {phone}
                </Text>
              </View>
              <Lock size={14} color={Colors.textMuted} strokeWidth={2} />
            </View>
          </View>
          <Text style={styles.accountHelper}>
            Your email and phone are tied to your login and protected. Contact support to update them.
          </Text>
        </View>

        {/* ── Password & Security ── */}
        <View style={styles.securitySection}>
          <TouchableOpacity
            style={styles.securityCard}
            onPress={() => router.push('/settings/password' as any)}
            activeOpacity={0.65}
            testID="profile-security-row"
          >
            <View style={styles.securityLeft}>
              <View style={styles.securityIconWrap}>
                <Lock size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.securityLabel}>Password & Security</Text>
                <Text style={styles.securitySub}>Change password · manage access</Text>
              </View>
            </View>
            <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* ── Save Button ── */}
        <View style={styles.saveSection}>
          <TouchableOpacity
            style={[styles.saveButton, (!isFormValid || isSaving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            activeOpacity={0.82}
            disabled={!isFormValid || isSaving}
            testID="profile-save"
          >
            <Text style={[styles.saveButtonText, (!isFormValid || isSaving) && styles.saveButtonTextDisabled]}>
              {isSaving ? 'Saving…' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Delete Account ── */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>DANGER ZONE</Text>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => setShowDeleteModal(true)}
            activeOpacity={0.8}
            testID="profile-delete-account"
          >
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
          <Text style={styles.dangerHint}>
            Permanently removes your account and data. You can restore within 90 days.
          </Text>
        </View>

      </ScrollView>

      {/* Photo Action Sheet */}
      <PhotoActionSheet
        visible={showPhotoSheet}
        onTakePhoto={() => { setShowPhotoSheet(false); console.log('Take photo'); }}
        onChoosePhoto={() => { setShowPhotoSheet(false); console.log('Choose photo'); }}
        onRemovePhoto={handleRemovePhoto}
        onCancel={() => setShowPhotoSheet(false)}
      />

      {/* Discard Changes Modal */}
      <LaektivaModal
        visible={unsavedChanges.showDiscardModal}
        title="Discard changes?"
        message="If you leave now, your unsaved changes will be lost."
        primaryButton={{
          label: 'Discard',
          onPress: () => { unsavedChanges.handleDiscard(); router.back(); },
        }}
        secondaryButton={{
          label: 'Keep editing',
          onPress: unsavedChanges.handleKeepEditing,
        }}
        destructive
      />

      {/* Remove Photo Confirmation */}
      <LaektivaModal
        visible={showRemovePhotoModal}
        title="Remove Photo"
        message="Your profile will show your initials instead. You can add a new photo anytime."
        primaryButton={{ label: 'Remove', onPress: handleConfirmRemovePhoto }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowRemovePhotoModal(false) }}
        destructive
      />

      {/* Delete Account Confirmation */}
      <LaektivaModal
        visible={showDeleteModal}
        title="Delete Account?"
        message="This will schedule your account for permanent deletion. You can undo this within 90 days by logging back in."
        primaryButton={{ label: 'Continue', onPress: handleConfirmDelete }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowDeleteModal(false) }}
        destructive
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.backgroundCanvas,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerButton: {
    padding: 10,
    width: 44,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 44,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  // Avatar
  avatarSection: {
    alignItems: 'center' as const,
    paddingTop: 16,
    paddingBottom: 28,
  },
  avatarRing: {
    position: 'relative' as const,
    marginBottom: 10,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: 'rgba(255,122,40,0.18)',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  cameraBadge: {
    position: 'absolute' as const,
    bottom: 1,
    right: 1,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2.5,
    borderColor: Colors.backgroundCanvas,
  },
  changePhotoLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
    letterSpacing: -0.1,
  },

  // Form
  formSection: {
    paddingHorizontal: 20,
  },
  fieldGroup: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 7,
    letterSpacing: 0.05,
  },
  required: {
    color: Colors.error,
    fontWeight: '400' as const,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: { elevation: 0 },
    }),
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 1.5,
    backgroundColor: Colors.white,
  },
  inputError: {
    borderColor: Colors.error,
    borderWidth: 1.5,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 5,
    paddingHorizontal: 2,
  },

  // Preview Card
  previewCard: {
    marginTop: 4,
    marginBottom: 6,
    backgroundColor: Colors.white,
    borderRadius: 14,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: 'rgba(255,122,40,0.14)',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 1 },
    }),
  },
  previewHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,122,40,0.10)',
  },
  previewHeaderLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    opacity: 0.85,
  },
  previewRow: {
    flexDirection: 'row' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  previewCol: {
    flex: 1,
    alignItems: 'center' as const,
  },
  previewColLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  previewColValue: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  previewDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
    marginVertical: 2,
  },
  previewFooter: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,122,40,0.08)',
    backgroundColor: Colors.primaryTint,
  },
  previewFooterText: {
    fontSize: 11.5,
    color: Colors.primary,
    textAlign: 'center' as const,
    opacity: 0.8,
    letterSpacing: -0.1,
  },

  // Account contact (read-only)
  accountSection: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.0,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  accountCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    paddingHorizontal: 14,
  },
  contactRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
    gap: 12,
  },
  contactIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  contactTextWrap: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  contactValueEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
    marginLeft: 46,
  },
  accountHelper: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginTop: 12,
    paddingHorizontal: 4,
  },

  // Security Card
  securitySection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  securityCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  securityLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  securityIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  securityLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    letterSpacing: -0.1,
    marginBottom: 1,
  },
  securitySub: {
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: -0.1,
  },

  // Save Button
  saveSection: {
    paddingHorizontal: 20,
    marginTop: 22,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.28,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  saveButtonDisabled: {
    backgroundColor: Colors.disabled,
    ...Platform.select({
      ios: { shadowOpacity: 0 },
      android: { elevation: 0 },
    }),
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    letterSpacing: -0.2,
  },
  saveButtonTextDisabled: {
    color: Colors.disabledText,
  },

  // Danger Zone
  dangerZone: {
    marginTop: 36,
    paddingTop: 22,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  dangerZoneTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.error,
    letterSpacing: 1.0,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  dangerButton: {
    backgroundColor: Colors.errorLight,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  dangerButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  dangerHint: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 4,
  },
});
