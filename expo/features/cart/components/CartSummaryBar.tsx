import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { Lock, Sparkles } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Currency } from '@/utils/formatPrice';
import { formatPriceWithCommas } from '@/utils/formatPrice';

interface CartSummaryBarProps {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  taxEnabled: boolean;
  isCartLocked: boolean;
  isBelowMinimum: boolean;
  minimumOrderAmount?: number;
  hasItemsRequiringSelection: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  currency: Currency;
  paddingBottom: number;
  totalItemSavings?: number;
  originalSubtotal?: number;
  totalSavings?: number;
}

export function CartSummaryBar({
  subtotal,
  tax,
  discount,
  total,
  taxEnabled,
  isCartLocked,
  isBelowMinimum,
  minimumOrderAmount,
  hasItemsRequiringSelection,
  canSubmit,
  onSubmit,
  currency,
  paddingBottom,
  totalItemSavings = 0,
  originalSubtotal = 0,
  totalSavings = 0,
}: CartSummaryBarProps) {
  const fmt = (amount: number) => formatPriceWithCommas(amount, currency);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 20,
    }).start();
  };

  return (
    <View style={[styles.stickyFooter, { paddingBottom: Math.max(paddingBottom, 16) }]}>
      <View style={styles.summaryRows}>
        {totalItemSavings > 0 ? (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal (before discount)</Text>
              <Text style={styles.summaryStrikeValue}>{fmt(originalSubtotal)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sale savings</Text>
              <Text style={styles.summaryDiscountValue}>−{fmt(totalItemSavings)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{fmt(subtotal)}</Text>
            </View>
          </>
        ) : (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{fmt(subtotal)}</Text>
          </View>
        )}
        {taxEnabled && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>{fmt(tax)}</Text>
          </View>
        )}
        {discount > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discount</Text>
            <Text style={styles.summaryDiscountValue}>−{fmt(discount)}</Text>
          </View>
        )}
        <View style={styles.summaryDivider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryTotalLabel}>Total</Text>
          <Text style={styles.summaryTotalValue}>{fmt(total)}</Text>
        </View>
        {totalSavings > 0 && (
          <View style={styles.savingsRow}>
            <Sparkles size={13} color="#16A34A" />
            <Text style={styles.savingsText}>
              You're saving{' '}
              <Text style={styles.savingsAmount}>{fmt(totalSavings)}</Text>
            </Text>
          </View>
        )}
      </View>

      {isCartLocked ? (
        <View style={styles.lockedSubmitBanner}>
          <Lock size={16} color={Colors.textMuted} />
          <Text style={styles.lockedSubmitText}>Order editing is locked</Text>
        </View>
      ) : (
        <>
          {isBelowMinimum && minimumOrderAmount != null && (
            <View style={styles.footerWarning}>
              <Text style={styles.footerWarningText}>
                Minimum order {fmt(minimumOrderAmount)} — Add{' '}
                {fmt(minimumOrderAmount - subtotal)} more
              </Text>
            </View>
          )}
          {hasItemsRequiringSelection && (
            <View style={styles.footerWarning}>
              <Text style={styles.footerWarningText}>
                Some items require selection updates
              </Text>
            </View>
          )}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={onSubmit}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={!canSubmit}
              activeOpacity={1}
            >
              <Text style={styles.submitButtonText}>Review & Send Order</Text>
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stickyFooter: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.07,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0 -4px 12px rgba(0,0,0,0.07)',
      },
    }),
  },
  summaryRows: {
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  summaryDiscountValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.success,
  },
  summaryStrikeValue: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  savingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F2',
  },
  savingsText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500' as const,
  },
  savingsAmount: {
    fontWeight: '700' as const,
    color: '#16A34A',
  },
  summaryTotalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.text,
  },
  footerWarning: {
    backgroundColor: '#FFF8F5',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
  },
  footerWarningText: {
    fontSize: 13,
    color: Colors.text,
    textAlign: 'center',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    letterSpacing: 0.2,
  },
  lockedSubmitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedSubmitText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textMuted,
  },
});
