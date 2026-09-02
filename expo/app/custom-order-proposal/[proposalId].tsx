import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle,
  XCircle,
  Lock,
  Package,
  MapPin,
  Calendar,
} from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useCustomOrders } from '@/contexts/CustomOrderContext';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendors, type Vendor } from '@/mocks/vendorData';
import { vendorRepository } from '@/services/repositories/vendorRepository';

export default function CustomerProposalScreen() {
  const router = useRouter();
  const { proposalId } = useLocalSearchParams();
  const { proposals, acceptProposal, rejectProposal, deleteProposal } = useCustomOrders();

  const [isItemsExpanded, setIsItemsExpanded] = useState(true);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const proposal = proposals.find((p) => p.id === proposalId);

  // mockVendors.find(v => v.id === proposal?.vendorId), repeated five times
  // below for each price line, only ever matched the ten demo ids — every
  // real vendor's custom-order pricing silently displayed in NGN via the
  // countryCode fallback. Resolved once here via vendorRepository.getById
  // (same live lookup used for vendor-status checks elsewhere, e.g.
  // app/chat/[vendorId].tsx) and reused by getProposalCurrency below.
  const [liveProposalVendor, setLiveProposalVendor] = useState<Vendor | undefined>(undefined);
  useEffect(() => {
    const vendorId = proposal?.vendorId;
    if (!vendorId) {
      setLiveProposalVendor(undefined);
      return;
    }
    let cancelled = false;
    void vendorRepository.getById(vendorId).then((v) => {
      if (!cancelled) setLiveProposalVendor(v);
    });
    return () => { cancelled = true; };
  }, [proposal?.vendorId]);

  const getProposalCurrency = (): Currency => {
    const v = liveProposalVendor ?? mockVendors.find((vv) => vv.id === proposal?.vendorId);
    return (v?.currency as Currency) || getCurrencyFromCountryCode(v?.countryCode || 'NG');
  };

  const isDraft = proposal?.state === 'DRAFT';
  const isProposalSent = proposal?.state === 'PROPOSAL_SENT';
  const isOrderRequested = proposal?.state === 'ORDER_REQUESTED';

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [proposal?.state, fadeAnim]);

  const triggerFadeTransition = (callback: () => void) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 100);
  };

  if (!proposal) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <SafeAreaView edges={['top']} style={styles.safeArea}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
                <ChevronLeft size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>Custom Order</Text>
              <View style={styles.headerButton} />
            </View>
          </SafeAreaView>
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyText}>Proposal not found</Text>
          </View>
        </View>
      </>
    );
  }

  const totalItems = proposal.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAccept = () => {
    Alert.alert(
      'Accept this proposal?',
      'This will create an order request and lock the proposal. You cannot make changes after accepting.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept Proposal',
          onPress: () => {
            triggerFadeTransition(() => {
              const order = acceptProposal(proposal.id);
              if (order) {
                console.log('[CustomerProposal] Accepted. Order created:', order.id);
              }
            });
          },
        },
      ]
    );
  };

  const handleReject = () => {
    Alert.alert(
      'Reject this proposal?',
      'The proposal will be sent back to the vendor as a draft. They can revise and resend.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Proposal',
          style: 'destructive',
          onPress: () => {
            triggerFadeTransition(() => {
              rejectProposal(proposal.id);
              console.log('[CustomerProposal] Proposal rejected, returned to DRAFT');
            });
          },
        },
      ]
    );
  };

  const handleCancelDraft = () => {
    Alert.alert(
      'Cancel custom order?',
      'This will remove this custom order request.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel',
          style: 'destructive',
          onPress: () => {
            deleteProposal(proposal.id);
            router.back();
          },
        },
      ]
    );
  };

  const getHeaderBadge = () => {
    if (isDraft) {
      return (
        <View style={styles.badgeDraft}>
          <Clock size={11} color={Colors.textSecondary} strokeWidth={2.5} />
          <Text style={styles.badgeDraftText}>Awaiting Proposal</Text>
        </View>
      );
    }
    if (isProposalSent) {
      return (
        <View style={styles.badgePending}>
          <Clock size={11} color={Colors.warning} strokeWidth={2.5} />
          <Text style={styles.badgePendingText}>Review Required</Text>
        </View>
      );
    }
    if (isOrderRequested) {
      return (
        <View style={styles.badgeSuccess}>
          <CheckCircle size={11} color={Colors.success} strokeWidth={2.5} />
          <Text style={styles.badgeSuccessText}>Order Requested</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Custom Order</Text>
              {getHeaderBadge()}
            </View>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>

        <Animated.View style={[styles.scrollWrapper, { opacity: fadeAnim }]}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {isDraft && (
              <View style={styles.stateBanner}>
                <View style={styles.stateBannerIconWrap}>
                  <Clock size={20} color={Colors.textSecondary} strokeWidth={2} />
                </View>
                <View style={styles.stateBannerContent}>
                  <Text style={styles.stateBannerTitle}>Waiting for vendor proposal</Text>
                  <Text style={styles.stateBannerSubtext}>
                    The vendor is preparing a proposal for your custom order. You will be notified when it is ready for review.
                  </Text>
                </View>
              </View>
            )}

            {isProposalSent && (
              <View style={styles.reviewBanner}>
                <View style={styles.reviewBannerIconWrap}>
                  <Package size={20} color={Colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.reviewBannerContent}>
                  <Text style={styles.reviewBannerTitle}>Proposal ready for review</Text>
                  <Text style={styles.reviewBannerSubtext}>
                    Review the items, pricing, and details below. Accept to confirm your order or reject to ask for changes.
                  </Text>
                </View>
              </View>
            )}

            {isOrderRequested && (
              <View style={styles.orderRequestedBanner}>
                <View style={styles.orderRequestedIconWrap}>
                  <CheckCircle size={20} color={Colors.success} strokeWidth={2} />
                </View>
                <View style={styles.orderRequestedContent}>
                  <Text style={styles.orderRequestedTitle}>Order request submitted</Text>
                  <Text style={styles.orderRequestedSubtext}>
                    Your order has been requested. The vendor will confirm and provide payment details shortly.
                  </Text>
                </View>
              </View>
            )}

            {isOrderRequested && (
              <View style={styles.immutableBanner}>
                <Lock size={13} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.immutableBannerText}>
                  Order is locked — no changes can be made after acceptance
                </Text>
              </View>
            )}

            {(isProposalSent || isOrderRequested) && (
              <>
                {(proposal.fulfillmentMethod || proposal.preferredDate || proposal.preferredTime) && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>FULFILLMENT</Text>
                    <View style={styles.card}>
                      {proposal.fulfillmentMethod && (
                        <View style={styles.detailRow}>
                          <MapPin size={16} color={Colors.textSecondary} strokeWidth={2} />
                          <Text style={styles.detailLabel}>Method</Text>
                          <Text style={styles.detailValue}>
                            {proposal.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'}
                          </Text>
                        </View>
                      )}
                      {proposal.preferredDate && (
                        <View style={[styles.detailRow, styles.detailRowBorder]}>
                          <Calendar size={16} color={Colors.textSecondary} strokeWidth={2} />
                          <Text style={styles.detailLabel}>Date</Text>
                          <Text style={styles.detailValue}>{proposal.preferredDate}</Text>
                        </View>
                      )}
                      {proposal.preferredTime && (
                        <View style={[styles.detailRow, styles.detailRowBorder]}>
                          <Clock size={16} color={Colors.textSecondary} strokeWidth={2} />
                          <Text style={styles.detailLabel}>Time</Text>
                          <Text style={styles.detailValue}>{proposal.preferredTime}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <TouchableOpacity
                    style={styles.sectionHeaderRow}
                    onPress={() => setIsItemsExpanded(!isItemsExpanded)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.sectionLabel}>ITEMS</Text>
                    <View style={styles.sectionHeaderRight}>
                      <Text style={styles.sectionCount}>{totalItems} {totalItems === 1 ? 'item' : 'items'}</Text>
                      {isItemsExpanded
                        ? <ChevronUp size={16} color={Colors.textSecondary} />
                        : <ChevronDown size={16} color={Colors.textSecondary} />
                      }
                    </View>
                  </TouchableOpacity>

                  {isItemsExpanded && (
                    <View style={styles.card}>
                      {proposal.items.map((item, index) => (
                        <View
                          key={item.id}
                          style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
                        >
                          <View style={styles.itemLeft}>
                            <Text style={styles.itemQtyBadge}>{item.quantity}×</Text>
                          </View>
                          <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            {item.description && (
                              <Text style={styles.itemDescription}>{item.description}</Text>
                            )}
                            {item.note && (
                              <Text style={styles.itemNote}>{item.note}</Text>
                            )}
                          </View>
                          <Text style={styles.itemPrice}>{formatPriceWithCommas(item.amount, getProposalCurrency())}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {proposal.orderNote && (
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>ORDER NOTE</Text>
                    <View style={styles.card}>
                      <Text style={styles.noteText}>{proposal.orderNote}</Text>
                    </View>
                  </View>
                )}

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>PRICING</Text>
                  <View style={styles.card}>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceLabel}>Subtotal</Text>
                      <Text style={styles.priceValue}>{formatPriceWithCommas(proposal.subtotal, getProposalCurrency())}</Text>
                    </View>
                    {proposal.taxAmount && proposal.taxAmount > 0 ? (
                      <View style={[styles.priceRow, styles.priceRowBorder]}>
                        <Text style={styles.priceLabel}>Tax</Text>
                        <Text style={styles.priceValue}>{formatPriceWithCommas(proposal.taxAmount, getProposalCurrency())}</Text>
                      </View>
                    ) : null}
                    <View style={[styles.priceRow, styles.priceRowBorder, styles.priceRowTotal]}>
                      <Text style={styles.priceTotalLabel}>Total</Text>
                      <Text style={styles.priceTotalValue}>{formatPriceWithCommas(proposal.total, getProposalCurrency())}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.legalFooter}>
                  Orders and payments are handled directly by vendors on theplatform.
                </Text>
              </>
            )}

            {isDraft && proposal.items.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>ITEMS (DRAFT)</Text>
                <View style={styles.card}>
                  {proposal.items.map((item, index) => (
                    <View
                      key={item.id}
                      style={[styles.itemRow, index > 0 && styles.itemRowBorder]}
                    >
                      <View style={styles.itemLeft}>
                        <Text style={styles.itemQtyBadge}>{item.quantity}×</Text>
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        {item.description && (
                          <Text style={styles.itemDescription}>{item.description}</Text>
                        )}
                      </View>
                      <Text style={styles.itemPrice}>{formatPriceWithCommas(item.amount, getProposalCurrency())}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </Animated.View>

        {isProposalSent && (
          <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={handleReject}
              activeOpacity={0.8}
            >
              <XCircle size={18} color={Colors.text} strokeWidth={2} />
              <Text style={styles.rejectButtonText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAccept}
              activeOpacity={0.8}
            >
              <CheckCircle size={18} color={Colors.white} strokeWidth={2} />
              <Text style={styles.acceptButtonText}>Accept Proposal</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {isDraft && (
          <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.cancelDraftButton}
              onPress={handleCancelDraft}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelDraftButtonText}>Cancel Custom Order</Text>
            </TouchableOpacity>
          </SafeAreaView>
        )}

        {isOrderRequested && (
          <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
            <View style={styles.lockedFooter}>
              <Lock size={15} color={Colors.success} strokeWidth={2} />
              <Text style={styles.lockedFooterText}>Order locked. Awaiting vendor confirmation</Text>
            </View>
          </SafeAreaView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  scrollWrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  badgeDraft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.surface,
  },
  badgeDraftText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  badgePending: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.warningLight,
  },
  badgePendingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.warning,
  },
  badgeSuccess: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Colors.successLight,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  stateBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    margin: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stateBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stateBannerContent: {
    flex: 1,
  },
  stateBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  stateBannerSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  reviewBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    margin: 16,
    padding: 16,
    backgroundColor: Colors.primarySoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.25)',
  },
  reviewBannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,140,66,0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  reviewBannerContent: {
    flex: 1,
  },
  reviewBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  reviewBannerSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  orderRequestedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    margin: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: Colors.successLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  orderRequestedIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(22,163,74,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  orderRequestedContent: {
    flex: 1,
  },
  orderRequestedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
    marginBottom: 4,
  },
  orderRequestedSubtext: {
    fontSize: 13,
    color: Colors.success,
    lineHeight: 19,
    opacity: 0.8,
  },
  immutableBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
  },
  immutableBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
    textTransform: 'uppercase' as const,
  },
  sectionHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  sectionHeaderRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  itemLeft: {
    paddingTop: 2,
  },
  itemQtyBadge: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    minWidth: 28,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  itemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  itemNote: {
    fontSize: 13,
    color: Colors.primary,
    fontStyle: 'italic' as const,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    paddingTop: 2,
  },
  noteText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  priceRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  priceRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  priceRowTotal: {
    paddingVertical: 16,
  },
  priceLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  priceTotalLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  priceTotalValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  legalFooter: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginHorizontal: 24,
    marginBottom: 8,
    lineHeight: 17,
  },
  emptyCenter: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 32,
  },
  bottomActions: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    flexDirection: 'row' as const,
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  rejectButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingHorizontal: 20,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rejectButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cancelDraftButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelDraftButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  lockedFooter: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  lockedFooterText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
});
