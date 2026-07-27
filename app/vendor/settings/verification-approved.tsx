import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

export default function VerificationApprovedScreen() {
  const router = useRouter();

  const handleGoToDashboard = () => {
    console.log('[VERIFICATION] Approved - navigating to dashboard');
    router.push('/vendor/(tabs)/dashboard');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verification" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <CheckCircle size={80} color={Colors.success} strokeWidth={2} />
          </View>

          <Text style={styles.title}>Verification complete ✅</Text>
          
          <Text style={styles.body}>
            Your identity has been verified. You can now start setting up your store.
          </Text>

          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handleGoToDashboard}
            activeOpacity={0.8}
          >
            <Text style={styles.ctaButtonText}>Go to dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.successLight,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 32,
    borderWidth: 2,
    borderColor: Colors.successBorder,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 40,
  },
  ctaButton: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  ctaButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
