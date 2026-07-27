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

const PENDING_VENDOR_REG_KEY = '@the platform_pending_vendor_reg';

export default function VerifyOTPScreen() {
  const { contact, maskedContact, context, password, businessName } = useLocalSearchParams<{
    contact?: string;
    maskedContact: string;
    context: 'login' | 'customer-registration' | 'vendor-registration';
    password?: string;
    businessName?: string;
  }>();
  const router = useRouter();
  const { login, registerAccount, redirectAfterLogin } = useAuth() as any;

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
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const otpCode = otp.join('');
      
      console.log('[AUTH FLOW] Verifying OTP, context:', context);
      
      if (otpCode !== '123456') {
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
        if (!contact || !password) {
          setError('Missing registration data');
          setIsVerifying(false);
          return;
        }

        console.log('[AUTH FLOW] Registering customer account');
        const response = await registerAccount({
          identifier: contact,
          password: password,
          role: 'customer',
        });

        if (!response.success) {
          setError(response.error || 'Registration failed');
          setIsVerifying(false);
          return;
        }

        console.log('[AUTH FLOW] Customer registration successful → redirecting to complete profile');
        router.replace('/complete-profile' as any);
      } else if (context === 'vendor-registration') {
        if (!contact || !password) {
          setError('Missing registration data');
          setIsVerifying(false);
          return;
        }

        let pendingData: any = {};
        try {
          const stored = await AsyncStorage.getItem(PENDING_VENDOR_REG_KEY);
          if (stored) {
            pendingData = JSON.parse(stored);
            console.log('[AUTH FLOW] Loaded pending vendor reg data:', pendingData.businessName);
          }
        } catch (e) {
          console.error('[AUTH FLOW] Failed to load pending vendor reg data:', e);
        }

        console.log('[AUTH FLOW] Registering vendor account');
        const response = await registerAccount({
          identifier: contact,
          password: password,
          role: 'vendor',
          businessName: pendingData.businessName || businessName || '',
          plan: 'basic',
          fullName: pendingData.fullName || '',
          categoryId: pendingData.categoryId || '',
          categoryName: pendingData.categoryName || '',
          country: pendingData.country || '',
          state: pendingData.state || '',
          area: pendingData.area || '',
        });

        if (!response.success) {
          setError(response.error || 'Registration failed');
          setIsVerifying(false);
          return;
        }

        await AsyncStorage.removeItem(PENDING_VENDOR_REG_KEY).catch(() => {});

        console.log('[AUTH FLOW] Vendor registration successful → redirecting to setup complete');
        router.replace('/vendor-setup-complete' as any);
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
    
    inputRefs.current[0]?.focus();
  };

  const handleChangeContact = () => {
    if (context === 'login') {
      router.back();
    } else {
      router.replace('/login');
    }
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
