import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Modal } from 'react-native';
import { Alert } from '@/utils/alert';

import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Send, Plus, ArrowUp, User, X, Award, ShoppingBag, DollarSign, MapPin, MessageSquare, ClipboardList, FileText, Receipt, Copy, Package, ChevronRight, Check, AlertCircle, MoreVertical } from 'lucide-react-native';
import { ChatActionMenu, ChatActionItem } from '@/components/ChatActionMenu';
import { PaymentRequestCard } from '@/components/PaymentRequestCard';
import { getChatByOrderId, ChatMessage, ContactCardData } from '@/mocks/chatData';
import { mockOrders } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { useChangeRequests } from '@/contexts/ChangeRequestsContext';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useVendorCustomerNotes } from '@/contexts/VendorCustomerNotesContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { useCustomOrders } from '@/contexts/CustomOrderContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendorDrafts } from '@/contexts/VendorDraftContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { MOCK_VENDOR_ID } from '@/mocks/inboxData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { getChatAvailability } from '@/utils/chatAvailability';
import { validateChatMessage } from '@/utils/chatValidation';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

const formatScheduledDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const getCustomerFirstName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  return fullName.trim().split(' ')[0] || 'Customer';
};

const transformSystemMessageForVendor = (content: string, customerFirstName: string): string | null => {
  // Exact-match legacy formats (mock data backward compat)
  if (content === 'Order request sent') return `${customerFirstName} sent an order request`;
  if (content === 'Your order request has been sent. The vendor will review and confirm availability.') return `${customerFirstName} sent an order request`;
  if (content === 'Order accepted') return `You accepted ${customerFirstName}'s order`;
  if (content === 'Order rejected') return `You rejected ${customerFirstName}'s order`;
  if (content === 'Order declined') return `You declined ${customerFirstName}'s order`;
  if (content === 'Order ready') return 'You marked this order as ready';
  if (content === 'Order completed') return 'You marked this order as completed';
  if (content === 'Order cancelled') return `${customerFirstName} cancelled this order`;
  if (content === 'Order cancelled by customer') return `${customerFirstName} cancelled this order`;
  if (content === 'Payment confirmed') return 'You confirmed this payment';
  if (content === 'Payment sent') return `${customerFirstName} marked payment as sent`;
  if (content === 'Payment marked as sent') return `${customerFirstName} marked payment as sent`;

  // Pattern-based matching for vendor-name-prefixed customer chat messages
  if (content.includes('accepted your order request')) return `You accepted ${customerFirstName}'s order`;
  if (content.includes('confirmed payment') || content.includes('confirmed your payment')) return 'You confirmed this payment';
  if (content.includes('marked your order as ready') || content.includes('marked this order as ready')) return 'You marked this order as ready';
  if (content.includes('marked this order as completed') || content.includes('marked your order as completed')) return 'You marked this order as completed';
  if (content.includes('cancelled your order') && !content.includes(customerFirstName)) return `${customerFirstName} cancelled this order`;
  if (content.includes('declined your order request')) return `You declined ${customerFirstName}'s order`;
  if (content.includes('is currently fulfilling')) return `You are fulfilling ${customerFirstName}'s order`;
  if (content.includes('has received your request') || content.includes('Order request sent')) return `${customerFirstName} sent an order request`;
  if (content.includes('marked payment as sent')) return `${customerFirstName} marked payment as sent`;
  if (content.includes('been cancelled')) return `${customerFirstName} cancelled this order`;

  return content;
};

const shouldShowPinnedCard = (o: { status: string; completedAt?: string }): boolean => {
  const activeStatuses = ['accepted', 'confirmed', 'in_progress'];
  if (activeStatuses.includes(o.status)) return true;
  if (o.status === 'completed' && o.completedAt) {
    const completedAt = new Date(o.completedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return completedAt > sevenDaysAgo;
  }
  return false;
};

export default function VendorOrderChatScreen() {
  const { orderId } = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messageText, setMessageText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSecureContactModal, setShowSecureContactModal] = useState(false);
  const [secureContactData, setSecureContactData] = useState<ContactCardData | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [customerNoteText, setCustomerNoteText] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [tempNoteText, setTempNoteText] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<string[]>([]);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [editingPickup, setEditingPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{id: string; shortcut: string; message: string}[]>([]);
  const [showOrderSelectionModal, setShowOrderSelectionModal] = useState(false);
  const [documentType, setDocumentType] = useState<'invoice' | 'receipt' | null>(null);
  const [copiedReceiptId, setCopiedReceiptId] = useState<{[key: string]: boolean}>({});
  const [copiedReceiptOrderId, setCopiedReceiptOrderId] = useState<{[key: string]: boolean}>({});
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<{[key: string]: boolean}>({});
  const [copiedInvoiceOrderId, setCopiedInvoiceOrderId] = useState<{[key: string]: boolean}>({});
  const [systemActionMessages, setSystemActionMessages] = useState<Array<{id: string; content: string}>>([]);
  const [showViewProofModal, setShowViewProofModal] = useState(false);
  const [showChatActionMenu, setShowChatActionMenu] = useState<boolean>(false);
  const changeAcceptedMsgRef = useRef(false);
  const customerPaidMsgRef = useRef(false);
  const { blockUser, getBlockedUserByChatId } = useBlockedUsers();
  const { getNote, saveNote } = useVendorCustomerNotes();
  const { items: catalogItems, categories } = useCatalog();
  const { pickupDetails, isLoaded: isPickupLoaded } = useVendorPickup();
  const { proposals } = useCustomOrders();
  const { plan } = useVendorPlan();
  const { getDraft, saveDraft, clearDraft } = useVendorDrafts();
  const { vendorInbox, updateInboxAfterMessage } = useInbox();

  const { getOrder, vendorConfirmPayment, vendorMarkNotPaid, updateOrderStatus } = useOrders();
  const { requests: changeRequests } = useChangeRequests();

  const chat = getChatByOrderId(orderId as string);
  const orderFromContext = getOrder(orderId as string);
  const order = orderFromContext || mockOrders.find(o => o.id === orderId);
  const isCompleted = order?.status === 'completed';
  const isRejected = false;

  const latestChangeRequest = useMemo(() => {
    if (!orderId) return null;
    const allForOrder = changeRequests.filter((r) => r.orderId === (orderId as string));
    if (allForOrder.length === 0) return null;
    return allForOrder[allForOrder.length - 1];
  }, [changeRequests, orderId]);

  const isPaymentSubmitted = order?.paymentState === 'CUSTOMER_MARKED_PAID';
  const isPaymentConfirmed = order?.paymentState === 'VENDOR_PAYMENT_CONFIRMED';
  const isPaymentRejected = order?.paymentState === 'PAYMENT_REJECTED';

  const chatAvailability = getChatAvailability(
    order?.status || 'requested',
    order?.completedAt
  );

  const activeOrders = useMemo(() => {
    if (!order || !order.customerId) return [];
    const filtered = mockOrders.filter(
      (o) => 
        o.customerId === order.customerId && 
        o.vendorId === order.vendorId && 
        (o.status === 'accepted' || o.status === 'confirmed' || o.status === 'in_progress')
    ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 5);
    
    console.log('🔍 VENDOR CHAT - Pinned Active Orders:');
    console.log('Current order:', order?.id, order?.customerId, order?.vendorId);
    console.log('Pinned count:', filtered.length);
    console.log('Pinned orders:', filtered.map(o => ({ id: o.id, status: o.status })));
    
    return filtered;
  }, [order]);

  const pinnedOrders = useMemo(() => {
    if (!order?.customerId || !order?.vendorId) return [];
    const all = mockOrders
      .filter(o =>
        o.customerId === order.customerId &&
        o.vendorId === order.vendorId &&
        shouldShowPinnedCard(o)
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 5);
    console.log('[VENDOR CHAT] pinnedOrders count:', all.length);
    return all;
  }, [order]);

  const chatId = chat?.id ?? '';
  const blockedUser = chatId ? getBlockedUserByChatId(chatId) : undefined;
  const isBlocked = !!blockedUser;
  const { markChatAsRead } = useChatRead();

  /** Clear unread for vendor when this chat opens. */
  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId, 'vendor');
  }, [chatId, markChatAsRead]);
  const customerId = order?.customerId ?? chat?.customerId ?? '';
  const vendorId = order?.vendorId || chat?.vendorId || '';

  useEffect(() => {
    const draft = getDraft(chatId);
    if (draft) {
      setMessageText(draft);
    }
  }, [chatId, getDraft]);

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

  useEffect(() => {
    loadQuickReplies();
  }, []);

  useEffect(() => {
    if (showQuickRepliesModal) {
      loadQuickReplies();
    }
  }, [showQuickRepliesModal]);

  useEffect(() => {
    if (showPickupModal && !editingPickup && isPickupLoaded) {
      const fullAddress = pickupDetails.unit 
        ? `${pickupDetails.streetAddress}, ${pickupDetails.unit}`
        : pickupDetails.streetAddress;
      setPickupAddress(fullAddress);
      setPickupInstructions(pickupDetails.instructions);
    }
  }, [showPickupModal, editingPickup, pickupDetails, isPickupLoaded]);

  useEffect(() => {
    if (latestChangeRequest?.status === 'accepted' && !changeAcceptedMsgRef.current) {
      changeAcceptedMsgRef.current = true;
      setSystemActionMessages(prev => {
        if (prev.some(m => m.id.startsWith('action-chg-acc-'))) return prev;
        return [...prev, { id: `action-chg-acc-${Date.now()}`, content: 'Customer accepted your changes.' }];
      });
    }
  }, [latestChangeRequest?.status]);

  useEffect(() => {
    if (isPaymentSubmitted && !customerPaidMsgRef.current) {
      customerPaidMsgRef.current = true;
      const firstName = order?.customerName?.trim().split(' ')[0] || 'Customer';
      setSystemActionMessages(prev => {
        if (prev.some(m => m.id.startsWith('action-cust-paid-'))) return prev;
        return [...prev, { id: `action-cust-paid-${Date.now()}`, content: `${firstName} marked this order as paid.` }];
      });
    }
  }, [isPaymentSubmitted, order?.customerName]);

  const loadQuickReplies = async () => {
    try {
      const stored = await AsyncStorage.getItem('quickReplies');
      if (stored) {
        setQuickReplies(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load quick replies:', error);
    }
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const getStableColor = (name: string): string => {
    const colors = [Colors.primary, Colors.textSecondary, Colors.charcoal, '#9CA3AF', Colors.text, '#6B7280', '#2B2B2B', Colors.primary];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const customerDisplayName = order ? formatCustomerNameFromFull(order.customerName || 'Customer') : 'Customer';
  const customerFirstName = getCustomerFirstName(order?.customerName);
  const customerInitials = order?.customerName ? getInitials(order.customerName) : 'C';
  const customerAvatarColor = order?.customerName ? getStableColor(order.customerName) : Colors.textSecondary;

  if (!chat || !order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <View style={[styles.avatarCircleHeader, { backgroundColor: Colors.textSecondary }]}>
              <Text style={styles.avatarTextHeader}>C</Text>
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.errorText}>Order not found</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const handleSendMessage = () => {
    if (messageText.trim()) {
      const messageContent = messageText.trim();
      
      const validation = validateChatMessage(messageContent);
      if (!validation.isValid) {
        setValidationError(validation.errorMessage || 'Invalid message');
        setTimeout(() => setValidationError(null), 4000);
        return;
      }
      
      console.log('[VENDOR ORDER CHAT] Vendor sending message:', messageContent);
      clearDraft(chatId);
      setMessageText('');

      const orderIdStr = orderId as string;
      const conv = vendorInbox.find(item => item.orderId === orderIdStr);
      if (conv) {
        updateInboxAfterMessage({
          conversationId: conv.conversationId,
          lastMessageText: messageContent,
          lastSenderId: MOCK_VENDOR_ID,
          senderRole: 'vendor',
        });
        console.log('[VENDOR ORDER CHAT] Inbox snapshot updated:', conv.conversationId);
      }
    }
  };

  const handleMessageTextChange = (text: string) => {
    setMessageText(text);
    saveDraft(chatId, text);
  };

  const handlePlusButtonPress = () => {
    setShowActionsMenu(true);
  };

  const handleCreateCustomOrder = () => {
    console.log('Create custom order tapped');
    const newProposalId = `proposal-${Date.now()}`;
    const proposalChatId = chatId;
    const proposalVendorId = order?.vendorId || chat?.vendorId || '';
    const vendorSlug = 'sanste';
    const formattedCustomerName = formatCustomerNameFromFull(order?.customerName || 'Customer');
    console.log('Creating new custom order proposal:', newProposalId);
    router.push(
      `/vendor/custom-order/${newProposalId}?chatId=${encodeURIComponent(proposalChatId)}&customerName=${encodeURIComponent(
        formattedCustomerName
      )}&vendorId=${proposalVendorId}&vendorSlug=${vendorSlug}` as any
    );
  };

  const existingPaymentRequest = useMemo(() => {
    if (!chat?.messages) return null;
    const paymentMessages = chat.messages.filter(
      (m) => m.type === 'payment-request' && m.paymentRequestData
    );
    if (paymentMessages.length === 0) return null;
    const lastPayment = paymentMessages[paymentMessages.length - 1];
    if (lastPayment.paymentRequestData?.status === 'confirmed') return null;
    return lastPayment;
  }, [chat?.messages]);

  const [showExistingPaymentModal, setShowExistingPaymentModal] = useState(false);

  const handleSendPaymentRequest = () => {
    setShowActionsMenu(false);

    if (activeOrders.length === 0) {
      Alert.alert(
        'No Active Orders',
        'Payment requests can only be sent for accepted orders.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (existingPaymentRequest) {
      setTimeout(() => {
        setShowExistingPaymentModal(true);
      }, 300);
      return;
    }

    setTimeout(() => {
      router.push(`/vendor/send-payment-request/${order.id}?fromOrder=${order.id}` as any);
    }, 300);
  };

  const handleResendPaymentRequest = () => {
    setShowExistingPaymentModal(false);
    console.log('[VENDOR CHAT] Resending existing payment request');
    Alert.alert(
      'Payment Request Resent',
      'The payment request has been resent to the customer.',
      [{ text: 'OK' }]
    );
  };

  const handleCopyPaymentInstructions = async () => {
    if (!existingPaymentRequest?.paymentRequestData) return;
    const pd = existingPaymentRequest.paymentRequestData;
    let instructions = `Amount: ${formatPriceWithCommas(pd.amount, (mockVendor.currency as Currency) || 'NGN')}\nMethod: ${pd.paymentMethod}`;
    if (pd.bankName) instructions += `\nBank: ${pd.bankName}`;
    if (pd.accountName) instructions += `\nAccount Name: ${pd.accountName}`;
    if (pd.accountNumber) instructions += `\nAccount Number: ${pd.accountNumber}`;
    if (pd.message) instructions += `\nNote: ${pd.message}`;
    await Clipboard.setStringAsync(instructions);
    Alert.alert('Copied', 'Payment instructions copied to clipboard.');
  };

  const handleCatalogPress = () => {
    setShowCatalogModal(true);
    setSelectedCatalogItems([]);
  };

  const handleSendCatalogItems = () => {
    console.log('Sending catalog items:', selectedCatalogItems);
    setShowCatalogModal(false);
    setSelectedCatalogItems([]);
  };

  const handlePickupDetailsPress = () => {
    console.log('Pickup details pressed');
    setShowPickupModal(true);
    setEditingPickup(false);
  };

  const handleSendPickupDetails = () => {
    console.log('Sending pickup details:', { address: pickupAddress, instructions: pickupInstructions });
    
    const pickupMessage: ChatMessage = {
      id: `m${Date.now()}`,
      type: 'pickup-details',
      content: 'Pickup details sent',
      sender: 'vendor',
      timestamp: new Date().toISOString(),
      pickupDetailsData: {
        address: pickupAddress,
        instructions: pickupInstructions,
        scheduledDate: order?.scheduledDate,
        scheduledTime: order?.scheduledTime,
      },
    };
    
    console.log('Pickup details message created:', pickupMessage);
    
    setShowPickupModal(false);
    setEditingPickup(false);
  };

  const handleQuickReplyPress = () => {
    setShowActionsMenu(false);
    if (quickReplies.length === 0) {
      setTimeout(() => {
        router.push('/vendor/settings/quick-replies' as any);
      }, 300);
    } else {
      setTimeout(() => {
        setShowQuickRepliesModal(true);
      }, 300);
    }
  };

  const handleInvoicePress = () => {
    setShowActionsMenu(false);
    if (activeOrders.length === 0) {
      Alert.alert(
        'No Active Orders',
        'Invoices can only be generated for accepted orders.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (plan === 'basic') {
      Alert.alert(
        'Upgrade Required',
        'Invoice generation is available on Standard and Pro plans.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/vendor/settings/subscription' as any) }
        ]
      );
      return;
    }

    setDocumentType('invoice');
    
    if (activeOrders.length > 1) {
      setTimeout(() => {
        setShowOrderSelectionModal(true);
      }, 300);
    } else {
      setTimeout(() => {
        router.push(`/vendor/invoice/${activeOrders[0].id}?chatId=${encodeURIComponent(chatId)}` as any);
      }, 300);
    }
  };

  const handleReceiptPress = () => {
    setShowActionsMenu(false);
    if (activeOrders.length === 0) {
      Alert.alert(
        'No Active Orders',
        'Receipts can only be generated for accepted orders.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (plan === 'basic') {
      Alert.alert(
        'Upgrade Required',
        'Receipt generation is available on Standard and Pro plans.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/vendor/settings/subscription' as any) }
        ]
      );
      return;
    }

    setDocumentType('receipt');
    
    if (activeOrders.length > 1) {
      setTimeout(() => {
        setShowOrderSelectionModal(true);
      }, 300);
    } else {
      setTimeout(() => {
        router.push(`/vendor/receipt/${activeOrders[0].id}?chatId=${encodeURIComponent(chatId)}` as any);
      }, 300);
    }
  };

  const handleSelectQuickReply = (shortcut: string) => {
    setMessageText(`/${shortcut}`);
    setShowQuickRepliesModal(false);
  };

  const handleBlockCustomer = () => {
    if (!isCompleted && !isRejected && order?.status !== 'cancelled') {
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
              id: customerId || `customer:${orderId}`,
              name: order?.customerName || 'Customer',
              role: 'customer',
              chatId: chatId,
              blockedAt: new Date().toISOString(),
            });
            setSystemActionMessages(prev => [...prev, {
              id: `action-block-${Date.now()}`,
              content: `You blocked ${customerDisplayName}`,
            }]);
            console.log('Customer blocked');
          },
        },
      ]
    );
  };



  const handleOpenCustomerProfile = () => {
    setShowCustomerProfile(true);
  };

  const handleOpenNotesModal = () => {
    setTempNoteText(customerNoteText);
    setShowNotesModal(true);
  };

  const handleSaveNote = () => {
    if (order) {
      saveNote(vendorId, customerId, tempNoteText);
      setCustomerNoteText(tempNoteText);
      console.log('Note saved for customer');
      setShowNotesModal(false);
    }
  };

  const handleCancelNote = () => {
    setShowNotesModal(false);
    setTempNoteText(customerNoteText);
  };

  const handleReportCustomer = () => {
    console.log('Report customer pressed');
    setShowCustomerProfile(false);
    setTimeout(() => {
      router.push(`/report-vendor?type=customer&name=${encodeURIComponent(customerDisplayName)}` as any);
    }, 300);
  };

  const getCustomerOrderHistory = () => {
    if (!order) return [];
    return mockOrders.filter(
      (o) => o.customerName === order.customerName && o.vendorId === vendorId
    );
  };

  const getCompletedOrdersCount = () => {
    return getCustomerOrderHistory().filter((o) => o.status === 'completed').length;
  };

  const getLastOrderDate = () => {
    const sortedOrders = getCustomerOrderHistory()
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    return sortedOrders[0]?.orderDate || null;
  };

  const getCustomerSinceDate = () => {
    const completedOrders = getCustomerOrderHistory()
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    return completedOrders[0]?.orderDate || null;
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
      case 'ORDER_REQUESTED': return 'Order Requested';
      case 'CONFIRMED': return 'Confirmed';
      case 'READY': return 'Ready';
      case 'COMPLETED': return 'Completed';
      case 'CANCELLED': return 'Cancelled';
      default: return status;
    }
  };

  const handleSelectOrder = (selectedOrderId: string) => {
    setShowOrderSelectionModal(false);
    
    setTimeout(() => {
      if (documentType === 'invoice') {
        router.push(`/vendor/invoice/${selectedOrderId}?chatId=${encodeURIComponent(chatId)}` as any);
      } else if (documentType === 'receipt') {
        router.push(`/vendor/receipt/${selectedOrderId}?chatId=${encodeURIComponent(chatId)}` as any);
      }
      setDocumentType(null);
    }, 300);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getOrderStatusLabel = (status: string): { label: string; color: string; bgColor: string } => {
    switch (status) {
      case 'accepted':
      case 'confirmed':
        return { label: 'Confirmed', color: Colors.primary, bgColor: 'rgba(255,140,66,0.1)' };
      case 'in_progress':
        return { label: 'In Progress', color: Colors.primary, bgColor: 'rgba(255,140,66,0.1)' };
      case 'completed':
        return { label: 'Completed', color: Colors.success, bgColor: Colors.successLight };
      default:
        return { label: 'Pending', color: Colors.textSecondary, bgColor: Colors.surface };
    }
  };

  const renderPinnedCard = (o: (typeof mockOrders)[0], isScrollItem?: boolean) => {
    const itemCount = o.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
    const displayOrderId = (o.publicOrderId || o.id).toUpperCase();
    let fulfillmentLine = o.fulfillmentType || 'Pickup';
    if (o.scheduledDate) fulfillmentLine += ` • ${formatScheduledDate(o.scheduledDate)}`;
    if (o.scheduledTime) fulfillmentLine += ` • ${o.scheduledTime}`;

    const hasPaymentPending = existingPaymentRequest && existingPaymentRequest.paymentRequestData;
    const orderStatusInfo = getOrderStatusLabel(o.status);

    return (
      <TouchableOpacity
        key={o.id}
        style={[styles.pinnedOrderCard, isScrollItem && styles.pinnedOrderCardScrollItem]}
        onPress={() => {
          console.log('Pinned card tapped, viewing order:', o.id);
          router.push(`/vendor/orders/${o.id}` as any);
        }}
        activeOpacity={0.8}
        testID={`pinned-order-card-${o.id}`}
      >
        <View style={styles.pinnedOrderAccent} />
        <View style={styles.pinnedOrderContent}>
          <View style={styles.pinnedOrderTopRow}>
            <Package size={13} color={Colors.primary} />
            <Text style={styles.pinnedOrderId} numberOfLines={1}>
              Order #{displayOrderId}
            </Text>
          </View>
          <Text style={styles.pinnedOrderFulfillment} numberOfLines={1}>
            {fulfillmentLine}
          </Text>
          <View style={styles.pinnedOrderBottomRow}>
            <Text style={styles.pinnedOrderMeta}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.pinnedOrderDot}>·</Text>
            <Text style={styles.pinnedOrderTotal}>
              {formatPriceWithCommas(o.total, (mockVendor.currency as Currency) || 'NGN')}
            </Text>
          </View>
          {hasPaymentPending ? (
            <View style={styles.pinnedOrderStatusRow}>
              <View style={styles.pinnedPaymentPendingBadge}>
                <View style={styles.pinnedPaymentDot} />
                <Text style={styles.pinnedPaymentPendingText}>Payment Pending</Text>
              </View>
            </View>
          ) : (
            <View style={styles.pinnedOrderStatusRow}>
              <View style={[styles.pinnedOrderStatusBadge, { backgroundColor: orderStatusInfo.bgColor }]}>
                <Text style={[styles.pinnedOrderStatusText, { color: orderStatusInfo.color }]}>
                  {orderStatusInfo.label}
                </Text>
              </View>
            </View>
          )}
        </View>
        <ChevronRight size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  const renderPinnedOrdersSection = () => {
    if (pinnedOrders.length === 0) return null;
    if (pinnedOrders.length === 1) {
      return renderPinnedCard(pinnedOrders[0]);
    }
    return (
      <View style={styles.pinnedOrdersScrollSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pinnedOrdersScrollContent}
          decelerationRate="fast"
        >
          {pinnedOrders.map(o => renderPinnedCard(o, true))}
        </ScrollView>
      </View>
    );
  };

  const chatProposal = proposals.find((p) => p.chatId === chatId && p.state === 'PROPOSAL_SENT');

  const renderCustomOrderPreview = (proposal: typeof chatProposal) => {
    if (!proposal) return null;

    const itemCount = proposal.items.reduce((sum, item) => sum + item.quantity, 0);

    const handleViewCustomOrder = () => {
      router.push(
        `/vendor/custom-order/${proposal.id}?chatId=${encodeURIComponent(chatId)}&customerName=${encodeURIComponent(
          proposal.customerName
        )}&vendorId=${proposal.vendorId}&vendorSlug=${proposal.vendorSlug}` as any
      );
    };

    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.customOrderPreviewCard}>
          <View style={styles.customOrderPreviewContent}>
            <View style={styles.customOrderPreviewImagePlaceholder}>
              <Text style={styles.customOrderPreviewImagePlaceholderText}>🛒</Text>
            </View>
            <View style={styles.customOrderPreviewInfo}>
              <Text style={styles.customOrderPreviewTitle}>Custom Order Proposal</Text>
              <Text style={styles.customOrderPreviewItems}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.customOrderPreviewTotal}>{formatPriceWithCommas(proposal.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.customOrderPreviewButton}
            onPress={handleViewCustomOrder}
            activeOpacity={0.7}
          >
            <Text style={styles.customOrderPreviewButtonText}>View custom order</Text>
          </TouchableOpacity>
          <Text style={styles.customOrderPreviewTimestamp}>{formatTime(proposal.updatedAt)}</Text>
        </View>
      </View>
    );
  };

  const renderMessage = (message: ChatMessage, groupInfo: { isFirstInGroup: boolean; isLastInGroup: boolean } = { isFirstInGroup: true, isLastInGroup: true }) => {
    if (message.type === 'system') {
      const displayContent = transformSystemMessageForVendor(message.content, customerFirstName);
      if (displayContent === null) return null;
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
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
        <View key={message.id} style={styles.systemMessageContainer}>
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
                <Text style={styles.catalogItemCardPrice}>{formatPriceWithCommas(Number(displayPrice) || 0, (mockVendor.currency as Currency) || 'NGN')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.catalogItemCardButton}
              onPress={() => {
                console.log('View catalog item:', item.id);
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
      const vendorDisplayName = order?.vendorName || 'Vendor';
      const orderIdDisplay = order?.publicOrderId || (orderId as string);

      return (
        <View key={message.id} style={styles.paymentRequestWrapper}>
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
      const data = message.invoiceData;
      const orderIdDisplay = order?.publicOrderId ? order.publicOrderId.toUpperCase() : (orderId as string).toUpperCase();
      const invoiceIdDisplay = data.invoiceId.toUpperCase();
      
      const handleCopyInvoiceId = async () => {
        await Clipboard.setStringAsync(data.invoiceId);
        setCopiedInvoiceId({ ...copiedInvoiceId, [message.id]: true });
        setTimeout(() => {
          setCopiedInvoiceId((prev) => {
            const updated = { ...prev };
            delete updated[message.id];
            return updated;
          });
        }, 2000);
      };

      const handleCopyOrderId = async () => {
        await Clipboard.setStringAsync(order?.publicOrderId || orderId as string);
        setCopiedInvoiceOrderId({ ...copiedInvoiceOrderId, [message.id]: true });
        setTimeout(() => {
          setCopiedInvoiceOrderId((prev) => {
            const updated = { ...prev };
            delete updated[message.id];
            return updated;
          });
        }, 2000);
      };

      const handleSendInvoice = () => {
        console.log('Send invoice pressed:', data.invoiceId);
        if (activeOrders.length > 0) {
          router.push(`/vendor/settings/send-invoice/${data.invoiceId}` as any);
        }
      };
      
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.paymentRequestCard}>
            <Text style={styles.paymentRequestCardHeader}>📄 Invoice created</Text>
            
            <View style={styles.paymentRequestInfoSection}>
              <View style={styles.paymentRequestInfoRow}>
                <Text style={styles.paymentRequestInfoLabel}>Invoice ID</Text>
                <TouchableOpacity onPress={handleCopyInvoiceId} style={styles.copyButton} activeOpacity={0.7}>
                  <Copy size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestInfoValue}>{invoiceIdDisplay}</Text>
              {copiedInvoiceId[message.id] && <Text style={styles.copiedFeedback}>Copied</Text>}
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <View style={styles.paymentRequestInfoRow}>
                <Text style={styles.paymentRequestInfoLabel}>Order</Text>
                <TouchableOpacity onPress={handleCopyOrderId} style={styles.copyButton} activeOpacity={0.7}>
                  <Copy size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestInfoValue}>{orderIdDisplay}</Text>
              {copiedInvoiceOrderId[message.id] && <Text style={styles.copiedFeedback}>Copied</Text>}
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <Text style={styles.paymentRequestInfoLabel}>Amount due</Text>
              <Text style={styles.paymentRequestInfoValue}>{formatPriceWithCommas(data.amountDue, (mockVendor.currency as Currency) || 'NGN')}</Text>
            </View>

            <TouchableOpacity
              style={styles.sendInvoiceButton}
              onPress={handleSendInvoice}
              activeOpacity={0.7}
            >
              <Send size={16} color={Colors.text} />
              <Text style={styles.sendInvoiceButtonText}>Send invoice</Text>
            </TouchableOpacity>

            <Text style={styles.paymentRequestCardTimestamp}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (message.type === 'receipt' && message.receiptData) {
      const data = message.receiptData;
      const orderIdDisplay = order?.publicOrderId ? order.publicOrderId.toUpperCase() : (orderId as string).toUpperCase();
      const receiptIdDisplay = data.receiptId.toUpperCase();
      
      const handleCopyReceiptId = async () => {
        await Clipboard.setStringAsync(data.receiptId);
        setCopiedReceiptId({ ...copiedReceiptId, [message.id]: true });
        setTimeout(() => {
          setCopiedReceiptId((prev) => {
            const updated = { ...prev };
            delete updated[message.id];
            return updated;
          });
        }, 2000);
      };

      const handleCopyOrderId = async () => {
        await Clipboard.setStringAsync(order?.publicOrderId || orderId as string);
        setCopiedReceiptOrderId({ ...copiedReceiptOrderId, [message.id]: true });
        setTimeout(() => {
          setCopiedReceiptOrderId((prev) => {
            const updated = { ...prev };
            delete updated[message.id];
            return updated;
          });
        }, 2000);
      };
      
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.paymentRequestCard}>
            <Text style={styles.paymentRequestCardHeader}>🧾 Receipt issued</Text>
            
            <View style={styles.paymentRequestInfoSection}>
              <View style={styles.paymentRequestInfoRow}>
                <Text style={styles.paymentRequestInfoLabel}>Receipt ID</Text>
                <TouchableOpacity onPress={handleCopyReceiptId} style={styles.copyButton} activeOpacity={0.7}>
                  <Copy size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestInfoValue}>{receiptIdDisplay}</Text>
              {copiedReceiptId[message.id] && <Text style={styles.copiedFeedback}>Copied</Text>}
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <View style={styles.paymentRequestInfoRow}>
                <Text style={styles.paymentRequestInfoLabel}>Order</Text>
                <TouchableOpacity onPress={handleCopyOrderId} style={styles.copyButton} activeOpacity={0.7}>
                  <Copy size={14} color={Colors.primary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.paymentRequestInfoValue}>{orderIdDisplay}</Text>
              {copiedReceiptOrderId[message.id] && <Text style={styles.copiedFeedback}>Copied</Text>}
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <Text style={styles.paymentRequestInfoLabel}>Amount paid</Text>
              <Text style={styles.paymentRequestInfoValue}>{formatPriceWithCommas(data.amountPaid, (mockVendor.currency as Currency) || 'NGN')}</Text>
            </View>

            <Text style={styles.paymentRequestCardTimestamp}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    if (message.type === 'contact-card' && message.contactCardData) {
      const isOrderActive = order?.status === 'requested' || order?.status === 'accepted' || order?.status === 'confirmed' || order?.status === 'in_progress';
      const isOrderCompleted = isCompleted || order?.status === 'cancelled';

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
              <User size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
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

    const { isFirstInGroup, isLastInGroup } = groupInfo;
    const isOutgoing = message.sender === 'vendor';

    const outgoingGroupRadius = {
      borderTopRightRadius: isFirstInGroup ? 20 : 6,
      borderBottomRightRadius: isLastInGroup ? 4 : 6,
    };
    const incomingGroupRadius = {
      borderTopLeftRadius: isFirstInGroup ? 20 : 6,
      borderBottomLeftRadius: isLastInGroup ? 4 : 6,
    };

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubbleContainer,
          isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
          !isLastInGroup && styles.messageBubbleCompact,
        ]}
      >
        <View style={styles.bubbleWithTail}>
          {!isOutgoing && isLastInGroup && (
            <View style={styles.bubbleTailIncoming} />
          )}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
              isOutgoing ? outgoingGroupRadius : incomingGroupRadius,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {message.content}
            </Text>
            {isLastInGroup && (
              <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
                {formatTime(message.timestamp)}
              </Text>
            )}
          </View>
          {isOutgoing && isLastInGroup && (
            <View style={styles.bubbleTailOutgoing} />
          )}
        </View>
      </View>
    );
  };

  const GROUP_TIME_THRESHOLD_MS = 3 * 60 * 1000;
  const TIMESTAMP_DIVIDER_THRESHOLD_MS = 5 * 60 * 1000;

  const formatTimestampDivider = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isYesterday) return 'Yesterday · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderMessageList = (msgs: ChatMessage[]): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      const prev = i > 0 ? msgs[i - 1] : null;
      const next = i < msgs.length - 1 ? msgs[i + 1] : null;
      const msgTime = new Date(msg.timestamp).getTime();
      const prevTime = prev ? new Date(prev.timestamp).getTime() : 0;
      const nextTime = next ? new Date(next.timestamp).getTime() : 0;
      if (!prev || msgTime - prevTime > TIMESTAMP_DIVIDER_THRESHOLD_MS) {
        elements.push(
          <View key={`divider-${i}`} style={styles.timestampDivider}>
            <Text style={styles.timestampDividerText}>{formatTimestampDivider(msg.timestamp)}</Text>
          </View>
        );
      }
      const isTextMsg = msg.type === 'text';
      const isSameSenderAsPrev = !!(prev?.sender === msg.sender && prev?.type === 'text' && isTextMsg && msgTime - prevTime <= GROUP_TIME_THRESHOLD_MS);
      const isSameSenderAsNext = !!(next?.sender === msg.sender && next?.type === 'text' && isTextMsg && nextTime - msgTime <= GROUP_TIME_THRESHOLD_MS);
      elements.push(renderMessage(msg, { isFirstInGroup: !isSameSenderAsPrev, isLastInGroup: !isSameSenderAsNext }));
    }
    return elements;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleOpenCustomerProfile}>
            <View style={[styles.avatarCircleHeader, { backgroundColor: customerAvatarColor }]}>
              <Text style={styles.avatarTextHeader}>{customerInitials}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerContent} onPress={handleOpenCustomerProfile}>
            <Text style={styles.headerCustomerName} numberOfLines={1}>{customerDisplayName}</Text>
            <Text style={styles.headerOrderId} numberOfLines={1}>{formatVendorOrderId(order?.publicOrderId || '')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowChatActionMenu(true)}
            style={styles.backButton}
            testID="chat-header-ellipsis"
            accessibilityLabel="More chat options"
          >
            <MoreVertical size={22} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ChatActionMenu
        visible={showChatActionMenu}
        onClose={() => setShowChatActionMenu(false)}
        actions={((): ChatActionItem[] => [
          {
            id: 'view-customer',
            label: 'View customer profile',
            onPress: handleOpenCustomerProfile,
          },
          {
            id: 'search-chat',
            label: 'Search in chat',
            onPress: () => console.log('[VENDOR ORDER CHAT] Search in chat'),
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
              message: 'Send a report about this customer to Platform support?',
              confirmLabel: 'Report',
            },
            onPress: () => console.log('[VENDOR ORDER CHAT] Report customer'),
          },
          {
            id: 'block',
            label: 'Block customer',
            destructive: true,
            requireConfirm: {
              title: 'Block customer',
              message: 'This will archive the chat and prevent further messages. Order history will remain.',
              confirmLabel: 'Block',
            },
            onPress: handleBlockCustomer,
          },
        ])()}
      />

      {renderPinnedOrdersSection()}

      {isPaymentSubmitted && (
        <View style={styles.paymentVerificationBanner}>
          <View style={styles.paymentVerificationContent}>
            <View style={styles.paymentVerificationDot} />
            <Text style={styles.paymentVerificationText}>
              {customerFirstName} marked this order as paid
            </Text>
          </View>
          <View style={styles.paymentStatusBlock}>
            <Text style={styles.paymentStatusBlockLabel}>Payment status</Text>
            <View style={styles.paymentStatusBlockRow}>
              <Text style={styles.paymentStatusBlockValue}>Customer marked as paid</Text>
              {order?.paymentProof && order.paymentProof.length > 0 ? (
                <TouchableOpacity onPress={() => setShowViewProofModal(true)} activeOpacity={0.7}>
                  <Text style={styles.viewProofLink}>View proof ({order.paymentProof.length})</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.noProofText}>No proof uploaded</Text>
              )}
            </View>
          </View>
          <View style={styles.paymentVerificationActions}>
            <TouchableOpacity
              style={styles.paymentRejectButton}
              onPress={() => {
                Alert.alert(
                  'Mark as Not Paid',
                  'Are you sure payment was not received?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Not Paid',
                      style: 'destructive',
                      onPress: () => {
                        const success = vendorMarkNotPaid(orderId as string);
                        if (success) {
                          setSystemActionMessages(prev => [...prev, {
                            id: `action-notpaid-${Date.now()}`,
                            content: 'You marked payment as not received',
                          }]);
                        }
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <X size={16} color={Colors.error} strokeWidth={2} />
              <Text style={styles.paymentRejectButtonText}>Not Paid</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.paymentConfirmButton}
              onPress={() => {
                Alert.alert(
                  'Confirm Payment',
                  'Have you verified the payment?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Confirm',
                      onPress: () => {
                        const success = vendorConfirmPayment(orderId as string);
                        if (success) {
                          setSystemActionMessages(prev => [...prev, {
                            id: `action-confirmed-${Date.now()}`,
                            content: `${order?.vendorName || 'You'} confirmed payment.`,
                          }]);
                        }
                      },
                    },
                  ]
                );
              }}
              activeOpacity={0.7}
            >
              <Check size={16} color={Colors.white} strokeWidth={2.5} />
              <Text style={styles.paymentConfirmButtonText}>Confirm Payment</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {isPaymentConfirmed && order?.status === 'confirmed' && (
        <View style={styles.paymentConfirmedBanner}>
          <View style={styles.paymentConfirmedContent}>
            <Check size={16} color={Colors.success} strokeWidth={2.5} />
            <Text style={styles.paymentConfirmedText}>Payment Confirmed</Text>
          </View>
          <TouchableOpacity
            style={styles.markInProgressChatButton}
            onPress={() => {
              Alert.alert(
                'Start Order',
                'Mark this order as in progress?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Start',
                    onPress: () => {
                      const success = updateOrderStatus(orderId as string, 'in_progress');
                      if (success) {
                        setSystemActionMessages(prev => [...prev, {
                          id: `action-inprogress-${Date.now()}`,
                          content: 'You started fulfilling this order',
                        }]);
                      }
                    },
                  },
                ]
              );
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.markInProgressChatButtonText}>Mark In Progress</Text>
          </TouchableOpacity>
        </View>
      )}

      {isPaymentRejected && (
        <View style={styles.paymentRejectedBanner}>
          <AlertCircle size={16} color={Colors.error} />
          <Text style={styles.paymentRejectedText}>Payment marked as not received</Text>
        </View>
      )}

      {latestChangeRequest && latestChangeRequest.status === 'accepted' && !isPaymentSubmitted && !isPaymentConfirmed && (
        <View>
          <View style={styles.changeAcceptedBanner}>
            <Check size={16} color={Colors.success} strokeWidth={2.5} />
            <Text style={styles.changeAcceptedText}>{customerFirstName} accepted your changes</Text>
          </View>
          <View style={styles.paymentInstructionsBannerRow}>
            {existingPaymentRequest ? (
              <View style={styles.waitingForPaymentRow}>
                <View style={styles.waitingForPaymentDot} />
                <Text style={styles.waitingForPaymentText}>Waiting for payment</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.sendPaymentInstructionsButton}
                onPress={() => {
                  router.push(`/vendor/send-payment-request/${order.id}?fromOrder=${order.id}` as any);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sendPaymentInstructionsButtonText}>Send Payment Instructions</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {latestChangeRequest && latestChangeRequest.status === 'declined' && (
        <View style={styles.changeDeclinedBanner}>
          <AlertCircle size={16} color={Colors.error} />
          <Text style={styles.changeDeclinedText}>{customerFirstName} declined your changes</Text>
        </View>
      )}

      {isBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedText}>You&apos;ve blocked this user. You can unblock them in Settings.</Text>
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
          {renderMessageList(chat.messages)}
          {chatProposal && renderCustomOrderPreview(chatProposal)}
          {systemActionMessages.map(msg => (
            <View key={msg.id} style={styles.systemActionBubbleContainer}>
              <View style={styles.systemActionBubble}>
                <Text style={styles.systemActionBubbleText}>{msg.content}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          {validationError && (
            <View style={styles.validationErrorContainer}>
              <Text style={styles.validationErrorText}>{validationError}</Text>
            </View>
          )}
          {chatAvailability.isVendorInputDisabled && (chatAvailability.vendorReason || chatAvailability.reason) ? (
            <View style={[
              styles.completedInfoContainer,
              isRejected && styles.rejectedInfoContainer,
              isBlocked && styles.blockedInfoContainer
            ]}>
              <Text style={[
                styles.completedInfoText,
                isRejected && styles.rejectedInfoText,
                isBlocked && styles.blockedInfoText
              ]}>
                {chatAvailability.vendorReason || chatAvailability.reason}
              </Text>
            </View>
          ) : isBlocked ? (
            <View style={styles.blockedInfoContainer}>
              <Text style={styles.blockedInfoText}>Unblock to send messages</Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={styles.plusButton}
                onPress={handlePlusButtonPress}
                activeOpacity={0.7}
              >
                <View style={styles.plusCircle}>
                  <Plus size={20} color={Colors.textSecondary} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={chatAvailability.isVendorInputDisabled ? 'Chat is no longer available' : 'Send a message…'}
                  placeholderTextColor='#AEAEB2'
                  value={messageText}
                  onChangeText={(text) => {
                    handleMessageTextChange(text);
                    if (text === '/' && quickReplies.length > 0) {
                      setShowQuickRepliesModal(true);
                    }
                  }}
                  multiline
                  maxLength={500}
                  editable={!chatAvailability.isVendorInputDisabled}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  messageText.trim() !== '' && styles.sendButtonActive,
                ]}
                onPress={handleSendMessage}
                disabled={messageText.trim() === ''}
                activeOpacity={0.8}
              >
                <ArrowUp
                  size={18}
                  color={messageText.trim() !== '' ? '#FFFFFF' : '#AEAEB2'}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <Modal
        visible={showActionsMenu}
        animationType="slide"
        transparent
        onRequestClose={() => setShowActionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.actionsMenuOverlay}
          activeOpacity={1}
          onPress={() => setShowActionsMenu(false)}
        >
          <View style={styles.actionsMenuContainer}>
            <View style={styles.actionsMenuGrid}>
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={() => {
                  setShowActionsMenu(false);
                  setTimeout(() => handleSendPaymentRequest(), 300);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionsMenuIconCircle}>
                  <DollarSign size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Payment</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={() => {
                  setShowActionsMenu(false);
                  setTimeout(() => handlePickupDetailsPress(), 300);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionsMenuIconCircle}>
                  <MapPin size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Pickup</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={() => {
                  setShowActionsMenu(false);
                  setTimeout(() => handleCatalogPress(), 300);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionsMenuIconCircle}>
                  <ShoppingBag size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Catalog</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={handleQuickReplyPress}
                activeOpacity={0.7}
              >
                <View style={styles.actionsMenuIconCircle}>
                  <MessageSquare size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Quick replies</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={handleInvoicePress}
                activeOpacity={0.7}
              >
                <View style={[styles.actionsMenuIconCircle, plan === 'basic' && styles.actionsMenuIconCircleDisabled]}>
                  <FileText size={24} color={plan === 'basic' ? Colors.textSecondary : Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Invoice</Text>
                {plan === 'basic' && <Text style={styles.actionsMenuUpgradeText}>Upgrade</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={handleReceiptPress}
                activeOpacity={0.7}
              >
                <View style={[styles.actionsMenuIconCircle, plan === 'basic' && styles.actionsMenuIconCircleDisabled]}>
                  <Receipt size={24} color={plan === 'basic' ? Colors.textSecondary : Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Receipt</Text>
                {plan === 'basic' && <Text style={styles.actionsMenuUpgradeText}>Upgrade</Text>}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.actionsMenuGridItem}
                onPress={() => {
                  setShowActionsMenu(false);
                  setTimeout(() => handleCreateCustomOrder(), 300);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.actionsMenuIconCircle}>
                  <ClipboardList size={24} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.actionsMenuGridItemText}>Custom Order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCatalogModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCatalogModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => setShowCatalogModal(false)}>
              <Text style={styles.catalogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.catalogModalTitle}>Catalog</Text>
            <TouchableOpacity
              onPress={handleSendCatalogItems}
              disabled={selectedCatalogItems.length === 0}
            >
              <Text style={[
                styles.catalogSendText,
                selectedCatalogItems.length === 0 && styles.catalogSendTextDisabled
              ]}>Send</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.catalogContent} showsVerticalScrollIndicator={false}>
            {categories.map(category => {
              const categoryItems = catalogItems.filter(item => item.categoryId === category.id && item.isAvailable);
              if (categoryItems.length === 0) return null;

              return (
                <View key={category.id} style={styles.catalogSection}>
                  <Text style={styles.catalogSectionTitle}>{category.name}</Text>
                  {categoryItems.map(item => {
                    const isSelected = selectedCatalogItems.includes(item.id);
                    const displayPrice = item.salePrice || item.basePrice;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.catalogItem,
                          isSelected && styles.catalogItemSelected
                        ]}
                        onPress={() => {
                          setSelectedCatalogItems(prev =>
                            prev.includes(item.id)
                              ? prev.filter(id => id !== item.id)
                              : [...prev, item.id]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.catalogItemLeft}>
                          {item.photos[0] ? (
                            <Image
                              source={{ uri: item.photos[0] }}
                              style={styles.catalogItemImage}
                              contentFit="cover"
                            />
                          ) : (
                            <View style={styles.catalogItemImagePlaceholder}>
                              <Text style={styles.catalogItemImagePlaceholderText}>📷</Text>
                            </View>
                          )}
                          <View style={styles.catalogItemInfo}>
                            <Text style={styles.catalogItemName}>{item.name}</Text>
                            {item.description && (
                              <Text style={styles.catalogItemDescription} numberOfLines={1}>
                                {item.description}
                              </Text>
                            )}
                            <Text style={styles.catalogItemPrice}>{formatPriceWithCommas(displayPrice, (mockVendor.currency as Currency) || 'NGN')}</Text>
                          </View>
                        </View>
                        <View style={[
                          styles.catalogCheckbox,
                          isSelected && styles.catalogCheckboxSelected
                        ]}>
                          {isSelected && <Text style={styles.catalogCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showPickupModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPickupModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => setShowPickupModal(false)}>
              <Text style={styles.catalogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.catalogModalTitle}>Pickup Details</Text>
            <TouchableOpacity 
              onPress={() => {
                setShowPickupModal(false);
                router.push('/vendor/settings/pickup-details' as any);
              }}
            >
              <Text style={styles.catalogSendText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.pickupContent} showsVerticalScrollIndicator={false}>
            {!pickupAddress.trim() ? (
              <View style={styles.pickupEmptyState}>
                <View style={styles.pickupEmptyIcon}>
                  <MapPin size={48} color={Colors.textMuted} strokeWidth={1.5} />
                </View>
                <Text style={styles.pickupEmptyTitle}>No pickup details saved</Text>
                <Text style={styles.pickupEmptyDescription}>
                  Set up your pickup address and instructions in Settings to quickly share them with customers.
                </Text>
                <TouchableOpacity
                  style={styles.pickupSetupButton}
                  onPress={() => {
                    setShowPickupModal(false);
                    router.push('/vendor/settings/pickup-details' as any);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickupSetupButtonText}>Set up pickup details</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.pickupInfoBanner}>
                  <Text style={styles.pickupInfoText}>
                    📍 Saved from Settings · Tap Settings to update
                  </Text>
                </View>

                <View style={styles.pickupSection}>
                  <Text style={styles.pickupLabel}>Pickup Address</Text>
                  <View style={styles.pickupValueCard}>
                    <Text style={styles.pickupValue}>{pickupAddress}</Text>
                  </View>
                </View>

                {pickupInstructions.trim() && (
                  <View style={styles.pickupSection}>
                    <Text style={styles.pickupLabel}>Pickup Instructions</Text>
                    <View style={styles.pickupValueCard}>
                      <Text style={styles.pickupValue}>{pickupInstructions}</Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.sendPickupButton}
                  onPress={handleSendPickupDetails}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sendPickupButtonText}>Send to chat</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showQuickRepliesModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowQuickRepliesModal(false)}
      >
        <TouchableOpacity
          style={styles.quickRepliesOverlay}
          activeOpacity={1}
          onPress={() => setShowQuickRepliesModal(false)}
        >
          <KeyboardAvoidingView
            style={styles.quickRepliesKeyboardAvoid}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
          >
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickRepliesContainer}>
                <View style={styles.quickRepliesHeader}>
                  <View style={styles.quickRepliesHeaderLeft} />
                  <Text style={styles.quickRepliesTitle}>Quick Replies</Text>
                  <TouchableOpacity
                    style={styles.quickRepliesEditButton}
                    onPress={() => {
                      setShowQuickRepliesModal(false);
                      setTimeout(() => {
                        router.push('/vendor/settings/quick-replies' as any);
                      }, 300);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.quickRepliesEditText}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView 
                  style={styles.quickRepliesList} 
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  {quickReplies.length === 0 ? (
                    <View style={styles.quickRepliesEmptyContainer}>
                      <Text style={styles.quickRepliesEmpty}>No quick replies saved</Text>
                      <Text style={styles.quickRepliesEmptySubtext}>Tap Manage to create your first quick reply</Text>
                    </View>
                  ) : (
                    quickReplies.map(reply => (
                      <TouchableOpacity
                        key={reply.id}
                        style={styles.quickReplyItem}
                        onPress={() => handleSelectQuickReply(reply.shortcut)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.quickReplyShortcut}>/{reply.shortcut}</Text>
                        <Text style={styles.quickReplyMessage} numberOfLines={2}>
                          {reply.message}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showCustomerProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCustomerProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.profileHeader}>
            <View style={styles.profileHeaderLeft} />
            <Text style={styles.profileTitle}>Customer Profile</Text>
            <TouchableOpacity
              onPress={() => setShowCustomerProfile(false)}
              style={styles.profileCloseButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.profileContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileAvatarSection}>
              <View style={[styles.profileAvatarLarge, { backgroundColor: customerAvatarColor }]}>
                <Text style={styles.profileAvatarLargeText}>
                  {customerInitials}
                </Text>
              </View>
              <Text style={styles.profileCustomerName}>{customerDisplayName}</Text>
            </View>

            <View style={styles.profileSummaryCard}>
              <View style={styles.profileSummaryRow}>
                <View style={styles.profileSummaryItem}>
                  <Text style={styles.profileSummaryLabel}>Total orders</Text>
                  <Text style={styles.profileSummaryValue}>{getCustomerOrderHistory().length}</Text>
                </View>
                <View style={styles.profileSummaryDivider} />
                <View style={styles.profileSummaryItem}>
                  <Text style={styles.profileSummaryLabel}>Completed</Text>
                  <Text style={styles.profileSummaryValue}>{getCompletedOrdersCount()}</Text>
                </View>
                <View style={styles.profileSummaryDivider} />
                <View style={styles.profileSummaryItem}>
                  <Text style={styles.profileSummaryLabel}>Last order</Text>
                  <Text style={styles.profileSummaryValue}>
                    {getLastOrderDate() ? formatDate(getLastOrderDate()!) : '-'}
                  </Text>
                </View>
              </View>
              {getCompletedOrdersCount() >= 2 && (
                <View style={styles.repeatBadge}>
                  <Award size={14} color={Colors.success} />
                  <Text style={styles.repeatBadgeText}>Repeat Customer</Text>
                </View>
              )}
            </View>

            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Vendor Notes</Text>
              <View style={styles.notesCardContainer}>
                <TouchableOpacity
                  style={styles.notesCard}
                  onPress={handleOpenNotesModal}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.notesCardText,
                    !customerNoteText && styles.notesCardPlaceholder
                  ]}>
                    {customerNoteText || 'Add notes about this customer...'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.notesHelperText}>Only you can see this information</Text>
              </View>
            </View>

            <View style={styles.profileSection}>
              <View style={styles.profileSectionHeader}>
                <Text style={styles.profileSectionTitle}>Order History</Text>
                {getCustomerOrderHistory().length > 3 && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowCustomerProfile(false);
                      setTimeout(() => {
                        router.push(
                          `/vendor/customer-orders/${customerId}?customerName=${encodeURIComponent(
                            customerDisplayName
                          )}&vendorId=${vendorId}` as any
                        );
                      }, 300);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {getCustomerOrderHistory().length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : (
                getCustomerOrderHistory().slice(0, 3).map((historyOrder) => (
                  <TouchableOpacity
                    key={historyOrder.id}
                    style={styles.orderHistoryCard}
                    onPress={() => {
                      setShowCustomerProfile(false);
                      router.push(`/vendor/orders/${historyOrder.id}` as any);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.orderHistoryMain}>
                      <View style={styles.orderHistoryLeft}>
                        <Text style={styles.orderHistoryId}>{formatVendorOrderId(historyOrder.publicOrderId)}</Text>
                        <Text style={styles.orderHistoryDate}>{formatDate(historyOrder.orderDate)}</Text>
                      </View>
                      <View style={styles.orderHistoryRight}>
                        <Text style={styles.orderHistoryAmount}>
                          {formatPriceWithCommas(historyOrder.total, (mockVendor.currency as Currency) || 'NGN')}
                        </Text>
                        <View style={[
                          styles.orderStatusBadge,
                          historyOrder.status === 'completed' && styles.orderStatusBadgeCompleted,
                          historyOrder.status === 'accepted' && styles.orderStatusBadgeAccepted,
                          historyOrder.status === 'in_progress' && styles.orderStatusBadgeInProgress,
                          historyOrder.status === 'cancelled' && styles.orderStatusBadgeCancelled,
                        ]}>
                          <Text style={[
                            styles.orderStatusBadgeText,
                            historyOrder.status === 'completed' && styles.orderStatusBadgeTextCompleted,
                            historyOrder.status === 'accepted' && styles.orderStatusBadgeTextAccepted,
                            historyOrder.status === 'in_progress' && styles.orderStatusBadgeTextInProgress,
                            historyOrder.status === 'cancelled' && styles.orderStatusBadgeTextCancelled,
                          ]}>
                            {formatOrderStatus(historyOrder.status)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.profileActionsSection}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setShowCustomerProfile(false);
                  handleBlockCustomer();
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>Block {customerDisplayName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleReportCustomer}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>Report {customerDisplayName}</Text>
              </TouchableOpacity>
              {getCustomerSinceDate() && (
                <Text style={styles.customerSinceText}>
                  Customer since {formatDate(getCustomerSinceDate()!)}
                </Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showSecureContactModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowSecureContactModal(false)}
      >
        <SafeAreaView style={styles.secureModalContainer} edges={['top', 'bottom']}>
          <View style={styles.secureModalHeader}>
            <Text style={styles.secureModalTitle}>Contact Details</Text>
            <TouchableOpacity
              onPress={() => {
                setShowSecureContactModal(false);
                setSecureContactData(null);
              }}
              style={styles.secureModalCloseButton}
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.secureModalContent}>
            <View style={styles.secureWarningBanner}>
              <Text style={styles.secureWarningText}>
                🔒 Secure View · Contact details will expire when order is completed
              </Text>
            </View>

            {secureContactData?.name && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Full Name</Text>
                <Text style={styles.secureContactValue}>{secureContactData.name}</Text>
              </View>
            )}

            {secureContactData?.phone && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Phone Number</Text>
                <Text style={styles.secureContactValue}>{secureContactData.phone}</Text>
              </View>
            )}

            {secureContactData?.address && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Address</Text>
                <Text style={styles.secureContactValue}>{secureContactData.address}</Text>
              </View>
            )}

            {secureContactData?.note && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Delivery / Pickup Note</Text>
                <Text style={[styles.secureContactValue, styles.secureContactValueMultiline]}>
                  {secureContactData.note}
                </Text>
              </View>
            )}

            <View style={styles.securePrivacyNotice}>
              <Text style={styles.securePrivacyText}>
                ⚠️ Privacy Notice
              </Text>
              <Text style={styles.securePrivacyDescription}>
                • Contact details are order-scoped and time-bound{"\n"}
                • Access expires automatically when order is completed{"\n"}
                • Do not share or save this information externally
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showNotesModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelNote}
      >
        <SafeAreaView style={styles.notesModalContainer} edges={['top']}>
          <View style={styles.notesModalHeader}>
            <TouchableOpacity onPress={handleCancelNote} style={styles.notesModalHeaderButton}>
              <Text style={styles.notesModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.notesModalTitle}>Notes</Text>
            <TouchableOpacity onPress={handleSaveNote} style={styles.notesModalHeaderButton}>
              <Text style={styles.notesModalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notesModalContent}>
            <TextInput
              style={styles.notesModalInput}
              placeholder="Add notes about this customer..."
              placeholderTextColor={Colors.textSecondary}
              value={tempNoteText}
              onChangeText={setTempNoteText}
              multiline
              maxLength={500}
              autoFocus
            />
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showExistingPaymentModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowExistingPaymentModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => setShowExistingPaymentModal(false)}>
              <Text style={styles.catalogCancelText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.catalogModalTitle}>Payment Request</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.existingPaymentContent} showsVerticalScrollIndicator={false}>
            {existingPaymentRequest?.paymentRequestData && (
              <>
                <View style={styles.existingPaymentStatusCard}>
                  <View style={styles.existingPaymentStatusDot} />
                  <Text style={styles.existingPaymentStatusText}>Awaiting customer payment</Text>
                </View>

                <View style={styles.existingPaymentAmountCard}>
                  <Text style={styles.existingPaymentAmountLabel}>AMOUNT REQUESTED</Text>
                  <Text style={styles.existingPaymentAmountValue}>
                    {formatPriceWithCommas(existingPaymentRequest.paymentRequestData.amount, (mockVendor.currency as Currency) || 'NGN')}
                  </Text>
                  <Text style={styles.existingPaymentMethodText}>
                    {existingPaymentRequest.paymentRequestData.paymentMethod}
                  </Text>
                </View>

                {existingPaymentRequest.paymentRequestData.bankName && (
                  <View style={styles.existingPaymentDetailCard}>
                    <Text style={styles.existingPaymentDetailTitle}>Payment Details</Text>
                    <View style={styles.existingPaymentDetailRow}>
                      <Text style={styles.existingPaymentDetailLabel}>Bank</Text>
                      <Text style={styles.existingPaymentDetailValue}>{existingPaymentRequest.paymentRequestData.bankName}</Text>
                    </View>
                    {existingPaymentRequest.paymentRequestData.accountName && (
                      <View style={styles.existingPaymentDetailRow}>
                        <Text style={styles.existingPaymentDetailLabel}>Account Name</Text>
                        <Text style={styles.existingPaymentDetailValue}>{existingPaymentRequest.paymentRequestData.accountName}</Text>
                      </View>
                    )}
                    {existingPaymentRequest.paymentRequestData.accountNumber && (
                      <View style={styles.existingPaymentDetailRow}>
                        <Text style={styles.existingPaymentDetailLabel}>Account Number</Text>
                        <Text style={styles.existingPaymentDetailValue}>{existingPaymentRequest.paymentRequestData.accountNumber}</Text>
                      </View>
                    )}
                  </View>
                )}

                {existingPaymentRequest.paymentRequestData.message && (
                  <View style={styles.existingPaymentNoteCard}>
                    <Text style={styles.existingPaymentNoteLabel}>NOTE</Text>
                    <Text style={styles.existingPaymentNoteText}>{existingPaymentRequest.paymentRequestData.message}</Text>
                  </View>
                )}

                <View style={styles.existingPaymentActions}>
                  <TouchableOpacity
                    style={styles.existingPaymentResendButton}
                    onPress={handleResendPaymentRequest}
                    activeOpacity={0.7}
                  >
                    <Send size={16} color={Colors.white} />
                    <Text style={styles.existingPaymentResendText}>Resend to Customer</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.existingPaymentCopyButton}
                    onPress={handleCopyPaymentInstructions}
                    activeOpacity={0.7}
                  >
                    <Copy size={16} color={Colors.primary} />
                    <Text style={styles.existingPaymentCopyText}>Copy Payment Instructions</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.existingPaymentDuplicateNote}>
                  A payment request already exists for this order. You can resend or copy the instructions above.
                </Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showOrderSelectionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowOrderSelectionModal(false);
          setDocumentType(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => {
              setShowOrderSelectionModal(false);
              setDocumentType(null);
            }}>
              <Text style={styles.catalogCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.catalogModalTitle}>Select Order</Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.orderSelectionContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.orderSelectionDescription}>
              Select the order you want to generate {documentType === 'invoice' ? 'an invoice' : 'a receipt'} for.
            </Text>
            {activeOrders.map((orderItem) => {
              const orderDate = new Date(orderItem.orderDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              });
              
              return (
                <TouchableOpacity
                  key={orderItem.id}
                  style={styles.orderSelectionItem}
                  onPress={() => handleSelectOrder(orderItem.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.orderSelectionItemContent}>
                    <Text style={styles.orderSelectionOrderId}>
                      {formatVendorOrderId(orderItem.publicOrderId)}
                    </Text>
                    <View style={styles.orderSelectionRow}>
                      <Text style={styles.orderSelectionDate}>{orderDate}</Text>
                      <View style={[
                        styles.orderSelectionStatusPill,
                        orderItem.status === 'completed' && styles.orderSelectionStatusPillCompleted,
                        orderItem.status === 'accepted' && styles.orderSelectionStatusPillAccepted,
                        orderItem.status === 'in_progress' && styles.orderSelectionStatusPillInProgress,

                      ]}>
                        <Text style={[
                          styles.orderSelectionStatusText,
                          orderItem.status === 'completed' && styles.orderSelectionStatusTextCompleted,
                          orderItem.status === 'accepted' && styles.orderSelectionStatusTextAccepted,
                          orderItem.status === 'in_progress' && styles.orderSelectionStatusTextInProgress,

                        ]}>
                          {formatOrderStatus(orderItem.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderSelectionTotal}>
                      {formatPriceWithCommas(orderItem.total, (mockVendor.currency as Currency) || 'NGN')}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showViewProofModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowViewProofModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.catalogModalHeader}>
            <TouchableOpacity onPress={() => setShowViewProofModal(false)}>
              <Text style={styles.catalogCancelText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.catalogModalTitle}>Payment Proof</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.proofContent} showsVerticalScrollIndicator={false}>
            {order?.paymentProof && order.paymentProof.length > 0 ? (
              order.paymentProof.map((proof) => (
                <View key={proof.id} style={styles.proofItem}>
                  {proof.type === 'image' ? (
                    <Image
                      source={{ uri: proof.uri }}
                      style={styles.proofImage}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={styles.proofFileCard}>
                      <FileText size={32} color={Colors.primary} />
                      <Text style={styles.proofFileName}>PDF Document</Text>
                    </View>
                  )}
                  <Text style={styles.proofTimestamp}>
                    Uploaded {new Date(proof.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.proofEmptyState}>
                <Text style={styles.proofEmptyText}>No proof files uploaded</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
    flexShrink: 0,
  },
  headerSpacer: {
    width: 40,
  },
  headerContent: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
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
    backgroundColor: '#F7F3EF',
  },
  messagesContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  messageBubbleContainer: {
    marginBottom: 6,
  },
  messageBubbleCompact: {
    marginBottom: 2,
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
    justifyContent: 'flex-start' as const,
  },
  timestampDivider: {
    alignItems: 'center' as const,
    marginVertical: 10,
  },
  timestampDividerText: {
    fontSize: 11,
    color: Colors.textMuted,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden' as const,
  },

  avatarCircleHeader: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  avatarTextHeader: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#EDEEF2',
    borderBottomLeftRadius: 4,
  },
  bubbleWithTail: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  bubbleTailOutgoing: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: Colors.primary,
    borderRightWidth: 10,
    borderRightColor: 'transparent' as const,
    marginBottom: 2,
    marginLeft: -2,
  },
  bubbleTailIncoming: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: '#EDEEF2',
    borderLeftWidth: 10,
    borderLeftColor: 'transparent' as const,
    marginBottom: 2,
    marginRight: -2,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 1,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-end' as const,
  },
  outgoingMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginVertical: 6,
    paddingHorizontal: 24,
  },
  systemMessageBubble: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  systemMessageText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 16,
  },
  systemActionBubbleContainer: {
    alignItems: 'center' as const,
    marginVertical: 10,
    paddingHorizontal: 24,
  },
  systemActionBubble: {
    backgroundColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  systemActionBubbleText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  paymentRequestWrapper: {
    alignItems: 'center' as const,
    marginBottom: 8,
    width: '100%',
  },
  paymentRequestCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: '90%',
    width: '100%',
  },
  paymentRequestCardHeader: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  paymentRequestInfoSection: {
    marginBottom: 14,
  },
  paymentRequestInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  paymentRequestInfoLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  paymentRequestInfoValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  copyButton: {
    padding: 4,
  },
  copiedFeedback: {
    fontSize: 12,
    color: Colors.success,
    marginTop: 4,
  },
  paymentRequestCardTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 12,
    textAlign: 'right' as const,
  },
  paymentRequestFooter: {
    backgroundColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  paymentRequestFooterText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  contactCardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: '90%',
    width: '100%',
  },
  contactCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contactCardHeaderText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  contactCardContent: {},
  contactCardTime: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  contactCardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  viewContactButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center' as const,
  },
  viewContactButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  expiredContactCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    maxWidth: '90%',
  },
  expiredContactText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  secureModalContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  secureModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  secureModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
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
    backgroundColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secureWarningText: {
    fontSize: 13,
    color: Colors.star,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  secureContactSection: {
    marginBottom: 24,
  },
  secureContactLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  secureContactValue: {
    fontSize: 17,
    color: Colors.text,
    lineHeight: 24,
  },
  secureContactValueMultiline: {
    lineHeight: 26,
  },

  securePrivacyNotice: {
    marginTop: 32,
    padding: 16,
    backgroundColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  securePrivacyText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.star,
    marginBottom: 8,
  },
  securePrivacyDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  pinnedOrderCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  pinnedOrderCardScrollItem: {
    width: 268,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginRight: 0,
  },
  pinnedOrdersScrollSection: {
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 6,
  },
  pinnedOrdersScrollContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pinnedOrderAccent: {
    width: 3,
    height: 44,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  pinnedOrderContent: {
    flex: 1,
    gap: 2,
  },
  pinnedOrderTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  pinnedOrderId: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    flex: 1,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  pinnedOrderFulfillment: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
    marginLeft: 18,
  },
  pinnedOrderBottomRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginLeft: 18,
  },
  pinnedOrderMeta: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pinnedOrderDot: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  pinnedOrderTotal: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  stickyOrderSummaryContainer: {
    backgroundColor: Colors.surface,
    paddingTop: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderCardsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  compactOrderSummary: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    minWidth: 280,
  },
  compactOrderLine: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 3,
  },
  compactOrderViewDetails: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 6,
    fontWeight: '500' as const,
  },
  inputSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  plusButton: {
    paddingBottom: 2,
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    minHeight: 38,
    justifyContent: 'center' as const,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
    lineHeight: 21,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 1,
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
  },
  actionsMenuContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  actionsMenuGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-start' as const,
    gap: 8,
  },
  actionsMenuGridItem: {
    width: '22%',
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  actionsMenuIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  actionsMenuIconCircleDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.6,
  },
  actionsMenuGridItemText: {
    fontSize: 11,
    color: Colors.text,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  actionsMenuUpgradeText: {
    fontSize: 9,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 2,
  },
  actionsMenuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  actionsMenuItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pendingInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.warningLight,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  pendingInfoText: {
    fontSize: 14,
    color: Colors.primary,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  completedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  completedInfoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  rejectedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.errorLight,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  rejectedInfoText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  blockedInfoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.errorLight,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  blockedInfoText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  destructiveText: {
    color: Colors.error,
  },
  blockedBanner: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  blockedText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  catalogModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catalogModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogCancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  catalogSendText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  catalogSendTextDisabled: {
    opacity: 0.4,
  },
  catalogContent: {
    flex: 1,
  },
  catalogSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  catalogSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  catalogItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catalogItemSelected: {
    backgroundColor: Colors.border,
  },
  catalogItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  catalogItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: Colors.border,
  },
  catalogItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  catalogItemImagePlaceholderText: {
    fontSize: 24,
  },
  catalogItemInfo: {
    flex: 1,
  },
  catalogItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  catalogItemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  catalogItemPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 12,
  },
  catalogCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catalogCheckmark: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  pickupContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  pickupSection: {
    marginTop: 24,
  },
  pickupLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  pickupValue: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  pickupValueCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickupInfoBanner: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  pickupInfoText: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  pickupEmptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingVertical: 80,
  },
  pickupEmptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  pickupEmptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  pickupEmptyDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 32,
  },
  pickupSetupButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  pickupSetupButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  sendPickupButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 32,
    marginBottom: 20,
    minHeight: 52,
  },
  sendPickupButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  quickRepliesOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
  },
  quickRepliesKeyboardAvoid: {
    justifyContent: 'flex-end' as const,
  },
  quickRepliesContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '70%',
    maxHeight: '80%',
  },
  quickRepliesHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  quickRepliesHeaderLeft: {
    width: 50,
  },
  quickRepliesTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    flex: 1,
  },
  quickRepliesEditButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quickRepliesEditText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  quickRepliesList: {
    maxHeight: 400,
  },
  quickRepliesEmptyContainer: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  quickRepliesEmpty: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  quickRepliesEmptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  quickReplyItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  quickReplyShortcut: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  quickReplyMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  profileHeaderLeft: {
    width: 40,
  },
  profileTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  profileCloseButton: {
    padding: 8,
  },
  profileContent: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  profileAvatarSection: {
    alignItems: 'center' as const,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  profileAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  profileAvatarLargeText: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  profileCustomerName: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  profileSummaryCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
  },
  profileSummaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  profileSummaryItem: {
    flex: 1,
    alignItems: 'center' as const,
  },
  profileSummaryLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    fontWeight: '500' as const,
  },
  profileSummaryValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  profileSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  profileSection: {
    marginBottom: 24,
  },
  profileSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  profileSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  seeAllText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
    paddingHorizontal: 20,
  },
  repeatBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  repeatBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  orderHistoryCard: {
    backgroundColor: Colors.surface,
    marginBottom: 8,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  orderHistoryMain: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  orderHistoryLeft: {
    flex: 1,
  },
  orderHistoryId: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  orderHistoryDate: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  orderHistoryRight: {
    alignItems: 'flex-end' as const,
  },
  orderHistoryAmount: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  orderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.border,
  },
  orderStatusBadgeCompleted: {
    backgroundColor: Colors.charcoal,
  },
  orderStatusBadgeAccepted: {
    backgroundColor: Colors.charcoal,
  },
  orderStatusBadgeInProgress: {
    backgroundColor: Colors.charcoal,
  },
  orderStatusBadgeCancelled: {
    backgroundColor: Colors.charcoal,
  },
  orderStatusBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  orderStatusBadgeTextCompleted: {
    color: Colors.success,
  },
  orderStatusBadgeTextAccepted: {
    color: Colors.primary,
  },
  orderStatusBadgeTextInProgress: {
    color: Colors.primary,
  },
  orderStatusBadgeTextCancelled: {
    color: Colors.error,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    paddingVertical: 32,
    paddingHorizontal: 20,
  },

  notesCardContainer: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginHorizontal: 20,
    borderRadius: 16,
  },
  notesCard: {
    minHeight: 80,
    justifyContent: 'center' as const,
  },
  notesCardText: {
    fontSize: 17,
    color: Colors.text,
    lineHeight: 24,
  },
  notesCardPlaceholder: {
    color: Colors.textSecondary,
  },
  notesHelperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  profileActionsSection: {
    backgroundColor: Colors.surface,
    paddingTop: 8,
    paddingBottom: 16,
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 16,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  actionButtonText: {
    fontSize: 17,
    color: Colors.error,
    fontWeight: '400' as const,
  },
  notesModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notesModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  notesModalHeaderButton: {
    padding: 8,
  },
  notesModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 56,
  },
  notesModalCancel: {
    fontSize: 16,
    color: Colors.text,
  },
  notesModalSave: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  notesModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  notesModalInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: Colors.text,
    textAlignVertical: 'top' as const,
    minHeight: 200,
  },
  customOrderPreviewCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    maxWidth: '85%',
    width: '100%',
  },
  customOrderPreviewContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  customOrderPreviewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
    marginRight: 12,
  },
  customOrderPreviewImagePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.cardBorder,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  customOrderPreviewImagePlaceholderText: {
    fontSize: 28,
  },
  customOrderPreviewInfo: {
    flex: 1,
  },
  customOrderPreviewTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  customOrderPreviewItems: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  customOrderPreviewTotal: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  customOrderPreviewButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  customOrderPreviewButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  customOrderPreviewTimestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  customerSinceText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 12,
    paddingHorizontal: 16,
  },
  catalogItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    maxWidth: '90%',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catalogItemCardLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  catalogItemCardContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  catalogItemCardImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden' as const,
  },
  catalogItemCardImage: {
    width: 56,
    height: 56,
  },
  catalogItemCardImagePlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: Colors.border,
    borderRadius: 8,
  },
  catalogItemCardInfo: {
    flex: 1,
  },
  catalogItemCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  catalogItemCardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  catalogItemCardPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogItemCardButton: {
    paddingVertical: 10,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  catalogItemCardButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  catalogItemCardTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
  },
  orderSelectionContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  orderSelectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginVertical: 16,
  },
  orderSelectionItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderSelectionItemContent: {},
  orderSelectionOrderId: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  orderSelectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  orderSelectionDate: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  orderSelectionStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.cardBorder,
  },
  orderSelectionStatusPillAccepted: {
    backgroundColor: Colors.surface,
  },
  orderSelectionStatusPillInProgress: {
    backgroundColor: Colors.warningLight,
  },
  orderSelectionStatusPillReady: {
    backgroundColor: Colors.surface,
  },
  orderSelectionStatusPillCompleted: {
    backgroundColor: Colors.successLight,
  },
  orderSelectionStatusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  orderSelectionStatusTextAccepted: {
    color: Colors.primary,
  },
  orderSelectionStatusTextInProgress: {
    color: Colors.primary,
  },
  orderSelectionStatusTextReady: {
    color: Colors.primary,
  },
  orderSelectionStatusTextCompleted: {
    color: Colors.success,
  },
  orderSelectionTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sendInvoiceButtonColor: '#FFFFFF',
  sendInvoiceButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  sendInvoiceButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  pinnedOrderStatusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginLeft: 18,
    marginTop: 2,
  },
  pinnedPaymentPendingBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  pinnedPaymentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  pinnedPaymentPendingText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  pinnedOrderStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  pinnedOrderStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  existingPaymentContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  existingPaymentStatusCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFF7ED',
    borderRadius: 12,
    padding: 14,
    marginTop: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  existingPaymentStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  existingPaymentStatusText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#92400E',
  },
  existingPaymentAmountCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: 'center' as const,
  },
  existingPaymentAmountLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
  },
  existingPaymentAmountValue: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  existingPaymentMethodText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  existingPaymentDetailCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  existingPaymentDetailTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  existingPaymentDetailRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  existingPaymentDetailLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  existingPaymentDetailValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  existingPaymentNoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
  },
  existingPaymentNoteLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  existingPaymentNoteText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    fontStyle: 'italic' as const,
  },
  existingPaymentActions: {
    marginTop: 24,
    gap: 10,
  },
  existingPaymentResendButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  existingPaymentResendText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  existingPaymentCopyButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.white,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    gap: 8,
  },
  existingPaymentCopyText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  existingPaymentDuplicateNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginTop: 20,
    marginBottom: 40,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  validationErrorContainer: {
    backgroundColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  validationErrorText: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  paymentVerificationBanner: {
    backgroundColor: '#FFFBEB',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  paymentVerificationContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 10,
  },
  paymentVerificationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  paymentVerificationText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#92400E',
    flex: 1,
  },
  paymentVerificationActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  paymentRejectButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.error,
    gap: 5,
  },
  paymentRejectButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  paymentConfirmButton: {
    flex: 2,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.success,
    gap: 5,
  },
  paymentConfirmButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  paymentConfirmedBanner: {
    backgroundColor: Colors.successLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.successBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  paymentConfirmedContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  paymentConfirmedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  markInProgressChatButton: {
    backgroundColor: '#0D9488',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  markInProgressChatButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  paymentRejectedBanner: {
    backgroundColor: Colors.errorLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.errorBorder,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  paymentRejectedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  changeAcceptedBanner: {
    backgroundColor: Colors.successLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.successBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  changeAcceptedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  changeDeclinedBanner: {
    backgroundColor: Colors.errorLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.errorBorder,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  changeDeclinedText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  paymentStatusBlock: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  paymentStatusBlockLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400E',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  paymentStatusBlockRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 8,
  },
  paymentStatusBlockValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#78350F',
    flex: 1,
  },
  viewProofLink: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noProofText: {
    fontSize: 13,
    color: '#92400E',
    fontStyle: 'italic' as const,
  },
  paymentInstructionsBannerRow: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendPaymentInstructionsButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
  },
  sendPaymentInstructionsButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  waitingForPaymentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingVertical: 4,
  },
  waitingForPaymentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  waitingForPaymentText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  proofContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  proofItem: {
    marginVertical: 12,
    alignItems: 'center' as const,
  },
  proofImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  proofFileCard: {
    width: '100%',
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofFileName: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  proofTimestamp: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  proofEmptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 80,
  },
  proofEmptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
});
