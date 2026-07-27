import React, { useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Pressable,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Star, ChevronRight, Tag, Truck, Gift, Percent, Zap, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import {
  PromoType,
  PROMO_BADGE_STYLE,
  getDealsForLocation,
  personalizeDeals,
  deduplicateDealsPerVendor,
  CuratedDeal,
  TRENDING_DEALS,
} from '@/mocks/promoDealsData';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { useOrders } from '@/contexts/OrdersContext';

function getPromoIcon(type: PromoType, size: number, color: string) {
  switch (type) {
    case 'bogo':
      return <Tag size={size} color={color} strokeWidth={2.5} />;
    case 'free_item':
      return <Gift size={size} color={color} strokeWidth={2.5} />;
    case 'free_delivery':
      return <Truck size={size} color={color} strokeWidth={2.5} />;
    case 'percentage':
    case 'flat':
      return <Percent size={size} color={color} strokeWidth={2.5} />;
    default:
      return <Zap size={size} color={color} strokeWidth={2.5} />;
  }
}



interface DealCardProps {
  deal: CuratedDeal;
  onPress: (deal: CuratedDeal) => void;
}

function DealCard({ deal, onPress }: DealCardProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeStyle = PROMO_BADGE_STYLE[deal.promoType];

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.cardWrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={() => onPress(deal)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
        testID={`deal-card-${deal.id}`}
      >
        <View style={styles.cardImageContainer}>
          <ExpoImage
            source={{ uri: deal.bannerImage }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.cardImageOverlay} />

          <View style={[styles.promoBadge, { backgroundColor: badgeStyle.bg }]}>
            {getPromoIcon(deal.promoType, 10, badgeStyle.text)}
            <Text style={[styles.promoBadgeText, { color: badgeStyle.text }]}>
              {deal.promoBadge}
            </Text>
          </View>

          {!deal.isOpen && (
            <View style={styles.hoursOverlay}>
              <View style={styles.hoursChip}>
                <Text style={styles.hoursChipText}>Outside business hours</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.cardBody}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardVendorName} numberOfLines={1}>
              {deal.vendorName}
            </Text>
            <View style={styles.ratingPill}>
              <Star size={11} color="#F59E0B" fill="#F59E0B" strokeWidth={0} />
              <Text style={styles.ratingText}>{deal.vendorRating.toFixed(1)}</Text>
            </View>
          </View>

          <Text style={styles.promoTitle} numberOfLines={1}>
            {deal.promoTitle}
          </Text>

          <Text style={styles.vendorLocation} numberOfLines={1}>
            {deal.city}{deal.region ? `, ${deal.region}` : ''}
          </Text>

          {deal.moreDealsCount > 0 && (
            <View style={styles.moreDealsRow}>
              <Tag size={10} color={Colors.primary} strokeWidth={2.5} />
              <Text style={styles.moreDealsText}>
                +{deal.moreDealsCount} more deal{deal.moreDealsCount > 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

interface EmptyStateProps {
  city: string | null;
}

function EmptyState({ city }: EmptyStateProps) {
  const router = useRouter();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <MapPin size={22} color={Colors.primary} strokeWidth={2} />
      </View>
      <View style={styles.emptyText}>
        <Text style={styles.emptyTitle}>No deals in {city || 'your area'} yet</Text>
        <Text style={styles.emptyBody}>Here are what's trending nearby</Text>
      </View>
      <TouchableOpacity
        style={styles.emptyAction}
        onPress={() => router.push('/customer/vendors/trending' as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.emptyActionText}>Browse vendors</Text>
        <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

export default function DealsForYouSection() {
  const router = useRouter();
  const { countryCode, regionName, city } = useUserLocation();
  const { recentVendors } = useRecentlyViewed();
  const { orders } = useOrders();

  const deals = useMemo(() => {
    console.log('[DEALS_FOR_YOU] Computing personalized deals...');
    const locationDeals = getDealsForLocation(
      countryCode ?? '',
      regionName ?? '',
      city
    );

    const orderedVendorIds = new Set(
      orders
        .filter((o) => o.status === 'completed')
        .map((o) => o.vendorId)
    );

    const recentVendorIds = new Set(
      recentVendors.map((v) => v.vendorId)
    );

    const personalized = personalizeDeals(locationDeals, orderedVendorIds, recentVendorIds);
    const curated = deduplicateDealsPerVendor(personalized);
    console.log('[DEALS_FOR_YOU]', personalized.length, 'deals →', curated.length, 'after dedup (one per vendor)');
    return curated;
  }, [countryCode, regionName, city, orders, recentVendors]);

  const handleDealPress = useCallback(
    (deal: CuratedDeal) => {
      console.log('[DEALS_FOR_YOU] Deal tapped:', deal.vendorName, deal.promoTitle, '| moreDeals:', deal.moreDealsCount);
      router.push(`/store/${deal.vendorUsername.toLowerCase()}` as any);
    },
    [router]
  );

  const isEmpty = deals.length === 0;
  const trendingCurated = useMemo(() => deduplicateDealsPerVendor(TRENDING_DEALS.slice(0, 6)), []);
  const displayDeals = isEmpty ? trendingCurated : deals;

  return (
    <View style={styles.section} testID="deals-for-you-section">
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Deals for you</Text>
        <TouchableOpacity
          style={styles.seeAllButton}
          onPress={() => router.push('/customer/vendors/trending' as any)}
          activeOpacity={0.7}
          testID="deals-see-all"
        >
          <Text style={styles.seeAllText}>See all</Text>
          <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      {isEmpty ? (
        <EmptyState city={city} />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          decelerationRate="fast"
          snapToInterval={236}
          snapToAlignment="start"
        >
          {displayDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onPress={handleDealPress} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const CARD_WIDTH = 220;

const styles = StyleSheet.create({
  section: {
    marginTop: 28,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    flex: 1,
  },
  seeAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    paddingTop: 4,
  },
  seeAllText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
  },

  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 4,
  },

  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  cardImageContainer: {
    width: CARD_WIDTH,
    height: 128,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  cardImage: {
    width: CARD_WIDTH,
    height: 128,
  },
  cardImageOverlay: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 48,
    backgroundColor: 'transparent',
  },
  promoBadge: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  promoBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  hoursOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    paddingBottom: 8,
  },
  hoursChip: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hoursChipText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.white,
    letterSpacing: 0.3,
  },

  cardBody: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 2,
  },
  cardVendorName: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 6,
  },
  ratingPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#B45309',
  },
  promoTitle: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  vendorLocation: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
    marginBottom: 6,
  },
  moreDealsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  moreDealsText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
    letterSpacing: 0.1,
  },

  emptyContainer: {
    marginHorizontal: 20,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptyBody: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
