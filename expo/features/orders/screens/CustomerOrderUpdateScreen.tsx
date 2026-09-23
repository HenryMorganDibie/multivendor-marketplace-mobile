import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  RefreshCw,
  Trash2,
  MessageCircle,
  AlertTriangle,
  Minus,
  Plus,
  Info,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { Alert } from '@/utils/alert';
import { formatPriceWithCommas } from '@/utils/formatPrice';
import {
  useChangeRequests,
  type ChangeRequest,
  type ChangeRequestChange,
} from '@/contexts/ChangeRequestsContext';
import { useOrders } from '@/contexts/OrdersContext';

interface CustomerOrderUpdateScreenProps {
  orderId: string;
}

interface CustomerEditableItem {
  change: ChangeRequestChange;
  customerQuantity: number;
  customerRemoved: boolean;
}

export default function CustomerOrderUpdateScreen({ orderId }: CustomerOrderUpdateScreenProps) {
  const router = useRouter();
  const { getRequestForOrder, subscribeToOrder, acceptChangeRequest, declineChangeRequest } = useChangeRequests();
  const { getOrder } = useOrders();
  const [isResponding, setIsResponding] = useState<boolean>(false);

  const bannerAnim = useRef(new Animated.Value(0)).current;

  const order = getOrder(orderId);
  const orderItemsTotal = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, item) => {
      const addOnTotal = item.addOns?.reduce((s, a) => s + a.price, 0) ?? 0;
      return sum + (item.price + addOnTotal) * item.quantity;
    }, 0);
  }, [order]);

  useEffect(() => {
    if (order) subscribeToOrder(orderId, order.vendorName, orderItemsTotal);
  }, [order, orderId, orderItemsTotal, subscribeToOrder]);

  const request: ChangeRequest | undefined = getRequestForOrder(orderId);

  const [customerItems, setCustomerItems] = useState<CustomerEditableItem[]>([]);
  const [initialized, setInitialized] = useState<boolean>(false);

  useEffect(() => {
    if (request && !initialized) {
      const items: CustomerEditableItem[] = request.changes.map((change) => {
        const qty =
          change.action === 'remove'
            ? 0
            : change.newQuantity ?? change.originalItem.quantity;
        return {
          change,
          customerQuantity: qty,
          customerRemoved: change.action === 'remove',
        };
      });
      setCustomerItems(items);
      setInitialized(true);
    }
  }, [request, initialized]);

  useEffect(() => {
    Animated.timing(bannerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [bannerAnim]);

  const originalTotal = useMemo(() => {
    if (!request) return 0;
    return request.originalTotal;
  }, [request]);

  const proposedTotal = useMemo(() => {
    if (!request) return 0;
    let total = request.originalTotal;

    for (const ci of customerItems) {
      const origItem = ci.change.originalItem;
      const origLineTotal = origItem.price * origItem.quantity;

      if (ci.customerRemoved) {
        total -= origLineTotal;
        continue;
      }

      if (ci.change.action === 'remove') {
        if (!ci.customerRemoved) {
          // nothing to subtract since vendor wanted to remove but customer kept it... 
          // actually it's already removed from the total by default since vendor proposed remove
          // We need to think of this differently
        }
        continue;
      }

      if (ci.change.action === 'replace' && ci.change.replacementItem) {
        total -= origLineTotal;
        total += ci.change.replacementItem.price * ci.customerQuantity;
        continue;
      }

      if (ci.change.action === 'adjust_quantity') {
        const qtyDiff = ci.customerQuantity - origItem.quantity;
        total += qtyDiff * origItem.price;
        continue;
      }
    }

    return Math.max(0, total);
  }, [request, customerItems]);

  const handleQuantityChange = useCallback((index: number, delta: number) => {
    setCustomerItems((prev) =>
      prev.map((ci, i) => {
        if (i !== index) return ci;
        const newQty = Math.max(0, ci.customerQuantity + delta);
        if (newQty === 0) {
          return { ...ci, customerQuantity: 0, customerRemoved: true };
        }
        return { ...ci, customerQuantity: newQty, customerRemoved: false };
      })
    );
  }, []);

  const handleCustomerRemove = useCallback((index: number) => {
    setCustomerItems((prev) =>
      prev.map((ci, i) => {
        if (i !== index) return ci;
        return { ...ci, customerQuantity: 0, customerRemoved: true };
      })
    );
  }, []);

  const handleCustomerRestore = useCallback((index: number) => {
    setCustomerItems((prev) =>
      prev.map((ci, i) => {
        if (i !== index) return ci;
        const restoreQty = ci.change.newQuantity ?? ci.change.originalItem.quantity;
        return { ...ci, customerQuantity: Math.max(1, restoreQty), customerRemoved: false };
      })
    );
  }, []);

  const buildCustomerChanges = useCallback((): ChangeRequestChange[] => {
    return customerItems.map((ci) => {
      if (ci.customerRemoved) {
        return {
          ...ci.change,
          action: 'remove' as const,
          newQuantity: 0,
          priceDifference: -(ci.change.originalItem.price * ci.change.originalItem.quantity),
        };
      }
      return {
        ...ci.change,
        newQuantity: ci.customerQuantity,
      };
    });
  }, [customerItems]);

  const handleAcceptChanges = useCallback(async () => {
    if (!request || isResponding) return;
    setIsResponding(true);
    try {
      const finalChanges = buildCustomerChanges();
      await acceptChangeRequest(request.id, orderId, finalChanges);
      router.back();
    } catch (error) {
      console.error('[CustomerUpdate] Failed to accept changes:', error);
      Alert.alert('Could not accept changes', error instanceof Error ? error.message : 'Please try again.');
      setIsResponding(false);
    }
  }, [request, isResponding, acceptChangeRequest, buildCustomerChanges, orderId, router]);

  const handleDeclineChanges = useCallback(async () => {
    if (!request || isResponding) return;
    setIsResponding(true);
    try {
      await declineChangeRequest(request.id, orderId);
      router.back();
    } catch (error) {
      console.error('[CustomerUpdate] Failed to decline changes:', error);
      Alert.alert('Could not decline changes', error instanceof Error ? error.message : 'Please try again.');
      setIsResponding(false);
    }
  }, [request, isResponding, declineChangeRequest, orderId, router]);

  if (!request) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Review changes</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No pending update found.</Text>
        </View>
      </View>
    );
  }

  const totalDiff = proposedTotal - originalTotal;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review changes</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Animated.View style={[styles.alertBanner, { opacity: bannerAnim }]}>
            <AlertTriangle size={18} color="#B45309" strokeWidth={2.5} />
            <Text style={styles.alertText}>
              <Text style={styles.alertVendor}>{request.vendorName}</Text>
              {' '}requested changes to your order
            </Text>
          </Animated.View>

          {request.vendorMessage ? (
            <View style={styles.messageCard}>
              <View style={styles.messageCardHeader}>
                <MessageCircle size={14} color={Colors.textSecondary} strokeWidth={2} />
                <Text style={styles.messageCardLabel}>Message from {request.vendorName}</Text>
              </View>
              <Text style={styles.messageCardText}>{request.vendorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.infoRow}>
            <Info size={14} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.infoText}>
              You can adjust quantities or remove items before accepting.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Proposed changes</Text>

          {customerItems.map((ci, index) => {
            const change = ci.change;
            const isVendorRemoved = change.action === 'remove';
            const isReplacement = change.action === 'replace' && change.replacementItem;
            const isQtyAdjust = change.action === 'adjust_quantity';
            const isCustomerRemoved = ci.customerRemoved;

            const displayName = isReplacement
              ? change.replacementItem!.name
              : change.originalItem.name;
            const displayPrice = isReplacement
              ? change.replacementItem!.price
              : change.originalItem.price;
            const displayImage = isReplacement
              ? change.replacementItem!.image
              : change.originalItem.image;

            const lineTotal = isCustomerRemoved ? 0 : displayPrice * ci.customerQuantity;

            return (
              <View
                key={`${change.originalItem.id}-${index}`}
                style={[styles.changeCard, isCustomerRemoved && styles.changeCardRemoved]}
              >
                <View style={styles.changeCardTop}>
                  <View style={[
                    styles.changeTypeBadge,
                    isVendorRemoved && styles.changeTypeBadgeRemove,
                    isReplacement && styles.changeTypeBadgeReplace,
                    isQtyAdjust && styles.changeTypeBadgeAdjust,
                  ]}>
                    {isVendorRemoved && <Trash2 size={12} color={Colors.error} strokeWidth={2} />}
                    {isReplacement && <RefreshCw size={12} color="#2563EB" strokeWidth={2} />}
                    {isQtyAdjust && <Minus size={12} color={Colors.primary} strokeWidth={2} />}
                    <Text style={[
                      styles.changeTypeBadgeText,
                      isVendorRemoved && styles.changeTypeBadgeTextRemove,
                      isReplacement && styles.changeTypeBadgeTextReplace,
                      isQtyAdjust && styles.changeTypeBadgeTextAdjust,
                    ]}>
                      {isVendorRemoved ? 'Removed' : isReplacement ? 'Substituted' : 'Qty adjusted'}
                    </Text>
                  </View>
                </View>

                <View style={styles.changeCardBody}>
                  {displayImage ? (
                    <Image source={{ uri: displayImage }} style={styles.changeItemImage} contentFit="cover" />
                  ) : (
                    <View style={styles.changeItemImagePlaceholder}>
                      <Text style={styles.changeItemInitial}>{displayName.charAt(0)}</Text>
                    </View>
                  )}
                  <View style={styles.changeItemInfo}>
                    {isReplacement && (
                      <Text style={styles.replacingLabel}>
                        Was: {change.originalItem.name}
                      </Text>
                    )}
                    <Text
                      style={[styles.changeItemName, isCustomerRemoved && styles.changeItemNameRemoved]}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                    <Text style={styles.changeItemPrice}>
                      {isCustomerRemoved
                        ? 'Removed'
                        : `${formatPriceWithCommas(displayPrice, 'NGN')} × ${ci.customerQuantity} = ${formatPriceWithCommas(lineTotal, 'NGN')}`
                      }
                    </Text>
                  </View>
                </View>

                {!isVendorRemoved && !isCustomerRemoved && (
                  <View style={styles.customerActions}>
                    <View style={styles.quantityStepper}>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleQuantityChange(index, -1)}
                        activeOpacity={0.7}
                        testID={`customer-qty-minus-${index}`}
                      >
                        <Minus size={16} color={Colors.text} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text style={styles.stepperQty}>{ci.customerQuantity}</Text>
                      <TouchableOpacity
                        style={styles.stepperBtn}
                        onPress={() => handleQuantityChange(index, 1)}
                        activeOpacity={0.7}
                        testID={`customer-qty-plus-${index}`}
                      >
                        <Plus size={16} color={Colors.text} strokeWidth={2.5} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.customerRemoveBtn}
                      onPress={() => handleCustomerRemove(index)}
                      activeOpacity={0.7}
                      testID={`customer-remove-${index}`}
                    >
                      <Trash2 size={14} color={Colors.error} strokeWidth={2} />
                      <Text style={styles.customerRemoveBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isCustomerRemoved && !isVendorRemoved && (
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => handleCustomerRestore(index)}
                    activeOpacity={0.7}
                    testID={`customer-restore-${index}`}
                  >
                    <Text style={styles.restoreBtnText}>Restore item</Text>
                  </TouchableOpacity>
                )}

                {isVendorRemoved && (
                  <View style={styles.vendorRemovedNote}>
                    <Text style={styles.vendorRemovedNoteText}>
                      {request.vendorName} removed this item from the order.
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Original total</Text>
              <Text style={styles.totalOriginalValue}>
                {formatPriceWithCommas(originalTotal, 'NGN')}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalUpdatedLabel}>Updated total</Text>
              <Text style={styles.totalUpdatedValue}>
                {formatPriceWithCommas(proposedTotal, 'NGN')}
              </Text>
            </View>
            {totalDiff !== 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalDiffLabel}>Difference</Text>
                <Text
                  style={[
                    styles.totalDiffValue,
                    { color: totalDiff < 0 ? Colors.success : Colors.error },
                  ]}
                >
                  {totalDiff > 0 ? '+' : '−'}{formatPriceWithCommas(Math.abs(totalDiff), 'NGN')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.acceptButton, isResponding && styles.actionButtonDisabled]}
          onPress={handleAcceptChanges}
          activeOpacity={0.8}
          disabled={isResponding}
          testID="accept-changes-button"
        >
          <Text style={styles.acceptButtonText}>{isResponding ? 'Please wait…' : 'Accept'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.declineButton, isResponding && styles.actionButtonDisabled]}
          onPress={handleDeclineChanges}
          activeOpacity={0.7}
          disabled={isResponding}
          testID="decline-changes-button"
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeTop: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backBtn: { padding: 8 },
  headerTitle: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSpacer: { width: 40 },
  scroll: { flex: 1 },
  content: {
    padding: 20,
    paddingBottom: 16,
  },
  alertBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  alertVendor: {
    fontWeight: '700' as const,
    color: '#78350F',
  },
  messageCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 8,
  },
  messageCardLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  messageCardText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  changeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeCardRemoved: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.borderLight,
    opacity: 0.7,
  },
  changeCardTop: {
    marginBottom: 10,
  },
  changeTypeBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-start' as const,
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.borderLight,
  },
  changeTypeBadgeRemove: { backgroundColor: Colors.errorLight },
  changeTypeBadgeReplace: { backgroundColor: '#EFF6FF' },
  changeTypeBadgeAdjust: { backgroundColor: 'rgba(255,140,66,0.1)' },
  changeTypeBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  changeTypeBadgeTextRemove: { color: Colors.error },
  changeTypeBadgeTextReplace: { color: '#2563EB' },
  changeTypeBadgeTextAdjust: { color: Colors.primary },
  changeCardBody: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  changeItemImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  changeItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  changeItemInitial: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  changeItemInfo: {
    flex: 1,
  },
  replacingLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginBottom: 2,
  },
  changeItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  changeItemNameRemoved: {
    textDecorationLine: 'line-through' as const,
    color: Colors.textMuted,
  },
  changeItemPrice: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  customerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  quantityStepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperQty: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  customerRemoveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.errorLight,
  },
  customerRemoveBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  restoreBtn: {
    alignSelf: 'flex-start' as const,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,140,66,0.1)',
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  vendorRemovedNote: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  vendorRemovedNoteText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
  },
  totalSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  totalOriginalValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textDecorationLine: 'line-through' as const,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 2,
  },
  totalUpdatedLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalUpdatedValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalDiffLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  totalDiffValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  actionsContainer: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  declineButton: {
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
});
