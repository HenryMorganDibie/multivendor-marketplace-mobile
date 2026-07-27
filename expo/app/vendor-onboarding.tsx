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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ChevronLeft,
  ChevronDown,
  Search,
  Check,
  Store,
  UserCircle,
  MapPin,
  Image as ImageIcon,
  Rocket,
  ArrowRight,
  Square,
  CheckSquare,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';
import { COUNTRIES } from '@/constants/countries';
import { Region, getRegionsByCountry } from '@/constants/regions';
import { AreaInfo, getAreasByRegion } from '@/constants/areas';

const PENDING_VENDOR_ONBOARDING_KEY = '@the platform_pending_vendor_onboarding';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isPhone(value: string): boolean {
  return /^\+?[0-9\s\-()]{7,15}$/.test(value.trim());
}
function maskContact(contact: string): string {
  if (isEmail(contact)) {
    const [local, domain] = contact.split('@');
    const masked = local.length > 2
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


type Step = 'entry' | 'account' | 'business' | 'location' | 'store' | 'complete';

const WIZARD_STEPS: Step[] = ['account', 'business', 'location', 'store'];

interface CategoryChip {
  id: string;
  name: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  'food_&_catering': '🍽️',
  'fashion': '👗',
  'beauty_tools': '💄',
  'home_&_living': '🏠',
  'electronics_repair': '🔧',
  'baby_&_kids': '🧸',
  'bags_&_accessories': '👜',
  'phone_accessories': '📱',
  'art_&_handmade': '🎨',
  'books_&_stationery': '📚',
  'digital_products': '💻',
  'safe_verified_services': '🛡️',
};

export default function VendorOnboardingScreen() {
  const router = useRouter();
  const { checkAccountExists, isAuthenticated, isLoading: authLoading } = useAuth();

  const [step, setStep] = useState<Step>('entry');
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const completeScaleAnim = useRef(new Animated.Value(0.6)).current;
  const completeFadeAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Account
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToResponsibility, setAgreedToResponsibility] = useState(false);

  // Business
  const [businessName, setBusinessName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<CategoryChip[]>([]);

  // Location
  const [selectedCountry, setSelectedCountry] = useState<{ code: string; name: string; flag: string } | null>(null);
  const [selectedState, setSelectedState] = useState<Region | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaInfo | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [areaSearch, setAreaSearch] = useState('');

  // Store Setup
  const [description, setDescription] = useState('');

  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Focus states
  const [nameFocused, setNameFocused] = useState(false);
  const [contactFocused, setContactFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [businessFocused, setBusinessFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  const wizardIndex = WIZARD_STEPS.indexOf(step as Step);
  const progressPercent = wizardIndex >= 0 ? (wizardIndex + 1) / WIZARD_STEPS.length : 0;

  const animateTransition = useCallback((toStep: Step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      setStep(toStep);
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });

    const nextWizardIndex = WIZARD_STEPS.indexOf(toStep);
    const nextProgress = nextWizardIndex >= 0 ? (nextWizardIndex + 1) / WIZARD_STEPS.length : progressPercent;
    Animated.spring(progressAnim, {
      toValue: nextProgress,
      useNativeDriver: false,
      friction: 8,
      tension: 80,
    }).start();
  }, [fadeAnim, progressAnim, progressPercent]);

  const handleBack = useCallback(() => {
    if (step === 'entry') { router.back(); return; }
    if (step === 'account') { animateTransition('entry'); return; }
    if (step === 'business') { animateTransition('account'); return; }
    if (step === 'location') { animateTransition('business'); return; }
    if (step === 'store') { animateTransition('location'); return; }
    router.back();
  }, [step, animateTransition, router]);

  const handleEntryContinue = useCallback(() => {
    console.log('[VENDOR_ONBOARDING] Entry → Account');
    animateTransition('account');
  }, [animateTransition]);

  const handleAccountContinue = useCallback(() => {
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
    if (!agreedToTerms) newErrors.terms = 'Please agree to continue';
    if (!agreedToResponsibility) newErrors.responsibility = 'Please agree to continue';
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    console.log('[VENDOR_ONBOARDING] Account → Business');
    animateTransition('business');
  }, [fullName, contact, password, agreedToTerms, agreedToResponsibility, animateTransition]);

  const handleBusinessContinue = useCallback(() => {
    const newErrors: Record<string, string | undefined> = {};
    const trimmedBusiness = businessName.trim();
    if (!trimmedBusiness || trimmedBusiness.length < 2) newErrors.businessName = 'Business name is required';
    if (selectedCategories.length === 0) newErrors.categories = 'Select at least one category';
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    console.log('[VENDOR_ONBOARDING] Business → Location');
    animateTransition('location');
  }, [businessName, selectedCategories, animateTransition]);

  const handleLocationContinue = useCallback(() => {
    const newErrors: Record<string, string | undefined> = {};
    if (!selectedCountry) newErrors.country = 'Please select your country';
    if (!selectedState) newErrors.state = 'Please select your state/province';
    const stateAreas = selectedState ? getAreasByRegion(selectedState.id) : [];
    if (stateAreas.length > 0 && !selectedArea) {
      newErrors.city = 'Please select your area/city';
    }
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;
    console.log('[VENDOR_ONBOARDING] Location → Store');
    animateTransition('store');
  }, [selectedCountry, selectedState, selectedArea, animateTransition]);

  const handleStoreContinue = useCallback(async () => {
    setIsLoading(true);
    console.log('[VENDOR_ONBOARDING] Store → finalizing');

    try {
      const trimmedContact = contact.trim();
      if (isEmail(trimmedContact)) {
        const check = await checkAccountExists(trimmedContact);
        if (check.exists) {
          setIsLoading(false);
          animateTransition('account');
          setErrors({ contact: 'An account with this email already exists. Please log in.' });
          return;
        }
      }

      const resolvedCity = selectedArea?.name || '';
      const pendingData = {
        fullName: fullName.trim(),
        contact: trimmedContact,
        password,
        businessName: businessName.trim(),
        categories: selectedCategories,
        country: selectedCountry?.code || '',
        countryName: selectedCountry?.name || '',
        state: selectedState?.name || '',
        regionId: selectedState?.id || '',
        city: resolvedCity,
        description: description.trim(),
      };

      await AsyncStorage.setItem(PENDING_VENDOR_ONBOARDING_KEY, JSON.stringify(pendingData));
      console.log('[VENDOR_ONBOARDING] Saved pending data');

      if (isEmail(trimmedContact)) {
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

        setTimeout(() => {
          router.push({
            pathname: '/verify-otp',
            params: {
              contact: trimmedContact,
              maskedContact: maskContact(trimmedContact),
              context: 'vendor-registration',
              password,
              businessName: businessName.trim(),
            },
          });
        }, 2200);
      } else {
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
      }
    } catch (err) {
      console.error('[VENDOR_ONBOARDING] Error:', err);
      setErrors({ city: 'Something went wrong. Please try again.' });
      setIsLoading(false);
    }
  }, [
    contact, fullName, password, businessName, selectedCategories,
    selectedCountry, selectedState, selectedArea, description,
    checkAccountExists, animateTransition, router,
    completeScaleAnim, completeFadeAnim,
  ]);

  const handleSkipStore = useCallback(() => {
    void handleStoreContinue();
  }, [handleStoreContinue]);

  const handleGotoDashboard = useCallback(() => {
    console.log('[VENDOR_ONBOARDING] Go to Dashboard');
    router.replace('/vendor/(tabs)/dashboard' as any);
  }, [router]);

  const toggleCategory = useCallback((cat: CategoryChip) => {
    setSelectedCategories(prev => {
      const exists = prev.find(c => c.id === cat.id);
      if (exists) return prev.filter(c => c.id !== cat.id);
      return [...prev, cat];
    });
    if (errors.categories) setErrors(p => ({ ...p, categories: undefined }));
  }, [errors.categories]);

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : COUNTRIES;

  const availableRegions: Region[] = selectedCountry ? getRegionsByCountry(selectedCountry.code) : [];
  const filteredRegions = stateSearch.trim()
    ? availableRegions.filter(r => r.name.toLowerCase().includes(stateSearch.toLowerCase()))
    : availableRegions;

  const availableAreas: AreaInfo[] = selectedState ? getAreasByRegion(selectedState.id) : [];
  const filteredAreas = areaSearch.trim()
    ? availableAreas.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase()))
    : availableAreas;

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
        {step !== 'entry' && step !== 'complete' && (
          <View style={styles.topBar}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              testID="vendor-onboarding-back"
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
          {/* ─── ENTRY ─── */}
          {step === 'entry' && (
            <View style={styles.entryScreen}>
              <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
                <View style={styles.entryContent}>
                  <View style={styles.entryIllustration}>
                    <View style={styles.entryIconRing}>
                      <View style={styles.entryIconInner}>
                        <Store size={36} color="#FF8C42" strokeWidth={1.5} />
                      </View>
                    </View>
                    <View style={[styles.entryBadge, { top: 8, right: 20 }]}>
                      <Text style={styles.entryBadgeText}>100% Free</Text>
                    </View>
                    <View style={[styles.entryBadge, styles.entryBadgeBlue, { bottom: 12, left: 12 }]}>
                      <Text style={[styles.entryBadgeText, { color: '#3B82F6' }]}>No commission</Text>
                    </View>
                  </View>

                  <Text style={styles.entryTitle}>Start selling on the platform</Text>
                  <Text style={styles.entrySubtitle}>
                    Set up your store in minutes. No fees, no commissions — just your business, your rules.
                  </Text>

                  <View style={styles.entryFeatures}>
                    {[
                      { icon: '✅', text: 'Create your free store' },
                      { icon: '💳', text: 'Customers pay you directly' },
                      { icon: '📦', text: 'Manage orders in one place' },
                    ].map((item, i) => (
                      <View key={i} style={styles.entryFeatureRow}>
                        <Text style={styles.entryFeatureIcon}>{item.icon}</Text>
                        <Text style={styles.entryFeatureText}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.entryFooter}>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleEntryContinue}
                    activeOpacity={0.87}
                    testID="vendor-onboarding-entry-continue"
                  >
                    <Text style={styles.primaryButtonText}>Get started — it's free</Text>
                    <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
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
              </SafeAreaView>
            </View>
          )}

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
                <Text style={styles.stepSubtitle}>Let's get you set up on the platform</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                      style={[styles.input, nameFocused && styles.inputFocused, errors.fullName ? styles.inputError : null]}
                      value={fullName}
                      onChangeText={t => { setFullName(t); if (errors.fullName) setErrors(p => ({ ...p, fullName: undefined })); }}
                      onFocus={() => setNameFocused(true)}
                      onBlur={() => setNameFocused(false)}
                      placeholder="Your full name"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="words"
                      autoCorrect={false}
                      autoFocus
                      testID="vendor-onboarding-name"
                    />
                    {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email or Phone</Text>
                    <TextInput
                      style={[styles.input, contactFocused && styles.inputFocused, errors.contact ? styles.inputError : null]}
                      value={contact}
                      onChangeText={t => { setContact(t); if (errors.contact) setErrors(p => ({ ...p, contact: undefined })); }}
                      onFocus={() => setContactFocused(true)}
                      onBlur={() => setContactFocused(false)}
                      placeholder="you@example.com or +234 800 000 0000"
                      placeholderTextColor="#9CA3AF"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="email-address"
                      testID="vendor-onboarding-contact"
                    />
                    {errors.contact ? <Text style={styles.errorText}>{errors.contact}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.passwordRow}>
                      <TextInput
                        style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused, errors.password ? styles.inputError : null]}
                        value={password}
                        onChangeText={t => { setPassword(t); if (errors.password) setErrors(p => ({ ...p, password: undefined })); }}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        placeholder="Minimum 8 characters"
                        placeholderTextColor="#9CA3AF"
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                        testID="vendor-onboarding-password"
                      />
                      <TouchableOpacity
                        style={styles.showPasswordBtn}
                        onPress={() => setShowPassword(v => !v)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                    </View>
                    {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                  </View>

                  <View style={styles.agreements}>
                    <TouchableOpacity
                      style={styles.agreementRow}
                      onPress={() => { setAgreedToTerms(v => !v); if (errors.terms) setErrors(p => ({ ...p, terms: undefined })); }}
                      activeOpacity={0.7}
                      testID="vendor-onboarding-terms"
                    >
                      {agreedToTerms
                        ? <CheckSquare size={20} color="#FF8C42" strokeWidth={2} />
                        : <Square size={20} color="#C4C9D4" strokeWidth={1.5} />}
                      <Text style={styles.agreementText}>
                        I agree to the{' '}
                        <Text style={styles.agreementLink} onPress={() => Linking.openURL('https://the platform.com/terms')}>Terms of Service</Text>
                        ,{' '}
                        <Text style={styles.agreementLink} onPress={() => Linking.openURL('https://the platform.com/vendor-agreement')}>Vendor Agreement</Text>
                        , and{' '}
                        <Text style={styles.agreementLink} onPress={() => Linking.openURL('https://the platform.com/privacy')}>Privacy Policy</Text>
                      </Text>
                    </TouchableOpacity>
                    {errors.terms ? <Text style={[styles.errorText, { marginTop: 4 }]}>{errors.terms}</Text> : null}

                    <TouchableOpacity
                      style={[styles.agreementRow, { marginTop: 14 }]}
                      onPress={() => { setAgreedToResponsibility(v => !v); if (errors.responsibility) setErrors(p => ({ ...p, responsibility: undefined })); }}
                      activeOpacity={0.7}
                      testID="vendor-onboarding-responsibility"
                    >
                      {agreedToResponsibility
                        ? <CheckSquare size={20} color="#FF8C42" strokeWidth={2} />
                        : <Square size={20} color="#C4C9D4" strokeWidth={1.5} />}
                      <Text style={styles.agreementText}>
                        I understand I'm responsible for confirming payments and managing orders
                      </Text>
                    </TouchableOpacity>
                    {errors.responsibility ? <Text style={[styles.errorText, { marginTop: 4 }]}>{errors.responsibility}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, !(agreedToTerms && agreedToResponsibility) && styles.primaryButtonDisabled]}
                    onPress={handleAccountContinue}
                    activeOpacity={0.87}
                    disabled={!(agreedToTerms && agreedToResponsibility)}
                    testID="vendor-onboarding-account-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
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

          {/* ─── BUSINESS ─── */}
          {step === 'business' && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepIconWrap}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#FFF7ED' }]}>
                    <Store size={28} color="#FF8C42" strokeWidth={1.5} />
                  </View>
                </View>

                <Text style={styles.stepTitle}>Your business</Text>
                <Text style={styles.stepSubtitle}>Tell us what you sell so customers can find you</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Business Name</Text>
                    <TextInput
                      style={[styles.input, businessFocused && styles.inputFocused, errors.businessName ? styles.inputError : null]}
                      value={businessName}
                      onChangeText={t => { setBusinessName(t); if (errors.businessName) setErrors(p => ({ ...p, businessName: undefined })); }}
                      onFocus={() => setBusinessFocused(true)}
                      onBlur={() => setBusinessFocused(false)}
                      placeholder="e.g. Amina's Kitchen"
                      placeholderTextColor="#9CA3AF"
                      autoCorrect={false}
                      autoFocus
                      testID="vendor-onboarding-business-name"
                    />
                    {errors.businessName ? <Text style={styles.errorText}>{errors.businessName}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      Category{' '}
                      <Text style={styles.labelHint}>(select all that apply)</Text>
                    </Text>
                    <View style={styles.chipsGrid}>
                      {CATEGORIES.map(cat => {
                        const isSelected = selectedCategories.some(c => c.id === cat.id);
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={[styles.chip, isSelected && styles.chipSelected]}
                            onPress={() => toggleCategory(cat)}
                            activeOpacity={0.75}
                            testID={`vendor-onboarding-cat-${cat.id}`}
                          >
                            <Text style={styles.chipEmoji}>
                              {CATEGORY_ICONS[cat.id] || '🏪'}
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
                    {errors.categories ? <Text style={styles.errorText}>{errors.categories}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleBusinessContinue}
                    activeOpacity={0.87}
                    testID="vendor-onboarding-business-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
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

                <Text style={styles.stepTitle}>Where are you based?</Text>
                <Text style={styles.stepSubtitle}>Help nearby customers discover your business</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Country</Text>
                    <TouchableOpacity
                      style={[styles.selector, errors.country ? styles.inputError : null]}
                      onPress={() => setShowCountryModal(true)}
                      activeOpacity={0.75}
                      testID="vendor-onboarding-country"
                    >
                      <Text style={[styles.selectorText, !selectedCountry && styles.selectorPlaceholder]}>
                        {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Select your country'}
                      </Text>
                      <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
                    </TouchableOpacity>
                    {errors.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>State / Province</Text>
                    <TouchableOpacity
                      style={[styles.selector, !selectedCountry && styles.selectorDimmed, errors.state ? styles.inputError : null]}
                      onPress={() => { if (selectedCountry) setShowStateModal(true); }}
                      activeOpacity={selectedCountry ? 0.75 : 1}
                      testID="vendor-onboarding-state"
                    >
                      <Text style={[styles.selectorText, !selectedState && styles.selectorPlaceholder]}>
                        {selectedState
                          ? selectedState.name
                          : selectedCountry
                            ? (availableRegions.length === 0 ? 'No regions available' : 'Select state/province')
                            : 'Select country first'}
                      </Text>
                      {selectedCountry && availableRegions.length > 0 && (
                        <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                    {errors.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Area / City</Text>
                    <TouchableOpacity
                      style={[styles.selector, (!selectedState || availableAreas.length === 0) && styles.selectorDimmed, errors.city ? styles.inputError : null]}
                      onPress={() => { if (selectedState && availableAreas.length > 0) setShowAreaModal(true); }}
                      activeOpacity={selectedState && availableAreas.length > 0 ? 0.75 : 1}
                      testID="vendor-onboarding-area"
                    >
                      <Text style={[styles.selectorText, !selectedArea && styles.selectorPlaceholder]}>
                        {selectedArea
                          ? selectedArea.name
                          : !selectedState
                            ? 'Select state first'
                            : availableAreas.length > 0
                              ? 'Select area/city'
                              : 'Covered by state'}
                      </Text>
                      {selectedState && availableAreas.length > 0 && (
                        <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                    {errors.city ? <Text style={styles.errorText}>{errors.city}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleLocationContinue}
                    activeOpacity={0.87}
                    testID="vendor-onboarding-location-continue"
                  >
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ─── STORE SETUP ─── */}
          {step === 'store' && (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.stepContent}>
                <View style={styles.stepIconWrap}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#F0FDF4' }]}>
                    <ImageIcon size={28} color="#16A34A" strokeWidth={1.5} />
                  </View>
                </View>

                <Text style={styles.stepTitle}>Set up your store</Text>
                <Text style={styles.stepSubtitle}>Optional — you can always update this later</Text>

                <View style={styles.form}>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      Store Logo <Text style={styles.labelHint}>(optional)</Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.logoUploadArea}
                      activeOpacity={0.75}
                      testID="vendor-onboarding-logo"
                    >
                      <View style={styles.logoUploadIcon}>
                        <ImageIcon size={24} color="#9CA3AF" strokeWidth={1.5} />
                      </View>
                      <Text style={styles.logoUploadTitle}>Upload store logo</Text>
                      <Text style={styles.logoUploadHint}>PNG, JPG up to 5MB — skip this for now</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>
                      Store Description <Text style={styles.labelHint}>(optional)</Text>
                    </Text>
                    <TextInput
                      style={[styles.textArea, descFocused && styles.inputFocused]}
                      value={description}
                      onChangeText={setDescription}
                      onFocus={() => setDescFocused(true)}
                      onBlur={() => setDescFocused(false)}
                      placeholder="Tell customers what makes your store special..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      maxLength={300}
                      autoCorrect={false}
                      testID="vendor-onboarding-description"
                    />
                    <Text style={styles.charCount}>{description.length}/300</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
                    onPress={handleStoreContinue}
                    activeOpacity={0.87}
                    disabled={isLoading}
                    testID="vendor-onboarding-store-continue"
                  >
                    {isLoading
                      ? <ActivityIndicator color="#FFFFFF" />
                      : <Text style={styles.primaryButtonText}>Continue</Text>}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={handleSkipStore}
                    activeOpacity={0.7}
                    disabled={isLoading}
                    testID="vendor-onboarding-store-skip"
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
                <Animated.View style={[styles.completeIconWrap, {
                  opacity: completeFadeAnim,
                  transform: [{ scale: completeScaleAnim }],
                }]}>
                  <View style={styles.completeRing}>
                    <View style={styles.completeIconCircle}>
                      <Rocket size={40} color="#FF8C42" strokeWidth={1.5} />
                    </View>
                  </View>
                  <View style={styles.sparkleTopRight}>
                    <Sparkles size={18} color="#F59E0B" strokeWidth={1.5} />
                  </View>
                  <View style={styles.sparkleBottomLeft}>
                    <Sparkles size={14} color="#3B82F6" strokeWidth={1.5} />
                  </View>
                </Animated.View>

                <Animated.View style={{ opacity: completeFadeAnim }}>
                  <Text style={styles.completeTitle}>You're all set 🎉</Text>
                  <Text style={styles.completeSubtitle}>
                    Your store is ready to go live. Let's verify your account and start selling.
                  </Text>

                  <View style={styles.completeSummary}>
                    {[
                      { icon: '🏪', label: businessName || 'Your store' },
                      { icon: '📍', label: [selectedArea?.name, selectedState?.name].filter(Boolean).join(', ') || 'Your location' },
                      { icon: '🏷️', label: selectedCategories.length > 0 ? selectedCategories.map(c => c.name).join(', ') : 'All categories' },
                    ].map((item, i) => (
                      <View key={i} style={styles.completeSummaryRow}>
                        <Text style={styles.completeSummaryIcon}>{item.icon}</Text>
                        <Text style={styles.completeSummaryText} numberOfLines={1}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              </View>

              <View style={styles.completeFooter}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleGotoDashboard}
                  activeOpacity={0.87}
                  testID="vendor-onboarding-dashboard"
                >
                  <Text style={styles.primaryButtonText}>Go to Dashboard</Text>
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
              <TouchableOpacity onPress={() => { setShowCountryModal(false); setCountrySearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
              keyExtractor={item => item.code}
              renderItem={({ item }) => {
                const isSelected = selectedCountry?.code === item.code;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedCountry({ code: item.code, name: item.name, flag: item.flag });
                      setSelectedState(null);
                      setSelectedArea(null);
                      setShowCountryModal(false);
                      setCountrySearch('');
                      if (errors.country) setErrors(p => ({ ...p, country: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalItemFlag}>{item.flag}</Text>
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.name}</Text>
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

      {/* State modal */}
      <Modal visible={showStateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => { setShowStateModal(false); setStateSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={styles.modalSearchInput}
                value={stateSearch}
                onChangeText={setStateSearch}
                placeholder="Search states"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredRegions}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const isSelected = selectedState?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedState(item);
                      setSelectedArea(null);
                      setShowStateModal(false);
                      setStateSearch('');
                      if (errors.state) setErrors(p => ({ ...p, state: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.name}</Text>
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

      {/* Area modal */}
      <Modal visible={showAreaModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Area / City</Text>
              <TouchableOpacity onPress={() => { setShowAreaModal(false); setAreaSearch(''); }} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearch}>
              <Search size={16} color="#9CA3AF" strokeWidth={2} />
              <TextInput
                style={styles.modalSearchInput}
                value={areaSearch}
                onChangeText={setAreaSearch}
                placeholder="Search areas"
                placeholderTextColor="#9CA3AF"
                autoCorrect={false}
              />
            </View>
            <FlatList
              data={filteredAreas}
              keyExtractor={item => item.name}
              renderItem={({ item }) => {
                const isSelected = selectedArea?.name === item.name;
                return (
                  <TouchableOpacity
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={() => {
                      setSelectedArea(item);
                      setShowAreaModal(false);
                      setAreaSearch('');
                      if (errors.city) setErrors(p => ({ ...p, city: undefined }));
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.modalItemText, isSelected && styles.modalItemTextSelected]}>{item.name}</Text>
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

      <SafeAreaView edges={['bottom']} style={styles.safeBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1 },
  safeTop: { backgroundColor: '#FFFFFF' },
  safeBottom: { backgroundColor: '#FFFFFF' },
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  progressContainer: { flex: 1, alignItems: 'center', gap: 6 },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF8C42',
    borderRadius: 2,
  },
  progressLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', letterSpacing: 0.3 },

  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  stepContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },

  stepIconWrap: { alignItems: 'center', marginBottom: 20 },
  stepIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },

  form: { width: '100%' },
  fieldGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 8 },
  labelHint: { fontSize: 13, fontWeight: '400', color: '#9CA3AF' },

  input: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  inputFocused: { borderColor: '#FF8C42', backgroundColor: '#FFFCFA' },
  inputError: { borderColor: '#DC2626' },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6 },

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 60 },
  showPasswordBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  showPasswordText: { fontSize: 14, fontWeight: '600', color: '#FF8C42' },

  agreements: { marginBottom: 24 },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  agreementText: { flex: 1, fontSize: 13, color: '#6B7280', lineHeight: 20 },
  agreementLink: { color: '#FF8C42', fontWeight: '500' },

  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 50,
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderColor: '#FF8C42',
  },
  chipEmoji: { fontSize: 14 },
  chipText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
  chipTextSelected: { color: '#FF8C42', fontWeight: '600' },
  chipCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF8C42',
    alignItems: 'center',
    justifyContent: 'center',
  },

  selector: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
  },
  selectorDimmed: { opacity: 0.5 },
  selectorText: { fontSize: 16, color: '#111827' },
  selectorPlaceholder: { color: '#9CA3AF' },

  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1.5,
    borderColor: '#F3F4F6',
    minHeight: 110,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 12, color: '#9CA3AF', textAlign: 'right', marginTop: 6 },

  logoUploadArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 24,
    alignItems: 'center',
    gap: 6,
  },
  logoUploadIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  logoUploadTitle: { fontSize: 14, fontWeight: '600', color: '#374151' },
  logoUploadHint: { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  primaryButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },

  skipButton: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  skipButtonText: { fontSize: 15, fontWeight: '600', color: '#9CA3AF' },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { fontSize: 14, color: '#9CA3AF' },
  loginLink: { fontSize: 14, fontWeight: '700', color: '#FF8C42' },

  // Entry screen
  entryScreen: { flex: 1, backgroundColor: '#FAFAFA' },
  entryContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryIllustration: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
    position: 'relative',
  },
  entryIconRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,140,66,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryIconInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryBadge: {
    position: 'absolute',
    backgroundColor: '#FFF4ED',
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
  },
  entryBadgeBlue: {
    backgroundColor: '#EFF6FF',
    borderColor: 'rgba(59,130,246,0.2)',
  },
  entryBadgeText: { fontSize: 11, fontWeight: '700', color: '#FF8C42', letterSpacing: 0.3 },

  entryTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
    lineHeight: 34,
  },
  entrySubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 32,
    maxWidth: 300,
  },
  entryFeatures: { gap: 12, alignSelf: 'stretch' },
  entryFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  entryFeatureIcon: { fontSize: 18 },
  entryFeatureText: { fontSize: 14, fontWeight: '500', color: '#374151' },

  entryFooter: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    gap: 4,
  },

  // Complete screen
  completeScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 28,
  },
  completeContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 32,
    gap: 24,
  },
  completeIconWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  completeRing: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,140,66,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleTopRight: { position: 'absolute', top: 6, right: 4 },
  sparkleBottomLeft: { position: 'absolute', bottom: 8, left: 6 },

  completeTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  completeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 24,
  },
  completeSummary: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  completeSummaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  completeSummaryIcon: { fontSize: 18, width: 26 },
  completeSummaryText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#374151' },

  completeFooter: { paddingBottom: 16 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalClose: { fontSize: 15, fontWeight: '600', color: '#FF8C42' },
  modalSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    height: 42,
    gap: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 0 },
  modalList: { paddingHorizontal: 8, paddingBottom: 8 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginHorizontal: 4,
    gap: 10,
  },
  modalItemSelected: { backgroundColor: 'rgba(255,140,66,0.07)' },
  modalItemFlag: { fontSize: 20 },
  modalItemText: { flex: 1, fontSize: 16, color: '#111827' },
  modalItemTextSelected: { color: '#FF8C42', fontWeight: '600' },
});
