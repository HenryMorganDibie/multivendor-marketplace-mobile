import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Star, ThumbsUp, ThumbsDown, ChevronLeft, Lock, CheckCircle } from 'lucide-react-native';
import { Image } from 'expo-image';
import { Colors } from '@/constants/colors';
import { useOrders } from '@/contexts/OrdersContext';
import { useReviews } from '@/contexts/ReviewsContext';
import { Alert } from '@/utils/alert';

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'];
const STAR_COLORS = ['', '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E'];

export default function RateOrderScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { getOrder, markOrderRated } = useOrders();
  const { submitReview } = useReviews();

  const order = getOrder(orderId ?? '');

  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [itemRatings, setItemRatings] = useState<Record<string, 'good' | 'bad' | null>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const starScales = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(1))).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const handleStarPress = useCallback(
    (star: number) => {
      setStars(star);
      starScales.forEach((anim, i) => {
        if (i < star) {
          Animated.sequence([
            Animated.timing(anim, { toValue: 1.25, duration: 70, useNativeDriver: true }),
            Animated.spring(anim, { toValue: 1, friction: 5, useNativeDriver: true }),
          ]).start();
        } else {
          Animated.timing(anim, { toValue: 1, duration: 100, useNativeDriver: true }).start();
        }
      });
    },
    [starScales]
  );

  const handleItemRating = useCallback((itemId: string, value: 'good' | 'bad') => {
    setItemRatings((prev) => ({
      ...prev,
      [itemId]: prev[itemId] === value ? null : value,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (stars === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }
    if (!order) return;

    setIsSubmitting(true);

    const cleanedItemRatings: Record<string, 'good' | 'bad'> = {};
    Object.entries(itemRatings).forEach(([id, val]) => {
      if (val !== null) cleanedItemRatings[id] = val;
    });

    const ref = order.publicOrderId.replace(/[^0-9]/g, '').slice(0, 4);
    submitReview({
      id: `rev-${Date.now()}`,
      orderId: order.id,
      publicOrderId: order.publicOrderId,
      vendorId: order.vendorId,
      vendorName: order.vendorName,
      stars,
      feedback: feedback.trim() || undefined,
      itemRatings: Object.keys(cleanedItemRatings).length > 0 ? cleanedItemRatings : undefined,
      submittedAt: new Date().toISOString(),
      orderReference: `Order ${ref}••••`,
    });

    markOrderRated(order.id);

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, 400);
  }, [stars, order, itemRatings, feedback, submitReview, markOrderRated, successScale, successOpacity]);

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rate Order</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>Order not found.</Text>
        </View>
      </View>
    );
  }

  if (submitted) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top', 'bottom']} style={styles.successContainer}>
          <Animated.View
            style={[styles.successContent, { opacity: successOpacity, transform: [{ scale: successScale }] }]}
          >
            <View style={styles.successIconWrap}>
              <CheckCircle size={56} color={Colors.success} fill={Colors.success} strokeWidth={0} />
            </View>
            <Text style={styles.successTitle}>Thank you!</Text>
            <Text style={styles.successSubtitle}>
              Your rating has been submitted to {order.vendorName}.
            </Text>
            <View style={styles.successStarsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={28}
                  color={s <= stars ? Colors.star : Colors.border}
                  fill={s <= stars ? Colors.star : 'transparent'}
                />
              ))}
            </View>
            <View style={styles.successPrivacyNote}>
              <Lock size={13} color={Colors.textMuted} />
              <Text style={styles.successPrivacyText}>
                Your feedback is private and only visible to {order.vendorName}.
              </Text>
            </View>
          </Animated.View>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  const starColor = stars > 0 ? STAR_COLORS[stars] : Colors.border;
  const starLabel = stars > 0 ? STAR_LABELS[stars] : '';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate Order</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.vendorCard}>
          <View style={styles.vendorCardRow}>
            <View style={styles.vendorAvatarWrap}>
              <Text style={styles.vendorAvatarLetter}>{order.vendorName.charAt(0)}</Text>
            </View>
            <View style={styles.vendorCardInfo}>
              <Text style={styles.vendorCardName}>{order.vendorName}</Text>
              <Text style={styles.vendorCardRef}>
                {new Date(order.orderDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR RATING</Text>
          <View style={styles.starsCard}>
            <Text style={styles.starsPrompt}>How was your overall experience?</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Animated.View
                  key={s}
                  style={{ transform: [{ scale: starScales[s - 1] }] }}
                >
                  <TouchableOpacity
                    onPress={() => handleStarPress(s)}
                    style={styles.starBtn}
                    activeOpacity={0.7}
                  >
                    <Star
                      size={44}
                      color={s <= stars ? STAR_COLORS[stars] : Colors.border}
                      fill={s <= stars ? STAR_COLORS[stars] : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
            {stars > 0 && (
              <Text style={[styles.starLabel, { color: starColor }]}>{starLabel}</Text>
            )}
          </View>
        </View>

        {order.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>RATE ITEMS</Text>
            <View style={styles.itemsCard}>
              <Text style={styles.itemsHint}>How were the individual items? (optional)</Text>
              {order.items.map((item, index) => {
                const val = itemRatings[item.id] ?? null;
                const isLast = index === order.items.length - 1;
                return (
                  <View key={`${item.id}-${index}`}>
                    <View style={styles.itemRow}>
                      <View style={styles.itemImageWrap}>
                        {item.image ? (
                          <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                        ) : (
                          <View style={styles.itemImageFallback}>
                            <Text style={styles.itemImageInitial}>{item.name.charAt(0)}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                      <View style={styles.itemThumbBtns}>
                        <TouchableOpacity
                          style={[styles.thumbBtn, val === 'good' && styles.thumbBtnGood]}
                          onPress={() => handleItemRating(item.id, 'good')}
                          activeOpacity={0.7}
                        >
                          <ThumbsUp
                            size={18}
                            color={val === 'good' ? '#16A34A' : Colors.textMuted}
                            fill={val === 'good' ? '#16A34A' : 'none'}
                            strokeWidth={1.8}
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.thumbBtn, val === 'bad' && styles.thumbBtnBad]}
                          onPress={() => handleItemRating(item.id, 'bad')}
                          activeOpacity={0.7}
                        >
                          <ThumbsDown
                            size={18}
                            color={val === 'bad' ? Colors.error : Colors.textMuted}
                            fill={val === 'bad' ? Colors.error : 'none'}
                            strokeWidth={1.8}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {!isLast && <View style={styles.itemDivider} />}
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FEEDBACK</Text>
          <View style={styles.feedbackCard}>
            <View style={styles.feedbackPrivacyRow}>
              <Lock size={13} color={Colors.textMuted} />
              <Text style={styles.feedbackPrivacyText}>
                Only visible to {order.vendorName} — not posted publicly.
              </Text>
            </View>
            <TextInput
              style={styles.feedbackInput}
              placeholder="Share details about your experience (optional)"
              placeholderTextColor={Colors.textMuted}
              value={feedback}
              onChangeText={setFeedback}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={500}
            />
            {feedback.length > 400 && (
              <Text style={styles.charCount}>{feedback.length}/500</Text>
            )}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.safeBottom}>
        <View style={styles.submitBar}>
          <TouchableOpacity
            style={[
              styles.submitBtn,
              stars === 0 && styles.submitBtnDisabled,
              isSubmitting && styles.submitBtnDisabled,
            ]}
            onPress={handleSubmit}
            disabled={stars === 0 || isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={[styles.submitBtnText, stars === 0 && styles.submitBtnTextDisabled]}>
              {isSubmitting ? 'Submitting…' : 'Submit Rating'}
            </Text>
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
  safeTop: {
    backgroundColor: Colors.background,
  },
  safeBottom: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  vendorCard: {
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  vendorCardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  vendorAvatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  vendorAvatarLetter: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  vendorCardInfo: {
    flex: 1,
    gap: 3,
  },
  vendorCardName: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  vendorCardRef: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  starsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 24,
    alignItems: 'center' as const,
  },
  starsPrompt: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
    textAlign: 'center' as const,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 12,
  },
  starBtn: {
    padding: 4,
  },
  starLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  itemsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  itemsHint: {
    fontSize: 13,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  itemImageWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden' as const,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImageFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.border,
  },
  itemImageInitial: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  itemThumbBtns: {
    flexDirection: 'row' as const,
    gap: 8,
    flexShrink: 0,
  },
  thumbBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  thumbBtnGood: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  thumbBtnBad: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  feedbackCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  feedbackPrivacyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  feedbackPrivacyText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  feedbackInput: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 110,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  bottomSpacer: {
    height: 20,
  },
  submitBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.primaryDisabled,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  submitBtnTextDisabled: {
    color: 'rgba(255,255,255,0.6)',
  },
  successContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  successContent: {
    alignItems: 'center' as const,
    width: '100%',
  },
  successIconWrap: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  successStarsRow: {
    flexDirection: 'row' as const,
    gap: 6,
    marginBottom: 20,
  },
  successPrivacyNote: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  successPrivacyText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 17,
  },
  doneBtn: {
    position: 'absolute' as const,
    bottom: 40,
    left: 32,
    right: 32,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
