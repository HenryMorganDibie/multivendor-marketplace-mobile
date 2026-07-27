import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingBag, Store } from 'lucide-react-native';
import { useCountryStatus } from '@/contexts/CountryStatusContext';

type RoleOption = 'customer' | 'vendor' | null;

export default function OnboardingScreen() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<RoleOption>(null);

  const countryStatus = useCountryStatus();

  useEffect(() => {
    if (countryStatus.isComingSoon) {
      console.log('[ONBOARDING] Country status is COMING_SOON, redirecting');
      router.replace({
        pathname: '/coming-soon' as any,
        params: {
          countryName: countryStatus.countryName,
          launchTimeline: countryStatus.launchTimeline || '',
        },
      });
    }
  }, [router, countryStatus.isComingSoon, countryStatus.countryName, countryStatus.launchTimeline]);

  const handleContinue = () => {
    if (countryStatus.isComingSoon) {
      router.push({
        pathname: '/coming-soon' as any,
        params: {
          countryName: countryStatus.countryName,
          launchTimeline: countryStatus.launchTimeline || '',
        },
      });
      return;
    }

    if (selectedRole === 'customer') {
      console.log('[ONBOARDING] Customer selected');
      router.push('/onboarding-customer' as any);
    } else if (selectedRole === 'vendor') {
      console.log('[ONBOARDING] Vendor selected');
      router.push('/onboarding-vendor' as any);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brandName}>THE PLATFORM</Text>
            <Text style={styles.title}>Welcome to the platform</Text>
            <Text style={styles.subtitle}>Choose how you want to continue</Text>
          </View>

          <View style={styles.cardsContainer}>
            <TouchableOpacity
              style={[
                styles.card,
                selectedRole === 'customer' && styles.cardSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedRole('customer')}
              testID="onboarding-customer-card"
            >
              <View style={[
                styles.cardIcon,
                selectedRole === 'customer' && styles.cardIconSelected,
              ]}>
                <ShoppingBag
                  size={24}
                  color={selectedRole === 'customer' ? '#FF8C42' : '#2B2B2B'}
                  strokeWidth={1.8}
                />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>I want to shop</Text>
                <Text style={styles.cardDescription}>Browse and order from verified vendors</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.card,
                selectedRole === 'vendor' && styles.cardSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedRole('vendor')}
              testID="onboarding-vendor-card"
            >
              <View style={[
                styles.cardIcon,
                selectedRole === 'vendor' && styles.cardIconSelected,
              ]}>
                <Store
                  size={24}
                  color={selectedRole === 'vendor' ? '#FF8C42' : '#2B2B2B'}
                  strokeWidth={1.8}
                />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>I want to sell</Text>
                <Text style={styles.cardDescription}>Set up your store and start earning</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomArea}>
            <TouchableOpacity
              style={[
                styles.continueButton,
                !selectedRole && styles.continueButtonDisabled,
              ]}
              onPress={handleContinue}
              activeOpacity={0.85}
              disabled={!selectedRole}
              testID="onboarding-continue"
            >
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.loginLink}
              activeOpacity={0.7}
              onPress={() => router.push('/login' as any)}
            >
              <Text style={styles.loginLinkText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center' as const,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center' as const,
  },
  brandName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    letterSpacing: 3,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center' as const,
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  cardSelected: {
    borderColor: '#FF8C42',
    backgroundColor: 'rgba(255,140,66,0.04)',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 16,
  },
  cardIconSelected: {
    backgroundColor: 'rgba(255,140,66,0.1)',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomArea: {
    paddingBottom: 16,
  },
  continueButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  loginLink: {
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  loginLinkText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#FF8C42',
  },
});
