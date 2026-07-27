import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Info } from 'lucide-react-native';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import type { OrderChangeRequest } from '@/types/orderChanges';

interface OrderChangesCardProps {
  changeRequest: OrderChangeRequest;
  currency?: Currency;
  isVendorView?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

export default function OrderChangesCard({
  changeRequest,
  currency = 'NGN',
  isVendorView = false,
  onAccept,
  onReject,
}: OrderChangesCardProps) {
  const isPending = changeRequest.status === 'pending';
  const isAccepted = changeRequest.status === 'accepted';
  const isRejected = changeRequest.status === 'rejected';

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerDot} />
          <Text style={styles.headerTitle}>
            {isVendorView ? 'Changes sent' : 'Vendor suggested changes'}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTime}>{formatTime(changeRequest.createdAt)}</Text>
          <Info size={14} color={Colors.textMuted} strokeWidth={1.5} />
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.changesList}>
        {changeRequest.changes.map((change) => {
          const isAdded = change.originalQty === 0 && !change.removed;
          const isRemoved = change.removed;
          const isModified = !isAdded && !isRemoved;

          if (isRemoved) {
            return (
              <View key={change.itemId} style={styles.changeItemRow}>
                <View style={styles.changeItemLeft}>
                  <Text style={styles.changeItemNameRemoved} numberOfLines={1}>
                    {change.name}
                  </Text>
                </View>
                <View style={styles.removedBadge}>
                  <Text style={styles.removedBadgeText}>Removed</Text>
                </View>
              </View>
            );
          }

          if (isAdded) {
            return (
              <View key={change.itemId} style={styles.changeItemRow}>
                <View style={styles.changeItemLeft}>
                  <Text style={styles.changeItemNameAdded} numberOfLines={1}>
                    + {change.name}
                  </Text>
                  <Text style={styles.changeItemSubtext}>
                    {change.newQty}x · {formatPriceWithCommas(change.newPrice, currency)} each
                  </Text>
                </View>
                <Text style={styles.addedPrice}>
                  {formatPriceWithCommas(change.newQty * change.newPrice, currency)}
                </Text>
              </View>
            );
          }

          const beforeTotal = change.originalQty * change.originalPrice;
          const afterTotal = change.newQty * change.newPrice;
          const priceChanged = change.newPrice !== change.originalPrice;
          const qtyChanged = change.newQty !== change.originalQty;

          return (
            <View key={change.itemId} style={styles.modifiedItem}>
              <Text style={styles.modifiedItemName} numberOfLines={1}>
                {change.name}
              </Text>
              <View style={styles.beforeAfterRow}>
                <View style={styles.beforeBlock}>
                  <Text style={styles.beforeAfterLabel}>Before</Text>
                  <Text style={styles.beforeValue}>
                    {change.originalQty}x
                    {priceChanged ? ` · ${formatPriceWithCommas(change.originalPrice, currency)}` : ''}
                  </Text>
                  <Text style={styles.beforeTotal}>
                    {formatPriceWithCommas(beforeTotal, currency)}
                  </Text>
                </View>
                <View style={styles.arrowCol}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
                <View style={styles.afterBlock}>
                  <Text style={styles.beforeAfterLabel}>After</Text>
                  <Text style={[styles.afterValue, (qtyChanged || priceChanged) && styles.afterValueChanged]}>
                    {change.newQty}x
                    {priceChanged ? ` · ${formatPriceWithCommas(change.newPrice, currency)}` : ''}
                  </Text>
                  <Text style={[styles.afterTotal, (qtyChanged || priceChanged) && styles.afterTotalChanged]}>
                    {formatPriceWithCommas(afterTotal, currency)}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.totalDivider} />

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>New total</Text>
        <View style={styles.totalValues}>
          <Text style={styles.totalOld}>
            {formatPriceWithCommas(changeRequest.oldTotal, currency)}
          </Text>
          <Text style={styles.totalNew}>
            {formatPriceWithCommas(changeRequest.newTotal, currency)}
          </Text>
        </View>
      </View>

      {changeRequest.reason ? (
        <View style={styles.reasonRow}>
          <Text style={styles.reasonText}>&ldquo;{changeRequest.reason}&rdquo;</Text>
        </View>
      ) : null}

      {isAccepted && (
        <View style={styles.statusBanner}>
          <View style={[styles.statusDot, { backgroundColor: Colors.success }]} />
          <Text style={styles.acceptedStatus}>Changes accepted</Text>
        </View>
      )}

      {isRejected && (
        <View style={styles.statusBanner}>
          <View style={[styles.statusDot, { backgroundColor: Colors.error }]} />
          <Text style={styles.rejectedStatus}>Changes declined</Text>
        </View>
      )}

      {!isVendorView && isPending && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.declineButton}
            onPress={onReject}
            activeOpacity={0.7}
            testID="decline-changes-button"
          >
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={onAccept}
            activeOpacity={0.7}
            testID="accept-changes-button"
          >
            <Text style={styles.acceptButtonText}>Accept Changes</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  headerTime: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
  },
  changesList: {
    gap: 12,
    marginBottom: 12,
  },
  changeItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  changeItemLeft: {
    flex: 1,
  },
  changeItemNameRemoved: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through' as const,
  },
  changeItemNameAdded: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  changeItemSubtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  removedBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  removedBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  addedPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  modifiedItem: {
    gap: 8,
  },
  modifiedItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 20,
  },
  beforeAfterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  beforeBlock: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 10,
    gap: 2,
  },
  afterBlock: {
    flex: 1,
    backgroundColor: 'rgba(255,140,66,0.06)',
    borderRadius: 10,
    padding: 10,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  arrowCol: {
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  arrowText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  beforeAfterLabel: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  beforeValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  beforeTotal: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  afterValue: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  afterValueChanged: {
    color: Colors.primary,
  },
  afterTotal: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  afterTotalChanged: {
    color: Colors.primary,
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  totalValues: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  totalOld: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  totalNew: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  reasonRow: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  reasonText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    lineHeight: 18,
  },
  statusBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    marginBottom: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  acceptedStatus: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
    textAlign: 'center' as const,
  },
  rejectedStatus: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 4,
    marginBottom: 8,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  declineButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  acceptButton: {
    flex: 1.4,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
