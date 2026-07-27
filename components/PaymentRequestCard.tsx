import React from 'react';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Copy, Clock } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { PaymentRequestData, CatalogItemData } from '@/mocks/chatData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

interface PaymentRequestCardProps {
  vendorName: string;
  vendorInitial?: string;
  orderId: string;
  paymentData: PaymentRequestData;
  catalogItem?: CatalogItemData;
  timestamp: string;
  role: 'customer' | 'vendor';
  onViewOrderDetails?: () => void;
  statusMessage?: string;
  currency?: Currency;
}

export const PaymentRequestCard = React.memo(function PaymentRequestCard({
  vendorName,
  vendorInitial,
  orderId,
  paymentData,
  catalogItem,
  timestamp,
  role,
  onViewOrderDetails,
  statusMessage,
  currency = 'NGN',
}: PaymentRequestCardProps) {
  const router = useRouter();
  const { toastVisible, showToast } = useToast();

  const handleCopy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showToast();
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const paymentType = paymentData.isPartialPayment
    ? 'Partial Payment'
    : paymentData.paymentType || 'Full Payment';

  const paymentStatus = paymentData.status;
  const isConfirmed = paymentStatus === 'confirmed';

  const handleViewItem = () => {
    if (!catalogItem?.id) return;
    if (role === 'customer') {
      router.push(`/item/${catalogItem.id}` as any);
    } else {
      router.push(`/vendor/catalog/item/${catalogItem.id}` as any);
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={onViewOrderDetails}
        activeOpacity={onViewOrderDetails ? 0.7 : 1}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerLabel}>
            {role === 'vendor' ? 'PAYMENT STATUS' : 'PAYMENT REQUEST'}
          </Text>
          {role !== 'vendor' && !isConfirmed && (
            <View style={styles.statusBadge}>
              <Clock size={12} color={Colors.primary} />
              <Text style={styles.statusBadgeText}>Awaiting payment</Text>
            </View>
          )}
          {role !== 'vendor' && isConfirmed && (
            <View style={styles.statusBadgeConfirmed}>
              <Text style={styles.statusBadgeTextConfirmed}>Paid</Text>
            </View>
          )}
        </View>

        <View style={styles.vendorRow}>
          <View style={styles.vendorAvatar}>
            <Text style={styles.vendorAvatarText}>
              {vendorInitial || vendorName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.vendorNameText}>{vendorName}</Text>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Order ID</Text>
            <View style={styles.detailValueRow}>
              <Text style={styles.detailValue} numberOfLines={1}>
                {orderId.toUpperCase()}
              </Text>
              <TouchableOpacity
                onPress={() => handleCopy(orderId)}
                style={styles.copyBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Copy size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>

          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Type</Text>
            <Text style={styles.detailValue}>{paymentType}</Text>
          </View>

          <View style={styles.amountRow}>
            <Text style={styles.detailLabel}>Amount</Text>
            <Text style={styles.amountValue}>
              {formatPriceWithCommas(paymentData.amount, currency)}
            </Text>
          </View>

          {role === 'vendor' && (
            <View style={styles.vendorStatusRow}>
              {!isConfirmed ? (
                <View style={styles.statusBadge}>
                  <Clock size={12} color={Colors.primary} />
                  <Text style={styles.statusBadgeText}>Payment Pending</Text>
                </View>
              ) : (
                <View style={styles.statusBadgeConfirmed}>
                  <Text style={styles.statusBadgeTextConfirmed}>Paid</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {(paymentData.paymentMethod === 'Bank Transfer' || paymentData.paymentMethod === 'E-Transfer' || paymentData.paymentMethod === 'Mobile Wallet' || paymentData.paymentMethod === 'Cash App' || paymentData.paymentMethod === 'Phone Payment') && (
          <Text style={styles.paymentInstructionsLabel}>
            {role === 'vendor' ? 'Payment instructions sent to customer' : 'Vendor Payment Instructions'}
          </Text>
        )}

        {paymentData.paymentMethod === 'Bank Transfer' && (
          <View style={styles.bankSection}>
            <Text style={styles.bankSectionTitle}>Pay via Bank Transfer</Text>

            {paymentData.bankName && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>BANK</Text>
                <Text style={styles.bankValue}>{paymentData.bankName}</Text>
              </View>
            )}

            {paymentData.accountName && (
              <View style={styles.bankRow}>
                <Text style={styles.bankLabel}>ACCOUNT NAME</Text>
                <Text style={styles.bankValue}>{paymentData.accountName}</Text>
              </View>
            )}

            {paymentData.accountNumber && (
              <View style={styles.bankRow}>
                <View style={styles.bankLabelRow}>
                  <Text style={styles.bankLabel}>ACCOUNT NUMBER</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopy(paymentData.accountNumber!)
                    }
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Copy size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.bankValue}>
                  {paymentData.accountNumber}
                </Text>

              </View>
            )}
          </View>
        )}

        {paymentData.paymentMethod === 'E-Transfer' && (
          <View style={styles.bankSection}>
            <Text style={styles.bankSectionTitle}>Pay via E-Transfer</Text>
            {paymentData.accountNumber && (
              <View style={styles.bankRow}>
                <View style={styles.bankLabelRow}>
                  <Text style={styles.bankLabel}>RECIPIENT</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopy(paymentData.accountNumber!)
                    }
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Copy size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.bankValue}>
                  {paymentData.accountNumber}
                </Text>

              </View>
            )}
          </View>
        )}

        {(paymentData.paymentMethod === 'Mobile Wallet' ||
          paymentData.paymentMethod === 'Cash App' ||
          paymentData.paymentMethod === 'Phone Payment') && (
          <View style={styles.bankSection}>
            <Text style={styles.bankSectionTitle}>Pay via Mobile Wallet</Text>
            {paymentData.accountNumber && (
              <View style={styles.bankRow}>
                <View style={styles.bankLabelRow}>
                  <Text style={styles.bankLabel}>PHONE NUMBER</Text>
                  <TouchableOpacity
                    onPress={() =>
                      handleCopy(paymentData.accountNumber!)
                    }
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Copy size={14} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.bankValue}>
                  {paymentData.accountNumber}
                </Text>

              </View>
            )}
          </View>
        )}

        {paymentData.message && (
          <View style={styles.messageSection}>
            <Text style={styles.messageLabel}>Note from vendor</Text>
            <Text style={styles.messageText}>{paymentData.message}</Text>
          </View>
        )}

        <Text style={styles.timestamp}>{formatTime(timestamp)}</Text>

        {role === 'customer' && (
          <Text style={styles.nonEscrowDisclaimer}>
            Payments are made directly to the vendor. the platform does not process payments.
          </Text>
        )}
      </TouchableOpacity>

      {catalogItem && (
        <View style={styles.productCard}>
          <View style={styles.productContent}>
            <View style={styles.productImageContainer}>
              {catalogItem.image ? (
                <Image
                  source={{ uri: catalogItem.image }}
                  style={styles.productImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <Text style={styles.productImagePlaceholderIcon}>🍴</Text>
                </View>
              )}
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {catalogItem.name}
              </Text>
              <Text style={styles.productPrice}>
                {formatPriceWithCommas(catalogItem.price, currency)}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.viewButton}
            onPress={handleViewItem}
            activeOpacity={0.7}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      )}

      {statusMessage && (
        <Text style={styles.statusMessage}>{statusMessage}</Text>
      )}
      <Toast visible={toastVisible} />
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center' as const,
    marginBottom: 8,
    paddingHorizontal: 0,
    width: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    padding: 20,
    maxWidth: '90%',
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
      },
      android: {
        elevation: 1,
      },
      web: {},
    }),
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 14,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#4B5563',
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255,140,66,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FF8C42',
  },
  statusBadgeConfirmed: {
    backgroundColor: 'rgba(22,163,74,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeTextConfirmed: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  vendorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 18,
    gap: 10,
  },
  vendorAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  vendorAvatarText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  vendorNameText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4B5563',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 2,
  },
  detailValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  detailValue: {
    fontSize: 15,
    color: '#2B2B2B',
    fontWeight: '500' as const,
    flex: 1,
  },
  amountRow: {
    gap: 2,
  },
  vendorStatusRow: {
    marginTop: 10,
  },
  amountValue: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    letterSpacing: -0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  bankSection: {
    gap: 10,
  },
  bankSectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    marginBottom: 4,
  },
  bankRow: {
    gap: 2,
  },
  bankLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  bankLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4B5563',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  bankValue: {
    fontSize: 15,
    color: '#2B2B2B',
    fontWeight: '500' as const,
  },
  copyBtn: {
    padding: 4,
  },
  copiedFeedback: {
    fontSize: 11,
    color: '#16A34A',
    marginTop: 2,
  },
  messageSection: {
    marginTop: 14,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#4B5563',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#2B2B2B',
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  timestamp: {
    fontSize: 11,
    color: '#4B5563',
    marginTop: 14,
    textAlign: 'right' as const,
  },
  productCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    overflow: 'hidden' as const,
    maxWidth: '90%',
    width: '100%',
    marginTop: 8,
  },
  productContent: {
    flexDirection: 'row' as const,
    padding: 12,
    gap: 12,
    alignItems: 'center' as const,
  },
  productImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  productImage: {
    width: 64,
    height: 64,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: '#F8F9FA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
  },
  productImagePlaceholderIcon: {
    fontSize: 28,
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FF8C42',
  },
  viewButton: {
    backgroundColor: '#FF8C42',
    paddingVertical: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    height: 40,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  paymentInstructionsLabel: {
    fontSize: 12,
    color: '#4B5563',
    marginBottom: 8,
  },
  nonEscrowDisclaimer: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 14,
    lineHeight: 18,
  },
  statusMessage: {
    fontSize: 13,
    color: '#4B5563',
    textAlign: 'center' as const,
    marginTop: 10,
  },
});
