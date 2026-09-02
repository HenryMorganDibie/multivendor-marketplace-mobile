import React, { useRef, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react-native';
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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { SOCIAL_AUTH_ENABLED } from '@/constants/authProviders';

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
  const { login, socialLogin, user, isAuthenticated, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [authError, setAuthError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  /**
   * Put the message where the person can act on it.
   *
   * `errorField` comes back from AuthContext, which reads the Firebase error
   * code rather than its wording. A wrong password belongs under the password
   * field with focus there; a disabled account belongs to the form, because no
   * single input is wrong. Everything used to land in one banner reading
   * "Incorrect email or password. Please try again." whatever had actually
   * happened — including a locked account, where retrying is the one thing
   * that cannot help.
   */
  const showAuthFailure = (message: string, field?: string) => {
    if (field === 'email') {
      setEmailError(message);
      emailRef.current?.focus();
      return;
    }
    if (field === 'password') {
      setPasswordError(message);
      passwordRef.current?.focus();
      return;
    }
    setAuthError(message);
  };

  /**
   * Checked when the person leaves the field, not only when they submit.
   *
   * Waiting for submit means a typo in the address is reported as a failed
   * login, which sends them to check the password instead.
   */
  const validateEmailOnBlur = () => {
    setEmailFocused(false);
    const trimmed = email.trim();
    if (!trimmed) return; // Empty is "not finished", not "wrong".
    if (!isEmail(trimmed)) {
      setEmailError('Enter a valid email address.');
    }
  };

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    let hasError = false;

    setEmailError('');
    setPasswordError('');
    setAuthError('');
    
    if (!trimmedEmail) {
      setEmailError('Enter your email address.');
      hasError = true;
    } else if (!isEmail(trimmedEmail)) {
      setEmailError('Enter a valid email address.');
      hasError = true;
    }

    if (!password) {
      setPasswordError('Enter your password.');
      hasError = true;
    }

    // Focus the first field that failed, so the fix is one keystroke away
    // rather than a hunt down the form.
    if (hasError) {
      if (!trimmedEmail || !isEmail(trimmedEmail)) emailRef.current?.focus();
      else passwordRef.current?.focus();
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
        /**
         * The reason the sign-in failed, not a guess at it.
         *
         * This screen used to overwrite whatever came back with "Incorrect
         * email or password. Please try again." — so a disabled account, a
         * rate limit and an unverified email all told the person to retry a
         * password that was already correct. AuthContext resolves the real
         * reason from the Firebase error code; the only job left here is to
         * show it and put focus where it applies.
         */
        showAuthFailure(
          response.error || 'Incorrect email or password.',
          response.errorField,
        );
        setIsLoading(false);
        return;
      }

      if (response.user) {
        console.log('[AUTH FLOW] Login successful, user will be redirected by auth guard');
      }
    } catch (error) {
      // Nothing above threw an auth answer, so this is genuinely our side —
      // the one case where "try again" is real advice.
      console.error('[AUTH FLOW] Login error:', error);
      setAuthError('Something went wrong on our side. Please try again.');
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
              <Image
                source={require('@/assets/images/platform-logo.png')}
                style={styles.brandLogo}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel="the platform"
              />
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Log in to your the platform account</Text>
            </View>

            {/**
              * Reaching this screen while already signed in is a deliberate
              * act — the guard only allows it with ?switchAccount=1 — and it
              * almost always means a different person is at the keyboard on a
              * shared computer. Saying whose session is currently open matters:
              * signing in below replaces it, and without this the previous
              * account is invisible right up until it is gone.
              */}
            {isAuthenticated && user ? (
              <View style={styles.activeSessionCard}>
                <Text style={styles.activeSessionTitle}>Someone is already signed in</Text>
                <Text style={styles.activeSessionBody}>
                  This browser is signed in as {user.identifier || user.email}. Logging in below
                  will sign that account out on this device.
                </Text>
                <TouchableOpacity
                  onPress={() => { void logout(); }}
                  activeOpacity={0.7}
                  testID="login-sign-out-current"
                >
                  <Text style={styles.activeSessionAction}>Sign that account out first</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Hidden until the providers are actually implemented, see
                constants/authProviders.ts. These were wired to a placeholder
                that faked a sign-in, so they are gated rather than deleted:
                the markup is correct and returns as-is once the real
                credentials flow is in place. */}
            {SOCIAL_AUTH_ENABLED ? (
              <>
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
              </>
            ) : null}

            <View style={styles.form}>
              <View style={styles.inputSection}>
                <TextInput
                  ref={emailRef}
                  style={[
                    styles.input,
                    emailFocused && styles.inputFocused,
                    emailError ? styles.inputError : null,
                  ]}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    // Editing the field answers the complaint about it, and
                    // clears the banner too: a stale "account disabled" sitting
                    // over a freshly typed address is not about that address.
                    if (emailError) setEmailError('');
                    if (authError) setAuthError('');
                  }}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={validateEmailOnBlur}
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
                <View style={styles.passwordWrap}>
                <TextInput
                  ref={passwordRef}
                  style={[
                    styles.input,
                    styles.passwordInput,
                    passwordFocused && styles.inputFocused,
                    passwordError ? styles.inputError : null,
                  ]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passwordError) setPasswordError('');
                    if (authError) setAuthError('');
                  }}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  placeholder="Password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  testID="login-password-input"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  testID="login-password-toggle"
                >
                  {showPassword
                    ? <EyeOff size={20} color="#9CA3AF" strokeWidth={1.8} />
                    : <Eye size={20} color="#9CA3AF" strokeWidth={1.8} />}
                </TouchableOpacity>
                </View>
                {passwordError ? (
                  <Text style={styles.fieldErrorText}>{passwordError}</Text>
                ) : null}
              </View>

              {authError ? (
                // Announced when it appears, so it isn't a silent change for
                // anyone not looking at that part of the screen.
                <View
                  style={styles.authErrorBox}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  testID="login-form-error"
                >
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

            <View style={styles.trustRow}>
              <Lock size={12} color="#9CA3AF" strokeWidth={2} />
              <Text style={styles.trustText}>Your data is private and never sold.</Text>
            </View>

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
  // The asset is square (2000x2000). A wide, short box with resizeMode
  // "contain" rendered it as a small mark adrift in whitespace, which is why it
  // looked missing. Square box, sized to read as a brand mark not an icon.
  brandLogo: { width: 76, height: 76, alignSelf: 'center', marginBottom: 16 },
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
  activeSessionCard: {
    backgroundColor: '#FFF7F2',
    borderWidth: 1,
    borderColor: '#FFE0C9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  activeSessionTitle: {
    fontSize: 14.5,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    marginBottom: 4,
  },
  activeSessionBody: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#6B7280',
  },
  activeSessionAction: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginTop: 10,
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
  passwordWrap: {
    position: 'relative' as const,
    justifyContent: 'center' as const,
  },
  passwordInput: {
    // Room for the toggle so a long password never runs underneath it.
    paddingRight: 48,
  },
  passwordToggle: {
    position: 'absolute' as const,
    right: 16,
    height: '100%' as const,
    justifyContent: 'center' as const,
  },
  trustRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 8,
    marginBottom: 28,
  },
  trustText: {
    fontSize: 13,
    color: '#6B7280',
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
