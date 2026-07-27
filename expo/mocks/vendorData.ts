export interface TimeRange {
  open: string;
  close: string;
}

export interface DayHoursConfig {
  closed: boolean;
  ranges: TimeRange[];
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
}

export type HighlightLabel = 'chefs_pick' | 'spicy' | 'limited' | 'best_seller';

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  image?: string;
  inStock: boolean;
  categoryId: string;
  stockCount?: number;
  addOns?: AddOn[];
  createdAt?: string;
  orderCount?: number;
  recentOrderCount?: number;
  isFeatured?: boolean;
  popular?: boolean;
  isNew?: boolean;
  highlightLabel?: HighlightLabel;
}

export interface Category {
  id: string;
  name: string;
  itemCount: number;
}

export interface VendorGreetingMessageSettings {
  enabled: boolean;
  message: string;
  updatedAt: string;
  vendorId: string;
}

export interface VendorPaymentMethod {
  id: string;
  type: string;
  label: string;
  provider: string;
  maskedIdentifier: string;
  status: 'active' | 'pending_review' | 'disabled' | 'needs_action';
  updatedAt?: string;
}

export interface VendorPaymentMethodChangeRequest {
  id: string;
  status: 'pending_review' | 'approved' | 'rejected';
  requestedAt: string;
  requestedBy: string;
}

export interface VendorPaymentMethodChangeHistoryItem {
  id: string;
  action: string;
  createdAt: string;
  createdBy: string;
}

export interface Vendor {
  id: string;
  slug: string;
  username: string;
  name: string;
  category: string;
  categoryId?: string;
  rating: number;
  reviewCount: number;
  region: string;
  city: string;
  countryCode: string;
  country?: string;
  state?: string;
  area: string;
  email?: string;
  phone?: string;
  fullName?: string;
  isVerified?: boolean;
  logoImage?: string;
  bannerImage?: string;
  description?: string;
  fulfillmentTypes: string[];
  pickup: boolean;
  delivery: boolean;
  shipping: boolean;
  shippingScope?: 'domestic' | 'international';
  isOpenNow: boolean;
  taxEnabled: boolean;
  taxRate: number;
  policy?: string;
  greetingMessageSettings?: VendorGreetingMessageSettings;
  greetingEnabled?: boolean;
  greetingMessage?: string;
  greetingUpdatedAt?: string;
  fullAddress?: string;
  businessHours?: string;
  contactLinks?: {
    website?: string;
    instagram?: string;
    tiktok?: string;
  };
  minimumOrderAmount?: number;
  requiresOrderTiming?: boolean;
  createdAt?: string;
  vendorStatus?: 'ACTIVE' | 'UNVERIFIED' | 'WAITLISTED' | 'SUSPENDED' | 'DEACTIVATED';
  /**
   * Backend-aligned verification state. Separate from accountState.
   * Defaults are derived from the legacy vendorStatus when omitted
   * (see getVendorVerificationStatus / getVendorAccountState).
   */
  verificationStatus?: 'not_started' | 'pending_review' | 'retry_required' | 'approved' | 'rejected';
  /** Backend-aligned account state. Separate from verificationStatus. */
  accountState?: 'active' | 'suspended' | 'deactivated' | 'frozen';
  /**
   * Whether the vendor opts into public discovery. A vendor must be approved,
   * have an active account, AND be discoverable to appear in public lists.
   */
  isDiscoverable?: boolean;
  storeStatus?: 'open' | 'closed' | 'away' | 'sleep_mode';
  storeStatusMode?: 'follow_hours' | 'manual';
  closedForOrders?: boolean;
  awayMessage?: string;
  closedMessage?: string;
  weeklyHours?: {
    Sunday: DayHoursConfig;
    Monday: DayHoursConfig;
    Tuesday: DayHoursConfig;
    Wednesday: DayHoursConfig;
    Thursday: DayHoursConfig;
    Friday: DayHoursConfig;
    Saturday: DayHoursConfig;
  };
  currency?: string;
  promoStackingMode?: 'single' | 'delivery_only' | 'advanced';
  paymentInstructions?: string;
  paymentInstructionsEnabled?: boolean;
  ownershipConfirmed?: boolean;
  ownershipConfirmedAt?: string;
  ownershipConfirmedBy?: string;
  paymentInstructionsUpdatedAt?: string;
  paymentInstructionsUpdatedBy?: string;
  paymentMethods?: VendorPaymentMethod[];
  primaryPaymentMethodId?: string;
  secondaryPaymentMethodId?: string;
  paymentMethodChangeRequests?: VendorPaymentMethodChangeRequest[];
  paymentMethodChangeHistory?: VendorPaymentMethodChangeHistoryItem[];
  primaryPaymentMethod?: {
    id?: string;
    type: string;
    name: string;
    label?: string;
    provider?: string;
    maskedIdentifier?: string;
    status?: 'active' | 'pending_review' | 'disabled' | 'needs_action';
    updatedAt?: string;
    details: any;
  };
  secondaryPaymentMethod?: {
    id?: string;
    type: string;
    name: string;
    label?: string;
    provider?: string;
    maskedIdentifier?: string;
    status?: 'active' | 'pending_review' | 'disabled' | 'needs_action';
    updatedAt?: string;
    details: any;
  };
  orderCount?: number;
  recentOrders7Days?: number;
  ordersLast48h?: number;
  profileViews?: number;
  favoritesCount?: number;
  /**
   * Vendor's subscription plan tier, used to gate customer-facing features
   * like the platform AI (Basic vendors cannot offer AI to customers). Mirrors
   * the backend's `vendorSubscriptions/{vendorId}.tier` field. Defaults
   * to 'basic' when omitted so customer-side gating stays conservative.
   * Henry can replace mock values with the real Firestore read later.
   */
  plan?: 'basic' | 'standard' | 'pro' | 'pro+';
  /**
   * Mock-only: how many AI replies the vendor has used this month.
   * The backend will own this as a monthly counter on the vendor's
   * subscription document. Used to simulate the vendor quota reached
   * state in the customer AI screen.
   */
  aiMonthlyRepliesUsed?: number;
  /** Mock-only: vendor's monthly AI reply quota. Backend will own this. */
  aiMonthlyReplyLimit?: number;
}

export const mockVendor: Vendor = {
  id: 'v1',
  slug: 'spicyrest',
  username: 'spicyrest',
  name: 'Spicy Restaurant',
  category: 'Food & Catering',
  rating: 4.7,
  reviewCount: 24,
  region: 'Lagos',
  city: 'Lekki',
  countryCode: 'NG',
  area: 'Lagos, Lekki',
  bannerImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
  logoImage: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&q=80',
  fulfillmentTypes: ['Pickup', 'Delivery'],
  pickup: true,
  delivery: true,
  shipping: false,
  isOpenNow: true,
  taxEnabled: true,
  taxRate: 0.075,
  vendorStatus: 'ACTIVE',
  isVerified: false,
  policy: 'Cancellation Policy: Orders can be cancelled up to 30 minutes after placement. After 30 minutes, no refunds will be issued.\n\nPickup Terms: Please arrive within 15 minutes of your scheduled pickup time. Orders not collected within 1 hour may be discarded.\n\nDelivery Terms: Delivery is available within 5km radius. Estimated delivery time is 30-45 minutes. Delivery fee varies by distance.',
  fullAddress: '15 Admiralty Way, Lekki Phase 1, Lagos',
  businessHours: 'Mon-Fri: 9:00 AM - 9:00 PM\nSat-Sun: 10:00 AM - 10:00 PM',
  contactLinks: {
    website: 'https://spicyrestaurant.com',
    instagram: 'https://instagram.com/spicyrestaurant',
    tiktok: 'https://tiktok.com/@spicyrestaurant',
  },
  minimumOrderAmount: 2500,
  storeStatus: 'open',
  storeStatusMode: 'follow_hours',
  closedForOrders: false,
  currency: 'NGN',
  plan: 'pro',
  aiMonthlyRepliesUsed: 42,
  aiMonthlyReplyLimit: 500,
  paymentInstructions: 'Please include your order ID as the transfer narration.',
  paymentInstructionsEnabled: true,
  ownershipConfirmed: true,
  ownershipConfirmedAt: '2026-06-10T09:30:00.000Z',
  ownershipConfirmedBy: 'v1',
  paymentInstructionsUpdatedAt: '2026-06-10T09:30:00.000Z',
  paymentInstructionsUpdatedBy: 'v1',
  weeklyHours: {
    Sunday: { closed: true, ranges: [] },
    Monday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
    Tuesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
    Wednesday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
    Thursday: { closed: false, ranges: [{ open: '9:00 AM', close: '6:00 PM' }] },
    Friday: { closed: false, ranges: [{ open: '9:00 AM', close: '9:00 PM' }] },
    Saturday: { closed: false, ranges: [{ open: '10:00 AM', close: '4:00 PM' }] },
  },
  awayMessage: 'Thanks for your message! We\'re currently away but will respond soon. You can still place an order anytime.',
  closedMessage: 'Our store is currently closed. You can still send us order requests and we\'ll review them when we reopen.',
  paymentMethods: [
    {
      id: 'pm_primary_bank',
      type: 'bank_transfer',
      label: 'Bank Transfer',
      provider: 'First Bank of Nigeria',
      maskedIdentifier: '•••• 7890',
      status: 'active',
      updatedAt: '2026-06-10T09:30:00.000Z',
    },
    {
      id: 'pm_secondary_cash',
      type: 'cash',
      label: 'Cash',
      provider: 'Vendor-managed',
      maskedIdentifier: 'Pay on pickup or delivery',
      status: 'active',
      updatedAt: '2026-06-10T09:30:00.000Z',
    },
  ],
  primaryPaymentMethodId: 'pm_primary_bank',
  secondaryPaymentMethodId: 'pm_secondary_cash',
  paymentMethodChangeRequests: [],
  paymentMethodChangeHistory: [
    {
      id: 'pmh_001',
      action: 'Primary payment method approved',
      createdAt: '2026-06-10T09:30:00.000Z',
      createdBy: 'admin',
    },
  ],
  primaryPaymentMethod: {
    id: 'pm_primary_bank',
    type: 'bank_transfer',
    name: 'Bank Transfer',
    status: 'active',
    updatedAt: '2026-06-10T09:30:00.000Z',
    details: {
      bankName: 'First Bank of Nigeria',
      accountNumber: '1234567890',
      accountName: 'Spicy Restaurant Ltd',
    },
  },
  secondaryPaymentMethod: {
    id: 'pm_secondary_cash',
    type: 'cash',
    name: 'Cash',
    status: 'active',
    updatedAt: '2026-06-10T09:30:00.000Z',
    details: {
      instruction: 'Pay with cash on pickup or delivery',
    },
  },
};

export const mockVendors: Vendor[] = [
  {
    id: 'v1',
    slug: 'spicyrest',
    username: 'spicyrest',
    name: 'Spicy Restaurant',
    category: 'Food & Catering',
    rating: 4.7,
    reviewCount: 24,
    region: 'Lagos',
    city: 'Lekki',
    countryCode: 'NG',
    area: 'Lagos, Lekki',
    bannerImage: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
    logoImage: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 85,
    recentOrders7Days: 22,
    ordersLast48h: 8,
    profileViews: 340,
    favoritesCount: 45,
    plan: 'pro',
    aiMonthlyRepliesUsed: 42,
    aiMonthlyReplyLimit: 500,
  },
  {
    id: 'v2',
    slug: 'bellacakes',
    username: 'bellacakes',
    name: 'Bella Cakes',
    category: 'Food & Catering',
    rating: 4.9,
    reviewCount: 156,
    region: 'Abuja',
    city: 'Wuse 2',
    countryCode: 'NG',
    area: 'Abuja, Wuse 2',
    bannerImage: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 210,
    recentOrders7Days: 35,
    ordersLast48h: 12,
    profileViews: 890,
    favoritesCount: 120,
    plan: 'pro+',
    aiMonthlyRepliesUsed: 120,
    aiMonthlyReplyLimit: 2000,
  },
  {
    id: 'v3',
    slug: 'techfixpro',
    username: 'techfixpro',
    name: 'TechFix Pro',
    category: 'Electronics Repair',
    rating: 4.5,
    reviewCount: 89,
    region: 'Lagos',
    city: 'Victoria Island',
    countryCode: 'NG',
    area: 'Lagos, Victoria Island',
    bannerImage: 'https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=800&q=80',
    fulfillmentTypes: ['Pickup'],
    pickup: true,
    delivery: false,
    shipping: false,
    isOpenNow: true,
    taxEnabled: false,
    taxRate: 0,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 62,
    recentOrders7Days: 14,
    ordersLast48h: 5,
    profileViews: 210,
    favoritesCount: 38,
    plan: 'basic',
    aiMonthlyRepliesUsed: 0,
    aiMonthlyReplyLimit: 0,
  },
  {
    id: 'v4',
    slug: 'greenmarket',
    username: 'greenmarket',
    name: 'Green Market',
    category: 'Food & Catering',
    rating: 4.3,
    reviewCount: 67,
    region: 'Rivers',
    city: 'Port Harcourt',
    countryCode: 'NG',
    area: 'Port Harcourt, GRA',
    bannerImage: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.05,
    storeStatus: 'open',
    vendorStatus: 'UNVERIFIED',
    orderCount: 30,
    recentOrders7Days: 6,
    ordersLast48h: 2,
    profileViews: 95,
    favoritesCount: 12,
    plan: 'basic',
    aiMonthlyRepliesUsed: 0,
    aiMonthlyReplyLimit: 0,
  },
  {
    id: 'v5',
    slug: 'stylelounge',
    username: 'stylelounge',
    name: 'Style Lounge',
    category: 'Fashion',
    rating: 4.8,
    reviewCount: 203,
    region: 'Lagos',
    city: 'Ikeja',
    countryCode: 'NG',
    area: 'Lagos, Ikeja',
    bannerImage: 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Shipping (Nationwide)'],
    pickup: true,
    delivery: false,
    shipping: true,
    shippingScope: 'domestic',
    isOpenNow: false,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'closed',
    vendorStatus: 'ACTIVE',
    orderCount: 175,
    recentOrders7Days: 28,
    ordersLast48h: 9,
    profileViews: 620,
    favoritesCount: 95,
    plan: 'standard',
    aiMonthlyRepliesUsed: 95,
    aiMonthlyReplyLimit: 100,
  },
  {
    id: 'v6',
    slug: 'quickbites',
    username: 'quickbites',
    name: 'Quick Bites',
    category: 'Food & Catering',
    rating: 4.2,
    reviewCount: 134,
    region: 'Oyo',
    city: 'Ibadan',
    countryCode: 'NG',
    area: 'Ibadan, Bodija',
    bannerImage: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 48,
    recentOrders7Days: 10,
    ordersLast48h: 3,
    profileViews: 150,
    favoritesCount: 22,
    plan: 'standard',
    aiMonthlyRepliesUsed: 18,
    aiMonthlyReplyLimit: 100,
  },
  {
    id: 'v7',
    slug: 'globalcrafts',
    username: 'globalcrafts',
    name: 'Global Crafts',
    category: 'Art & Handmade',
    rating: 4.6,
    reviewCount: 78,
    region: 'Lagos',
    city: 'Surulere',
    countryCode: 'NG',
    area: 'Lagos, Surulere',
    bannerImage: 'https://images.unsplash.com/photo-1609081219090-a6d81d3085bf?w=800&q=80',
    fulfillmentTypes: ['Shipping (Worldwide)'],
    pickup: false,
    delivery: false,
    shipping: true,
    shippingScope: 'international',
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 55,
    recentOrders7Days: 18,
    ordersLast48h: 7,
    profileViews: 280,
    favoritesCount: 42,
    plan: 'pro',
    aiMonthlyRepliesUsed: 211,
    aiMonthlyReplyLimit: 500,
  },
  {
    id: 'v8',
    slug: 'lekkibistro',
    username: 'lekkibistro',
    name: 'Lekki Bistro',
    category: 'Food & Catering',
    rating: 4.6,
    reviewCount: 98,
    region: 'Lagos',
    city: 'Lekki',
    countryCode: 'NG',
    area: 'Lagos, Lekki',
    bannerImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 120,
    recentOrders7Days: 30,
    ordersLast48h: 11,
    profileViews: 450,
    favoritesCount: 68,
    plan: 'pro',
    aiMonthlyRepliesUsed: 487,
    aiMonthlyReplyLimit: 500,
  },
  {
    id: 'v9',
    slug: 'ikejagrills',
    username: 'ikejagrills',
    name: 'Ikeja Grills',
    category: 'Food & Catering',
    rating: 4.4,
    reviewCount: 72,
    region: 'Lagos',
    city: 'Ikeja',
    countryCode: 'NG',
    area: 'Lagos, Ikeja',
    bannerImage: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 90,
    recentOrders7Days: 20,
    ordersLast48h: 6,
    profileViews: 310,
    favoritesCount: 50,
  },
  {
    id: 'v10',
    slug: 'abujaeats',
    username: 'abujaeats',
    name: 'Abuja Eats',
    category: 'Food & Catering',
    rating: 4.5,
    reviewCount: 110,
    region: 'Abuja',
    city: 'Garki',
    countryCode: 'NG',
    area: 'Abuja, Garki',
    bannerImage: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    fulfillmentTypes: ['Pickup', 'Delivery'],
    pickup: true,
    delivery: true,
    shipping: false,
    isOpenNow: true,
    taxEnabled: true,
    taxRate: 0.075,
    storeStatus: 'open',
    vendorStatus: 'ACTIVE',
    orderCount: 145,
    recentOrders7Days: 25,
    ordersLast48h: 10,
    profileViews: 520,
    favoritesCount: 78,
    plan: 'pro+',
    aiMonthlyRepliesUsed: 540,
    aiMonthlyReplyLimit: 2000,
  },
];

export const mockCategories: Category[] = [
  { id: 'pastries', name: 'Pastries', itemCount: 10 },
  { id: 'small-chops', name: 'Small Chops', itemCount: 4 },
  { id: 'burgers', name: 'Burgers', itemCount: 8 },
  { id: 'sandwiches', name: 'Sandwiches', itemCount: 6 },
  { id: 'pizza', name: 'Pizza', itemCount: 5 },
];

export const mockMenuItems: MenuItem[] = [
  {
    id: '1',
    name: 'Meat Pie',
    description: 'Flaky pastry with spiced beef',
    price: 500,
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
    inStock: true,
    categoryId: 'pastries',
    createdAt: '2025-09-10T10:00:00Z',
    orderCount: 142,
    recentOrderCount: 18,
    isFeatured: false,
  },
  {
    id: '2',
    name: 'Sausage Roll',
    description: 'Crispy roll with juicy sausage',
    price: 450,
    image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=400&q=80',
    inStock: true,
    categoryId: 'pastries',
    createdAt: '2025-10-01T10:00:00Z',
    orderCount: 88,
    recentOrderCount: 9,
    isFeatured: false,
  },
  {
    id: '3',
    name: 'Chicken Pie',
    description: 'Golden pastry filled with chicken',
    price: 600,
    image: 'https://images.unsplash.com/photo-1619985156202-72409d20f27f?w=400&q=80',
    inStock: false,
    categoryId: 'pastries',
    createdAt: '2025-11-15T10:00:00Z',
    orderCount: 55,
    recentOrderCount: 4,
    isFeatured: false,
  },
  {
    id: '4',
    name: 'Fish Pie',
    price: 550,
    image: 'https://images.unsplash.com/photo-1586511925558-a4c6376fe65f?w=400&q=80',
    inStock: true,
    categoryId: 'pastries',
    createdAt: '2026-03-25T10:00:00Z',
    orderCount: 12,
    recentOrderCount: 5,
    isFeatured: false,
    highlightLabel: 'chefs_pick',
  },
  {
    id: '5',
    name: 'Spring Rolls',
    description: 'Crispy vegetable rolls',
    price: 300,
    salePrice: 220,
    image: 'https://images.unsplash.com/photo-1541529086526-db283c563270?w=400&q=80',
    inStock: true,
    categoryId: 'small-chops',
    createdAt: '2025-08-20T10:00:00Z',
    orderCount: 210,
    recentOrderCount: 22,
    isFeatured: true,
  },
  {
    id: '6',
    name: 'Puff Puff',
    description: 'Soft, fluffy fried dough balls. Lightly sweet.',
    price: 2000,
    salePrice: 1500,
    image: 'https://images.unsplash.com/photo-1626804475297-41608ea09aeb?w=400&q=80',
    inStock: true,
    stockCount: 5,
    categoryId: 'small-chops',
    createdAt: '2025-07-01T10:00:00Z',
    orderCount: 178,
    recentOrderCount: 15,
    isFeatured: false,
    addOns: [
      { id: 'addon1', name: 'Extra spice', price: 500 },
      { id: 'addon2', name: 'Extra sauce', price: 300 },
    ],
  },
  {
    id: '7',
    name: 'Samosa',
    description: 'Spiced beef in crispy shell',
    price: 250,
    image: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&q=80',
    inStock: true,
    categoryId: 'small-chops',
    createdAt: '2026-03-20T10:00:00Z',
    orderCount: 20,
    recentOrderCount: 8,
    isFeatured: false,
    highlightLabel: 'spicy',
  },
  {
    id: '8',
    name: 'Chicken Wings',
    description: 'Spicy grilled wings',
    price: 800,
    salePrice: 650,
    image: 'https://images.unsplash.com/photo-1608039755401-742074f0548d?w=400&q=80',
    inStock: true,
    categoryId: 'small-chops',
    createdAt: '2025-12-05T10:00:00Z',
    orderCount: 95,
    recentOrderCount: 11,
    isFeatured: false,
  },
  {
    id: '9',
    name: 'Classic Burger',
    description: 'Beef patty with cheese',
    price: 2000,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80',
    inStock: true,
    categoryId: 'burgers',
    createdAt: '2025-06-15T10:00:00Z',
    orderCount: 320,
    recentOrderCount: 28,
    isFeatured: true,
  },
  {
    id: '10',
    name: 'Chicken Burger',
    description: 'Grilled chicken with special sauce',
    price: 1800,
    image: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400&q=80',
    inStock: true,
    categoryId: 'burgers',
    createdAt: '2026-03-22T10:00:00Z',
    orderCount: 8,
    recentOrderCount: 4,
    isFeatured: false,
    highlightLabel: 'limited',
  },
  {
    id: '11',
    name: 'Club Sandwich',
    description: 'Triple decker with chicken',
    price: 1500,
    image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&q=80',
    inStock: true,
    categoryId: 'sandwiches',
    createdAt: '2025-05-10T10:00:00Z',
    orderCount: 130,
    recentOrderCount: 14,
    isFeatured: false,
  },
  {
    id: '12',
    name: 'Pepperoni Pizza',
    description: 'Classic pepperoni with mozzarella',
    price: 3500,
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400&q=80',
    inStock: true,
    categoryId: 'pizza',
    createdAt: '2026-03-28T10:00:00Z',
    orderCount: 5,
    recentOrderCount: 3,
    isFeatured: true,
  },
];
