import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { Banknote, Wallet, ShieldCheck, MessageSquare, Settings } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  title: string;
  body: string;
  icon: 'banknote' | 'wallet' | 'shield' | 'message' | 'settings';
}

const slides: Slide[] = [
  {
    icon: 'banknote',
    title: 'Sell without commissions',
    body: 'the platform never takes a cut from your sales. You keep 100% of what you earn.',
  },
  {
    icon: 'wallet',
    title: 'Get paid directly by customers',
    body: 'Payments go straight to you. No holding, no delays.',
  },
  {
    icon: 'shield',
    title: 'Verification builds trust',
    body: 'All vendors complete identity and business verification before selling.',
  },
  {
    icon: 'message',
    title: 'Manage orders in chat',
    body: 'Send payment info, invoices, receipts, and pickup details in one place.',
  },
  {
    icon: 'settings',
    title: 'You control your business',
    body: 'Set your hours, pricing, delivery options, and availability. Your rules.',
  },
];

function SlideIcon({ type }: { type: Slide['icon'] }) {
  const iconProps = { size: 40, color: '#FF8C42', strokeWidth: 1.5 };
  switch (type) {
    case 'banknote': return <Banknote {...iconProps} />;
    case 'wallet': return <Wallet {...iconProps} />;
    case 'shield': return <ShieldCheck {...iconProps} />;
    case 'message': return <MessageSquare {...iconProps} />;
    case 'settings': return <Settings {...iconProps} />;
  }
}

export default function OnboardingVendorScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const countryStatus = useCountryStatus();

  useEffect(() => {
    if (countryStatus.isComingSoon) {
      console.log('[ONBOARDING_VENDOR] Country is COMING_SOON, redirecting');
      router.replace({
        pathname: '/coming-soon' as any,
        params: {
          countryName: countryStatus.countryName,
          launchTimeline: countryStatus.launchTimeline || '',
        },
      });
    }
  }, [router, countryStatus.isComingSoon, countryStatus.countryName, countryStatus.launchTimeline]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const handleCreateAccount = () => {
    console.log('[ONBOARDING] Vendor create account tapped');
    router.push('/register/vendor' as any);
  };

  const handleLogin = () => {
    console.log('[ONBOARDING] Vendor login tapped');
    router.push('/login' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
        >
          {slides.map((slide, index) => (
            <View key={index} style={styles.slide}>
              <View style={styles.iconCircle}>
                <SlideIcon type={slide.icon} />
              </View>
              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.body}>{slide.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dotsContainer}>
            {slides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === currentIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={handleCreateAccount}
            activeOpacity={0.85}
            testID="onboarding-vendor-create"
          >
            <Text style={styles.createAccountButtonText}>Create vendor account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.7}
            testID="onboarding-vendor-login"
          >
            <Text style={styles.loginButtonText}>Already have an account? Log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 12,
    lineHeight: 32,
  },
  body: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 24,
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  dotsContainer: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: '#FF8C42',
    width: 24,
  },
  inactiveDot: {
    backgroundColor: '#E5E7EB',
    width: 8,
  },
  createAccountButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  createAccountButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  loginButton: {
    height: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#FF8C42',
  },
});
