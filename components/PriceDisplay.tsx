import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

interface PriceDisplayProps {
  salePrice: number;
  originalPrice: number;
  currency?: Currency;
  size?: 'small' | 'medium' | 'large';
  showEach?: boolean;
}

export function PriceDisplay({
  salePrice,
  originalPrice,
  currency = 'NGN',
  size = 'medium',
  showEach = false,
}: PriceDisplayProps) {
  const isOnSale = salePrice < originalPrice;
  const sizeStyles = SIZE_MAP[size];

  if (!isOnSale) {
    return (
      <View style={styles.row}>
        <Text style={[styles.currentPrice, sizeStyles.current]}>
          {formatPriceWithCommas(originalPrice, currency)}
        </Text>
        {showEach && <Text style={[styles.eachLabel, sizeStyles.each]}>each</Text>}
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={[styles.currentPrice, sizeStyles.current]}>
        {formatPriceWithCommas(salePrice, currency)}
      </Text>
      <Text style={[styles.originalPrice, sizeStyles.original]}>
        {formatPriceWithCommas(originalPrice, currency)}
      </Text>
      {showEach && <Text style={[styles.eachLabel, sizeStyles.each]}>each</Text>}
    </View>
  );
}

const SIZE_MAP = {
  small: {
    current: { fontSize: 13, fontWeight: '600' as const },
    original: { fontSize: 12 },
    each: { fontSize: 11 },
  },
  medium: {
    current: { fontSize: 15, fontWeight: '600' as const },
    original: { fontSize: 13 },
    each: { fontSize: 12 },
  },
  large: {
    current: { fontSize: 20, fontWeight: '700' as const },
    original: { fontSize: 14 },
    each: { fontSize: 13 },
  },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currentPrice: {
    color: '#2B2B2B',
    fontWeight: '600',
  },
  originalPrice: {
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
    fontWeight: '400',
  },
  eachLabel: {
    color: '#9CA3AF',
    fontWeight: '400',
  },
});
