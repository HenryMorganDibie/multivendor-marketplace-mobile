import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  Check,
  PencilLine,
  ShieldCheck,
  Landmark,
  MessageCircle,
  Ban,
  Banknote,
  Info,
  TriangleAlert,
  RefreshCw,
  Mail,
  Phone,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendor } from '@/contexts/VendorContext';
import { useCurrentPaymentInstructions } from '@/hooks/useCurrentPaymentInstructions';
import { Alert } from '@/utils/alert';
import {
  setVendorPaymentInstructions,
  generateIdempotencyKey,
} from '@/services/paymentInstructionsService';
import { maskPaymentIdentifier } from '@/utils/maskPaymentIdentifier';
import { getBanksForCountry } from '@/constants/paymentProviders';
import type { BusinessCountry } from '@/contexts/VendorPlanContext';
import type {
  RoutingCode,
  RoutingCodeType,
  BankAccountIdentifier,
  ContactIdentifier,
  PaymentDestinationInput,
  PaymentDestinationRecord,
} from '@/types/paymentInstructions';

// ─── Country-scoped routing conveniences (UX hints only, never authoritative) ──

/**
 * Only these five countries get a routing-field convenience; every other
 * resolved country (or an unresolved one) gets a plain generic account
 * number field with no routing array at all. This table is also the single
 * source of truth `buildRoutingArray` iterates -- it is the whitelist that
 * makes a hidden/inapplicable routing value structurally unable to reach
 * the payload (see buildRoutingArray below).
 */
const COUNTRY_ROUTING_FIELDS: Record<string, RoutingCodeType[]> = {
  CA: ['transit_number', 'institution_number'],
  US: ['routing_number'],
  GB: ['sort_code'],
  AU: ['bsb'],
  IN: ['ifsc'],
};

const ROUTING_FIELD_LABELS: Record<RoutingCodeType, string> = {
  transit_number: 'Transit Number',
  institution_number: 'Institution Number',
  routing_number: 'Routing Number (ABA)',
  sort_code: 'Sort Code',
  bsb: 'BSB',
  ifsc: 'IFSC Code',
  swift_bic: 'SWIFT/BIC',
};

/**
 * Local convenience for reusing paymentProviders.ts's existing
 * BusinessCountry-keyed bank lists without modifying that file. Only maps
 * the countries it already has suggestion data for -- every other ISO code
 * simply falls through to "no suggestions", which is a fully supported,
 * expected outcome (plain free-text institution input).
 */
const ISO_TO_BUSINESS_COUNTRY: Partial<Record<string, BusinessCountry>> = {
  NG: 'Nigeria',
  GH: 'Ghana',
  KE: 'Kenya',
  EG: 'Egypt',
  ZA: 'South Africa',
  MA: 'Morocco',
  TR: 'Turkey',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  US: 'United States',
};

function normalizeCountryCode(raw: string | undefined | null): string | undefined {
  const trimmed = raw?.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function getInstitutionSuggestions(resolvedCountryCode: string | undefined): string[] {
  if (!resolvedCountryCode) return [];
  const businessCountry = ISO_TO_BUSINESS_COUNTRY[resolvedCountryCode];
  if (!businessCountry) return [];
  return getBanksForCountry(businessCountry);
}

// ─── Form state ─────────────────────────────────────────────────────────────

type DestinationChoice = 'bank_transfer' | 'contact_transfer' | 'none';
type BankIdentifierChoice = 'account_number' | 'iban';
type ContactIdentifierChoice = 'email' | 'phone';

interface PaymentInstructionsFormState {
  acceptCash: boolean;
  destinationChoice: DestinationChoice;

  bankInstitutionName: string;
  bankRecipientName: string;
  bankIdentifierChoice: BankIdentifierChoice;
  bankAccountNumber: string;
  /**
   * May hold values for routing types that are not currently applicable to
   * the resolved country (e.g. hydrated from a previous save made under a
   * different resolved country, or simply preserved while the vendor
   * toggled Account Number/IBAN). Never read directly into a payload --
   * only buildRoutingArray may turn this into a routing array, and it only
   * ever copies out the types COUNTRY_ROUTING_FIELDS says are applicable.
   */
  bankRoutingValues: Partial<Record<RoutingCodeType, string>>;
  bankIban: string;
  bankSwiftBic: string;

  contactRecipientName: string;
  contactIdentifierChoice: ContactIdentifierChoice;
  contactEmail: string;
  contactPhone: string;
}

function emptyFormState(acceptCash: boolean): PaymentInstructionsFormState {
  return {
    acceptCash,
    destinationChoice: 'none',
    bankInstitutionName: '',
    bankRecipientName: '',
    bankIdentifierChoice: 'account_number',
    bankAccountNumber: '',
    bankRoutingValues: {},
    bankIban: '',
    bankSwiftBic: '',
    contactRecipientName: '',
    contactIdentifierChoice: 'email',
    contactEmail: '',
    contactPhone: '',
  };
}

/**
 * Hydrates edit state from the RAW stored/request values only. Never calls
 * maskPaymentIdentifier or any masking helper -- a masked string must never
 * be able to enter form state, since form state is exactly what
 * buildPaymentDestination reads to build the save payload.
 */
function buildInitialFormState(
  source: { acceptCash: boolean; paymentDestination: PaymentDestinationRecord | PaymentDestinationInput | null } | null
): PaymentInstructionsFormState {
  const base = emptyFormState(source?.acceptCash ?? false);
  const destination = source?.paymentDestination;
  if (!destination) return base;

  if (destination.type === 'bank_transfer') {
    const identifier = destination.identifier;
    if (identifier.type === 'account_number') {
      const routingValues: Partial<Record<RoutingCodeType, string>> = {};
      for (const code of identifier.routing ?? []) {
        routingValues[code.type] = code.value;
      }
      return {
        ...base,
        destinationChoice: 'bank_transfer',
        bankInstitutionName: destination.institutionName,
        bankRecipientName: destination.recipientName,
        bankIdentifierChoice: 'account_number',
        bankAccountNumber: identifier.value,
        bankRoutingValues: routingValues,
      };
    }
    return {
      ...base,
      destinationChoice: 'bank_transfer',
      bankInstitutionName: destination.institutionName,
      bankRecipientName: destination.recipientName,
      bankIdentifierChoice: 'iban',
      bankIban: identifier.value,
      bankSwiftBic: identifier.swiftBic ?? '',
    };
  }

  const identifier = destination.identifier;
  return {
    ...base,
    destinationChoice: 'contact_transfer',
    contactRecipientName: destination.recipientName,
    contactIdentifierChoice: identifier.type,
    contactEmail: identifier.type === 'email' ? identifier.value : '',
    contactPhone: identifier.type === 'phone' ? identifier.value : '',
  };
}

/**
 * The one place a routing array is constructed. Iterates ONLY the types
 * COUNTRY_ROUTING_FIELDS lists for resolvedCountryCode -- never the keys
 * present in routingValues -- so a value sitting in state for a hidden or
 * inapplicable field is structurally unreachable here, not merely filtered.
 */
function buildRoutingArray(
  resolvedCountryCode: string | undefined,
  routingValues: Partial<Record<RoutingCodeType, string>>
): RoutingCode[] | undefined {
  const applicableTypes = resolvedCountryCode ? COUNTRY_ROUTING_FIELDS[resolvedCountryCode] ?? [] : [];

  const entries: RoutingCode[] = applicableTypes.reduce<RoutingCode[]>((acc, type) => {
    const value = routingValues[type]?.trim();
    if (value) acc.push({ type, value });
    return acc;
  }, []);

  return entries.length > 0 ? entries : undefined;
}

function buildPaymentDestination(
  formState: PaymentInstructionsFormState,
  resolvedCountryCode: string | undefined
): PaymentDestinationInput | null {
  if (formState.destinationChoice === 'none') return null;

  if (formState.destinationChoice === 'bank_transfer') {
    let identifier: BankAccountIdentifier;
    if (formState.bankIdentifierChoice === 'account_number') {
      const value = formState.bankAccountNumber.trim();
      const routing = buildRoutingArray(resolvedCountryCode, formState.bankRoutingValues);
      identifier = routing ? { type: 'account_number', value, routing } : { type: 'account_number', value };
    } else {
      const value = formState.bankIban.trim();
      const swiftBic = formState.bankSwiftBic.trim();
      identifier = swiftBic ? { type: 'iban', value, swiftBic } : { type: 'iban', value };
    }
    return {
      type: 'bank_transfer',
      institutionName: formState.bankInstitutionName.trim(),
      recipientName: formState.bankRecipientName.trim(),
      identifier,
    };
  }

  const identifier: ContactIdentifier =
    formState.contactIdentifierChoice === 'email'
      ? { type: 'email', value: formState.contactEmail.trim() }
      : { type: 'phone', value: formState.contactPhone.trim() };

  return {
    type: 'contact_transfer',
    recipientName: formState.contactRecipientName.trim(),
    identifier,
  };
}

function computeCanonicalPayloadJson(acceptCash: boolean, paymentDestination: PaymentDestinationInput | null): string {
  return JSON.stringify({ acceptCash, paymentDestination });
}

// ─── Client-side validation (minimal; backend remains authoritative) ───────

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function isFormValid(formState: PaymentInstructionsFormState): boolean {
  switch (formState.destinationChoice) {
    case 'none':
      return formState.acceptCash;
    case 'bank_transfer':
      if (!isNonEmpty(formState.bankInstitutionName) || !isNonEmpty(formState.bankRecipientName)) return false;
      return formState.bankIdentifierChoice === 'account_number'
        ? isNonEmpty(formState.bankAccountNumber)
        : isNonEmpty(formState.bankIban);
    case 'contact_transfer':
      if (!isNonEmpty(formState.contactRecipientName)) return false;
      return formState.contactIdentifierChoice === 'email'
        ? EMAIL_PATTERN.test(formState.contactEmail.trim())
        : isNonEmpty(formState.contactPhone);
  }
}

// ─── Idempotency / outcome classification ──────────────────────────────────

/**
 * functions/unavailable and functions/deadline-exceeded, and any error with
 * no .code at all (thrown before any structured response -- e.g. the device
 * lost connectivity mid-request), leave the server's receipt of this
 * attempt unknown. Every other coded FunctionsError means the callable ran
 * and returned a structured rejection: the server definitely did not
 * commit this attempt.
 */
function classifyCallableFailure(err: unknown): 'ambiguous' | 'definitive-rejection' {
  const code = (err as { code?: unknown } | null)?.code;
  if (code === 'functions/unavailable' || code === 'functions/deadline-exceeded') return 'ambiguous';
  if (typeof code === 'string' && code.length > 0) return 'definitive-rejection';
  return 'ambiguous';
}

interface SaveErrorDisplay {
  title: string;
  message: string;
  isAmbiguous: boolean;
}

function describeSaveError(err: unknown, classification: 'ambiguous' | 'definitive-rejection'): SaveErrorDisplay {
  const code = (err as { code?: unknown } | null)?.code;
  const rawMessage = err instanceof Error ? err.message : undefined;

  if (classification === 'ambiguous') {
    return {
      title: "Couldn't confirm your save",
      message:
        "We couldn't reach the server, or it didn't respond in time. Your payment instructions may or may not have been saved. Try again -- retrying with the same information is safe.",
      isAmbiguous: true,
    };
  }

  switch (code) {
    case 'functions/invalid-argument':
      return { title: 'Check your information', message: rawMessage ?? 'Some of the information you entered is not valid.', isAmbiguous: false };
    case 'functions/failed-precondition':
      return { title: 'Cannot save yet', message: rawMessage ?? 'Complete your business setup before configuring payment instructions.', isAmbiguous: false };
    case 'functions/permission-denied':
    case 'functions/unauthenticated':
      return { title: 'Not authorized', message: 'You are not signed in as this vendor, or your session has expired. Please sign in again.', isAmbiguous: false };
    case 'functions/not-found':
      return { title: 'Vendor not found', message: rawMessage ?? 'Your vendor account could not be found.', isAmbiguous: false };
    default:
      return { title: 'Could not save', message: rawMessage ?? 'Something went wrong while saving your payment instructions.', isAmbiguous: false };
  }
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function PaymentInstructionsScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { data: currentInstructions, loading, error: loadError } = useCurrentPaymentInstructions(vendor.id);

  const [formState, setFormState] = useState<PaymentInstructionsFormState>(() => emptyFormState(false));
  const [isEditing, setIsEditing] = useState(false);
  const [hasInitializedDefault, setHasInitializedDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveErrorDisplay | null>(null);
  const [optimisticSuccess, setOptimisticSuccess] = useState<{
    acceptCash: boolean;
    paymentDestination: PaymentDestinationInput | null;
  } | null>(null);

  const idempotencyKeyRef = useRef<string | null>(null);
  const lastAttemptedPayloadJsonRef = useRef<string | null>(null);
  const pendingAmbiguousAttemptRef = useRef<boolean>(false);
  const isSavingRef = useRef<boolean>(false);
  const reconciliationTargetVersionRef = useRef<number | null>(null);

  const unsavedChanges = useUnsavedChanges(formState, currentInstructions === null && optimisticSuccess === null);

  // One-time hydration once the live listener's first snapshot has resolved.
  useEffect(() => {
    if (loading || hasInitializedDefault) return;
    const hydrated = buildInitialFormState(currentInstructions);
    setFormState(hydrated);
    unsavedChanges.setInitialValues(hydrated);
    setIsEditing(currentInstructions === null);
    setHasInitializedDefault(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentInstructions, hasInitializedDefault]);

  // Drop the optimistic success overlay only once the listener has reached
  // (or passed) the exact version the successful callable told us it wrote.
  // Tied to the server-confirmed target, not a client-observed baseline, so
  // an unrelated intermediate version from a concurrent writer can never
  // clear the overlay early -- see reconciliationTargetVersionRef.
  useEffect(() => {
    if (optimisticSuccess === null) return;
    if (reconciliationTargetVersionRef.current === null) return;
    if (currentInstructions === null) return;
    if (currentInstructions.currentVersion >= reconciliationTargetVersionRef.current) {
      setOptimisticSuccess(null);
      reconciliationTargetVersionRef.current = null;
    }
  }, [currentInstructions, optimisticSuccess]);

  const resolvedCountryCode = useMemo(
    () =>
      normalizeCountryCode(currentInstructions?.paymentDestination?.countryCode) ??
      normalizeCountryCode(vendor.countryCode),
    [currentInstructions?.paymentDestination, vendor.countryCode]
  );

  const applicableRoutingTypes = resolvedCountryCode ? COUNTRY_ROUTING_FIELDS[resolvedCountryCode] ?? [] : [];
  const institutionSuggestions = useMemo(() => getInstitutionSuggestions(resolvedCountryCode), [resolvedCountryCode]);

  const isConfigured = currentInstructions !== null || optimisticSuccess !== null;
  const effectiveAcceptCash = optimisticSuccess ? optimisticSuccess.acceptCash : currentInstructions?.acceptCash ?? false;
  const effectiveDestination = optimisticSuccess
    ? optimisticSuccess.paymentDestination
    : currentInstructions?.paymentDestination ?? null;

  const isSaveEnabled = isFormValid(formState) && !isSaving;

  function resolveIdempotencyKeyForAttempt(canonicalPayloadJson: string): string {
    const reuseExistingKey =
      pendingAmbiguousAttemptRef.current &&
      idempotencyKeyRef.current !== null &&
      lastAttemptedPayloadJsonRef.current === canonicalPayloadJson;

    const key = reuseExistingKey ? idempotencyKeyRef.current! : generateIdempotencyKey();
    idempotencyKeyRef.current = key;
    lastAttemptedPayloadJsonRef.current = canonicalPayloadJson;
    pendingAmbiguousAttemptRef.current = false;
    return key;
  }

  const handleBack = () => {
    if (isEditing) {
      if (unsavedChanges.handleExitAttempt()) router.back();
      return;
    }
    router.back();
  };

  const handleEdit = () => {
    const source = optimisticSuccess ?? currentInstructions;
    const hydrated = buildInitialFormState(source);
    setFormState(hydrated);
    unsavedChanges.setInitialValues(hydrated);
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!isSaveEnabled) return;
    if (isSavingRef.current) return;
    isSavingRef.current = true;

    try {
      const paymentDestination = buildPaymentDestination(formState, resolvedCountryCode);
      const canonicalPayloadJson = computeCanonicalPayloadJson(formState.acceptCash, paymentDestination);
      const idempotencyKey = resolveIdempotencyKeyForAttempt(canonicalPayloadJson);

      setIsSaving(true);
      setSaveError(null);
      try {
        const { data } = await setVendorPaymentInstructions({
          idempotencyKey,
          acceptCash: formState.acceptCash,
          paymentDestination,
        });

        idempotencyKeyRef.current = null;
        lastAttemptedPayloadJsonRef.current = null;
        pendingAmbiguousAttemptRef.current = false;

        if (data.changed) {
          setOptimisticSuccess({ acceptCash: formState.acceptCash, paymentDestination });
          reconciliationTargetVersionRef.current = data.version;
        }

        unsavedChanges.resetChanges();
        setIsEditing(false);
        Alert.alert(data.changed ? 'Payment instructions saved.' : 'Already up to date.');
      } catch (err) {
        const classification = classifyCallableFailure(err);
        if (classification === 'ambiguous') {
          pendingAmbiguousAttemptRef.current = true;
        } else {
          idempotencyKeyRef.current = null;
          lastAttemptedPayloadJsonRef.current = null;
          pendingAmbiguousAttemptRef.current = false;
        }
        setSaveError(describeSaveError(err, classification));
      } finally {
        setIsSaving(false);
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  const setBankRoutingValue = (type: RoutingCodeType, value: string) => {
    setFormState((prev) => ({ ...prev, bankRoutingValues: { ...prev.bankRoutingValues, [type]: value } }));
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
          isSaving={isSaving}
          showSave={isEditing}
        />
      </SafeAreaView>
      <KeyboardAvoidingView
        style={styles.safeArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
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
                  <Text style={styles.heroTitle}>{isConfigured ? 'Instructions are active' : 'Not configured'}</Text>
                </View>
                <View style={[styles.statusBadge, isConfigured ? styles.activeBadge : styles.inactiveBadge]}>
                  {isConfigured && <Check size={13} color={Colors.success} strokeWidth={2.5} />}
                  <Text style={[styles.statusBadgeText, isConfigured ? styles.activeBadgeText : styles.inactiveBadgeText]}>
                    {isConfigured ? 'Active' : 'Not Configured'}
                  </Text>
                </View>
              </View>
              <Text style={styles.helperText}>
                These instructions are shown to customers when you request payment.
              </Text>
            </View>

            {loading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading payment instructions…</Text>
              </View>
            )}

            {!loading && loadError && (
              <View style={styles.errorCard}>
                <TriangleAlert size={18} color={Colors.error} strokeWidth={2.1} />
                <Text style={styles.errorCardText}>{loadError.message}</Text>
              </View>
            )}

            {!loading && !isEditing && (
              <>
                <View style={styles.readOnlyCard}>
                  <Text style={styles.sectionLabel}>Current payment destination</Text>
                  <ReadOnlyDestination
                    destination={effectiveDestination}
                    acceptCash={effectiveAcceptCash}
                  />
                </View>

                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={handleEdit}
                  activeOpacity={0.72}
                  testID="edit-payment-instructions-button"
                >
                  <PencilLine size={16} color={Colors.text} strokeWidth={2.1} />
                  <Text style={styles.secondaryActionText}>Edit Payment Instructions</Text>
                </TouchableOpacity>
              </>
            )}

            {!loading && isEditing && (
              <>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Payment destination</Text>

                  <SelectorRow
                    icon={<Landmark size={18} color={formState.destinationChoice === 'bank_transfer' ? Colors.primary : Colors.textSecondary} strokeWidth={2} />}
                    label="Bank Transfer"
                    selected={formState.destinationChoice === 'bank_transfer'}
                    onPress={() => setFormState((prev) => ({ ...prev, destinationChoice: 'bank_transfer' }))}
                    testID="destination-bank-transfer"
                  />
                  <SelectorRow
                    icon={<MessageCircle size={18} color={formState.destinationChoice === 'contact_transfer' ? Colors.primary : Colors.textSecondary} strokeWidth={2} />}
                    label="Contact Transfer"
                    selected={formState.destinationChoice === 'contact_transfer'}
                    onPress={() => setFormState((prev) => ({ ...prev, destinationChoice: 'contact_transfer' }))}
                    testID="destination-contact-transfer"
                  />
                  <SelectorRow
                    icon={<Ban size={18} color={formState.destinationChoice === 'none' ? Colors.primary : Colors.textSecondary} strokeWidth={2} />}
                    label="No transfer method"
                    selected={formState.destinationChoice === 'none'}
                    onPress={() => setFormState((prev) => ({ ...prev, destinationChoice: 'none' }))}
                    testID="destination-none"
                    isLast
                  />
                </View>

                {formState.destinationChoice === 'bank_transfer' && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Institution name</Text>
                    <View style={styles.inputWrapperSingle}>
                      <TextInput
                        style={styles.textInputSingle}
                        placeholder="Bank or financial institution"
                        placeholderTextColor={Colors.inputPlaceholder}
                        value={formState.bankInstitutionName}
                        onChangeText={(text) => setFormState((prev) => ({ ...prev, bankInstitutionName: text }))}
                        testID="bank-institution-name-input"
                      />
                    </View>
                    {institutionSuggestions.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                        {institutionSuggestions.map((name) => (
                          <TouchableOpacity
                            key={name}
                            style={styles.suggestionChip}
                            onPress={() => setFormState((prev) => ({ ...prev, bankInstitutionName: name }))}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.suggestionChipText}>{name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                    <Text style={styles.hintText}>
                      Suggestions are a convenience only. You can always type any bank or financial institution.
                    </Text>

                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Recipient name</Text>
                    <View style={styles.inputWrapperSingle}>
                      <TextInput
                        style={styles.textInputSingle}
                        placeholder="Name on the account"
                        placeholderTextColor={Colors.inputPlaceholder}
                        value={formState.bankRecipientName}
                        onChangeText={(text) => setFormState((prev) => ({ ...prev, bankRecipientName: text }))}
                        testID="bank-recipient-name-input"
                      />
                    </View>

                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Identifier type</Text>
                    <View style={styles.segmentedRow}>
                      <SegmentButton
                        label="Account Number"
                        selected={formState.bankIdentifierChoice === 'account_number'}
                        onPress={() => setFormState((prev) => ({ ...prev, bankIdentifierChoice: 'account_number' }))}
                        testID="bank-identifier-account-number"
                      />
                      <SegmentButton
                        label="IBAN"
                        selected={formState.bankIdentifierChoice === 'iban'}
                        onPress={() => setFormState((prev) => ({ ...prev, bankIdentifierChoice: 'iban' }))}
                        testID="bank-identifier-iban"
                        isLast
                      />
                    </View>

                    {formState.bankIdentifierChoice === 'account_number' ? (
                      <>
                        <View style={styles.inputWrapperSingle}>
                          <TextInput
                            style={styles.textInputSingle}
                            placeholder="Account number"
                            placeholderTextColor={Colors.inputPlaceholder}
                            value={formState.bankAccountNumber}
                            onChangeText={(text) => setFormState((prev) => ({ ...prev, bankAccountNumber: text }))}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            testID="bank-account-number-input"
                          />
                        </View>
                        {applicableRoutingTypes.length > 0 && (
                          <>
                            <Text style={styles.hintText}>
                              Optional routing details for this destination:
                            </Text>
                            {applicableRoutingTypes.map((type) => (
                              <View key={type} style={styles.inputWrapperSingle}>
                                <TextInput
                                  style={styles.textInputSingle}
                                  placeholder={ROUTING_FIELD_LABELS[type]}
                                  placeholderTextColor={Colors.inputPlaceholder}
                                  value={formState.bankRoutingValues[type] ?? ''}
                                  onChangeText={(text) => setBankRoutingValue(type, text)}
                                  autoCapitalize="characters"
                                  autoCorrect={false}
                                  testID={`bank-routing-${type}-input`}
                                />
                              </View>
                            ))}
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={styles.inputWrapperSingle}>
                          <TextInput
                            style={styles.textInputSingle}
                            placeholder="IBAN"
                            placeholderTextColor={Colors.inputPlaceholder}
                            value={formState.bankIban}
                            onChangeText={(text) => setFormState((prev) => ({ ...prev, bankIban: text }))}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            testID="bank-iban-input"
                          />
                        </View>
                        <Text style={styles.hintText}>Optional -- SWIFT/BIC (international wire routing):</Text>
                        <View style={styles.inputWrapperSingle}>
                          <TextInput
                            style={styles.textInputSingle}
                            placeholder="SWIFT/BIC"
                            placeholderTextColor={Colors.inputPlaceholder}
                            value={formState.bankSwiftBic}
                            onChangeText={(text) => setFormState((prev) => ({ ...prev, bankSwiftBic: text }))}
                            autoCapitalize="characters"
                            autoCorrect={false}
                            testID="bank-swift-bic-input"
                          />
                        </View>
                      </>
                    )}
                  </View>
                )}

                {formState.destinationChoice === 'contact_transfer' && (
                  <View style={styles.fieldBlock}>
                    <Text style={styles.fieldLabel}>Recipient name</Text>
                    <View style={styles.inputWrapperSingle}>
                      <TextInput
                        style={styles.textInputSingle}
                        placeholder="Name of the recipient"
                        placeholderTextColor={Colors.inputPlaceholder}
                        value={formState.contactRecipientName}
                        onChangeText={(text) => setFormState((prev) => ({ ...prev, contactRecipientName: text }))}
                        testID="contact-recipient-name-input"
                      />
                    </View>

                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Identifier type</Text>
                    <View style={styles.segmentedRow}>
                      <SegmentButton
                        label="Email"
                        selected={formState.contactIdentifierChoice === 'email'}
                        onPress={() => setFormState((prev) => ({ ...prev, contactIdentifierChoice: 'email' }))}
                        testID="contact-identifier-email"
                      />
                      <SegmentButton
                        label="Phone"
                        selected={formState.contactIdentifierChoice === 'phone'}
                        onPress={() => setFormState((prev) => ({ ...prev, contactIdentifierChoice: 'phone' }))}
                        testID="contact-identifier-phone"
                        isLast
                      />
                    </View>

                    {formState.contactIdentifierChoice === 'email' ? (
                      <View style={styles.inputWrapperSingle}>
                        <Mail size={16} color={Colors.textTertiary} strokeWidth={2} style={styles.inputIcon} />
                        <TextInput
                          style={[styles.textInputSingle, styles.textInputWithIcon]}
                          placeholder="Email address"
                          placeholderTextColor={Colors.inputPlaceholder}
                          value={formState.contactEmail}
                          onChangeText={(text) => setFormState((prev) => ({ ...prev, contactEmail: text }))}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          testID="contact-email-input"
                        />
                      </View>
                    ) : (
                      <>
                        <View style={styles.inputWrapperSingle}>
                          <Phone size={16} color={Colors.textTertiary} strokeWidth={2} style={styles.inputIcon} />
                          <TextInput
                            style={[styles.textInputSingle, styles.textInputWithIcon]}
                            placeholder="Phone number, e.g. national format or +…"
                            placeholderTextColor={Colors.inputPlaceholder}
                            value={formState.contactPhone}
                            onChangeText={(text) => setFormState((prev) => ({ ...prev, contactPhone: text }))}
                            keyboardType="default"
                            autoCorrect={false}
                            testID="contact-phone-input"
                          />
                        </View>
                        <Text style={styles.hintText}>
                          Enter it in national format (using your business's own country) or with a leading + and
                          country code. Platform does not verify ownership of this number.
                        </Text>
                      </>
                    )}
                  </View>
                )}

                <View style={styles.cashRow}>
                  <View style={styles.cashRowLeft}>
                    <Banknote size={18} color={Colors.textSecondary} strokeWidth={2} />
                    <View style={styles.cashRowCopy}>
                      <Text style={styles.cashRowTitle}>Accept Cash</Text>
                      <Text style={styles.cashRowSubtitle}>Let customers pay you in cash.</Text>
                    </View>
                  </View>
                  <Switch
                    value={formState.acceptCash}
                    onValueChange={(value) => setFormState((prev) => ({ ...prev, acceptCash: value }))}
                    trackColor={{ false: Colors.border, true: Colors.primarySoft }}
                    thumbColor={formState.acceptCash ? Colors.primary : Colors.white}
                    testID="accept-cash-switch"
                  />
                </View>

                {formState.destinationChoice === 'none' && !formState.acceptCash && (
                  <View style={styles.warningCard}>
                    <Info size={16} color={Colors.warning} strokeWidth={2.1} />
                    <Text style={styles.warningText}>
                      Choose a transfer method or turn on Accept Cash -- at least one way to be paid is required.
                    </Text>
                  </View>
                )}

                {saveError && (
                  <View style={saveError.isAmbiguous ? styles.ambiguousCard : styles.errorCard}>
                    <TriangleAlert
                      size={18}
                      color={saveError.isAmbiguous ? Colors.warning : Colors.error}
                      strokeWidth={2.1}
                    />
                    <View style={styles.errorCardCopy}>
                      <Text style={styles.errorCardTitle}>{saveError.title}</Text>
                      <Text style={styles.errorCardText}>{saveError.message}</Text>
                      {saveError.isAmbiguous && (
                        <TouchableOpacity
                          style={styles.retryButton}
                          onPress={handleSave}
                          activeOpacity={0.75}
                          disabled={isSaving}
                          testID="retry-save-button"
                        >
                          <RefreshCw size={14} color={Colors.text} strokeWidth={2.2} />
                          <Text style={styles.retryButtonText}>{isSaving ? 'Retrying…' : 'Try Again'}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </>
            )}

            <Text style={styles.footerNote}>
              Platform does not process payments, hold escrow, or verify payment ownership.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

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

// ─── Small presentational helpers ──────────────────────────────────────────

function SelectorRow({
  icon,
  label,
  selected,
  onPress,
  testID,
  isLast,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.selectorRow, selected && styles.selectorRowSelected, !isLast && styles.selectorRowSpaced]}
      onPress={onPress}
      activeOpacity={0.75}
      testID={testID}
    >
      {icon}
      <Text style={[styles.selectorRowLabel, selected && styles.selectorRowLabelSelected]}>{label}</Text>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </TouchableOpacity>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
  testID,
  isLast,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  isLast?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, selected && styles.segmentButtonSelected, !isLast && styles.segmentButtonSpaced]}
      onPress={onPress}
      activeOpacity={0.75}
      testID={testID}
    >
      <Text style={[styles.segmentButtonText, selected && styles.segmentButtonTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ReadOnlyDestination({
  destination,
  acceptCash,
}: {
  destination: PaymentDestinationRecord | PaymentDestinationInput | null;
  acceptCash: boolean;
}) {
  return (
    <View>
      {destination === null && !acceptCash && <Text style={styles.instructionsText}>Not configured yet.</Text>}

      {destination?.type === 'bank_transfer' && (
        <View style={styles.destinationRow}>
          <Landmark size={18} color={Colors.textSecondary} strokeWidth={2} />
          <View style={styles.destinationCopy}>
            <Text style={styles.destinationTitle}>Bank Transfer</Text>
            <Text style={styles.destinationMeta}>{destination.institutionName}</Text>
            <Text style={styles.destinationMeta}>{destination.recipientName}</Text>
            <Text style={styles.destinationMasked}>{maskPaymentIdentifier(destination.identifier)}</Text>
            {destination.identifier.type === 'account_number' &&
              (destination.identifier.routing ?? []).map((code) => (
                <Text key={code.type} style={styles.destinationRouting}>
                  {ROUTING_FIELD_LABELS[code.type]}: {code.value}
                </Text>
              ))}
            {destination.identifier.type === 'iban' && destination.identifier.swiftBic && (
              <Text style={styles.destinationRouting}>SWIFT/BIC: {destination.identifier.swiftBic}</Text>
            )}
          </View>
        </View>
      )}

      {destination?.type === 'contact_transfer' && (
        <View style={styles.destinationRow}>
          <MessageCircle size={18} color={Colors.textSecondary} strokeWidth={2} />
          <View style={styles.destinationCopy}>
            <Text style={styles.destinationTitle}>Contact Transfer</Text>
            <Text style={styles.destinationMeta}>{destination.recipientName}</Text>
            <Text style={styles.destinationMasked}>{maskPaymentIdentifier(destination.identifier)}</Text>
          </View>
        </View>
      )}

      {destination === null && acceptCash && (
        <View style={styles.destinationRow}>
          <Ban size={18} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={styles.destinationMeta}>No transfer method configured.</Text>
        </View>
      )}

      <View style={styles.cashStatusRow}>
        <Banknote size={16} color={acceptCash ? Colors.success : Colors.textTertiary} strokeWidth={2} />
        <Text style={acceptCash ? styles.cashStatusOn : styles.cashStatusOff}>
          {acceptCash ? 'Cash accepted' : 'Cash not accepted'}
        </Text>
      </View>
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
  loadingCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    padding: 16,
    marginBottom: 14,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
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
  destinationRow: {
    flexDirection: 'row' as const,
    gap: 12,
    marginBottom: 10,
  },
  destinationCopy: {
    flex: 1,
    minWidth: 0,
  },
  destinationTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  destinationMeta: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  destinationMasked: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 4,
  },
  destinationRouting: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  cashStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cashStatusOn: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  cashStatusOff: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textTertiary,
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
    marginBottom: 16,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 9,
  },
  fieldLabelSpaced: {
    marginTop: 14,
  },
  selectorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  selectorRowSpaced: {
    marginBottom: 10,
  },
  selectorRowSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  selectorRowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  selectorRowLabelSelected: {
    color: Colors.text,
  },
  radioOuter: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  segmentedRow: {
    flexDirection: 'row' as const,
    marginBottom: 10,
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  segmentButtonSpaced: {
    marginRight: 8,
  },
  segmentButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryTint,
  },
  segmentButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  segmentButtonTextSelected: {
    color: Colors.text,
  },
  inputWrapperSingle: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: Colors.surfaceElevated,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInputSingle: {
    flex: 1,
    fontSize: 15,
    color: Colors.inputText,
    paddingVertical: 13,
  },
  textInputWithIcon: {
    paddingLeft: 0,
  },
  chipRow: {
    marginBottom: 8,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  hintText: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 17,
    marginBottom: 8,
  },
  cashRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    marginBottom: 14,
  },
  cashRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  cashRowCopy: {
    flex: 1,
    minWidth: 0,
  },
  cashRowTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cashRowSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginBottom: 14,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  errorCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    marginBottom: 14,
  },
  ambiguousCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    marginBottom: 14,
  },
  errorCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  errorCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  errorCardText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  retryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 10,
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  retryButtonText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  footerNote: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginTop: 2,
  },
});
