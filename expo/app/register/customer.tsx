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
import { MapPin } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import LocationCascadeFields from '@/components/LocationCascadeFields';
import type { LocationValue } from '@/components/LocationCascadeFields';
import { useUserLocation } from '@/contexts/UserLocationContext';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type FieldErrors = Record<string, string | undefined>;

export default function CustomerSignupScreen() {
  const router = useRouter();
  const { checkAccountExists, registerAccount } = useAuth();
  const { setInitialCountry } = useUserLocation();

  const [firstName, setFirstName] = useState<string>('');
  const [lastInitial, setLastInitial] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [location, setLocation] = useState<LocationValue | null>(null);

  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const locationComplete =
    !!location && !!location.countryCode && !!location.stateCode && !!location.areaId;

  const isFormComplete =
    firstName.trim().length >= 2 &&
    lastInitial.trim().length >= 1 &&
    isEmail(email) &&
    password.length >= 8 &&
    locationComplete;

  const clearError = (key: string) => {
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
  };

  const handleSubmit = async () => {
    const newErrors: FieldErrors = {};
    if (firstName.trim().length < 2) newErrors.firstName = 'Enter your first name';
    if (lastInitial.trim().length < 1) newErrors.lastInitial = 'Enter your last initial';
    if (!isEmail(email)) newErrors.email = 'Enter a valid email';
    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (!location?.countryCode) newErrors.country = 'Select your country';
    else if (!location?.stateCode) newErrors.state = 'Select your state / province';
    else if (!location?.areaId) newErrors.area = 'Select your area';

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const trimmedEmail = email.trim();
      const check = await checkAccountExists(trimmedEmail);
      if (check.exists) {
        setErrors({ email: 'An account already exists with this email. Please log in.' });
        setIsLoading(false);
        return;
      }

      console.log('[AUTH FLOW] Creating customer account for', trimmedEmail);
      const response = await registerAccount({
        identifier: trimmedEmail,
        password,
        role: 'customer',
        firstName: firstName.trim(),
        lastName: lastInitial.trim().toUpperCase(),
        location: location!,
      });

      if (!response.success) {
        setErrors({ email: response.error || 'Something went wrong. Please try again.' });
        setIsLoading(false);
        return;
      }

      // Carry the location they just gave us into UserLocationContext. It only
      // ever read AsyncStorage, so without this a customer who had just picked
      // country, state and area on this form landed on the home screen and was
      // immediately asked to "Select your country" all over again.
      await setInitialCountry(
        location!.countryCode,
        location!.stateCode || undefined,
        undefined,
        location!.areaName || undefined,
      );

      console.log('[AUTH FLOW] Customer registration successful → customer onboarding');
      router.replace('/customer' as any);
    } catch (err) {
      console.error('[AUTH FLOW] Customer registration error:', err);
      setErrors({ email: 'Something went wrong. Please try again.' });
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
            <View style={styles.header}>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Shop from verified vendors near you</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={[styles.input, focusedField === 'firstName' && styles.inputFocused, errors.firstName ? styles.inputError : null]}
                  value={firstName}
                  onChangeText={(t) => { setFirstName(t); clearError('firstName'); }}
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Jane"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  editable={!isLoading}
                  testID="customer-firstname"
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>Last Initial</Text>
                <TextInput
                  style={[styles.input, focusedField === 'lastInitial' && styles.inputFocused, errors.lastInitial ? styles.inputError : null]}
                  value={lastInitial}
                  onChangeText={(t) => { setLastInitial(t.replace(/[^a-zA-Z]/g, '').slice(0, 1)); clearError('lastInitial'); }}
                  onFocus={() => setFocusedField('lastInitial')}
                  onBlur={() => setFocusedField('')}
                  placeholder="D"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={1}
                  editable={!isLoading}
                  testID="customer-lastinitial"
                />
                {errors.lastInitial ? <Text style={styles.errorText}>{errors.lastInitial}</Text> : null}
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={[styles.input, focusedField === 'email' && styles.inputFocused, errors.email ? styles.inputError : null]}
                value={email}
                onChangeText={(t) => { setEmail(t); clearError('email'); }}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField('')}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                editable={!isLoading}
                testID="customer-email"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={[styles.input, focusedField === 'password' && styles.inputFocused, errors.password ? styles.inputError : null]}
                value={password}
                onChangeText={(t) => { setPassword(t); clearError('password'); }}
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField('')}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                autoCapitalize="none"
                editable={!isLoading}
                testID="customer-password"
              />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <View style={styles.sectionHeaderRow}>
              <MapPin size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Location</Text>
            </View>

            <LocationCascadeFields
              value={location}
              onChange={setLocation}
              errors={{ country: errors.country, state: errors.state, area: errors.area }}
              onClearError={(key) => clearError(key)}
              disabled={isLoading}
              testIDPrefix="customer"
            />

            <TouchableOpacity
              style={[styles.primaryButton, (!isFormComplete || isLoading) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!isFormComplete || isLoading}
              testID="customer-create-account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Customer Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.bottomSection}>
              <Text style={styles.bottomText}>Already have an account? </Text>
              <TouchableOpacity activeOpacity={0.7} disabled={isLoading} onPress={() => router.replace('/login' as any)}>
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingVertical: 16 },
  content: { paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' as const },
  header: { marginBottom: 24, marginTop: 8 },
  title: { fontSize: 26, fontWeight: '700' as const, color: '#2B2B2B', marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  row: { flexDirection: 'row' as const, gap: 12 },
  rowItem: { flex: 1 },
  inputSection: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' as const, color: '#2B2B2B', marginBottom: 8, paddingHorizontal: 2 },
  input: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE',
  },
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFBF8' },
  inputError: { borderColor: '#DC2626' },
  sectionHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, marginBottom: 14 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700' as const, color: '#FF8C42', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  primaryButton: {
    backgroundColor: '#FF8C42', borderRadius: 14, height: 52, alignItems: 'center' as const,
    justifyContent: 'center' as const, marginTop: 8,
    shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  bottomSection: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 24 },
  bottomText: { fontSize: 15, color: '#6B7280' },
  bottomLink: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
});
