import { useState, useRef, useEffect, useMemo } from 'react';
import { ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getChatByOrderId, ContactCardData, ReplyToData, ChatMessage } from '@/mocks/chatData';
import { mockOrders } from '@/mocks/ordersData';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useVendorCustomerNotes } from '@/contexts/VendorCustomerNotesContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { useCustomOrders } from '@/contexts/CustomOrderContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendorDrafts } from '@/contexts/VendorDraftContext';
import { useInbox } from '@/contexts/InboxContext';
import { getChatAvailability } from '@/utils/chatAvailability';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { Colors } from '@/constants/colors';
import {
  getCustomerFirstName,
  getInitials,
  shouldShowPinnedCard,
  getExistingPaymentRequest,
} from '@/features/chat/selectors/chatSelectors';
import { sendVendorChatMessage } from '@/features/chat/actions/chatActions';

const STABLE_COLORS = [
  Colors.primary,
  Colors.textSecondary,
  Colors.charcoal,
  '#9CA3AF',
  Colors.text,
  '#6B7280',
  '#2B2B2B',
  Colors.primary,
] as const;

const getStableColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STABLE_COLORS[Math.abs(hash) % STABLE_COLORS.length];
};

export type QuickReply = {
  id: string;
  shortcut: string;
  message: string;
};

export type SystemActionMessage = {
  id: string;
  content: string;
};

export const useVendorOrderChat = (orderId: string) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [messageText, setMessageText] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showSecureContactModal, setShowSecureContactModal] = useState<boolean>(false);
  const [secureContactData, setSecureContactData] = useState<ContactCardData | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState<boolean>(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState<boolean>(false);
  const [customerNoteText, setCustomerNoteText] = useState<string>('');
  const [showNotesModal, setShowNotesModal] = useState<boolean>(false);
  const [tempNoteText, setTempNoteText] = useState<string>('');
  const [showCatalogModal, setShowCatalogModal] = useState<boolean>(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<string[]>([]);
  const [showPickupModal, setShowPickupModal] = useState<boolean>(false);
  const [editingPickup, setEditingPickup] = useState<boolean>(false);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [pickupInstructions, setPickupInstructions] = useState<string>('');
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState<boolean>(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showOrderSelectionModal, setShowOrderSelectionModal] = useState<boolean>(false);
  const [documentType, setDocumentType] = useState<'invoice' | 'receipt' | null>(null);

  const [systemActionMessages, setSystemActionMessages] = useState<SystemActionMessage[]>([]);
  const [showExistingPaymentModal, setShowExistingPaymentModal] = useState<boolean>(false);
  const [replyTo, setReplyTo] = useState<ReplyToData | null>(null);

  const { blockUser, getBlockedUserByChatId } = useBlockedUsers();
  const { getNote, getNoteWithMeta, saveNote } = useVendorCustomerNotes();
  const { items: catalogItems, categories } = useCatalog();
  const { pickupDetails, isLoaded: isPickupLoaded } = useVendorPickup();
  const { proposals } = useCustomOrders();
  const { plan } = useVendorPlan();
  const { getDraft, saveDraft, clearDraft } = useVendorDrafts();
  const { vendorInbox, updateInboxAfterMessage } = useInbox();

  const chat = getChatByOrderId(orderId);
  const order = mockOrders.find((o) => o.id === orderId);
  const isCompleted = order?.status === 'completed';
  const isRejected = false;

  const chatId = `chat-order-${orderId}`;
  const blockedUser = getBlockedUserByChatId(chatId);
  const isBlocked = !!blockedUser;
  const customerId = `customer-${orderId}`;
  const vendorId = order?.vendorId || 'v1';

  const chatAvailability = getChatAvailability(
    order?.status || 'requested',
    order?.completedAt
  );

  const activeOrders = useMemo(() => {
    if (!order || !order.customerId) return [];
    const filtered = mockOrders
      .filter(
        (o) =>
          o.customerId === order.customerId &&
          o.vendorId === order.vendorId &&
          (o.status === 'accepted' || o.status === 'confirmed' || o.status === 'in_progress')
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 5);
    console.log('🔍 VENDOR CHAT - Pinned Active Orders:', filtered.length);
    return filtered;
  }, [order]);

  const pinnedOrders = useMemo(() => {
    if (!order?.customerId || !order?.vendorId) return [];
    const all = mockOrders
      .filter(
        (o) =>
          o.customerId === order.customerId &&
          o.vendorId === order.vendorId &&
          shouldShowPinnedCard(o)
      )
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())
      .slice(0, 5);
    console.log('[VENDOR CHAT] pinnedOrders count:', all.length);
    return all;
  }, [order]);

  const existingPaymentRequest = useMemo(() => {
    if (!chat?.messages) return null;
    return getExistingPaymentRequest(chat.messages);
  }, [chat?.messages]);

  const chatProposal = proposals.find((p) => p.chatId === chatId && p.state === 'PROPOSAL_SENT');

  const customerDisplayName = order
    ? formatCustomerNameFromFull(order.customerName || 'Customer')
    : 'Customer';
  const customerFirstName = getCustomerFirstName(order?.customerName);
  const customerInitials = order?.customerName ? getInitials(order.customerName) : 'C';
  const customerAvatarColor = order?.customerName
    ? getStableColor(order.customerName)
    : Colors.textSecondary;

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
      }, 100) as unknown as void;
    }
  }, [chat?.messages]);

  useEffect(() => {
    if (showCustomerProfile && order) {
      const note = getNote(vendorId, customerId);
      setCustomerNoteText(note);
    }
  }, [showCustomerProfile, vendorId, customerId, order, getNote]);

  const customerNoteMeta = useMemo(() => {
    return getNoteWithMeta(vendorId, customerId);
  }, [getNoteWithMeta, vendorId, customerId]);

  useEffect(() => {
    void loadQuickReplies();
  }, []);

  useEffect(() => {
    if (showQuickRepliesModal) {
      void loadQuickReplies();
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

  const handleSwipeToReply = (message: ChatMessage) => {
    setReplyTo({
      messageId: message.id,
      content: message.content,
      sender: message.sender,
    });
    console.log('[VENDOR CHAT] Reply to message:', message.id);
  };

  const handleCancelReply = () => {
    setReplyTo(null);
  };

  const handleSendMessage = () => {
    sendVendorChatMessage({
      messageText,
      chatId,
      orderId,
      clearDraft,
      updateInboxAfterMessage,
      vendorInbox,
      replyTo: replyTo ?? undefined,
      onSuccess: () => {
        setMessageText('');
        setReplyTo(null);
      },
      onValidationError: (error) => {
        setValidationError(error);
        setTimeout(() => setValidationError(null), 4000);
      },
    });
  };

  const handleMessageTextChange = (text: string) => {
    setMessageText(text);
    void saveDraft(chatId, text);
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

  const handleOpenNotesModal = () => {
    setTempNoteText(customerNoteText);
    setShowNotesModal(true);
  };

  const getCustomerOrderHistory = () => {
    if (!order) return [];
    return mockOrders.filter(
      (o) => o.customerName === order.customerName && o.vendorId === vendorId
    );
  };

  const getCompletedOrdersCount = () =>
    getCustomerOrderHistory().filter((o) => o.status === 'completed').length;

  const getLastOrderDate = () => {
    const sorted = getCustomerOrderHistory().sort(
      (a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()
    );
    return sorted[0]?.orderDate || null;
  };

  const getCustomerSinceDate = () => {
    const completed = getCustomerOrderHistory()
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    return completed[0]?.orderDate || null;
  };

  const headerSubtitle = useMemo(() => {
    const activeCount = activeOrders?.length ?? 0;
    if (activeCount > 0) {
      return `${activeCount} active ${activeCount === 1 ? 'order' : 'orders'}`;
    }
    if (chat && chat.messages && chat.messages.length > 0) {
      return 'Inquiry';
    }
    return 'No orders yet';
  }, [activeOrders, chat]);

  const trustIndicators = useMemo(() => {
    if (!order) return { orderLabel: 'No orders yet', joinedLabel: '', completedCount: 0 };
    const history = mockOrders.filter(
      (o) => o.customerName === order.customerName && o.vendorId === vendorId
    );
    const completedCount = history.filter((o) => o.status === 'completed').length;
    let orderLabel = '';
    if (completedCount === 0) {
      orderLabel = 'No orders yet';
    } else if (completedCount === 1) {
      orderLabel = '1 successful order';
    } else if (completedCount <= 10) {
      orderLabel = `${completedCount} successful orders`;
    } else {
      orderLabel = '10+ successful orders';
    }

    const completed = history
      .filter((o) => o.status === 'completed')
      .sort((a, b) => new Date(a.orderDate).getTime() - new Date(b.orderDate).getTime());
    const sinceDate = completed[0]?.orderDate || null;
    let joinedLabel = '';
    if (sinceDate) {
      const d = new Date(sinceDate);
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      joinedLabel = `Joined ${month} ${year}`;
    }

    return { orderLabel, joinedLabel, completedCount };
  }, [order, vendorId]);


  return {
    scrollViewRef,
    messageText,
    setMessageText,
    validationError,
    showSecureContactModal,
    setShowSecureContactModal,
    secureContactData,
    setSecureContactData,
    showActionsMenu,
    setShowActionsMenu,
    showCustomerProfile,
    setShowCustomerProfile,
    customerNoteText,
    showNotesModal,
    setShowNotesModal,
    tempNoteText,
    setTempNoteText,
    showCatalogModal,
    setShowCatalogModal,
    selectedCatalogItems,
    setSelectedCatalogItems,
    showPickupModal,
    setShowPickupModal,
    editingPickup,
    setEditingPickup,
    pickupAddress,
    setPickupAddress,
    pickupInstructions,
    setPickupInstructions,
    showQuickRepliesModal,
    setShowQuickRepliesModal,
    quickReplies,
    showOrderSelectionModal,
    setShowOrderSelectionModal,
    documentType,
    setDocumentType,

    systemActionMessages,
    setSystemActionMessages,
    showExistingPaymentModal,
    setShowExistingPaymentModal,
    chat,
    order,
    isCompleted,
    isRejected,
    chatId,
    isBlocked,
    customerId,
    vendorId,
    chatAvailability,
    activeOrders,
    pinnedOrders,
    existingPaymentRequest,
    chatProposal,
    customerDisplayName,
    customerFirstName,
    customerInitials,
    customerAvatarColor,
    catalogItems,
    categories,
    pickupDetails,
    plan,
    proposals,
    handleSendMessage,
    handleMessageTextChange,
    handleSaveNote,
    handleCancelNote,
    handleOpenNotesModal,
    getCustomerOrderHistory,
    getCompletedOrdersCount,
    getLastOrderDate,
    getCustomerSinceDate,
    blockUser,
    trustIndicators,
    headerSubtitle,
    customerNoteMeta,
    replyTo,
    handleSwipeToReply,
    handleCancelReply,
  };
};
