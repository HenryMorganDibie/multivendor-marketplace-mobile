import React, { useState, useEffect } from 'react';
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
import { Stack, useRouter } from 'expo-router';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react-native';
import { validateUsername, formatUsername } from '@/utils/usernameValidation';
import { mockVendors } from '@/mocks/vendorData';
import { useVendorPlan } from '@/contexts/VendorPlanContext';

export default function SelectUsernameScreen() {
  const router = useRouter();
  const { setUsername, systemGeneratedUsername, username: currentUsername, usernameSelectionPending } = useVendorPlan();
  const [username, setUsernameInput] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!usernameSelectionPending || (currentUsername && currentUsername !== systemGeneratedUsername)) {
      console.log('[USERNAME] Username already claimed or selection not pending, redirecting back');
      router.back();
    }
  }, [usernameSelectionPending, currentUsername, systemGeneratedUsername]);

  const checkUsernameAvailability = async (usernameToCheck: string): Promise<boolean> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const formatted = formatUsername(usernameToCheck);
    const exists = mockVendors.some(v => v.username.toLowerCase() === formatted);
    return !exists;
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

  const handleContinue = async () => {
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
      console.log('[USERNAME] Username selected:', formatted);
      router.back();
    } catch (error) {
      console.error('[USERNAME] Failed to set username:', error);
      setError('Failed to save username. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid = (): boolean => {
    const validation = validateUsername(username);
    return validation.isValid && usernameAvailable === true;
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen
        options={{
          title: 'Choose Your Username',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
          headerLeft: () => null,
          gestureEnabled: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Choose your username</Text>
              <Text style={styles.subtitle}>
                Your username is your public business address on the platform. This cannot be changed later.
              </Text>
            </View>

            {systemGeneratedUsername && (
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Your previous auto-generated username (@{systemGeneratedUsername}) has been reserved and cannot be reused.
                </Text>
              </View>
            )}

            <View style={styles.form}>
              <View style={styles.inputSection}>
                <Text style={styles.label}>Username</Text>
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
                    placeholder="yourbusinessname"
                    placeholderTextColor="#9CA3AF"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSubmitting}
                    autoFocus
                  />
                  {isCheckingUsername && (
                    <Loader2 size={20} color="#9CA3AF" style={styles.usernameStatusIcon} />
                  )}
                  {!isCheckingUsername && usernameAvailable === true && !error && (
                    <CheckCircle2 size={20} color="#10B981" style={styles.usernameStatusIcon} />
                  )}
                  {!isCheckingUsername && (usernameAvailable === false || error) && touched && (
                    <XCircle size={20} color="#FF6B6B" style={styles.usernameStatusIcon} />
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

              <TouchableOpacity
                style={[styles.continueButton, (!isFormValid() || isSubmitting) && styles.continueButtonDisabled]}
                onPress={handleContinue}
                activeOpacity={0.8}
                disabled={!isFormValid() || isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#0B0B0B" />
                ) : (
                  <Text style={styles.continueButtonText}>Confirm Username</Text>
                )}
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
    backgroundColor: '#0A0A0A',
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
    justifyContent: 'center' as const,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  infoBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  infoText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 21,
  },
  form: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  usernameInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#2C2C2E',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  usernamePrefix: {
    fontSize: 17,
    color: '#9CA3AF',
    marginRight: 4,
  },
  usernameInput: {
    flex: 1,
    fontSize: 17,
    color: '#FFFFFF',
    padding: 0,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  usernameStatusIcon: {
    marginLeft: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#FF6B6B',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  successText: {
    fontSize: 13,
    color: '#10B981',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  continueButton: {
    backgroundColor: '#0A84FF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
