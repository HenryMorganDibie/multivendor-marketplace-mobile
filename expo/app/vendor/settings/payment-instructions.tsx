import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Check, PencilLine, Power, ShieldCheck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendor } from '@/contexts/VendorContext';

const MAX_CHARS = 200;
const SYSTEM_USER_ID = 'mock-vendor-admin';

type PaymentInstructionStatus = 'not_configured' | 'active';

function formatDateTime(value?: string): string {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function PaymentInstructionsScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();

  const hasSavedInstructions = Boolean(
    vendor.paymentInstructionsEnabled &&
      vendor.ownershipConfirmed &&
      vendor.paymentInstructions?.trim()
  );
  const initialInstructions = vendor.paymentInstructions ?? '';
  const initialOwnershipConfirmed = Boolean(vendor.ownershipConfirmed);

  const [instructions, setInstructions] = useState<string>(initialInstructions);
  const [error, setError] = useState<string>('');
  const [attestationChecked, setAttestationChecked] = useState<boolean>(initialOwnershipConfirmed);
  const [isEditing, setIsEditing] = useState<boolean>(!hasSavedInstructions);

  const paymentStatus: PaymentInstructionStatus = hasSavedInstructions ? 'active' : 'not_configured';
  const shouldShowSetupForm = paymentStatus === 'not_configured' || isEditing;
  const shouldShowOwnershipCheckbox = shouldShowSetupForm && !initialOwnershipConfirmed;
  const trimmedInstructions = instructions.trim();

  const unsavedChanges = useUnsavedChanges(
    {
      instructions,
      attestationChecked,
    },
    false
  );

  const lastUpdatedLabel = useMemo(
    () => formatDateTime(vendor.paymentInstructionsUpdatedAt),
    [vendor.paymentInstructionsUpdatedAt]
  );

  const confirmedAtLabel = useMemo(
    () => formatDateTime(vendor.ownershipConfirmedAt),
    [vendor.ownershipConfirmedAt]
  );

  const validateInstructions = (text: string): boolean => {
    const urlPattern =
      /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|app|co))/gi;
    if (urlPattern.test(text)) {
      setError('Links are not allowed in payment instructions.');
      return false;
    }
    setError('');
    return true;
  };

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setInstructions(text);
      if (text.trim().length > 0) {
        validateInstructions(text);
      } else {
        setError('');
      }
    }
  };

  const hasRequiredOwnershipConfirmation = initialOwnershipConfirmed || attestationChecked;
  const isSaveEnabled =
    shouldShowSetupForm &&
    trimmedInstructions.length > 0 &&
    hasRequiredOwnershipConfirmation &&
    error.length === 0;

  const handleBack = () => {
    if (shouldShowSetupForm && unsavedChanges.handleExitAttempt()) {
      router.back();
    }
    if (!shouldShowSetupForm) {
      router.back();
    }
  };

  const handleSave = () => {
    if (!isSaveEnabled) return;
    if (!validateInstructions(instructions)) return;

    const timestamp = new Date().toISOString();
    const ownershipConfirmedAt = initialOwnershipConfirmed
      ? vendor.ownershipConfirmedAt
      : timestamp;
    const ownershipConfirmedBy = initialOwnershipConfirmed
      ? vendor.ownershipConfirmedBy
      : vendor.id ?? SYSTEM_USER_ID;

    updateVendor({
      paymentInstructions: trimmedInstructions,
      paymentInstructionsEnabled: true,
      ownershipConfirmed: true,
      ownershipConfirmedAt,
      ownershipConfirmedBy,
      paymentInstructionsUpdatedAt: timestamp,
      paymentInstructionsUpdatedBy: vendor.id ?? SYSTEM_USER_ID,
    });

    console.log('Payment instructions saved:', {
      paymentInstructionsEnabled: true,
      ownershipConfirmed: true,
      ownershipConfirmedAt,
      paymentInstructionsUpdatedAt: timestamp,
      vendorId: vendor.id,
    });
    router.back();
  };

  const handleEdit = () => {
    setInstructions(vendor.paymentInstructions ?? '');
    setAttestationChecked(Boolean(vendor.ownershipConfirmed));
    setError('');
    setIsEditing(true);
  };

  const handleDisable = () => {
    const timestamp = new Date().toISOString();
    updateVendor({
      paymentInstructionsEnabled: false,
      paymentInstructionsUpdatedAt: timestamp,
      paymentInstructionsUpdatedBy: vendor.id ?? SYSTEM_USER_ID,
    });
    setIsEditing(true);
    console.log('Payment instructions disabled:', {
      paymentInstructionsEnabled: false,
      paymentInstructionsUpdatedAt: timestamp,
      vendorId: vendor.id,
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Payment Instructions"
          onBack={handleBack}
          onSave={handleSave}
          saveEnabled={isSaveEnabled}
          showSave={shouldShowSetupForm}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroTitleBlock}>
                <Text style={styles.eyebrow}>Payment instruction status</Text>
                <Text style={styles.heroTitle}>
                  {paymentStatus === 'active' ? 'Instructions are active' : 'Not configured'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  paymentStatus === 'active' ? styles.activeBadge : styles.inactiveBadge,
                ]}
              >
                {paymentStatus === 'active' && (
                  <Check size={13} color={Colors.success} strokeWidth={2.5} />
                )}
                <Text
                  style={[
                    styles.statusBadgeText,
                    paymentStatus === 'active'
                      ? styles.activeBadgeText
                      : styles.inactiveBadgeText,
                  ]}
                >
                  {paymentStatus === 'active' ? 'Active' : 'Not Configured'}
                </Text>
              </View>
            </View>
            <Text style={styles.helperText}>
              These instructions are shown to customers when you request payment.
            </Text>
            {paymentStatus === 'active' && (
              <Text style={styles.lastUpdatedText}>Last updated {lastUpdatedLabel}</Text>
            )}
          </View>

          {paymentStatus === 'active' && !isEditing && (
            <>
              <View style={styles.readOnlyCard}>
                <Text style={styles.sectionLabel}>Current payment instructions</Text>
                <Text style={styles.instructionsText}>{vendor.paymentInstructions}</Text>
              </View>

              <View style={styles.confirmationCard}>
                <View style={styles.confirmationIcon}>
                  <ShieldCheck size={19} color={Colors.success} strokeWidth={2.2} />
                </View>
                <View style={styles.confirmationCopy}>
                  <Text style={styles.confirmationTitle}>Payment Ownership</Text>
                  <Text style={styles.confirmationStatus}>Confirmed</Text>
                  <Text style={styles.confirmationMeta}>Confirmed on {confirmedAtLabel}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={handleEdit}
                  activeOpacity={0.72}
                  testID="edit-payment-instructions-button"
                >
                  <PencilLine size={16} color={Colors.text} strokeWidth={2.1} />
                  <Text style={styles.secondaryActionText}>Edit Instructions</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.disableActionButton}
                  onPress={handleDisable}
                  activeOpacity={0.72}
                  testID="disable-payment-instructions-button"
                >
                  <Power size={16} color={Colors.destructive} strokeWidth={2.1} />
                  <Text style={styles.disableActionText}>Disable Instructions</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {shouldShowSetupForm && (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Default Payment Instructions</Text>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Example: Please include your order ID as the transfer narration."
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={instructions}
                  onChangeText={handleTextChange}
                  multiline
                  textAlignVertical="top"
                  maxLength={MAX_CHARS}
                  testID="payment-instructions-input"
                />
                <Text style={styles.charCounter}>
                  {instructions.length} / {MAX_CHARS}
                </Text>
              </View>

              {error.length > 0 && <Text style={styles.errorText}>{error}</Text>}
            </View>
          )}

          {shouldShowOwnershipCheckbox && (
            <TouchableOpacity
              style={styles.attestationRow}
              onPress={() => setAttestationChecked(!attestationChecked)}
              activeOpacity={0.7}
              testID="attestation-checkbox"
            >
              <View
                style={[
                  styles.checkbox,
                  attestationChecked && styles.checkboxChecked,
                ]}
              >
                {attestationChecked && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.attestationText}>
                I confirm that this payment information belongs to me or my
                business and that I am responsible for payment collection.
              </Text>
            </TouchableOpacity>
          )}

          {shouldShowSetupForm && initialOwnershipConfirmed && (
            <View style={styles.inlineConfirmedCard}>
              <ShieldCheck size={17} color={Colors.success} strokeWidth={2.2} />
              <View style={styles.inlineConfirmedCopy}>
                <Text style={styles.inlineConfirmedTitle}>Payment ownership confirmed</Text>
                <Text style={styles.inlineConfirmedMeta}>Confirmed on {confirmedAtLabel}</Text>
              </View>
            </View>
          )}

          <Text style={styles.footerNote}>
            the platform does not process payments, hold escrow, or verify payment ownership.
          </Text>
        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
      />
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    shadowColor: Colors.black,
    shadowOpacity: 0.035,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 1,
  },
  heroTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  heroTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.55,
    marginBottom: 5,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 23,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
  },
  inactiveBadge: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  activeBadgeText: {
    color: Colors.success,
  },
  inactiveBadgeText: {
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 315,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginTop: 10,
    fontWeight: '500' as const,
  },
  readOnlyCard: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  instructionsText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    fontWeight: '500' as const,
  },
  confirmationCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  confirmationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.successLight,
    flexShrink: 0,
  },
  confirmationCopy: {
    flex: 1,
    minWidth: 0,
  },
  confirmationTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  confirmationStatus: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.success,
    marginBottom: 2,
  },
  confirmationMeta: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 17,
  },
  actionRow: {
    gap: 10,
    marginBottom: 16,
  },
  secondaryActionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  disableActionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  disableActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.destructive,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    overflow: 'hidden' as const,
  },
  textInput: {
    fontSize: 15,
    color: Colors.inputText,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
    minHeight: 104,
    maxHeight: 170,
    lineHeight: 21,
  },
  charCounter: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
    marginTop: 7,
  },
  attestationRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 12,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  attestationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
    fontWeight: '500' as const,
  },
  inlineConfirmedCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 13,
    borderRadius: 16,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    marginBottom: 14,
  },
  inlineConfirmedCopy: {
    flex: 1,
    minWidth: 0,
  },
  inlineConfirmedTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 1,
  },
  inlineConfirmedMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  footerNote: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
  },
});
