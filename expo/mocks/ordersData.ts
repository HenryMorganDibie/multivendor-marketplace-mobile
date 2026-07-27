import { FulfillmentMethod } from '@/utils/orderStateTransitions';
import { PaymentState } from '@/constants/paymentStates';
import type { OrderStatus } from '@/constants/orderStatus';
export type { OrderStatus } from '@/constants/orderStatus';

export type DisplayStatus = 'Order Sent' | 'Accepted' | 'Confirmed' | 'In Progress' | 'Completed' | 'Rejected' | 'Cancelled' | 'Expired';

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  addOns?: {
    id: string;
    name: string;
    price: number;
  }[];
}

export type PaymentStatus = 'payment_pending' | 'partially_received' | 'payment_received';

/**
 * Where an order originated.
 * - `internal`: placed inside the the platform app by a customer.
 * - `external`: logged manually by the vendor (WhatsApp, Instagram, walk-in, etc.).
 *
 * The legacy value `'the platform'` is normalized to `'internal'` via
 * {@link normalizeOrderSource} at the data boundary.
 */
export type OrderSource = 'internal' | 'external';

/** Legacy order-source value still present in older persisted/mock data. */
export type LegacyOrderSource = 'the platform';

/** Normalize any order-source string to its canonical form. */
export function normalizeOrderSource(
  value: OrderSource | LegacyOrderSource | string | undefined | null,
): OrderSource {
  return value === 'external' ? 'external' : 'internal';
}

export type CompletionSource = 'vendor' | 'system';

export interface PaymentRecord {
  amount: number;
  timestamp: string;
}

export interface OrderPaymentDetails {
  paymentMethod: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  message?: string;
}

export type OrderEventType =
  | 'order_placed'
  | 'order_accepted'
  | 'order_rejected'
  | 'payment_confirmed'
  | 'receipt_generated'
  | 'order_in_progress'
  | 'order_completed'
  | 'order_cancelled'
  | 'order_expired'
  | 'ready'
  | 'dispatched'
  | 'service_started'
  | 'custom_update';

export interface OrderSnapshotItem {
  name: string;
  quantity: number;
  price_at_order: number;
  addOns?: {
    id: string;
    name: string;
    price: number;
  }[];
}

export interface OrderSnapshot {
  items: OrderSnapshotItem[];
  notes?: string;
  subtotal_at_order: number;
  currency: string;
  fulfillmentType: 'Pickup' | 'Delivery';
  scheduledDate?: string;
  scheduledTime?: string;
  createdAt: string;
}

export interface OrderEventActor {
  type: 'vendor' | 'customer' | 'system';
  name: string;
}

export interface OrderEvent {
  eventId?: string;
  eventType: OrderEventType;
  actor: OrderEventActor;
  timestamp: string;
  message?: string;
  receiptSnapshot?: OrderSnapshot;
}

export interface PaymentProof {
  id: string;
  uri: string;
  type: 'image' | 'pdf';
  uploadedAt: string;
}

export interface Order {
  id: string;
  publicOrderId: string;
  vendorId: string;
  vendorName: string;
  customerName?: string;
  customerId?: string;
  status: OrderStatus;
  orderDate: string;
  scheduledDate?: string;
  scheduledTime?: string;
  fulfillmentType: 'Pickup' | 'Delivery';
  fulfillmentMethod: FulfillmentMethod;
  deliveryPreference?: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency?: string;
  adjustedTotal?: number;
  amountPaid?: number;
  paymentStatus?: PaymentStatus;
  paymentHistory?: PaymentRecord[];
  amountReceived?: number;
  orderSource: OrderSource;
  externalReference?: string;
  orderNote?: string;
  vendorPolicy?: string;
  hasRating?: boolean;
  completedBy?: CompletionSource;
  completedAt?: string;
  systemCompletionReason?: string;
  hasDispute?: boolean;
  hasRefund?: boolean;
  remindersSent?: number;
  lastReminderAt?: string;
  paymentRequestsSent?: number;
  paymentState?: PaymentState;
  paymentDetails?: OrderPaymentDetails;
  cancellationReason?: string;
  cancellationReasonCode?: string;
  cancellationReasonText?: string;
  rejectionReason?: string;
  eventHistory?: OrderEvent[];
  orderSnapshot?: OrderSnapshot;
  customerMarkedPaidAt?: string;
  paymentProof?: PaymentProof[];
  vendorPaymentProofRequested?: boolean;
  vendorPaymentProofRequestedAt?: string;
}

export const getDisplayStatus = (status: OrderStatus): DisplayStatus => {
  switch (status) {
    case 'requested':
      return 'Order Sent';
    case 'accepted':
      return 'Accepted';
    case 'confirmed':
      return 'Confirmed';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    case 'expired':
      return 'Expired';
    default:
      return 'Order Sent';
  }
};

export const mockOrders: Order[] = [
  {
    id: 'ord1',
    publicOrderId: 'SPICYREST-17364741',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    status: 'accepted',
    orderDate: '2024-01-15T10:30:00',
    scheduledDate: '2024-01-15',
    scheduledTime: '11:00 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '6',
        name: 'Puff Puff',
        price: 2000,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80',
        addOns: [
          { id: 'addon1', name: 'Extra spice', price: 500 },
        ],
      },
      {
        id: '5',
        name: 'Spring Rolls',
        price: 300,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=400&q=80',
      },
    ],
    // Note: ord1 belongs to Spicy Restaurant (v1) + Jane Smith (customer-001)
    subtotal: 4800,
    tax: 360,
    discount: 0,
    total: 5160,
    amountPaid: 0,
    paymentStatus: 'payment_pending',
    orderNote: 'Please make it extra spicy.',
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    orderSnapshot: {
      items: [
        { name: 'Puff Puff', quantity: 2, price_at_order: 2000, addOns: [{ id: 'addon1', name: 'Extra spice', price: 500 }] },
        { name: 'Spring Rolls', quantity: 1, price_at_order: 300 },
      ],
      notes: 'Please make it extra spicy.',
      subtotal_at_order: 4800,
      currency: 'NGN',
      fulfillmentType: 'Pickup',
      scheduledDate: '2024-01-15',
      scheduledTime: '11:00 AM',
      createdAt: '2024-01-15T10:30:00',
    },
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Jane Smith' },
        timestamp: '2024-01-15T10:30:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-15T10:35:00',
      },
    ],
  },
  {
    id: 'ord1a',
    publicOrderId: 'spicyrest-28475832',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'John Doe',
    customerId: 'customer-001',
    status: 'in_progress',
    orderDate: '2024-01-15T09:15:00',
    scheduledDate: '2024-01-15',
    scheduledTime: '10:30 AM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    items: [
      {
        id: '12',
        name: 'Pepperoni Pizza (Large)',
        price: 3500,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80',
      },
      {
        id: '13',
        name: 'Caesar Salad',
        price: 1200,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&q=80',
      },
      {
        id: '14',
        name: 'Garlic Bread',
        price: 800,
        quantity: 3,
        image: 'https://images.unsplash.com/photo-1573140401552-388e1c0e8c23?w=400&q=80',
      },
    ],
    subtotal: 7300,
    tax: 547.5,
    discount: 0,
    total: 7847.5,
    amountPaid: 7847.5,
    paymentStatus: 'payment_received',
    paymentState: 'VENDOR_PAYMENT_CONFIRMED',
    paymentDetails: {
      paymentMethod: 'Bank Transfer',
      bankName: 'GTBank',
      accountName: 'Spicy Restaurant Ltd',
      accountNumber: '0123456789',
      message: 'Please include your order ID in the payment description.',
    },
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    orderSnapshot: {
      items: [
        { name: 'Pepperoni Pizza (Large)', quantity: 1, price_at_order: 3500 },
        { name: 'Caesar Salad', quantity: 2, price_at_order: 1200 },
        { name: 'Garlic Bread', quantity: 3, price_at_order: 800 },
      ],
      subtotal_at_order: 7300,
      currency: 'NGN',
      fulfillmentType: 'Delivery',
      scheduledDate: '2024-01-15',
      scheduledTime: '10:30 AM',
      createdAt: '2024-01-15T09:15:00',
    },
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'John Doe' },
        timestamp: '2024-01-15T09:15:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-15T09:20:00',
      },
      {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-15T09:45:00',
        message: 'Spicy Restaurant confirmed payment.',
        receiptSnapshot: {
          items: [
            { name: 'Pepperoni Pizza (Large)', quantity: 1, price_at_order: 3500 },
            { name: 'Caesar Salad', quantity: 2, price_at_order: 1200 },
            { name: 'Garlic Bread', quantity: 3, price_at_order: 800 },
          ],
          subtotal_at_order: 7300,
          currency: 'NGN',
          fulfillmentType: 'Delivery',
          scheduledDate: '2024-01-15',
          scheduledTime: '10:30 AM',
          createdAt: '2024-01-15T09:15:00',
        },
      },
      {
        eventType: 'order_in_progress',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-15T10:00:00',
      },
    ],
  },
  {
    id: 'ord2',
    publicOrderId: 'FRESHBITES-28475832',
    vendorId: 'v3',
    vendorName: 'Fresh Bites Kitchen',
    customerName: 'Jane Smith',
    customerId: 'customer-001',
    status: 'in_progress',
    orderDate: '2024-01-14T13:00:00',
    scheduledDate: '2024-01-14',
    scheduledTime: '3:00 PM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    items: [
      {
        id: '15',
        name: 'BBQ Ribs Platter',
        price: 5500,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80',
      },
      {
        id: '16',
        name: 'Coleslaw',
        price: 600,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=400&q=80',
      },
      {
        id: '17',
        name: 'Iced Tea',
        price: 400,
        quantity: 4,
        image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=400&q=80',
      },
    ],
    subtotal: 7700,
    tax: 577.5,
    discount: 0,
    total: 8277.5,
    amountPaid: 0,
    paymentStatus: 'payment_pending',
    paymentDetails: {
      paymentMethod: 'Bank Transfer',
      bankName: 'First Bank of Nigeria',
      accountName: 'Fresh Bites Kitchen Ltd',
      accountNumber: '1234567890',
    },
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Jane Smith' },
        timestamp: '2024-01-14T13:00:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Fresh Bites Kitchen' },
        timestamp: '2024-01-14T13:05:00',
      },
      {
        eventType: 'order_in_progress',
        actor: { type: 'vendor', name: 'Fresh Bites Kitchen' },
        timestamp: '2024-01-14T13:15:00',
      },
    ],
  },
  {
    id: 'ord3',
    publicOrderId: 'ELEGCAKES-39586923',
    vendorId: 'v5',
    customerId: 'customer-001',
    vendorName: 'Elegant Cakes',
    customerName: 'Jane Smith',
    status: 'completed',
    orderDate: '2024-01-12T09:00:00',
    scheduledDate: '2024-01-12',
    scheduledTime: '12:30 PM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '12',
        name: 'Pepperoni Pizza',
        price: 3500,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&q=80',
      },
      {
        id: '7',
        name: 'Samosa',
        price: 250,
        quantity: 4,
        image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80',
      },
    ],
    subtotal: 4500,
    tax: 337.5,
    discount: 500,
    total: 4337.5,
    amountPaid: 4337.5,
    paymentStatus: 'payment_received',
    paymentState: 'ORDER_COMPLETED',
    orderNote: 'Extra napkins please.',
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    hasRating: false,
    completedBy: 'vendor',
    completedAt: '2024-01-12T14:00:00',
    orderSnapshot: {
      items: [
        { name: 'Pepperoni Pizza', quantity: 1, price_at_order: 3500 },
        { name: 'Samosa', quantity: 4, price_at_order: 250 },
      ],
      notes: 'Extra napkins please.',
      subtotal_at_order: 4500,
      currency: 'NGN',
      fulfillmentType: 'Pickup',
      scheduledDate: '2024-01-12',
      scheduledTime: '12:30 PM',
      createdAt: '2024-01-12T09:00:00',
    },
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Jane Smith' },
        timestamp: '2024-01-12T09:00:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Elegant Cakes' },
        timestamp: '2024-01-12T09:05:00',
      },
      {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: 'Elegant Cakes' },
        timestamp: '2024-01-12T09:20:00',
        message: 'Elegant Cakes confirmed payment.',
        receiptSnapshot: {
          items: [
            { name: 'Pepperoni Pizza', quantity: 1, price_at_order: 3500 },
            { name: 'Samosa', quantity: 4, price_at_order: 250 },
          ],
          notes: 'Extra napkins please.',
          subtotal_at_order: 4500,
          currency: 'NGN',
          fulfillmentType: 'Pickup',
          scheduledDate: '2024-01-12',
          scheduledTime: '12:30 PM',
          createdAt: '2024-01-12T09:00:00',
        },
      },
      {
        eventType: 'order_in_progress',
        actor: { type: 'vendor', name: 'Elegant Cakes' },
        timestamp: '2024-01-12T09:25:00',
      },
      {
        eventType: 'ready',
        actor: { type: 'vendor', name: 'Elegant Cakes' },
        timestamp: '2024-01-12T13:45:00',
        message: 'Elegant Cakes marked your order as ready for delivery.',
      },
      {
        eventType: 'order_completed',
        actor: { type: 'vendor', name: 'Elegant Cakes' },
        timestamp: '2024-01-12T14:00:00',
      },
    ],
  },
  {
    id: 'ord-c3-1',
    publicOrderId: 'SPICYREST-28475833',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Michael Brown',
    customerId: 'c3',
    status: 'in_progress',
    orderDate: '2024-01-15T09:15:00',
    scheduledDate: '2024-01-15',
    scheduledTime: '10:00 AM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    items: [
      {
        id: '9',
        name: 'Classic Burger',
        price: 2000,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
      },
    ],
    subtotal: 4000,
    tax: 300,
    discount: 0,
    total: 4300,
    amountPaid: 0,
    paymentStatus: 'payment_pending',
    orderSource: 'internal',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Michael Brown' },
        timestamp: '2024-01-15T09:15:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-15T09:20:00',
      },
    ],
  },
  {
    id: 'ord-c4-1',
    publicOrderId: 'SPICYREST-39586923',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Sarah Johnson',
    customerId: 'c4',
    status: 'accepted',
    orderDate: '2024-01-14T14:20:00',
    scheduledDate: '2024-01-14',
    scheduledTime: '3:30 PM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '9',
        name: 'Classic Burger',
        price: 2000,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
      },
    ],
    subtotal: 4000,
    tax: 300,
    discount: 0,
    total: 4300,
    amountPaid: 0,
    paymentStatus: 'payment_pending',
    orderSource: 'internal',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Sarah Johnson' },
        timestamp: '2024-01-14T14:20:00',
      },
    ],
  },
  {
    id: 'ord-c6-1',
    publicOrderId: 'SPICYREST-50607080',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Emma Wilson',
    customerId: 'c6',
    status: 'completed',
    orderDate: '2024-01-05T11:30:00',
    scheduledDate: '2024-01-05',
    scheduledTime: '12:30 PM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '11',
        name: 'Club Sandwich',
        price: 1500,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
      },
    ],
    subtotal: 3000,
    tax: 225,
    discount: 0,
    total: 3225,
    amountPaid: 3225,
    paymentStatus: 'payment_received',
    paymentState: 'ORDER_COMPLETED',
    orderSource: 'internal',
    hasRating: false,
    completedBy: 'vendor',
    completedAt: '2024-01-05T12:30:00',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Emma Wilson' },
        timestamp: '2024-01-05T11:30:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-05T11:33:00',
      },
      {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-05T11:40:00',
      },
      {
        eventType: 'order_completed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-05T12:30:00',
      },
    ],
  },
  {
    id: 'ord-c5-1',
    publicOrderId: 'SPICYREST-51709146',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'David Lee',
    customerId: 'c5',
    status: 'completed',
    orderDate: '2024-01-10T12:00:00',
    scheduledDate: '2024-01-10',
    scheduledTime: '12:45 PM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    items: [
      {
        id: '11',
        name: 'Club Sandwich',
        price: 1500,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
      },
    ],
    subtotal: 3000,
    tax: 225,
    discount: 0,
    total: 3225,
    amountPaid: 3225,
    paymentStatus: 'payment_received',
    paymentState: 'ORDER_COMPLETED',
    orderSource: 'internal',
    hasRating: false,
    completedBy: 'vendor',
    completedAt: '2024-01-10T12:45:00',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'David Lee' },
        timestamp: '2024-01-10T12:00:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-10T12:05:00',
      },
      {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-10T12:15:00',
      },
      {
        eventType: 'order_completed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-10T12:45:00',
      },
    ],
  },
  {
    id: 'ord4',
    publicOrderId: 'spicyrest-51709145',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Sarah Williams',
    customerId: 'c3',
    status: 'cancelled',
    orderDate: '2024-01-08T16:45:00',
    scheduledDate: '2024-01-08',
    scheduledTime: '5:15 PM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    items: [
      {
        id: '1',
        name: 'Meat Pie',
        price: 500,
        quantity: 3,
        image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
      },
    ],
    subtotal: 1500,
    tax: 112.5,
    discount: 0,
    total: 1612.5,
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    cancellationReason: 'Cancelled by vendor — item unavailable at time of order.',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Sarah Williams' },
        timestamp: '2024-01-08T16:45:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-08T16:50:00',
      },
      {
        eventType: 'order_cancelled',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-08T17:00:00',
        message: 'Spicy Restaurant cancelled this order.',
      },
    ],
  },
  {
    id: 'ord5',
    publicOrderId: 'spicyrest-62810256',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Sarah Johnson',
    customerId: 'c4',
    status: 'completed',
    orderDate: '2024-01-05T11:30:00',
    scheduledDate: '2024-01-05',
    scheduledTime: '12:00 PM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '11',
        name: 'Club Sandwich',
        price: 1500,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
      },
    ],
    subtotal: 3000,
    tax: 225,
    discount: 0,
    total: 3225,
    amountPaid: 3225,
    paymentStatus: 'payment_received',
    paymentState: 'ORDER_COMPLETED',
    vendorPolicy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
    orderSource: 'internal',
    hasRating: true,
    completedBy: 'vendor',
    completedAt: '2024-01-05T13:00:00',
  },
  {
    id: 'ord-rejected-001',
    publicOrderId: 'spicyrest-73921367',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'David Lee',
    customerId: 'c5',
    status: 'rejected',
    orderDate: '2024-01-03T09:00:00',
    scheduledDate: '2024-01-03',
    scheduledTime: '10:00 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '9',
        name: 'Classic Burger',
        price: 2000,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
      },
    ],
    subtotal: 4000,
    tax: 300,
    discount: 0,
    total: 4300,
    orderSource: 'internal',
    rejectionReason: 'Kitchen fully booked for that time slot.',
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'David Lee' },
        timestamp: '2024-01-03T09:00:00',
      },
      {
        eventType: 'order_rejected',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-03T09:10:00',
        message: 'Spicy Restaurant declined your order request.',
      },
    ],
  },
  {
    id: 'ord-confirmed-001',
    publicOrderId: 'spicyrest-84032478',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Emma Wilson',
    customerId: 'c6',
    status: 'confirmed',
    orderDate: '2024-01-16T08:00:00',
    scheduledDate: '2024-01-16',
    scheduledTime: '9:30 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    items: [
      {
        id: '6',
        name: 'Puff Puff',
        price: 2000,
        quantity: 3,
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80',
      },
    ],
    subtotal: 6000,
    tax: 450,
    discount: 0,
    total: 6450,
    amountPaid: 6450,
    paymentStatus: 'payment_received',
    paymentState: 'VENDOR_PAYMENT_CONFIRMED',
    orderSource: 'internal',
    orderSnapshot: {
      items: [
        { name: 'Puff Puff', quantity: 3, price_at_order: 2000 },
      ],
      subtotal_at_order: 6000,
      currency: 'NGN',
      fulfillmentType: 'Pickup',
      scheduledDate: '2024-01-16',
      scheduledTime: '9:30 AM',
      createdAt: '2024-01-16T08:00:00',
    },
    eventHistory: [
      {
        eventType: 'order_placed',
        actor: { type: 'customer', name: 'Emma Wilson' },
        timestamp: '2024-01-16T08:00:00',
      },
      {
        eventType: 'order_accepted',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-16T08:05:00',
      },
      {
        eventType: 'payment_confirmed',
        actor: { type: 'vendor', name: 'Spicy Restaurant' },
        timestamp: '2024-01-16T08:30:00',
        message: 'Spicy Restaurant confirmed payment.',
        receiptSnapshot: {
          items: [
            { name: 'Puff Puff', quantity: 3, price_at_order: 2000 },
          ],
          subtotal_at_order: 6000,
          currency: 'NGN',
          fulfillmentType: 'Pickup',
          scheduledDate: '2024-01-16',
          scheduledTime: '9:30 AM',
          createdAt: '2024-01-16T08:00:00',
        },
      },
    ],
  },
  {
    id: 'ext_order_001',
    publicOrderId: 'External-001',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'David Miller',
    status: 'completed',
    orderDate: '2026-01-01T08:00:00',
    scheduledDate: '2026-01-01',
    scheduledTime: '10:00 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    orderSource: 'external',
    items: [
      {
        id: '6',
        name: 'Puff Puff',
        price: 2000,
        quantity: 3,
        image: 'https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&q=80',
      },
    ],
    subtotal: 6000,
    tax: 450,
    discount: 0,
    total: 6450,
    amountPaid: 6450,
    paymentStatus: 'payment_received',
    orderNote: 'Recorded from phone call.',
    externalReference: 'Phone call',
  },
  {
    id: 'today_order_001',
    publicOrderId: 'spicyrest-90001',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Sarah W.',
    customerId: 'c10',
    status: 'accepted',
    orderDate: new Date().toISOString(),
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '11:30 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    orderSource: 'internal',
    items: [
      { id: '6', name: 'Puff Puff', price: 2000, quantity: 2 },
      { id: '7', name: 'Samosa', price: 250, quantity: 2 },
    ],
    subtotal: 4500,
    tax: 0,
    discount: 0,
    total: 2050,
    paymentStatus: 'payment_pending',
  },
  {
    id: 'today_order_002',
    publicOrderId: 'spicyrest-90002',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'John D.',
    customerId: 'c11',
    status: 'in_progress',
    orderDate: new Date().toISOString(),
    scheduledDate: new Date().toISOString().split('T')[0],
    scheduledTime: '3:00 PM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    orderSource: 'internal',
    items: [
      { id: '12', name: 'Pepperoni Pizza (Large)', price: 3500, quantity: 1 },
      { id: '13', name: 'Caesar Salad', price: 1200, quantity: 2 },
      { id: '14', name: 'Garlic Bread', price: 800, quantity: 3 },
    ],
    subtotal: 8300,
    tax: 0,
    discount: 0,
    total: 3450,
    paymentStatus: 'payment_received',
    amountPaid: 3450,
  },
  {
    id: 'upcoming_order_001',
    publicOrderId: 'spicyrest-90003',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Mike J.',
    customerId: 'c12',
    status: 'accepted',
    orderDate: new Date().toISOString(),
    scheduledDate: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })(),
    scheduledTime: '10:00 AM',
    fulfillmentType: 'Pickup',
    fulfillmentMethod: 'pickup',
    orderSource: 'internal',
    items: [
      { id: '9', name: 'Classic Burger', price: 2000, quantity: 2 },
      { id: '17', name: 'Iced Tea', price: 400, quantity: 1 },
    ],
    subtotal: 4400,
    tax: 0,
    discount: 0,
    total: 4400,
    paymentStatus: 'payment_pending',
  },
  {
    id: 'upcoming_order_002',
    publicOrderId: 'External-003',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Jane S.',
    customerId: 'c13',
    status: 'confirmed',
    orderDate: new Date().toISOString(),
    scheduledDate: (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0]; })(),
    scheduledTime: '1:30 PM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    orderSource: 'external',
    externalReference: 'Instagram',
    items: [
      { id: '11', name: 'Club Sandwich', price: 1500, quantity: 2 },
    ],
    subtotal: 3000,
    tax: 0,
    discount: 0,
    total: 3000,
    paymentStatus: 'payment_pending',
  },
  {
    id: 'ext_order_002',
    publicOrderId: 'External-002',
    vendorId: 'v1',
    vendorName: 'Spicy Restaurant',
    customerName: 'Emma Davis',
    status: 'completed',
    orderDate: '2024-01-10T09:30:00',
    scheduledDate: '2024-01-10',
    scheduledTime: '11:00 AM',
    fulfillmentType: 'Delivery',
    fulfillmentMethod: 'delivery',
    orderSource: 'external',
    items: [
      {
        id: '9',
        name: 'Classic Burger',
        price: 2000,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
      },
    ],
    subtotal: 4000,
    tax: 300,
    discount: 0,
    total: 4300,
    adjustedTotal: 4500,
    amountPaid: 4500,
    paymentStatus: 'payment_received',
  },
];
