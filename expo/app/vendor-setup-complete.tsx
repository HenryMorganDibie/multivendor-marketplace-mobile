import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Animated,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PartyPopper, ArrowRight, FileText } from 'lucide-react-native';
import { useVendor } from '@/contexts/VendorContext';
import { callable } from '@/lib/firebase';

type Phase = 'optional' | 'complete';

export default function VendorSetupCompleteScreen() {
  const router = useRouter();
  const { updateVendor } = useVendor();

  const [phase, setPhase] = useState<Phase>('optional');
  const [description, setDescription] = useState('');
  const [descFocused, setDescFocused] = useState(false);

  const celebrateScale = useRef(new Animated.Value(0)).current;
  const celebrateOpacity = useRef(new Animated.Value(0)).current;
  const contentSlide = useRef(new Animated.Value(40)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'complete') {
      Animated.parallel([
        Animated.spring(celebrateScale, {
          toValue: 1,
          tension: 50,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(celebrateOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(contentSlide, {
          toValue: 0,
          duration: 500,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 500,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [phase, celebrateScale, celebrateOpacity, contentSlide, contentOpacity]);

  const handleSkip = () => {
    console.log('[VENDOR_SETUP] Skipping optional setup');
    setPhase('complete');
  };

  const handleSaveAndContinue = async () => {
    const trimmed = description.trim();
    if (trimmed) {
      console.log('[VENDOR_SETUP] Saving description:', trimmed);
      try {
        // updateVendorStorefront already exists and already accepts
        // description — this screen was the one caller still writing it
        // through updateVendor()'s AsyncStorage-only path, so an onboarding
        // description never reached vendors/{vendorId} and no customer ever
        // saw it.
        const update = callable<{ description: string }, { success: true }>('updateVendorStorefront');
        await update({ description: trimmed });
        updateVendor({ description: trimmed });
      } catch (err) {
        console.error('[VENDOR_SETUP] updateVendorStorefront failed:', err);
      }
    }
    setPhase('complete');
  };

  const handleGoToDashboard = () => {
    console.log('[VENDOR_SETUP] Navigating to dashboard');
    router.replace('/vendor/(tabs)/dashboard' as any);
  };

  if (phase === 'complete') {
    return (
      <View style={styles.completeContainer}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.completeSafe}>
          <View style={styles.completeContent}>
            <Animated.View
              style={[
                styles.celebrateIconWrap,
                {
                  transform: [{ scale: celebrateScale }],
                  opacity: celebrateOpacity,
                },
              ]}
            >
              <View style={styles.celebrateCircleOuter}>
                <View style={styles.celebrateCircleInner}>
                  <PartyPopper size={40} color="#FF8C42" strokeWidth={1.5} />
                </View>
              </View>
            </Animated.View>

            <Animated.View
              style={[
                styles.completeTextWrap,
                {
                  transform: [{ translateY: contentSlide }],
                  opacity: contentOpacity,
                },
              ]}
            >
              <Text style={styles.completeTitle}>You're all set!</Text>
              <Text style={styles.completeSubtitle}>
                Your store is ready. Start adding products and connect with customers.
              </Text>
            </Animated.View>

            <Animated.View
              style={[
                styles.completeButtonWrap,
                {
                  opacity: contentOpacity,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.dashboardButton}
                onPress={handleGoToDashboard}
                activeOpacity={0.85}
                testID="vendor-setup-go-dashboard"
              >
                <Text style={styles.dashboardButtonText}>Go to Dashboard</Text>
                <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.topBarSpacer} />
          <TouchableOpacity
            onPress={handleSkip}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            testID="vendor-setup-skip"
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <FileText size={28} color="#FF8C42" strokeWidth={1.5} />
              </View>
            </View>

            <View style={styles.header}>
              <Text style={styles.optionalBadge}>Optional</Text>
              <Text style={styles.title}>Add more about your business</Text>
              <Text style={styles.subtitle}>
                This helps customers know what to expect. You can always add this later.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.inputSection}>
                <Text style={styles.label}>Business Description</Text>
                <TextInput
                  style={[
                    styles.textArea,
                    descFocused && styles.textAreaFocused,
                  ]}
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  placeholder="Tell customers what you offer, your specialties, etc."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={300}
                  testID="vendor-setup-description"
                />
                <Text style={styles.charCount}>{description.length}/300</Text>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveAndContinue}
                activeOpacity={0.85}
                testID="vendor-setup-save-continue"
              >
                <Text style={styles.primaryButtonText}>
                  {description.trim() ? 'Save & Continue' : 'Continue'}
                </Text>
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
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  topBarSpacer: {
    width: 40,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#9CA3AF',
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
  iconContainer: {
    alignItems: 'center' as const,
    marginBottom: 20,
    marginTop: 20,
  },
  iconCircle: {
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
  optionalBadge: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
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
    paddingHorizontal: 8,
  },
  form: {
    width: '100%',
  },
  inputSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#2B2B2B',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  textArea: {
    backgroundColor: '#F7F7F8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#2B2B2B',
    borderWidth: 1,
    borderColor: '#EEEEEE',
    minHeight: 120,
  },
  textAreaFocused: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFFBF8',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right' as const,
    marginTop: 6,
  },
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
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  completeContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  completeSafe: {
    flex: 1,
  },
  completeContent: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  celebrateIconWrap: {
    marginBottom: 32,
  },
  celebrateCircleOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,140,66,0.08)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  celebrateCircleInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  completeTextWrap: {
    alignItems: 'center' as const,
    marginBottom: 48,
  },
  completeTitle: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  completeSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 24,
    maxWidth: 300,
  },
  completeButtonWrap: {
    width: '100%',
    maxWidth: 340,
  },
  dashboardButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 56,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  dashboardButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
