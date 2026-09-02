import type { OrderChangeRequest } from '@/types/orderChanges';

export type MessageType = 'text' | 'system' | 'payment-request' | 'contact-card' | 'pickup-details' | 'catalog_item' | 'receipt' | 'invoice' | 'ai' | 'order_context' | 'new_inquiry' | 'change_request';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export interface ContactCardData {
  label?: string;
  // sendChatMessage.ts (backend) writes fullName/phoneNumber into
  // messages/{id}.contactCardData — that's the shape a message actually
  // round-trips through Firestore with. name/phone/note are kept for the
  // local-only optimistic echo built at send time from the device's saved
  // ContactCard (ContactCardsContext), which uses those field names. Render
  // call sites should prefer fullName/phoneNumber and fall back to name/phone.
  name?: string;
  phone?: string;
  fullName?: string;
  phoneNumber?: string;
  address: string;
  note?: string;
}

export interface PaymentRequestData {
  amount: number;
  paymentMethod: string;
  paymentType?: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  message?: string;
  isPartialPayment?: boolean;
  remainingBalance?: number;
  status?: 'requested' | 'partial_received' | 'confirmed';
}

export interface PickupDetailsData {
  address: string;
  instructions?: string;
  contactPhone?: string;
  verificationCode?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

export interface CatalogItemData {
  id?: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
}

export interface ReceiptData {
  receiptId: string;
  amountPaid: number;
}

export interface InvoiceData {
  invoiceId: string;
  amountDue: number;
  paymentStatus?: 'unpaid' | 'partially_paid' | 'paid';
  currency?: string;
  itemCount?: number;
  customerName?: string;
  vendorName?: string;
  /** Display number, e.g. INV-000123 */
  invoiceNumber?: string;
  /** Unguessable public share code for theplatform.app/i/{shareCode} */
  shareCode?: string;
  /** Snapshot of the invoice status at send time */
  status?: string;
}

export interface ReplyToData {
  messageId: string;
  content: string;
  sender: 'customer' | 'vendor' | 'system' | 'ai';
}

export interface OrderContextData {
  orderId: string;
  publicOrderId?: string;
  orderStatus: string;
  orderType: 'pickup' | 'delivery';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  type: MessageType;
  content: string;
  sender: 'customer' | 'vendor' | 'system' | 'ai';
  timestamp: string;
  contactCardData?: ContactCardData;
  paymentRequestData?: PaymentRequestData;
  pickupDetailsData?: PickupDetailsData;
  catalogItemData?: CatalogItemData;
  receiptData?: ReceiptData;
  invoiceData?: InvoiceData;
  orderContextData?: OrderContextData;
  changeRequestData?: OrderChangeRequest;
  replyTo?: ReplyToData;
  visible_to_user?: boolean;
  status?: MessageStatus;
}

/**
 * Canonical chat thread vocabulary.
 *
 * Backend-aligned conversation kinds:
 * - `pre_order_inquiry`: customer/vendor pre-order conversation (no committed order yet)
 * - `order_chat`: conversation tied to an accepted/active order
 * - `ai_help`: in-app AI assistant conversation
 * - `support`: conversation with the platform support
 *
 * Legacy values (`'pre-order'`, `'order'`, `'inquiry'`, `'PREORDER_CHAT'`,
 * `'ORDER_CHAT'`, `'ai'`) are still emitted by some upstream code paths and
 * persisted mock fixtures elsewhere — funnel them through {@link normalizeChatType}
 * at the boundary instead of branching on the raw string.
 */
export type ChatType = 'pre_order_inquiry' | 'order_chat' | 'ai_help' | 'support';

/** Legacy chat-type aliases produced by older code paths / push payloads. */
export type LegacyChatType =
  | 'pre-order'
  | 'order'
  | 'inquiry'
  | 'PREORDER_CHAT'
  | 'ORDER_CHAT'
  | 'ai'
  | 'ai-help'
  | 'help';

/**
 * Map any legacy chatType string to its canonical form.
 * Unknown values fall back to `'pre_order_inquiry'` so UI never crashes.
 */
export function normalizeChatType(value: ChatType | LegacyChatType | string | undefined | null): ChatType {
  switch (value) {
    case 'order_chat':
    case 'order':
    case 'ORDER_CHAT':
      return 'order_chat';
    case 'ai_help':
    case 'ai':
    case 'ai-help':
    case 'help':
      return 'ai_help';
    case 'support':
      return 'support';
    case 'pre_order_inquiry':
    case 'pre-order':
    case 'inquiry':
    case 'PREORDER_CHAT':
      return 'pre_order_inquiry';
    default:
      return 'pre_order_inquiry';
  }
}

/** Convenience: canonical → legacy push-channel value. */
export function toPushChatType(value: ChatType | LegacyChatType | string | undefined | null): 'PREORDER_CHAT' | 'ORDER_CHAT' {
  return normalizeChatType(value) === 'order_chat' ? 'ORDER_CHAT' : 'PREORDER_CHAT';
}

export interface Chat {
  id: string;
  vendorId: string;
  vendorName: string;
  customerName?: string;
  customerId?: string;
  /** Order this chat thread belongs to (order_chat only). Backend-ready. */
  orderId?: string;
  chatType: ChatType;
  messages: ChatMessage[];
  createdAt: string;
  lastActivityAt: string;
  vendorCanReply: boolean;
  vendorDisabledReason?: string;
  lastAwayMessageSentAt?: string;
}

export const mockChats: Chat[] = [
  {
    id: 'chat-v1-c1',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Stephanie Adeyemi',
    customerId: 'c1',
    chatType: 'order_chat',
    messages: [
      {
        id: 'mp1-1',
        type: 'text',
        content: 'Hi, do you have any vegetarian options available?',
        sender: 'customer',
        timestamp: '2024-01-16T09:45:00Z',
      },
      {
        id: 'mp1-2',
        type: 'text',
        content: 'Yes! We have several vegetarian dishes including our grilled vegetable platter and veggie burger.',
        sender: 'vendor',
        timestamp: '2024-01-16T09:48:00Z',
      },
      {
        id: 'pq1-1',
        type: 'text',
        content: 'Hi, do you cater for events? I need catering for 50 people.',
        sender: 'customer',
        timestamp: '2024-01-17T10:00:00Z',
      },
      {
        id: 'pq1-2',
        type: 'text',
        content: 'Yes we do! Send us the date and we\'ll prepare a quote.',
        sender: 'vendor',
        timestamp: '2024-01-17T10:05:00Z',
      },
    ],
    createdAt: '2024-01-16T09:45:00Z',
    lastActivityAt: '2024-01-17T10:05:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v1-c2',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Amaka Okonkwo',
    customerId: 'c2',
    chatType: 'order_chat',
    messages: [
      {
        id: 'mp2-1',
        type: 'text',
        content: 'What are your opening hours on Sunday?',
        sender: 'customer',
        timestamp: '2024-01-15T16:20:00Z',
      },
    ],
    createdAt: '2024-01-15T16:20:00Z',
    lastActivityAt: '2024-01-15T16:20:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v1-customer-001',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'order_chat',
    messages: [
      {
        id: 'm1-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-15T10:30:00Z',
      },
      {
        id: 'm1-oc',
        type: 'order_context',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-15T10:34:30Z',
        orderContextData: {
          orderId: 'ord1',
          publicOrderId: 'SPICYREST-17364741',
          orderStatus: 'completed',
          orderType: 'pickup',
          createdAt: '2024-01-15T10:30:00Z',
        },
      },
      {
        id: 'm1-2',
        type: 'system',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-15T10:35:00Z',
      },
      {
        id: 'm1-3',
        type: 'payment-request',
        content: 'Payment request sent',
        sender: 'system',
        timestamp: '2024-01-15T10:36:00Z',
        paymentRequestData: {
          amount: 5160,
          paymentMethod: 'Bank Transfer',
          paymentType: 'Primary',
          accountName: 'Spicy Restaurant Ltd',
          accountNumber: '1234567890',
          bankName: 'First Bank of Nigeria',
          status: 'requested',
        },
      },
      {
        id: 'm1-4',
        type: 'system',
        content: 'Payment confirmed',
        sender: 'system',
        timestamp: '2024-01-15T10:45:00Z',
      },
      {
        id: 'm1-cr-sys',
        type: 'system',
        content: 'Spicy Restaurant requested changes to your order.',
        sender: 'system',
        timestamp: '2024-01-15T10:44:00Z',
      },
      {
        id: 'm1-cr',
        type: 'change_request',
        content: 'Vendor requested changes',
        sender: 'vendor',
        timestamp: '2024-01-15T10:44:01Z',
        changeRequestData: {
          orderId: 'ord1',
          vendorId: 'v1',
          changes: [
            {
              itemId: '6',
              name: 'Puff Puff',
              originalQty: 2,
              newQty: 1,
              removed: false,
              originalPrice: 2000,
              newPrice: 2000,
            },
            {
              itemId: '5',
              name: 'Spring Rolls',
              originalQty: 1,
              newQty: 0,
              removed: true,
              originalPrice: 300,
              newPrice: 300,
            },
          ],
          oldTotal: 5160,
          newTotal: 2500,
          reason: 'Spring Rolls out of stock',
          status: 'pending',
          createdAt: '2024-01-15T10:44:00Z',
        },
      },
      {
        id: 'm1-5',
        type: 'text',
        content: 'Your order will be ready at 11:00 AM',
        sender: 'vendor',
        timestamp: '2024-01-15T10:46:00Z',
      },
      {
        id: 'm1-6',
        type: 'text',
        content: 'Perfect, thank you!',
        sender: 'customer',
        timestamp: '2024-01-15T10:47:00Z',
      },
      // ---- Mock customer invoice flow (UI/mock-only) ----
      // Vendor sends invoice → customer receives invoice card in chat →
      // customer taps View Invoice → sees the full branded invoice.
      // Invoice numbers use the approved VENDORSLUG-INV-12345 format.
      {
        id: 'm1-inv-1',
        type: 'invoice',
        content: 'Invoice sent',
        sender: 'vendor',
        timestamp: '2026-07-01T09:20:30Z',
        invoiceData: {
          invoiceId: 'seed_invoice_overdue_001',
          invoiceNumber: 'SPICYREST-INV-12344',
          amountDue: 8600,
          paymentStatus: 'unpaid',
          currency: 'NGN',
          itemCount: 1,
          customerName: 'Jane S.',
          vendorName: 'Spicy Restaurant',
          shareCode: 'mn3v8k1q7w2x9j4p',
          status: 'sent_in_chat',
        },
      },
      {
        id: 'm1-inv-2',
        type: 'invoice',
        content: 'Invoice sent',
        sender: 'vendor',
        timestamp: '2026-07-05T14:10:30Z',
        invoiceData: {
          invoiceId: 'seed_invoice_paid_001',
          invoiceNumber: 'SPICYREST-INV-12343',
          amountDue: 8600,
          paymentStatus: 'paid',
          currency: 'NGN',
          itemCount: 2,
          customerName: 'Jane S.',
          vendorName: 'Spicy Restaurant',
          shareCode: 'pq2r6s8t0u4w5x7y',
          status: 'paid',
        },
      },
      {
        id: 'm1-inv-3',
        type: 'invoice',
        content: 'Invoice sent',
        sender: 'vendor',
        timestamp: '2026-07-15T10:42:30Z',
        invoiceData: {
          invoiceId: 'seed_invoice_unpaid_001',
          invoiceNumber: 'SPICYREST-INV-12345',
          amountDue: 12500,
          paymentStatus: 'unpaid',
          currency: 'NGN',
          itemCount: 3,
          customerName: 'Jane S.',
          vendorName: 'Spicy Restaurant',
          shareCode: 'kx7m2n9p4q8r3t6v',
          status: 'sent_in_chat',
        },
      },
    ],
    createdAt: '2024-01-15T10:30:00Z',
    lastActivityAt: '2026-07-15T10:42:30Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v1-c3',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Michael Brown',
    customerId: 'c3',
    chatType: 'order_chat',
    messages: [
      {
        id: 'm2-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-15T09:15:00Z',
      },
      {
        id: 'm2-oc',
        type: 'order_context',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-15T09:19:30Z',
        orderContextData: {
          orderId: 'ord-c3-1',
          publicOrderId: 'SPICYREST-28475833',
          orderStatus: 'accepted',
          orderType: 'delivery',
          createdAt: '2024-01-15T09:15:00Z',
        },
      },
      {
        id: 'm2-2',
        type: 'system',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-15T09:20:00Z',
      },
      {
        id: 'm2-3',
        type: 'text',
        content: 'Can you include extra napkins?',
        sender: 'customer',
        timestamp: '2024-01-15T09:22:00Z',
      },
      {
        id: 'm2-4',
        type: 'text',
        content: 'Yes, will include extra napkins',
        sender: 'vendor',
        timestamp: '2024-01-15T09:23:00Z',
      },
    ],
    createdAt: '2024-01-15T09:15:00Z',
    lastActivityAt: '2024-01-15T09:23:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v1-c4',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Sarah Johnson',
    customerId: 'c4',
    chatType: 'order_chat',
    messages: [
      {
        id: 'm3-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-14T14:20:00Z',
      },
      {
        id: 'm3-2',
        type: 'text',
        content: 'Please make sure the burgers are well done',
        sender: 'customer',
        timestamp: '2024-01-14T14:21:00Z',
      },
    ],
    createdAt: '2024-01-14T14:20:00Z',
    lastActivityAt: '2024-01-14T14:21:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v1-c5',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'David Lee',
    customerId: 'c5',
    chatType: 'order_chat',
    messages: [
      {
        id: 'm4-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-10T12:00:00Z',
      },
      {
        id: 'm4-2',
        type: 'system',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-10T12:05:00Z',
      },
      {
        id: 'm4-3',
        type: 'payment-request',
        content: 'Payment request sent',
        sender: 'system',
        timestamp: '2024-01-10T12:06:00Z',
        paymentRequestData: {
          amount: 4337.5,
          paymentMethod: 'Bank Transfer',
          paymentType: 'Primary',
          accountName: 'Spicy Restaurant Ltd',
          accountNumber: '1234567890',
          bankName: 'First Bank of Nigeria',
          status: 'confirmed',
        },
      },
      {
        id: 'm4-4',
        type: 'system',
        content: 'Payment confirmed',
        sender: 'system',
        timestamp: '2024-01-10T12:15:00Z',
      },
      {
        id: 'm4-5',
        type: 'contact-card',
        content: 'Contact details shared',
        sender: 'customer',
        timestamp: '2024-01-10T12:16:00Z',
        contactCardData: {
          name: 'Mike Johnson',
          phone: '+234 802 345 6789',
          address: '123 Main St, Lagos',
        },
      },
      {
        id: 'm4-6',
        type: 'system',
        content: 'Order completed',
        sender: 'system',
        timestamp: '2024-01-10T12:45:00Z',
      },
    ],
    createdAt: '2024-01-10T12:00:00Z',
    lastActivityAt: '2024-01-10T12:45:00Z',
    vendorCanReply: false,
    vendorDisabledReason: 'Order completed',
  },
  {
    id: 'chat-v1-c6',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Emma Wilson',
    customerId: 'c6',
    orderId: 'ord-c6-1',
    chatType: 'order_chat',
    messages: [
      {
        id: 'm5-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-05T11:30:00Z',
      },
      {
        id: 'm5-2',
        type: 'system',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-05T11:33:00Z',
      },
      {
        id: 'm5-3',
        type: 'payment-request',
        content: 'Payment request sent',
        sender: 'system',
        timestamp: '2024-01-05T11:34:00Z',
        paymentRequestData: {
          amount: 3225,
          paymentMethod: 'Bank Transfer',
          paymentType: 'Secondary',
          accountName: 'Spicy Restaurant Ltd',
          accountNumber: '0987654321',
          bankName: 'GTBank',
          status: 'confirmed',
        },
      },
      {
        id: 'm5-4',
        type: 'system',
        content: 'Payment confirmed',
        sender: 'system',
        timestamp: '2024-01-05T11:40:00Z',
      },
      {
        id: 'm5-5',
        type: 'system',
        content: 'Order completed',
        sender: 'system',
        timestamp: '2024-01-05T12:30:00Z',
      },
    ],
    createdAt: '2024-01-05T11:30:00Z',
    lastActivityAt: '2024-01-05T12:30:00Z',
    vendorCanReply: false,
    vendorDisabledReason: 'Order completed',
  },

  {
    id: 'preorder-v2-c1',
    vendorId: 'v2',
    vendorName: 'Style Lounge',
    customerName: 'Stephanie Adeyemi',
    customerId: 'c1',
    chatType: 'pre_order_inquiry',
    messages: [
      {
        id: 'pq2-1',
        type: 'text',
        content: 'Do you make custom dresses? I need something for a wedding.',
        sender: 'customer',
        timestamp: '2024-01-16T14:30:00Z',
      },
    ],
    createdAt: '2024-01-16T14:30:00Z',
    lastActivityAt: '2024-01-16T14:30:00Z',
    vendorCanReply: true,
  },

  // ---- customer-001 inbox threads (seeded to match mockCustomerInbox rows) ----
  {
    id: 'chat-v2-customer-001',
    vendorId: 'v2',
    vendorName: 'Style Lounge',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'pre_order_inquiry',
    messages: [
      {
        id: 'pv2c001-1',
        type: 'text',
        content: 'Hi, do you cater for events? I need styling for 50 people.',
        sender: 'customer',
        timestamp: '2024-01-17T10:00:00Z',
      },
      {
        id: 'pv2c001-2',
        type: 'text',
        content: 'Yes we do! Send us the date and we\'ll prepare a quote.',
        sender: 'vendor',
        timestamp: '2024-01-17T10:05:00Z',
      },
    ],
    createdAt: '2024-01-17T10:00:00Z',
    lastActivityAt: '2024-01-17T10:05:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v3-customer-001',
    vendorId: 'v3',
    vendorName: 'Fresh Bites Kitchen',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'order_chat',
    messages: [
      {
        id: 'ofbc001-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-14T13:00:00Z',
      },
      {
        id: 'ofbc001-oc',
        type: 'order_context',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-14T13:05:00Z',
        orderContextData: {
          orderId: 'ord2',
          publicOrderId: 'FRESHBITES-28475832',
          orderStatus: 'in_progress',
          orderType: 'pickup',
          createdAt: '2024-01-14T13:00:00Z',
        },
      },
      {
        id: 'ofbc001-2',
        type: 'text',
        content: 'Your order is ready for pickup!',
        sender: 'vendor',
        timestamp: '2024-01-14T13:20:00Z',
      },
    ],
    createdAt: '2024-01-14T13:00:00Z',
    lastActivityAt: '2024-01-14T13:20:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v4-customer-001',
    vendorId: 'v4',
    vendorName: 'Tech Gadgets Hub',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'pre_order_inquiry',
    messages: [
      {
        id: 'pv4c001-1',
        type: 'text',
        content: 'Do you have the latest model in stock?',
        sender: 'customer',
        timestamp: '2024-01-13T11:40:00Z',
      },
      {
        id: 'pv4c001-2',
        type: 'text',
        content: 'We have the latest model in stock. When do you plan to visit?',
        sender: 'vendor',
        timestamp: '2024-01-13T11:45:00Z',
      },
    ],
    createdAt: '2024-01-13T11:40:00Z',
    lastActivityAt: '2024-01-13T11:45:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v6-customer-001',
    vendorId: 'v6',
    vendorName: 'Artisan Bakery',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'pre_order_inquiry',
    messages: [
      {
        id: 'cv6c001-1',
        type: 'text',
        content: 'Can you make a custom 3-tier cake for my anniversary?',
        sender: 'customer',
        timestamp: '2024-01-13T08:10:00Z',
      },
      {
        id: 'cv6c001-2',
        type: 'text',
        content: 'We can do that! Let me prepare a quote for you.',
        sender: 'vendor',
        timestamp: '2024-01-13T08:15:00Z',
      },
    ],
    createdAt: '2024-01-13T08:10:00Z',
    lastActivityAt: '2024-01-13T08:15:00Z',
    vendorCanReply: true,
  },
  {
    id: 'chat-v5-customer-001',
    vendorId: 'v5',
    vendorName: 'Elegant Cakes',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    chatType: 'order_chat',
    messages: [
      {
        id: 'oecc001-1',
        type: 'system',
        content: 'Order request sent',
        sender: 'system',
        timestamp: '2024-01-12T09:00:00Z',
      },
      {
        id: 'oecc001-oc',
        type: 'order_context',
        content: 'Order accepted',
        sender: 'system',
        timestamp: '2024-01-12T09:05:00Z',
        orderContextData: {
          orderId: 'ord3',
          publicOrderId: 'ELEGCAKES-39586923',
          orderStatus: 'completed',
          orderType: 'delivery',
          createdAt: '2024-01-12T09:00:00Z',
        },
      },
      {
        id: 'oecc001-2',
        type: 'text',
        content: 'Can you add a birthday message on the cake?',
        sender: 'customer',
        timestamp: '2024-01-12T09:30:00Z',
      },
    ],
    createdAt: '2024-01-12T09:00:00Z',
    lastActivityAt: '2024-01-12T09:30:00Z',
    vendorCanReply: true,
  },
];

export const getChatByVendorId = (
  vendorId: string,
  chatType: ChatType | LegacyChatType = 'pre_order_inquiry',
  customerId?: string,
): Chat | undefined => {
  const target = normalizeChatType(chatType);
  return mockChats.find(
    c =>
      c.vendorId === vendorId &&
      normalizeChatType(c.chatType) === target &&
      (customerId ? c.customerId === customerId : true),
  );
};

export const getAllVendorChats = (): Chat[] => {
  return mockChats;
};

export const getChatByPair = (vendorId: string, customerId: string): Chat | undefined => {
  return mockChats.find(c => c.vendorId === vendorId && c.customerId === customerId);
};

/**
 * Look up the pre-order inquiry chat for a (vendor, customer) pair.
 * Returns undefined if none exists so callers can decide whether to create one.
 */
export const getPreOrderChat = (
  vendorId: string,
  customerId: string,
): Chat | undefined => {
  if (!vendorId || !customerId) return undefined;
  return mockChats.find(
    c =>
      c.vendorId === vendorId &&
      c.customerId === customerId &&
      normalizeChatType(c.chatType) === 'pre_order_inquiry',
  );
};

/**
 * Resolve the order chat thread that owns a given orderId.
 *
 * Lookup order:
 *  1. Chat whose messages include an `order_context` message with matching orderId.
 *  2. Chat whose messages include a `change_request` whose `changeRequestData.orderId` matches.
 *
 * Both real order chats (via convertToOrderChat / the backend's mapChatDoc,
 * which both stamp orderContextData onto the message) and seeded mock chats
 * carry this, so these two checks are sufficient. A third fallback used to
 * look the order up in mockOrders and match a chat by (vendorId, customerId)
 * — real orders never appear in mockOrders, so for a real order that
 * fallback either matched nothing or, worse, matched an unrelated chat that
 * happened to share the same vendor+customer pair. Removed rather than
 * pointed at a real order source, since paths 1 and 2 already cover every
 * real order chat.
 *
 * Returns undefined when no matching chat exists so the UI can render an empty state
 * instead of an unrelated chat.
 */
export const getChatByOrderId = (orderId: string): Chat | undefined => {
  if (!orderId) return undefined;

  const byOrderContext = mockChats.find(c =>
    c.messages.some(m => m.orderContextData?.orderId === orderId),
  );
  if (byOrderContext) return byOrderContext;

  const byChangeRequest = mockChats.find(c =>
    c.messages.some(m => m.changeRequestData?.orderId === orderId),
  );
  if (byChangeRequest) return byChangeRequest;

  return undefined;
};
