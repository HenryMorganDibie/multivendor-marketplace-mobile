import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const router = useRouter();
  const { user, isLoading, hasSeenOnboarding } = useAuth();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    console.log('[INDEX] Auth state:', { user: user?.id, role: user?.role, isLoading, hasSeenOnboarding });

    if (!hasSeenOnboarding) {
      console.log('[INDEX] First time user, showing onboarding');
      router.replace('/onboarding' as any);
      return;
    }

    if (!user) {
      console.log('[INDEX] No user, redirecting to login');
      router.replace('/login' as any);
      return;
    }

    if (user.role === 'customer') {
      console.log('[INDEX] Customer detected, redirecting to customer chats');
      router.replace('/customer/(tabs)/chats' as any);
    } else if (user.role === 'vendor') {
      const vs: string | undefined = user.vendorStatus;
      if (vs === 'pending') {
        console.log('[INDEX] Vendor pending verification, redirecting to verification required screen');
        router.replace('/vendor-verification-required' as any);
      } else if (vs === 'suspended' || vs === 'deactivated') {
        console.log('[INDEX] Vendor suspended/deactivated, redirecting to verification hub');
        router.replace('/vendor/settings/verification' as any);
      } else if (vs === 'approved' || vs === 'ACTIVE' || vs === 'active') {
        console.log('[INDEX] Vendor approved, redirecting to vendor dashboard');
        router.replace('/vendor/(tabs)/dashboard' as any);
      } else {
        console.log('[INDEX] Vendor status unknown, redirecting to login');
        router.replace('/login' as any);
      }
    } else {
      console.log('[INDEX] Unknown role, redirecting to login');
      router.replace('/login' as any);
    }
  }, [user, isLoading, hasSeenOnboarding, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
