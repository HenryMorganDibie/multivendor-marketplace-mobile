import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Star } from 'lucide-react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mockVendors } from '@/mocks/vendorData';
import { Colors } from '@/constants/colors';

interface PublicRatingStats {
  average: number;
  total: number;
  breakdown: { stars: number; count: number; percentage: number }[];
}

const EMPTY_STATS: PublicRatingStats = {
  average: 0,
  total: 0,
  breakdown: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, percentage: 0 })),
};

/**
 * Public storefront ratings summary — reads the real, public
 * vendorRatingStats/{vendorId} aggregate (Phase 4 spec: `allow read: if
 * true`), for the specific vendorId this page was opened for.
 *
 * This screen used to source both the summary and a "Recent ratings" list
 * from ReviewsContext, which is built around the SIGNED-IN vendor's own
 * private ratings (getVendorRatings) — once any vendor was signed in, this
 * page silently showed their own ratings mislabeled as whichever vendor was
 * being viewed. There is no real backend equivalent for a per-review public
 * list at all: privateFeedback/submittedAt/orderReference are only ever
 * visible to the rating's author, the rated vendor (via a stripped
 * projection), or an admin — never to the public. The "Recent ratings"
 * section is removed rather than wired to something that can't be real; the
 * aggregate (average/total/breakdown) is the only genuinely public rating
 * data that exists.
 */
function useVendorPublicRatingStats(vendorId: string | undefined): { stats: PublicRatingStats; isLoading: boolean } {
  const [stats, setStats] = useState<PublicRatingStats>(EMPTY_STATS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!vendorId) {
      setStats(EMPTY_STATS);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, 'vendorRatingStats', vendorId),
      (snap) => {
        if (!snap.exists()) {
          setStats(EMPTY_STATS);
          setIsLoading(false);
          return;
        }
        const data = snap.data();
        const total = (data.total as number) ?? 0;
        const breakdownMap = (data.breakdown as Record<string, number>) ?? {};
        setStats({
          average: (data.average as number) ?? 0,
          total,
          breakdown: [5, 4, 3, 2, 1].map((s) => {
            const count = breakdownMap[String(s)] ?? 0;
            return { stars: s, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 };
          }),
        });
        setIsLoading(false);
      },
      (error) => {
        console.error('[VendorRatingsScreen] Failed to read public rating stats:', error);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [vendorId]);

  return { stats, isLoading };
}

export default function VendorRatingsScreen() {
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const { stats } = useVendorPublicRatingStats(vendorId);

  const vendor = mockVendors.find((v) => v.id === vendorId);

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
  bottomSpacer: {
    height: 40,
  },
});
