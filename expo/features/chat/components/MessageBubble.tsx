import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { User, Copy } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { ChatMessage, ContactCardData, ReplyToData } from '@/mocks/chatData';
import { OrderContextBlock } from './OrderContextBlock';
import { PaymentRequestCard } from '@/components/PaymentRequestCard';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { formatTime } from '@/features/chat/selectors/chatSelectors';
import * as Clipboard from 'expo-clipboard';
import { InvoiceChatCard } from './InvoiceChatCard';

const OUTGOING_COLOR = '#F07D3C';
const INCOMING_COLOR = '#F2F2F7';
const OUTGOING_TEXT = '#FFFFFF';
const INCOMING_TEXT = '#1C1C1E';

type GroupInfo = {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

type Props = {
  message: ChatMessage;
  groupInfo?: GroupInfo;
  orderId: string;
  publicOrderId?: string;
  isCompleted: boolean;
  orderStatus: string;
  onShowCopyToast?: () => void;
  onViewContactDetails: (data: ContactCardData) => void;
  transformSystemMessage: (content: string) => string | null;
  onSwipeToReply?: (message: ChatMessage) => void;
};

const REPLY_ACCENT_OUTGOING = 'rgba(255,255,255,0.5)';
const REPLY_ACCENT_INCOMING = '#FF8C42';
const REPLY_BG_OUTGOING = 'rgba(255,255,255,0.15)';
const REPLY_BG_INCOMING = 'rgba(255,140,66,0.08)';

function getBubbleRadius(isOutgoing: boolean, isFirstInGroup: boolean, isLastInGroup: boolean) {
  const base = 18;
  const tight = 6;
  const tailCorner = 4;

  if (isOutgoing) {
    return {
      borderTopLeftRadius: base,
      borderTopRightRadius: isFirstInGroup ? base : tight,
      borderBottomLeftRadius: base,
      borderBottomRightRadius: isLastInGroup ? tailCorner : tight,
    };
  } else {
    return {
      borderTopLeftRadius: isFirstInGroup ? base : tight,
      borderTopRightRadius: base,
      borderBottomLeftRadius: isLastInGroup ? tailCorner : tight,
      borderBottomRightRadius: base,
    };
  }
}

const ReplyPreview = React.memo(function ReplyPreview({ replyTo, isOutgoing }: { replyTo: ReplyToData; isOutgoing: boolean }) {
  const senderLabel = replyTo.sender === 'vendor' ? 'Vendor' : replyTo.sender === 'customer' ? 'You' : 'System';
  const accentColor = isOutgoing ? REPLY_ACCENT_OUTGOING : REPLY_ACCENT_INCOMING;
  const bgColor = isOutgoing ? REPLY_BG_OUTGOING : REPLY_BG_INCOMING;
  const textColor = isOutgoing ? 'rgba(255,255,255,0.85)' : '#6B7280';
  const senderColor = isOutgoing ? '#FFFFFF' : '#FF8C42';

  return (
    <View style={[replyStyles.container, { backgroundColor: bgColor, borderLeftColor: accentColor }]}>
      <Text style={[replyStyles.sender, { color: senderColor }]} numberOfLines={1}>{senderLabel}</Text>
      <Text style={[replyStyles.content, { color: textColor }]} numberOfLines={1}>{replyTo.content || 'Message'}</Text>
    </View>
  );
});

export const MessageBubble = React.memo(function MessageBubble({
  message,
  groupInfo = { isFirstInGroup: true, isLastInGroup: true },
  orderId,
  publicOrderId,
  isCompleted,
  orderStatus,
  onShowCopyToast,
  onViewContactDetails,
  transformSystemMessage,
}: Props) {
  const { isFirstInGroup, isLastInGroup } = groupInfo;

  if (message.type === 'system') {
    const displayContent = transformSystemMessage(message.content);
    if (displayContent === null) return null;
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessageBubble}>
          <Text style={styles.systemMessageText}>{displayContent}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'catalog_item' && message.catalogItemData) {
    const item = message.catalogItemData;
    const isOutgoing = message.sender === 'vendor';
    const displayPrice = (item.price || 0).toFixed(2);

    return (
      <View style={[styles.cardWrapper, isOutgoing ? styles.cardWrapperRight : styles.cardWrapperLeft]}>
        <View style={styles.catalogItemCard}>
          <Text style={styles.catalogItemCardLabel}>
            {isOutgoing ? 'Catalog item shared' : 'Item shared by vendor'}
          </Text>
          <View style={styles.catalogItemCardContent}>
            <View style={styles.catalogItemCardImageContainer}>
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={styles.catalogItemCardImage}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.catalogItemCardImagePlaceholder} />
              )}
            </View>
            <View style={styles.catalogItemCardInfo}>
              <Text style={styles.catalogItemCardName}>{item.name}</Text>
              {!isOutgoing && item.description && (
                <Text style={styles.catalogItemCardDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <Text style={styles.catalogItemCardPrice}>
                {formatPriceWithCommas(Number(displayPrice) || 0, (mockVendor.currency as Currency) || 'NGN')}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.catalogItemCardButton}
            onPress={() => {
              if (item.id) {
                router.push(`/vendor/catalog/item/${item.id}` as any);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.catalogItemCardButtonText}>View item</Text>
          </TouchableOpacity>
          <Text style={styles.catalogItemCardTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'payment-request' && message.paymentRequestData) {
    const vendorDisplayName = mockVendor.name || 'Vendor';
    const orderIdDisplay = publicOrderId || orderId;
    return (
      <View style={styles.paymentRequestWrapper}>
        <PaymentRequestCard
          vendorName={vendorDisplayName}
          orderId={orderIdDisplay}
          paymentData={message.paymentRequestData}
          timestamp={message.timestamp}
          role="vendor"
          onViewOrderDetails={() => router.push(`/vendor/orders/${orderId}` as any)}
        />
      </View>
    );
  }

  if (message.type === 'invoice' && message.invoiceData) {
    return (
      <View style={styles.invoiceCardWrapper}>
        <InvoiceChatCard
          data={message.invoiceData}
          timestamp={message.timestamp}
          role="vendor"
        />
      </View>
    );
  }

  if (message.type === 'receipt' && message.receiptData) {
    const data = message.receiptData;
    const orderIdDisplay = publicOrderId ? publicOrderId.toUpperCase() : orderId.toUpperCase();
    const receiptIdDisplay = data.receiptId.toUpperCase();

    const handleCopyReceiptId = async () => {
      await Clipboard.setStringAsync(data.receiptId);
      onShowCopyToast?.();
    };

    const handleCopyOrderId = async () => {
      await Clipboard.setStringAsync(publicOrderId || orderId);
      onShowCopyToast?.();
    };

    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.documentCard}>
          <Text style={styles.documentCardHeader}>🧾 Receipt issued</Text>
          <View style={styles.documentInfoSection}>
            <View style={styles.documentInfoRow}>
              <Text style={styles.documentInfoLabel}>Receipt ID</Text>
              <TouchableOpacity onPress={handleCopyReceiptId} style={styles.copyButton} activeOpacity={0.7}>
                <Copy size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.documentInfoValue}>{receiptIdDisplay}</Text>

          </View>
          <View style={styles.documentInfoSection}>
            <View style={styles.documentInfoRow}>
              <Text style={styles.documentInfoLabel}>Order</Text>
              <TouchableOpacity onPress={handleCopyOrderId} style={styles.copyButton} activeOpacity={0.7}>
                <Copy size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.documentInfoValue}>{orderIdDisplay}</Text>

          </View>
          <View style={styles.documentInfoSection}>
            <Text style={styles.documentInfoLabel}>Amount paid</Text>
            <Text style={styles.documentInfoValue}>
              {formatPriceWithCommas(data.amountPaid, (mockVendor.currency as Currency) || 'NGN')}
            </Text>
          </View>
          <Text style={styles.documentTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'contact-card' && message.contactCardData) {
    const isOrderActive =
      orderStatus === 'requested' ||
      orderStatus === 'accepted' ||
      orderStatus === 'confirmed' ||
      orderStatus === 'in_progress';
    const isOrderCompleted = isCompleted || orderStatus === 'cancelled';

    if (isOrderCompleted) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.expiredContactCard}>
            <Text style={styles.expiredContactText}>
              Customer contact details expired after order completion.
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.contactCardContainer}>
          <View style={styles.contactCardHeader}>
            <User size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
            <Text style={styles.contactCardHeaderText}>Contact details shared</Text>
          </View>
          <View>
            <Text style={styles.contactCardDescription}>
              Customer has shared their contact details for this order.
            </Text>
            {isOrderActive && (
              <TouchableOpacity
                style={styles.viewContactButton}
                onPress={() => onViewContactDetails(message.contactCardData!)}
                activeOpacity={0.7}
              >
                <Text style={styles.viewContactButtonText}>View contact details</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.contactCardTime}>{formatTime(message.timestamp)}</Text>
        </View>
      </View>
    );
  }

  if (message.type === 'new_inquiry') {
    return (
      <View style={styles.newInquiryContainer}>
        <View style={styles.newInquiryDividerRow}>
          <View style={styles.newInquiryDividerLine} />
          <Text style={styles.newInquiryLabel}>New Inquiry</Text>
          <View style={styles.newInquiryDividerLine} />
        </View>
        <Text style={styles.newInquiryTimestamp}>{formatTime(message.timestamp)}</Text>
      </View>
    );
  }

  if (message.type === 'order_context' && message.orderContextData) {
    return (
      <OrderContextBlock
        orderContextData={message.orderContextData}
        timestamp={message.timestamp}
        role="vendor"
      />
    );
  }

  const isOutgoing = message.sender === 'vendor';
  const radiusStyle = getBubbleRadius(isOutgoing, isFirstInGroup, isLastInGroup);

  return (
    <View
      style={[
        styles.messageBubbleContainer,
        isOutgoing ? styles.outgoingContainer : styles.incomingContainer,
        !isLastInGroup && styles.compact,
      ]}
    >
      <View style={styles.bubbleWithTail}>
        <View
          style={[
            styles.bubble,
            isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            radiusStyle,
          ]}
        >
          {message.replyTo && (
            <ReplyPreview replyTo={message.replyTo} isOutgoing={isOutgoing} />
          )}
          <Text style={[styles.messageText, isOutgoing ? styles.outgoingMessageText : styles.incomingMessageText]}>
            {message.content}
          </Text>
          {isLastInGroup && (
            <Text style={[styles.messageTime, isOutgoing ? styles.outgoingMessageTime : styles.incomingMessageTime]}>
              {formatTime(message.timestamp)}
            </Text>
          )}
        </View>
        {isLastInGroup && isOutgoing && <View style={styles.tailOutgoing} />}
        {isLastInGroup && !isOutgoing && <View style={styles.tailIncoming} />}
      </View>
    </View>
  );
});

MessageBubble.displayName = 'MessageBubble';

const replyStyles = StyleSheet.create({
  container: {
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 4,
  },
  sender: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 1,
  },
  content: {
    fontSize: 13,
    lineHeight: 17,
  },
});

const styles = StyleSheet.create({
  messageBubbleContainer: {
    marginBottom: 2,
    paddingHorizontal: 10,
  },
  compact: {
    marginBottom: 1,
  },
  outgoingContainer: {
    alignItems: 'flex-end',
  },
  incomingContainer: {
    alignItems: 'flex-start',
  },
  bubbleWithTail: {
    position: 'relative' as const,
  },
  tailOutgoing: {
    position: 'absolute' as const,
    bottom: 0,
    right: -5,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: OUTGOING_COLOR,
    borderLeftWidth: 6,
    borderLeftColor: 'transparent' as const,
  },
  tailIncoming: {
    position: 'absolute' as const,
    bottom: 0,
    left: -5,
    width: 0,
    height: 0,
    borderTopWidth: 8,
    borderTopColor: INCOMING_COLOR,
    borderRightWidth: 6,
    borderRightColor: 'transparent' as const,
  },
  bubble: {
    maxWidth: '76%',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  outgoingBubble: {
    backgroundColor: OUTGOING_COLOR,
  },
  incomingBubble: {
    backgroundColor: INCOMING_COLOR,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 19.5,
    fontWeight: '400',
  },
  outgoingMessageText: {
    color: OUTGOING_TEXT,
  },
  incomingMessageText: {
    color: INCOMING_TEXT,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 1.5,
    alignSelf: 'flex-end',
  },
  outgoingMessageTime: {
    color: 'rgba(255,255,255,0.65)',
  },
  incomingMessageTime: {
    color: '#8E8E93',
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 11,
    paddingVertical: 3.5,
    borderRadius: 14,
  },
  systemMessageText: {
    fontSize: 11.5,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 15,
    fontWeight: '500',
  },
  cardWrapper: {
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  cardWrapperRight: {
    alignItems: 'flex-end',
  },
  cardWrapperLeft: {
    alignItems: 'flex-start',
  },
  paymentRequestWrapper: {
    alignItems: 'center',
    marginBottom: 4,
    width: '100%',
  },
  documentCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: '90%',
    width: '100%',
  },
  documentCardHeader: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
  },
  documentInfoSection: {
    marginBottom: 10,
  },
  documentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  documentInfoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  documentInfoValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500',
  },
  copyButton: {
    padding: 4,
  },
  copiedFeedback: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 4,
  },
  documentTimestamp: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'right',
  },
  sendDocumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OUTGOING_COLOR,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  sendDocumentButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  contactCardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: '90%',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactCardHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  contactCardTime: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 6,
    textAlign: 'right',
  },
  contactCardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  viewContactButton: {
    backgroundColor: OUTGOING_COLOR,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewContactButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  expiredContactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  expiredContactText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  catalogItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 10,
    maxWidth: 280,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catalogItemCardLabel: {
    fontSize: 11,
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontWeight: '500',
  },
  catalogItemCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  catalogItemCardImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden',
  },
  catalogItemCardImage: {
    width: 52,
    height: 52,
  },
  catalogItemCardImagePlaceholder: {
    width: 52,
    height: 52,
    backgroundColor: Colors.border,
    borderRadius: 8,
  },
  catalogItemCardInfo: {
    flex: 1,
  },
  catalogItemCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  catalogItemCardDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  catalogItemCardPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  catalogItemCardButton: {
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: 4,
  },
  catalogItemCardButtonText: {
    fontSize: 14,
    color: OUTGOING_COLOR,
    fontWeight: '600',
  },
  catalogItemCardTimestamp: {
    fontSize: 10,
    color: '#8E8E93',
    textAlign: 'right',
  },
  newInquiryContainer: {
    alignItems: 'center' as const,
    marginVertical: 8,
    paddingHorizontal: 4,
  },
  newInquiryDividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%' as const,
    gap: 10,
  },
  newInquiryDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.2)',
  },
  newInquiryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#3B82F6',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  newInquiryTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  invoiceCardWrapper: {
    alignItems: 'center' as const,
    marginVertical: 4,
    paddingHorizontal: 12,
    width: '100%',
  },
});
