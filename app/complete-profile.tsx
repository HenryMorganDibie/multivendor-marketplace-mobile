import React, { useState, useRef, useEffect } from 'react';
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
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { User, Shield } from 'lucide-react-native';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { updateUserProfile } = useAuth();

  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [firstNameError, setFirstNameError] = useState('');
  const [firstNameFocused, setFirstNameFocused] = useState(false);
  const [lastInitialFocused, setLastInitialFocused] = useState(false);

  const avatarScale = useRef(new Animated.Value(0.8)).current;
  const avatarOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(30)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(avatarScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(avatarOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.timing(formTranslateY, {
        toValue: 0,
        duration: 500,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [avatarScale, avatarOpacity, formOpacity, formTranslateY]);

  const displayPreview = firstName.trim()
    ? lastInitial.trim()
      ? `${firstName.trim()} ${lastInitial.trim().toUpperCase()}.`
      : firstName.trim()
    : null;

  const avatarLetter = firstName.trim().charAt(0).toUpperCase() || '?';

  const handleContinue = async () => {
    const trimmed = firstName.trim();
    if (!trimmed) {
      setFirstNameError('Please enter your first name');
      return;
    }
    if (trimmed.length < 2) {
      setFirstNameError('Name must be at least 2 characters');
      return;
    }

    setIsLoading(true);
    console.log('[COMPLETE PROFILE] Saving firstName:', trimmed, 'lastInitial:', lastInitial.trim());

    try {
      await updateUserProfile({
        firstName: trimmed,
        lastName: lastInitial.trim().toUpperCase() || undefined,
      });

      console.log('[COMPLETE PROFILE] Profile saved → redirecting to /customer');
      router.replace('/customer' as any);
    } catch (err) {
      console.error('[COMPLETE PROFILE] Error saving profile:', err);
      setFirstNameError('Something went wrong. Please try again.');
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animated.View
              style={[
                styles.avatarWrapper,
                { transform: [{ scale: avatarScale }], opacity: avatarOpacity },
              ]}
            >
              <View style={styles.avatarOuter}>
                <View style={styles.avatarInner}>
                  {firstName.trim() ? (
                    <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                  ) : (
                    <User size={36} color="#FF8C42" strokeWidth={1.5} />
                  )}
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.formSection,
                { opacity: formOpacity, transform: [{ translateY: formTranslateY }] },
              ]}
            >
              <View style={styles.header}>
                <Text style={styles.title}>What's your name?</Text>
                <Text style={styles.subtitle}>
                  This is the name vendors will see when you message or place an order.
                </Text>
              </View>

              <View style={styles.form}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <TextInput
                    style={[
                      styles.input,
                      firstNameFocused && styles.inputFocused,
                      firstNameError ? styles.inputError : null,
                    ]}
                    value={firstName}
                    onChangeText={(text) => {
                      setFirstName(text);
                      if (firstNameError) setFirstNameError('');
                    }}
                    onFocus={() => setFirstNameFocused(true)}
                    onBlur={() => setFirstNameFocused(false)}
                    placeholder="e.g. Jane"
                    placeholderTextColor="#BFBFBF"
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus
                    editable={!isLoading}
                    testID="complete-profile-first-name"
                  />
                  {firstNameError ? (
                    <Text style={styles.errorText}>{firstNameError}</Text>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Last Initial</Text>
                    <Text style={styles.optionalBadge}>Optional</Text>
                  </View>
                  <TextInput
                    style={[
                      styles.input,
                      lastInitialFocused && styles.inputFocused,
                    ]}
                    value={lastInitial}
                    onChangeText={(text) => setLastInitial(text.replace(/[^a-zA-Z]/g, '').slice(0, 1))}
                    onFocus={() => setLastInitialFocused(true)}
                    onBlur={() => setLastInitialFocused(false)}
                    placeholder="e.g. D"
                    placeholderTextColor="#BFBFBF"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={1}
                    editable={!isLoading}
                    testID="complete-profile-last-initial"
                  />
                </View>

                {displayPreview ? (
                  <View style={styles.previewSection}>
                    <Text style={styles.previewHint}>This is how vendors will see your name:</Text>
                    <Text style={styles.previewName}>{displayPreview}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.continueButton,
                    (!firstName.trim() || isLoading) && styles.continueButtonDisabled,
                  ]}
                  onPress={handleContinue}
                  activeOpacity={0.85}
                  disabled={!firstName.trim() || isLoading}
                  testID="complete-profile-continue"
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.continueButtonText}>Continue</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={styles.privacyRow}>
                <Shield size={14} color="#B0B0B0" strokeWidth={1.8} />
                <Text style={styles.privacyNote}>
                  Your full name is never shared.
                </Text>
              </View>
            </Animated.View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FEFEFE',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
  },
  content: {
    paddingHorizontal: 28,
    paddingVertical: 40,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
    alignItems: 'center' as const,
  },
  avatarWrapper: {
    marginBottom: 28,
  },
  avatarOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF7F2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: '#FFE0C9',
  },
  avatarInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FF8C42',
  },
  formSection: {
    width: '100%',
  },
  header: {
    marginBottom: 32,
    alignItems: 'center' as const,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#8A8A8A',
    textAlign: 'center' as const,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 22,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#555555',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  optionalBadge: {
    fontSize: 11,
    color: '#AAAAAA',
    fontWeight: '500' as const,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  inputFocused: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFFBF8',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  previewSection: {
    marginBottom: 28,
    paddingTop: 4,
  },
  previewHint: {
    fontSize: 13,
    color: '#A0A0A0',
    marginBottom: 6,
  },
  previewName: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  continueButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 0,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.3)',
    shadowOpacity: 0,
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  privacyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 20,
    gap: 6,
  },
  privacyNote: {
    fontSize: 13,
    color: '#B0B0B0',
    textAlign: 'center' as const,
    lineHeight: 18,
  },
});
