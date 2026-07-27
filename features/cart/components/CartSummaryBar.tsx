import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { OrderLockConfig } from '@/utils/orderImmutability';
import type { Currency } from '@/utils/formatPrice';
import { formatPriceWithCommas } from '@/utils/formatPrice';

interface CartSummaryBarProps {
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  taxEnabled: boolean;
  isCartLocked: boolean;
  _lockConfig?: OrderLockConfig | null;
  isVendorUnavailable: boolean;
  isBelowMinimum: boolean;
  minimumOrderAmount?: number;
  hasItemsRequiringSelection: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  currency: Currency;
  closedMessage?: string;
  paddingBottom: number;
}

export function CartSummaryBar({
  subtotal,
  tax,
  discount,
  total,
  taxEnabled,
  isCartLocked,
  isVendorUnavailable,
  isBelowMinimum,
  minimumOrderAmount,
  hasItemsRequiringSelection,
  canSubmit,
  onSubmit,
  currency,
  closedMessage,
  paddingBottom,
}: CartSummaryBarProps) {
  const fmt = (amount: number) => formatPriceWithCommas(amount, currency);

  return (
    <View style={[styles.stickyFooter, { paddingBottom: Math.max(paddingBottom, 16) }]}>
      <View style={styles.summaryRows}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>{fmt(subtotal)}</Text>
        </View>
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
      </View>

      {isCartLocked ? (
        <View style={styles.lockedSubmitBanner}>
          <Lock size={16} color={Colors.textMuted} />
          <Text style={styles.lockedSubmitText}>Order editing is locked</Text>
        </View>
      ) : (
        <>
          {isVendorUnavailable && (
            <View style={styles.footerWarning}>
              <Text style={styles.footerWarningText}>
                {closedMessage || 'This store is currently closed.'}
              </Text>
            </View>
          )}
          {!isVendorUnavailable && isBelowMinimum && minimumOrderAmount != null && (
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
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Text style={styles.submitButtonText}>
              {isVendorUnavailable ? 'Save cart' : 'Submit Order Request'}
            </Text>
          </TouchableOpacity>
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
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  summaryRows: {
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  summaryDiscountValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.success,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
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
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(255,140,66,0.35)',
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
