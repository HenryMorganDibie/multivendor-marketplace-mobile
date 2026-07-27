import React from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Star, ChevronRight, Lock } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useReviews } from '@/contexts/ReviewsContext';

const VENDOR_ID = 'v1';

/** Is this review considered "new" — submitted within the last 14 days */
function isNewReview(submittedAt: string): boolean {
  const diff = Date.now() - new Date(submittedAt).getTime();
  return diff < 14 * 24 * 60 * 60 * 1000;
}

export default function RatingsScreen() {
  const router = useRouter();
  const { getVendorReviews, getVendorRatingStats, markReviewRead } = useReviews();

  const reviews = getVendorReviews(VENDOR_ID);
  const stats = getVendorRatingStats(VENDOR_ID);
  const recentReviews = reviews.slice(0, 8);

  const renderStars = (count: number, size = 15) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= count ? Colors.star : Colors.borderDark}
          fill={star <= count ? Colors.star : 'transparent'}
        />
      ))}
    </View>
  );

  const renderReviewItem = ({ item }: { item: ReturnType<typeof getVendorReviews>[0] }) => {
    const showNew = !item.readByVendor && isNewReview(item.submittedAt);
    return (
      <TouchableOpacity
        style={styles.reviewItem}
        onPress={() => {
          markReviewRead(item.id);
          router.push(`/vendor/ratings/${item.id}` as any);
        }}
        activeOpacity={0.55}
      >
        {item.feedback && <View style={styles.feedbackBar} />}
        <View style={styles.reviewTop}>
          {renderStars(item.stars)}
          <View style={styles.pillsRow}>
            {item.feedback && (
              <View style={styles.feedbackPill}>
                <Lock size={10} color={Colors.primary} strokeWidth={2.5} />
                <Text style={styles.feedbackPillText}>Note</Text>
              </View>
            )}
            {showNew && (
              <View style={styles.newPill}>
                <Text style={styles.newPillText}>New</Text>
              </View>
            )}
          </View>
          {/* Unread dot — right-aligned */}
          <View style={styles.unreadDotWrap}>
            {!item.readByVendor && <View style={styles.unreadDot} />}
          </View>
        </View>
        <View style={styles.reviewBottom}>
          <Text style={styles.orderReference}>Review {item.reviewRef}</Text>
          <View style={styles.reviewBottomRight}>
            <Text style={styles.reviewDate}>
              {new Date(item.submittedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </Text>
            <ChevronRight size={14} color={Colors.textMuted} strokeWidth={2} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Ratings" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* SUMMARY CARD */}
          <View style={styles.overallCard}>
            <Text style={styles.overallRating}>{stats.average > 0 ? stats.average.toFixed(1) : '—'}</Text>
            <View style={styles.overallStars}>{renderStars(Math.round(stats.average), 20)}</View>
            <Text style={styles.totalRatings}>
              {stats.total} {stats.total === 1 ? 'rating' : 'ratings'}
            </Text>
          </View>

          {/* BREAKDOWN CARD */}
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionLabel}>BREAKDOWN</Text>
            {stats.breakdown.map((item) => (
              <View key={item.stars} style={styles.breakdownRow}>
                <View style={styles.breakdownStars}>
                  <Text style={styles.breakdownStarCount}>{item.stars}</Text>
                  <Star size={12} color={Colors.star} fill={Colors.star} />
                </View>
                <View style={styles.breakdownBarContainer}>
                  <View
                    style={[styles.breakdownBar, { width: `${item.percentage}%` as any }]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{item.count}</Text>
              </View>
            ))}
          </View>

          {/* RECENT RATINGS */}
          <View style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={styles.sectionLabel}>RECENT RATINGS</Text>
              {reviews.length > 8 && (
                <TouchableOpacity onPress={() => router.push('/vendor/ratings/all' as any)}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {recentReviews.length > 0 ? (
              <View style={styles.recentCard}>
                <FlatList
                  data={recentReviews}
                  renderItem={renderReviewItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ItemSeparatorComponent={() => <View style={styles.divider} />}
                />
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No ratings yet</Text>
                <Text style={styles.emptySubtext}>
                  Ratings will appear here once customers review their orders.
                </Text>
              </View>
            )}
          </View>

          {/* PRIVACY NOTE */}
          <View style={styles.privacyNote}>
            <Lock size={13} color={Colors.textMuted} strokeWidth={2} style={styles.privacyIcon} />
            <Text style={styles.privacyNoteText}>
              Ratings and written feedback are private. Only star counts are visible to customers on your storefront.
            </Text>
          </View>

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
  headerSafe: {
    backgroundColor: Colors.background,
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

  // SUMMARY
  overallCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginTop: 16,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  overallRating: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -1,
    lineHeight: 52,
  },
  overallStars: {
    marginTop: 8,
    marginBottom: 6,
  },
  totalRatings: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },

  // BREAKDOWN
  breakdownCard: {
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
  breakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  breakdownStars: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: 36,
    gap: 3,
  },
  breakdownStarCount: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 5,
    marginHorizontal: 10,
    overflow: 'hidden' as const,
  },
  breakdownBar: {
    height: '100%' as any,
    backgroundColor: Colors.star,
    borderRadius: 5,
  },
  breakdownCount: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    width: 28,
    textAlign: 'right' as const,
  },

  // RECENT
  recentSection: {
    marginTop: 20,
  },
  recentHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  recentCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  reviewItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    position: 'relative' as const,
  },
  feedbackBar: {
    position: 'absolute' as const,
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  reviewTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    flex: 1,
  },
  feedbackPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: Colors.primarySofter,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  feedbackPillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  newPill: {
    backgroundColor: '#FFF4EC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FFD9B8',
  },
  newPillText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  unreadDotWrap: {
    marginLeft: 'auto' as any,
    width: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  reviewBottom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  orderReference: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  reviewBottomRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  reviewDate: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },

  // EMPTY
  emptyCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 19,
  },

  // PRIVACY
  privacyNote: {
    marginTop: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  privacyIcon: {
    marginTop: 1,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});
