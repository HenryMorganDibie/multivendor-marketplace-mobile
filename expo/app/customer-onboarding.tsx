import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Check,
  UserCircle,
  MapPin,
  Sparkles,
  ArrowRight,
  Star,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';
import { COUNTRIES } from '@/constants/countries';

const PENDING_CUSTOMER_ONBOARDING_KEY = '@the platform_pending_customer_onboarding';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isPhone(value: string): boolean {
  return /^\+?[0-9\s\-()]{7,15}$/.test(value.trim());
}
function maskContact(contact: string): string {
  if (isEmail(contact)) {
    const [local, domain] = contact.split('@');
    const masked =
      local.length > 2
        ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
        : local;
    return `${masked}@${domain}`;
  }
  const s = contact.replace(/\D/g, '');
  return s.slice(0, 3) + '****' + s.slice(-3);
}

const CATEGORIES = DAY_ONE_CATEGORIES.map((name, index) => ({
  id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  name,
  sortOrder: index,
}));

const CATEGORY_ICONS: Record<string, string> = {
  'food_&_catering': '🍽️',
  fashion: '👗',
  beauty_tools: '💄',
  'home_&_living': '🏠',
  electronics_repair: '🔧',
  'baby_&_kids': '🧸',
  'bags_&_accessories': '👜',
  phone_accessories: '📱',
  'art_&_handmade': '🎨',
  'books_&_stationery': '📚',
  digital_products: '💻',
  safe_verified_services: '🛡️',
};

type Step = 'account' | 'location' | 'interests' | 'complete';
const WIZARD_STEPS: Step[] = ['account', 'location', 'interests'];

interface CategoryItem {
  id: string;
  name: string;
}

export default function CustomerOnboardingScreen() {
  const router = useRouter();
  const { checkAccountExists, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('account');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(1 / WIZARD_STEPS.length)).current;
  const completeScaleAnim = useRef(new Animated.Value(0.6)).current;
  const completeFadeAnim = useRef(new Animated.Value(0)).current;

  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string; flag: string } | null>(null);
  const [city, setCity] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const [selectedInterests, setSelectedInterests] = useState<CategoryItem[]>([]);

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);

  const [nameFocused, setNameFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [cityFocused, setCityFocused] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const wizardIndex = WIZARD_STEPS.indexOf(step as Step);
  const progressPercent = wizardIndex >= 0 ? (wizardIndex + 1) / WIZARD_STEPS.length : 0;

  const animateTransition = useCallback(
    (toStep: Step) => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setStep(toStep);
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });

      const nextIndex = WIZARD_STEPS.indexOf(toStep);
      const nextProgress = nextIndex >= 0 ? (nextIndex + 1) / WIZARD_STEPS.length : progressPercent;
      Animated.spring(progressAnim, {
        toValue: nextProgress,
        useNativeDriver: false,
        friction: 8,
        tension: 80,
      }).start();
    },
    [fadeAnim, progressAnim, progressPercent]
  );

  const handleBack = useCallback(() => {
    if (step === 'account') { router.back(); return; }
    if (step === 'location') { animateTransition('account'); return; }
    if (step === 'interests') { animateTransition('location'); return; }
    router.back();
  }, [step, animateTransition, router]);

  const handleAccountContinue = useCallback(async () => {
    const newErrors: Record<string, string | undefined> = {};
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) newErrors.fullName = 'Full name is required';
    const trimmedContact = contact.trim();
    if (!trimmedContact) {
      newErrors.contact = 'Email or phone is required';
    } else if (!isEmail(trimmedContact) && !isPhone(trimmedContact)) {
      newErrors.contact = 'Enter a valid email or phone number';
    }
    if (!password || password.length < 8) newErrors.password = 'Password must be at least 8 characters';
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setIsLoading(true);
    try {
      const trimmedIdentifier = contact.trim();
      if (isEmail(trimmedIdentifier)) {
        const check = await checkAccountExists(trimmedIdentifier);
        if (check.exists) {
          setErrors({ contact: 'An account already exists. Please log in instead.' });
          setIsLoading(false);
          return;
        }
      }
      console.log('[CUSTOMER_ONBOARDING] Account → Location');
      animateTransition('location');
    } catch {
      setErrors({ contact: 'Something went wrong. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [fullName, contact, password, checkAccountExists, animateTransition]);

  const handleLocationContinue = useCallback(() => {
    const newErrors: Record<string, string | undefined> = {};
    if (!selectedCountry) newErrors.country = 'Please select your country';
    if (!city.trim()) newErrors.city = 'City is required';
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    console.log('[CUSTOMER_ONBOARDING] Location → Interests');
    animateTransition('interests');
  }, [selectedCountry, city, animateTransition]);

  const finalize = useCallback(async () => {
    setIsLoading(true);
    console.log('[CUSTOMER_ONBOARDING] Finalizing customer registration');

    try {
      const trimmedContact = contact.trim();
      const pendingData = {
        fullName: fullName.trim(),
        contact: trimmedContact,
        password,
        country: selectedCountry?.code || '',
        countryName: selectedCountry?.name || '',
        city: city.trim(),
        interests: selectedInterests.map((i) => i.name),
      };

      await AsyncStorage.setItem(PENDING_CUSTOMER_ONBOARDING_KEY, JSON.stringify(pendingData));
      console.log('[CUSTOMER_ONBOARDING] Saved pending data');

      setIsLoading(false);
      animateTransition('complete');
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(completeScaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            friction: 6,
            tension: 80,
          }),
          Animated.timing(completeFadeAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }, 200);
    } catch (err) {
      console.error('[CUSTOMER_ONBOARDING] Error:', err);
      setErrors({ city: 'Something went wrong. Please try again.' });
      setIsLoading(false);
    }
  }, [contact, fullName, password, selectedCountry, city, selectedInterests, animateTransition, completeScaleAnim, completeFadeAnim]);

  const handleInterestsContinue = useCallback(async () => {
    await finalize();
  }, [finalize]);

  const handleSkipInterests = useCallback(async () => {
    await finalize();
  }, [finalize]);

  const handleStartExploring = useCallback(() => {
    const trimmedContact = contact.trim();
    console.log('[CUSTOMER_ONBOARDING] Start exploring → verify OTP');
    router.replace({
      pathname: '/verify-otp',
      params: {
        contact: trimmedContact,
        maskedContact: maskContact(trimmedContact),
        context: 'customer-registration',
        password,
      },
    } as any);
  }, [contact, password, router]);

  const toggleInterest = useCallback(
    (cat: CategoryItem) => {
      setSelectedInterests((prev) => {
        const exists = prev.find((c) => c.id === cat.id);
        if (exists) return prev.filter((c) => c.id !== cat.id);
        return [...prev, cat];
      });
    },
    []
  );

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const showProgressBar = wizardIndex >= 0;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (authLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#FF8C42" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        {step !== 'complete' && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="customer-onboarding-back"
            >
              <ChevronLeft size={22} color="#111827" strokeWidth={2.2} />
            </TouchableOpacity>

            {showProgressBar && (
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
                </View>
                <Text style={styles.progressLabel}>
                  Step {wizardIndex + 1} of {WIZARD_STEPS.length}
                </Text>
              </View>
            )}

            <View style={styles.backBtn} />
          </View>
        )}
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>

          {/* ─── ACCOUNT ─── */}
          {step === 'account' && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepIconWrap}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#FFF4ED' }]}>
                    <UserCircle size={28} color="#FF8C42" strokeWidth={1.5} />
                  </View>
                </View>

                <Text style={styles.stepTitle}>Create your account</Text>
                <Text style={styles.stepSubtitle}>Start shopping on the platform in seconds</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={[styles.input, nameFocused && styles.inputFocused, errors.fullName ? styles.inputError : null]}
                      value={fullName}
                      onChangeText={(t) => { setFullName(t); if (errors.fullName) setErrors((p) => ({ ...p, fullName: undefined })); }}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      placeholder="Your full name"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoFocus
                      testID="customer-onboarding-name"
                    />
                    {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email or Phone</Text>
                    <TextInput
                      style={[styles.input, contactFocused && styles.inputFocused, errors.contact ? styles.inputError : null]}
                      value={contact}
                      onChangeText={(t) => { setContact(t); if (errors.contact) setErrors((p) => ({ ...p, contact: undefined })); }}
                      onFocus={() => setContactFocused(true)}
                      onBlur={() => setContactFocused(false)}
                      placeholder="you@example.com or +234 800 000 0000"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      testID="customer-onboarding-contact"
                    />
                    {errors.contact ? <Text style={styles.errorText}>{errors.contact}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused, errors.password ? styles.inputError : null]}
                        value={password}
                        onChangeText={(t) => { setPassword(t); if (errors.password) setErrors((p) => ({ ...p, password: undefined })); }}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        placeholder="Minimum 8 characters"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID="customer-onboarding-password"
                      />
                      <TouchableOpacity
                        style={styles.showPasswordBtn}
                        onPress={() => setShowPassword((v) => !v)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                    </View>
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleAccountContinue}
                    activeOpacity={0.87}
                    disabled={isLoading}
                    testID="customer-onboarding-account-continue"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Continue</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.loginRow}
                    onPress={() => router.push('/login')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.loginText}>Already have an account? </Text>
                    <Text style={styles.loginLink}>Log in</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ─── LOCATION ─── */}
          {step === 'location' && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepIconWrap}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <MapPin size={28} color="#3B82F6" strokeWidth={1.5} />
                  </View>
                </View>

                <Text style={styles.stepTitle}>Where are you?</Text>
                <Text style={styles.stepSubtitle}>Find vendors and deals near you</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity
                      style={[styles.selector, errors.country ? styles.inputError : null]}
                      onPress={() => setShowCountryModal(true)}
                      activeOpacity={0.75}
                      testID="customer-onboarding-country"
                    >
                      <Text style={[styles.selectorText, !selectedCountry && styles.selectorPlaceholder]}>
                        {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Select your country'}
                      </Text>
                      <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>City</Text>
                    <TextInput
                      style={[styles.input, cityFocused && styles.inputFocused, errors.city ? styles.inputError : null]}
                      value={city}
                      onChangeText={(t) => { setCity(t); if (errors.city) setErrors((p) => ({ ...p, city: undefined })); }}
                      onFocus={() => setCityFocused(true)}
                      onBlur={() => setCityFocused(false)}
                      placeholder="e.g. Lagos, London, New York"
                      placeholderTextColor="#9CA3AF"
                      autoCorrect={false}
                      testID="customer-onboarding-city"
                    />
                    {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleLocationContinue}
                    activeOpacity={0.87}
                    testID="customer-onboarding-location-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ─── INTERESTS ─── */}
          {step === 'interests' && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepIconWrap}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#FEF3C7' }]}>
                    <Star size={28} color="#F59E0B" strokeWidth={1.5} />
                  </View>
                </View>

                <Text style={styles.stepTitle}>What are you looking for?</Text>
                <Text style={styles.stepSubtitle}>Pick your interests to personalize your feed</Text>

                <View style={styles.form}>
                  <View style={styles.chipsGrid}>
                    {CATEGORIES.map((cat) => {
                      const isSelected = selectedInterests.some((c) => c.id === cat.id);
                      return (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.chip, isSelected && styles.chipSelected]}
                          onPress={() => toggleInterest(cat)}
                          activeOpacity={0.75}
                          testID={`customer-onboarding-interest-${cat.id}`}
                        >
                          <Text style={styles.chipEmoji}>
                            {CATEGORY_ICONS[cat.id] || '🛍️'}
                          </Text>
                          <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                            {cat.name}
                          </Text>
                          {isSelected && (
                            <View style={styles.chipCheck}>
                              <Check size={10} color="#FFFFFF" strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleInterestsContinue}
                    activeOpacity={0.87}
                    disabled={isLoading}
                    testID="customer-onboarding-interests-continue"
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        {selectedInterests.length > 0 ? 'Continue' : 'Continue'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkipInterests}
                    activeOpacity={0.7}
                    disabled={isLoading}
                    testID="customer-onboarding-skip-interests"
                  >
                    <Text style={styles.skipButtonText}>Skip for now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ─── COMPLETE ─── */}
          {step === 'complete' && (
            <SafeAreaView edges={['bottom']} style={styles.completeScreen}>
              <View style={styles.completeContent}>
                <Animated.View
                  style={[
                    styles.completeIconWrap,
                    {
                      opacity: completeFadeAnim,
                      transform: [{ scale: completeScaleAnim }],
                    },
                  ]}
                >
                  <View style={styles.completeRing}>
                    <View style={styles.completeIconCircle}>
                      <Text style={styles.completeEmoji}>🎉</Text>
                    </View>
                  </View>
                  <View style={styles.sparkleTopRight}>
                    <Sparkles size={20} color="#F59E0B" strokeWidth={1.5} />
                  </View>
                  <View style={styles.sparkleBottomLeft}>
                    <Sparkles size={14} color="#3B82F6" strokeWidth={1.5} />
                  </View>
                </Animated.View>

                <Animated.View style={{ opacity: completeFadeAnim, alignItems: 'center' as const }}>
                  <Text style={styles.completeTitle}>Welcome to the platform 🎉</Text>
                  <Text style={styles.completeSubtitle}>
                    Your account is almost ready. Verify your email to start discovering amazing vendors.
                  </Text>

                  <View style={styles.completeSummary}>
                    {[
                      { icon: '👤', label: fullName || 'Your account' },
                      { icon: '📍', label: city && selectedCountry ? `${city}, ${selectedCountry.name}` : city || 'Your location' },
                      ...(selectedInterests.length > 0
                        ? [{ icon: '⭐', label: selectedInterests.slice(0, 3).map((i) => i.name).join(', ') + (selectedInterests.length > 3 ? ` +${selectedInterests.length - 3}` : '') }]
                        : []),
                    ].map((item, i) => (
                      <View key={i} style={styles.completeSummaryRow}>
                        <Text style={styles.completeSummaryIcon}>{item.icon}</Text>
                        <Text style={styles.completeSummaryText} numberOfLines={1}>
                          {item.label}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              </View>

              <View style={styles.completeFooter}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleStartExploring}
                  activeOpacity={0.87}
                  testID="customer-onboarding-start"
                >
                  <Text style={styles.primaryButtonText}>Start exploring</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          )}
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Country modal */}
      <Modal visible={showCountryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => { setShowCountryModal(false); setCountrySearch(''); }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={styles.modalSearchInput}
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder="Search countries"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => {
                const isSelected = selectedCountry?.code === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedCountry({ code: item.code, name: item.name, flag: item.flag });
                      setShowCountryModal(false);
                      setCountrySearch('');
                      if (errors.country) setErrors((p) => ({ ...p, country: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemFlag}>{item.flag}</Text>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>
                      {item.name}
                    </Text>
                    {isSelected && <Check size={16} color="#FF8C42" strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  safeTop: {
    backgroundColor: '#FFFFFF',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  progressContainer: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 6,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF8C42',
    borderRadius: 2,
  },
  progressLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
  },
  stepIconWrap: {
    marginBottom: 20,
  },
  stepIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#111827',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 28,
    lineHeight: 22,
  },
  form: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  inputFocused: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#DC2626',
  },
  passwordRow: {
    position: 'relative' as const,
  },
  passwordInput: {
    paddingRight: 64,
  },
  showPasswordBtn: {
    position: 'absolute' as const,
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center' as const,
  },
  showPasswordText: {
    fontSize: 14,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginTop: 6,
    paddingHorizontal: 2,
  },
  selector: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  selectorText: {
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  selectorPlaceholder: {
    color: '#9CA3AF',
  },
  primaryButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  skipButton: {
    height: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 15,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  loginRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    marginTop: 20,
    paddingBottom: 8,
  },
  loginText: {
    fontSize: 15,
    color: '#6B7280',
  },
  loginLink: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  chipsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
    marginBottom: 24,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F9FAFB',
    borderRadius: 50,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 6,
    position: 'relative' as const,
  },
  chipSelected: {
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderColor: '#FF8C42',
  },
  chipEmoji: {
    fontSize: 15,
  },
  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500' as const,
  },
  chipTextSelected: {
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF8C42',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 2,
  },
  completeScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  completeContent: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  completeIconWrap: {
    position: 'relative' as const,
    marginBottom: 32,
  },
  completeRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,140,66,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  completeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  completeEmoji: {
    fontSize: 36,
  },
  sparkleTopRight: {
    position: 'absolute' as const,
    top: -4,
    right: -8,
  },
  sparkleBottomLeft: {
    position: 'absolute' as const,
    bottom: 0,
    left: -8,
  },
  completeTitle: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center' as const,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  completeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 28,
  },
  completeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    width: '100%',
    gap: 10,
  },
  completeSummaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  completeSummaryIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center' as const,
  },
  completeSummaryText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500' as const,
    flex: 1,
  },
  completeFooter: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
  },
  modalClose: {
    fontSize: 15,
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
  modalSearch: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  modalList: {
    paddingHorizontal: 8,
    paddingBottom: 16,
  },
  modalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 12,
  },
  modalItemSelected: {
    backgroundColor: 'rgba(255,140,66,0.06)',
  },
  modalItemFlag: {
    fontSize: 22,
  },
  modalItemText: {
    fontSize: 15,
    color: '#111827',
    flex: 1,
  },
  modalItemTextSelected: {
    color: '#FF8C42',
    fontWeight: '600' as const,
  },
});
