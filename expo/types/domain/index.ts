/**
 * Centralized domain types — the single import surface for shared app types.
 *
 * Import shared enums/types from here (`@/types/domain`) rather than reaching
 * into individual contexts, mocks, constants, or utils. The enum modules below
 * re-export each canonical definition from its owning module, so there is one
 * source of truth per concept and existing import paths keep working.
 */

// ---- Status & role enums (single source of truth) ----
export * from './userRole';
export * from './vendorStatus';
export * from './verificationStatus';
export * from './orderStatus';
export * from './paymentStatus';
export * from './subscriptionTier';
export * from './conversationType';
export * from './notificationType';
export * from './countryStatus';

// ---- Catalog / vendor entities ----
export type {
  AddOn,
  MenuItem,
  Category,
  Vendor,
} from '@/mocks/vendorData';

// ---- Order entities ----
export type {
  OrderItem,
  OrderEvent,
  OrderEventType,
  OrderSnapshot,
  OrderSnapshotItem,
  OrderPaymentDetails,
  PaymentRecord,
  OrderSource,
  CompletionSource,
  Order,
} from '@/mocks/ordersData';

// ---- Chat entities ----
export type {
  ChatMessage,
  Chat,
  MessageType,
  ContactCardData,
  PaymentRequestData,
  PickupDetailsData,
  CatalogItemData,
} from '@/mocks/chatData';

// ---- Cart entities ----
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
