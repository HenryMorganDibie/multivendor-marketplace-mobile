import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { getAvatarColor } from '@/utils/avatarColor';
import DiscardChangesModal from '@/components/DiscardChangesModal';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, Send, Plus, ArrowUp, User, X, Award, ShoppingBag, DollarSign, MapPin, MessageSquare, ClipboardList, FileText, Receipt, Copy, Package, ChevronRight, Check, AlertCircle, Search, Pencil, Flag, Star, Images, ChevronUp, ChevronDown } from 'lucide-react-native';
import { PaymentRequestCard } from '@/components/PaymentRequestCard';
import type { ChatMessage, ContactCardData } from '@/mocks/chatData';
import { getChatByOrderId } from '@/mocks/chatData';

import { collection, onSnapshot, orderBy, limit as firestoreLimit, query } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useOrders } from '@/contexts/OrdersContext';
import { useChats } from '@/contexts/ChatContext';
import { chatService } from '@/services/chatService';
import { useVendor } from '@/contexts/VendorContext';
import { useChangeRequests } from '@/contexts/ChangeRequestsContext';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useVendorCustomerNotes } from '@/contexts/VendorCustomerNotesContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useCustomOrders } from '@/contexts/CustomOrderContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useInvoices, getInvoiceStatusDisplayLabel } from '@/contexts/InvoiceContext';
import type { InvoiceStatus } from '@/contexts/InvoiceContext';
import { useVendorDrafts } from '@/contexts/VendorDraftContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';

import * as Clipboard from 'expo-clipboard';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { getChatAvailability } from '@/utils/chatAvailability';
import { CHAT_BANNERS, CHAT_INPUT_PLACEHOLDERS } from '@/constants/chatStrings';
import { useSecureContactView } from '@/hooks/useSecureContactView';
import { validateChatMessage } from '@/utils/chatValidation';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';


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
  const { isBlurred: isSecureContactBlurred } = useSecureContactView(showSecureContactModal);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  // In-chat search state
  const [searchActive, setSearchActive] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState<number>(0);
  const messagePositionsRef = useRef<Record<string, number>>({});
  const searchInputRef = useRef<TextInput>(null);
  const [customerNoteText, setCustomerNoteText] = useState('');
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [showDiscardNoteModal, setShowDiscardNoteModal] = useState(false);
  const [tempNoteText, setTempNoteText] = useState('');
  const insets = useSafeAreaInsets();
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<string[]>([]);
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
  const changeAcceptedMsgRef = useRef(false);
  const customerPaidMsgRef = useRef(false);
  const { blockUser, getBlockedUserByChatId, archiveChat } = useBlockedUsers();
  const { getNote, saveNote } = useVendorCustomerNotes();
  const { items: catalogItems, categories } = useCatalog();
  const { proposals } = useCustomOrders();
  const { plan } = useVendorPlan();
  const { getInvoiceById: getInvoiceRecordById } = useInvoices();
  const { getDraft, saveDraft, clearDraft } = useVendorDrafts();
  const { vendorInbox, updateInboxAfterMessage } = useInbox();

  const { orders, getOrder, vendorConfirmPayment, vendorMarkNotPaid, updateOrderStatus } = useOrders();
  // Real conversations and the signed-in vendor. This screen resolved its chat
  // from the fixture store and its orders from the mock array, so a real vendor
  // opened somebody else's conversation about somebody else's order.
  const { chats } = useChats();
  const { vendor } = useVendor();
  const { requests: changeRequests } = useChangeRequests();

  // Real commerce threads never set a scalar `orderId` (only the backend's
  // relatedOrderIds[] array, via injectOrderContext), so `c.orderId ===
  // orderId` silently matched nothing for every real order — a vendor
  // opened an empty/wrong chat. getChatByOrderId resolves the same
  // hydrated chat store via the real `order_context` message every order
  // gets injected with, the same working path app/chat/[vendorId].tsx and
  // app/chat/order/[orderId].tsx already use.
  const chat = getChatByOrderId(orderId as string) ?? chats.find((c) => c.id === (orderId as string));
  const orderFromContext = getOrder(orderId as string);
  const order = orderFromContext || orders.find(o => o.id === orderId);
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

  // The real payment proof (image storagePaths, proofId) lives in a
  // Firestore subcollection, not on the order doc, so it isn't part of the
  // mapOrderDoc shape above. Confirm/Reject need the real proofId to call
  // reviewPaymentProof, and "View proof" needs real download URLs — both
  // resolved here. Demo orders have no such subcollection, so this just
  // stays null and every screen below falls back to the existing mock
  // order.paymentProof array, unchanged.
  const [realProof, setRealProof] = useState<{
    proofId: string;
    status: string;
    notes: string | null;
    images: { storagePath: string; url: string }[];
  } | null>(null);

  useEffect(() => {
    if (!orderId) {
      setRealProof(null);
      return;
    }
    const q = query(
      collection(db, 'orders', orderId as string, 'paymentProofs'),
      orderBy('createdAt', 'desc'),
      firestoreLimit(1)
    );
    const unsubscribe = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        setRealProof(null);
        return;
      }
      const doc = snap.docs[0];
      const data = doc.data() as { proofId: string; status: string; notes?: string | null; images?: { storagePath: string }[] };
      const images = await Promise.all(
        (data.images ?? []).map(async (img) => {
          try {
            const url = await getDownloadURL(ref(storage, img.storagePath));
            return { storagePath: img.storagePath, url };
          } catch (err) {
            console.error('[VendorOrderChat] Failed to resolve proof image URL:', err);
            return { storagePath: img.storagePath, url: '' };
          }
        })
      );
      setRealProof({ proofId: data.proofId ?? doc.id, status: data.status, notes: data.notes ?? null, images });
    }, (err) => {
      console.error('[VendorOrderChat] paymentProofs listener failed:', err);
      setRealProof(null);
    });
    return unsubscribe;
  }, [orderId]);

  const chatAvailability = getChatAvailability(
    order?.status || 'requested',
    order?.completedAt
  );

  const activeOrders = useMemo(() => {
    if (!order || !order.customerId) return [];
    const filtered = orders.filter(
      (o) => 
        o.customerId === order.customerId && 
        o.vendorId === order.vendorId && 
        (o.status === 'accepted' || o.status === 'confirmed' || o.status === 'in_progress')
    ).sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
    .slice(0, 5);

    return filtered;
  }, [order]);

  const pinnedOrders = useMemo(() => {
    if (!order?.customerId || !order?.vendorId) return [];
    const all = orders
      .filter(o =>
        o.customerId === order.customerId &&
        o.vendorId === order.vendorId &&
        shouldShowPinnedCard(o)
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 5);
    return all;
  }, [order]);

  const chatId = chat?.id ?? '';
  const blockedUser = chatId ? getBlockedUserByChatId(chatId) : undefined;
  const isBlocked = !!blockedUser;
  const { markChatAsRead } = useChatRead();

  /**
   * Clear unread for vendor when this chat opens. markChatAsRead is a local
   * store update only — it never reached the server, so read state never
   * crossed devices or was visible to the customer. markRead is the real
   * markChatRead callable, which also flips the other party's messages to
   * status: "read" server-side.
   */
  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId, 'vendor');
    void chatService.markRead(chatId);
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

  // The real management screen (vendor/settings/quick-replies.tsx) reads/writes
  // vendors/{vendorId}/quickReplies via real callables — this screen's picker
  // read a global AsyncStorage key nothing ever wrote to, so it was always
  // empty regardless of what a vendor had actually saved.
  useEffect(() => {
    const vendorIdForReplies = vendor?.id;
    if (!vendorIdForReplies) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'vendors', vendorIdForReplies, 'quickReplies'), orderBy('sortOrder', 'asc')),
      (snap) => {
        setQuickReplies(
          snap.docs.map((d) => {
            const data = d.data();
            const shortcutRaw = String(data.shortcut ?? '');
            return {
              id: d.id,
              shortcut: shortcutRaw.startsWith('/') ? shortcutRaw.slice(1) : shortcutRaw,
              message: (data.message as string) ?? '',
            };
          })
        );
      },
      (err) => console.error('[VendorOrderChat] quickReplies subscription failed:', err)
    );
    return unsubscribe;
  }, [vendor?.id]);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const customerDisplayName = order ? formatCustomerNameFromFull(order.customerName || 'Customer') : 'Customer';
  const customerFirstName = getCustomerFirstName(order?.customerName);
  const customerInitials = order?.customerName ? getInitials(order.customerName) : 'C';
  // Use customerId as the stable key so the same customer always shows the same color.
  // Fall back to customerName only when there is no ID (legacy orders).
  const customerAvatarColor = getAvatarColor(order?.customerId ?? order?.customerName);

  const handleBack = () => {
    try {
      router.back();
    } catch {
      router.replace('/vendor/(tabs)/chats' as any);
    }
  };

  if (!chat || !order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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

  const handleSendMessage = async () => {
    if (messageText.trim()) {
      const messageContent = messageText.trim();

      const validation = validateChatMessage(messageContent);
      if (!validation.isValid) {
        setValidationError(validation.errorMessage || 'Invalid message');
        setTimeout(() => setValidationError(null), 4000);
        return;
      }

      clearDraft(chatId);
      setMessageText('');

      try {
        await chatService.sendMessage({
          chatId,
          type: 'text',
          content: messageContent,
          sender: 'vendor',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not send message.';
        Alert.alert('Could not send', message);
        return;
      }

      const orderIdStr = orderId as string;
      const conv = vendorInbox.find(item => item.orderId === orderIdStr);
      if (conv) {
        updateInboxAfterMessage({
          conversationId: conv.conversationId,
          lastMessageText: messageContent,
          lastSenderId: vendor.id,
          senderRole: 'vendor',
        });
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
    const newProposalId = `proposal-${Date.now()}`;
    const proposalChatId = chatId;
    const proposalVendorId = order?.vendorId || chat?.vendorId || '';
    const vendorSlug = vendor.username;
    const formattedCustomerName = formatCustomerNameFromFull(order?.customerName || 'Customer');
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
    Alert.alert(
      'Payment Request Resent',
      'The payment request has been resent to the customer.',
      [{ text: 'OK' }]
    );
  };

  const handleCopyPaymentInstructions = async () => {
    if (!existingPaymentRequest?.paymentRequestData) return;
    const pd = existingPaymentRequest.paymentRequestData;
    let instructions = `Amount: ${formatPriceWithCommas(pd.amount, (vendor.currency as Currency) || 'NGN')}\nMethod: ${pd.paymentMethod}`;
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

  const handleSendCatalogItems = async () => {
    const itemsToSend = catalogItems.filter(item => selectedCatalogItems.includes(item.id));
    setShowCatalogModal(false);
    setSelectedCatalogItems([]);

    // Like pickup details below, this used to close the modal without
    // sending anything — the selection was simply discarded.
    try {
      for (const item of itemsToSend) {
        await chatService.sendMessage({
          chatId,
          type: 'catalog_item',
          content: item.name,
          sender: 'vendor',
          catalogItemData: {
            id: item.id,
            name: item.name,
            description: item.description || undefined,
            price: item.salePrice || item.basePrice,
            image: item.photos[0] || undefined,
          },
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not send catalog items.';
      Alert.alert('Could not send', message);
    }
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
          },
        },
      ]
    );
  };



  const handleOpenCustomerProfile = () => {
    setShowCustomerProfile(true);
  };

  // ── Search helpers ────────────────────────────────────────────────────────
  const messageMatchesQuery = useCallback((msg: ChatMessage, term: string): boolean => {
    if (msg.type !== 'text') return false;
    return msg.content.toLowerCase().includes(term.toLowerCase());
  }, []);

  const matchIds = useMemo<string[]>(() => {
    const term = searchQuery.trim();
    if (!term || !chat?.messages) return [];
    return chat.messages.filter((m) => messageMatchesQuery(m, term)).map((m) => m.id);
  }, [chat?.messages, searchQuery, messageMatchesQuery]);

  useEffect(() => {
    if (currentMatchIndex >= matchIds.length) {
      setCurrentMatchIndex(matchIds.length > 0 ? matchIds.length - 1 : 0);
    }
  }, [matchIds.length, currentMatchIndex]);

  useEffect(() => {
    if (!searchActive || matchIds.length === 0) return;
    const id = matchIds[currentMatchIndex];
    const y = id ? messagePositionsRef.current[id] : undefined;
    if (typeof y === 'number') {
      scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 40), animated: true });
    }
  }, [searchActive, currentMatchIndex, matchIds]);

  const closeSearch = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
    setCurrentMatchIndex(0);
  }, []);

  const goPrevMatch = useCallback(() => {
    if (matchIds.length === 0) return;
    setCurrentMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length);
  }, [matchIds.length]);

  const goNextMatch = useCallback(() => {
    if (matchIds.length === 0) return;
    setCurrentMatchIndex((i) => (i + 1) % matchIds.length);
  }, [matchIds.length]);

  const renderHighlightedText = (text: string, query: string): React.ReactNode => {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx === -1) return <Text>{text}</Text>;
    return (
      <Text>
        {text.slice(0, idx)}
        <Text style={styles.searchHighlight}>{text.slice(idx, idx + query.length)}</Text>
        {text.slice(idx + query.length)}
      </Text>
    );
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleOpenNotesModal = () => {
    setTempNoteText(customerNoteText);
    setShowCustomerProfile(false);
    setTimeout(() => {
      setShowNotesModal(true);
    }, 350);
  };

  const handleReturnToCustomerProfile = () => {
    setTimeout(() => {
      setShowCustomerProfile(true);
    }, 350);
  };

  const handleClearChat = () => {
    setShowCustomerProfile(false);
    setTimeout(() => {
      Alert.alert(
        'Clear chat',
        'This will hide the conversation from your inbox. Orders, receipts and payment history remain available.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear chat',
            style: 'destructive',
            onPress: () => {
              archiveChat(chatId, 'manual');
              router.back();
            },
          },
        ]
      );
    }, 350);
  };

  const handleSaveNote = () => {
    if (order) {
      const trimmed = tempNoteText.trimEnd();
      saveNote(vendorId, customerId, trimmed);
      setCustomerNoteText(trimmed);
      setTempNoteText(trimmed);
      setShowNotesModal(false);
      handleReturnToCustomerProfile();
    }
  };

  const handleCancelNote = () => {
    const hasChanges = tempNoteText !== customerNoteText;
    if (hasChanges) {
      setShowDiscardNoteModal(true);
    } else {
      setShowNotesModal(false);
      handleReturnToCustomerProfile();
    }
  };

  const handleDiscardNote = () => {
    setShowDiscardNoteModal(false);
    setTempNoteText(customerNoteText);
    setShowNotesModal(false);
    handleReturnToCustomerProfile();
  };

  const handleReportCustomer = () => {
    setShowCustomerProfile(false);
    setTimeout(() => {
      router.push(`/report-vendor?type=customer&name=${encodeURIComponent(customerDisplayName)}` as any);
    }, 300);
  };

  const getCustomerOrderHistory = () => {
    if (!order) return [];
    return orders.filter(
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

  const formatOrderStatus = (status: string): string => {
    switch (status) {
      case 'requested':       return 'Requested';
      case 'accepted':        return 'Accepted';
      case 'confirmed':       return 'Confirmed';
      case 'in_progress':     return 'In Progress';
      case 'completed':       return 'Completed';
      case 'cancelled':       return 'Cancelled';
      case 'rejected':        return 'Rejected';
      case 'expired':         return 'Expired';
      case 'ORDER_REQUESTED': return 'Requested';
      case 'CONFIRMED':       return 'Confirmed';
      case 'READY':           return 'Ready';
      case 'COMPLETED':       return 'Completed';
      case 'CANCELLED':       return 'Cancelled';
      default:                return status;
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

  const renderPinnedCard = (o: (typeof orders)[0], isScrollItem?: boolean) => {
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
        onPress={() => router.push(`/vendor/orders/${o.id}` as any)}
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
              {formatPriceWithCommas(o.total, (vendor.currency as Currency) || 'NGN')}
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
              <Text style={styles.customOrderPreviewTotal}>{formatPriceWithCommas(proposal.total, (vendor.currency as Currency) || 'NGN')}</Text>
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
                <Text style={styles.catalogItemCardPrice}>{formatPriceWithCommas(Number(displayPrice) || 0, (vendor.currency as Currency) || 'NGN')}</Text>
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
      // Live status from the invoice record when available; fall back to the message snapshot.
      const invoiceRecord = getInvoiceRecordById(data.invoiceId);
      const liveStatus: InvoiceStatus = invoiceRecord?.status ?? ((data.status as InvoiceStatus) || 'sent_in_chat');
      const invoiceNumberDisplay = invoiceRecord?.invoiceNumber ?? data.invoiceNumber ?? 'Invoice';
      const customerDisplayName = invoiceRecord?.customerName ?? data.customerName ?? 'Customer';
      const amountDisplay = formatPriceWithCommas(invoiceRecord?.total ?? data.amountDue, ((data.currency ?? vendor.currency) as Currency) || 'NGN');
      const statusLabel = getInvoiceStatusDisplayLabel(liveStatus);
      const statusColor = liveStatus === 'paid' ? Colors.success
        : liveStatus === 'cancelled' || liveStatus === 'expired' ? Colors.error
        : liveStatus === 'draft' ? Colors.textMuted
        : Colors.primary;

      // Vendor-facing: payment status + customer actions — no banking details repeated here.
      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.paymentRequestCard}>
            <Text style={styles.paymentRequestCardHeader}>📄 Invoice {invoiceNumberDisplay}</Text>

            <View style={styles.paymentRequestInfoSection}>
              <Text style={styles.paymentRequestInfoLabel}>Customer</Text>
              <Text style={styles.paymentRequestInfoValue}>{customerDisplayName}</Text>
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <Text style={styles.paymentRequestInfoLabel}>Total</Text>
              <Text style={styles.paymentRequestInfoValue}>{amountDisplay}</Text>
            </View>

            <View style={styles.paymentRequestInfoSection}>
              <Text style={styles.paymentRequestInfoLabel}>Status</Text>
              <Text style={[styles.paymentRequestInfoValue, { color: statusColor }]}>{statusLabel}</Text>
            </View>

            <TouchableOpacity
              style={styles.sendInvoiceButton}
              onPress={() => router.push(`/vendor/invoice/${data.invoiceId}` as any)}
              activeOpacity={0.7}
            >
              <FileText size={16} color={Colors.text} />
              <Text style={styles.sendInvoiceButtonText}>View Invoice</Text>
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
              <Text style={styles.paymentRequestInfoValue}>{formatPriceWithCommas(data.amountPaid, (vendor.currency as Currency) || 'NGN')}</Text>
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
    const isMatch = searchActive && searchQuery.trim().length > 0 && matchIds.includes(message.id);
    const isCurrent = isMatch && message.id === matchIds[currentMatchIndex];

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
              isCurrent && styles.searchCurrentMatchBubble,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {isMatch ? renderHighlightedText(message.content, searchQuery) : message.content}
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
      elements.push(
        <View key={msg.id} onLayout={(e) => { messagePositionsRef.current[msg.id] = e.nativeEvent.layout.y; }}>
          {renderMessage(msg, { isFirstInGroup: !isSameSenderAsPrev, isLastInGroup: !isSameSenderAsNext })}
        </View>
      );
    }
    return elements;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ 
        headerShown: false,
      }} />
      
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {searchActive ? (
          <View style={styles.searchHeader}>
            <View style={styles.searchHeaderRow}>
              <TouchableOpacity onPress={closeSearch} style={styles.backButton} hitSlop={10} accessibilityLabel="Close search">
                <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <View style={styles.searchInputWrap}>
                <Search size={16} color={Colors.textMuted} strokeWidth={1.8} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search messages"
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                    <X size={16} color={Colors.textMuted} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchMetaText}>
                {searchQuery.trim().length === 0
                  ? 'Type to search this conversation.'
                  : matchIds.length === 0
                  ? 'No messages found.'
                  : `${currentMatchIndex + 1} of ${matchIds.length}`}
              </Text>
              <View style={styles.searchNavBtns}>
                <TouchableOpacity
                  onPress={goPrevMatch}
                  disabled={matchIds.length === 0}
                  style={[styles.searchNavBtn, matchIds.length === 0 && styles.searchNavBtnDisabled]}
                  hitSlop={8}
                  accessibilityLabel="Previous match"
                >
                  <ChevronUp size={18} color={matchIds.length === 0 ? Colors.textMuted : Colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={goNextMatch}
                  disabled={matchIds.length === 0}
                  style={[styles.searchNavBtn, matchIds.length === 0 && styles.searchNavBtnDisabled]}
                  hitSlop={8}
                  accessibilityLabel="Next match"
                >
                  <ChevronDown size={18} color={matchIds.length === 0 ? Colors.textMuted : Colors.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
            {/* Reserved for future call/video actions. Intentionally empty. */}
            <View style={styles.headerActionsSlot} />
          </View>
        )}
      </SafeAreaView>

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
              {realProof && realProof.images.length > 0 ? (
                <TouchableOpacity onPress={() => setShowViewProofModal(true)} activeOpacity={0.7}>
                  <Text style={styles.viewProofLink}>View proof ({realProof.images.length})</Text>
                </TouchableOpacity>
              ) : order?.paymentProof && order.paymentProof.length > 0 ? (
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
                        const success = vendorMarkNotPaid(orderId as string, realProof?.proofId);
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
                        const success = vendorConfirmPayment(orderId as string, realProof?.proofId);
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
          <Text style={styles.blockedText}>
            {blockedUser?.direction === 'other' ? CHAT_BANNERS.blockedOther : CHAT_BANNERS.blockedSelf}
          </Text>
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
              <Text style={styles.blockedInfoText}>
                {blockedUser?.direction === 'other' ? CHAT_INPUT_PLACEHOLDERS.messagingUnavailable : CHAT_INPUT_PLACEHOLDERS.unblockToSend}
              </Text>
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
                            <Text style={styles.catalogItemPrice}>{formatPriceWithCommas(displayPrice, (vendor.currency as Currency) || 'NGN')}</Text>
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
        <View style={styles.cpOuter}>
          {/* Immersive banner — neutral charcoal gradient, avatar color stays on avatar only */}
          <View style={styles.cpBanner}>
            <LinearGradient
              colors={['#2C2C2E', '#1C1C1E']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.cpBannerScrim} />
            <SafeAreaView edges={['top']} style={styles.cpBannerTopBar} pointerEvents="box-none">
              <TouchableOpacity
                onPress={() => setShowCustomerProfile(false)}
                style={styles.cpBannerCloseBtn}
                hitSlop={10}
                accessibilityLabel="Close"
              >
                <X size={18} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </SafeAreaView>
          </View>

          <ScrollView
            style={styles.cpScroll}
            contentContainerStyle={[styles.cpScrollContent, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Avatar ring — overlaps banner */}
            <View style={styles.cpAvatarWrap}>
              <View style={[styles.cpAvatarCircle, { backgroundColor: customerAvatarColor }]}>
                <Text style={styles.cpAvatarText}>{customerInitials}</Text>
              </View>
            </View>

            {/* Identity body */}
            <View style={styles.cpIdentityBody}>
              <Text style={styles.cpCustomerName}>{customerDisplayName}</Text>
              {getCustomerSinceDate() ? (
                <Text style={styles.cpCustomerSince}>Customer since {formatDate(getCustomerSinceDate()!)}</Text>
              ) : null}
              {(() => {
                const cc = getCompletedOrdersCount();
                let label = 'New Customer'; let color = '#6B7280'; let bg = '#F9FAFB'; let border = '#E5E7EB';
                if (cc >= 10) { label = 'VIP Customer'; color = '#7C3AED'; bg = '#F5F3FF'; border = '#DDD6FE'; }
                else if (cc >= 5) { label = 'Loyal Customer'; color = '#D97706'; bg = '#FFFBEB'; border = '#FDE68A'; }
                else if (cc >= 2) { label = 'Repeat Customer'; color = '#2563EB'; bg = '#EFF6FF'; border = '#BFDBFE'; }
                return (
                  <View style={[styles.cpLoyaltyBadge, { backgroundColor: bg, borderColor: border }]}>
                    <Star size={11} color={color} strokeWidth={2} fill={color} />
                    <Text style={[styles.cpLoyaltyText, { color }]}>{label}</Text>
                  </View>
                );
              })()}
            </View>

            {/* Quick action tiles — Orders and Search only */}
            <View style={styles.cpQuickRow}>
              <CpTile
                icon={<ShoppingBag size={18} color={Colors.textSecondary} strokeWidth={1.8} />}
                label="Orders"
                onPress={() => {
                  setShowCustomerProfile(false);
                  setTimeout(() => {
                    router.push(`/vendor/customer-orders/${customerId}?customerName=${encodeURIComponent(customerDisplayName)}&vendorId=${vendorId}` as any);
                  }, 300);
                }}
              />
              <CpTile
                icon={<Search size={18} color={Colors.textSecondary} strokeWidth={1.8} />}
                label="Search"
                onPress={() => {
                  setShowCustomerProfile(false);
                  setTimeout(() => {
                    setSearchActive(true);
                    setTimeout(() => {
                      searchInputRef.current?.focus();
                    }, 200);
                  }, 350);
                }}
              />
            </View>

            {/* Notes row */}
            <Text style={styles.cpSectionLabel}>Notes</Text>
            <View style={styles.cpSection}>
              <TouchableOpacity style={styles.cpNotesRow} onPress={handleOpenNotesModal} activeOpacity={0.65}>
                <View style={styles.cpNotesIconWrap}>
                  <Pencil size={17} color={Colors.textSecondary} strokeWidth={1.8} />
                </View>
                <View style={styles.cpNotesTextWrap}>
                  {customerNoteText ? (
                    <Text style={styles.cpNotesPreview} numberOfLines={2}>{customerNoteText}</Text>
                  ) : (
                    <Text style={styles.cpNotesPlaceholder}>Add private notes about this customer</Text>
                  )}
                  <Text style={styles.cpNotesHint}>Only you can see this</Text>
                </View>
                <ChevronRight size={16} color={Colors.textMuted} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>

            {/* Recent Orders — inline preview, max 5, tap for details */}
            <Text style={styles.cpSectionLabel}>
              {'Recent Orders'}{getCustomerOrderHistory().length > 0 ? `  ·  ${getCustomerOrderHistory().length}` : ''}
            </Text>
            <View style={[styles.cpSection, { marginBottom: 6 }]}>
              {getCustomerOrderHistory().length === 0 ? (
                <View style={styles.cpEmptyHistory}>
                  <ShoppingBag size={28} color={Colors.textMuted} strokeWidth={1.5} />
                  <Text style={styles.cpEmptyHistoryText}>No orders yet</Text>
                </View>
              ) : (
                getCustomerOrderHistory().slice(0, 5).map((histOrder, idx, arr) => {
                  const s = histOrder.status;
                  let pillBg = Colors.surface; let pillColor = Colors.textSecondary;
                  if (s === 'completed') { pillBg = Colors.successLight; pillColor = Colors.success; }
                  else if (['in_progress','accepted','confirmed'].includes(s)) { pillBg = Colors.primarySoft; pillColor = Colors.primary; }
                  else if (['cancelled','rejected'].includes(s)) { pillBg = Colors.errorLight; pillColor = Colors.error; }
                  const fulfillment = histOrder.fulfillmentType === 'Delivery' ? 'Delivery' : 'Pickup';
                  return (
                    <TouchableOpacity
                      key={histOrder.id}
                      style={[styles.cpOrderRow, idx < arr.length - 1 && styles.cpOrderRowDivider]}
                      onPress={() => { setShowCustomerProfile(false); router.push(`/vendor/orders/${histOrder.id}` as any); }}
                      activeOpacity={0.65}
                    >
                      <View style={styles.cpOrderLeft}>
                        <Text style={styles.cpOrderId}>{formatVendorOrderId(histOrder.publicOrderId)}</Text>
                        <Text style={styles.cpOrderDate}>
                          {formatDate(histOrder.orderDate)}{' · '}{fulfillment}
                        </Text>
                      </View>
                      <View style={styles.cpOrderRight}>
                        <Text style={styles.cpOrderAmount}>
                          {formatPriceWithCommas(histOrder.total, (vendor.currency as Currency) || 'NGN')}
                        </Text>
                        <View style={[styles.cpStatusPill, { backgroundColor: pillBg }]}>
                          <Text style={[styles.cpStatusText, { color: pillColor }]}>{formatOrderStatus(s)}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
            {getCustomerOrderHistory().length > 5 && (
              <TouchableOpacity
                style={styles.cpSeeAllBtn}
                onPress={() => {
                  setShowCustomerProfile(false);
                  setTimeout(() => {
                    router.push(`/vendor/customer-orders/${customerId}?customerName=${encodeURIComponent(customerDisplayName)}&vendorId=${vendorId}` as any);
                  }, 300);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cpSeeAllText}>View All Orders</Text>
                <ChevronRight size={14} color={Colors.primary} strokeWidth={2} />
              </TouchableOpacity>
            )}

            {/* Media & Docs coming soon */}
            <Text style={styles.cpSectionLabel}>Media & Docs</Text>
            <View style={styles.cpSection}>
              <View style={styles.cpMediaComingSoonRow}>
                <View style={styles.cpMediaComingSoonIconWrap}>
                  <Images size={15} color={Colors.textMuted} strokeWidth={1.6} />
                </View>
                <View style={styles.cpMediaComingSoonText}>
                  <Text style={styles.cpMediaComingSoonLabel}>Photos & files</Text>
                  <Text style={styles.cpMediaComingSoonSubtitle}>Available soon</Text>
                </View>
              </View>
            </View>

            {/* Safety */}
            <Text style={styles.cpSectionLabel}>Safety</Text>
            <View style={styles.cpSection}>
              <TouchableOpacity
                style={[styles.cpSafetyRow, styles.cpRowDivider]}
                onPress={handleReportCustomer}
                activeOpacity={0.65}
              >
                <Text style={styles.cpSafetyLabel}>Report {customerDisplayName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cpSafetyRow, styles.cpRowDivider]}
                onPress={() => { setShowCustomerProfile(false); setTimeout(() => handleBlockCustomer(), 350); }}
                activeOpacity={0.65}
              >
                <Text style={[styles.cpSafetyLabel, styles.cpSafetyDestructive]}>Block {customerDisplayName}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cpSafetyRow}
                onPress={handleClearChat}
                activeOpacity={0.65}
              >
                <Text style={styles.cpSafetyLabel}>Clear chat</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cpFooterNote}>
              Orders, receipts and payment history remain available even after clearing chat.
            </Text>
          </ScrollView>
        </View>
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
              accessibilityLabel="Close contact details"
              accessibilityRole="button"
            >
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.secureModalContent}>
            <View style={styles.secureWarningBanner}>
              <Text style={styles.secureWarningText}>
                Contact details are available only while this order is active.
              </Text>
            </View>

            <View
              style={styles.secureContactCard}
              pointerEvents="none"
            >
              {secureContactData?.name && (
                <View style={styles.secureContactSection}>
                  <Text style={styles.secureContactLabel}>Full Name</Text>
                  <Text
                    style={styles.secureContactValue}
                    selectable={false}
                    accessibilityLabel="Customer full name"
                  >
                    {secureContactData.name}
                  </Text>
                </View>
              )}

              {secureContactData?.phone && (
                <View style={styles.secureContactSection}>
                  <Text style={styles.secureContactLabel}>Phone Number</Text>
                  <Text
                    style={styles.secureContactValue}
                    selectable={false}
                    accessibilityLabel="Customer phone number"
                  >
                    {secureContactData.phone}
                  </Text>
                </View>
              )}

              {secureContactData?.address && (
                <View style={styles.secureContactSection}>
                  <Text style={styles.secureContactLabel}>Address</Text>
                  <Text
                    style={styles.secureContactValue}
                    selectable={false}
                    accessibilityLabel="Customer address"
                  >
                    {secureContactData.address}
                  </Text>
                </View>
              )}

              {secureContactData?.note && (
                <View style={styles.secureContactSection}>
                  <Text style={styles.secureContactLabel}>Delivery / Pickup Note</Text>
                  <Text
                    style={[styles.secureContactValue, styles.secureContactValueMultiline]}
                    selectable={false}
                  >
                    {secureContactData.note}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.securePrivacyNotice}>
              <Text style={styles.securePrivacyText} selectable={false}>
                Privacy Notice
              </Text>
              <Text style={styles.securePrivacyDescription} selectable={false}>
                • Contact details are order-scoped and time-bound.{"\n"}
                • Access expires automatically when the order is completed.{"\n"}
                • Do not share, screenshot, or save this information externally.
              </Text>
            </View>
          </View>

          {isSecureContactBlurred && (
            <View style={styles.secureBlurOverlay} pointerEvents="none">
              <Text style={styles.secureBlurOverlayText}>the platform</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showNotesModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelNote}
      >
        <View style={[styles.notesModalContainer, { paddingBottom: insets.bottom }]}>
          {/* Header sits BELOW the status bar using explicit insets.top padding */}
          <View style={[styles.notesModalHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity
              onPress={handleCancelNote}
              style={styles.notesModalHeaderButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.notesModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.notesModalTitle}>Notes</Text>
            <TouchableOpacity
              onPress={handleSaveNote}
              style={styles.notesModalHeaderButton}
              disabled={tempNoteText === customerNoteText}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[
                styles.notesModalSave,
                tempNoteText === customerNoteText && styles.notesModalSaveDisabled,
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={0}
          >
            <ScrollView
              style={styles.notesModalContent}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 32 }}
            >
              <TextInput
                style={styles.notesModalInput}
                placeholder="Add notes about this customer"
                placeholderTextColor={Colors.textMuted}
                value={tempNoteText}
                onChangeText={setTempNoteText}
                multiline
                maxLength={500}
                autoFocus
                textAlignVertical="top"
              />
              <Text style={styles.notesModalHelperText}>Only you can see this information</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
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
                    {formatPriceWithCommas(existingPaymentRequest.paymentRequestData.amount, (vendor.currency as Currency) || 'NGN')}
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
                      {formatPriceWithCommas(orderItem.total, (vendor.currency as Currency) || 'NGN')}
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
            {realProof && realProof.images.length > 0 ? (
              realProof.images.map((img) => (
                <View key={img.storagePath} style={styles.proofItem}>
                  <Image
                    source={{ uri: img.url }}
                    style={styles.proofImage}
                    contentFit="contain"
                  />
                </View>
              ))
            ) : order?.paymentProof && order.paymentProof.length > 0 ? (
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
      <DiscardChangesModal
        visible={showDiscardNoteModal}
        onKeepEditing={() => setShowDiscardNoteModal(false)}
        onDiscard={handleDiscardNote}
        message="You have unsaved notes. If you leave now, your changes won't be saved."
      />
    </View>
  );
}

// ─── Customer Profile tile sub-component ────────────────────────────────────
function CpTile({
  icon,
  label,
  onPress,
  labelColor,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  labelColor?: string;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[cpTileStyle.wrap, disabled && cpTileStyle.wrapDisabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.65}
    >
      <View style={cpTileStyle.iconWrap}>{icon}</View>
      <Text
        style={[
          cpTileStyle.label,
          labelColor ? { color: labelColor } : undefined,
          disabled && cpTileStyle.labelDisabled,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {disabled && <Text style={cpTileStyle.comingSoon}>Soon</Text>}
    </TouchableOpacity>
  );
}

const cpTileStyle = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 5,
  },
  wrapDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  label: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
    textAlign: 'center' as const,
  },
  labelDisabled: {
    color: Colors.textMuted,
  },
  comingSoon: {
    fontSize: 9,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    letterSpacing: 0.2,
    textAlign: 'center' as const,
  },
});

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
  headerActionsSlot: {
    width: 40,
    height: 40,
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
    backgroundColor: '#F1F3F6',
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
    borderTopWidth: 8,
    borderTopColor: '#F1F3F6',
    borderLeftWidth: 8,
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
  secureContactCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 24,
  },
  secureBlurOverlay: {
    ...StyleSheet.absoluteFillObject as unknown as { top: number; right: number; bottom: number; left: number },
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secureBlurOverlayText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 1,
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
    alignItems: 'center' as const,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 7,
  },
  plusButton: {
    paddingBottom: 0,
  },
  plusCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F2F2F7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 5,
    minHeight: 40,
    justifyContent: 'center' as const,
  },
  input: {
    fontSize: 15.5,
    color: Colors.text,
    maxHeight: 96,
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
  // ── Customer Profile modal ─────────────────────────────────────────────────
  cpOuter: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  // ── Search styles ───────────────────────────────────────────────────────
  searchHeader: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  searchHeaderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingTop: 4,
    gap: 8,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  searchMetaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 6,
    paddingLeft: 40,
  },
  searchMetaText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
  },
  searchNavBtns: {
    flexDirection: 'row' as const,
    gap: 4,
  },
  searchNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  searchNavBtnDisabled: {
    opacity: 0.35,
  },
  searchHighlight: {
    backgroundColor: '#FFE066',
    color: '#1C1C1E',
    borderRadius: 3,
  },
  searchCurrentMatchBubble: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Banner (immersive header, matches vendor-info bannerWrap)
  cpBanner: {
    width: '100%' as const,
    height: 96,
    overflow: 'hidden' as const,
  },
  cpBannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  cpBannerTopBar: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    paddingHorizontal: 14,
  },
  cpBannerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cpScroll: {
    flex: 1,
  },
  cpScrollContent: {
    paddingBottom: 32,
  },
  cpAvatarWrap: {
    alignItems: 'center' as const,
    marginTop: -36,
    marginBottom: 4,
  },
  cpAvatarCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  cpAvatarText: {
    fontSize: 26,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  cpIdentityBody: {
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 3,
  },
  cpCustomerName: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
    marginBottom: 2,
  },
  cpCustomerId: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
  },
  cpCustomerSince: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  cpLoyaltyBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 6,
  },
  cpLoyaltyText: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  // Quick tiles — mirrors vendor-info quickRow
  cpQuickRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 8,
  },
  // Stats
  cpStatsCard: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.background,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 18,
    paddingHorizontal: 8,
    marginBottom: 20,
  },
  cpStatItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  cpStatValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.4,
  },
  cpStatLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  cpStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },
  // Section label — mirrors vendor-info sectionLabel spacing
  cpSectionLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
  },
  // Section card — mirrors vendor-info section card
  cpSection: {
    marginHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    marginBottom: 4,
  },
  // Notes row
  cpNotesRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  cpNotesIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cpNotesTextWrap: {
    flex: 1,
  },
  cpNotesPreview: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 19,
    marginBottom: 2,
  },
  cpNotesPlaceholder: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  cpNotesHint: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  // Order rows
  cpOrderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  cpOrderRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cpOrderLeft: {
    flex: 1,
  },
  cpOrderId: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  cpOrderDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cpOrderRight: {
    alignItems: 'flex-end' as const,
    gap: 5,
  },
  cpOrderAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  cpStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  cpStatusText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  cpEmptyHistory: {
    alignItems: 'center' as const,
    paddingVertical: 28,
    gap: 8,
  },
  cpEmptyHistoryText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  cpSeeAllBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  cpSeeAllText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  // Safety rows
  cpSafetyRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  cpRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cpSafetyLabel: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  cpSafetyDestructive: {
    color: Colors.error,
  },
  cpFooterNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 16,
    paddingHorizontal: 28,
    marginTop: 14,
  },
  // Media & Docs coming soon row
  cpMediaComingSoonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    opacity: 0.5,
  },
  cpMediaComingSoonIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cpMediaComingSoonText: {
    flex: 1,
  },
  cpMediaComingSoonLabel: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  cpMediaComingSoonSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  notesModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notesModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    // paddingTop is injected inline via insets.top
    paddingBottom: 14,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  notesModalHeaderButton: {
    paddingVertical: 6,
    minWidth: 64,
  },
  notesModalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    flex: 1,
  },
  notesModalCancel: {
    fontSize: 16,
    color: Colors.text,
  },
  notesModalSave: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'right' as const,
  },
  notesModalSaveDisabled: {
    color: Colors.textMuted,
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
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: 'top' as const,
    minHeight: 180,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
  },
  notesModalHelperText: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 4,
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
