import React, { useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp } from '@/lib/auth/verifyOtp';
import { EMAIL_OTP_REGISTRATION_REQUIRED } from '@/constants/devAuth';
import { useUserLocation } from '@/contexts/UserLocationContext';
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
import { MapPin, Eye, EyeOff } from 'lucide-react-native';
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

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  const maskedLocal = local.length > 2
    ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
    : local;
  return `${maskedLocal}@${domain}`;
}

/** Matches the key verify-otp.tsx reads from once the code is confirmed. */
export const PENDING_CUSTOMER_REG_KEY = '@the platform_pending_customer_reg';

/**
 * Reduce whatever was typed to a single capitalised letter.
 *
 * \p{L} rather than A-Z on purpose: a customer whose surname starts with Ñ, Ø
 * or É is entitled to their own initial, and an A-Z filter silently swallowed
 * the keystroke and left the field looking broken. Digits, punctuation and
 * whitespace are dropped as they are typed, so the field cannot hold anything
 * but one letter.
 */
export function normalizeLastInitial(raw: string): string {
  const letters = raw.replace(/[^\p{L}]/gu, '');
  return letters.slice(0, 1).toUpperCase();
}

type FieldErrors = Record<string, string | undefined>;

export default function CustomerSignupScreen() {
  const router = useRouter();
  const { checkAccountExists, registerAccount } = useAuth();
  const { setInitialCountry } = useUserLocation();

  const [firstName, setFirstName] = useState<string>('');
  const [lastInitial, setLastInitial] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  const [location, setLocation] = useState<LocationValue | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Failures no single input is responsible for — network, rate limit, outage. */
  const [formError, setFormError] = useState<string>('');

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  /**
   * State and area are only required when the country actually has them.
   *
   * Only 59 of 196 seeded countries currently have any state/area data at
   * all. This form used to require both unconditionally, so anyone selecting
   * one of the other 137 countries hit a state picker with nothing in it and
   * could never enable the Create Account button — signup was structurally
   * impossible for the country they actually picked, with no error message
   * explaining why, because nothing had technically failed.
   *
   * `loaded && items.length === 0` is a country whose states have genuinely
   * finished loading and come back empty, not one still in flight — so this
   * does not prematurely unblock a country that simply hasn't fetched yet.
   * Vendor registration already treats state/area as optional at signup,
   * collected later during onboarding instead; this gives customers the same
   * treatment rather than a second, stricter standard with no data to back it.
   */
  const { statesFor } = useLocationCatalogue();
  const countryHasNoStates =
    !!location?.countryCode &&
    statesFor(location.countryCode).loaded &&
    statesFor(location.countryCode).items.length === 0;

  const locationComplete =
    !!location &&
    !!location.countryCode &&
    (countryHasNoStates || (!!location.stateCode && !!location.areaId));

  const isFormComplete =
    firstName.trim().length >= 2 &&
    lastInitial.trim().length >= 1 &&
    isEmail(email) &&
    checkPassword(password).valid &&
    confirmPassword === password &&
    locationComplete;

  const clearError = (key: string) => {
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
  };

  /**
   * Put the server's answer on the field it is actually about.
   *
   * Every failure used to be written to `errors.email`, so a weak password or
   * an unreachable server both appeared under the email address. AuthContext
   * reports which field is at fault, read from the Firebase error code rather
   * than its wording; this routes it there and keeps anything form-wide in its
   * own banner.
   */
  const showRegistrationFailure = (message: string, field?: string) => {
    if (field && field !== 'form') {
      setFormError('');
      setErrors({ [field]: message });
      if (field === 'email') emailRef.current?.focus();
      if (field === 'password') passwordRef.current?.focus();
      return;
    }
    setErrors({});
    setFormError(message);
  };

  /**
   * Checked when the person leaves the field rather than only on submit, so a
   * malformed address is caught while they are still looking at it. Empty is
   * "not filled in yet", which is not something to complain about.
   */
  const validateEmailOnBlur = () => {
    setFocusedField('');
    const trimmed = email.trim();
    if (trimmed && !isEmail(trimmed)) setErrors(p => ({ ...p, email: 'Enter a valid email address.' }));
  };

  const handleSubmit = async () => {
    setFormError('');
    const newErrors: FieldErrors = {};
    if (firstName.trim().length < 2) newErrors.firstName = 'Enter your first name';
    if (lastInitial.trim().length < 1) newErrors.lastInitial = 'Enter your last initial';
    if (!isEmail(email)) newErrors.email = 'Enter a valid email address.';
    const pw = checkPassword(password);
    if (!pw.valid) newErrors.password = pw.error ?? 'Please choose a stronger password';
    if (confirmPassword !== password) newErrors.confirmPassword = 'Passwords do not match';
    if (!location?.countryCode) newErrors.country = 'Select your country';
    else if (!countryHasNoStates) {
      if (!location?.stateCode) newErrors.state = 'Select your state / province';
      else if (!location?.areaId) newErrors.area = 'Select your area';
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      /**
       * A final server-side check before submitting.
       *
       * The cascade above can only ever offer a combination the catalogue
       * actually contains, but that assumes the catalogue has not changed
       * since it loaded and the picker was not bypassed —
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
      const check = await checkAccountExists(trimmedEmail);
      if (check.exists) {
        showRegistrationFailure(
          'An account with this email already exists. Log in or reset your password.',
          'email',
        );
        setIsLoading(false);
        return;
      }

      const pendingPayload = {
        identifier: trimmedEmail,
        password,
        role: 'customer' as const,
        firstName: firstName.trim(),
        lastName: lastInitial.trim().toUpperCase(),
        location: location!,
      };

      if (!EMAIL_OTP_REGISTRATION_REQUIRED) {
        console.log('[AUTH FLOW] Email OTP disabled, registering customer directly:', trimmedEmail);
        const response = await registerAccount(pendingPayload);
        if (!response.success) {
          showRegistrationFailure(response.error || 'Registration failed');
          setIsLoading(false);
          return;
        }
        // Same carry-over verify-otp.tsx does for this context: without it,
        // a customer who just picked country/state/area lands on the home
        // screen and is immediately asked to select all three again, since
        // UserLocationContext only ever reads its own AsyncStorage key.
        if (location?.countryCode) {
          await setInitialCountry(
            location.countryCode,
            location.stateCode || undefined,
            undefined,
            location.areaName || undefined,
          );
        }
        router.replace('/customer' as any);
        return;
      }

      await AsyncStorage.setItem(PENDING_CUSTOMER_REG_KEY, JSON.stringify(pendingPayload));
      console.log('[AUTH FLOW] Sending OTP for customer registration:', trimmedEmail);
      await sendOtp(trimmedEmail);

      router.push({
        pathname: '/verify-otp',
        params: {
          contact: trimmedEmail,
          maskedContact: maskEmail(trimmedEmail),
          context: 'customer-registration',
        },
      });
    } catch (err) {
      console.error('[AUTH FLOW] Customer registration error:', err);
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
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Discover vendors, place orders and manage your purchases.</Text>
            </View>

            <View style={styles.row}>
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
                  testID="customer-firstname"
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>Last Initial</Text>
                <TextInput
                  style={[styles.input, focusedField === 'lastInitial' && styles.inputFocused, errors.lastInitial ? styles.inputError : null]}
                  value={lastInitial}
                  onChangeText={(t) => { setLastInitial(normalizeLastInitial(t)); clearError('lastInitial'); }}
                  onFocus={() => setFocusedField('lastInitial')}
                  onBlur={() => setFocusedField('')}
                  placeholder="D"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={1}
                  editable={!isLoading}
                  testID="customer-lastinitial"
                />
                {errors.lastInitial ? <Text style={styles.errorText}>{errors.lastInitial}</Text> : null}
              </View>
            </View>

            <Text style={styles.helperText} testID="customer-lastinitial-helper">
              We collect only your last initial to help protect your privacy.
            </Text>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                ref={emailRef}
                style={[styles.input, focusedField === 'email' && styles.inputFocused, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={(t) => { setEmail(t); clearError('email'); setFormError(''); }}
                onFocus={() => setFocusedField('email')}
                onBlur={validateEmailOnBlur}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isLoading}
                testID="customer-email"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputSection}>
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
                  testID="customer-password"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword(v => !v)}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  testID="customer-password-toggle"
                >
                  {showPassword
                    ? <EyeOff size={20} color="#9CA3AF" strokeWidth={2} />
                    : <Eye size={20} color="#9CA3AF" strokeWidth={2} />}
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              <PasswordRequirements requirements={checkPassword(password).requirements} />
            </View>

            {/* This is the only moment the password is ever set, so a typo locks
                the person out until they reset it. Shares the show/hide toggle
                above rather than adding a second one — two independent toggles
                on adjacent fields invite revealing one and not the other. */}
            <View style={styles.inputSection}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.passwordInput, focusedField === 'confirmPassword' && styles.inputFocused, errors.confirmPassword ? styles.inputError : null]}
                  value={confirmPassword}
                  /**
                   * Reported as it happens. The submit button is disabled until
                   * the two match, so submitting was never reached and the
                   * message never showed — the button just stayed grey with no
                   * reason given. Empty is unfinished rather than mismatched.
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
                  testID="customer-confirm-password"
                />
              </View>
              {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
            </View>

            <View style={styles.sectionHeaderRow}>
              <MapPin size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Location</Text>
            </View>

            <LocationCascadeFields
              value={location}
              onChange={setLocation}
              errors={{ country: errors.country, state: errors.state, area: errors.area }}
              onClearError={(key) => clearError(key)}
              disabled={isLoading}
              testIDPrefix="customer"
            />

            {/* Above the button, matching the vendor screen: the customer reads
                what they are agreeing to before the action, not after it. Each
                document is separately tappable. */}
            <Text style={styles.legalText}>
              By creating a customer account, you agree to the platform&apos;s{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('termsOfUse')}
                testID="customer-legal-terms"
              >
                Terms of Use
              </Text>
              ,{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('privacyPolicy')}
                testID="customer-legal-privacy"
              >
                Privacy Policy
              </Text>
              , and{' '}
              <Text
                style={styles.legalLink}
                onPress={() => void openLegalDocument('customerAgreement')}
                testID="customer-legal-customer-agreement"
              >
                Customer Agreement
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
                testID="customer-form-error"
              >
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, (!isFormComplete || isLoading) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!isFormComplete || isLoading}
              testID="customer-create-account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Customer Account</Text>
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
  header: { marginBottom: 24, marginTop: 8 },
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
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFBF8' },
  inputError: { borderColor: '#DC2626' },
  // Same as `input`, plus room for the visibility toggle. Kept in step with it
  // deliberately: the password field previously had its own background, border
  // width and font size, so it did not look like the fields above it.
  passwordRow: { position: 'relative' as const, justifyContent: 'center' as const },
  passwordInput: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    paddingRight: 48, fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE',
  },
  passwordToggle: { position: 'absolute' as const, right: 14, padding: 4 },
  helperText: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: -6, marginBottom: 16, paddingHorizontal: 4 },
  legalText: { fontSize: 12.5, lineHeight: 18, color: '#6B7280', textAlign: 'center' as const, marginTop: 14, paddingHorizontal: 4 },
  legalLink: { color: '#FF8C42', fontWeight: '600' as const },
  sectionHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, marginBottom: 14 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700' as const, color: '#FF8C42', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  formErrorBox: {
    backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginTop: 4, marginBottom: 12,
    borderWidth: 1, borderColor: '#FECACA',
  },
  formErrorText: { fontSize: 14, color: '#DC2626', lineHeight: 20, textAlign: 'center' as const },
  primaryButton: {
    backgroundColor: '#FF8C42', borderRadius: 14, height: 52, alignItems: 'center' as const,
    justifyContent: 'center' as const, marginTop: 4,
    shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  bottomSection: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 24 },
  bottomText: { fontSize: 15, color: '#6B7280' },
  bottomLink: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
});
