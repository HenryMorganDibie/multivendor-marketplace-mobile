import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, Clock3, ArrowRight, Home } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { vendorName, orderId, vendorWasClosed, vendorNextOpenTime } = useLocalSearchParams<{
    vendorName?: string;
    vendorId?: string;
    orderId?: string;
    vendorWasClosed?: string;
    vendorNextOpenTime?: string;
  }>();

  const wasClosed = vendorWasClosed === 'true';

  const handleViewOrder = () => {
    if (orderId) {
      router.replace(`/order/${orderId}` as any);
    } else {
      router.replace('/customer/(tabs)' as any);
    }
  };

  const handleBackHome = () => {
    router.replace('/(tabs)' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <CheckCircle2 size={72} color={Colors.success} strokeWidth={1.5} />
          </View>

          <Text style={styles.title}>Order sent!</Text>
          <Text style={styles.subtitle}>
            {vendorName
              ? `Your order request has been sent to ${vendorName}.`
              : 'Your order request has been sent.'}
          </Text>

          {wasClosed && (
            <View style={styles.noticeCard}>
              <Clock3 size={18} color={Colors.textSecondary} />
              <Text style={styles.noticeText}>
                This store is currently closed
                {vendorNextOpenTime ? ` — it reopens ${vendorNextOpenTime}` : ''}. The vendor
                will still see your request and can confirm once they're back.
              </Text>
            </View>
          )}

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleViewOrder} activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>View Order</Text>
              <ArrowRight size={18} color={Colors.white} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleBackHome} activeOpacity={0.7}>
              <Home size={16} color={Colors.textSecondary} />
              <Text style={styles.secondaryButtonText}>Back to Home</Text>
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
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 28,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  buttonGroup: {
    width: '100%',
    maxWidth: 340,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  secondaryButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
