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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronDown, Search, Check, MapPin, Store, UserCircle, TicketCheck } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import LocationCascadeFields from '@/components/LocationCascadeFields';
import type { LocationValue } from '@/components/LocationCascadeFields';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhone(value: string): boolean {
  return /^[+]?[\d\s()-]{7,}$/.test(value.trim());
}

const CATEGORIES = DAY_ONE_CATEGORIES.map((name) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  name,
}));

type FieldErrors = Record<string, string | undefined>;

type AcquisitionSource = 'field_sales' | 'vendor_referral' | 'organic';

type ReferralValidationStatus = 'idle' | 'pending' | 'valid' | 'invalid';

interface ReferralValidationResult {
  valid: boolean;
  repId?: string;
  repName?: string;
  assignedCountry?: string;
  assignedState?: string;
  assignedArea?: string;
  status?: 'active' | 'inactive';
  acquisitionSource?: Exclude<AcquisitionSource, 'organic'>;
}

interface ReferralValidationState extends Omit<ReferralValidationResult, 'status'> {
  validationStatus: ReferralValidationStatus;
  referralStatus?: 'active' | 'inactive';
  error?: string;
}

function normalizeReferralCode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '');
}

function isReferralCodeFormatValid(value: string): boolean {
  return /^[A-Z0-9](?:[A-Z0-9-]{1,18}[A-Z0-9])$/.test(value) && !value.includes('--');
}

async function validateReferralCode(code: string): Promise<ReferralValidationResult> {
  await new Promise(resolve => setTimeout(resolve, 650));

  const mockReferralCodes: Record<string, ReferralValidationResult> = {
    'THE PLATFORM-LAGOS': {
      valid: true,
      repId: 'rep_lagos_001',
      repName: 'the platform Lagos Field Team',
      assignedCountry: 'Nigeria',
      assignedState: 'Lagos',
      assignedArea: 'Lagos',
      status: 'active',
      acquisitionSource: 'field_sales',
    },
    'FIELD-LAGOS': {
      valid: true,
      repId: 'rep_lagos_002',
      repName: 'Lagos Field Sales',
      assignedCountry: 'Nigeria',
      assignedState: 'Lagos',
      assignedArea: 'Ikeja',
      status: 'active',
      acquisitionSource: 'field_sales',
    },
    'VN7K2M9P': {
      valid: true,
      repId: 'vendor_ref_vn7k2m9p',
      repName: 'Vendor referral',
      assignedCountry: 'Nigeria',
      assignedState: 'Lagos',
      assignedArea: 'Lekki',
      status: 'active',
      acquisitionSource: 'vendor_referral',
    },
    'VENDOR-LAGOS': {
      valid: true,
      repId: 'vendor_ref_lagos',
      repName: 'Vendor referral',
      assignedCountry: 'Nigeria',
      assignedState: 'Lagos',
      assignedArea: 'Lagos',
      status: 'active',
      acquisitionSource: 'vendor_referral',
    },
  };

  return mockReferralCodes[code] ?? { valid: false, status: 'inactive' };
}

export default function VendorSignupScreen() {
  const router = useRouter();
  const { checkAccountExists, registerAccount } = useAuth();

  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');

  const [businessName, setBusinessName] = useState<string>('');
  const [businessDescription, setBusinessDescription] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);

  const [location, setLocation] = useState<LocationValue | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralValidation, setReferralValidation] = useState<ReferralValidationState>({
    valid: false,
    validationStatus: 'idle',
  });

  const [showCategoryModal, setShowCategoryModal] = useState<boolean>(false);
  const [categorySearch, setCategorySearch] = useState<string>('');

  const [focusedField, setFocusedField] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const filteredCategories = categorySearch.trim()
    ? CATEGORIES.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : CATEGORIES;

  const locationComplete =
    !!location && !!location.countryCode && !!location.stateCode && !!location.areaId;

  const isFormComplete =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 1 &&
    isEmail(email) &&
    isPhone(phone) &&
    password.length >= 8 &&
    businessName.trim().length >= 2 &&
    !!selectedCategory &&
    businessDescription.trim().length >= 1 &&
    locationComplete;

  const clearError = (key: string) => {
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }));
  };

  const runReferralValidation = async (code: string): Promise<ReferralValidationResult | null> => {
    const normalizedCode = normalizeReferralCode(code);
    if (!normalizedCode) {
      setReferralValidation({ valid: false, validationStatus: 'idle' });
      clearError('referralCode');
      return null;
    }

    if (!isReferralCodeFormatValid(normalizedCode)) {
      const error = 'Use 3–20 letters/numbers. Hyphen is allowed.';
      setReferralValidation({ valid: false, validationStatus: 'invalid', error });
      setErrors(p => ({ ...p, referralCode: error }));
      return { valid: false, status: 'inactive' };
    }

    setReferralValidation({ valid: false, validationStatus: 'pending' });
    const result = await validateReferralCode(normalizedCode);

    if (!result.valid || result.status !== 'active') {
      const error = 'Invalid or inactive referral code';
      setReferralValidation({
        ...result,
        valid: false,
        validationStatus: 'invalid',
        referralStatus: result.status,
        error,
      });
      setErrors(p => ({ ...p, referralCode: error }));
      return result;
    }

    setReferralValidation({
      ...result,
      valid: true,
      validationStatus: 'valid',
      referralStatus: result.status,
    });
    setErrors(p => ({ ...p, referralCode: undefined }));
    return result;
  };

  const handleReferralChange = (value: string) => {
    const normalizedCode = normalizeReferralCode(value);
    setReferralCode(normalizedCode);
    if (!normalizedCode) {
      setReferralValidation({ valid: false, validationStatus: 'idle' });
      clearError('referralCode');
      return;
    }

    if (!isReferralCodeFormatValid(normalizedCode)) {
      setReferralValidation({
        valid: false,
        validationStatus: 'invalid',
        error: 'Use 3–20 letters/numbers. Hyphen is allowed.',
      });
      clearError('referralCode');
      return;
    }

    setReferralValidation({ valid: false, validationStatus: 'idle' });
    clearError('referralCode');
  };

  const handleSubmit = async () => {
    const newErrors: FieldErrors = {};
    if (firstName.trim().length < 2) newErrors.firstName = 'Enter your first name';
    if (lastName.trim().length < 1) newErrors.lastName = 'Enter your last name';
    if (!isEmail(email)) newErrors.email = 'Enter a valid email';
    if (!isPhone(phone)) newErrors.phone = 'Enter a valid phone number';
    if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    if (businessName.trim().length < 2) newErrors.businessName = 'Enter your business name';
    if (!selectedCategory) newErrors.category = 'Select a business category';
    if (businessDescription.trim().length < 1) newErrors.businessDescription = 'Add a short business description';
    if (!location?.countryCode) newErrors.country = 'Select your country';
    else if (!location?.stateCode) newErrors.state = 'Select your state / province';
    else if (!location?.areaId) newErrors.area = 'Select your area';

    const normalizedReferralCode = normalizeReferralCode(referralCode);
    if (normalizedReferralCode && !isReferralCodeFormatValid(normalizedReferralCode)) {
      newErrors.referralCode = 'Use 3–20 letters/numbers. Hyphen is allowed.';
    }

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const trimmedEmail = email.trim();
      const validatedReferral = normalizedReferralCode
        ? await runReferralValidation(normalizedReferralCode)
        : null;

      if (normalizedReferralCode && (!validatedReferral?.valid || validatedReferral.status !== 'active')) {
        setIsLoading(false);
        return;
      }

      const check = await checkAccountExists(trimmedEmail);
      if (check.exists) {
        setErrors({ email: 'An account already exists with this email. Please log in.' });
        setIsLoading(false);
        return;
      }

      console.log('[AUTH FLOW] Creating vendor account for', trimmedEmail);
      const response = await registerAccount({
        identifier: trimmedEmail,
        password,
        role: 'vendor',
        plan: 'basic',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        businessName: businessName.trim(),
        businessDescription: businessDescription.trim(),
        categoryId: selectedCategory?.id,
        categoryName: selectedCategory?.name,
        location: location!,
        referralCode: normalizedReferralCode || undefined,
        acquisitionSource: validatedReferral?.valid
          ? (validatedReferral.acquisitionSource ?? 'field_sales')
          : 'organic',
        signupChannel: 'mobile_vendor_app',
        country: location!.countryName,
        state: location!.stateName,
        area: location!.areaName,
        createdAt: new Date().toISOString(),
        referralRepId: validatedReferral?.repId,
        referralRepName: validatedReferral?.repName,
        referralAssignedCountry: validatedReferral?.assignedCountry,
        referralAssignedState: validatedReferral?.assignedState,
        referralAssignedArea: validatedReferral?.assignedArea,
        referralStatus: validatedReferral?.status,
        isDiscoverable: false,
      });

      if (!response.success) {
        setErrors({ email: response.error || 'Something went wrong. Please try again.' });
        setIsLoading(false);
        return;
      }

      console.log('[AUTH FLOW] Vendor registration successful → vendor dashboard');
      router.replace('/vendor/(tabs)/dashboard' as any);
    } catch (err) {
      console.error('[AUTH FLOW] Vendor registration error:', err);
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
              <Text style={styles.title}>Create your vendor account</Text>
              <Text style={styles.subtitle}>Start selling on the platform in minutes</Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <UserCircle size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Owner Information</Text>
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
                  testID="vendor-firstname"
                />
                {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.inputSection, styles.rowItem]}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={[styles.input, focusedField === 'lastName' && styles.inputFocused, errors.lastName ? styles.inputError : null]}
                  value={lastName}
                  onChangeText={(t) => { setLastName(t); clearError('lastName'); }}
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Doe"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  editable={!isLoading}
                  testID="vendor-lastname"
                />
                {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}
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
                testID="vendor-email"
              />
              {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={[styles.input, focusedField === 'phone' && styles.inputFocused, errors.phone ? styles.inputError : null]}
                value={phone}
                onChangeText={(t) => { setPhone(t); clearError('phone'); }}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField('')}
                placeholder="+234 800 000 0000"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                editable={!isLoading}
                testID="vendor-phone"
              />
              {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
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
                testID="vendor-password"
              />
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Store size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Business Information</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Business Name</Text>
              <TextInput
                style={[styles.input, focusedField === 'businessName' && styles.inputFocused, errors.businessName ? styles.inputError : null]}
                value={businessName}
                onChangeText={(t) => { setBusinessName(t); clearError('businessName'); }}
                onFocus={() => setFocusedField('businessName')}
                onBlur={() => setFocusedField('')}
                placeholder="e.g. Amina's Kitchen"
                placeholderTextColor="#9CA3AF"
                editable={!isLoading}
                testID="vendor-business-name"
              />
              {errors.businessName ? <Text style={styles.errorText}>{errors.businessName}</Text> : null}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Business Category</Text>
              <TouchableOpacity
                style={[styles.selectorButton, errors.category ? styles.inputError : null]}
                onPress={() => setShowCategoryModal(true)}
                activeOpacity={0.7}
                disabled={isLoading}
                testID="vendor-category"
              >
                <Text style={[styles.selectorText, !selectedCategory && styles.selectorPlaceholder]}>
                  {selectedCategory?.name || 'Select business category'}
                </Text>
                <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
              </TouchableOpacity>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Business Description</Text>
              <TextInput
                style={[styles.textArea, focusedField === 'businessDescription' && styles.inputFocused, errors.businessDescription ? styles.inputError : null]}
                value={businessDescription}
                onChangeText={(t) => { setBusinessDescription(t); clearError('businessDescription'); }}
                onFocus={() => setFocusedField('businessDescription')}
                onBlur={() => setFocusedField('')}
                placeholder="Tell customers what you offer and your specialties"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={300}
                editable={!isLoading}
                testID="vendor-business-description"
              />
              {errors.businessDescription ? <Text style={styles.errorText}>{errors.businessDescription}</Text> : null}
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
              testIDPrefix="vendor"
            />

            <View style={styles.sectionHeaderRow}>
              <TicketCheck size={16} color="#FF8C42" strokeWidth={2} />
              <Text style={styles.sectionHeaderText}>Referral</Text>
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.label}>Referral Code</Text>
              <TextInput
                style={[
                  styles.input,
                  focusedField === 'referralCode' && styles.inputFocused,
                  errors.referralCode || referralValidation.validationStatus === 'invalid' ? styles.inputError : null,
                  referralValidation.validationStatus === 'valid' ? styles.inputSuccess : null,
                ]}
                value={referralCode}
                onChangeText={handleReferralChange}
                onFocus={() => setFocusedField('referralCode')}
                onBlur={() => {
                  setFocusedField('');
                  void runReferralValidation(referralCode);
                }}
                placeholder="Enter referral code, if you have one"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!isLoading && referralValidation.validationStatus !== 'pending'}
                testID="vendor-referral-code"
              />
              <Text style={styles.helperText}>Optional — enter the code from a the platform field rep. Or another vendor.</Text>
              {referralValidation.validationStatus === 'pending' ? (
                <View style={styles.validationRow}>
                  <ActivityIndicator color="#FF8C42" size="small" />
                  <Text style={styles.pendingText}>Checking referral code…</Text>
                </View>
              ) : null}
              {referralValidation.validationStatus === 'valid' ? <Text style={styles.successText}>Referral code applied</Text> : null}
              {errors.referralCode || referralValidation.validationStatus === 'invalid' ? (
                <Text style={styles.errorText}>{errors.referralCode ?? referralValidation.error ?? 'Invalid or inactive referral code'}</Text>
              ) : null}
            </View>

            <View style={styles.planNote}>
              <Text style={styles.planNoteText}>
                New vendors start on the Basic plan. Your storefront link works right away, and you can verify your business later to appear in Home, Search, and Explore.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, (!isFormComplete || isLoading) && styles.primaryButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={!isFormComplete || isLoading}
              testID="vendor-create-account"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Create Vendor Account</Text>
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

      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Business Category</Text>
              <TouchableOpacity onPress={() => { setShowCategoryModal(false); setCategorySearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Search size={18} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredCategories}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, selectedCategory?.id === item.id && styles.modalItemSelected]}
                  onPress={() => {
                    setSelectedCategory({ id: item.id, name: item.name });
                    setShowCategoryModal(false);
                    setCategorySearch('');
                    clearError('category');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.modalItemText, selectedCategory?.id === item.id && styles.modalItemTextSelected]}>{item.name}</Text>
                  {selectedCategory?.id === item.id && <Check size={18} color="#FF8C42" strokeWidth={2.5} />}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { flexGrow: 1, paddingVertical: 16 },
  content: { paddingHorizontal: 24, maxWidth: 480, width: '100%', alignSelf: 'center' as const },
  header: { marginBottom: 20, marginTop: 8 },
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
  textArea: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16,
    fontSize: 16, color: '#2B2B2B', borderWidth: 1, borderColor: '#EEEEEE', minHeight: 100,
  },
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFBF8' },
  inputError: { borderColor: '#DC2626' },
  inputSuccess: { borderColor: '#16A34A', backgroundColor: '#F0FDF4' },
  selectorButton: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  selectorText: { fontSize: 16, color: '#2B2B2B' },
  selectorPlaceholder: { color: '#9CA3AF', fontSize: 16 },
  sectionHeaderRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8, marginBottom: 14 },
  sectionHeaderText: { fontSize: 13, fontWeight: '700' as const, color: '#FF8C42', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  helperText: { fontSize: 12, color: '#6B7280', lineHeight: 17, marginTop: 6, paddingHorizontal: 4 },
  validationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginTop: 8, paddingHorizontal: 4 },
  pendingText: { fontSize: 13, color: '#9A3412' },
  successText: { fontSize: 13, color: '#16A34A', marginTop: 6, paddingHorizontal: 4, fontWeight: '600' as const },
  planNote: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#FED7AA' },
  planNoteText: { fontSize: 13, color: '#9A3412', lineHeight: 19 },
  primaryButton: {
    backgroundColor: '#FF8C42', borderRadius: 14, height: 52, alignItems: 'center' as const,
    justifyContent: 'center' as const, marginTop: 4,
    shadowColor: '#FF8C42', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  primaryButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)', shadowOpacity: 0, elevation: 0 },
  primaryButtonText: { fontSize: 16, fontWeight: '600' as const, color: '#FFFFFF' },
  bottomSection: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 24 },
  bottomText: { fontSize: 15, color: '#6B7280' },
  bottomLink: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' as const },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 8 },
  modalHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: '#2B2B2B' },
  modalClose: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  searchContainer: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#2B2B2B' },
  modalList: { paddingHorizontal: 12, paddingBottom: 32 },
  modalItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  modalItemSelected: { backgroundColor: 'rgba(255,140,66,0.08)' },
  modalItemText: { fontSize: 16, color: '#2B2B2B' },
  modalItemTextSelected: { color: '#FF8C42', fontWeight: '600' as const },
});
