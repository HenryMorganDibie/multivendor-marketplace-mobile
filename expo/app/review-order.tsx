import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  Truck,
  Clock,
  User,
  Shield,
  Store,
  Sparkles,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { useCart } from '@/contexts/CartContext';
import { useChats } from '@/contexts/ChatContext';
import { mockMenuItems } from '@/mocks/vendorData';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { getMenuItemDisplayPrice, hasItemSalePrice } from '@/utils/itemPricing';
import { generatethe platformOrderId } from '@/utils/orderIdGenerator';
import { useAuditLog } from '@/contexts/AuditLogContext';
import { useVendorRelationships } from '@/contexts/VendorRelationshipContext';
import { useOrders, type PricedCart } from '@/contexts/OrdersContext';
import { ContactCardPickerModal } from '@/components/ContactCardPickerModal';
import { ContactCard } from '@/contexts/ContactCardsContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { Colors } from '@/constants/colors';
import { isVendorCurrentlyOpen, getNextOpenTime } from '@/utils/vendorAvailability';

export default function ReviewOrderScreen() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const params = useLocalSearchParams();
  const { clearCart } = useCart();
  const { getOrCreateOrderChat } = useChats();
  const { logEvent } = useAuditLog();
  const { addRelationship } = useVendorRelationships();
  const { addOrder, priceCart } = useOrders();

  /**
   * The vendor this basket is actually for.
   *
   * Every id below was orderVendorId, so an order placed from any storefront
   * was attributed to the demo business — and since that id does not exist in
   * Firestore, the real order the backend tried to create from it could never
   * resolve a vendor. The id now comes through the navigation params from the
   * cart, and the display fields are looked up from the live vendor list.
   */
  const orderVendorId = (params.vendorId as string) || '';
  const { allVendors } = useVendorFilter();
  const orderVendor = allVendors.find((v: any) => v.id === orderVendorId);
  const [isExitModalVisible, setIsExitModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const [customerNote, setCustomerNote] = useState('');
  const hasSubmittedRef = useRef(false);

  const fulfillmentType = params.fulfillmentType as string;
  const orderNote = params.orderNote as string;
  const itemsJson = params.items as string;
  const items = JSON.parse(itemsJson);

  /**
   * The figures the customer approves are the server's.
   *
   * These came in as route params — a subtotal, discount and total the device
   * worked out. repriceCart was called, but only after submit and with its
   * result discarded, so if the two disagreed the customer had already agreed
   * to a price that was never real. A price that changed, an item that went out
   * of stock, a promotion that expired: all of it surfaced after the fact.
   *
   * Pricing happens on arrival now. The server checks the vendor is active and
   * the country is open, that every item is approved, visible and in stock, and
   * decides which promotion actually applies. Nothing is submittable until it
   * answers, so the amount on screen is the amount that will be charged.
   */
  const [priced, setPriced] = useState<PricedCart | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPricingError(null);
    priceCart({
      vendorId: params.vendorId as string,
      items: items.map((i: any) => ({ itemId: i.id, quantity: i.quantity })),
      fulfillmentType: fulfillmentType?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup',
      orderNote,
    })
      .then((result) => { if (!cancelled) setPriced(result); })
      .catch((err: any) => {
        if (cancelled) return;
        // The backend's message names the actual reason — an item withdrawn, a
        // vendor paused, a country closed. It is shown as-is rather than
        // replaced with something generic the customer cannot act on.
        setPricingError(err?.message ?? 'We could not confirm this order. Please try again.');
      });
    return () => { cancelled = true; };
  }, [itemsJson, fulfillmentType]);

  // Falls back to the passed-in figures only while the server is still
  // answering, so the layout does not jump. Nothing can be submitted until
  // `priced` exists.
  const subtotal = priced?.subtotal ?? Number(params.subtotal);
  const tax = priced?.tax ?? Number(params.tax);
  const discount = priced?.discount ?? Number(params.discount);
  const total = priced?.total ?? Number(params.total);
  const preferredDate = params.preferredDate as string;
  const preferredTime = params.preferredTime as string;
  const contactCardParam = params.contactCard as string;
  const promoCode = params.promoCode as string;

  const totalItemSavings = items.reduce((acc: number, item: any) => {
    const basePrice = item.originalPrice ?? item.price;
    if (item.price < basePrice) {
      return acc + (basePrice - item.price) * item.quantity;
    }
    return acc;
  }, 0);

  const originalSubtotal = items.reduce((acc: number, item: any) => {
    const basePrice = item.originalPrice ?? item.price;
    const addOnTotal = item.addOns?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
    return acc + (basePrice + addOnTotal) * item.quantity;
  }, 0);

  const totalSavings = totalItemSavings + discount;

  const vendorCurrency: Currency =
    ((orderVendor?.currency as Currency) as Currency) || getCurrencyFromCountryCode((orderVendor?.countryCode ?? 'NG'));
  const fmt = (amount: number) => formatPriceWithCommas(amount, vendorCurrency);

  const [contactCard, setContactCard] = useState<ContactCard | null>(() => {
    if (contactCardParam) {
      try { return JSON.parse(contactCardParam); } catch { return null; }
    }
    return null;
  });
  const [showContactCardPicker, setShowContactCardPicker] = useState(false);

  const ITEMS_COLLAPSE_THRESHOLD = 3;
  const visibleItems = showAllItems ? items : items.slice(0, ITEMS_COLLAPSE_THRESHOLD);
  const hasMoreItems = items.length > ITEMS_COLLAPSE_THRESHOLD;

  const handleBackPress = () => {
    if (!hasSubmittedRef.current) {
      setIsExitModalVisible(true);
    } else {
      safeBack();
    }
  };

  const handleSelectContactCard = (card: ContactCard) => {
    setContactCard(card);
    setShowContactCardPicker(false);
  };

  const vendorIsOpen = isVendorCurrentlyOpen(orderVendor as any);
  const vendorNextOpen = getNextOpenTime(orderVendor as any);

  const handleSendOrderRequest = async () => {
    if (isSubmitting || hasSubmittedRef.current) {
      console.log('Order submission already in progress or completed');
      return;
    }

    setIsSubmitting(true);
    hasSubmittedRef.current = true;
    const orderRequestId = `REQ-${Date.now()}`;
    const publicOrderId = generatethe platformOrderId((orderVendor?.slug ?? orderVendorId));

    const finalNote = [orderNote, customerNote].filter(Boolean).join('\n').trim();

    console.log('Order confirmed and sent:', {
      orderRequestId,
      publicOrderId,
      vendor: (orderVendor?.name ?? ''),
      fulfillmentType,
      items,
      subtotal,
      tax,
      discount,
      total,
      orderNote: finalNote || undefined,
      preferredDate: preferredDate || undefined,
      preferredTime: preferredTime || undefined,
      contactCard: contactCard ? JSON.stringify(contactCard) : undefined,
      promoCode: promoCode || undefined,
      vendorWasClosed: !vendorIsOpen,
    });

    if (vendorIsOpen) {
      getOrCreateOrderChat(
        orderVendorId,
        (orderVendor?.name ?? ''),
        orderRequestId,
        publicOrderId,
        'ORDER_REQUESTED'
      );
    } else {
      console.log('[ReviewOrder] Vendor is closed, skipping order chat creation');
    }

    addRelationship(orderVendorId, 'order_submitted');

    void logEvent({
      eventType: 'order_created',
      orderId: orderRequestId,
      vendorId: orderVendorId,
      customerId: 'customer_mock',
      newState: 'ORDER_REQUESTED',
      metadata: {
        publicOrderId,
        fulfillmentType,
        total,
        itemCount: items.length,
      },
    });

    const result = await addOrder({
      id: orderRequestId,
      publicOrderId,
      vendorId: orderVendorId,
      vendorName: (orderVendor?.name ?? ''),
      customerId: 'customer_mock',
      status: 'requested',
      orderDate: new Date().toISOString(),
      fulfillmentType: (fulfillmentType as 'Pickup' | 'Delivery') || 'Pickup',
      fulfillmentMethod: fulfillmentType?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup',
      items: items.map((item: any) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image: item.image,
        addOns: item.addOns,
      })),
      subtotal,
      tax,
      discount,
      total,
      orderNote: finalNote || undefined,
      scheduledDate: preferredDate || undefined,
      scheduledTime: preferredTime || undefined,
      orderSource: 'internal',
      paymentStatus: 'payment_pending',
      eventHistory: [
        {
          eventType: 'order_placed',
          actor: { type: 'customer', name: 'You' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    // addOrder's optimistic row is already gone by now either way (see
    // OrdersContext) — a real rejection here (out of stock, vendor closed,
    // price changed since review) used to be invisible: the cart still got
    // cleared and the customer still landed on the success screen. Now the
    // cart and submit state are left intact so they can see why and retry.
    if (!result.success) {
      Alert.alert(
        'Order Not Placed',
        result.error ?? 'Something changed with this order and it could not be placed. Please review your cart and try again.',
        [{ text: 'OK' }]
      );
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
      return;
    }

    try {
      clearCart();
      router.replace({
        pathname: '/order-success' as any,
        params: {
          vendorName: (orderVendor?.name ?? ''),
          vendorId: orderVendorId,
          orderId: orderRequestId,
          vendorWasClosed: (!vendorIsOpen).toString(),
          vendorNextOpenTime: vendorNextOpen || '',
        },
      });
    } catch (error) {
      console.error('Failed to submit order:', error);
      Alert.alert('Submission Failed', 'Unable to submit your order. Please try again.', [{ text: 'OK' }]);
      setIsSubmitting(false);
      hasSubmittedRef.current = false;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Review Order</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>

        {/* ── VENDOR BLOCK ── */}
        <View style={styles.vendorBlock}>
          <View style={styles.vendorBlockRow}>
            {orderVendor?.logoImage ? (
              <Image source={{ uri: orderVendor?.logoImage }} style={styles.vendorLogo} contentFit="cover" />
            ) : (
              <View style={styles.vendorLogoPlaceholder}>
                <Store size={20} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.vendorBlockInfo}>
              <Text style={styles.vendorBlockName}>{(orderVendor?.name ?? '')}</Text>
              <View style={styles.vendorBlockMeta}>
                {fulfillmentType === 'Delivery' ? (
                  <Truck size={13} color={Colors.textSecondary} />
                ) : (
                  <MapPin size={13} color={Colors.textSecondary} />
                )}
                <Text style={styles.vendorBlockMetaText}>
                  {fulfillmentType} · {orderVendor?.area}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── ITEMS ORDERED ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ITEMS ORDERED</Text>
          <View style={styles.card}>
            {visibleItems.map((item: any, index: number) => {
              const originalPrice = item.originalPrice ?? item.price;
              const hasSale = item.price < originalPrice;
              const addOnTotal = item.addOns?.reduce((sum: number, a: any) => sum + a.price, 0) || 0;
              const unitPrice = item.price + addOnTotal;
              const lineTotal = unitPrice * item.quantity;

              return (
                <View key={`${item.id}-${index}`} style={[styles.itemRow, index > 0 && styles.itemRowBorder]}>
                  <View style={styles.itemImageWrap}>
                    {item.image ? (
                      <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                    ) : (
                      <View style={styles.itemImagePlaceholder}>
                        <Text style={styles.itemImagePlaceholderText}>{item.name.charAt(0)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    {hasSale ? (
                      <View style={styles.itemSalePriceRow}>
                        <Text style={styles.itemCurrentPrice}>{fmt(unitPrice)}</Text>
                        <Text style={styles.itemOriginalPrice}>{fmt(originalPrice + addOnTotal)}</Text>
                        <Text style={styles.itemEachLabel}>each</Text>
                      </View>
                    ) : (
                      <Text style={styles.itemUnitPrice}>{fmt(unitPrice)} each</Text>
                    )}
                    {item.addOns && item.addOns.length > 0 && (
                      <Text style={styles.itemAddOns}>
                        {item.addOns.map((a: any) => a.name).join(' · ')}
                      </Text>
                    )}
                    <View style={styles.itemPriceLine}>
                      <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                      <Text style={styles.itemLineTotal}>{fmt(lineTotal)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {hasMoreItems && (
              <TouchableOpacity
                style={styles.showMoreRow}
                onPress={() => setShowAllItems(!showAllItems)}
                activeOpacity={0.7}
              >
                {showAllItems ? (
                  <>
                    <ChevronUp size={14} color={Colors.primary} />
                    <Text style={styles.showMoreText}>Show less</Text>
                  </>
                ) : (
                  <>
                    <ChevronDown size={14} color={Colors.primary} />
                    <Text style={styles.showMoreText}>
                      Show {items.length - ITEMS_COLLAPSE_THRESHOLD} more item{items.length - ITEMS_COLLAPSE_THRESHOLD !== 1 ? 's' : ''}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── FULFILLMENT DETAILS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FULFILLMENT DETAILS</Text>
          <View style={styles.card}>
            <View style={styles.detailRow}>
              {fulfillmentType === 'Delivery' ? (
                <Truck size={16} color={Colors.textSecondary} />
              ) : (
                <MapPin size={16} color={Colors.textSecondary} />
              )}
              <View style={styles.detailRowContent}>
                <Text style={styles.detailLabel}>Method</Text>
                <Text style={styles.detailValue}>{fulfillmentType}</Text>
              </View>
            </View>
            {(preferredDate || preferredTime) && (
              <>
                <View style={styles.detailDivider} />
                <View style={styles.detailRow}>
                  <Clock size={16} color={Colors.textSecondary} />
                  <View style={styles.detailRowContent}>
                    <Text style={styles.detailLabel}>Preferred time</Text>
                    <Text style={styles.detailValue}>
                      {preferredDate && preferredTime
                        ? `${preferredDate} at ${preferredTime}`
                        : preferredDate || preferredTime}
                    </Text>
                  </View>
                </View>
              </>
            )}
            {contactCard && (
              <>
                <View style={styles.detailDivider} />
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={() => setShowContactCardPicker(true)}
                  activeOpacity={0.7}
                >
                  <User size={16} color={Colors.textSecondary} />
                  <View style={styles.detailRowContent}>
                    <Text style={styles.detailLabel}>Contact</Text>
                    <Text style={styles.detailValue}>{contactCard.name}</Text>
                    <Text style={styles.detailSubvalue}>{contactCard.phone}</Text>
                    {contactCard.address ? (
                      <Text style={styles.detailSubvalue}>{contactCard.address}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ── PAYMENT NOTICE ── */}
        <View style={styles.section}>
          <View style={styles.paymentNotice}>
            <Shield size={18} color={Colors.primary} />
            <View style={styles.paymentNoticeContent}>
              <Text style={styles.paymentNoticeTitle}>Payment handled by vendor</Text>
              <Text style={styles.paymentNoticeBody}>
                Payment is arranged directly with the vendor. the platform does not process payments. The vendor will provide payment instructions after reviewing your order.
              </Text>
            </View>
          </View>
        </View>

        {/* ── CUSTOMER NOTE ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>NOTE FOR VENDOR <Text style={styles.optionalLabel}>(Optional)</Text></Text>
          <View style={styles.card}>
            <TextInput
              style={styles.noteInput}
              placeholder="Add a note for the vendor..."
              placeholderTextColor={Colors.textMuted}
              value={customerNote || orderNote || ''}
              onChangeText={setCustomerNote}
              multiline
              numberOfLines={3}
              maxLength={200}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* ── TOTALS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ORDER TOTAL</Text>
          <View style={styles.card}>
            <View style={styles.totalsInner}>
              {totalItemSavings > 0 ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal (before discount)</Text>
                    <Text style={styles.totalStrikeValue}>{fmt(originalSubtotal)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Sale savings</Text>
                    <Text style={styles.totalDiscountValue}>−{fmt(totalItemSavings)}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Subtotal</Text>
                    <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>{fmt(subtotal)}</Text>
                </View>
              )}
              {orderVendor?.taxEnabled && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>{fmt(tax)}</Text>
                </View>
              )}
              {/* The promotion the server actually applied, named by its own
                  title rather than the code the customer typed. A code is a
                  request; this is what qualified. If the server applied nothing,
                  no line shows — which is the honest answer when a promotion has
                  expired or the basket no longer meets its minimum. */}
              {discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {priced?.appliedPromotion?.title
                      ?? `Discount${promoCode ? ` (${promoCode})` : ''}`}
                  </Text>
                  <Text style={styles.totalDiscountValue}>−{fmt(discount)}</Text>
                </View>
              )}
              {/* A code was entered and the server did not honour it. Saying so
                  beats a total that is quietly higher than expected. */}
              {priced && promoCode && !priced.appliedPromotion && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Promo code {promoCode}</Text>
                  <Text style={styles.promoRejectedValue}>Not applied</Text>
                </View>
              )}
              <View style={styles.totalDivider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalGrandLabel}>Amount to pay vendor</Text>
                <Text style={styles.totalGrandValue}>{fmt(total)}</Text>
              </View>
              {totalSavings > 0 && (
                <View style={styles.savingsRow}>
                  <Sparkles size={13} color="#16A34A" />
                  <Text style={styles.savingsText}>
                    You're saving <Text style={styles.savingsAmount}>{fmt(totalSavings)}</Text>
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ── DISCLAIMER ── */}
        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            By sending this order request, you agree that the platform only shares your order details with {(orderVendor?.name ?? '')}. Payments, delivery, taxes, and fulfillment are handled directly by {(orderVendor?.name ?? '')}.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ── STICKY CTA ── */}
      <SafeAreaView edges={['bottom']} style={styles.stickyFooter}>
        {/* Nothing is submittable until the server has priced the basket, so a
            customer can never agree to a figure the device worked out. If
            pricing failed the reason is shown and the button stays closed —
            the order would be refused on submit anyway, and refusing here says
            why while they can still act on it. */}
        {pricingError ? (
          <Text style={styles.pricingErrorText}>{pricingError}</Text>
        ) : null}
        <TouchableOpacity
          style={[
            styles.sendButton,
            (isSubmitting || !priced) && styles.sendButtonDisabled,
          ]}
          onPress={handleSendOrderRequest}
          disabled={isSubmitting || !priced}
          activeOpacity={0.85}
        >
          <Text style={styles.sendButtonText}>
            {isSubmitting
              ? 'Sending...'
              : !priced
                ? (pricingError ? 'Unavailable' : 'Confirming price...')
                : 'Send order request'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.sendHelperText}>
          Your order request will be shared with the vendor for review.
        </Text>
      </SafeAreaView>

      {/* ── EXIT MODAL ── */}
      <Modal visible={isExitModalVisible} animationType="fade" transparent onRequestClose={() => setIsExitModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.exitModalCard}>
            <Text style={styles.exitModalTitle}>You're almost there</Text>
            <Text style={styles.exitModalBody}>
              If you leave now, your order request won't be sent to {(orderVendor?.name ?? '')}.
            </Text>
            <View style={styles.exitModalActions}>
              <TouchableOpacity
                style={styles.exitModalButtonPrimary}
                onPress={() => setIsExitModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.exitModalButtonPrimaryText}>Continue order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.exitModalButtonSecondary}
                onPress={() => { setIsExitModalVisible(false); safeBack(); }}
                activeOpacity={0.7}
              >
                <Text style={styles.exitModalButtonSecondaryText}>Leave anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ContactCardPickerModal
        visible={showContactCardPicker}
        onClose={() => setShowContactCardPicker(false)}
        onSend={handleSelectContactCard}
        ctaLabel="Confirm"
        showCta={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { padding: 8 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: { width: 40 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 16, paddingTop: 16 },

  vendorBlock: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },
  vendorBlockRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12 },
  vendorLogo: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F0F0' },
  vendorLogoPlaceholder: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#F0F0F0',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  vendorBlockInfo: { flex: 1 },
  vendorBlockName: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  vendorBlockMeta: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5 },
  vendorBlockMetaText: { fontSize: 13, color: Colors.textSecondary },

  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600' as const, color: Colors.textMuted,
    letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 2,
  },
  optionalLabel: { fontWeight: '400' as const, color: Colors.textMuted, fontSize: 11 },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
      android: { elevation: 2 },
      web: { boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
    }),
  },

  itemRow: { flexDirection: 'row' as const, padding: 14, gap: 12 },
  itemRowBorder: { borderTopWidth: 1, borderTopColor: '#F0F0F2' },
  itemImageWrap: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F5F5F5' },
  itemImage: { width: '100%' as any, height: '100%' as any },
  itemImagePlaceholder: {
    width: '100%' as any, height: '100%' as any, backgroundColor: Colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  itemImagePlaceholderText: { fontSize: 18, fontWeight: '700' as const, color: Colors.textSecondary },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text, marginBottom: 2 },
  itemSalePriceRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 2 },
  itemCurrentPrice: { fontSize: 13, fontWeight: '600' as const, color: '#2B2B2B' },
  itemOriginalPrice: { fontSize: 12, fontWeight: '400' as const, color: '#9CA3AF', textDecorationLine: 'line-through' as const },
  itemEachLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '400' as const },
  itemUnitPrice: { fontSize: 13, color: '#9CA3AF', fontWeight: '400' as const, marginTop: 2 },
  itemAddOns: { fontSize: 12, color: Colors.textMuted, marginBottom: 4 },
  itemPriceLine: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginTop: 4 },
  itemQty: { fontSize: 13, color: Colors.textSecondary },
  itemLineTotal: { fontSize: 15, fontWeight: '700' as const, color: '#2B2B2B' },
  showMoreRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
    gap: 6, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F0F0F2',
  },
  showMoreText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },

  detailRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 12, padding: 14 },
  detailDivider: { height: 1, backgroundColor: '#F0F0F2', marginHorizontal: 14 },
  detailRowContent: { flex: 1 },
  detailLabel: { fontSize: 12, color: Colors.textMuted, marginBottom: 2 },
  detailValue: { fontSize: 15, fontWeight: '500' as const, color: Colors.text },
  detailSubvalue: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },

  paymentNotice: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  paymentNoticeContent: { flex: 1 },
  paymentNoticeTitle: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, marginBottom: 4 },
  paymentNoticeBody: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },

  noteInput: {
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },

  totalsInner: { padding: 16 },
  totalRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingVertical: 5 },
  totalLabel: { fontSize: 14, color: Colors.textSecondary },
  totalValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.text },
  totalStrikeValue: { fontSize: 14, fontWeight: '400' as const, color: Colors.textMuted, textDecorationLine: 'line-through' as const },
  totalDiscountValue: { fontSize: 14, fontWeight: '500' as const, color: Colors.success },
  totalDivider: { height: 1, backgroundColor: '#F0F0F2', marginVertical: 8 },
  totalGrandLabel: { fontSize: 17, fontWeight: '700' as const, color: Colors.text },
  totalGrandValue: { fontSize: 20, fontWeight: '700' as const, color: '#2B2B2B' },
  savingsRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6,
    marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F2',
  },
  savingsText: { fontSize: 13, color: '#166534', fontWeight: '500' as const },
  savingsAmount: { fontWeight: '700' as const, color: '#16A34A' },

  disclaimerContainer: { paddingTop: 20, paddingHorizontal: 4 },
  disclaimerText: { fontSize: 12, color: Colors.textMuted, lineHeight: 18 },
  bottomSpacer: { height: 30 },

  stickyFooter: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  sendButtonDisabled: { backgroundColor: 'rgba(255,140,66,0.35)' },
  promoRejectedValue: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  pricingErrorText: {
    color: '#B3261E',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sendButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  sendHelperText: {
    fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const,
    marginTop: 8, lineHeight: 16,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center' as const, alignItems: 'center' as const, paddingHorizontal: 24,
  },
  exitModalCard: {
    backgroundColor: Colors.white, borderRadius: 20, width: '100%' as any, maxWidth: 380, padding: 24,
  },
  exitModalTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, textAlign: 'center' as const, marginBottom: 12 },
  exitModalBody: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 24, marginBottom: 24 },
  exitModalActions: { gap: 12 },
  exitModalButtonPrimary: {
    backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center' as const, minHeight: 52, justifyContent: 'center' as const,
  },
  exitModalButtonPrimaryText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  exitModalButtonSecondary: {
    backgroundColor: Colors.white, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center' as const, borderWidth: 2, borderColor: Colors.charcoal,
    minHeight: 52, justifyContent: 'center' as const,
  },
  exitModalButtonSecondaryText: { fontSize: 16, fontWeight: '600' as const, color: Colors.charcoal },
});
