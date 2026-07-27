import React, { useEffect, useRef } from 'react';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { CheckCircle, AlertCircle, Clock, Copy, MessageCircle, Eye, ShieldAlert, HeadphonesIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/colors';
import { PaymentState, getPaymentStateConfig } from '@/constants/paymentStates';

export interface OrderPaymentDetails {
  paymentMethod: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  message?: string;
}

interface PaymentStateCardProps {
  paymentState: PaymentState;
  vendorName: string;
  paymentDetails?: OrderPaymentDetails;
  onMarkPaid?: () => void;
  onContactVendor?: () => void;
  onViewPaymentDetails?: () => void;
  onContactSupport?: () => void;
  isPaidButtonDisabled?: boolean;
}

export const PaymentStateCard = React.memo(function PaymentStateCard({
  paymentState,
  vendorName,
  paymentDetails,
  onMarkPaid,
  onContactVendor,
  onViewPaymentDetails,
  onContactSupport,
  isPaidButtonDisabled = false,
}: PaymentStateCardProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const { toastVisible, showToast } = useToast();

  useEffect(() => {
    console.log('[PaymentStateCard] Rendering state:', paymentState, 'vendor:', vendorName);
    fadeAnim.setValue(0);
    slideAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [paymentState, vendorName, fadeAnim, slideAnim]);

  const handleCopy = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      showToast();
    } catch (e) {
      console.error('[PaymentStateCard] Copy failed:', e);
    }
  };

  const config = getPaymentStateConfig(paymentState);

  const renderStateBadge = () => (
    <View style={[styles.stateBadge, { backgroundColor: config.backgroundColor }]}>
      <Text style={[styles.stateBadgeText, { color: config.color }]}>
        {config.label}
      </Text>
    </View>
  );

  const renderPaymentDetailsBlock = () => {
    if (!paymentDetails) return null;
    return (
      <View style={styles.paymentDetailsBlock}>
        <Text style={styles.paymentDetailsTitle}>
          Pay via {paymentDetails.paymentMethod}
        </Text>
        {paymentDetails.bankName && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>BANK</Text>
            <Text style={styles.detailValue}>{paymentDetails.bankName}</Text>
          </View>
        )}
        {paymentDetails.accountName && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>ACCOUNT NAME</Text>
            <Text style={styles.detailValue}>{paymentDetails.accountName}</Text>
          </View>
        )}
        {paymentDetails.accountNumber && (
          <View style={styles.detailRow}>
            <View style={styles.detailRowInner}>
              <Text style={styles.detailLabel}>ACCOUNT NUMBER</Text>
              <TouchableOpacity
                onPress={() => handleCopy(paymentDetails.accountNumber!)}
                style={styles.copyBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Copy size={13} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.detailValue}>{paymentDetails.accountNumber}</Text>

          </View>
        )}
        {paymentDetails.message && (
          <View style={styles.vendorNoteBlock}>
            <Text style={styles.detailLabel}>NOTE FROM VENDOR</Text>
            <Text style={styles.vendorNoteText}>{paymentDetails.message}</Text>
          </View>
        )}
      </View>
    );
  };

  const renderContent = () => {
    switch (paymentState) {
      case 'AWAITING_VENDOR_PAYMENT_DETAILS':
        return (
          <>
            <View style={styles.stateRow}>
              <Clock size={16} color="#9CA3AF" />
              {renderStateBadge()}
            </View>
            <Text style={styles.messageText}>
              Order request sent.{' '}
              <Text style={styles.vendorNameInline}>{vendorName}</Text> will provide
              payment details shortly.
            </Text>
            <TouchableOpacity
              style={styles.primaryButtonDisabled}
              disabled
              activeOpacity={1}
            >
              <Text style={styles.primaryButtonTextDisabled}>I Have Paid</Text>
            </TouchableOpacity>
          </>
        );

      case 'PAYMENT_DETAILS_SENT':
        return (
          <>
            <View style={styles.stateRow}>
              <AlertCircle size={16} color={Colors.primary} />
              {renderStateBadge()}
            </View>
            <Text style={styles.headerText}>Payment instructions received</Text>
            <Text style={styles.messageText}>
              Please complete payment using the details provided by{' '}
              <Text style={styles.vendorNameInline}>{vendorName}</Text>.
            </Text>
            {renderPaymentDetailsBlock()}
            <TouchableOpacity
              style={[styles.primaryButton, isPaidButtonDisabled && styles.primaryButtonDisabled]}
              onPress={isPaidButtonDisabled ? undefined : onMarkPaid}
              activeOpacity={0.85}
              disabled={isPaidButtonDisabled}
            >
              <Text style={[styles.primaryButtonText, isPaidButtonDisabled && styles.primaryButtonTextDisabled]}>
                I Have Paid
              </Text>
            </TouchableOpacity>
          </>
        );

      case 'CUSTOMER_MARKED_PAID':
        return (
          <>
            <View style={styles.stateRow}>
              <Clock size={16} color="#F59E0B" />
              {renderStateBadge()}
            </View>
            <View style={styles.confirmationCard}>
              <CheckCircle size={18} color={Colors.primary} />
              <View style={styles.confirmationCardText}>
                <Text style={styles.confirmationTitle}>Payment marked as sent.</Text>
                <Text style={styles.confirmationSubtext}>
                  <Text style={styles.vendorNameInline}>{vendorName}</Text> will confirm
                  receipt shortly.
                </Text>
              </View>
            </View>
            <Text style={styles.subduedNote}>
              Confirmation times may vary depending on the vendor.
            </Text>
            <TouchableOpacity
              style={styles.primaryButtonDisabled}
              disabled
              activeOpacity={1}
            >
              <Text style={styles.primaryButtonTextDisabled}>Payment Sent</Text>
            </TouchableOpacity>
          </>
        );

      case 'VENDOR_PAYMENT_CONFIRMED':
        return (
          <>
            <View style={[styles.successBanner]}>
              <CheckCircle size={18} color={Colors.success} />
              <View style={styles.bannerTextBlock}>
                <Text style={styles.successBannerTitle}>
                  Payment confirmed by {vendorName}.
                </Text>
                <Text style={styles.successBannerSubtext}>
                  Your order is now being prepared.
                </Text>
              </View>
            </View>
          </>
        );

      case 'PAYMENT_REJECTED':
        return (
          <>
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color={Colors.error} />
              <View style={styles.bannerTextBlock}>
                <Text style={styles.errorBannerTitle}>Payment could not be confirmed.</Text>
                <Text style={styles.errorBannerSubtext}>
                  {vendorName} could not confirm your payment. Please contact the vendor
                  or submit payment again.
                </Text>
              </View>
            </View>
            <View style={styles.rejectedActions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onContactVendor}
                activeOpacity={0.8}
              >
                <MessageCircle size={16} color={Colors.text} />
                <Text style={styles.secondaryButtonText}>Contact Vendor</Text>
              </TouchableOpacity>
              {paymentDetails && (
                <TouchableOpacity
                  style={styles.ghostButton}
                  onPress={onViewPaymentDetails}
                  activeOpacity={0.8}
                >
                  <Eye size={16} color={Colors.textSecondary} />
                  <Text style={styles.ghostButtonText}>View Payment Details</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        );

      case 'ORDER_READY':
        return (
          <>
            <View style={styles.successBanner}>
              <CheckCircle size={18} color={Colors.success} />
              <View style={styles.bannerTextBlock}>
                <Text style={styles.successBannerTitle}>Your order is ready.</Text>
                <Text style={styles.successBannerSubtext}>
                  Please follow pickup or delivery instructions from{' '}
                  {vendorName}.
                </Text>
              </View>
            </View>
          </>
        );

      case 'ORDER_COMPLETED':
        return (
          <>
            <View style={styles.successBanner}>
              <CheckCircle size={18} color={Colors.success} />
              <View style={styles.bannerTextBlock}>
                <Text style={styles.successBannerTitle}>Order completed.</Text>
                <Text style={styles.successBannerSubtext}>
                  Thank you for ordering from {vendorName}.
                </Text>
              </View>
            </View>
          </>
        );

      case 'PAYMENT_UNDER_REVIEW':
        return (
          <>
            <View style={styles.reviewBanner}>
              <ShieldAlert size={18} color={Colors.warning} />
              <View style={styles.bannerTextBlock}>
                <Text style={styles.reviewBannerTitle}>This order is temporarily under review.</Text>
                <Text style={styles.reviewBannerSubtext}>
                  The vendor is currently unavailable. the platform support has been notified.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={onContactSupport}
              activeOpacity={0.8}
            >
              <HeadphonesIcon size={16} color={Colors.text} />
              <Text style={styles.supportButtonText}>Contact Support</Text>
            </TouchableOpacity>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {renderContent()}
      <Toast visible={toastVisible} />
      <Text style={styles.legalFooter}>
        Orders and payments are handled directly by vendors on the platform.
      </Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  stateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 22,
  },
  messageText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  vendorNameInline: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  paymentDetailsBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  paymentDetailsTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  detailRow: {
    gap: 2,
  },
  detailRowInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondaryOnSurface,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  detailValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  copyBtn: {
    padding: 2,
  },
  copiedText: {
    fontSize: 11,
    color: Colors.success,
    marginTop: 2,
  },
  vendorNoteBlock: {
    gap: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  vendorNoteText: {
    fontSize: 14,
    color: Colors.textSecondaryOnSurface,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
      web: {},
    }),
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.surface,
    height: 52,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  primaryButtonTextDisabled: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textMutedOnSurface,
  },
  confirmationCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: 'rgba(255,140,66,0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  confirmationCardText: {
    flex: 1,
    gap: 4,
  },
  confirmationTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  confirmationSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  subduedNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  successBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.successLight,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  bannerTextBlock: {
    flex: 1,
    gap: 3,
  },
  successBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  successBannerSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.errorLight,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  errorBannerSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  rejectedActions: {
    gap: 10,
  },
  secondaryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  ghostButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 44,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  legalFooter: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
    textAlign: 'center' as const,
    paddingHorizontal: 4,
  },
  reviewBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reviewBannerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
    lineHeight: 21,
  },
  reviewBannerSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 2,
  },
  supportButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  supportButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
