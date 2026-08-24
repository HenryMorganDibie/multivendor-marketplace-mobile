import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Star, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useReviews } from '@/contexts/ReviewsContext';
import { useVendor } from '@/contexts/VendorContext';

export default function AllRatingsScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { getVendorReviews, ratingsStatus } = useReviews();
  // Vendor's own settings screen — same rule as ratings.tsx, never fall
  // through to the seed/fixture reviews here.
  const isReady = ratingsStatus === 'ready';
  const reviews = isReady ? getVendorReviews(vendor.id) : [];

  const renderStars = (count: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={18}
          color={star <= count ? Colors.star : Colors.border}
          fill={star <= count ? Colors.star : 'transparent'}
        />
      ))}
    </View>
  );

  const renderItem = ({ item }: { item: ReturnType<typeof getVendorReviews>[0] }) => (
    <TouchableOpacity
      style={styles.reviewItem}
      onPress={() => router.push(`/vendor/ratings/${item.id}` as any)}
      activeOpacity={0.6}
    >
      {item.feedback && <View style={styles.feedbackBar} />}
      <View style={styles.reviewContent}>
        <View style={styles.reviewLeft}>
          <View style={styles.reviewStars}>{renderStars(item.stars)}</View>
          <Text style={styles.orderRef}>{item.orderReference}</Text>
          {/* No date shown here, deliberately — see submittedAt's comment
              in ReviewsContext for why. */}
        </View>
        <ChevronRight size={20} color={Colors.textMuted} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'All Ratings',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        {ratingsStatus === 'checking' || ratingsStatus === 'loading' ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : ratingsStatus === 'error' || ratingsStatus === 'not_vendor' ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Couldn't load ratings</Text>
            <Text style={styles.emptySubtitle}>Please check your connection and try again.</Text>
          </View>
        ) : reviews.length > 0 ? (
          <View style={styles.card}>
            <FlatList
              data={reviews}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={styles.divider} />}
              showsVerticalScrollIndicator={false}
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No ratings yet</Text>
            <Text style={styles.emptySubtitle}>Ratings from completed orders will appear here.</Text>
          </View>
        )}
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
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  reviewItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    position: 'relative' as const,
  },
  reviewContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  reviewLeft: {
    flex: 1,
  },
  reviewStars: {
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  orderRef: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 3,
  },
  reviewDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  feedbackBar: {
    position: 'absolute' as const,
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
