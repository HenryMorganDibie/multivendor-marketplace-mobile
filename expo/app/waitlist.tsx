import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Clock } from 'lucide-react-native';

export default function WaitlistScreen() {
  const router = useRouter();

  const handleBackToLogin = () => {
    console.log('[WAITLIST] Back to login');
    router.replace('/login' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Clock size={48} color={Colors.primary} strokeWidth={2} />
          </View>

          <Text style={styles.title}>You're on the waitlist</Text>
          
          <Text style={styles.body}>
            the platform is currently in limited availability in your country. You can create a vendor account, but storefront creation and menu publishing are not yet available.
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What you can do now:</Text>
            <Text style={styles.infoItem}>• Create and verify your vendor account</Text>
            <Text style={styles.infoItem}>• Complete your business information</Text>
            <Text style={styles.infoItem}>• Get ready for launch</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Coming soon:</Text>
            <Text style={styles.infoItem}>• Storefront creation</Text>
            <Text style={styles.infoItem}>• Menu and catalog publishing</Text>
            <Text style={styles.infoItem}>• Discovery and customer orders</Text>
          </View>

          <Text style={styles.timeline}>
            We'll notify you as soon as full vendor features launch in your country.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleBackToLogin}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back to login</Text>
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
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 0, 0.3)',
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
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 32,
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 4,
  },
  timeline: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center' as const,
    marginTop: 16,
    marginBottom: 32,
    fontWeight: '500' as const,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
