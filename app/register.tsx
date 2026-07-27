import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
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
import { useAuth } from '@/contexts/AuthContext';
import { ChevronLeft } from 'lucide-react-native';
import { Image } from 'react-native';
import { useCountryStatus } from '@/contexts/CountryStatusContext';

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

type ScreenMode = 'initial' | 'email';

export default function RegisterScreen() {
  const router = useRouter();
  const { checkAccountExists, isAuthenticated, isLoading: authLoading } = useAuth();
  const [mode, setMode] = useState<ScreenMode>('initial');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const countryStatus = useCountryStatus();

  useEffect(() => {
    if (countryStatus.isComingSoon) {
      console.log('[REGISTER] Country is COMING_SOON, redirecting');
      router.replace({
        pathname: '/coming-soon' as any,
        params: {
          countryName: countryStatus.countryName,
          launchTimeline: countryStatus.launchTimeline || '',
        },
      });
      return;
    }

    if (!authLoading && isAuthenticated) {
      console.log('[AUTH GUARD] User already authenticated, redirecting from customer registration');
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router, countryStatus.isComingSoon, countryStatus.countryName, countryStatus.launchTimeline]);

  if (authLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const validateEmail = (value: string): string | undefined => {
    const trimmed = value.trim();
    if (!trimmed) return 'Email is required';
    if (!isEmail(trimmed)) return 'Please enter a valid email';
    return undefined;
  };

  const validatePassword = (value: string): string | undefined => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    return undefined;
  };

  const handleContinue = async () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setErrors({ email: emailError, password: passwordError });

    if (emailError || passwordError) return;

    setIsLoading(true);

    try {
      const trimmedIdentifier = email.trim();
      console.log('[AUTH FLOW] Customer registration: checking if account exists');
      const check = await checkAccountExists(trimmedIdentifier);

      if (check.exists) {
        console.log('[AUTH FLOW] Account already exists with role:', check.role);
        setErrors({ email: 'An account already exists with this email. Please log in.' });
        setIsLoading(false);
        return;
      }

      console.log('[AUTH FLOW] Account does not exist, proceeding with customer registration');
      const maskedContact = maskEmail(trimmedIdentifier);

      console.log('[AUTH FLOW] Navigating to OTP verification for customer registration');
      router.push({
        pathname: '/verify-otp',
        params: {
          contact: trimmedIdentifier,
          maskedContact,
          context: 'customer-registration',
          password: password,
        },
      });
    } catch {
      setErrors({ email: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (mode === 'email') {
      setMode('initial');
      setErrors({});
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color="#2B2B2B" strokeWidth={2} />
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>
                {mode === 'initial'
                  ? 'Get started with the platform in seconds'
                  : 'Enter your email and password to continue'}
              </Text>
            </View>

            {mode === 'initial' ? (
              <>
                <TouchableOpacity
                  style={styles.appleButton}
                  activeOpacity={0.8}
                  onPress={() => console.log('[AUTH FLOW] Continue with Apple pressed')}
                >
                  <Image source={require('@/assets/images/apple-logo.png')} style={styles.appleLogoImg} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.googleButton}
                  activeOpacity={0.8}
                  onPress={() => console.log('[AUTH FLOW] Continue with Google pressed')}
                >
                  <Image source={require('@/assets/images/google-logo.png')} style={styles.googleLogoImg} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.emailButton}
                  activeOpacity={0.85}
                  onPress={() => setMode('email')}
                  testID="register-email-button"
                >
                  <Text style={styles.emailButtonText}>Continue with Email</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.form}>
                <View style={styles.inputSection}>
                  <TextInput
                    style={[
                      styles.input,
                      emailFocused && styles.inputFocused,
                      errors.email ? styles.inputError : null,
                    ]}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder="Email address"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!isLoading}
                    autoFocus
                    testID="register-email-input"
                  />
                  {errors.email ? (
                    <Text style={styles.errorText}>{errors.email}</Text>
                  ) : null}
                </View>

                <View style={styles.inputSection}>
                  <TextInput
                    style={[
                      styles.input,
                      passwordFocused && styles.inputFocused,
                      errors.password ? styles.inputError : null,
                    ]}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="Create a password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    testID="register-password-input"
                  />
                  {errors.password ? (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  ) : (
                    <Text style={styles.helperText}>Minimum 8 characters</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                  disabled={isLoading}
                  testID="register-continue-button"
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>Create account</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.trustText}>Your data is private and never sold.</Text>

            <View style={styles.bottomSection}>
              <Text style={styles.bottomText}>Already have an account? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={isLoading}
                onPress={() => router.push('/login')}
              >
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignSelf: 'flex-start' as const,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  appleButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#000000',
    borderRadius: 14,
    height: 52,
    marginBottom: 12,
  },
  appleLogoImg: {
    width: 20,
    height: 20,
    marginRight: 10,
    tintColor: '#FFFFFF',
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  googleButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    height: 52,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  googleLogoImg: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  dividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#9CA3AF',
    marginHorizontal: 16,
  },
  emailButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emailButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  form: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputFocused: {
    borderColor: '#FF8C42',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  helperText: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  continueButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  trustText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    marginTop: 24,
    marginBottom: 28,
  },
  bottomSection: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingBottom: 16,
  },
  bottomText: {
    fontSize: 15,
    color: '#6B7280',
  },
  bottomLink: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});
