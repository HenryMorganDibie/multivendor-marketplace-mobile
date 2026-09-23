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
  ActivityIndicator } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, XCircle, Loader2, AlertCircle, Lock, ChevronLeft } from 'lucide-react-native';
import { validateUsername, formatUsername } from '@/utils/usernameValidation';
import { mockVendors } from '@/mocks/vendorData';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendor } from '@/contexts/VendorContext';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import EditScreenHeader from '@/components/EditScreenHeader';
import { callable } from '@/lib/firebase';

export default function ChangeUsernameScreen() {
  const router = useRouter();
  const {
    setUsername,
    username: cachedUsername,
    plan,
    isPlanConfirmed,
    getUsernameChangeEligibility,
  } = useVendorPlan();
  const { vendor, isRealVendor } = useVendor();

  /**
   * The username on the vendor's actual Firestore document wins over
   * VendorPlanContext's copy — but only once that document has actually
   * arrived.
   *
   * VendorPlanContext generates and stores a system username in
   * AsyncStorage when it finds none locally, and never reads the real one
   * back from the vendor doc (documented technical debt: username state is
   * meant to move out of that context). The practical effect is that any
   * device which didn't itself perform the signup — a reinstall, a second
   * device, cleared storage — invents a fresh "@platform-XXXXX" and shows it
   * as the vendor's current username. Caught live: this screen offered to
   * change "@platform-DRK67" for a vendor whose real username was
   * "phaseaudit_vendor".
   *
   * isRealVendor matters here: reading vendor.username unconditionally just
   * trades that for the mock vendor's "@spicyrest" while the listener is
   * still in flight, which reads as even more plausible and is therefore
   * worse.
   */
  const currentUsername = isRealVendor ? vendor.username : cachedUsername;
  
  const [username, setUsernameInput] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const unsavedChanges = useUnsavedChanges(
    { username },
    false
  );

  const eligibility = getUsernameChangeEligibility(isRealVendor ? vendor.usernameChangeHistory : undefined);

  useEffect(() => {
    // Wait for the real backend-confirmed plan before judging — plan starts
    // as 'basic' before getSubscriptionStatus resolves, and firing this on
    // that default incorrectly showed "Upgrade Required" to Standard+/Pro
    // vendors for the moment before their real plan arrived.
    if (isPlanConfirmed && plan === 'basic') {
      Alert.alert(
        'Upgrade Required',
        'Username changes are available on Standard and above plans.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  }, [plan, isPlanConfirmed]);

  /**
   * Availability is decided by the server.
   *
   * This checked a fixture array after a fake 500ms delay, so a vendor could be
   * told a username was free when a real vendor already held it — and only find
   * out at the point of saving, if at all. A uniqueness check against data the
   * device happens to have is not a uniqueness check.
   *
   * The backend owns the reservation, so it is also the only place that can
   * answer without a race between two people typing the same name at once.
   */
  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    const formatted = formatUsername(usernameToCheck);

    if (formatted === formatUsername(currentUsername || '')) {
      return false;
    }

    try {
      const check = callable<{ username: string }, { success: true; available: boolean }>(
        'checkUsernameAvailability',
      );
      const res = await check({ username: formatted });
      return res.data.available;
    } catch (error) {
      // Treated as unavailable on failure. Letting someone proceed on an
      // unanswered check would hand them a name that is taken.
      console.error('[Username] Availability check failed:', error);
      return false;
    }
  };

  const handleUsernameChange = async (value: string) => {
    setUsernameInput(value);
    setUsernameAvailable(null);
    
    if (touched) {
      const validation = validateUsername(value);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }
      
      const formatted = formatUsername(value);
      if (formatted === formatUsername(currentUsername || '')) {
        setError('This is your current username');
        return;
      }
      
      setError(undefined);
      setIsCheckingUsername(true);
      
      try {
        const available = await checkUsernameAvailability(value);
        setUsernameAvailable(available);
        if (!available) {
          setError('This username is already taken');
        }
      } finally {
        setIsCheckingUsername(false);
      }
    }
  };

  const handleBlur = async () => {
    setTouched(true);
    
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }
    
    const formatted = formatUsername(username);
    if (formatted === formatUsername(currentUsername || '')) {
      setError('This is your current username');
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
    if (!eligibility.canChange) {
      return;
    }

    setTouched(true);
    
    const validation = validateUsername(username);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    const formatted = formatUsername(username);
    if (formatted === formatUsername(currentUsername || '')) {
      setError('This is your current username');
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

    Alert.alert(
      'Confirm Username Change',
      `Change your username from @${currentUsername} to @${formatted}?\n\nYou can change your username once every 90 days or twice per year.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            setIsSubmitting(true);
            try {
              await setUsername(formatted, false);
              Alert.alert(
                'Username Changed',
                `Your username has been changed to @${formatted}`,
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              console.error('[USERNAME] Failed to change username:', error);
              const code = (error as { code?: string })?.code ?? '';
              if (code.endsWith('already-exists')) {
                setUsernameAvailable(false);
                setError('This username is already taken.');
              } else if (code.endsWith('permission-denied')) {
                setError((error as { message?: string })?.message ?? 'Username changes are not available on your current plan.');
              } else if (code.endsWith('failed-precondition')) {
                setError((error as { message?: string })?.message ?? 'You cannot change your username right now.');
              } else {
                setError('Failed to change username. Please try again.');
              }
              setIsSubmitting(false);
            }
          },
        },
      ]
    );
  };

  const isFormValid = (): boolean => {
    const validation = validateUsername(username);
    return validation.isValid && usernameAvailable === true && eligibility.canChange;
  };

  const getEligibilityMessage = () => {
    if (eligibility.reason === 'upgrade_required') {
      return 'Username changes require Standard or above plan';
    }
    if (eligibility.reason === 'cooldown_active') {
      return `Next change available in ${eligibility.daysUntilNext} days`;
    }
    if (eligibility.reason === 'yearly_limit_reached') {
      return `You've used both changes this year. Next change available in ${eligibility.daysUntilNext} days`;
    }
    return `You can change this once every 90 days (${eligibility.changesThisYear}/2 changes this year)`;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Change Username" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.currentUsernameCard}>
              <Text style={styles.currentUsernameLabel}>Current Username</Text>
              <Text style={styles.currentUsername}>@{currentUsername}</Text>
            </View>

            <View style={[
              styles.eligibilityCard,
              !eligibility.canChange && styles.eligibilityCardLocked
            ]}>
              <View style={styles.eligibilityHeader}>
                {eligibility.canChange ? (
                  <CheckCircle2 size={20} color={Colors.success} />
                ) : (
                  <Lock size={20} color={Colors.error} />
                )}
                <Text style={[
                  styles.eligibilityStatus,
                  eligibility.canChange ? styles.eligibilityStatusActive : styles.eligibilityStatusLocked
                ]}>
                  {eligibility.canChange ? 'Change Available' : 'Change Locked'}
                </Text>
              </View>
              <Text style={styles.eligibilityMessage}>
                {getEligibilityMessage()}
              </Text>
            </View>

            {eligibility.canChange && (
              <View style={styles.form}>
                <View style={styles.inputSection}>
                  <Text style={styles.label}>New Username</Text>
                  <View style={styles.usernameInputContainer}>
                    <Text style={styles.usernamePrefix}>@</Text>
                    <TextInput
                      style={[
                        styles.usernameInput,
                        touched && error ? styles.inputError : null,
                      ]}
                      value={username}
                      onChangeText={handleUsernameChange}
                      onBlur={handleBlur}
                      placeholder="newusername"
                      placeholderTextColor={Colors.textMuted}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isSubmitting}
                      autoFocus
                    />
                    {isCheckingUsername && (
                      <Loader2 size={20} color={Colors.textMuted} style={styles.usernameStatusIcon} />
                    )}
                    {!isCheckingUsername && usernameAvailable === true && !error && (
                      <CheckCircle2 size={20} color={Colors.success} style={styles.usernameStatusIcon} />
                    )}
                    {!isCheckingUsername && (usernameAvailable === false || error) && touched && (
                      <XCircle size={20} color={Colors.error} style={styles.usernameStatusIcon} />
                    )}
                  </View>
                  {touched && error ? (
                    <Text style={styles.errorText}>{error}</Text>
                  ) : usernameAvailable === true && !error ? (
                    <Text style={styles.successText}>Username is available</Text>
                  ) : (
                    <Text style={styles.helperText}>
                      3-30 characters, alphanumeric and underscores only
                    </Text>
                  )}
                </View>

                <View style={styles.warningCard}>
                  <AlertCircle size={18} color={Colors.primary} />
                  <Text style={styles.warningText}>
                    Username changes are permanent. Your old username cannot be recovered.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.confirmButton, (!isFormValid() || isSubmitting) && styles.confirmButtonDisabled]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                  disabled={!isFormValid() || isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={Colors.text} />
                  ) : (
                    <Text style={styles.confirmButtonText}>Confirm Change</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {!eligibility.canChange && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <ChevronLeft size={20} color={Colors.text} />
                <Text style={styles.backButtonText}>Go Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
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
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  currentUsernameCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  currentUsernameLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  currentUsername: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  eligibilityCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  eligibilityCardLocked: {
    borderColor: Colors.error,
  },
  eligibilityHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  eligibilityStatus: {
    fontSize: 15,
    fontWeight: '600' as const,
    marginLeft: 8,
  },
  eligibilityStatusActive: {
    color: Colors.success,
  },
  eligibilityStatusLocked: {
    color: Colors.error,
  },
  eligibilityMessage: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  usernameInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  usernamePrefix: {
    fontSize: 17,
    color: Colors.textMuted,
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    fontSize: 17,
    color: Colors.text,
    padding: 0,
  },
  inputError: {
    borderColor: Colors.error,
  },
  usernameStatusIcon: {
    marginLeft: 8,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  successText: {
    fontSize: 13,
    color: Colors.success,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  warningCard: {
    flexDirection: 'row' as const,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 19,
    marginLeft: 10,
  },
  confirmButton: {
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  confirmButtonDisabled: {
    opacity: 0.4,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  backButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 6,
    marginTop: 16,
  },
  backButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
