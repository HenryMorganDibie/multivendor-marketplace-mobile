import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { ChevronDown, Check, X } from 'lucide-react-native';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import type { OrderChangeRequest } from '@/types/orderChanges';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

  const [expanded, setExpanded] = useState<boolean>(false);

  const changeCount = changeRequest.changes.length;

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

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
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
        <Text style={styles.headerTime}>{formatTime(changeRequest.createdAt)}</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>
            {changeCount} {changeCount === 1 ? 'change' : 'changes'}
          </Text>
        </View>
        <View style={styles.totalsInline}>
          <Text style={styles.totalOld}>
            {formatPriceWithCommas(changeRequest.oldTotal, currency)}
          </Text>
          <Text style={styles.totalArrow}>→</Text>
          <Text style={styles.totalNew}>
            {formatPriceWithCommas(changeRequest.newTotal, currency)}
          </Text>
        </View>
      </View>

      {changeRequest.reason && !expanded ? (
        <Text style={styles.reasonPreview} numberOfLines={1}>
          &ldquo;{changeRequest.reason}&rdquo;
        </Text>
      ) : null}

      {expanded && (
        <View style={styles.detailsContainer}>
          <View style={styles.divider} />

          <View style={styles.changesList}>
            {changeRequest.changes.map((change) => {
              const isAdded = change.originalQty === 0 && !change.removed;
              const isRemoved = change.removed;

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

          {changeRequest.reason ? (
            <View style={styles.reasonRow}>
              <Text style={styles.reasonText}>&ldquo;{changeRequest.reason}&rdquo;</Text>
            </View>
          ) : null}
        </View>
      )}

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

      {!isVendorView && isPending ? (
        <>
          {expanded && (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onReject}
                activeOpacity={0.7}
                testID="decline-changes-button"
              >
                <X size={13} color={Colors.textSecondary} strokeWidth={2.5} />
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.7}
                testID="accept-changes-button"
              >
                <Check size={13} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={styles.toggleLink}
            onPress={toggleExpanded}
            activeOpacity={0.7}
            testID="review-changes-button"
          >
            <Text style={styles.toggleLinkText}>
              {expanded ? 'Hide details' : 'Review changes'}
            </Text>
            <ChevronDown
              size={13}
              color={Colors.primary}
              strokeWidth={2.5}
              style={expanded ? styles.chevronUp : undefined}
            />
          </TouchableOpacity>
        </>
      ) : (
        <TouchableOpacity
          style={styles.toggleLink}
          onPress={toggleExpanded}
          activeOpacity={0.7}
          testID="toggle-changes-button"
        >
          <Text style={styles.toggleLinkText}>
            {expanded ? 'Hide details' : 'View details'}
          </Text>
          <ChevronDown
            size={13}
            color={Colors.primary}
            strokeWidth={2.5}
            style={expanded ? styles.chevronUp : undefined}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 9,
    borderWidth: 1,
    borderColor: '#ECECEC',
    width: '100%',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 7,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    flex: 1,
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerTime: {
    fontSize: 10.5,
    color: Colors.textMuted,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  countBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  countBadgeText: {
    fontSize: 11.5,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  totalsInline: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  totalArrow: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  reasonPreview: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    marginTop: 6,
  },
  detailsContainer: {
    marginTop: 7,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 7,
  },
  changesList: {
    gap: 7,
    marginBottom: 7,
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
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through' as const,
  },
  changeItemNameAdded: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  changeItemSubtext: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  removedBadge: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  removedBadgeText: {
    fontSize: 10.5,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  addedPrice: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  modifiedItem: {
    gap: 6,
  },
  modifiedItemName: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  beforeAfterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  beforeBlock: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 7,
    gap: 1,
  },
  afterBlock: {
    flex: 1,
    backgroundColor: 'rgba(255,140,66,0.06)',
    borderRadius: 8,
    padding: 7,
    gap: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  arrowCol: {
    paddingHorizontal: 3,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  arrowText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  beforeAfterLabel: {
    fontSize: 9.5,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  beforeValue: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  beforeTotal: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  afterValue: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  afterValueChanged: {
    color: Colors.primary,
  },
  afterTotal: {
    fontSize: 12.5,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  afterTotalChanged: {
    color: Colors.primary,
  },
  totalOld: {
    fontSize: 12.5,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  totalNew: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  reasonRow: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    lineHeight: 17,
  },
  statusBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
    paddingVertical: 4,
    marginTop: 5,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  acceptedStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.success,
    textAlign: 'center' as const,
  },
  rejectedStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    gap: 8,
    marginTop: 8,
    marginBottom: 2,
  },
  declineButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  declineButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  acceptButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  toggleLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 3,
    marginTop: 7,
    paddingVertical: 3,
  },
  toggleLinkText: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  chevronUp: {
    transform: [{ rotate: '180deg' }],
  },
});
