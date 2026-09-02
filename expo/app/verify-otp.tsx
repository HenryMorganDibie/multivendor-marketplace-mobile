import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { verifyOtp, sendOtp } from '@/lib/auth/verifyOtp';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

const PENDING_VENDOR_REG_KEY = '@platform_pending_vendor_reg';
const PENDING_CUSTOMER_REG_KEY = '@platform_pending_customer_reg';

export default function VerifyOTPScreen() {
  const { contact, maskedContact, context } = useLocalSearchParams<{
    contact?: string;
    maskedContact: string;
    context: 'login' | 'customer-registration' | 'vendor-registration';
  }>();
  const router = useRouter();
  const { login, registerAccount, redirectAfterLogin } = useAuth() as any;
  const { setInitialCountry } = useUserLocation();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    if (!/^\d*$/.test(value)) return;

    if (value.length > 1) {
      handlePaste(value);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) {
      const newOtp = digits.split('');
      setOtp(newOtp);
      setError('');
      inputRefs.current[5]?.focus();
    }
  };

  const isOtpComplete = otp.every((digit) => digit !== '');

  const handleVerify = async () => {
    if (!isOtpComplete) return;

    setIsVerifying(true);
    setError('');

    try {
      const otpCode = otp.join('');

      console.log('[AUTH FLOW] Verifying OTP, context:', context);

      /**
       * The server decides whether the code is right.
       *
       * This compared against the literal 123456, so any phone number or email
       * address could be verified by anyone who knew the constant — which is
       * everyone, since it was in the source. The backend rate limits sends,
       * expires codes, counts attempts and refuses a reused one, none of which
       * a client-side equality check can do.
       *
       * Its message is shown rather than flattened to "incorrect", because
       * somebody whose code has expired needs to request another rather than
       * retyping the same digits.
       */
      if (!DEV_LOCAL_AUTH_ENABLED) {
        const result = await verifyOtp(contact ?? '', otpCode);
        if (!result.verified) {
          setError(result.message ?? 'The code you entered is incorrect');
          setIsVerifying(false);
          return;
        }
      } else if (otpCode !== '123456') {
        // Development only, for the demo logins that have no backend account.
        if (otpCode === '000000') {
          setError('This code has expired. Request a new one.');
        } else {
          setError('The code you entered is incorrect');
        }
        setIsVerifying(false);
        return;
      }

      if (context === 'login') {
        if (!contact) {
          setError('Missing login credentials');
          setIsVerifying(false);
          return;
        }

        console.log('[AUTH FLOW] Logging in user');
        const response = await login({
          emailOrPhone: contact,
          otp: otpCode,
        });

        if (!response.success) {
          setError(response.error || 'Login failed');
          setIsVerifying(false);
          return;
        }

        if (response.user) {
          console.log('[AUTH FLOW] Login successful, redirecting user with role:', response.user.role);
          redirectAfterLogin(response.user);
        }
      } else if (context === 'customer-registration') {
        if (!contact) {
          setError('Missing registration data');
          setIsVerifying(false);
          return;
        }

        let pendingData: any = null;
        try {
          const stored = await AsyncStorage.getItem(PENDING_CUSTOMER_REG_KEY);
          if (stored) pendingData = JSON.parse(stored);
        } catch (e) {
          console.error('[AUTH FLOW] Failed to load pending customer reg data:', e);
        }

        if (!pendingData) {
          setError('Your registration details were lost. Please start again.');
          setIsVerifying(false);
          return;
        }

        console.log('[AUTH FLOW] Registering customer account');
        const response = await registerAccount(pendingData);

        if (!response.success) {
          setError(response.error || 'Registration failed');
          setIsVerifying(false);
          return;
        }

        await AsyncStorage.removeItem(PENDING_CUSTOMER_REG_KEY).catch(() => {});

        // Carry the location they just gave us into UserLocationContext. It
        // only ever read AsyncStorage, so without this a customer who had
        // just picked country, state and area landed on the home screen and
        // was immediately asked to "Select your country" all over again.
        const loc = pendingData.location;
        if (loc?.countryCode) {
          await setInitialCountry(
            loc.countryCode,
            loc.stateCode || undefined,
            undefined,
            loc.areaName || undefined,
          );
        }

        /**
         * Straight into the app, skipping Complete Profile.
         *
         * That screen asks for first name and last initial, and the
         * registration form has just collected both. Asking again immediately
         * after signup reads as though the first answers were not saved.
         *
         * The screen is deliberately left in place, routed and reachable. It is
         * the right destination for a social sign-in, where a provider may
         * return an account with no usable name — that path is behind
         * SOCIAL_AUTH_ENABLED and currently off. When it is switched on, this is
         * where it points again.
         */
        console.log('[AUTH FLOW] Customer registration successful → home (profile already complete)');
        router.replace('/customer' as any);
      } else if (context === 'vendor-registration') {
        if (!contact) {
          setError('Missing registration data');
          setIsVerifying(false);
          return;
        }

        let pendingData: any = null;
        try {
          const stored = await AsyncStorage.getItem(PENDING_VENDOR_REG_KEY);
          if (stored) pendingData = JSON.parse(stored);
        } catch (e) {
          console.error('[AUTH FLOW] Failed to load pending vendor reg data:', e);
        }

        if (!pendingData) {
          setError('Your registration details were lost. Please start again.');
          setIsVerifying(false);
          return;
        }

        console.log('[AUTH FLOW] Registering vendor account');
        const response = await registerAccount(pendingData);

        if (!response.success) {
          setError(response.error || 'Registration failed');
          setIsVerifying(false);
          return;
        }

        await AsyncStorage.removeItem(PENDING_VENDOR_REG_KEY).catch(() => {});

        // Matches what register/vendor.tsx itself did before OTP verification
        // sat between it and this point — not routing through
        // vendor-setup-complete, which updates VendorContext's local-only
        // state rather than the real backend record, a separate existing gap.
        console.log('[AUTH FLOW] Vendor registration successful → vendor dashboard');
        router.replace('/vendor/(tabs)/dashboard' as any);
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(30);
    setError('');
    setOtp(['', '', '', '', '', '']);

    console.log('Resending OTP code to:', maskedContact);

    /**
     * Resend actually sends one now. It previously reset the timer and cleared
     * the boxes without asking for anything, so a customer whose code never
     * arrived could tap it forever and wait for a message that was never
     * requested.
     *
     * A failure re-opens the button rather than leaving them on a 30-second
     * countdown for a send that did not happen.
     */
    if (!DEV_LOCAL_AUTH_ENABLED && contact) {
      try {
        await sendOtp(contact);
      } catch (err) {
        console.error('[AUTH FLOW] Resend failed:', err);
        setError((err as { message?: string })?.message ?? 'We could not send a new code. Try again.');
        setCanResend(true);
        setResendTimer(0);
      }
    }

    inputRefs.current[0]?.focus();
  };

  /**
   * Every screen that navigates here (login, register.tsx, register/vendor,
   * register/customer) uses router.push, never .replace, so the screen the
   * person was actually on is still underneath this one on the stack —
   * back always returns to it, with whatever they'd typed still in state.
   * The registration branch used to send everyone to /login instead,
   * discarding the entire form (name, password, location, everything) to
   * fix a typo in an email address.
   */
  const handleChangeContact = () => {
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to your email: {maskedContact}
            </Text>
          </View>

          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.otpInput,
                  digit ? styles.otpInputFilled : null,
                  error ? styles.otpInputError : null,
                ]}
                value={digit}
                onChangeText={(value) => handleOtpChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
                editable={!isVerifying}
              />
            ))}
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.verifyButton,
              (!isOtpComplete || isVerifying) && styles.verifyButtonDisabled,
            ]}
            onPress={handleVerify}
            activeOpacity={0.8}
            disabled={!isOtpComplete || isVerifying}
          >
            {isVerifying ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!canResend}
              activeOpacity={0.7}
              style={styles.actionButton}
            >
              <Text style={[styles.actionText, !canResend && styles.actionTextDisabled]}>
                {canResend ? 'Resend code' : `Resend available in ${resendTimer}s`}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={handleChangeContact}
              activeOpacity={0.7}
              style={styles.actionButton}
            >
              <Text style={styles.actionText}>Change email</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textMuted,
    lineHeight: 24,
  },
  otpContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
    gap: 8,
  },
  otpInput: {
    width: 52,
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.charcoal,
  },
  otpInputFilled: {
    borderColor: Colors.border,
  },
  otpInputError: {
    borderColor: Colors.error,
  },
  errorContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
    minHeight: 52,
  },
  verifyButtonDisabled: {
    opacity: 0.4,
  },
  verifyButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryActions: {
    marginTop: 24,
    alignItems: 'center' as const,
    gap: 16,
  },
  actionButton: {
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  actionTextDisabled: {
    color: Colors.textMuted,
  },
});
