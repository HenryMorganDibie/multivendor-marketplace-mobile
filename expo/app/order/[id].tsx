import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Alert } from '@/utils/alert';

import * as Clipboard from 'expo-clipboard';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MessageCircle,
  Star,
  Copy,
  Store,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  Upload,
  ShieldCheck,
  FileImage,
} from 'lucide-react-native';
import PaymentConfirmationModal from '@/components/PaymentConfirmationModal';
import OrderActionButtons from '@/components/OrderActionButtons';
import type { PaymentProof } from '@/mocks/ordersData';
import { useChats } from '@/contexts/ChatContext';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { getOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { VendorPolicyModal } from '@/components/VendorPolicyModal';
import {
  getVendorStorefrontPath,
  getVendorBannerImage,
  vendorStatusFromRaw,
  accessForVendorStatus,
} from '@/utils/vendorLookup';
import { getOrderLockState } from '@/utils/orderImmutability';
import { useOrders } from '@/contexts/OrdersContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendors, type Vendor } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';
import { isVendorCurrentlyOpen, getNextOpenTime } from '@/utils/vendorAvailability';

// 'confirmed' deliberately excluded: it exists in the backend's OrderStatus
// type (types2.ts) but VENDOR_TRANSITIONS/CUSTOMER_TRANSITIONS in
// updateOrderStatus.ts never allow any order into it - accepted goes
// straight to in_progress. Showing it as a step here made every real order
// silently "skip" a stage the moment it moved to in_progress, which reads as
// a stuck/broken progress bar rather than the intended per-status enum
// mismatch (backend declares a status it never actually emits).
const ORDER_STEPS = [
  { key: 'requested', label: 'Requested', sublabel: 'Sent to vendor' },
  { key: 'accepted', label: 'Accepted', sublabel: 'Vendor accepted' },
  { key: 'in_progress', label: 'In Progress', sublabel: 'Being fulfilled' },
  { key: 'completed', label: 'Completed', sublabel: 'Order fulfilled' },
] as const;

function getActiveStepIndex(status: string): number {
  switch (status) {
    case 'requested': return 0;
    case 'accepted': return 1;
    case 'confirmed': return 1;
    case 'in_progress': return 2;
    case 'completed': return 3;
    default: return -1;
  }
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export default function OrderDetailsScreen() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const params = useLocalSearchParams();
  const orderId = params.id as string;
  const fromSubmission = params.fromSubmission === 'true';
  const fromChat = params.fromChat === 'true';
  const { getOrder, updateOrderStatus, markCustomerPaid, addPaymentProof, hasOrderPendingChanges } = useOrders();
  const { addMessageToChat, getConversationByPair } = useChats();
  const { user } = useAuth();

  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);

  const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);
  const ratingAutoTriggered = useRef(false);
  const { toastVisible, showToast } = useToast();
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false);

  const order = useMemo(() => getOrder(orderId), [orderId, getOrder]);

  // mockVendors.find only ever matched the ten demo ids (v1-v10). For any
  // real vendor this was always undefined, which silently disabled two
  // customer-safety checks below: the "vendor is closed" notice never showed
  // for a real closed vendor, and a real SUSPENDED vendor's active order
  // never showed the suspension freeze — exactly the "treated as suspended
  // when not, or vice versa" class of bug already fixed in the chat/inbox
  // screens (see app/chat/[vendorId].tsx's vendorRepository.getById lookup,
  // reused here).
  const [liveOrderVendor, setLiveOrderVendor] = useState<Vendor | undefined>(undefined);
  useEffect(() => {
    const vendorId = order?.vendorId;
    if (!vendorId) {
      setLiveOrderVendor(undefined);
      return;
    }
    let cancelled = false;
    void vendorRepository.getById(vendorId).then((v) => {
      if (!cancelled) setLiveOrderVendor(v);
    });
    return () => { cancelled = true; };
  }, [order?.vendorId]);

  const orderVendor = liveOrderVendor ?? mockVendors.find(v => v.id === order?.vendorId);
  // Same live-vendor fix applied to currency: mockVendors.find alone always
  // fell back to NGN for a real vendor's order total.
  const getOrderCurrency = (_vendorId?: string): Currency =>
    (orderVendor?.currency as Currency) || getCurrencyFromCountryCode(orderVendor?.countryCode || 'NG');
  const isOrderVendorClosed = orderVendor ? !isVendorCurrentlyOpen(orderVendor) : false;
  const orderVendorNextOpen = orderVendor ? getNextOpenTime(orderVendor) : '';
  const showClosedVendorNotice = order?.status === 'requested' && isOrderVendorClosed;

  const vendorStatusForOrder = order ? vendorStatusFromRaw(orderVendor?.vendorStatus) : 'active';
  const isVendorSuspendedWithActiveOrder =
    vendorStatusForOrder === 'suspended' &&
    order != null &&
    ['requested', 'accepted', 'confirmed', 'in_progress'].includes(order.status);

  const canRate =
    order?.status === 'completed' && order?.orderSource !== 'external' && !order?.hasRating;

  const isOrderChatEligible = useMemo(() => {
    if (!order) return false;
    if (['accepted', 'confirmed', 'in_progress'].includes(order.status)) return true;
    if (order.status === 'completed') {
      if (!order.completedAt) return true;
      const elapsed = Date.now() - new Date(order.completedAt).getTime();
      return elapsed < SEVEN_DAYS_MS;
    }
    return false;
  }, [order]);

  useEffect(() => {
    if (canRate && !ratingAutoTriggered.current) {
      ratingAutoTriggered.current = true;
      const timer = setTimeout(() => {
        router.push(`/rate-order/${orderId}` as any);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [canRate, orderId, router]);

  if (!order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Order Details</Text>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>
        <View style={styles.errorState}>
          <Text style={styles.errorStateTitle}>This order is no longer available.</Text>
        </View>
      </View>
    );
  }

  const handleCancelOrder = () => {
    setIsCancelModalVisible(true);
  };

  const handleConfirmCancel = () => {
    console.log('[OrderDetails] Cancelling order:', orderId);
    updateOrderStatus(orderId, 'cancelled', 'Cancelled by customer');
    setIsCancelModalVisible(false);
  };

  const handleCopyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(order.publicOrderId);
      showToast();
    } catch {
      Alert.alert('Error', 'Failed to copy Order ID');
    }
  };



  const handleViewStore = () => {
    if (!storefrontAccess.allowed) {
      Alert.alert('Store Unavailable', storefrontAccess.message ?? 'This store is not available.');
      return;
    }
    // getVendorStorefrontPath only resolves a username for the ten demo
    // vendor ids — a dead tap for a real vendor's order. orderVendor above
    // now carries the live vendor (once resolved) with its real username.
    const path = orderVendor?.username ? `/store/${orderVendor.username.toLowerCase()}` : getVendorStorefrontPath(order.vendorId);
    router.push(path as any);
  };

  const handleItemPress = (itemId: string) => {
    router.push(`/item/${itemId}` as any);
  };





  const showPaymentStatus = useMemo(() => {
    if (!order) return false;
    return (
      order.paymentState === 'CUSTOMER_MARKED_PAID' ||
      order.vendorPaymentProofRequested === true
    );
  }, [order]);

  const handlePaymentConfirm = useCallback((proofs: PaymentProof[], note?: string) => {
    if (!order) return;
    const success = markCustomerPaid(order.id, proofs);
    if (success) {
      // order.customerId should always be set for a real, live order, but
      // the fallback used to be the hardcoded fixture id 'customer-001' —
      // wrong for any real signed-in customer, and it would have silently
      // matched (or created a mismatch against) a chat that belongs to
      // nobody real. The signed-in customer's own id is the correct fallback.
      const chat = getConversationByPair(order.vendorId, order.customerId || user?.id || 'customer-001');
      if (chat) {
        addMessageToChat(chat.id, {
          type: 'system',
          content: `You marked payment as completed.\n${order.vendorName} will verify and confirm.`,
          sender: 'system',
        });
        if (proofs.length > 0) {
          addMessageToChat(chat.id, {
            type: 'system',
            content: `${proofs.length} payment proof${proofs.length > 1 ? 's' : ''} uploaded.`,
            sender: 'system',
          });
        }
      }
      console.log('[OrderDetails] Payment marked as completed for order:', order.id);
    }
    setShowPaymentConfirmModal(false);
  }, [order, markCustomerPaid, getConversationByPair, addMessageToChat, user]);

  const handleUploadProofLater = useCallback(async () => {
    if (!order) return;
    try {
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const proof: PaymentProof = {
          id: `proof-${Date.now()}`,
          uri: asset.uri,
          type: 'image',
          uploadedAt: new Date().toISOString(),
        };
        addPaymentProof(order.id, proof);
        // order.customerId should always be set for a real, live order, but
      // the fallback used to be the hardcoded fixture id 'customer-001' —
      // wrong for any real signed-in customer, and it would have silently
      // matched (or created a mismatch against) a chat that belongs to
      // nobody real. The signed-in customer's own id is the correct fallback.
      const chat = getConversationByPair(order.vendorId, order.customerId || user?.id || 'customer-001');
        if (chat) {
          addMessageToChat(chat.id, {
            type: 'system',
            content: `Payment proof uploaded.`,
            sender: 'system',
          });
        }
        Alert.alert('Proof Uploaded', 'Your payment proof has been sent to the vendor.');
      }
    } catch (error) {
      console.log('[OrderDetails] Upload proof error:', error);
    }
  }, [order, addPaymentProof, getConversationByPair, addMessageToChat, user]);

  // TODO: Phase 2: Re-order should rebuild the cart from the vendor's current catalog, show unavailable items/price changes, and require customer review before submitting a new order.

  const activeStepIndex = getActiveStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';
  const isRejected = order.status === 'rejected';

  const displayStatus = getOrderStatusLabel(order.status);

  const lockState = getOrderLockState(order.status);
  // Same mock-only gap as orderVendor above: prefer the live vendor's own
  // banner/status once resolved, matching vendorStatusForOrder's fix.
  const vendorBanner = orderVendor?.bannerImage ?? getVendorBannerImage(order.vendorId);
  const vendorStatus = vendorStatusForOrder;
  const storefrontAccess = accessForVendorStatus(vendorStatus, true);

  const lockStateIsRequested = lockState === 'REQUESTED';
  const lockStateIsAccepted = lockState === 'ACCEPTED';
  const lockStateIsConfirmed = lockState === 'CONFIRMED';
  const lockStateIsInProgress = lockState === 'IN_PROGRESS';
  const lockStateIsCompleted = lockState === 'COMPLETED';
  const lockStateIsRejected = lockState === 'REJECTED';
  const lockStateIsCancelled = lockState === 'CANCELLED';

  const receiptEvent = order.eventHistory?.find(
    (e) => e.eventType === 'payment_confirmed' && e.receiptSnapshot
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Details</Text>
          <TouchableOpacity
            onPress={() => router.push(`/order/support/${orderId}` as any)}
            style={styles.headerHelpBtn}
            activeOpacity={0.7}
            testID="order-help-button"
          >
            <Text style={styles.headerHelpText}>Help</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {fromSubmission && (
        <View style={styles.submissionSuccessBanner}>
          <CheckCircle size={16} color={Colors.success} fill={Colors.success} strokeWidth={0} />
          <View style={styles.submissionSuccessText}>
            <Text style={styles.submissionSuccessTitle}>Order request sent</Text>
            <Text style={styles.submissionSuccessSubtitle}>
              Waiting for {order.vendorName} to review your order
            </Text>
          </View>
        </View>
      )}

      {showClosedVendorNotice && (
        <View style={styles.closedVendorNoticeBanner}>
          <Clock size={16} color={Colors.primary} />
          <View style={styles.closedVendorNoticeContent}>
            <Text style={styles.closedVendorNoticeTitle}>Your order has been sent</Text>
            <Text style={styles.closedVendorNoticeBody}>
              {order.vendorName} is currently closed and will review your order when they reopen{orderVendorNextOpen ? ` ${orderVendorNextOpen}` : ''}.
            </Text>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Vendor Hero */}
        <View style={styles.vendorHero}>
          <View style={styles.vendorHeroRow}>
            <View style={styles.vendorLogoWrap}>
              {vendorBanner ? (
                <Image source={{ uri: vendorBanner }} style={styles.vendorLogo} contentFit="cover" />
              ) : (
                <View style={styles.vendorLogoPlaceholder}>
                  <Store size={22} color={Colors.textMuted} />
                </View>
              )}
            </View>
            <View style={styles.vendorHeroInfo}>
              <Text style={styles.vendorName} numberOfLines={1}>{order.vendorName}</Text>
              {vendorStatus === 'suspended' && (
                <View style={styles.suspendedBadge}>
                  <AlertCircle size={11} color={Colors.warning} />
                  <Text style={styles.suspendedBadgeText}>Temporarily unavailable</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.viewStorePill, !storefrontAccess.allowed && styles.viewStorePillDisabled]}
            onPress={handleViewStore}
            activeOpacity={0.7}
          >
            <Store size={14} color={storefrontAccess.allowed ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.viewStorePillText, !storefrontAccess.allowed && styles.viewStorePillTextDisabled]}>
              View Store
            </Text>
          </TouchableOpacity>
        </View>

        {/* Order ID + Status */}
        <View style={styles.orderMetaRow}>
          <TouchableOpacity onPress={handleCopyOrderId} style={styles.orderIdButton} activeOpacity={0.7}>
            <Text style={styles.orderId}>{order.publicOrderId.toUpperCase()}</Text>
            <Copy size={14} color={Colors.textMuted} />
          </TouchableOpacity>
          <View style={[
            styles.statusPill,
            lockStateIsRequested && styles.statusPillRequested,
            (lockStateIsAccepted || lockStateIsConfirmed || lockStateIsInProgress) && styles.statusPillActive,
            lockStateIsCompleted && styles.statusPillCompleted,
            (lockStateIsCancelled || lockStateIsRejected) && styles.statusPillCancelled,
          ]}>
            {lockStateIsRequested && <Clock size={11} color={Colors.primary} />}
            {(lockStateIsAccepted || lockStateIsConfirmed || lockStateIsInProgress) && (
              <CheckCircle size={11} color="#EA580C" />
            )}
            {lockStateIsCompleted && <CheckCircle size={11} color={Colors.success} />}
            {(lockStateIsCancelled || lockStateIsRejected) && <XCircle size={11} color={Colors.error} />}
            <Text style={[
              styles.statusPillText,
              lockStateIsRequested && styles.statusPillTextRequested,
              (lockStateIsAccepted || lockStateIsConfirmed || lockStateIsInProgress) && styles.statusPillTextActive,
              lockStateIsCompleted && styles.statusPillTextCompleted,
              (lockStateIsCancelled || lockStateIsRejected) && styles.statusPillTextCancelled,
            ]}>
              {displayStatus.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Progress Timeline */}
        <View style={styles.timelineSection}>
          {(isCancelled || isRejected) ? (
            <View style={[
              styles.terminalBanner,
              isRejected ? styles.terminalBannerRejected : styles.terminalBannerCancelled,
            ]}>
              <XCircle size={16} color={isRejected ? Colors.error : Colors.textSecondary} />
              <View style={styles.terminalBannerTextWrap}>
                <Text style={[styles.terminalBannerTitle, isRejected && styles.terminalBannerTitleRejected]}>
                  {isRejected ? `${order.vendorName} declined this order` : 'This order was cancelled'}
                </Text>
                {(order.cancellationReason || order.rejectionReason) && (
                  <Text style={styles.terminalBannerReason}>
                    {order.cancellationReason ?? order.rejectionReason}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.progressTracker}>
              {ORDER_STEPS.map((step, index) => {
                const isStepCompleted = activeStepIndex > index;
                const isActive = activeStepIndex === index;
                const isUpcoming = activeStepIndex < index;
                const isLast = index === ORDER_STEPS.length - 1;

                return (
                  <View key={step.key} style={styles.progressStepContainer}>
                    <View style={styles.progressStepRow}>
                      <View style={styles.progressLineCol}>
                        <View style={[
                          styles.progressDot,
                          isStepCompleted && styles.progressDotDone,
                          isActive && styles.progressDotActive,
                          isUpcoming && styles.progressDotUpcoming,
                        ]}>
                          {isStepCompleted && (
                            <CheckCircle size={12} color={Colors.background} fill={Colors.success} strokeWidth={0} />
                          )}
                          {isActive && <View style={styles.progressDotInner} />}
                        </View>
                        {!isLast && (
                          <View style={[styles.progressLine, isStepCompleted && styles.progressLineDone]} />
                        )}
                      </View>
                      <View style={styles.progressStepInfo}>
                        <Text style={[
                          styles.progressLabel,
                          isActive && styles.progressLabelActive,
                          isStepCompleted && styles.progressLabelDone,
                          isUpcoming && styles.progressLabelUpcoming,
                        ]}>
                          {step.label}
                        </Text>
                        <Text style={[
                          styles.progressSublabel,
                          isActive && styles.progressSublabelActive,
                        ]}>
                          {step.sublabel}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Safety Freeze */}
        {isVendorSuspendedWithActiveOrder && (
          <View style={styles.safetyBanner}>
            <View style={styles.safetyBannerRow}>
              <AlertCircle size={14} color={Colors.warning} />
              <Text style={styles.safetyBannerTitle}>Order Safety Freeze</Text>
            </View>
            <Text style={styles.safetyBannerText}>
              {order.vendorName} is currently unavailable. Your order is protected and remains accessible.
            </Text>
          </View>
        )}

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ORDER SUMMARY</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardRowLabel}>Order date</Text>
              <Text style={styles.cardRowValue}>{formatDate(order.orderDate)}</Text>
            </View>
            <View style={[styles.cardRow, styles.cardRowLast]}>
              <Text style={styles.cardRowLabel}>Fulfillment</Text>
              <Text style={styles.cardRowValue}>{order.fulfillmentType}</Text>
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ITEMS</Text>
          <View style={styles.card}>
            {order.items.map((item, index) => {
              const addOnTotal = item.addOns?.reduce((sum, a) => sum + a.price, 0) ?? 0;
              const unitPrice = item.price + addOnTotal;
              const lineTotal = unitPrice * item.quantity;
              const isLast = index === order.items.length - 1;
              return (
                <TouchableOpacity
                  key={`${item.id}-${index}`}
                  style={[styles.itemRow, isLast && styles.itemRowLast]}
                  onPress={() => handleItemPress(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemImageWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Text style={styles.itemImageInitial}>{item.name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    {item.addOns && item.addOns.length > 0 && (
                      <Text style={styles.itemAddOns} numberOfLines={1}>
                        {item.addOns.map(a => a.name).join(' · ')}
                      </Text>
                    )}
                    <Text style={styles.itemQty}>Qty {item.quantity}</Text>
                  </View>
                  <Text style={styles.itemTotal}>{formatPriceWithCommas(lineTotal, getOrderCurrency(order?.vendorId))}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Order Note */}
        {order.orderNote && order.orderNote.trim().length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>ORDER NOTE</Text>
            <View style={styles.card}>
              <Text style={styles.orderNoteText}>&ldquo;{order.orderNote}&rdquo;</Text>
            </View>
          </View>
        )}

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PAYMENT SUMMARY</Text>
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardRowLabel}>Subtotal</Text>
              <Text style={styles.cardRowValue}>{formatPriceWithCommas(order.subtotal, getOrderCurrency(order.vendorId))}</Text>
            </View>
            {order.tax > 0 && (
              <View style={styles.cardRow}>
                <Text style={styles.cardRowLabel}>Tax</Text>
                <Text style={styles.cardRowValue}>{formatPriceWithCommas(order.tax, getOrderCurrency(order.vendorId))}</Text>
              </View>
            )}
            {order.discount > 0 && (
              <View style={styles.cardRow}>
                <Text style={styles.cardRowLabel}>Discount</Text>
                <Text style={[styles.cardRowValue, { color: Colors.success }]}>
                  -{formatPriceWithCommas(order.discount, getOrderCurrency(order.vendorId))}
                </Text>
              </View>
            )}
            <View style={styles.totalDivider} />
            <View style={[styles.cardRow, styles.cardRowLast]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPriceWithCommas(order.total, getOrderCurrency(order.vendorId))}</Text>
            </View>
          </View>
        </View>

        {/* Payment Status Section */}
        {showPaymentStatus && order.paymentState === 'CUSTOMER_MARKED_PAID' && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PAYMENT STATUS</Text>
            <View style={styles.card}>
              <View style={styles.paymentStatusRow}>
                <ShieldCheck size={18} color={Colors.primary} />
                <View style={styles.paymentStatusInfo}>
                  <Text style={styles.paymentStatusTitle}>You marked payment as completed</Text>
                  {order.customerMarkedPaidAt && (
                    <Text style={styles.paymentStatusDate}>
                      {new Date(order.customerMarkedPaidAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
              </View>
              {(!order.paymentProof || order.paymentProof.length === 0) && (
                <View style={styles.paymentProofMissing}>
                  <View style={styles.paymentProofMissingRow}>
                    <FileImage size={14} color={Colors.textMuted} />
                    <Text style={styles.paymentProofMissingText}>Payment Proof: Not uploaded</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.uploadProofLaterBtn}
                    onPress={handleUploadProofLater}
                    activeOpacity={0.7}
                    testID="upload-proof-later-button"
                  >
                    <Upload size={14} color={Colors.primary} />
                    <Text style={styles.uploadProofLaterText}>Upload Payment Proof</Text>
                  </TouchableOpacity>
                </View>
              )}
              {order.paymentProof && order.paymentProof.length > 0 && (
                <View style={styles.paymentProofAttached}>
                  <FileImage size={14} color={Colors.success} />
                  <Text style={styles.paymentProofAttachedText}>
                    {order.paymentProof.length} proof{order.paymentProof.length > 1 ? 's' : ''} uploaded
                  </Text>
                </View>
              )}
              {order.vendorPaymentProofRequested && (!order.paymentProof || order.paymentProof.length === 0) && (
                <View style={styles.proofRequestedBanner}>
                  <AlertCircle size={14} color={Colors.warning} />
                  <Text style={styles.proofRequestedText}>
                    {order.vendorName} requested payment proof for this order.
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* View Receipt */}
        {receiptEvent?.receiptSnapshot && (
          <View style={styles.section}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptRowLabel}>Receipt available</Text>
              <View style={[styles.receiptButton, styles.receiptButtonDisabled]}>
                <Text style={[styles.receiptButtonText, styles.receiptButtonTextDisabled]}>Coming Soon</Text>
              </View>
            </View>
          </View>
        )}

        {/* Rating */}
        {canRate && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.rateButton}
              onPress={() => router.push(`/rate-order/${orderId}` as any)}
              activeOpacity={0.7}
            >
              <Star size={18} color={Colors.star} fill={Colors.star} strokeWidth={2} />
              <Text style={styles.rateButtonText}>Rate this order</Text>
              <ChevronRight size={16} color={Colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Sticky Bottom Actions */}
      <SafeAreaView edges={['bottom']} style={styles.bottomBar}>
        <View style={styles.bottomBarInner}>
          <OrderActionButtons
            order={order}
            source={fromChat ? 'chat' : 'orders'}
            hasPendingChanges={hasOrderPendingChanges(orderId)}
            onIvePaid={() => setShowPaymentConfirmModal(true)}
            onMessageVendor={() => {
              router.push({
                pathname: '/chat/order/[orderId]' as any,
                params: {
                  orderId: order.id,
                  vendorName: order.vendorName,
                  publicOrderId: order.publicOrderId,
                },
              });
            }}
            onCancelOrder={handleCancelOrder}
          />
        </View>
      </SafeAreaView>

      <Toast visible={toastVisible} />

      {/* Payment Confirmation Modal */}
      <PaymentConfirmationModal
        visible={showPaymentConfirmModal}
        vendorName={order.vendorName}
        orderId={order.publicOrderId}
        total={order.total}
        currency={getOrderCurrency(order.vendorId)}
        onClose={() => setShowPaymentConfirmModal(false)}
        onConfirm={handlePaymentConfirm}
      />

      {/* Cancel Confirmation Modal */}
      <CancelConfirmModal
        visible={isCancelModalVisible}
        vendorName={order.vendorName}
        onKeep={() => setIsCancelModalVisible(false)}
        onConfirm={handleConfirmCancel}
      />

      <VendorPolicyModal
        visible={isPolicyModalVisible}
        onClose={() => setIsPolicyModalVisible(false)}
        policy={order.vendorPolicy || ''}
        vendorName={order.vendorName}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { padding: 8 },
  headerHelpBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerHelpText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 100 },

  vendorHero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },
  vendorHeroRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  vendorLogoWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  vendorLogo: { width: '100%', height: '100%' },
  vendorLogoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  vendorHeroInfo: { flex: 1, gap: 4 },
  vendorName: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  suspendedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  suspendedBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.warning },
  closedVendorNoticeBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  closedVendorNoticeContent: { flex: 1, gap: 2 },
  closedVendorNoticeTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  closedVendorNoticeBody: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  paymentStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
  },
  paymentStatusInfo: { flex: 1, gap: 2 },
  paymentStatusTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text },
  paymentStatusDate: { fontSize: 12, color: Colors.textMuted },
  paymentProofMissing: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 10,
  },
  paymentProofMissingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  paymentProofMissingText: { fontSize: 13, color: Colors.textMuted },
  uploadProofLaterBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  uploadProofLaterText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  paymentProofAttached: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  paymentProofAttachedText: { fontSize: 13, fontWeight: '500' as const, color: Colors.success },
  proofRequestedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: Colors.warningLight,
  },
  proofRequestedText: { flex: 1, fontSize: 13, color: Colors.warning, lineHeight: 18 },
  viewStorePill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  viewStorePillDisabled: { backgroundColor: Colors.surface },
  viewStorePillText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  viewStorePillTextDisabled: { color: Colors.textMuted },

  orderMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },
  orderIdButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    flex: 1,
  },
  orderId: { fontSize: 13, color: Colors.textMuted, fontWeight: '500' as const },
  copiedText: { fontSize: 12, color: Colors.success },
  statusPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusPillRequested: { backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder },
  statusPillActive: { backgroundColor: '#FFF7ED', borderColor: '#FDBA74' },
  statusPillCompleted: { backgroundColor: Colors.successLight, borderColor: Colors.successBorder },
  statusPillCancelled: { backgroundColor: Colors.errorLight, borderColor: Colors.errorBorder },
  statusPillText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3, color: Colors.textMuted },
  statusPillTextRequested: { color: Colors.primary },
  statusPillTextActive: { color: '#EA580C' },
  statusPillTextCompleted: { color: Colors.success },
  statusPillTextCancelled: { color: Colors.error },

  timelineSection: { paddingHorizontal: 20, paddingBottom: 8 },
  terminalBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  terminalBannerRejected: { backgroundColor: Colors.errorLight, borderColor: Colors.errorBorder },
  terminalBannerCancelled: { backgroundColor: Colors.surface, borderColor: Colors.border },
  terminalBannerTextWrap: { flex: 1, gap: 4 },
  terminalBannerTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.textSecondary },
  terminalBannerTitleRejected: { color: Colors.error },
  terminalBannerReason: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  progressTracker: { gap: 0 },
  progressStepContainer: {},
  progressStepRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const },
  progressLineCol: { width: 26, alignItems: 'center' as const },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  progressDotDone: { borderColor: Colors.success, backgroundColor: 'transparent' },
  progressDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  progressDotUpcoming: { borderColor: Colors.border, backgroundColor: Colors.background },
  progressDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.white },
  progressLine: { width: 2, flex: 1, minHeight: 16, backgroundColor: Colors.border, marginVertical: 2 },
  progressLineDone: { backgroundColor: Colors.success },
  progressStepInfo: { flex: 1, paddingLeft: 12, paddingBottom: 16 },
  progressLabel: { fontSize: 14, fontWeight: '500' as const, color: Colors.textSecondary },
  progressLabelActive: { color: Colors.primary, fontWeight: '600' as const },
  progressLabelDone: { color: Colors.success, fontWeight: '600' as const },
  progressLabelUpcoming: { color: Colors.textMuted },
  progressSublabel: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  progressSublabelActive: { color: Colors.primary },

  safetyBanner: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 12,
    padding: 14,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  safetyBannerRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 4 },
  safetyBannerTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.warning },
  safetyBannerText: { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },

  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  cardRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cardRowLast: { borderBottomWidth: 0 },
  cardRowLabel: { fontSize: 14, color: Colors.textMuted },
  cardRowValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.text, flex: 1, textAlign: 'right' as const },

  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemImageWrap: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden' as const,
    backgroundColor: Colors.border,
    flexShrink: 0,
  },
  itemImage: { width: '100%', height: '100%' },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.border,
  },
  itemImageInitial: { fontSize: 18, fontWeight: '700' as const, color: Colors.textMuted },
  itemInfo: { flex: 1, gap: 3 },
  itemName: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  itemAddOns: { fontSize: 12, color: Colors.textMuted },
  itemQty: { fontSize: 13, color: Colors.textMuted },
  itemTotal: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },

  orderNoteText: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    fontStyle: 'italic' as const,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  totalDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 14 },
  totalLabel: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  totalValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },

  receiptRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  receiptRowLabel: { fontSize: 14, color: Colors.textMuted },
  receiptButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  receiptButtonText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  receiptButtonDisabled: { opacity: 0.4 },
  receiptButtonTextDisabled: { color: Colors.textMuted },

  rateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rateButtonText: { fontSize: 15, fontWeight: '600' as const, color: Colors.text },

  bottomSpacer: { height: 8 },

  bottomBar: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  bottomBarInner: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 10,
  },
  bottomBtnWaiting: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.7,
  },
  bottomBtnWaitingText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },

  ratingModal: { flex: 1, backgroundColor: Colors.background },
  ratingModalSafe: { backgroundColor: Colors.background },
  ratingModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ratingModalTitle: { fontSize: 17, fontWeight: '600' as const, color: Colors.text },
  ratingScrollContent: { paddingBottom: 20 },
  ratingSection: { paddingHorizontal: 20, paddingTop: 20 },
  ratingSectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  ratingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingVendorName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  ratingOrderRef: { fontSize: 13, color: Colors.textMuted },
  ratingPrompt: { fontSize: 15, color: Colors.text, marginBottom: 16, lineHeight: 22 },
  starsRow: { flexDirection: 'row' as const, gap: 8 },
  starBtn: { padding: 4 },
  ratingHelper: { fontSize: 14, color: Colors.textMuted, marginBottom: 12 },
  itemRatingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemRatingInfo: { flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1, gap: 10 },
  itemRatingImg: { width: 36, height: 36, borderRadius: 8 },
  itemRatingImgPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  itemRatingInitial: { fontSize: 14, fontWeight: '700' as const, color: Colors.textMuted },
  itemRatingName: { fontSize: 14, color: Colors.text, flex: 1 },
  itemRatingBtns: { flexDirection: 'row' as const, gap: 8 },
  itemRatingBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.border,
  },
  itemRatingBtnGood: { backgroundColor: Colors.successLight },
  itemRatingBtnBad: { backgroundColor: Colors.errorLight },
  feedbackInput: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ratingSubmitBar: { backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border },
  ratingSubmitInner: { paddingHorizontal: 20, paddingVertical: 12 },
  ratingSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
  },
  ratingSubmitBtnDisabled: { backgroundColor: Colors.border, opacity: 0.5 },
  ratingSubmitBtnText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },

  errorState: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  errorStateTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.textMuted, textAlign: 'center' as const },
  bottomBtnCancel: {
    flex: 1,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  bottomBtnCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  submissionSuccessBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: '#F0FDF4',
    borderBottomWidth: 1,
    borderBottomColor: '#BBF7D0',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  submissionSuccessText: {
    flex: 1,
  },
  submissionSuccessTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#16A34A',
    marginBottom: 2,
  },
  submissionSuccessSubtitle: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 18,
  },
  cancelModalContainer: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%' as any,
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  cancelModalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'left' as const,
  },
  cancelModalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'left' as const,
    lineHeight: 21,
    marginBottom: 20,
  },
  cancelModalActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  cancelModalNoBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cancelModalNoBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cancelModalYesBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,140,66,0.12)',
  },
  cancelModalYesBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});

function CancelConfirmModal({
  visible,
  vendorName,
  onKeep,
  onConfirm,
}: {
  visible: boolean;
  vendorName: string;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onKeep}
    >
      <View style={cancelConfirmStyles.overlay}>
        <View style={cancelConfirmStyles.container}>
          <Text style={cancelConfirmStyles.title}>Cancel this order?</Text>
          <Text style={cancelConfirmStyles.message}>
            This will notify {vendorName}. You can cancel before it is accepted.
          </Text>
          <View style={cancelConfirmStyles.actions}>
            <TouchableOpacity
              style={cancelConfirmStyles.keepBtn}
              onPress={onKeep}
              activeOpacity={0.7}
            >
              <Text style={cancelConfirmStyles.keepBtnText}>Keep Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={cancelConfirmStyles.cancelBtn}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={cancelConfirmStyles.cancelBtnText}>Cancel Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const cancelConfirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 21,
    marginBottom: 22,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  keepBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8F9FA',
  },
  keepBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 50,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,140,66,0.12)',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FF8C42',
  },
  closedVendorNoticeBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,140,66,0.12)',
  },
  closedVendorNoticeContent: {
    flex: 1,
  },
  closedVendorNoticeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  closedVendorNoticeBody: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
});
