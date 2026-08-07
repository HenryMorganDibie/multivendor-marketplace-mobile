import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { useOrders } from '@/contexts/OrdersContext';
import { callable } from '@/lib/firebase';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

const MAX_FEEDBACK_LENGTH = 1000;

export default function RateOrderScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { getOrder } = useOrders();
  const order = getOrder(orderId);

  const [stars, setStars] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleMaybeLater = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (stars === 0) return;
    setIsSubmitting(true);
    try {
      const submitRating = callable<
        { orderId: string; stars: number; privateFeedback?: string },
        { success: true; ratingId: string; displayId: string }
      >('submitRating');
      await submitRating({
        orderId,
        stars,
        ...(feedback.trim().length > 0 ? { privateFeedback: feedback.trim() } : {}),
      });
      router.back();
    } catch (error) {
      console.error('[RATE_ORDER] Submission failed:', error);
      const message = (error as { message?: string })?.message
        ?? 'Could not submit your rating. Please try again.';
      Alert.alert('Submission failed', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Rate your order" onBack={handleMaybeLater} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {order?.vendorName ? `How was your order from ${order.vendorName}?` : 'How was your order?'}
            </Text>
            <Text style={styles.description}>
              Your rating helps other customers, and helps this vendor improve.
            </Text>
          </View>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <TouchableOpacity
                key={value}
                onPress={() => setStars(value)}
                activeOpacity={0.7}
                testID={`rate-star-${value}`}
              >
                <Star
                  size={40}
                  color={value <= stars ? Colors.primary : Colors.border}
                  fill={value <= stars ? Colors.primary : 'transparent'}
                  strokeWidth={1.5}
                />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.feedbackBlock}>
            <Text style={styles.feedbackLabel}>Private feedback (optional)</Text>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Anything you'd like us to know?"
              placeholderTextColor={Colors.textMuted}
              value={feedback}
              onChangeText={(text) => setFeedback(text.slice(0, MAX_FEEDBACK_LENGTH))}
              multiline
              numberOfLines={4}
              maxLength={MAX_FEEDBACK_LENGTH}
              testID="rate-feedback-input"
            />
            <Text style={styles.feedbackNote}>
              Visible only to your business and the platform administrators. Not displayed publicly.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity onPress={handleMaybeLater} activeOpacity={0.7} testID="rate-order-later">
            <Text style={styles.laterText}>Maybe later</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, stars === 0 && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.7}
            disabled={stars === 0 || isSubmitting}
            testID="rate-order-submit"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={[styles.submitButtonText, stars === 0 && styles.submitButtonTextDisabled]}>
                Submit rating
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  header: { marginTop: 24, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.text, marginBottom: 8 },
  description: { fontSize: 15, color: Colors.textSecondary, lineHeight: 22 },
  starsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    gap: 12,
    marginTop: 32,
    marginBottom: 8,
  },
  feedbackBlock: { marginTop: 32 },
  feedbackLabel: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 8 },
  feedbackInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top' as const,
    backgroundColor: Colors.surface,
  },
  feedbackNote: { fontSize: 12.5, color: Colors.textMuted, marginTop: 8, lineHeight: 17 },
  bottomSpacer: { height: 100 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  laterText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  submitButtonDisabled: { backgroundColor: Colors.surface },
  submitButtonText: { fontSize: 17, fontWeight: '600' as const, color: Colors.white },
  submitButtonTextDisabled: { color: Colors.textMuted },
});
