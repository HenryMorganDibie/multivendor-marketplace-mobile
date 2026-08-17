import React, { useState, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp } from '@/lib/auth/verifyOtp';
import { EMAIL_OTP_REGISTRATION_REQUIRED } from '@/constants/devAuth';
import {
  Image,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MapPin, UserCircle, TicketCheck, Eye, EyeOff, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { openLegalDocument } from '@/constants/legalLinks';
import LocationCascadeFields from '@/components/LocationCascadeFields';
import type { LocationValue } from '@/components/LocationCascadeFields';
import { useLocationCatalogue } from '@/hooks/useLocationCatalogue';
import { checkPassword, PASSWORD_POLICY_SUMMARY } from '@/constants/passwordPolicy';
import PasswordRequirements from '@/components/PasswordRequirements';
import { callable } from '@/lib/firebase';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return /^[+]?[\d\s()-]{7,}$/.test(value.trim());
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local;
  return `${maskedLocal}@${domain}`;
}

/** Matches the key verify-otp.tsx reads from once the code is confirmed. */
const PENDING_VENDOR_REG_KEY = '@the platform_pending_vendor_reg';

type FieldErrors = Record<string, string | undefined>;

type AcquisitionSource = 'field_sales' | 'vendor_referral' | 'organic';

type ReferralValidationStatus = 'idle' | 'pending' | 'valid' | 'invalid';

interface ReferralValidationResult {
  valid: boolean;
  repId?: string;
  repName?: string;
  assignedCountry?: string;
  assignedState?: string;
  assignedArea?: string;
  status?: 'active' | 'inactive';
  acquisitionSource?: Exclude<AcquisitionSource, 'organic'>;
}

interface ReferralValidationState extends Omit<ReferralValidationResult, 'status'> {
  validationStatus: ReferralValidationStatus;
  referralStatus?: 'active' | 'inactive';
  error?: string;
}

function normalizeReferralCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
}

function isReferralCodeFormatValid(value: string): boolean {
  return /^[A-Z0-9](?:[A-Z0-9-]{1,18}[A-Z0-9])$/.test(value) && !value.includes('--');
}

/**
 * Referral codes are captured at signup, not verified against a registry.
 *
 * This used to check a four-entry hardcoded table after a fake 650ms delay,
 * so the only codes that ever "validated" were THE PLATFORM-LAGOS, FIELD-LAGOS,
 * VN7K2M9P and VENDOR-LAGOS — each with an invented rep name and a Lagos
 * address — while every real code a field rep handed a vendor was rejected
 * as "Invalid or inactive referral code" and the signup lost the
 * attribution entirely.
 *
 * There is deliberately nothing to verify against: the rewarded referral
 * programme is deferred to post-MVP, and completeRegistration stores
 * `referral.code` as free text precisely so attribution can be resolved
 * later rather than lost at signup (see its comment there). Format is
 * therefore the only genuine check, and any well-formed code is accepted
 * and captured. Rep identity/territory is left unset rather than guessed —
 * the backend drops those fields today, and inventing them here is what
 * made the old behaviour wrong in the first place.
 */
async function validateReferralCode(code: string): Promise<ReferralValidationResult> {
  return isReferralCodeFormatValid(code)
    ? { valid: true, status: 'active' }
    : { valid: false, status: 'inactive' };
}

export default function VendorSignupScreen() {
  const router = useRouter();
  const { checkAccountExists, registerAccount } = useAuth();

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [location, setLocation] = useState<LocationValue | null>(null);

  /**
   * The dial code for the country the vendor picked, for the phone example.
   * listCountries returns it per country and nothing was reading it, so the
   * field showed +234 to everyone.
   */
  const { countries } = useLocationCatalogue();
  const phonePlaceholder = useMemo(() => {
    if (!location?.countryCode) return null;
    const match = countries.items.find((c: any) => c.code === location.countryCode);
    return match?.dialCode ?? null;
  }, [countries.items, location?.countryCode]);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralValidation, setReferralValidation] = useState<ReferralValidationState>({
    valid: false,
    validationStatus: 'idle',
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Failures no single input is responsible for — network, rate limit, outage. */
  const [formError, setFormError] = useState<string>('');

  // Phase 1: the only fields required to create an account. Everything else
  // (business name, category, description, state/area) is collected later
  // through the dashboard onboarding checklist.
  const isFormComplete =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 1 &&
    isEmail(email) &&
    isPhone(phone) &&
    checkPassword(password).valid &&
    confirmPassword === password &&
    !!location?.countryCode;

  const clearError = (key: string) => {
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
  };

  const runReferralValidation = async (code: string): Promise<ReferralValidationResult | null> => {
    const normalizedCode = normalizeReferralCode(code);
    if (!normalizedCode) {
      setReferralValidation({ valid: false, validationStatus: 'idle' });
      clearError('referralCode');
      return null;
    }

    if (!isReferralCodeFormatValid(normalizedCode)) {
      const error = 'Use 3 to 20 letters or numbers. Hyphen is allowed.';
      setReferralValidation({ valid: false, validationStatus: 'invalid', error });
      setErrors(p => ({ ...p, referralCode: error }));
      return { valid: false, status: 'inactive' };
    }

    setReferralValidation({ valid: false, validationStatus: 'pending' });
    const result = await validateReferralCode(normalizedCode);

    if (!result.valid || result.status !== 'active') {
      const error = 'Invalid or inactive referral code';
      setReferralValidation({
        ...result,
        valid: false,
        validationStatus: 'invalid',
        referralStatus: result.status,
        error,
      });
      setErrors(p => ({ ...p, referralCode: error }));
      return result;
    }

    setReferralValidation({
      ...result,
      valid: true,
      validationStatus: 'valid',
      referralStatus: result.status,
    });
    setErrors(p => ({ ...p, referralCode: undefined }));
    return result;
  };

  const handleReferralChange = (value: string) => {
    const normalizedCode = normalizeReferralCode(value);
    setReferralCode(normalizedCode);
    if (!normalizedCode) {
      setReferralValidation({ valid: false, validationStatus: 'idle' });
      clearError('referralCode');
      return;
    }

    if (!isReferralCodeFormatValid(normalizedCode)) {
      setReferralValidation({
        valid: false,
        validationStatus: 'invalid',
        error: 'Use 3 to 20 letters or numbers. Hyphen is allowed.',
      });
      clearError('referralCode');
      return;
    }

    setReferralValidation({ valid: false, validationStatus: 'idle' });
    clearError('referralCode');
  };

  // Measured y offset of each field, recorded on layout. Order matters: it is
  // the order the fields appear, so "first invalid" means first on screen
  // rather than first in whatever order validation happened to run.
  const scrollRef = useRef<ScrollView>(null);
  const fieldOffsets = useRef<Record<string, number>>({});
  const FIELD_ORDER = ['firstName', 'lastName', 'email', 'phone', 'password', 'country', 'referralCode'] as const;

  const emailRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const fieldRefs: Record<string, React.RefObject<TextInput | null>> = {
    email: emailRef,
    phone: phoneRef,
    password: passwordRef,
  };

  const scrollToFirstError = (errs: FieldErrors) => {
    const target = FIELD_ORDER.find((k) => errs[k]);
    if (!target) return;
    const y = fieldOffsets.current[target];
    if (typeof y !== 'number') return;
    // A little headroom so the label is visible, not just the input.
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 24), animated: true });
    fieldRefs[target]?.current?.focus();
  };

  /**
   * Put the server's answer on the field it is actually about.
   *
   * Every failure used to be written to `errors.email`, so "password is too
   * weak" and "we could not reach the platform" both appeared under the email
   * address — which is how the screenshot ended up showing a red line under an
   * email that was perfectly fine. AuthContext already reports which field is
   * at fault, read from the Firebase error code; this routes it there and
   * keeps anything form-wide in its own banner.
   */
  const showRegistrationFailure = (message: string, field?: string) => {
    if (field && field !== 'form') {
      setFormError('');
      setErrors({ [field]: message });
      scrollToFirstError({ [field]: message });
      return;
    }
    setErrors({});
    setFormError(message);
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  /**
   * Validated when the person leaves the field rather than only on submit, so
   * a malformed address is caught while they are still looking at it.
   */
  const validateOnBlur = (key: 'email' | 'phone') => {
    setFocusedField('');
    if (key === 'email') {
      const trimmed = email.trim();
      // Empty means "not filled in yet", which is not an error to report.
      if (trimmed && !isEmail(trimmed)) setErrors(p => ({ ...p, email: 'Enter a valid email address.' }));
      return;
    }
    const trimmedPhone = phone.trim();
    if (trimmedPhone && !isPhone(trimmedPhone)) {
      setErrors(p => ({ ...p, phone: 'Enter a valid phone number for the country you selected.' }));
    }
  };

  const handleSubmit = async () => {
    setFormError('');
    const newErrors: FieldErrors = {};
    if (firstName.trim().length < 2) newErrors.firstName = 'Enter your first name';
    if (lastName.trim().length < 1) newErrors.lastName = 'Enter your last name';
    if (!isEmail(email)) newErrors.email = 'Enter a valid email address.';
    if (!isPhone(phone)) newErrors.phone = 'Enter a valid phone number for the country you selected.';
    const pw = checkPassword(password);
    if (!pw.valid) newErrors.password = pw.error ?? 'Please choose a stronger password';
    // Phase 1 progressive onboarding: business name, category, description and
    // the state/area cascade are deliberately NOT required here. They're
    // collected from the dashboard checklist afterwards, and publication is
    // gated on them instead. Country stays, because it drives currency, plan
    // pricing and availability from the moment the account exists.
    if (confirmPassword !== password) newErrors.confirmPassword = 'Passwords do not match';
    if (!location?.countryCode) newErrors.country = 'Select your country';

    const normalizedReferralCode = normalizeReferralCode(referralCode);
    if (normalizedReferralCode && !isReferralCodeFormatValid(normalizedReferralCode)) {
      newErrors.referralCode = 'Use 3 to 20 letters or numbers. Hyphen is allowed.';
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) {
      scrollToFirstError(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      /**
       * A final server-side check before submitting.
       *
       * The cascade above can only ever offer a combination the catalogue
       * actually contains, but "can only ever offer" assumes the catalogue
       * has not changed since it loaded and the picker was not bypassed —
       * validateLocationSelection has been deployed since the catalogue
       * itself and nothing called it. Catching a stale selection here means
       * a clear, specific inline error instead of registration failing
       * opaquely inside completeRegistration, which runs this same check
       * server-side regardless.
       */
      const validateLocation = callable<
        { countryCode: string; stateId?: string; areaId?: string },
        { success: true; valid: boolean; reason?: string }
      >('validateLocationSelection');
      const locationCheck = await validateLocation({
        countryCode: location!.countryCode,
        stateId: location?.stateCode || undefined,
        areaId: location?.areaId || undefined,
      });
      if (!locationCheck.data.valid) {
        setErrors((p) => ({ ...p, country: locationCheck.data.reason || 'That location is no longer available. Please pick again.' }));
        setIsLoading(false);
        return;
      }

      const trimmedEmail = email.trim();
      const validatedReferral = normalizedReferralCode
        ? await runReferralValidation(normalizedReferralCode)
        : null;

      if (normalizedReferralCode && (!validatedReferral?.valid || validatedReferral.status !== 'active')) {
        setIsLoading(false);
        return;
      }

      const check = await checkAccountExists(trimmedEmail);
      if (check.exists) {
        showRegistrationFailure(
          'An account with this email already exists. Log in or reset your password.',
          'email',
        );
        setIsLoading(false);
        return;
      }

      /**
       * Email is verified before the account exists, not after.
       *
       * The full registerAccount payload is built now, while every async
       * check above (referral validation, location validation, account
       * existence) has already run — verify-otp only needs to replay it
       * once the code is confirmed, not recompute any of this.
       */
      const pendingPayload = {
        identifier: trimmedEmail,
        password,
        role: 'vendor' as const,
        plan: 'basic' as const,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        location: location!,
        referralCode: normalizedReferralCode || undefined,
        // Whether a code was entered is the only part of this we actually
        // know. 'field_sales' vs 'vendor_referral' can't be told apart
        // without the rep registry that the deferred referral programme
        // would provide, so the fallback is a placeholder, not a finding —
        // completeRegistration stores only referral.code and drops this.
        acquisitionSource: (validatedReferral?.valid
          ? (validatedReferral.acquisitionSource ?? 'field_sales')
          : 'organic') as 'field_sales' | 'vendor_referral' | 'organic',
        signupChannel: 'mobile_vendor_app' as const,
        country: location!.countryName,
        state: location?.stateName,
        area: location?.areaName,
        createdAt: new Date().toISOString(),
        referralRepId: validatedReferral?.repId,
        referralRepName: validatedReferral?.repName,
        referralAssignedCountry: validatedReferral?.assignedCountry,
        referralAssignedState: validatedReferral?.assignedState,
        referralAssignedArea: validatedReferral?.assignedArea,
        referralStatus: validatedReferral?.status,
        isDiscoverable: false,
      };

      if (!EMAIL_OTP_REGISTRATION_REQUIRED) {
        console.log('[AUTH FLOW] Email OTP disabled, registering vendor directly:', trimmedEmail);
        const response = await registerAccount(pendingPayload);
        if (!response.success) {
          showRegistrationFailure(response.error || 'Registration failed');
          setIsLoading(false);
          return;
        }
        router.replace('/vendor/(tabs)/dashboard' as any);
        return;
      }

      await AsyncStorage.setItem(PENDING_VENDOR_REG_KEY, JSON.stringify(pendingPayload));
      console.log('[AUTH FLOW] Sending OTP for vendor registration:', trimmedEmail);
      await sendOtp(trimmedEmail);

      router.push({
        pathname: '/verify-otp',
        params: {
          contact: trimmedEmail,
          maskedContact: maskEmail(trimmedEmail),
          context: 'vendor-registration',
        },
      });
    } catch (err) {
      console.error('[AUTH FLOW] Vendor registration error:', err);
      showRegistrationFailure('Something went wrong on our side. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Image
                source={require('@/assets/images/the platform-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="the platform"
              />
              <Text style={styles.title}>Create your vendor account</Text>
              <Text style={styles.subtitle}>Start selling on the platform in minutes</Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <UserCircle size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Owner Information</Text>
            </View>

            <View
              style={styles.row}
              onLayout={(e) => {
                fieldOffsets.current.firstName = e.nativeEvent.layout.y;
                fieldOffsets.current.lastName = e.nativeEvent.layout.y;
              }}
            >
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={[styles.input, focusedField === 'firstName' && styles.inputFocused, errors.firstName ? styles.inputError : null]}
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); clearError('firstName'); }}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Jane"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  editable={!isLoading}
                  testID="vendor-firstname"
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={[styles.input, focusedField === 'lastName' && styles.inputFocused, errors.lastName ? styles.inputError : null]}
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); clearError('lastName'); }}
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Doe"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  editable={!isLoading}
                  testID="vendor-lastname"
                />
                {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
              </View>
            </View>

            <View style={styles.inputSection} onLayout={(e) => { fieldOffsets.current.email = e.nativeEvent.layout.y; }}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                ref={emailRef}
                style={[styles.input, focusedField === 'email' && styles.inputFocused, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={(t) => { setEmail(t); clearError('email'); setFormError(''); }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => validateOnBlur('email')}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isLoading}
                testID="vendor-email"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputSection} onLayout={(e) => { fieldOffsets.current.phone = e.nativeEvent.layout.y; }}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                ref={phoneRef}
                style={[styles.input, focusedField === 'phone' && styles.inputFocused, errors.phone ? styles.inputError : null]}
                value={phone}
                onChangeText={(t) => { setPhone(t); clearError('phone'); setFormError(''); }}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => validateOnBlur('phone')}
                /**
                 * Follows the country the vendor picked.
                 *
                 * This was hardcoded to +234, so someone registering from
                 * Canada was shown a Nigerian example — on a platform that
                 * seeds 196 countries and gates availability per country, a
                 * fixed dial code reads as "this is not really for you".
                 *
                 * listCountries already returns dialCode per country; nothing
                 * was reading it. The generic example is only used before a
                 * country is chosen.
                 */
                placeholder={
                  phonePlaceholder ? `${phonePlaceholder} 800 000 0000` : 'Phone number'
                }
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                editable={!isLoading}
                testID="vendor-phone"
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
            </View>

            <View style={styles.inputSection} onLayout={(e) => { fieldOffsets.current.password = e.nativeEvent.layout.y; }}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.passwordInput, focusedField === 'password' && styles.inputFocused, errors.password ? styles.inputError : null]}
                  value={password}
                  onChangeText={(t) => { setPassword(t); clearError('password'); setFormError(''); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField('')}
                  placeholder={PASSWORD_POLICY_SUMMARY}
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                  testID="vendor-password"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(v => !v)}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  testID="vendor-password-toggle"
                >
                  {showPassword
                    ? <EyeOff size={20} color="#9CA3AF" strokeWidth={2} />
                    : <Eye size={20} color="#9CA3AF" strokeWidth={2} />}
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              <PasswordRequirements requirements={checkPassword(password).requirements} />
            </View>

            {/* Confirming the password matters more here than on a login form:
                this is the only time it is set, there is no "was that right?"
                until the person is locked out, and a reset costs them the
                account until they work out what they typed. It shares the show
                /hide toggle rather than adding a second one — two independent
                toggles on adjacent fields invite revealing one and not the
                other. */}
            <View style={styles.inputSection} onLayout={(e) => { fieldOffsets.current.confirmPassword = e.nativeEvent.layout.y; }}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.passwordInput, focusedField === 'confirmPassword' && styles.inputFocused, errors.confirmPassword ? styles.inputError : null]}
                  value={confirmPassword}
                  /**
                   * The mismatch is reported as it happens, not on submit.
                   *
                   * The submit button is disabled until the two match, so
                   * submitting was never reached and the message never showed:
                   * the button simply stayed grey with no reason given. Someone
                   * who mistypes the second field has nothing to tell them
                   * which field is wrong, or that anything is.
                   *
                   * Only once there is something to compare — an empty field is
                   * unfinished rather than mismatched.
                   */
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (!t || t === password) clearError('confirmPassword');
                    else setErrors(p => ({ ...p, confirmPassword: 'Passwords do not match' }));
                  }}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                  testID="vendor-confirm-password"
                />
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            <View style={styles.sectionHeaderRow}>
              <MapPin size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Location</Text>
            </View>

            {/* Country only at signup. It can't be deferred like the rest of
                the business details, because currency, plan pricing and
                country availability are all resolved from it the moment the
                account is created. State and area move to onboarding. */}
            <View onLayout={(e) => { fieldOffsets.current.country = e.nativeEvent.layout.y; }}>
            <LocationCascadeFields
              value={location}
              onChange={setLocation}
              errors={{ country: errors.country }}
              onClearError={(key) => clearError(key)}
              disabled={isLoading}
              testIDPrefix="vendor"
              countryOnly
            />
            </View>

            {/* No section header for referral: it's one optional field, so giving
                it the same visual weight as Location or Personal details
                overstated it and made the form feel longer than it is. */}
            <View style={styles.inputSection} onLayout={(e) => { fieldOffsets.current.referralCode = e.nativeEvent.layout.y; }}>
              <Text style={styles.label}>Referral code</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'referralCode' && styles.inputFocused,
                  errors.referralCode || referralValidation.validationStatus === 'invalid' ? styles.inputError : null,
                  referralValidation.validationStatus === 'valid' ? styles.inputSuccess : null,
                ]}
                value={referralCode}
                onChangeText={handleReferralChange}
                onFocus={() => setFocusedField('referralCode')}
                onBlur={() => {
                  setFocusedField('');
                  void runReferralValidation(referralCode);
                }}
                placeholder="Enter referral code, if you have one"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading && referralValidation.validationStatus !== 'pending'}
                testID="vendor-referral-code"
              />
              <Text style={styles.helperText}>Optional. Enter a referral code from a the platform representative or another vendor.</Text>
              {referralValidation.validationStatus === 'pending' ? (
                <View style={styles.validationRow}>
                  <ActivityIndicator color="#FF8C42" size="small" />
                  <Text style={styles.pendingText}>Checking referral code…</Text>
                </View>
              ) : null}
              {referralValidation.validationStatus === 'valid' ? <Text style={styles.successText}>Referral code applied</Text> : null}
              {errors.referralCode || referralValidation.validationStatus === 'invalid' ? (
                <Text style={styles.errorText}>{errors.referralCode ?? referralValidation.error ?? 'Invalid or inactive referral code'}</Text>
              ) : null}
            </View>

            {/* Three separate outcomes read as three lines, not one paragraph.
                Prose makes a reader work out how many things they are being
                told; a list tells them before they start. */}
            <View style={styles.planNote}>
              <Text style={styles.planNoteTitle}>After creating your account</Text>
              {[
                'Start on the Basic plan',
                'Complete setup to publish your storefront',
                'Verify your business to appear in discovery',
              ].map((line) => (
                <View key={line} style={styles.planNoteRow}>
                  <Check size={14} color="#E0631A" strokeWidth={3} />
                  <Text style={styles.planNoteText}>{line}</Text>
                </View>
              ))}
            </View>

            {/* Consent sits directly above the button that commits to it, so the
                vendor reads what they're agreeing to before the action, not
                after it. Each document is separately tappable. */}
            <Text style={styles.legalText}>
              By creating a vendor account, you agree to the platform&apos;s{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('termsOfUse')}
                testID="vendor-legal-terms"
              >
                Terms of Use
              </Text>
              ,{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('privacyPolicy')}
                testID="vendor-legal-privacy"
              >
                Privacy Policy
              </Text>
              , and{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('vendorAgreement')}
                testID="vendor-legal-vendor-agreement"
              >
                Vendor Agreement
              </Text>
              .
            </Text>

            {/* Only what no single field can own: a network failure, a rate
                limit, sign-up being unavailable. Field-level problems stay
                attached to their input, where the fix is. */}
            {formError ? (
              <View
                style={styles.formErrorBox}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                testID="vendor-form-error"
              >
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, (!isFormComplete || isLoading) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!isFormComplete || isLoading}
              testID="vendor-create-account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Vendor Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.bottomSection}>
              <Text style={styles.bottomText}>Already have an account? </Text>
              <TouchableOpacity activeOpacity={0.7} disabled={isLoading} onPress={() => router.replace('/login' as any)}>
                <Text style={styles.bottomLink}>Log in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingVertical: 16 },
  content: { paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' as const },
  // The asset is square (2000x2000). A wide, short box with resizeMode
  // "contain" rendered it as a small mark adrift in whitespace, which is why it
  // looked missing. Square box, sized to read as a brand mark not an icon.
  brandLogo: { width: 76, height: 76, alignSelf: 'center', marginBottom: 16 },
  header: { marginBottom: 20, marginTop: 8 },
  title: { fontSize: 26, fontWeight: '700' as const, color: '#2B2B2B', marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  row: { flexDirection: 'row' as const, gap: 12 },
  rowItem: { flex: 1 },
  inputSection: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' as const, color: '#2B2B2B', marginBottom: 8, paddingHorizontal: 2 },
  input: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE',
  },
  textArea: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE', minHeight: 100,
  },
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFBF8' },
  inputError: { borderColor: '#DC2626' },
  inputSuccess: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  selectorButton: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  selectorText: { fontSize: 16, color: '#2B2B2B' },
  selectorPlaceholder: { color: '#9CA3AF', fontSize: 16 },
  sectionHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, marginBottom: 14 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700' as const, color: '#FF8C42', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  formErrorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  formErrorText: { fontSize: 14, color: '#DC2626', lineHeight: 20, textAlign: 'center' as const },
  helperText: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: 6, paddingHorizontal: 4 },
  passwordRow: { position: 'relative' as const, justifyContent: 'center' as const },
  // Matches `input` above, plus room for the visibility toggle. It used to have
  // its own background, border width and font size, so the password field did
  // not look like the fields directly above it on the same form.
  passwordInput: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    paddingRight: 48, fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE',
  },
  passwordToggle: { position: 'absolute' as const, right: 14, padding: 4 },
  validationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 8, paddingHorizontal: 4 },
  pendingText: { fontSize: 13, color: '#9A3412' },
  successText: { fontSize: 13, color: '#16A34A', marginTop: 6, paddingHorizontal: 4, fontWeight: '600' as const },
  planNote: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#FED7AA' },
  planNoteTitle: {
    fontSize: 13, fontWeight: '600' as const, color: '#9A3412', marginBottom: 8,
  },
  planNoteRow: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8, marginBottom: 6,
  },
  // flex so a long line wraps under itself rather than pushing the tick out.
  planNoteText: { flex: 1, fontSize: 13, color: '#9A3412', lineHeight: 19 },
  primaryButton: {
    backgroundColor: '#FF8C42', borderRadius: 14, height: 52, alignItems: 'center' as const,
    justifyContent: 'center' as const, marginTop: 4,
    shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: '#F0C9AE', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  bottomSection: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 24 },
  bottomText: { fontSize: 15, color: '#6B7280' },
  legalText: { fontSize: 12.5, lineHeight: 18, color: '#6B7280', textAlign: 'center' as const, marginTop: 14, paddingHorizontal: 4 },
  legalLink: { color: '#FF8C42', fontWeight: '600' as const },
  bottomLink: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' as const },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 8 },
  modalHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: '#2B2B2B' },
  modalClose: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  searchContainer: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#2B2B2B' },
  modalList: { paddingHorizontal: 12, paddingBottom: 32 },
  modalItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  modalItemSelected: { backgroundColor: 'rgba(255,140,66,0.08)' },
  modalItemText: { fontSize: 16, color: '#2B2B2B' },
  modalItemTextSelected: { color: '#FF8C42', fontWeight: '600' as const },
});
