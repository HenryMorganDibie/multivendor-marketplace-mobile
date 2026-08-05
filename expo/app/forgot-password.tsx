import React, { useState } from 'react';
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
import { ArrowLeft, MailCheck } from 'lucide-react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [emailFocused, setEmailFocused] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleBackToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login' as any);
    }
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    setEmailError('');

    if (!trimmedEmail) {
      setEmailError('Please enter your email address.');
      return;
    }
    if (!isEmail(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[AUTH FLOW] Password reset requested for', trimmedEmail);
      /**
       * Actually sends the email.
       *
       * This waited 1.2 seconds and showed the confirmation screen without
       * requesting anything, so anyone who had genuinely forgotten their
       * password was told to check an inbox nothing had been sent to.
       *
       * Firebase sends and handles the reset link itself; there is no backend
       * function to write. The neutral confirmation stays either way — whether
       * an account exists is not something a login screen should disclose, and
       * an error here would disclose it.
       */
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSubmitted(true);
    } catch (err) {
      console.error('[AUTH FLOW] Password reset request error:', err);
      // Still show the neutral success state so account existence is never leaked.
      setSubmitted(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBackToLogin}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="forgot-back"
          >
            <ArrowLeft size={22} color="#2B2B2B" strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {submitted ? (
              <View style={styles.successWrap}>
                <View style={styles.successIcon}>
                  <MailCheck size={32} color="#FF8C42" strokeWidth={2} />
                </View>
                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.successText}>
                  If an account exists for this email, we&apos;ll send password reset instructions.
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleBackToLogin}
                  activeOpacity={0.85}
                  testID="forgot-back-to-login"
                >
                  <Text style={styles.primaryButtonText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.header}>
                  <Text style={styles.title}>Forgot password?</Text>
                  <Text style={styles.subtitle}>
                    Enter the email linked to your account and we&apos;ll send you reset instructions.
                  </Text>
                </View>

                <View style={styles.inputSection}>
                  <Text style={styles.label}>Email Address</Text>
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
                    placeholder="you@example.com"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!isLoading}
                    testID="forgot-email-input"
                  />
                  {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                  onPress={handleSubmit}
                  activeOpacity={0.85}
                  disabled={isLoading}
                  testID="forgot-submit"
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send reset instructions</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backLink}
                  onPress={handleBackToLogin}
                  activeOpacity={0.7}
                  disabled={isLoading}
                  testID="forgot-back-link"
                >
                  <Text style={styles.backLinkText}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  topBar: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center' as const },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
  },
  header: { marginBottom: 28 },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  inputSection: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2B2B2B',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  input: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFBF8' },
  inputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  primaryButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  backLink: { alignItems: 'center' as const, paddingVertical: 18 },
  backLinkText: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  successWrap: { alignItems: 'center' as const },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7ED',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  successText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
});
