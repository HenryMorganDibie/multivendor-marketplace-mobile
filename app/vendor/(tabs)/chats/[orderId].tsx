import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Send, Plus, FileText, User, X, Award, Phone, MoreVertical } from 'lucide-react-native';
import MessageStatusIcon from '@/components/MessageStatusIcon';
import { ChatActionMenu, ChatActionItem } from '@/components/ChatActionMenu';
import * as ScreenCapture from 'expo-screen-capture';
import { Colors } from '@/constants/colors';
import { getChatByOrderId, ChatMessage, ContactCardData } from '@/mocks/chatData';
import OrderChangesCard from '@/components/OrderChangesCard';
import SecureContactModal from '@/components/SecureContactModal';
import { mockOrders } from '@/mocks/ordersData';
import { mockVendors } from '@/mocks/vendorData';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useVendorCustomerNotes } from '@/contexts/VendorCustomerNotesContext';
import { chatService } from '@/services/chatService';
import { useChatSubscription } from '@/hooks/useChatMessages';
import { getPaymentStateConfig, getPaymentStateShortLabel } from '@/constants/paymentStates';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import {
  CHAT_INPUT_PLACEHOLDERS,
  CHAT_BANNERS,
  getAvatarInitials,
  CHAT_FALLBACKS,
} from '@/constants/chatStrings';

const formatVendorDisplayName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}`;
};

export default function VendorOrderChatScreen() {
  const { orderId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messageText, setMessageText] = useState('');
  const [showSecureContactModal, setShowSecureContactModal] = useState(false);
  const [secureContactData, setSecureContactData] = useState<ContactCardData | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [customerNoteText, setCustomerNoteText] = useState('');
  const { blockUser, getBlockedUserByChatId } = useBlockedUsers();
  const { getNote, saveNote } = useVendorCustomerNotes();

  const order = mockOrders.find(o => o.id === orderId);
  const isPending = order?.status === 'pending';
  const isCompleted = order?.status === 'completed';
  const isDeclined = order?.status === 'declined';

  const chat = getChatByOrderId(orderId as string);
  const chatId = chat?.id ?? '';
  // Step 5: subscribe to chatService writes so vendor-side sends and any
  // background updates re-render this screen immediately. `chat.messages`
  // is mutated in place by chatService, so we only need a tick to refresh.
  useChatSubscription(chatId || undefined);
  const blockedUser = chatId ? getBlockedUserByChatId(chatId) : undefined;
  const isBlocked = !!blockedUser;
  const customerId = order?.customerId || chat?.customerId || `customer-${orderId}`;
  const vendorId = order?.vendorId || chat?.vendorId || '';
  const orderVendor = mockVendors.find(v => v.id === vendorId);
  const orderCurrency: Currency =
    (orderVendor?.currency as Currency) ||
    getCurrencyFromCountryCode(orderVendor?.countryCode || 'NG');

  useEffect(() => {
    if (chat?.messages) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [chat?.messages]);

  useEffect(() => {
    if (showCustomerProfile && order) {
      const note = getNote(vendorId, customerId);
      setCustomerNoteText(note);
    }
  }, [showCustomerProfile, vendorId, customerId, order, getNote]);

  if (!chat || !order) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ArrowLeft size={24} color="#000" strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.errorText}>Order not found</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const customerDisplayName = formatVendorDisplayName(order.customerName);

  const handleSendMessage = () => {
    const content = messageText.trim();
    if (!content) return;
    chatService
      .sendMessage({
        chatId,
        type: 'text',
        content,
        sender: 'vendor',
      })
      .then((msg) => {
        console.log('[VENDOR LEGACY CHAT] Message persisted via chatService:', msg.id);
      })
      .catch((err) => {
        console.log('[VENDOR LEGACY CHAT] sendMessage failed:', err);
      });
    setMessageText('');
  };

  const handlePlusButtonPress = () => {
    setShowActionsMenu(true);
  };

  const handleCreateCustomOrder = () => {
    console.log('Create custom order tapped');
    setShowActionsMenu(false);
    const newCustomOrderId = `custom-${Date.now()}`;
    console.log('Creating new custom order:', newCustomOrderId, 'for customer:', order?.customerName);
    router.push(`/vendor/custom-order/${newCustomOrderId}?customerName=${encodeURIComponent(order?.customerName || '')}` as any);
  };

  const handleSendPaymentRequest = () => {
    console.log('Send payment request tapped');
    setShowActionsMenu(false);
    router.push(`/vendor/send-payment-request/${orderId}` as any);
  };

  const handleQuickReply = () => {
    console.log('Quick reply tapped');
    setShowActionsMenu(false);
  };

  const handleBlockCustomer = () => {
    setShowOptionsMenu(false);
    
    if (!isCompleted && !isDeclined && order?.status !== 'cancelled') {
      Alert.alert(
        'Cannot block customer',
        'You can only block customers after the order is completed or cancelled.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Block customer',
      'This will archive the chat and prevent further messages. Order history will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            blockUser({
              id: customerId,
              name: order?.customerName || CHAT_FALLBACKS.customer,
              role: 'customer',
              chatId: chatId,
              blockedAt: new Date().toISOString(),
            });
            console.log('Customer blocked');
          },
        },
      ]
    );
  };

  const handleViewOrderDetails = () => {
    router.push(`/vendor/orders/${orderId}?fromChat=true` as any);
  };

  const handleOpenCustomerProfile = () => {
    setShowCustomerProfile(true);
  };

  const handleSaveNote = () => {
    if (order) {
      saveNote(vendorId, customerId, customerNoteText);
      console.log('Note saved for customer');
    }
  };

  const getCustomerOrderHistory = () => {
    if (!order) return [];
    return mockOrders.filter(
      (o) => o.customerName === order.customerName && o.vendorId === vendorId
    );
  };

  const getFirstCompletedOrderDate = () => {
    const completedOrders = getCustomerOrderHistory()
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    return completedOrders[0]?.orderDate || null;
  };

  const getCompletedOrdersCount = () => {
    return getCustomerOrderHistory().filter((o) => o.status === 'completed').length;
  };

  const getLastOrderDate = () => {
    const sortedOrders = getCustomerOrderHistory()
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    return sortedOrders[0]?.orderDate || null;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatOrderStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending';
      case 'accepted': return 'Accepted';
      case 'in_progress': return 'In Progress';
      case 'ready': return 'Ready';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      case 'declined': return 'Declined';
      default: return status;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderOrderSummaryCard = () => {
    if (!order) return null;

    const totalItemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const fulfillmentType = order.fulfillmentType || 'Pickup';
    const paymentStateConfig = order.paymentState ? getPaymentStateConfig(order.paymentState) : null;
    const paymentLabel = order.paymentState
      ? getPaymentStateShortLabel(order.paymentState)
      : (paymentStateConfig?.label ?? '—');

    return (
      <View style={styles.stickyOrderSummaryContainer}>
        <TouchableOpacity 
          style={styles.compactOrderSummary}
          onPress={handleViewOrderDetails}
          activeOpacity={0.7}
        >
          <Text style={styles.compactOrderLine}>🛒 {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} · {fulfillmentType}</Text>
          {order.scheduledDate && order.scheduledTime && (
            <Text style={styles.compactOrderLine}>📅 {order.scheduledDate} · {order.scheduledTime}</Text>
          )}
          <Text style={styles.compactOrderLine}>💰 Total: {formatPriceWithCommas(order.total / 100, orderCurrency)}</Text>
          <Text style={styles.compactOrderLine}>💳 Payment: {paymentLabel}</Text>
          <Text style={styles.compactOrderViewDetails}>View order details →</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'system') {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{message.content}</Text>
        </View>
      );
    }

    if (message.type === 'payment-request' && message.paymentRequestData) {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.paymentRequestBubble}>
            <Text style={styles.paymentRequestTitle}>💳 Payment request sent</Text>
            <Text style={styles.paymentRequestAmount}>
              Amount: {formatPriceWithCommas(message.paymentRequestData.amount, orderCurrency)}
            </Text>
            <Text style={styles.paymentRequestMethod}>
              Method: {message.paymentRequestData.paymentMethod}
            </Text>
          </View>
        </View>
      );
    }

    if (message.type === 'contact-card' && message.contactCardData) {
      const isOrderActive = order?.status === 'pending' || order?.status === 'accepted' || order?.status === 'in_progress';
      const isOrderCompleted = isCompleted || isDeclined || order?.status === 'cancelled';

      const handleViewContactDetails = () => {
        if (isOrderActive) {
          setSecureContactData(message.contactCardData!);
          setShowSecureContactModal(true);
        }
      };

      if (isOrderCompleted) {
        return (
          <View key={message.id} style={styles.systemMessageContainer}>
            <View style={styles.expiredContactCard}>
              <Text style={styles.expiredContactText}>
                Customer contact details expired after order completion.
              </Text>
            </View>
          </View>
        );
      }

      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.contactCardContainer}>
            <View style={styles.contactCardHeader}>
              <User size={16} color="#666" style={{ marginRight: 6 }} />
              <Text style={styles.contactCardHeaderText}>
                Contact details shared
              </Text>
            </View>
            <View style={styles.contactCardContent}>
              <Text style={styles.contactCardDescription}>
                Customer has shared their contact details for this order.
              </Text>
              {isOrderActive && (
                <TouchableOpacity
                  style={styles.viewContactButton}
                  onPress={handleViewContactDetails}
                  activeOpacity={0.7}
                >
                  <Text style={styles.viewContactButtonText}>View contact details</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.contactCardTime}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
        </View>
      );
    }

    if (message.type === 'change_request' && message.changeRequestData) {
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <OrderChangesCard
            changeRequest={message.changeRequestData}
            currency="NGN"
            isVendorView={true}
          />
          <Text style={styles.contactCardTime}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    const isOutgoing = message.sender === 'vendor';
    const customerInitial = (order?.customerName || 'C').trim().charAt(0).toUpperCase();
    const messageStatus = (message.status as any) || (isOutgoing ? 'read' : undefined);

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubbleContainer,
          isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
        ]}
      >
        <View style={styles.bubbleWithTail}>
          {!isOutgoing && (
            <View style={styles.incomingAvatarSlot}>
              <View style={styles.incomingAvatar}>
                <Text style={styles.incomingAvatarText}>{customerInitial}</Text>
              </View>
            </View>
          )}
          {!isOutgoing && <View style={styles.bubbleTailIncoming} />}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {message.content}
            </Text>
            <View style={styles.messageMeta}>
              <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
                {formatTime(message.timestamp)}
              </Text>
              {isOutgoing && messageStatus && (
                <MessageStatusIcon status={messageStatus} outgoingBubble />
              )}
            </View>
          </View>
          {isOutgoing && <View style={styles.bubbleTailOutgoing} />}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color="#000" strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenCustomerProfile}>
            <View style={styles.avatarCircleHeader}>
              <Text style={styles.avatarTextHeader}>{customerDisplayName.charAt(0).toUpperCase()}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerContent} onPress={handleOpenCustomerProfile}>
            <Text style={styles.headerCustomerName}>{customerDisplayName}</Text>
            <Text style={styles.headerOrderId}>{chat.publicOrderId}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowOptionsMenu(true)}
            style={styles.ellipsisButton}
            testID="chat-header-ellipsis"
            accessibilityLabel="More chat options"
          >
            <MoreVertical size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {renderOrderSummaryCard()}

      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedText}>{CHAT_BANNERS.blockedSelf}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {chat.messages.map(message => renderMessage(message))}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          {isPending ? (
            <View style={styles.pendingInfoContainer}>
              <Text style={styles.pendingInfoText}>{CHAT_BANNERS.pendingOrderReadOnly}</Text>
            </View>
          ) : isCompleted ? (
            <View style={styles.completedInfoContainer}>
              <Text style={styles.completedInfoText}>{CHAT_BANNERS.completedOrderReadOnly}</Text>
            </View>
          ) : isDeclined ? (
            <View style={styles.declinedInfoContainer}>
              <Text style={styles.declinedInfoText}>{CHAT_BANNERS.declinedOrderReadOnly}</Text>
            </View>
          ) : isBlocked ? (
            <View style={styles.blockedInfoContainer}>
              <Text style={styles.blockedInfoText}>{CHAT_INPUT_PLACEHOLDERS.unblockToSend}</Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.actionsButton}
                onPress={handlePlusButtonPress}
                activeOpacity={0.7}
              >
                <Plus size={24} color="#000" />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder={CHAT_INPUT_PLACEHOLDERS.default}
                placeholderTextColor="#999"
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  messageText.trim() === '' && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={messageText.trim() === ''}
                activeOpacity={0.7}
              >
                <Send
                  size={20}
                  color={'#FFFFFF'}
                />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal
        visible={showActionsMenu}
        animationType="fade"
        transparent
        onRequestClose={() => setShowActionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.actionsMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsMenu(false)}
        >
          <View style={styles.actionsMenuContainer}>
            <TouchableOpacity
              style={styles.actionsMenuItem}
              onPress={handleSendPaymentRequest}
              activeOpacity={0.7}
            >
              <FileText size={20} color="#000" style={{ marginRight: 12 }} />
              <Text style={styles.actionsMenuItemText}>Send payment request</Text>
            </TouchableOpacity>
            <View style={styles.actionsMenuDivider} />
            <TouchableOpacity
              style={styles.actionsMenuItem}
              onPress={handleCreateCustomOrder}
              activeOpacity={0.7}
            >
              <FileText size={20} color="#000" style={{ marginRight: 12 }} />
              <Text style={styles.actionsMenuItemText}>Create custom order</Text>
            </TouchableOpacity>
            <View style={styles.actionsMenuDivider} />
            <TouchableOpacity
              style={styles.actionsMenuItem}
              onPress={handleQuickReply}
              activeOpacity={0.7}
            >
              <FileText size={20} color="#000" style={{ marginRight: 12 }} />
              <Text style={styles.actionsMenuItemText}>Quick reply</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <ChatActionMenu
        visible={showOptionsMenu}
        onClose={() => setShowOptionsMenu(false)}
        actions={((): ChatActionItem[] => [
          {
            id: 'view-customer',
            label: 'View customer profile',
            onPress: handleOpenCustomerProfile,
          },
          {
            id: 'search-chat',
            label: 'Search in chat',
            onPress: () => console.log('[LEGACY VENDOR CHAT] Search in chat'),
          },
          {
            id: 'help',
            label: 'Help & safety',
            onPress: () => router.push('/help-center' as any),
          },
          {
            id: 'report',
            label: 'Report customer',
            destructive: true,
            requireConfirm: {
              title: 'Report customer',
              message: 'Send a report about this customer to the platform support?',
              confirmLabel: 'Report',
            },
            onPress: () => console.log('[LEGACY VENDOR CHAT] Report customer'),
          },
          {
            id: 'block',
            label: 'Block customer',
            destructive: true,
            onPress: handleBlockCustomer,
          },
          {
            id: 'clear',
            label: 'Clear chat',
            destructive: true,
            requireConfirm: {
              title: 'Clear chat',
              message: 'Clear all messages from this conversation? This cannot be undone.',
              confirmLabel: 'Clear',
            },
            onPress: () => console.log('[LEGACY VENDOR CHAT] Clear chat'),
          },
        ])()}
      />

      <Modal
        visible={showCustomerProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomerProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.profileHeader}>
            <Text style={styles.profileTitle}>Customer Profile</Text>
            <TouchableOpacity
              onPress={() => setShowCustomerProfile(false)}
              style={styles.profileCloseButton}
            >
              <X size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.profileContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileAvatarSection}>
              <View style={styles.profileAvatarLarge}>
                <Text style={styles.profileAvatarLargeText}>
                  {customerDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.profileCustomerName}>{customerDisplayName}</Text>
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Relationship Overview</Text>
              {getFirstCompletedOrderDate() && (
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Customer since</Text>
                  <Text style={styles.profileValue}>{formatDate(getFirstCompletedOrderDate()!)}</Text>
                </View>
              )}
              <View style={styles.profileRow}>
                <Text style={styles.profileLabel}>Total orders</Text>
                <Text style={styles.profileValue}>{getCompletedOrdersCount()} completed</Text>
              </View>
              {getCompletedOrdersCount() >= 2 && (
                <View style={styles.repeatBadge}>
                  <Award size={16} color="#34C759" />
                  <Text style={styles.repeatBadgeText}>Repeat Customer</Text>
                </View>
              )}
              {getLastOrderDate() && (
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Last order</Text>
                  <Text style={styles.profileValue}>{formatDate(getLastOrderDate()!)}</Text>
                </View>
              )}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Vendor Notes</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Add notes about this customer..."
                placeholderTextColor="#999"
                value={customerNoteText}
                onChangeText={setCustomerNoteText}
                multiline
                maxLength={500}
                onBlur={handleSaveNote}
              />
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Order History</Text>
              {getCustomerOrderHistory().length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : (
                getCustomerOrderHistory().map((historyOrder) => (
                  <TouchableOpacity
                    key={historyOrder.id}
                    style={styles.orderHistoryItem}
                    onPress={() => {
                      setShowCustomerProfile(false);
                      router.push(`/vendor/orders/${historyOrder.id}` as any);
                    }}
                  >
                    <View style={styles.orderHistoryLeft}>
                      <Text style={styles.orderHistoryId}>{historyOrder.publicOrderId}</Text>
                      <Text style={styles.orderHistoryDate}>{formatDate(historyOrder.orderDate)}</Text>
                    </View>
                    <View style={styles.orderHistoryRight}>
                      <Text style={styles.orderHistoryAmount}>
                        {formatPriceWithCommas(historyOrder.total / 100, orderCurrency)}
                      </Text>
                      <Text style={[
                        styles.orderHistoryStatus,
                        historyOrder.status === 'completed' && styles.orderHistoryStatusCompleted,
                        historyOrder.status === 'cancelled' && styles.orderHistoryStatusCancelled,
                        historyOrder.status === 'pending' && styles.orderHistoryStatusPending,
                      ]}>
                        {formatOrderStatus(historyOrder.status)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Safety Actions</Text>
              <TouchableOpacity
                style={styles.blockButton}
                onPress={() => {
                  setShowCustomerProfile(false);
                  handleBlockCustomer();
                }}
              >
                <Text style={styles.blockButtonText}>Block customer</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <SecureContactModal
        visible={showSecureContactModal}
        onClose={() => {
          setShowSecureContactModal(false);
          setSecureContactData(null);
        }}
        contactData={secureContactData}
      />
    </View>
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
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
  },
  ellipsisButton: {
    padding: 8,
    flexShrink: 0,
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
  },
  headerCustomerName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  headerOrderId: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  keyboardAvoid: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  messagesContent: {
    paddingTop: 10,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  bubbleWithTail: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  incomingAvatarSlot: {
    width: 26,
    marginRight: 6,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#22C55E',
  },
  incomingAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bubbleTailOutgoing: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderTopColor: Colors.primary,
    borderRightWidth: 9,
    borderRightColor: 'transparent' as const,
    marginBottom: 2,
    marginLeft: -2,
  },
  bubbleTailIncoming: {
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderTopColor: '#E9E9EB',
    borderLeftWidth: 9,
    borderLeftColor: 'transparent' as const,
    marginBottom: 2,
    marginRight: -2,
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
  },
  avatarCircleHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  avatarTextHeader: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  messageMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    alignSelf: 'flex-end' as const,
    gap: 3,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 18,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#E9E9EB',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(0, 0, 0, 0.4)',
  },
  outgoingMessageTime: {
    color: 'rgba(255, 255, 255, 0.72)',
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginVertical: 8,
    paddingHorizontal: 32,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  paymentRequestBubble: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#FFE4A3',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: '80%',
  },
  paymentRequestTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  paymentRequestAmount: {
    fontSize: 15,
    color: '#000',
    marginBottom: 4,
  },
  paymentRequestMethod: {
    fontSize: 15,
    color: '#000',
  },
  contactCardContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: '90%',
    width: '100%',
  },
  contactCardMuted: {
    backgroundColor: '#f8f8f8',
    opacity: 0.8,
  },
  contactCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  contactCardHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
  },
  contactCardHeaderMuted: {
    color: '#999',
  },
  contactCardContent: {},
  contactCardLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#999',
    marginTop: 12,
    marginBottom: 4,
  },
  contactCardLabelMuted: {
    color: '#aaa',
  },
  contactCardValue: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },
  contactCardValueFlex: {
    flex: 1,
  },
  contactCardValueMuted: {
    color: '#666',
  },
  contactCardValueMultiline: {
    fontSize: 15,
    color: '#000',
    lineHeight: 22,
  },
  contactCardPhoneRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  contactCardActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  contactCardActionButton: {
    padding: 6,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  copiedText: {
    fontSize: 12,
    color: '#34C759',
    marginTop: 4,
  },
  contactCardFooter: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  contactCardFooterText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  contactCardTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'right' as const,
  },
  contactCardDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  viewContactButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  viewContactButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  expiredContactCard: {
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: '90%',
  },
  expiredContactText: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  secureModalContainer: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  secureModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  secureModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
  },
  secureModalCloseButton: {
    padding: 8,
  },
  secureModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  secureWarningBanner: {
    backgroundColor: '#2C2C2E',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  secureWarningText: {
    fontSize: 13,
    color: '#FFD60A',
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  secureContactSection: {
    marginBottom: 24,
  },
  secureContactLabel: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  secureContactValue: {
    fontSize: 17,
    color: '#fff',
    lineHeight: 24,
  },
  secureContactValueMultiline: {
    lineHeight: 26,
  },
  callButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  securePrivacyNotice: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3A3C',
  },
  securePrivacyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFD60A',
    marginBottom: 8,
  },
  securePrivacyDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 20,
  },
  stickyOrderSummaryContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  compactOrderSummary: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  compactOrderLine: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 3,
  },
  compactOrderViewDetails: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  inputSafeArea: {
    backgroundColor: Colors.surface,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  actionsButton: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
  },
  pendingInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.warningLight,
    borderTopWidth: 1,
    borderTopColor: Colors.warningBorder,
  },
  pendingInfoText: {
    fontSize: 13,
    color: Colors.warning,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  completedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completedInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  declinedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.errorLight,
    borderTopWidth: 1,
    borderTopColor: Colors.errorBorder,
  },
  declinedInfoText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  blockedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.errorLight,
    borderTopWidth: 1,
    borderTopColor: Colors.errorBorder,
  },
  blockedInfoText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  destructiveText: {
    color: '#FF3B30',
  },
  blockedBanner: {
    backgroundColor: '#FFF3F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  blockedText: {
    fontSize: 13,
    color: '#CC0000',
    textAlign: 'center' as const,
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
    paddingBottom: 100,
  },
  actionsMenuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  actionsMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  actionsMenuItemText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
  },
  actionsMenuDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  modalCloseButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  contactInfoSection: {
    marginBottom: 24,
  },
  contactLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  contactValue: {
    fontSize: 16,
    color: '#000',
  },
  privacyNotice: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
  },
  privacyNoticeText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    textAlign: 'center' as const,
  },
  profileHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  profileCloseButton: {
    padding: 8,
  },
  profileContent: {
    flex: 1,
  },
  profileAvatarSection: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileAvatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E0E0E0',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  profileAvatarLargeText: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: '#666',
  },
  profileCustomerName: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#000',
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  profileLabel: {
    fontSize: 15,
    color: '#666',
  },
  profileValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#000',
  },
  repeatBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#E8F9EC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start' as const,
    marginVertical: 8,
    gap: 6,
  },
  repeatBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#34C759',
  },
  orderHistoryItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    marginBottom: 8,
  },
  orderHistoryLeft: {
    flex: 1,
  },
  orderHistoryId: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#000',
    marginBottom: 4,
  },
  orderHistoryDate: {
    fontSize: 13,
    color: '#666',
  },
  orderHistoryRight: {
    alignItems: 'flex-end' as const,
  },
  orderHistoryAmount: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 4,
  },
  orderHistoryStatus: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#666',
  },
  orderHistoryStatusCompleted: {
    color: '#34C759',
  },
  orderHistoryStatusCancelled: {
    color: '#FF3B30',
  },
  orderHistoryStatusPending: {
    color: '#FF9500',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center' as const,
    paddingVertical: 16,
  },

  notesInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#000',
    minHeight: 100,
    textAlignVertical: 'top' as const,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  blockButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  blockButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
