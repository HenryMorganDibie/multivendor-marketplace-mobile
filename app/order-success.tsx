import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CheckCircle, MessageCircle, Store, Clock, FileText } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { getVendorStorefrontPath } from '@/utils/vendorLookup';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const vendorName = params.vendorName as string || 'the vendor';
  const vendorId = params.vendorId as string || '';
  const orderId = params.orderId as string || '';
  const vendorWasClosed = params.vendorWasClosed === 'true';
  const vendorNextOpenTime = params.vendorNextOpenTime as string || '';

  const checkScale = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const stepsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(checkScale, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(stepsOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(buttonsOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleOpenChat = () => {
    if (vendorWasClosed) {
      console.log('[OrderSuccess] Vendor was closed, navigating to order details instead of chat');
      router.replace({
        pathname: '/order/[id]' as any,
        params: { id: orderId, fromSubmission: 'true' },
      });
      return;
    }
    if (orderId) {
      console.log('[OrderSuccess] Opening order chat for:', orderId);
      router.replace(`/chat/order/${orderId}` as any);
    } else {
      router.replace('/' as any);
    }
  };

  const handleViewOrderDetails = () => {
    router.replace({
      pathname: '/order/[id]' as any,
      params: { id: orderId, fromSubmission: 'true' },
    });
  };

  const handleBackToStorefront = () => {
    if (vendorId) {
      const path = getVendorStorefrontPath(vendorId);
      console.log('[OrderSuccess] Back to storefront:', path);
      router.replace(path as any);
    } else {
      router.replace('/' as any);
    }
  };

  const steps = vendorWasClosed
    ? [
        {
          number: '1',
          title: `${vendorName} will review when they reopen`,
          description: vendorNextOpenTime
            ? `Expected to reopen ${vendorNextOpenTime}.`
            : 'They will review your order once they are back online.',
        },
        {
          number: '2',
          title: 'You will be notified when they respond',
          description: 'The vendor may accept, decline, or request changes.',
        },
        {
          number: '3',
          title: 'Payment is handled directly with the vendor',
          description: 'The vendor will share payment instructions after accepting.',
        },
      ]
    : [
        {
          number: '1',
          title: 'Vendor reviews your order',
          description: 'They will check availability and confirm details.',
        },
        {
          number: '2',
          title: 'Vendor may accept, decline, or request changes',
          description: 'You will be notified in the order chat.',
        },
        {
          number: '3',
          title: 'Payment is handled directly with the vendor',
          description: 'The vendor will share payment instructions.',
        },
      ];

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View style={[styles.checkContainer, { transform: [{ scale: checkScale }] }]}>
            <View style={styles.checkCircle}>
              <CheckCircle size={48} color={Colors.white} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.textContainer, { opacity: contentOpacity }]}>
            <Text style={styles.title}>Order request sent</Text>
            <Text style={styles.subtitle}>
              {vendorWasClosed
                ? `${vendorName} is currently closed and will review your order when they reopen${vendorNextOpenTime ? ` ${vendorNextOpenTime}` : ''}.`
                : `${vendorName} has received your request.`}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.stepsContainer, { opacity: stepsOpacity }]}>
            <Text style={styles.stepsTitle}>What happens next</Text>
            {steps.map((step, index) => (
              <View key={step.number} style={styles.stepRow}>
                <View style={styles.stepNumberWrap}>
                  <Text style={styles.stepNumber}>{step.number}</Text>
                  {index < steps.length - 1 && <View style={styles.stepLine} />}
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          <Animated.View style={[styles.buttonsContainer, { opacity: buttonsOpacity }]}>
            {vendorWasClosed ? (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleViewOrderDetails}
                  activeOpacity={0.85}
                >
                  <FileText size={18} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>View order details</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleBackToStorefront}
                  activeOpacity={0.7}
                >
                  <Store size={16} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>Back to storefront</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleOpenChat}
                  activeOpacity={0.85}
                >
                  <MessageCircle size={18} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>Open order chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleBackToStorefront}
                  activeOpacity={0.7}
                >
                  <Store size={16} color={Colors.text} />
                  <Text style={styles.secondaryButtonText}>Back to storefront</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkContainer: {
    marginBottom: 24,
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: { elevation: 8 },
    }),
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 18,
    padding: 20,
    marginBottom: 32,
  },
  stepsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row' as const,
    gap: 14,
    marginBottom: 4,
  },
  stepNumberWrap: {
    alignItems: 'center' as const,
    width: 28,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700' as const,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  stepLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
    minHeight: 16,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 14,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
    lineHeight: 20,
  },
  stepDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    minHeight: 52,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.surface,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
