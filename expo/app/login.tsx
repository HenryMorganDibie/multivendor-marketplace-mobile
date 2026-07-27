import React, { useState } from 'react';
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
import { Image } from 'react-native';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split('@');
  const maskedLocal = localPart.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, socialLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    let hasError = false;

    setEmailError('');
    setPasswordError('');
    setAuthError('');
    
    if (!trimmedEmail) {
      setEmailError('Please enter your email address.');
      hasError = true;
    } else if (!isEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Please enter your password.');
      hasError = true;
    }

    if (hasError) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('[AUTH FLOW] Logging in with email + password:', trimmedEmail);
      const response = await login({
        emailOrPhone: trimmedEmail,
        password: password,
      });
      
      if (!response.success) {
        setAuthError('Incorrect email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      if (response.user) {
        console.log('[AUTH FLOW] Login successful, user will be redirected by auth guard');
      }
    } catch {
      setAuthError('Incorrect email or password. Please try again.');
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setEmailError('');
    setPasswordError('');
    setAuthError('');
    console.log('[AUTH FLOW] Forgot password → opening reset screen');
    router.push('/forgot-password' as any);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    if (socialLoading || isLoading) return;
    setEmailError('');
    setPasswordError('');
    setAuthError('');
    setSocialLoading(provider);
    try {
      console.log(`[AUTH FLOW] Continue with ${provider} pressed`);
      // Apple may supply name/email on first sign-in; Google resolves a returning profile.
      const response = await socialLogin(provider);
      if (!response.success) {
        setAuthError('Could not sign you in. Please try again.');
        setSocialLoading(null);
        return;
      }
      // The auth guard routes complete profiles to Home and new/incomplete ones to Complete Profile.
      console.log('[AUTH FLOW] Social login successful, auth guard will route the user');
    } catch {
      setAuthError('Could not sign you in. Please try again.');
      setSocialLoading(null);
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
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Log in to your the platform account</Text>
            </View>

            <TouchableOpacity
              style={styles.appleButton}
              activeOpacity={0.8}
              onPress={() => handleSocialLogin('apple')}
              disabled={socialLoading !== null || isLoading}
              testID="login-apple-button"
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Image source={require('@/assets/images/apple-logo.png')} style={styles.appleLogoImg} />
                  <Text style={styles.appleButtonText}>Continue with Apple</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.googleButton}
              activeOpacity={0.8}
              onPress={() => handleSocialLogin('google')}
              disabled={socialLoading !== null || isLoading}
              testID="login-google-button"
            >
              {socialLoading === 'google' ? (
                <ActivityIndicator color="#2B2B2B" />
              ) : (
                <>
                  <Image source={require('@/assets/images/google-logo.png')} style={styles.googleLogoImg} />
                  <Text style={styles.googleButtonText}>Continue with Google</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.form}>
              <View style={styles.inputSection}>
                <TextInput
                  style={[
                    styles.input,
                    emailFocused && styles.inputFocused,
                    emailError ? styles.inputError : null,
                  ]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (emailError) setEmailError('');
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="Email address"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!isLoading}
                  testID="login-email-input"
                />
                {emailError ? (
                  <Text style={styles.fieldErrorText}>{emailError}</Text>
                ) : null}
              </View>

              <View style={styles.inputSection}>
                <TextInput
                  style={[
                    styles.input,
                    passwordFocused && styles.inputFocused,
                    passwordError ? styles.inputError : null,
                  ]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  testID="login-password-input"
                />
                {passwordError ? (
                  <Text style={styles.fieldErrorText}>{passwordError}</Text>
                ) : null}
              </View>

              {authError ? (
                <View style={styles.authErrorBox}>
                  <Text style={styles.authErrorText}>{authError}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={isLoading}
                testID="login-submit-button"
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.loginButtonText}>Log in</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.emailVerificationLink}
                onPress={handleForgotPassword}
                activeOpacity={0.7}
                disabled={isLoading}
                testID="login-forgot-password"
              >
                <Text style={styles.emailVerificationText}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.trustText}>Your data is private and never sold.</Text>

            <View style={styles.bottomSection}>
              <Text style={styles.bottomText}>New to the platform? </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  console.log('[AUTH FLOW] Navigating to role selection from login');
                  router.push('/create-account' as any);
                }}
              >
                <Text style={styles.bottomLink}>Create an account</Text>
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
    fontWeight: '400' as const,
    color: '#6B7280',
    textAlign: 'center' as const,
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
    marginBottom: 0,
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
  fieldErrorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  authErrorBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  authErrorText: {
    fontSize: 14,
    color: '#DC2626',
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  loginButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
  },
  loginButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emailVerificationLink: {
    alignItems: 'center' as const,
    paddingVertical: 14,
  },
  emailVerificationText: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '500' as const,
  },
  trustText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center' as const,
    marginTop: 8,
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
    fontWeight: '400' as const,
  },
  bottomLink: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
});
