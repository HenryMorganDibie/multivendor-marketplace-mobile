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
import { ShieldCheck, CreditCard, MessageCircle, MapPin } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  title: string;
  body: string;
  icon: 'shield' | 'credit' | 'message' | 'map';
}

const slides: Slide[] = [
  {
    icon: 'shield',
    title: 'Shop from verified vendors only',
    body: 'Every vendor on the platform is reviewed and verified before they can sell.',
  },
  {
    icon: 'credit',
    title: 'You pay vendors directly',
    body: 'No middlemen. No commissions. Vendors receive payments directly.',
  },
  {
    icon: 'message',
    title: 'Chat, order & track in one place',
    body: 'Ask questions, place orders, and stay updated, all in one secure chat.',
  },
  {
    icon: 'map',
    title: 'Discover trusted vendors near you',
    body: 'Food, fashion, beauty, services and more, all verified and local.',
  },
];

function SlideIcon({ type }: { type: Slide['icon'] }) {
  const iconProps = { size: 40, color: '#FF8C42', strokeWidth: 1.5 };
  switch (type) {
    case 'shield': return <ShieldCheck {...iconProps} />;
    case 'credit': return <CreditCard {...iconProps} />;
    case 'message': return <MessageCircle {...iconProps} />;
    case 'map': return <MapPin {...iconProps} />;
  }
}

export default function OnboardingCustomerScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const countryStatus = useCountryStatus();

  useEffect(() => {
    if (countryStatus.isComingSoon) {
      console.log('[ONBOARDING_CUSTOMER] Country is COMING_SOON, redirecting');
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
    console.log('[ONBOARDING] Customer create account tapped');
    router.push('/register/customer' as any);
  };

  const handleLogin = () => {
    console.log('[ONBOARDING] Customer login tapped');
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
            testID="onboarding-customer-create"
          >
            <Text style={styles.createAccountButtonText}>Create account</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            activeOpacity={0.7}
            testID="onboarding-customer-login"
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
