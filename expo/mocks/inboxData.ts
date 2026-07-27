import type { ChatType } from '@/mocks/chatData';

export type ConversationType = 'inquiry' | 'order' | 'custom_order' | 'support' | 'ai' | 'creator';
export type MessageStatus = 'sent' | 'delivered' | 'read';

export type OrderStatusType = 'requested' | 'accepted' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'rejected' | 'expired';

export interface InboxSnapshot {
  conversationId: string;
  /**
   * Real chat thread id (matches `Chat.id` in mockChats / chatService).
   * When present, InboxContext will subscribe to chatService writes for this id
   * and derive lastMessageText / lastMessageAt from the chat's messages.
   * When undefined, the inbox row falls back to its seeded lastMessage fields.
   */
  chatId?: string;
  conversationType: ConversationType;
  /** Canonical chat-thread vocabulary (pre_order_inquiry | order_chat). */
  chatType?: ChatType;
  vendorId: string;
  customerId: string;
  orderId?: string;
  orderStatus?: OrderStatusType;
  title: string;
  avatarUrl?: string;
  lastMessageText: string;
  lastMessageAt: string;
  unreadCount: number;
  lastSenderId: string;
  orderType?: 'pickup' | 'delivery';
  publicOrderId?: string;
  /** Backend-ready: vendor public slug (e.g. 'spicyrest') for display in chat list/header subtitle */
  vendorSlug?: string;
  /** Backend-ready: vendor public ID (e.g. 'SPICYREST-VENDOR') */
  vendorPublicId?: string;
  /** Backend-ready: customer public ID (e.g. 'STEPHA-28475832') for vendor-side chat list/header subtitle */
  customerPublicId?: string;
}

export const MOCK_CUSTOMER_ID = 'customer-001';
export const MOCK_VENDOR_ID = 'v1';

export const mockCustomerInbox: InboxSnapshot[] = [
  {
    conversationId: 'chat-v1-customer-001',
    chatId: 'chat-v1-customer-001',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'customer-001',
    orderId: 'ord1',
    title: 'Spicy Restaurant',
    lastMessageText: 'Perfect, thank you!',
    lastMessageAt: '2024-01-15T10:47:00Z',
    unreadCount: 0,
    lastSenderId: 'customer-001',
    orderType: 'pickup',
    publicOrderId: 'SPICYREST-17364741',
    vendorSlug: 'spicyrest',
    vendorPublicId: 'SPICYREST',
  },
  {
    conversationId: 'preorder-v2-customer-001',
    chatId: 'chat-v2-customer-001',
    chatType: 'pre_order_inquiry',
    conversationType: 'inquiry',
    vendorId: 'v2',
    customerId: 'customer-001',
    title: 'Style Lounge',
    lastMessageText: 'Yes we do! Send us the date and we\'ll prepare a quote.',
    lastMessageAt: '2024-01-17T10:05:00Z',
    unreadCount: 1,
    lastSenderId: 'v2',
    vendorSlug: 'stylelounge',
    vendorPublicId: 'STYLELOUNGE',
  },
  {
    conversationId: 'order-fresh-customer-001',
    chatId: 'chat-v3-customer-001',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v3',
    customerId: 'customer-001',
    orderId: 'ord2',
    title: 'Fresh Bites Kitchen',
    lastMessageText: 'Your order is ready for pickup!',
    lastMessageAt: '2024-01-14T13:20:00Z',
    unreadCount: 2,
    lastSenderId: 'v3',
    orderType: 'pickup',
    publicOrderId: 'FRESHBITES-28475832',
    vendorSlug: 'freshbites',
    vendorPublicId: 'FRESHBITES',
  },
  {
    conversationId: 'preorder-gadgets-customer-001',
    chatId: 'chat-v4-customer-001',
    chatType: 'pre_order_inquiry',
    conversationType: 'inquiry',
    vendorId: 'v4',
    customerId: 'customer-001',
    title: 'Tech Gadgets Hub',
    lastMessageText: 'We have the latest model in stock. When do you plan to visit?',
    lastMessageAt: '2024-01-13T11:45:00Z',
    unreadCount: 1,
    lastSenderId: 'v4',
    vendorSlug: 'techgadgets',
    vendorPublicId: 'TECHGADGETS',
  },
  {
    conversationId: 'custom-v6-customer-001',
    chatId: 'chat-v6-customer-001',
    chatType: 'pre_order_inquiry',
    conversationType: 'custom_order',
    vendorId: 'v6',
    customerId: 'customer-001',
    title: 'Artisan Bakery',
    lastMessageText: 'We can do that! Let me prepare a quote for you.',
    lastMessageAt: '2024-01-13T08:15:00Z',
    unreadCount: 1,
    lastSenderId: 'v6',
    vendorSlug: 'artisanbakery',
    vendorPublicId: 'ARTISANBAKERY',
  },
  {
    conversationId: 'order-cakes-customer-001',
    chatId: 'chat-v5-customer-001',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v5',
    customerId: 'customer-001',
    orderId: 'ord3',
    title: 'Elegant Cakes',
    lastMessageText: 'You: Can you add a birthday message on the cake?',
    lastMessageAt: '2024-01-12T09:30:00Z',
    unreadCount: 0,
    lastSenderId: 'customer-001',
    orderType: 'delivery',
    publicOrderId: 'ELEGCAKES-39586923',
    vendorSlug: 'elegantcakes',
    vendorPublicId: 'ELEGCAKES',
  },
];

export const mockVendorInbox: InboxSnapshot[] = [
  {
    // chat-v1-c1 messages are pre-order Q&A (no order_context / no order events),
    // and the old orderId 'ord-c1-1' was an orphan whose publicOrderId duplicated ord1.
    // Reclassified as a pre_order_inquiry; orderId/publicOrderId/orderStatus/orderType removed.
    conversationId: 'chat-v1-c1',
    chatId: 'chat-v1-c1',
    chatType: 'pre_order_inquiry',
    conversationType: 'inquiry',
    vendorId: 'v1',
    customerId: 'c1',
    title: 'Stephanie A.',
    lastMessageText: 'Yes we do! Send us the date and we\'ll prepare a quote.',
    lastMessageAt: '2024-01-17T10:05:00Z',
    unreadCount: 1,
    lastSenderId: 'v1',
    customerPublicId: 'STEPHA-17364741',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-c2',
    chatId: 'chat-v1-c2',
    chatType: 'pre_order_inquiry',
    conversationType: 'inquiry',
    vendorId: 'v1',
    customerId: 'c2',
    title: 'Amaka O.',
    lastMessageText: 'What are your opening hours on Sunday?',
    lastMessageAt: '2024-01-15T16:20:00Z',
    unreadCount: 1,
    lastSenderId: 'c2',
    customerPublicId: 'AMAKA-22841093',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-c3',
    chatId: 'chat-v1-c3',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'c3',
    orderId: 'ord-c3-1',
    orderStatus: 'in_progress',
    title: 'Michael B.',
    lastMessageText: 'Yes, will include extra napkins',
    lastMessageAt: '2024-01-15T09:23:00Z',
    unreadCount: 0,
    lastSenderId: 'v1',
    orderType: 'delivery',
    publicOrderId: 'SPICYREST-28475833',
    customerPublicId: 'MICHAEL-28475833',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-c6',
    chatId: 'chat-v1-c6',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'c6',
    orderId: 'ord-c6-1',
    orderStatus: 'completed',
    title: 'Emma W.',
    lastMessageText: 'Order completed',
    lastMessageAt: '2024-01-05T12:30:00Z',
    unreadCount: 0,
    lastSenderId: 'v1',
    orderType: 'pickup',
    publicOrderId: 'SPICYREST-50607080',
    customerPublicId: 'EMMA-50607080',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-c4',
    chatId: 'chat-v1-c4',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'c4',
    orderId: 'ord-c4-1',
    orderStatus: 'accepted',
    title: 'Sarah J.',
    lastMessageText: 'Please make sure the burgers are well done',
    lastMessageAt: '2024-01-14T14:21:00Z',
    unreadCount: 1,
    lastSenderId: 'c4',
    orderType: 'pickup',
    publicOrderId: 'SPICYREST-39586923',
    customerPublicId: 'SARAH-39586923',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-customer-001',
    chatId: 'chat-v1-customer-001',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'customer-001',
    orderId: 'ord1',
    orderStatus: 'accepted',
    title: 'Jane S.',
    lastMessageText: 'Perfect, thank you!',
    lastMessageAt: '2024-01-13T10:47:00Z',
    unreadCount: 0,
    lastSenderId: 'customer-001',
    orderType: 'pickup',
    publicOrderId: 'SPICYREST-17364741',
    customerPublicId: 'JANE-17364741',
    vendorSlug: 'spicyrest',
  },
  {
    conversationId: 'chat-v1-c5',
    chatId: 'chat-v1-c5',
    chatType: 'order_chat',
    conversationType: 'order',
    vendorId: 'v1',
    customerId: 'c5',
    orderId: 'ord-c5-1',
    orderStatus: 'completed',
    title: 'David L.',
    lastMessageText: 'Order completed',
    lastMessageAt: '2024-01-10T12:45:00Z',
    unreadCount: 0,
    lastSenderId: 'v1',
    orderType: 'delivery',
    publicOrderId: 'SPICYREST-51709145',
    customerPublicId: 'DAVID-51709145',
    vendorSlug: 'spicyrest',
  },
];
