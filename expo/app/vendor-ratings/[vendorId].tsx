import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { mockVendors } from '@/mocks/vendorData';
import { useReviews } from '@/contexts/ReviewsContext';
import { Colors } from '@/constants/colors';

export default function VendorRatingsScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const { getVendorRatingStats, getVendorReviews } = useReviews();

  const vendor = mockVendors.find((v) => v.id === vendorId);
  const stats = getVendorRatingStats(vendorId ?? '');
  const reviews = getVendorReviews(vendorId ?? '');
  const recentRatings = reviews.slice(0, 10);

  const renderStars = (count: number) => {
    return (
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={20}
            color={star <= count ? Colors.star : '#E0E0E0'}
            fill={star <= count ? Colors.star : 'transparent'}
          />
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: vendor ? `${vendor.name} Ratings` : 'Ratings',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#000',
          headerShadowVisible: true,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.overallRating}>
              {stats.average > 0 ? stats.average.toFixed(1) : '—'}
            </Text>
            <View style={styles.overallStars}>{renderStars(Math.round(stats.average))}</View>
            <Text style={styles.totalRatings}>Based on {stats.total} {stats.total === 1 ? 'rating' : 'ratings'}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Rating Breakdown</Text>
            {stats.breakdown.map((item) => (
              <View key={item.stars} style={styles.breakdownRow}>
                <View style={styles.breakdownStars}>
                  <Text style={styles.breakdownStarCount}>{item.stars}</Text>
                  <Star size={16} color={Colors.star} fill={Colors.star} />
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

          {recentRatings.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent ratings</Text>
              </View>
              <View style={styles.ratingsCard}>
                {recentRatings.map((review, index) => (
                  <View key={review.id}>
                    <View style={styles.ratingItem}>
                      <View style={styles.ratingStars}>{renderStars(review.stars)}</View>
                      <View style={styles.ratingDetails}>
                        <Text style={styles.ratingDate}>
                          {new Date(review.submittedAt).toLocaleDateString('en-US', {
                            month: 'long',
                            year: 'numeric',
                          })}
                        </Text>
                        <Text style={styles.orderRef}>{review.orderReference}</Text>
                      </View>
                    </View>
                    {index < recentRatings.length - 1 && <View style={styles.ratingDivider} />}
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Ratings are collected from verified customer orders. Only star ratings are displayed publicly.
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
    backgroundColor: '#F8F8F8',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  overallRating: {
    fontSize: 64,
    fontWeight: '700' as const,
    color: '#000',
    marginBottom: 12,
  },
  overallStars: {
    marginBottom: 12,
  },
  totalRatings: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500' as const,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 20,
    alignSelf: 'flex-start' as const,
    width: '100%',
  },
  breakdownRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 16,
    width: '100%',
  },
  breakdownStars: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: 50,
    gap: 4,
  },
  breakdownStarCount: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600' as const,
  },
  breakdownBarContainer: {
    flex: 1,
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  breakdownBar: {
    height: '100%',
    backgroundColor: '#FFD700',
    borderRadius: 5,
  },
  breakdownCount: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500' as const,
    width: 45,
    textAlign: 'right' as const,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    textAlign: 'center' as const,
  },
  recentSection: {
    marginTop: 16,
  },
  recentHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#000',
  },
  seeAllText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  ratingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  ratingItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ratingStars: {
    marginBottom: 8,
  },
  ratingDetails: {
    gap: 4,
  },
  ratingDate: {
    fontSize: 15,
    color: '#000',
    fontWeight: '500' as const,
  },
  orderRef: {
    fontSize: 14,
    color: '#666',
  },
  ratingDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
