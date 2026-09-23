import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, XCircle, Loader2, AtSign, Info } from 'lucide-react-native';
import { validateUsername, formatUsername } from '@/utils/usernameValidation';
import { mockVendors } from '@/mocks/vendorData';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';

export default function SelectUsernameScreen() {
  const router = useRouter();
  const {
    setUsername,
    systemGeneratedUsername,
    username: currentUsername,
    usernameSelectionPending,
  } = useVendorPlan();

  const [username, setUsernameInput] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const inputFocusAnim = useRef(new Animated.Value(0)).current;
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    if (!usernameSelectionPending && currentUsername && currentUsername !== systemGeneratedUsername) {
      handleBack();
    }
  }, [usernameSelectionPending, currentUsername, systemGeneratedUsername]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/vendor/settings/manage-account' as any);
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    Animated.timing(inputFocusAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const handleInputBlurAnim = () => {
    setInputFocused(false);
    Animated.timing(inputFocusAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  const borderColor = inputFocusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      touched && error ? Colors.error : Colors.border,
      touched && error ? Colors.error : Colors.primary,
    ],
  });

  /**
   * Availability is decided by the server. This checked a fixture array behind
   * a fake delay, so a vendor could be told a name was free while a real vendor
   * already held it — and the backend owns the reservation, so it is also the
   * only place that can answer without two people claiming the same name at
   * once.
   */
  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    const formatted = formatUsername(usernameToCheck);
    if (formatted === formatUsername(systemGeneratedUsername || '')) return false;

    try {
      const check = callable<{ username: string }, { success: true; available: boolean }>(
        'checkUsernameAvailability',
      );
      const res = await check({ username: formatted });
      return res.data.available;
    } catch (error) {
      // Unavailable on failure: proceeding on an unanswered check hands
      // someone a name that is taken.
      console.error('[Username] Availability check failed:', error);
      return false;
    }
  };

  const handleUsernameChange = async (value: string) => {
    // Normalize: lowercase, no spaces, alphanumeric + underscore + period
    const normalized = value.toLowerCase().replace(/\s/g, '');
    setUsernameInput(normalized);
    setUsernameAvailable(null);
    setError(undefined);

    if (!touched) return;

    const validation = validateUsername(normalized);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const available = await checkUsernameAvailability(normalized);
      setUsernameAvailable(available);
      if (!available) setError('This username is already taken');
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleBlur = async () => {
    handleInputBlurAnim();
    if (!username) return;

    setTouched(true);
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setIsCheckingUsername(true);
    try {
      const available = await checkUsernameAvailability(username);
      setUsernameAvailable(available);
      if (!available) {
        setError('This username is already taken');
      } else {
        setError(undefined);
      }
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleConfirm = async () => {
    setTouched(true);

    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    if (usernameAvailable === null) {
      setIsCheckingUsername(true);
      const available = await checkUsernameAvailability(username);
      setUsernameAvailable(available);
      setIsCheckingUsername(false);
      if (!available) {
        setError('This username is already taken');
        return;
      }
    } else if (usernameAvailable === false) {
      setError('This username is already taken');
      return;
    }

    setIsSubmitting(true);
    try {
      const formatted = formatUsername(username);
      await setUsername(formatted, false);
      handleBack();
    } catch (err) {
      console.error('[USERNAME] Failed to set username:', err);
      const code = (err as { code?: string })?.code ?? '';
      if (code.endsWith('already-exists')) {
        setUsernameAvailable(false);
        setError('This username is already taken.');
      } else if (code.endsWith('permission-denied')) {
        setError((err as { message?: string })?.message ?? 'Choosing a username is not available on your current plan.');
      } else {
        setError('Failed to save username. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = (): boolean => {
    const validation = validateUsername(username);
    return validation.isValid && usernameAvailable === true && !error;
  };

  const showSuccess = !isCheckingUsername && usernameAvailable === true && !error && touched;
  const showError = !isCheckingUsername && touched && !!error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Choose Your Username"
          onBack={handleBack}
          showSave={false}
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <AtSign size={28} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.title}>Choose your username</Text>
              <Text style={styles.subtitle}>
                Your username is your public business address on Platform. It cannot be changed after this.
              </Text>
            </View>

            {/* Reserved username notice */}
            {systemGeneratedUsername && (
              <View style={styles.infoCard}>
                <Info size={15} color={Colors.textSecondary} strokeWidth={2} style={styles.infoIcon} />
                <Text style={styles.infoText}>
                  Your previous system-generated username{' '}
                  <Text style={styles.infoUsername}>@{systemGeneratedUsername}</Text>
                  {' '}has been reserved and cannot be reused.
                </Text>
              </View>
            )}

            {/* Input section */}
            <View style={styles.form}>
              <Text style={styles.label}>Username</Text>
              <Animated.View
                style={[
                  styles.inputRow,
                  { borderColor: showError ? Colors.error : showSuccess ? Colors.success : borderColor },
                ]}
              >
                <Text style={styles.atPrefix}>@</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={handleUsernameChange}
                  onFocus={handleInputFocus}
                  onBlur={handleBlur}
                  placeholder="yourbusinessname"
                  placeholderTextColor={Colors.inputPlaceholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  editable={!isSubmitting}
                  autoFocus
                />
                {isCheckingUsername && (
                  <ActivityIndicator size="small" color={Colors.textMuted} style={styles.statusIcon} />
                )}
                {showSuccess && (
                  <CheckCircle2 size={18} color={Colors.success} style={styles.statusIcon} />
                )}
                {showError && (
                  <XCircle size={18} color={Colors.error} style={styles.statusIcon} />
                )}
              </Animated.View>

              {/* Feedback text */}
              {showError ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : showSuccess ? (
                <Text style={styles.successText}>Username is available</Text>
              ) : (
                <Text style={styles.helperText}>3 to 30 characters · letters, numbers, underscores</Text>
              )}

              {/* Rules card */}
              <View style={styles.rulesCard}>
                {[
                  'Lowercase letters, numbers, and underscores only',
                  'No spaces or special characters',
                  'Will appear as your public store link',
                ].map((rule, i) => (
                  <View key={i} style={[styles.ruleRow, i < 2 && styles.ruleRowDivider]}>
                    <View style={styles.ruleDot} />
                    <Text style={styles.ruleText}>{rule}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.confirmButton, (!isFormValid() || isSubmitting) && styles.confirmButtonDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.82}
            disabled={!isFormValid() || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={[styles.confirmButtonText, (!isFormValid()) && styles.confirmButtonTextDisabled]}>
                Confirm Username
              </Text>
            )}
          </TouchableOpacity>
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
  headerSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  // Header
  header: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    maxWidth: 300,
  },

  // Info card
  infoCard: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 24,
    alignItems: 'flex-start' as const,
  },
  infoIcon: {
    marginTop: 1,
    marginRight: 10,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  infoUsername: {
    fontWeight: '600' as const,
    color: Colors.text,
  },

  // Form
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  atPrefix: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    marginRight: 2,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: Colors.text,
    padding: 0,
    fontWeight: '500' as const,
  },
  statusIcon: {
    marginLeft: 8,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 7,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 7,
  },
  successText: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 7,
    fontWeight: '500' as const,
  },

  // Rules card
  rulesCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 20,
    overflow: 'hidden' as const,
  },
  ruleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  ruleRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  ruleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
    marginRight: 10,
    flexShrink: 0,
  },
  ruleText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.backgroundCanvas,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  confirmButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  confirmButtonDisabled: {
    backgroundColor: Colors.primaryDisabled,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    letterSpacing: 0.1,
  },
  confirmButtonTextDisabled: {
    color: 'rgba(255,255,255,0.6)',
  },
});
