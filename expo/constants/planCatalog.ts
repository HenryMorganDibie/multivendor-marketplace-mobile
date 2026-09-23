/**
 * MOCK_PLAN_CATALOG — the single backend-shaped mock source of truth for all
 * Platform subscription pricing, plan features, usage limits, and launch-sale
 * messaging. Every subscription screen (Manage Subscription, Plan Details,
 * Available Plans, Upgrade Plan) reads from this catalog — no screen hard-codes
 * feature labels, prices, or limits.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * BACKEND / CMS INTEGRATION (Henry)
 * ──────────────────────────────────────────────────────────────────────────
 * Replace `MOCK_PLAN_CATALOG` with the response from the backend or CMS. The
 * shape below is designed to match what the CMS will return so the swap is a
 * drop-in:
 *
 *   - Plan prices by country       → countries[].plans[planId]
 *   - Standard & promotional prices→ monthlyMinorUnits / standardMonthlyMinorUnits / launchMonthlyMinorUnits
 *   - Plan names & descriptions     → plans[].name / plans[].tagline
 *   - Feature labels               → plans[].features[].label
 *   - Numerical limits             → plans[].features[].value + unit
 *   - Feature availability         → plans[].features[].included
 *   - Feature display order        → plans[].features[].order (within category)
 *   - Active or inactive plans     → plans[].status
 *   - Launch-sale messaging        → launchSale { active, founderCapPerCountry, promoEndsAt, renewsAtStandardPrice }
 *
 * After the swap, changing a value in the CMS updates every surface that reads
 * from this catalog — mobile subscription page, vendor portal pricing page,
 * public website pricing page, plan comparison screen, upgrade prompts, and
 * feature-lock messages — without editing individual screens.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PRODUCT DECISIONS
 * ──────────────────────────────────────────────────────────────────────────
 * - QR code: REMOVED. Not a feature, not listed anywhere.
 * - Manual Print Layout toggle: REMOVED. Print/PDF formatting is automatic.
 * - "Early access to future features" / "Priority support": NOT in the approved
 *   MVP matrix — do not add them as features.
 * - All features below come from the approved plan matrix only.
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { BusinessCountry, VendorPlan } from '@/contexts/VendorPlanContext';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type PlanId = 'basic' | 'standard' | 'pro' | 'pro_plus';

export type FeatureCategory =
  | 'storefront'
  | 'ai'
  | 'orders'
  | 'invoices'
  | 'analytics'
  | 'account';

export type BillingInterval = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'inactive';
export type PricingType = 'standard' | 'launch' | 'legacy' | 'promo';
export type SubscriptionStatus = 'active' | 'cancel_scheduled' | 'past_due' | 'expired' | 'basic';
export type PaymentStatus = 'ok' | 'grace' | 'failed' | 'past_due';

/**
 * A single plan feature. Supports three kinds of values:
 * - Numeric limit (value + optional unit): e.g. { value: 250, unit: 'per month' }
 * - Boolean capability (included): e.g. { included: true }
 * - Descriptive text (text): e.g. { text: 'Logo, brand color, ...' }
 * If none of value/included/text is set, the feature is "not available" (—).
 */
export interface CatalogFeature {
  id: string;
  label: string;
  category: FeatureCategory;
  value?: number;
  unit?: string;
  included?: boolean;
  text?: string;
  /** Display order within the feature's category. */
  order: number;
}

export interface CountryPlanPricing {
  monthlyMinorUnits: number;
  standardMonthlyMinorUnits: number;
  launchMonthlyMinorUnits: number;
}

export interface CatalogCountry {
  code: string;
  name: string;
  band: 'A' | 'B' | 'C' | 'D';
  currencyCode: string;
  currencySymbol: string;
  plans: Record<PlanId, CountryPlanPricing>;
}

export interface CatalogPlan {
  id: PlanId;
  name: string;
  tagline: string;
  status: PlanStatus;
  displayOrder: number;
  billingInterval: BillingInterval;
  features: CatalogFeature[];
  /** Feature ids to surface in the benefits snapshot (6–8 lines). */
  highlightFeatureIds: string[];
  /** Mock current usage against limit features. Henry returns real usage. */
  usage: { featureId: string; current: number }[];
}

export interface PlanCatalog {
  /** Default country for the mock (Henry returns the vendor's country). */
  countryCode: string;
  currencyCode: string;
  currencySymbol: string;
  launchSale: {
    active: boolean;
    founderCapPerCountry: number;
    promoEndsAt: string | null;
    renewsAtStandardPrice: boolean;
  };
  /** Fallback portal base. Henry returns a signed portalUrl on the subscription. */
  vendorPortalBaseUrl: string;
  countries: CatalogCountry[];
  plans: CatalogPlan[];
}

/* -------------------------------------------------------------------------- */
/* Resolved types (country-specific, with prices filled in)                    */
/* -------------------------------------------------------------------------- */

export interface ResolvedFeature extends CatalogFeature {}

export interface ResolvedPlan {
  id: PlanId;
  name: string;
  tagline: string;
  status: PlanStatus;
  displayOrder: number;
  billingInterval: BillingInterval;
  monthlyPriceMinorUnits: number;
  standardPriceMinorUnits: number;
  pricingType: PricingType;
  features: ResolvedFeature[];
  highlightFeatureIds: string[];
  usage: { featureId: string; current: number }[];
}

export interface ResolvedCatalog {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  launchSale: PlanCatalog['launchSale'];
  vendorPortalBaseUrl: string;
  plans: ResolvedPlan[];
}

/* -------------------------------------------------------------------------- */
/* Vendor subscription document (backend-shaped)                               */
/* -------------------------------------------------------------------------- */

export interface UsageMetric {
  featureId: string;
  label: string;
  current: number;
  limit: number;
}

export interface VendorSubscription {
  planId: PlanId;
  planName: string;
  tagline: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  currentPriceMinorUnits: number;
  standardPriceMinorUnits: number;
  pricingType: PricingType;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: string;
  gracePeriodEndsAt?: string;
  paymentStatus: PaymentStatus;
  portalUrl: string;
  features: ResolvedFeature[];
  highlightFeatureIds: string[];
  usage: UsageMetric[];
}

/* -------------------------------------------------------------------------- */
/* Internal → backend plan id mapping                                          */
/* -------------------------------------------------------------------------- */

export function toBackendPlanId(plan: VendorPlan): PlanId {
  return plan === 'pro+' ? 'pro_plus' : plan;
}

export function fromBackendPlanId(id: PlanId): VendorPlan {
  return id === 'pro_plus' ? 'pro+' : id;
}

/* -------------------------------------------------------------------------- */
/* Country name → ISO code mapping (VendorPlanContext uses full names)         */
/* -------------------------------------------------------------------------- */

const COUNTRY_NAME_TO_CODE: Record<BusinessCountry, string> = {
  'Nigeria': 'NG',
  'Ghana': 'GH',
  'Kenya': 'KE',
  'Egypt': 'EG',
  'South Africa': 'ZA',
  'Morocco': 'MA',
  'Turkey': 'TR',
  'United Kingdom': 'GB',
  'Canada': 'CA',
  'Australia': 'AU',
  'United States': 'US',
};

/* -------------------------------------------------------------------------- */
/* Feature id constants (kept in one place so the CMS can reference them)      */
/* -------------------------------------------------------------------------- */

const F = {
  catalogItems: 'catalog_items',
  photosPerItem: 'photos_per_item',
  activePromotions: 'active_promotions',
  minOrderSettings: 'minimum_order_settings',
  businessPolicies: 'business_policies',
  aiReplies: 'ai_replies',
  aiInsights: 'ai_insights',
  unlimitedOrders: 'unlimited_orders',
  externalOrderRecording: 'external_order_recording',
  autoSendPickup: 'auto_send_pickup_details',
  autoAccept: 'auto_accept_orders',
  invoicesPerMonth: 'invoices_per_month',
  invoiceHistory: 'invoice_history',
  invoiceBranding: 'invoice_branding',
  invoiceSearch: 'invoice_search_and_filters',
  duplicateInvoice: 'duplicate_invoice',
  pdfDownload: 'pdf_download',
  revenueTrend: 'revenue_trend',
  conversionFunnel: 'conversion_funnel',
  customerGrowth: 'customer_growth',
  storefrontPerformance: 'storefront_performance',
  topCustomers: 'top_customers',
  repeatCustomerAnalytics: 'repeat_customer_analytics',
  customerSourceBreakdown: 'customer_source_breakdown',
  ordersBySource: 'orders_by_source',
  platformVsExternal: 'platform_vs_external_analytics',
  vendorStorefront: 'vendor_storefront',
  orderRequests: 'order_requests',
  customUsername: 'custom_username',
} as const;

/* -------------------------------------------------------------------------- */
/* THE CATALOG                                                                 */
/* -------------------------------------------------------------------------- */

export const MOCK_PLAN_CATALOG: PlanCatalog = {
  countryCode: 'NG',
  currencyCode: 'NGN',
  currencySymbol: '₦',
  launchSale: {
    active: true,
    founderCapPerCountry: 300,
    promoEndsAt: null,
    renewsAtStandardPrice: true,
  },
  vendorPortalBaseUrl: 'https://vendor.example.com',

  /* ---------------------------- Country pricing --------------------------- */
  countries: [
    {
      code: 'NG', name: 'Nigeria', band: 'A', currencyCode: 'NGN', currencySymbol: '₦',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 900000, standardMonthlyMinorUnits: 900000, launchMonthlyMinorUnits: 600000 },
        pro: { monthlyMinorUnits: 2000000, standardMonthlyMinorUnits: 2000000, launchMonthlyMinorUnits: 1500000 },
        pro_plus: { monthlyMinorUnits: 5000000, standardMonthlyMinorUnits: 5000000, launchMonthlyMinorUnits: 3500000 },
      },
    },
    {
      code: 'GH', name: 'Ghana', band: 'A', currencyCode: 'GHS', currencySymbol: 'GH₵',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 8500, standardMonthlyMinorUnits: 8500, launchMonthlyMinorUnits: 6000 },
        pro: { monthlyMinorUnits: 24000, standardMonthlyMinorUnits: 24000, launchMonthlyMinorUnits: 18000 },
        pro_plus: { monthlyMinorUnits: 60000, standardMonthlyMinorUnits: 60000, launchMonthlyMinorUnits: 42000 },
      },
    },
    {
      code: 'KE', name: 'Kenya', band: 'A', currencyCode: 'KES', currencySymbol: 'KSh',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 190000, standardMonthlyMinorUnits: 190000, launchMonthlyMinorUnits: 135000 },
        pro: { monthlyMinorUnits: 540000, standardMonthlyMinorUnits: 540000, launchMonthlyMinorUnits: 405000 },
        pro_plus: { monthlyMinorUnits: 1350000, standardMonthlyMinorUnits: 1350000, launchMonthlyMinorUnits: 945000 },
      },
    },
    {
      code: 'EG', name: 'Egypt', band: 'A', currencyCode: 'EGP', currencySymbol: 'E£',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 74000, standardMonthlyMinorUnits: 74000, launchMonthlyMinorUnits: 53000 },
        pro: { monthlyMinorUnits: 210000, standardMonthlyMinorUnits: 210000, launchMonthlyMinorUnits: 157500 },
        pro_plus: { monthlyMinorUnits: 525000, standardMonthlyMinorUnits: 525000, launchMonthlyMinorUnits: 367500 },
      },
    },
    {
      code: 'ZA', name: 'South Africa', band: 'B', currencyCode: 'ZAR', currencySymbol: 'R',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 27000, standardMonthlyMinorUnits: 27000, launchMonthlyMinorUnits: 19000 },
        pro: { monthlyMinorUnits: 72000, standardMonthlyMinorUnits: 72000, launchMonthlyMinorUnits: 54000 },
        pro_plus: { monthlyMinorUnits: 162000, standardMonthlyMinorUnits: 162000, launchMonthlyMinorUnits: 113500 },
      },
    },
    {
      code: 'MA', name: 'Morocco', band: 'B', currencyCode: 'MAD', currencySymbol: 'MAD',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 15000, standardMonthlyMinorUnits: 15000, launchMonthlyMinorUnits: 10500 },
        pro: { monthlyMinorUnits: 40000, standardMonthlyMinorUnits: 40000, launchMonthlyMinorUnits: 30000 },
        pro_plus: { monthlyMinorUnits: 90000, standardMonthlyMinorUnits: 90000, launchMonthlyMinorUnits: 63000 },
      },
    },
    {
      code: 'TR', name: 'Turkey', band: 'B', currencyCode: 'TRY', currencySymbol: '₺',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 53000, standardMonthlyMinorUnits: 53000, launchMonthlyMinorUnits: 37000 },
        pro: { monthlyMinorUnits: 141000, standardMonthlyMinorUnits: 141000, launchMonthlyMinorUnits: 106000 },
        pro_plus: { monthlyMinorUnits: 318000, standardMonthlyMinorUnits: 318000, launchMonthlyMinorUnits: 222500 },
      },
    },
    {
      code: 'GB', name: 'United Kingdom', band: 'C', currencyCode: 'GBP', currencySymbol: '£',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 2000, standardMonthlyMinorUnits: 2000, launchMonthlyMinorUnits: 1400 },
        pro: { monthlyMinorUnits: 6000, standardMonthlyMinorUnits: 6000, launchMonthlyMinorUnits: 4500 },
        pro_plus: { monthlyMinorUnits: 12000, standardMonthlyMinorUnits: 12000, launchMonthlyMinorUnits: 8400 },
      },
    },
    {
      code: 'CA', name: 'Canada', band: 'C', currencyCode: 'CAD', currencySymbol: '$',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 3500, standardMonthlyMinorUnits: 3500, launchMonthlyMinorUnits: 2500 },
        pro: { monthlyMinorUnits: 10000, standardMonthlyMinorUnits: 10000, launchMonthlyMinorUnits: 7500 },
        pro_plus: { monthlyMinorUnits: 20000, standardMonthlyMinorUnits: 20000, launchMonthlyMinorUnits: 14000 },
      },
    },
    {
      code: 'AU', name: 'Australia', band: 'C', currencyCode: 'AUD', currencySymbol: '$',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 4000, standardMonthlyMinorUnits: 4000, launchMonthlyMinorUnits: 2800 },
        pro: { monthlyMinorUnits: 11500, standardMonthlyMinorUnits: 11500, launchMonthlyMinorUnits: 8600 },
        pro_plus: { monthlyMinorUnits: 23000, standardMonthlyMinorUnits: 23000, launchMonthlyMinorUnits: 16100 },
      },
    },
    {
      code: 'US', name: 'United States', band: 'D', currencyCode: 'USD', currencySymbol: '$',
      plans: {
        basic: { monthlyMinorUnits: 0, standardMonthlyMinorUnits: 0, launchMonthlyMinorUnits: 0 },
        standard: { monthlyMinorUnits: 2900, standardMonthlyMinorUnits: 2900, launchMonthlyMinorUnits: 2000 },
        pro: { monthlyMinorUnits: 9900, standardMonthlyMinorUnits: 9900, launchMonthlyMinorUnits: 7400 },
        pro_plus: { monthlyMinorUnits: 19900, standardMonthlyMinorUnits: 19900, launchMonthlyMinorUnits: 13900 },
      },
    },
  ],

  /* ------------------------------- Plans ---------------------------------- */
  plans: [
    /* ----------------------------- Basic ---------------------------------- */
    {
      id: 'basic',
      name: 'Basic',
      tagline: 'Get started with a storefront and manual orders.',
      status: 'active',
      displayOrder: 1,
      billingInterval: 'monthly',
      features: [
        { id: F.vendorStorefront, label: 'Vendor storefront', category: 'storefront', included: true, order: 1 },
        { id: F.catalogItems, label: 'Catalog items', category: 'storefront', value: 10, order: 2 },
        { id: F.photosPerItem, label: 'Photos per item', category: 'storefront', value: 2, order: 3 },
        { id: F.activePromotions, label: 'Active promotions', category: 'storefront', order: 4 },
        { id: F.minOrderSettings, label: 'Minimum-order settings', category: 'storefront', order: 5 },
        { id: F.businessPolicies, label: 'Business policies', category: 'storefront', order: 6 },
        { id: F.aiReplies, label: 'Ask Platform AI replies', category: 'ai', value: 0, unit: 'per month', order: 1 },
        { id: F.aiInsights, label: 'AI business insights', category: 'ai', value: 1, order: 2 },
        { id: F.orderRequests, label: 'Order requests', category: 'orders', included: true, order: 1 },
        { id: F.unlimitedOrders, label: 'Unlimited orders', category: 'orders', included: true, order: 2 },
        // Recording an order placed outside Platform is free on every plan
        // (canAccessExternalOrders is true for all four tiers on the real
        // backend) — the paid line sits at the platform-vs-external
        // analytics comparison instead. This entry previously had no
        // `included`, so Basic vendors saw it marked unavailable and it was
        // silently omitted from Basic's card on the Upgrade Plan comparison,
        // contradicting the real, already-enforced entitlement.
        { id: F.externalOrderRecording, label: 'External-order recording', category: 'orders', included: true, order: 3 },
        { id: F.autoSendPickup, label: 'Auto-send pickup details', category: 'orders', order: 4 },
        { id: F.autoAccept, label: 'Auto-accept orders', category: 'orders', order: 5 },
        { id: F.invoicesPerMonth, label: 'Invoices per month', category: 'invoices', order: 1 },
        { id: F.invoiceHistory, label: 'Invoice history', category: 'invoices', order: 2 },
        { id: F.invoiceBranding, label: 'Invoice branding', category: 'invoices', text: 'Default Platform template (logo only)', order: 3 },
        { id: F.invoiceSearch, label: 'Invoice search and filters', category: 'invoices', order: 4 },
        { id: F.duplicateInvoice, label: 'Duplicate invoice', category: 'invoices', order: 5 },
        { id: F.pdfDownload, label: 'PDF download', category: 'invoices', order: 6 },
        { id: F.revenueTrend, label: 'Revenue trend', category: 'analytics', order: 1 },
        { id: F.conversionFunnel, label: 'Conversion funnel', category: 'analytics', order: 2 },
        { id: F.customerGrowth, label: 'Customer growth', category: 'analytics', order: 3 },
        { id: F.storefrontPerformance, label: 'Storefront performance', category: 'analytics', order: 4 },
        { id: F.topCustomers, label: 'Top customers', category: 'analytics', order: 5 },
        { id: F.repeatCustomerAnalytics, label: 'Repeat-customer analytics', category: 'analytics', order: 6 },
        { id: F.customerSourceBreakdown, label: 'Customer-source breakdown', category: 'analytics', order: 7 },
        { id: F.ordersBySource, label: 'Orders by source', category: 'analytics', order: 8 },
        { id: F.platformVsExternal, label: 'Platform vs. external analytics', category: 'analytics', order: 9 },
        { id: F.customUsername, label: 'Custom @username', category: 'account', order: 1 },
      ],
      highlightFeatureIds: [
        F.catalogItems, F.photosPerItem, F.aiReplies, F.aiInsights,
        F.vendorStorefront, F.orderRequests,
      ],
      usage: [
        { featureId: F.catalogItems, current: 4 },
      ],
    },

    /* ---------------------------- Standard -------------------------------- */
    {
      id: 'standard',
      name: 'Standard',
      tagline: 'Custom username, invoices, and external orders.',
      status: 'active',
      displayOrder: 2,
      billingInterval: 'monthly',
      features: [
        { id: F.vendorStorefront, label: 'Vendor storefront', category: 'storefront', included: true, order: 1 },
        { id: F.catalogItems, label: 'Catalog items', category: 'storefront', value: 30, order: 2 },
        { id: F.photosPerItem, label: 'Photos per item', category: 'storefront', value: 5, order: 3 },
        { id: F.activePromotions, label: 'Active promotions', category: 'storefront', order: 4 },
        { id: F.minOrderSettings, label: 'Minimum-order settings', category: 'storefront', order: 5 },
        { id: F.businessPolicies, label: 'Business policies', category: 'storefront', order: 6 },
        { id: F.aiReplies, label: 'Ask Platform AI replies', category: 'ai', value: 100, unit: 'per month', order: 1 },
        { id: F.aiInsights, label: 'AI business insights', category: 'ai', value: 3, order: 2 },
        { id: F.orderRequests, label: 'Order requests', category: 'orders', included: true, order: 1 },
        { id: F.unlimitedOrders, label: 'Unlimited orders', category: 'orders', included: true, order: 2 },
        { id: F.externalOrderRecording, label: 'External-order recording', category: 'orders', included: true, order: 3 },
        { id: F.autoSendPickup, label: 'Auto-send pickup details', category: 'orders', order: 4 },
        { id: F.autoAccept, label: 'Auto-accept orders', category: 'orders', order: 5 },
        { id: F.invoicesPerMonth, label: 'Invoices per month', category: 'invoices', value: 25, order: 1 },
        { id: F.invoiceHistory, label: 'Invoice history', category: 'invoices', value: 6, unit: 'months', order: 2 },
        { id: F.invoiceBranding, label: 'Invoice branding', category: 'invoices', text: 'Logo, brand color, thank-you message and footer', order: 3 },
        { id: F.invoiceSearch, label: 'Invoice search and filters', category: 'invoices', included: true, order: 4 },
        { id: F.duplicateInvoice, label: 'Duplicate invoice', category: 'invoices', order: 5 },
        { id: F.pdfDownload, label: 'PDF download', category: 'invoices', included: true, order: 6 },
        { id: F.revenueTrend, label: 'Revenue trend', category: 'analytics', order: 1 },
        { id: F.conversionFunnel, label: 'Conversion funnel', category: 'analytics', order: 2 },
        { id: F.customerGrowth, label: 'Customer growth', category: 'analytics', order: 3 },
        { id: F.storefrontPerformance, label: 'Storefront performance', category: 'analytics', order: 4 },
        { id: F.topCustomers, label: 'Top customers', category: 'analytics', order: 5 },
        { id: F.repeatCustomerAnalytics, label: 'Repeat-customer analytics', category: 'analytics', order: 6 },
        { id: F.customerSourceBreakdown, label: 'Customer-source breakdown', category: 'analytics', order: 7 },
        { id: F.ordersBySource, label: 'Orders by source', category: 'analytics', order: 8 },
        { id: F.platformVsExternal, label: 'Platform vs. external analytics', category: 'analytics', order: 9 },
        { id: F.customUsername, label: 'Custom @username', category: 'account', included: true, order: 1 },
      ],
      highlightFeatureIds: [
        F.catalogItems, F.aiReplies, F.invoicesPerMonth, F.invoiceHistory,
        F.externalOrderRecording, F.customUsername,
      ],
      usage: [
        { featureId: F.catalogItems, current: 18 },
        { featureId: F.invoicesPerMonth, current: 9 },
        { featureId: F.aiReplies, current: 41 },
      ],
    },

    /* ------------------------------- Pro ---------------------------------- */
    {
      id: 'pro',
      name: 'Pro',
      tagline: 'Automation, promotions, and branded invoices.',
      status: 'active',
      displayOrder: 3,
      billingInterval: 'monthly',
      features: [
        { id: F.vendorStorefront, label: 'Vendor storefront', category: 'storefront', included: true, order: 1 },
        { id: F.catalogItems, label: 'Catalog items', category: 'storefront', value: 100, order: 2 },
        { id: F.photosPerItem, label: 'Photos per item', category: 'storefront', value: 10, order: 3 },
        { id: F.activePromotions, label: 'Active promotions', category: 'storefront', value: 10, order: 4 },
        { id: F.minOrderSettings, label: 'Minimum-order settings', category: 'storefront', order: 5 },
        { id: F.businessPolicies, label: 'Business policies', category: 'storefront', order: 6 },
        { id: F.aiReplies, label: 'Ask Platform AI replies', category: 'ai', value: 300, unit: 'per month', order: 1 },
        { id: F.aiInsights, label: 'AI business insights', category: 'ai', value: 10, order: 2 },
        { id: F.orderRequests, label: 'Order requests', category: 'orders', included: true, order: 1 },
        { id: F.unlimitedOrders, label: 'Unlimited orders', category: 'orders', included: true, order: 2 },
        { id: F.externalOrderRecording, label: 'External-order recording', category: 'orders', included: true, order: 3 },
        { id: F.autoSendPickup, label: 'Auto-send pickup details', category: 'orders', included: true, order: 4 },
        { id: F.autoAccept, label: 'Auto-accept orders', category: 'orders', included: true, order: 5 },
        { id: F.invoicesPerMonth, label: 'Invoices per month', category: 'invoices', value: 75, order: 1 },
        { id: F.invoiceHistory, label: 'Invoice history', category: 'invoices', value: 12, unit: 'months', order: 2 },
        { id: F.invoiceBranding, label: 'Invoice branding', category: 'invoices', text: 'Logo, brand color, thank-you message and footer', order: 3 },
        { id: F.invoiceSearch, label: 'Invoice search and filters', category: 'invoices', included: true, order: 4 },
        { id: F.duplicateInvoice, label: 'Duplicate invoice', category: 'invoices', included: true, order: 5 },
        { id: F.pdfDownload, label: 'PDF download', category: 'invoices', included: true, order: 6 },
        { id: F.revenueTrend, label: 'Revenue trend', category: 'analytics', order: 1 },
        { id: F.conversionFunnel, label: 'Conversion funnel', category: 'analytics', order: 2 },
        { id: F.customerGrowth, label: 'Customer growth', category: 'analytics', order: 3 },
        { id: F.storefrontPerformance, label: 'Storefront performance', category: 'analytics', order: 4 },
        { id: F.topCustomers, label: 'Top customers', category: 'analytics', order: 5 },
        { id: F.repeatCustomerAnalytics, label: 'Repeat-customer analytics', category: 'analytics', order: 6 },
        { id: F.customerSourceBreakdown, label: 'Customer-source breakdown', category: 'analytics', order: 7 },
        { id: F.ordersBySource, label: 'Orders by source', category: 'analytics', order: 8 },
        { id: F.platformVsExternal, label: 'Platform vs. external analytics', category: 'analytics', order: 9 },
        { id: F.customUsername, label: 'Custom @username', category: 'account', included: true, order: 1 },
      ],
      highlightFeatureIds: [
        F.catalogItems, F.aiReplies, F.invoicesPerMonth, F.activePromotions,
        F.autoAccept, F.autoSendPickup,
      ],
      usage: [
        { featureId: F.catalogItems, current: 62 },
        { featureId: F.invoicesPerMonth, current: 24 },
        { featureId: F.aiReplies, current: 132 },
        { featureId: F.activePromotions, current: 4 },
      ],
    },

    /* ------------------------------ Pro+ ---------------------------------- */
    {
      id: 'pro_plus',
      name: 'Pro+',
      tagline: 'Everything Pro, plus premium templates and full analytics.',
      status: 'active',
      displayOrder: 4,
      billingInterval: 'monthly',
      features: [
        { id: F.vendorStorefront, label: 'Vendor storefront', category: 'storefront', included: true, order: 1 },
        { id: F.catalogItems, label: 'Catalog items', category: 'storefront', value: 250, order: 2 },
        { id: F.photosPerItem, label: 'Photos per item', category: 'storefront', value: 15, order: 3 },
        { id: F.activePromotions, label: 'Active promotions', category: 'storefront', value: 25, order: 4 },
        { id: F.minOrderSettings, label: 'Minimum-order settings', category: 'storefront', order: 5 },
        { id: F.businessPolicies, label: 'Business policies', category: 'storefront', order: 6 },
        { id: F.aiReplies, label: 'Ask Platform AI replies', category: 'ai', value: 500, unit: 'per month', order: 1 },
        { id: F.aiInsights, label: 'AI business insights', category: 'ai', value: 25, order: 2 },
        { id: F.orderRequests, label: 'Order requests', category: 'orders', included: true, order: 1 },
        { id: F.unlimitedOrders, label: 'Unlimited orders', category: 'orders', included: true, order: 2 },
        { id: F.externalOrderRecording, label: 'External-order recording', category: 'orders', included: true, order: 3 },
        { id: F.autoSendPickup, label: 'Auto-send pickup details', category: 'orders', included: true, order: 4 },
        { id: F.autoAccept, label: 'Auto-accept orders', category: 'orders', included: true, order: 5 },
        { id: F.invoicesPerMonth, label: 'Invoices per month', category: 'invoices', value: 200, order: 1 },
        { id: F.invoiceHistory, label: 'Invoice history', category: 'invoices', value: 36, unit: 'months', order: 2 },
        { id: F.invoiceBranding, label: 'Invoice branding', category: 'invoices', text: 'Logo, brand color, thank-you message, footer, premium templates, seasonal themes', order: 3 },
        { id: F.invoiceSearch, label: 'Invoice search and filters', category: 'invoices', included: true, order: 4 },
        { id: F.duplicateInvoice, label: 'Duplicate invoice', category: 'invoices', included: true, order: 5 },
        { id: F.pdfDownload, label: 'PDF download', category: 'invoices', included: true, order: 6 },
        { id: F.revenueTrend, label: 'Revenue trend', category: 'analytics', included: true, order: 1 },
        { id: F.conversionFunnel, label: 'Conversion funnel', category: 'analytics', included: true, order: 2 },
        { id: F.customerGrowth, label: 'Customer growth', category: 'analytics', included: true, order: 3 },
        { id: F.storefrontPerformance, label: 'Storefront performance', category: 'analytics', included: true, order: 4 },
        { id: F.topCustomers, label: 'Top customers', category: 'analytics', included: true, order: 5 },
        { id: F.repeatCustomerAnalytics, label: 'Repeat-customer analytics', category: 'analytics', included: true, order: 6 },
        { id: F.customerSourceBreakdown, label: 'Customer-source breakdown', category: 'analytics', included: true, order: 7 },
        { id: F.ordersBySource, label: 'Orders by source', category: 'analytics', included: true, order: 8 },
        { id: F.platformVsExternal, label: 'Platform vs. external analytics', category: 'analytics', included: true, order: 9 },
        { id: F.customUsername, label: 'Custom @username', category: 'account', included: true, order: 1 },
      ],
      highlightFeatureIds: [
        F.catalogItems, F.aiReplies, F.invoicesPerMonth, F.invoiceHistory,
        F.invoiceBranding, F.revenueTrend,
      ],
      usage: [
        { featureId: F.catalogItems, current: 84 },
        { featureId: F.invoicesPerMonth, current: 37 },
        { featureId: F.aiReplies, current: 218 },
        { featureId: F.activePromotions, current: 8 },
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* Accessors                                                                   */
/* -------------------------------------------------------------------------- */

/** Returns the raw mock catalog. Henry swaps this for the backend/CMS response. */
export function getPlanCatalog(): PlanCatalog {
  return MOCK_PLAN_CATALOG;
}

/** Look up a country entry by full name (VendorPlanContext) or ISO code. */
export function getCatalogCountry(country: string): CatalogCountry | null {
  return (
    MOCK_PLAN_CATALOG.countries.find((c) => c.name === country || c.code === country) ?? null
  );
}

/** Get a raw plan definition by backend plan id. */
export function getCatalogPlan(planId: PlanId): CatalogPlan | null {
  return MOCK_PLAN_CATALOG.plans.find((p) => p.id === planId) ?? null;
}

/** Ordered list of active plan ids (lowest tier first). */
export function getOrderedActivePlanIds(): PlanId[] {
  return [...MOCK_PLAN_CATALOG.plans]
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((p) => p.id);
}

/* -------------------------------------------------------------------------- */
/* Real backend limits — subscriptionPlans/{planId}                            */
/* -------------------------------------------------------------------------- */

/**
 * The numeric limit fields on `subscriptionPlans/{planId}` (see backend
 * planLimitsSeedData.ts's PlanLimits), mapped to the catalog feature ids they
 * correspond to. Only numeric limits are covered here, not the boolean
 * capability flags (canAutoAcceptOrders, canShowAIButton, etc.) or pricing —
 * those still come from the mock catalog. This is scoped to the specific,
 * reported failure: a vendor's real plan limit (Basic tightened to 7 items /
 * 1 photo) no longer matching what this screen showed, because it was never
 * reading the real subscriptionPlans document at all.
 */
const LIMIT_FEATURE_TO_BACKEND_FIELD: Record<string, string> = {
  [F.catalogItems]: 'catalogItemLimit',
  [F.photosPerItem]: 'photosPerItemLimit',
  [F.aiReplies]: 'aiRepliesPerMonth',
  [F.aiInsights]: 'aiInsightsLimit',
  [F.invoicesPerMonth]: 'invoicesPerMonth',
  [F.activePromotions]: 'activePromotionsLimit',
};

export type RealPlanLimits = Partial<Record<string, number>>;

/** Reads subscriptionPlans/{planId} → { catalogItemLimit, photosPerItemLimit, ... } per plan id. Public collection, no auth required. */
export async function fetchRealPlanLimits(): Promise<Record<PlanId, RealPlanLimits> | null> {
  try {
    const snap = await getDocs(collection(db, 'subscriptionPlans'));
    const result: Record<string, RealPlanLimits> = {};
    snap.forEach((docSnap) => {
      result[docSnap.id] = docSnap.data() as RealPlanLimits;
    });
    return result as Record<PlanId, RealPlanLimits>;
  } catch (error) {
    console.error('[planCatalog] Failed to fetch real plan limits:', error);
    return null;
  }
}

/**
 * Returns a copy of the catalog with each plan's numeric limit features
 * overridden by the real value from subscriptionPlans, where one was
 * fetched. Falls back to the mock value untouched for anything not in
 * LIMIT_FEATURE_TO_BACKEND_FIELD, or if realLimits is null (not fetched yet /
 * fetch failed) — the screen still renders, just with the same mock numbers
 * as before rather than blocking on the network.
 */
export function applyRealPlanLimits(
  catalog: PlanCatalog,
  realLimits: Record<PlanId, RealPlanLimits> | null,
): PlanCatalog {
  if (!realLimits) return catalog;
  return {
    ...catalog,
    plans: catalog.plans.map((plan) => {
      const real = realLimits[plan.id];
      if (!real) return plan;
      return {
        ...plan,
        features: plan.features.map((feature) => {
          // invoiceHistoryDays doesn't fit the generic 1:1 map below: the
          // catalog displays this feature in months (a friendlier unit than
          // a raw day count), so overriding value with the real day count
          // directly would show e.g. "180 months" instead of "6 months".
          // Basic (30 days), Standard (180), Pro (548) and Pro+ (1095) were
          // clearly designed as 1/6/18/36 months stored as day-equivalents
          // (dividing by the ~30.4-day average month recovers exactly those
          // integers), so that's the conversion applied here rather than a
          // straight field copy. Without this, Basic showed no invoice
          // history at all (the mock catalog never listed a value for it)
          // and Pro showed a hardcoded 12 months against a real entitlement
          // of about 18.
          if (feature.id === F.invoiceHistory) {
            const realDays = real.invoiceHistoryDays;
            if (typeof realDays !== 'number') return feature;
            return { ...feature, value: Math.round(realDays / 30.4), unit: 'months' as const };
          }
          const backendField = LIMIT_FEATURE_TO_BACKEND_FIELD[feature.id];
          if (!backendField) return feature;
          const realValue = real[backendField];
          if (typeof realValue !== 'number') return feature;
          return { ...feature, value: realValue };
        }),
      };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Resolvers — fill in country-specific pricing                                */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the full catalog for a specific country, with each plan's prices
 * filled in based on launch-sale eligibility.
 */
export function resolveCatalogForCountry(
  country: string,
  founderPricingEligible: boolean,
  realLimits?: Record<PlanId, RealPlanLimits> | null,
): ResolvedCatalog {
  const catalog = applyRealPlanLimits(MOCK_PLAN_CATALOG, realLimits ?? null);
  const countryEntry = getCatalogCountry(country);
  const currencyCode = countryEntry?.currencyCode ?? catalog.currencyCode;
  const currencySymbol = countryEntry?.currencySymbol ?? catalog.currencySymbol;
  const countryCode = countryEntry?.code ?? catalog.countryCode;
  const countryName = countryEntry?.name ?? country;
  const launchActive = catalog.launchSale.active && founderPricingEligible;

  const plans: ResolvedPlan[] = catalog.plans
    .filter((p) => p.status === 'active')
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((plan) => {
      const pricing = countryEntry?.plans[plan.id];
      const monthlyPrice = pricing?.monthlyMinorUnits ?? 0;
      const standardPrice = pricing?.standardMonthlyMinorUnits ?? 0;
      const launchPrice = pricing?.launchMonthlyMinorUnits ?? monthlyPrice;

      const usesLaunch = launchActive && launchPrice < standardPrice;
      const resolvedMonthly = usesLaunch ? launchPrice : monthlyPrice;
      const pricingType: PricingType = plan.id === 'basic'
        ? 'standard'
        : usesLaunch
        ? 'launch'
        : 'standard';

      return {
        id: plan.id,
        name: plan.name,
        tagline: plan.tagline,
        status: plan.status,
        displayOrder: plan.displayOrder,
        billingInterval: plan.billingInterval,
        monthlyPriceMinorUnits: resolvedMonthly,
        standardPriceMinorUnits: standardPrice,
        pricingType,
        features: plan.features,
        highlightFeatureIds: plan.highlightFeatureIds,
        usage: plan.usage,
      };
    });

  return {
    countryCode,
    countryName,
    currencyCode,
    currencySymbol,
    launchSale: catalog.launchSale,
    vendorPortalBaseUrl: catalog.vendorPortalBaseUrl,
    plans,
  };
}

/** Resolve a single plan for a country. */
export function resolvePlan(
  planId: PlanId,
  country: string,
  founderPricingEligible: boolean,
  realLimits?: Record<PlanId, RealPlanLimits> | null,
): ResolvedPlan | null {
  const resolved = resolveCatalogForCountry(country, founderPricingEligible, realLimits);
  return resolved.plans.find((p) => p.id === planId) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Feature display helpers                                                     */
/* -------------------------------------------------------------------------- */

/** True if the feature is available (has a value, is included, or has text). */
export function isFeatureAvailable(feature: ResolvedFeature): boolean {
  return feature.included === true || feature.value !== undefined || feature.text !== undefined;
}

/** Human-readable display value for a feature. */
export function getFeatureDisplayValue(feature: ResolvedFeature): string {
  if (feature.included === true) return 'Included';
  if (feature.value !== undefined) return String(feature.value);
  if (feature.text !== undefined) return feature.text;
  return '—';
}

/** Features in a category, sorted by display order. */
export function getFeaturesByCategory(
  features: ResolvedFeature[],
  category: FeatureCategory,
): ResolvedFeature[] {
  return features
    .filter((f) => f.category === category)
    .sort((a, b) => a.order - b.order);
}

/** Minimal shape required by getHighlightFeatures. */
export interface FeatureCollection {
  features: ResolvedFeature[];
  highlightFeatureIds: string[];
}

/** Highlight features (snapshot), sorted by their order in highlightFeatureIds. */
export function getHighlightFeatures(plan: FeatureCollection): ResolvedFeature[] {
  return plan.highlightFeatureIds
    .map((id) => plan.features.find((f) => f.id === id))
    .filter((f): f is ResolvedFeature => f !== undefined);
}

/** Category display titles. */
export const CATEGORY_TITLES: Record<FeatureCategory, string> = {
  storefront: 'Storefront and catalog',
  ai: 'AI',
  orders: 'Orders',
  invoices: 'Invoices',
  analytics: 'Analytics',
  account: 'Account',
};

/** Ordered categories for the plan-details page. */
export const CATEGORY_ORDER: FeatureCategory[] = [
  'storefront', 'ai', 'orders', 'invoices', 'analytics', 'account',
];

/* -------------------------------------------------------------------------- */
/* Usage helpers                                                               */
/* -------------------------------------------------------------------------- */

/** Build usage metrics with current values against plan feature limits. */
export function buildUsageMetrics(plan: ResolvedPlan): UsageMetric[] {
  return plan.usage
    .map((u) => {
      const feature = plan.features.find((f) => f.id === u.featureId);
      if (!feature || feature.value === undefined) return null;
      return {
        featureId: feature.id,
        label: feature.label,
        current: u.current,
        limit: feature.value,
      };
    })
    .filter((m): m is UsageMetric => m !== null);
}

/* -------------------------------------------------------------------------- */
/* Formatting helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Format a minor-units amount as a display string with currency symbol. */
export function formatMinorUnits(
  minorUnits: number,
  currencySymbol: string,
): string {
  if (minorUnits === 0) return 'Free';
  const major = minorUnits / 100;
  return `${currencySymbol}${major.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

/** Format a minor-units amount with a per-month suffix. */
export function formatMonthlyPrice(
  minorUnits: number,
  currencySymbol: string,
): string {
  return `${formatMinorUnits(minorUnits, currencySymbol)}/month`;
}

/** Format an ISO date as "Aug 18, 2026". */
export function formatSubscriptionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/* -------------------------------------------------------------------------- */
/* Vendor subscription builder                                                 */
/* -------------------------------------------------------------------------- */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * ONE_DAY_MS).toISOString();
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * ONE_DAY_MS).toISOString();
}

export interface BuildSubscriptionInput {
  plan: VendorPlan;
  businessCountry: BusinessCountry;
  founderPricingEligible: boolean;
  cancellationScheduled: boolean;
  cancellationDate: string | null;
  paymentStatusOverride?: PaymentStatus;
  realLimits?: Record<PlanId, RealPlanLimits> | null;
  /** Real count of this vendor's non-hidden catalog items — the same set createCatalogItem counts against the limit. Falls back to the catalog's mock usage number if omitted. */
  catalogItemsUsed?: number;
}

/**
 * Build a backend-shaped VendorSubscription from the mock catalog.
 * This is the mock equivalent of reading `vendorSubscriptions/{vendorId}`.
 * Henry replaces this with a real backend read.
 */
export function buildVendorSubscription(input: BuildSubscriptionInput): VendorSubscription {
  const { plan, businessCountry, founderPricingEligible, cancellationScheduled, cancellationDate } = input;
  const planId = toBackendPlanId(plan);
  const resolved = resolvePlan(planId, businessCountry, founderPricingEligible, input.realLimits);
  const countryEntry = getCatalogCountry(businessCountry);
  const catalog = MOCK_PLAN_CATALOG;

  const fallbackPlan: ResolvedPlan = {
    id: 'basic',
    name: 'Basic',
    tagline: '',
    status: 'active',
    displayOrder: 1,
    billingInterval: 'monthly',
    monthlyPriceMinorUnits: 0,
    standardPriceMinorUnits: 0,
    pricingType: 'standard',
    features: [],
    highlightFeatureIds: [],
    usage: [],
  };

  const rp = resolved ?? fallbackPlan;
  const isPaid = plan !== 'basic';
  const paymentStatus: PaymentStatus = input.paymentStatusOverride ?? 'ok';

  let status: SubscriptionStatus;
  if (!isPaid) {
    status = 'basic';
  } else if (cancellationScheduled) {
    status = 'cancel_scheduled';
  } else if (paymentStatus === 'past_due') {
    status = 'past_due';
  } else if (paymentStatus === 'failed') {
    status = 'expired';
  } else {
    status = 'active';
  }

  const gracePeriodEndsAt =
    paymentStatus === 'grace' || paymentStatus === 'failed'
      ? isoDaysFromNow(5)
      : undefined;

  const periodEndIso = cancellationDate ?? isoDaysFromNow(30);

  return {
    planId,
    planName: rp.name,
    tagline: rp.tagline,
    status,
    billingInterval: rp.billingInterval,
    countryCode: countryEntry?.code ?? catalog.countryCode,
    countryName: countryEntry?.name ?? businessCountry,
    currencyCode: countryEntry?.currencyCode ?? catalog.currencyCode,
    currencySymbol: countryEntry?.currencySymbol ?? catalog.currencySymbol,
    currentPriceMinorUnits: rp.monthlyPriceMinorUnits,
    standardPriceMinorUnits: rp.standardPriceMinorUnits,
    pricingType: rp.pricingType,
    currentPeriodStart: isoDaysAgo(0),
    currentPeriodEnd: periodEndIso,
    cancelAtPeriodEnd: cancellationScheduled,
    cancelledAt: cancellationScheduled ? isoDaysAgo(1) : undefined,
    gracePeriodEndsAt,
    paymentStatus,
    portalUrl: `${catalog.vendorPortalBaseUrl}/subscription`,
    features: rp.features,
    highlightFeatureIds: rp.highlightFeatureIds,
    usage: buildUsageMetrics(rp).map((metric) =>
      metric.featureId === F.catalogItems && input.catalogItemsUsed !== undefined
        ? { ...metric, current: input.catalogItemsUsed }
        : metric
    ),
  };
}
