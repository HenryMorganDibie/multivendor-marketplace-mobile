import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { Target } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { VendorPromotion, AppliedPromotion } from '@/mocks/promotionsData';
import type { CartItem } from '@/contexts/CartContext';
import type { Currency } from '@/utils/formatPrice';
import { formatPriceWithCommas } from '@/utils/formatPrice';

interface SmartUpsellBannerProps {
  promotions: VendorPromotion[];
  subtotal: number;
  currency: Currency;
  appliedPromotions: AppliedPromotion[];
  cartItems: CartItem[];
}

function getEstimatedSavings(promo: VendorPromotion): number {
  switch (promo.type) {
    case 'percentage': {
      const raw = promo.minimumOrder * (promo.discountValue / 100);
      return promo.maxDiscount ? Math.min(raw, promo.maxDiscount) : raw;
    }
    case 'flat':
      return promo.discountValue;
    default:
      return 0;
  }
}

function getRewardLabel(promo: VendorPromotion): string {
  switch (promo.type) {
    case 'free_item':
      return `Free ${promo.freeItemName ?? 'Item'}`;
    case 'free_delivery':
      return 'Free Delivery';
    case 'percentage':
      return `${promo.discountValue}% OFF`;
    case 'flat':
      return `${formatPriceWithCommas(promo.discountValue, 'NGN')} OFF`;
    case 'bogo':
      return `Buy 1 Get 1 ${promo.bogoItemName ?? ''}`;
    default:
      return promo.title;
  }
}





export const SmartUpsellBanner = React.memo(function SmartUpsellBanner({
  promotions,
  subtotal,
  currency,
  appliedPromotions,
  cartItems,
}: SmartUpsellBannerProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const prevUnlockedRef = useRef(false);

  const thresholdPromos = promotions
    .filter((p) => p.minimumOrder > 0 && p.type !== 'bogo')
    .sort((a, b) => a.minimumOrder - b.minimumOrder);

  if (thresholdPromos.length === 0) return null;
  if (cartItems.length === 0) return null;

  const appliedIds = new Set(appliedPromotions.map((ap) => ap.promotion.id));

  const nextPromo = thresholdPromos.find(
    (p) => !appliedIds.has(p.id) && subtotal < p.minimumOrder
  );

  const totalDiscount = appliedPromotions.reduce(
    (sum, ap) => sum + ap.discountAmount,
    0
  );

  const isUnlocked = !nextPromo && thresholdPromos.some((p) => appliedIds.has(p.id));
  const hasAnyApplied = appliedPromotions.length > 0 && totalDiscount > 0;

  useEffect(() => {
    if (isUnlocked && !prevUnlockedRef.current) {
      successAnim.setValue(0);
      Animated.spring(successAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }).start();
    }
    prevUnlockedRef.current = isUnlocked;
  }, [isUnlocked, successAnim]);

  if (isUnlocked && hasAnyApplied) {
    const savingsScale = successAnim.interpolate({
      inputRange: [0, 0.6, 1],
      outputRange: [0.9, 1.05, 1],
    });

    return (
      <Animated.View
        style={[styles.successContainer, { transform: [{ scale: savingsScale }] }]}
      >
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successText}>
          You're saving{' '}
          <Text style={styles.successAmount}>
            {formatPriceWithCommas(totalDiscount, currency)}
          </Text>
        </Text>
      </Animated.View>
    );
  }

  if (!nextPromo) return null;

  const remainingAmount = Math.max(nextPromo.minimumOrder - subtotal, 0);
  const progress = Math.min(subtotal / nextPromo.minimumOrder, 1);
  const estimatedSavings = getEstimatedSavings(nextPromo);
  const rewardLabel = getRewardLabel(nextPromo);

  const isVeryNear = remainingAmount <= 200 && remainingAmount > 0;
  const isNear = remainingAmount <= 500 && remainingAmount > 200;

  const getBannerText = () => {
    if (isVeryNear) {
      return (
        <Text style={styles.bannerText}>
          {'🔥 Just '}
          <Text style={styles.bannerHighlight}>
            {formatPriceWithCommas(remainingAmount, currency)}
          </Text>
          {' more to unlock your discount'}
        </Text>
      );
    }
    if (isNear) {
      return (
        <Text style={styles.bannerText}>
          {'👀 Almost there! Add '}
          <Text style={styles.bannerHighlight}>
            {formatPriceWithCommas(remainingAmount, currency)}
          </Text>
          {' more'}
        </Text>
      );
    }
    if (estimatedSavings > 0) {
      return (
        <Text style={styles.bannerText}>
          {'🔥 Add '}
          <Text style={styles.bannerHighlight}>
            {formatPriceWithCommas(remainingAmount, currency)}
          </Text>
          {' more to save '}
          <Text style={styles.bannerHighlight}>
            {formatPriceWithCommas(estimatedSavings, currency)}
          </Text>
        </Text>
      );
    }
    return (
      <Text style={styles.bannerText}>
        {'🔥 Add '}
        <Text style={styles.bannerHighlight}>
          {formatPriceWithCommas(remainingAmount, currency)}
        </Text>
        {' more to unlock '}
        <Text style={styles.bannerReward}>{rewardLabel}</Text>
      </Text>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.bannerSection}>
        {getBannerText()}

        <ProgressBar
          progress={progress}
          progressAnim={progressAnim}
        />

        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>
            {formatPriceWithCommas(subtotal, currency)}
          </Text>
          <View style={styles.targetRow}>
            <Target size={11} color="#9CA3AF" />
            <Text style={styles.amountLabel}>
              {formatPriceWithCommas(nextPromo.minimumOrder, currency)}
            </Text>
          </View>
        </View>
      </View>


    </View>
  );
});

interface ProgressBarProps {
  progress: number;
  progressAnim: Animated.Value;
}

const ProgressBar = React.memo(function ProgressBar({ progress, progressAnim }: ProgressBarProps) {
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 40,
      friction: 12,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const isNearEnd = progress >= 0.7;

  return (
    <View style={styles.barBackground}>
      <Animated.View
        style={[
          styles.barFill,
          isNearEnd && styles.barFillNear,
          { width: progressWidth },
        ]}
      />
    </View>
  );
});



const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  bannerSection: {
    padding: 14,
  },
  bannerText: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '500' as const,
  },
  bannerHighlight: {
    fontWeight: '700' as const,
    color: '#FF6B35',
  },
  bannerReward: {
    fontWeight: '700' as const,
    color: '#1C1C1E',
  },
  barBackground: {
    height: 10,
    backgroundColor: '#F0F0F0',
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FF6B35',
    borderRadius: 5,
  },
  barFillNear: {
    backgroundColor: '#16A34A',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
  },
  amountLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#16A34A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 8px rgba(22,163,74,0.1)' },
    }),
  },
  successEmoji: {
    fontSize: 18,
  },
  successText: {
    fontSize: 15,
    color: '#14532D',
    fontWeight: '600' as const,
  },
  successAmount: {
    fontWeight: '800' as const,
    color: '#16A34A',
  },
});
