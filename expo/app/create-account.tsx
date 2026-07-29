import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShoppingBag, Store, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

type RoleOption = 'customer' | 'vendor' | null;

export default function CreateAccountScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleOption>(null);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      console.log('[AUTH GUARD] User already authenticated, redirecting to login');
      router.replace('/login' as any);
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  if (isAuthenticated) {
    return null;
  }

  const handleContinue = () => {
    if (selectedRole === 'customer') {
      console.log('[AUTH FLOW] Role selected: Customer → navigating to /register/customer');
      router.push('/register/customer' as any);
    } else if (selectedRole === 'vendor') {
      console.log('[AUTH FLOW] Role selected: Vendor → navigating to /register/vendor');
      router.push('/register/vendor' as any);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Create an account</Text>
            <Text style={styles.subtitle}>Choose how you want to use the platform</Text>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedRole === 'customer' && styles.optionCardSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedRole('customer')}
              testID="role-customer-card"
            >
              <View style={[
                styles.iconWrap,
                selectedRole === 'customer' && styles.iconWrapSelected,
              ]}>
                <ShoppingBag
                  size={24}
                  color={selectedRole === 'customer' ? '#FF8C42' : '#2B2B2B'}
                  strokeWidth={1.8}
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Customer</Text>
                <Text style={styles.optionDescription}>
                  Discover vendors, place orders and manage your purchases.
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.optionCard,
                selectedRole === 'vendor' && styles.optionCardSelected,
              ]}
              activeOpacity={0.8}
              onPress={() => setSelectedRole('vendor')}
              testID="role-vendor-card"
            >
              <View style={[
                styles.iconWrap,
                selectedRole === 'vendor' && styles.iconWrapSelected,
              ]}>
                <Store
                  size={24}
                  color={selectedRole === 'vendor' ? '#FF8C42' : '#2B2B2B'}
                  strokeWidth={1.8}
                />
              </View>
              <View style={styles.optionTextWrap}>
                <Text style={styles.optionTitle}>Vendor</Text>
                <Text style={styles.optionDescription}>
                  Showcase your business, manage orders and chat with customers.
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              !selectedRole && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!selectedRole}
            testID="role-continue-button"
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>

          <View style={styles.bottomSection}>
            <Text style={styles.bottomText}>Already have an account? </Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.replace('/login' as any)}
            >
              <Text style={styles.bottomLink}>Log in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center' as const,
  },
  content: {
    paddingHorizontal: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center' as const,
  },
  header: {
    marginBottom: 40,
    alignItems: 'center' as const,
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
  optionsContainer: {
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  optionCardSelected: {
    borderColor: '#FF8C42',
    backgroundColor: 'rgba(255,140,66,0.04)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F8F9FA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 16,
  },
  iconWrapSelected: {
    backgroundColor: 'rgba(255,140,66,0.1)',
  },
  optionTextWrap: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  continueButton: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
});
