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
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { ChevronLeft, ChevronDown, Search, Check, MapPin, Store, UserCircle, Square, CheckSquare, Info } from 'lucide-react-native';
import { getAreasByRegion } from '@/constants/areas';
import type { AreaInfo } from '@/constants/areas';
import { COUNTRIES } from '@/constants/countries';
import type { CountryInfo } from '@/constants/countries';
import { getStatesByCountry, getStateLabel } from '@/constants/states';
import type { StateInfo } from '@/constants/states';
import { useAuth } from '@/contexts/AuthContext';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';

const PENDING_VENDOR_REG_KEY = '@the platform_pending_vendor_reg';

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

type Step = 'account' | 'business' | 'location';

const CATEGORIES = DAY_ONE_CATEGORIES.map((name, index) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  name,
  sortOrder: index,
}));

export default function VendorRegisterScreen() {
  const router = useRouter();
  const { checkAccountExists, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('account');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [businessName, setBusinessName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<{ id: string; name: string } | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');

  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(null);
  const [selectedState, setSelectedState] = useState<StateInfo | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaInfo | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [businessFocused, setBusinessFocused] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToResponsibility, setAgreedToResponsibility] = useState(false);

  const countryStatus = useCountryStatus();

  useEffect(() => {
    if (countryStatus.isComingSoon) {
      console.log('[VENDOR_REGISTER] Country is COMING_SOON, redirecting');
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
      console.log('[AUTH GUARD] User already authenticated, redirecting from vendor registration');
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router, countryStatus.isComingSoon, countryStatus.countryName, countryStatus.launchTimeline]);

  if (authLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2B2B2B" />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const currentStepIndex = step === 'account' ? 0 : step === 'business' ? 1 : 2;
  const totalSteps = 3;

  const availableStates = selectedCountry ? getStatesByCountry(selectedCountry.code) : [];
  const stateLabel = selectedCountry ? getStateLabel(selectedCountry.code) : 'State / Region';
  const availableAreas = selectedState ? getAreasByRegion(selectedState.regionId) : [];
  const hasAreas = availableAreas.length > 0;

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const filteredStates = stateSearch.trim()
    ? availableStates.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()))
    : availableStates;

  const filteredAreas = areaSearch.trim()
    ? availableAreas.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase()))
    : availableAreas;

  const filteredCategories = categorySearch.trim()
    ? CATEGORIES.filter(c => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
    : CATEGORIES;

  const handleBack = () => {
    if (step === 'location') {
      setStep('business');
      setErrors({});
    } else if (step === 'business') {
      setStep('account');
      setErrors({});
    } else {
      router.back();
    }
  };

  const accountContinueEnabled = agreedToTerms && agreedToResponsibility;

  const handleAccountContinue = () => {
    const newErrors: Record<string, string | undefined> = {};

    const trimmedName = fullName.trim();
    if (!trimmedName) newErrors.fullName = 'Full name is required';
    else if (trimmedName.length < 2) newErrors.fullName = 'Name must be at least 2 characters';

    const trimmedEmail = email.trim();
    if (!trimmedEmail) newErrors.email = 'Email is required';
    else if (!isEmail(trimmedEmail)) newErrors.email = 'Please enter a valid email';

    if (!password) newErrors.password = 'Password is required';
    else if (password.length < 8) newErrors.password = 'Password must be at least 8 characters';

    if (!agreedToTerms) newErrors.terms = 'You must agree to continue';
    if (!agreedToResponsibility) newErrors.responsibility = 'You must agree to continue';

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    console.log('[VENDOR_REGISTER] Account step complete, moving to business');
    setStep('business');
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.log('[VENDOR_REGISTER] Failed to open link:', err));
  };

  const handleBusinessContinue = () => {
    const newErrors: Record<string, string | undefined> = {};

    const trimmedBusiness = businessName.trim();
    if (!trimmedBusiness) newErrors.businessName = 'Business name is required';
    else if (trimmedBusiness.length < 2) newErrors.businessName = 'Business name must be at least 2 characters';

    if (!selectedCategory) newErrors.category = 'Please select a business category';

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    console.log('[VENDOR_REGISTER] Business step complete, moving to location');
    setStep('location');
  };

  const handleLocationContinue = async () => {
    const newErrors: Record<string, string | undefined> = {};

    if (!selectedCountry) newErrors.country = 'Please select your country';
    if (!selectedState) newErrors.state = `Please select your ${stateLabel.toLowerCase()}`;
    if (!selectedArea) newErrors.area = 'Please select your area/city';

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);

    try {
      const trimmedEmail = email.trim();
      console.log('[AUTH FLOW] Vendor registration: checking if account exists');
      const check = await checkAccountExists(trimmedEmail);

      if (check.exists) {
        console.log('[AUTH FLOW] Account already exists with role:', check.role);
        setStep('account');
        setErrors({ email: 'An account already exists with this email. Please log in.' });
        setIsLoading(false);
        return;
      }

      const pendingData = {
        fullName: fullName.trim(),
        email: trimmedEmail,
        password,
        businessName: businessName.trim(),
        categoryId: selectedCategory?.id || '',
        categoryName: selectedCategory?.name || '',
        countryCode: selectedCountry?.code ?? '',
        country: selectedCountry?.name ?? '',
        state: selectedState?.name ?? '',
        area: selectedArea?.name ?? '',
      };

      await AsyncStorage.setItem(PENDING_VENDOR_REG_KEY, JSON.stringify(pendingData));
      console.log('[AUTH FLOW] Stored pending vendor registration data');

      const maskedContact = maskEmail(trimmedEmail);

      router.push({
        pathname: '/verify-otp',
        params: {
          contact: trimmedEmail,
          maskedContact,
          context: 'vendor-registration',
          password,
          businessName: businessName.trim(),
        },
      });
    } catch {
      setErrors({ area: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepBar}>
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View key={i} style={styles.stepBarItemWrap}>
          <View
            style={[
              styles.stepBarSegment,
              i <= currentStepIndex ? styles.stepBarSegmentActive : null,
            ]}
          />
        </View>
      ))}
    </View>
  );

  const renderCategoryModal = () => (
    <Modal visible={showCategoryModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Business Category</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCategoryModal(false);
                setCategorySearch('');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={categorySearch}
              onChangeText={setCategorySearch}
              placeholder="Search categories"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filteredCategories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  selectedCategory?.id === item.id && styles.modalItemSelected,
                ]}
                onPress={() => {
                  setSelectedCategory({ id: item.id, name: item.name });
                  setShowCategoryModal(false);
                  setCategorySearch('');
                  if (errors.category) setErrors(p => ({ ...p, category: undefined }));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedCategory?.id === item.id && styles.modalItemTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
                {selectedCategory?.id === item.id && (
                  <Check size={18} color="#FF8C42" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalList}
          />
        </View>
      </View>
    </Modal>
  );

  const renderCountryModal = () => (
    <Modal visible={showCountryModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity
              onPress={() => {
                setShowCountryModal(false);
                setCountrySearch('');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  selectedCountry?.code === item.code && styles.modalItemSelected,
                ]}
                onPress={() => {
                  console.log('[VENDOR_REGISTER] Country selected:', item.code, '- resetting state and area');
                  setSelectedCountry(item);
                  setSelectedState(null);
                  setSelectedArea(null);
                  setStateSearch('');
                  setAreaSearch('');
                  setShowCountryModal(false);
                  setCountrySearch('');
                  if (errors.country) setErrors(p => ({ ...p, country: undefined, state: undefined, area: undefined }));
                }}
                activeOpacity={0.7}
              >
                <View style={styles.countryRow}>
                  <Text style={styles.countryFlag}>{item.flag}</Text>
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedCountry?.code === item.code && styles.modalItemTextSelected,
                    ]}
                  >
                    {item.name}
                  </Text>
                </View>
                {selectedCountry?.code === item.code && (
                  <Check size={18} color="#FF8C42" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalList}
          />
        </View>
      </View>
    </Modal>
  );

  const renderStateModal = () => (
    <Modal visible={showStateModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select {stateLabel}</Text>
            <TouchableOpacity
              onPress={() => {
                setShowStateModal(false);
                setStateSearch('');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={stateSearch}
              onChangeText={setStateSearch}
              placeholder={`Search ${stateLabel.toLowerCase()}`}
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredStates}
            keyExtractor={(item) => item.regionId}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.modalItem,
                  selectedState?.regionId === item.regionId && styles.modalItemSelected,
                ]}
                onPress={() => {
                  console.log('[VENDOR_REGISTER] State selected:', item.regionId, '- resetting area');
                  setSelectedState(item);
                  setSelectedArea(null);
                  setAreaSearch('');
                  setShowStateModal(false);
                  setStateSearch('');
                  if (errors.state) setErrors(p => ({ ...p, state: undefined, area: undefined }));
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    selectedState?.regionId === item.regionId && styles.modalItemTextSelected,
                  ]}
                >
                  {item.name}
                </Text>
                {selectedState?.regionId === item.regionId && (
                  <Check size={18} color="#FF8C42" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalList}
            ListEmptyComponent={
              <View style={styles.emptyAreaContainer}>
                <Info size={32} color="#D1D5DB" strokeWidth={1.5} />
                <Text style={styles.emptyAreaTitle}>No results</Text>
                <Text style={styles.emptyAreaBody}>Try a different search term.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );

  const renderAreaModal = () => (
    <Modal visible={showAreaModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Area / City</Text>
            <TouchableOpacity
              onPress={() => {
                setShowAreaModal(false);
                setAreaSearch('');
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {hasAreas ? (
            <>
              <View style={styles.searchContainer}>
                <Search size={18} color="#9CA3AF" strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  value={areaSearch}
                  onChangeText={setAreaSearch}
                  placeholder="Search areas"
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  autoFocus
                />
              </View>
              <FlatList
                data={filteredAreas}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      selectedArea?.name === item.name && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedArea(item);
                      setShowAreaModal(false);
                      setAreaSearch('');
                      if (errors.area) setErrors(p => ({ ...p, area: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        selectedArea?.name === item.name && styles.modalItemTextSelected,
                      ]}
                    >
                      {item.name}
                    </Text>
                    {selectedArea?.name === item.name && (
                      <Check size={18} color="#FF8C42" strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalList}
              />
            </>
          ) : (
            <View style={styles.emptyAreaContainer}>
              <Info size={32} color="#D1D5DB" strokeWidth={1.5} />
              <Text style={styles.emptyAreaTitle}>No areas listed yet</Text>
              <Text style={styles.emptyAreaBody}>
                We don't have specific areas for {selectedState?.name} yet. More areas are being added regularly.
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={24} color="#2B2B2B" strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.stepIndicatorContainer}>
            {renderStepIndicator()}
          </View>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {step === 'account' && (
              <>
                <View style={styles.stepIconContainer}>
                  <View style={styles.stepIconCircle}>
                    <UserCircle size={28} color="#FF8C42" strokeWidth={1.5} />
                  </View>
                </View>

                <View style={styles.header}>
                  <Text style={styles.stepLabel}>Step 1 of 3</Text>
                  <Text style={styles.title}>Create your account</Text>
                  <Text style={styles.subtitle}>
                    Let's get you started on the platform
                  </Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={[
                        styles.input,
                        fullNameFocused && styles.inputFocused,
                        errors.fullName ? styles.inputError : null,
                      ]}
                      value={fullName}
                      onChangeText={(text) => {
                        setFullName(text);
                        if (errors.fullName) setErrors(p => ({ ...p, fullName: undefined }));
                      }}
                      onFocus={() => setFullNameFocused(true)}
                      onBlur={() => setFullNameFocused(false)}
                      placeholder="Your full name"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!isLoading}
                      autoFocus
                      testID="vendor-register-fullname"
                    />
                    {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                      style={[
                        styles.input,
                        emailFocused && styles.inputFocused,
                        errors.email ? styles.inputError : null,
                      ]}
                      value={email}
                      onChangeText={(text) => {
                        setEmail(text);
                        if (errors.email) setErrors(p => ({ ...p, email: undefined }));
                      }}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      placeholder="you@example.com"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      editable={!isLoading}
                      testID="vendor-register-email"
                    />
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Password</Text>
                    <TextInput
                      style={[
                        styles.input,
                        passwordFocused && styles.inputFocused,
                        errors.password ? styles.inputError : null,
                      ]}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) setErrors(p => ({ ...p, password: undefined }));
                      }}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      placeholder="Minimum 8 characters"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                      testID="vendor-register-password"
                    />
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                  </View>

                  <View style={styles.agreementSection}>
                    <TouchableOpacity
                      style={styles.agreementRow}
                      onPress={() => {
                        setAgreedToTerms(!agreedToTerms);
                        if (errors.terms) setErrors(p => ({ ...p, terms: undefined }));
                      }}
                      activeOpacity={0.7}
                      testID="vendor-register-terms-checkbox"
                    >
                      {agreedToTerms ? (
                        <CheckSquare size={20} color="#FF8C42" strokeWidth={2} />
                      ) : (
                        <Square size={20} color="#9CA3AF" strokeWidth={1.5} />
                      )}
                      <Text style={styles.agreementText}>
                        I agree to the{' '}
                        <Text style={styles.agreementLink} onPress={() => openLink('https://the platform.com/terms')}>
                          Terms of Service
                        </Text>
                        ,{' '}
                        <Text style={styles.agreementLink} onPress={() => openLink('https://the platform.com/vendor-agreement')}>
                          Vendor Agreement
                        </Text>
                        , and{' '}
                        <Text style={styles.agreementLink} onPress={() => openLink('https://the platform.com/privacy')}>
                          Privacy Policy
                        </Text>
                      </Text>
                    </TouchableOpacity>
                    {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}

                    <TouchableOpacity
                      style={[styles.agreementRow, styles.agreementRowSecond]}
                      onPress={() => {
                        setAgreedToResponsibility(!agreedToResponsibility);
                        if (errors.responsibility) setErrors(p => ({ ...p, responsibility: undefined }));
                      }}
                      activeOpacity={0.7}
                      testID="vendor-register-responsibility-checkbox"
                    >
                      {agreedToResponsibility ? (
                        <CheckSquare size={20} color="#FF8C42" strokeWidth={2} />
                      ) : (
                        <Square size={20} color="#9CA3AF" strokeWidth={1.5} />
                      )}
                      <Text style={styles.agreementText}>
                        I understand that I am responsible for confirming payments and managing orders on the platform
                      </Text>
                    </TouchableOpacity>
                    {errors.responsibility ? <Text style={styles.errorText}>{errors.responsibility}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, !accountContinueEnabled && styles.primaryButtonDisabled]}
                    onPress={handleAccountContinue}
                    activeOpacity={0.85}
                    disabled={!accountContinueEnabled}
                    testID="vendor-register-account-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'business' && (
              <>
                <View style={styles.stepIconContainer}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#FFF4ED' }]}>
                    <Store size={28} color="#FF8C42" strokeWidth={1.5} />
                  </View>
                </View>

                <View style={styles.header}>
                  <Text style={styles.stepLabel}>Step 2 of 3</Text>
                  <Text style={styles.title}>Your business</Text>
                  <Text style={styles.subtitle}>
                    Tell us what you sell so customers can find you
                  </Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Business Name</Text>
                    <TextInput
                      style={[
                        styles.input,
                        businessFocused && styles.inputFocused,
                        errors.businessName ? styles.inputError : null,
                      ]}
                      value={businessName}
                      onChangeText={(text) => {
                        setBusinessName(text);
                        if (errors.businessName) setErrors(p => ({ ...p, businessName: undefined }));
                      }}
                      onFocus={() => setBusinessFocused(true)}
                      onBlur={() => setBusinessFocused(false)}
                      placeholder="e.g. Amina's Kitchen"
                      placeholderTextColor="#9CA3AF"
                      autoCorrect={false}
                      editable={!isLoading}
                      autoFocus
                      testID="vendor-register-business"
                    />
                    {errors.businessName ? <Text style={styles.errorText}>{errors.businessName}</Text> : null}
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Business Category</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorButton,
                        errors.category ? styles.inputError : null,
                      ]}
                      onPress={() => setShowCategoryModal(true)}
                      activeOpacity={0.7}
                      testID="vendor-register-category"
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          !selectedCategory && styles.selectorPlaceholder,
                        ]}
                      >
                        {selectedCategory?.name || 'Select business category'}
                      </Text>
                      <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleBusinessContinue}
                    activeOpacity={0.85}
                    testID="vendor-register-business-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 'location' && (
              <>
                <View style={styles.stepIconContainer}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <MapPin size={28} color="#3B82F6" strokeWidth={1.5} />
                  </View>
                </View>

                <View style={styles.header}>
                  <Text style={styles.stepLabel}>Step 3 of 3</Text>
                  <Text style={styles.title}>Where are you based?</Text>
                  <Text style={styles.subtitle}>
                    Help nearby customers discover your business
                  </Text>
                </View>

                <View style={styles.form}>
                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorButton,
                        errors.country ? styles.inputError : null,
                      ]}
                      onPress={() => setShowCountryModal(true)}
                      activeOpacity={0.7}
                      testID="vendor-register-country"
                    >
                      {selectedCountry ? (
                        <View style={styles.countryRow}>
                          <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                          <Text style={styles.selectorText}>{selectedCountry.name}</Text>
                        </View>
                      ) : (
                        <Text style={styles.selectorPlaceholder}>Select your country</Text>
                      )}
                      <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>{stateLabel}</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorButton,
                        !selectedCountry && styles.selectorDisabled,
                        errors.state ? styles.inputError : null,
                      ]}
                      onPress={() => {
                        if (selectedCountry) setShowStateModal(true);
                      }}
                      activeOpacity={selectedCountry ? 0.7 : 1}
                      testID="vendor-register-state"
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          !selectedState && styles.selectorPlaceholder,
                        ]}
                      >
                        {selectedState?.name || (selectedCountry ? `Select your ${stateLabel.toLowerCase()}` : 'Select a country first')}
                      </Text>
                      <ChevronDown size={20} color={selectedCountry ? '#9CA3AF' : '#C5C5C5'} strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.label}>Area / City</Text>
                    <TouchableOpacity
                      style={[
                        styles.selectorButton,
                        !selectedState && styles.selectorDisabled,
                        errors.area ? styles.inputError : null,
                      ]}
                      onPress={() => {
                        if (selectedState) setShowAreaModal(true);
                      }}
                      activeOpacity={selectedState ? 0.7 : 1}
                      testID="vendor-register-area"
                    >
                      <Text
                        style={[
                          styles.selectorText,
                          !selectedArea && styles.selectorPlaceholder,
                        ]}
                      >
                        {selectedArea?.name || (selectedState ? 'Select your area/city' : 'Select a state first')}
                      </Text>
                      <ChevronDown size={20} color={selectedState ? '#9CA3AF' : '#C5C5C5'} strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.area ? <Text style={styles.errorText}>{errors.area}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleLocationContinue}
                    activeOpacity={0.85}
                    disabled={isLoading}
                    testID="vendor-register-location-continue"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
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

      {renderCategoryModal()}
      {renderCountryModal()}
      {renderStateModal()}
      {renderAreaModal()}
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
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    width: 40,
  },
  stepIndicatorContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  stepBar: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  stepBarItemWrap: {
    flex: 1,
  },
  stepBarSegment: {
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  stepBarSegmentActive: {
    backgroundColor: '#FF8C42',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
  },
  stepIconContainer: {
    alignItems: 'center' as const,
    marginBottom: 20,
    marginTop: 8,
  },
  stepIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF7F2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  header: {
    marginBottom: 28,
    alignItems: 'center' as const,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FF8C42',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 20,
  },
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
  inputFocused: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFFBF8',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  selectorButton: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  selectorDisabled: {
    backgroundColor: '#F0F0F0',
  },
  selectorText: {
    fontSize: 16,
    color: '#2B2B2B',
  },
  selectorPlaceholder: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  countryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  countryFlag: {
    fontSize: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
    shadowOpacity: 0,
    elevation: 0,
  },
  agreementSection: {
    marginBottom: 20,
    marginTop: 4,
  },
  agreementRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  agreementRowSecond: {
    marginTop: 14,
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    marginTop: 1,
  },
  agreementLink: {
    color: '#FF8C42',
    fontWeight: '500' as const,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  trustText: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    marginTop: 28,
    marginBottom: 20,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  modalClose: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#2B2B2B',
    paddingVertical: 0,
  },
  modalList: {
    paddingHorizontal: 8,
  },
  emptyAreaContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyAreaTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
  },
  emptyAreaBody: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  modalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  modalItemSelected: {
    backgroundColor: 'rgba(255,140,66,0.08)',
  },
  modalItemText: {
    fontSize: 16,
    color: '#2B2B2B',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
});
