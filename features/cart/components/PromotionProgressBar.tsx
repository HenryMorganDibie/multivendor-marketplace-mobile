import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Gift, Truck, Percent, Tag, PartyPopper } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { VendorPromotion } from '@/mocks/promotionsData';
import type { Currency } from '@/utils/formatPrice';
import { formatPriceWithCommas } from '@/utils/formatPrice';

interface PromotionProgressBarProps {
  promotions: VendorPromotion[];
  subtotal: number;
  currency: Currency;
  appliedPromotionIds: string[];
}

function getRewardLabel(promo: VendorPromotion): string {
  switch (promo.type) {
    case 'free_item':
      return `FREE ${(promo.freeItemName ?? 'ITEM').toUpperCase()}`;
    case 'free_delivery':
      return 'FREE DELIVERY';
    case 'percentage':
      return `${promo.discountValue}% OFF`;
    case 'flat':
      return `${promo.discountValue} OFF`;
    case 'bogo':
      return `BUY 1 GET 1 ${(promo.bogoItemName ?? '').toUpperCase()}`;
    default:
      return promo.title.toUpperCase();
  }
}

function getRewardIcon(promo: VendorPromotion) {
  switch (promo.icon) {
    case 'gift':
      return <Gift size={14} color="#FF8C42" />;
    case 'truck':
      return <Truck size={14} color="#FF8C42" />;
    case 'percent':
      return <Percent size={14} color="#FF8C42" />;
    case 'tag':
      return <Tag size={14} color="#FF8C42" />;
    default:
      return <Gift size={14} color="#FF8C42" />;
  }
}

export const PromotionProgressBar = React.memo(function PromotionProgressBar({
  promotions,
  subtotal,
  currency,
  appliedPromotionIds,
}: PromotionProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const celebrateAnim = useRef(new Animated.Value(0)).current;
  const prevUnlockedRef = useRef(false);

  const thresholdPromos = promotions
    .filter((p) => p.minimumOrder > 0 && p.type !== 'bogo')
    .sort((a, b) => a.minimumOrder - b.minimumOrder);

  if (thresholdPromos.length === 0) return null;

  const nextPromo = thresholdPromos.find(
    (p) => !appliedPromotionIds.includes(p.id) && subtotal < p.minimumOrder
  );

  const justUnlockedPromo = !nextPromo
    ? thresholdPromos[thresholdPromos.length - 1]
    : null;

  const displayPromo = nextPromo ?? justUnlockedPromo;
  if (!displayPromo) return null;

  const isUnlocked = !nextPromo && !!justUnlockedPromo;
  const progress = Math.min(subtotal / displayPromo.minimumOrder, 1);
  const remaining = Math.max(displayPromo.minimumOrder - subtotal, 0);
  const rewardLabel = getRewardLabel(displayPromo);

  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 40,
      friction: 12,
    }).start();
  }, [progress, progressAnim]);

  useEffect(() => {
    if (isUnlocked && !prevUnlockedRef.current) {
      celebrateAnim.setValue(0);
      Animated.sequence([
        Animated.spring(celebrateAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 60,
          friction: 6,
        }),
      ]).start();
    }
    prevUnlockedRef.current = isUnlocked;
  }, [isUnlocked, celebrateAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const celebrateScale = celebrateAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.8, 1.15, 1],
  });

  if (isUnlocked) {
    return (
      <Animated.View
        style={[
          styles.container,
          styles.containerUnlocked,
          { transform: [{ scale: celebrateScale }] },
        ]}
      >
        <View style={styles.unlockedRow}>
          <PartyPopper size={18} color="#FF8C42" />
          <Text style={styles.unlockedText}>
            You unlocked {rewardLabel}
          </Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        {getRewardIcon(displayPromo)}
        <Text style={styles.labelText}>
          Add{' '}
          <Text style={styles.labelAmount}>
            {formatPriceWithCommas(remaining, currency)}
          </Text>{' '}
          more to unlock{' '}
          <Text style={styles.labelReward}>{rewardLabel}</Text>
        </Text>
      </View>

      <View style={styles.barBackground}>
        <Animated.View style={[styles.barFill, { width: progressWidth }]} />
      </View>

      <View style={styles.amountRow}>
        <Text style={styles.amountText}>
          {formatPriceWithCommas(subtotal, currency)}
        </Text>
        <Text style={styles.amountText}>
          {formatPriceWithCommas(displayPromo.minimumOrder, currency)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      },
    }),
  },
  containerUnlocked: {
    backgroundColor: '#FFF8F0',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.25)',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  labelText: {
    fontSize: 13,
    color: '#2B2B2B',
    lineHeight: 18,
    flex: 1,
  },
  labelAmount: {
    fontWeight: '700' as const,
    color: '#FF8C42',
  },
  labelReward: {
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  barBackground: {
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#FF8C42',
    borderRadius: 4,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  amountText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  unlockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  unlockedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
});
