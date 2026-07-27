export type {
  AddOn,
  MenuItem,
  Category,
  Vendor,
} from '@/mocks/vendorData';

export type {
  OrderItem,
  OrderEvent,
  OrderEventType,
  OrderSnapshot,
  OrderSnapshotItem,
  OrderPaymentDetails,
  PaymentRecord,
  PaymentStatus,
  OrderSource,
  CompletionSource,
  Order,
} from '@/mocks/ordersData';

export type { OrderStatus } from '@/constants/orderStatus';

export type {
  ChatMessage,
  Chat,
  MessageType,
  ContactCardData,
  PaymentRequestData,
  PickupDetailsData,
  CatalogItemData,
} from '@/mocks/chatData';

export type {
  CartItem,
  CartAddOn,
  VendorCart,
} from '@/contexts/CartContext';

export interface VendorMenuData {
  items: import('@/mocks/vendorData').MenuItem[];
  categories: import('@/mocks/vendorData').Category[];
}

export interface CreateOrderPayload {
  vendorId: string;
  vendorName: string;
  items: import('@/mocks/ordersData').OrderItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  fulfillmentType: 'Pickup' | 'Delivery';
  orderNote?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  orderSnapshot?: import('@/mocks/ordersData').OrderSnapshot;
}
