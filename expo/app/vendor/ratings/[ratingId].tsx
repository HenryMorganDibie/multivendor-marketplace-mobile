import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Star, Lock, ThumbsUp, ThumbsDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useReviews } from '@/contexts/ReviewsContext';

export default function RatingDetailScreen() {
  const { ratingId } = useLocalSearchParams<{ ratingId: string }>();
  const { getReviewById, markReviewRead } = useReviews();
  const review = getReviewById(ratingId ?? '');

  // Mark as read when vendor opens the detail screen
  useEffect(() => {
    if (ratingId) {
      markReviewRead(ratingId);
    }
  }, [ratingId, markReviewRead]);

  const renderStars = (count: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={22}
          color={star <= count ? Colors.star : Colors.borderDark}
          fill={star <= count ? Colors.star : 'transparent'}
        />
      ))}
    </View>
  );

  if (!review) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Rating Details',
            headerTitleAlign: 'center',
            headerStyle: { backgroundColor: Colors.background },
            headerTintColor: Colors.charcoal,
            headerShadowVisible: false,
          }}
        />
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Rating not found</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const hasItemRatings = review.itemRatings && Object.keys(review.itemRatings).length > 0;
  const goodItems = hasItemRatings
    ? Object.entries(review.itemRatings!).filter(([, v]) => v === 'good').map(([k]) => k)
    : [];
  const badItems = hasItemRatings
    ? Object.entries(review.itemRatings!).filter(([, v]) => v === 'bad').map(([k]) => k)
    : [];

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Rating Details',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* STARS CARD */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>RATING</Text>
            <View style={styles.starsContainer}>
              {renderStars(review.stars)}
              <Text style={styles.ratingOutOf}>{review.stars} out of 5</Text>
            </View>
          </View>

          {/* ORDER INFO CARD */}
          {/* No date/timestamp here, deliberately — a vendor with few enough
              orders in a period could infer which customer left this rating
              from its timing alone, even shown only to the month. */}
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Review</Text>
              <Text style={styles.infoValue}>{review.reviewRef}</Text>
            </View>
          </View>

          {/* ITEM FEEDBACK CARD */}
          {hasItemRatings && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>ITEM FEEDBACK</Text>
              {goodItems.length > 0 && (
                <View style={styles.itemFeedbackRow}>
                  <View style={styles.thumbIconWrap}>
                    <ThumbsUp size={15} color="#16A34A" fill="#16A34A" strokeWidth={1.5} />
                  </View>
                  <Text style={styles.itemFeedbackText}>
                    {goodItems.length} item{goodItems.length > 1 ? 's' : ''} rated positively
                  </Text>
                </View>
              )}
              {badItems.length > 0 && (
                <View style={[styles.itemFeedbackRow, badItems.length > 0 && goodItems.length > 0 && styles.itemFeedbackRowSpaced]}>
                  <View style={[styles.thumbIconWrap, styles.thumbIconBad]}>
                    <ThumbsDown size={15} color={Colors.error} fill={Colors.error} strokeWidth={1.5} />
                  </View>
                  <Text style={styles.itemFeedbackText}>
                    {badItems.length} item{badItems.length > 1 ? 's' : ''} rated negatively
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* PRIVATE FEEDBACK CARD */}
          {review.feedback ? (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>PRIVATE FEEDBACK</Text>
              <Text style={styles.feedbackText}>{review.feedback}</Text>
              <View style={styles.privacyNote}>
                <Lock size={12} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.privacyNoteText}>
                  Visible only to your business and the platform administrators. Not displayed publicly.
                </Text>
              </View>
            </View>
          ) : (
            <View style={[styles.card, styles.noFeedbackCard]}>
              <Lock size={16} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.noFeedbackText}>No written feedback provided</Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },

  // STARS
  starsContainer: {
    alignItems: 'center' as const,
    paddingVertical: 4,
    gap: 8,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  ratingOutOf: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },

  // INFO ROWS
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  infoValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // ITEM FEEDBACK
  itemFeedbackRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  itemFeedbackRowSpaced: {
    marginTop: 10,
  },
  thumbIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  thumbIconBad: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  itemFeedbackText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '400' as const,
  },

  // FEEDBACK
  feedbackText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 14,
  },
  privacyNote: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  privacyNoteText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    flex: 1,
  },
  noFeedbackCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 20,
  },
  noFeedbackText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },

  // ERROR
  errorContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
