import type { VendorPlan, PlanLimits } from '@/contexts/VendorPlanContext';

/**
 * Plan-based document branding capabilities for invoices and receipts.
 *
 * This mirrors the backend-provided `PlanLimits` object
 * (functions/src/types4.ts in multivendor-marketplace-platform) so Henry can swap the source
 * of truth to Firestore later without touching UI. Branding is applied
 * automatically based on the vendor's plan — vendors never toggle it
 * manually. Tier boundaries below are intentionally kept in lockstep with
 * the backend's DEFAULT_PLAN_LIMITS — the backend feature matrix is the
 * source of truth; this file must not drift from it.
 */
export type DocumentTemplateId =
  | 'default'
  | 'classic'
  | 'modern'
  | 'elegant'
  | 'restaurant'
  | 'retail'
  | 'beauty';

export interface DocumentBranding {
  /** Template the vendor currently has selected/defaults to. An extensible
   * ID, not an entitlement name — which IDs are actually selectable is
   * governed by `allowPremiumTemplates` below, and the server independently
   * enforces which templates each plan may use regardless of what the
   * client sends. */
  templateId: DocumentTemplateId;
  /** Vendor name is always shown on documents */
  showVendorName: boolean;
  allowLogo: boolean;
  allowBrandColor: boolean;
  allowThankYouMessage: boolean;
  allowBrandedHeader: boolean;
  allowCustomFooter: boolean;
  /** Non-default template IDs (matches backend canUsePremiumTemplates) */
  allowPremiumTemplates: boolean;
  /** Printable receipt / packing slip support (Pro+; may be shown as locked/future) */
  allowPrintableDocs: boolean;
  /** How the "Powered by Platform" attribution renders */
  poweredByPlatform: 'visible' | 'subtle';
}

// Note (print layout): "Optimize for print" is NOT a vendor branding
// preference or plan-gated setting. Print/PDF rendering applies print
// styles automatically when the vendor uses Print or Download PDF — there
// is no `printLayout` field on the saved branding document. The renderer
// accepts a system-level `printMode` prop instead (see InvoiceRenderer).

const BASIC: DocumentBranding = {
  templateId: 'default',
  showVendorName: true,
  allowLogo: false,
  allowBrandColor: false,
  allowThankYouMessage: false,
  allowBrandedHeader: false,
  allowCustomFooter: false,
  allowPremiumTemplates: false,
  allowPrintableDocs: false,
  poweredByPlatform: 'visible',
};

const STANDARD: DocumentBranding = {
  ...BASIC,
  allowLogo: true,
};

// Backend feature matrix (functions/src/subscriptions/planLimitsSeedData.ts):
// brand color, thank-you message, and footer text are ALL available from
// Pro — footer text was previously gated to Pro+ here, which didn't match
// the backend and has been corrected.
const PRO: DocumentBranding = {
  ...STANDARD,
  allowBrandColor: true,
  allowThankYouMessage: true,
  allowBrandedHeader: true,
  allowCustomFooter: true,
  poweredByPlatform: 'subtle',
};

const PRO_PLUS: DocumentBranding = {
  ...PRO,
  allowPremiumTemplates: true,
  allowPrintableDocs: true,
};

/**
 * Resolve the document branding capabilities for a vendor plan.
 *
 * When the real PlanLimits object (getSubscriptionStatus, VendorPlanContext)
 * is available, capabilities are read directly from it — canUploadLogo,
 * canSetBrandColor, etc. — rather than this file's hardcoded per-plan
 * tables, which the file's own header comment already flagged as a
 * manual-sync liability ("must not drift from it"). The hardcoded tables
 * remain only as the fallback for the brief window before the first
 * getSubscriptionStatus response lands (app boot, signed-out preview), so
 * the UI still has something reasonable to render immediately.
 */
export function getDocumentBranding(plan: VendorPlan, realLimits?: PlanLimits | null): DocumentBranding {
  if (realLimits) {
    const fallback = getDocumentBrandingFallback(plan);
    return {
      templateId: fallback.templateId,
      showVendorName: true,
      allowLogo: realLimits.canUploadLogo,
      allowBrandColor: realLimits.canSetBrandColor,
      allowThankYouMessage: realLimits.canSetThankYouMessage,
      allowBrandedHeader: realLimits.canSetBrandColor,
      allowCustomFooter: realLimits.canSetFooterText,
      allowPremiumTemplates: realLimits.canUsePremiumTemplates,
      allowPrintableDocs: realLimits.canUsePrintLayout,
      poweredByPlatform: realLimits.canSetBrandColor ? 'subtle' : 'visible',
    };
  }
  return getDocumentBrandingFallback(plan);
}

function getDocumentBrandingFallback(plan: VendorPlan): DocumentBranding {
  switch (plan) {
    case 'basic': return BASIC;
    case 'standard': return STANDARD;
    case 'pro': return PRO;
    case 'pro+': return PRO_PLUS;
    default: return BASIC;
  }
}

export interface BrandingUpgradePrompt {
  title: string;
  description: string;
}

/**
 * Dynamic plan-based upgrade messaging for the Invoices screen.
 * Returns null when the vendor already has every branding feature (Pro+).
 */
export function getBrandingUpgradePrompt(plan: VendorPlan): BrandingUpgradePrompt | null {
  switch (plan) {
    case 'basic':
      return {
        title: 'Upgrade to Standard',
        description: 'Add your logo to invoices and receipts.',
      };
    case 'standard':
      return {
        title: 'Upgrade to Pro',
        description: 'Customize brand color, add a thank-you message, and a custom footer.',
      };
    case 'pro':
      return {
        title: 'Upgrade to Pro+',
        description: 'Premium templates and printable receipts.',
      };
    case 'pro+':
    default:
      return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Invoice branding settings                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Vendor-saved invoice branding preferences. Persisted independently of plan
 * so a downgrade never deletes saved data — features are simply disabled in
 * `getEffectiveInvoiceBranding` based on the current plan's capabilities.
 *
 * The backend will eventually own this object under
 * `vendorBranding/{vendorId}` (Henry's Firestore doc). The local
 * `InvoiceBrandingContext` is the temporary source of truth and is shaped
 * to be a 1:1 drop-in for that document. Henry must persist:
 *   templateId, logoUrl, accentColor, thankYouMessage, footerText,
 *   seasonalTheme
 * (no printLayout — print/PDF styling is a system behavior, not branding).
 * (backend naming uses logoUrl/accentColor; UI uses logoUri/brandColor for
 * React Native Image source compatibility, but the save payload is mapped.)
 */
export interface InvoiceBrandingSettings {
  /** Local file:// uri or remote https URL for the uploaded logo. `null`
   * means no logo has been uploaded. Preserved across downgrades. */
  logoUri: string | null;
  /** Hex accent color (e.g. "#FF7A28"). `null` means "use Platform default". */
  brandColor: string | null;
  /** Optional thank-you headline shown under the vendor name. */
  thankYouMessage: string | null;
  /** Optional custom footer line shown below the totals. */
  footerText: string | null;
  /** Selected invoice template. Only premium IDs are gated by plan;
   * 'default' is always available. Saved value is preserved even when the
   * plan no longer permits it — `getEffectiveInvoiceBranding` falls back to
   * 'default' in that case. */
  templateId: DocumentTemplateId;
  /** Pro+ seasonal theme (e.g. 'holiday', 'valentine'). `null` = off. */
  seasonalTheme: string | null;
}

export const DEFAULT_INVOICE_BRANDING_SETTINGS: InvoiceBrandingSettings = {
  logoUri: null,
  brandColor: null,
  thankYouMessage: null,
  footerText: null,
  templateId: 'default',
  seasonalTheme: null,
};

/**
 * All invoice templates. The 'default' template is always available to every
 * plan; premium templates are Pro+ only and gated via the capability matrix.
 */
export interface InvoiceTemplateOption {
  id: DocumentTemplateId;
  name: string;
  description: string;
  /** Premium templates are locked for non-Pro+ plans. */
  isPremium: boolean;
  /** Short layout hint for the live preview tag. */
  layoutTag: string;
}

export const INVOICE_TEMPLATE_OPTIONS: InvoiceTemplateOption[] = [
  { id: 'default', name: 'Platform Default', description: 'Clean, standard layout', isPremium: false, layoutTag: 'Default' },
  { id: 'classic', name: 'Classic', description: 'Clean and professional', isPremium: true, layoutTag: 'Classic' },
  { id: 'modern', name: 'Modern', description: 'Bold and contemporary', isPremium: true, layoutTag: 'Modern' },
  { id: 'elegant', name: 'Elegant', description: 'Refined, serif accents', isPremium: true, layoutTag: 'Elegant' },
  { id: 'restaurant', name: 'Restaurant', description: 'Warm, menu-style layout', isPremium: true, layoutTag: 'Restaurant' },
  { id: 'retail', name: 'Retail', description: 'Compact, product-forward', isPremium: true, layoutTag: 'Retail' },
  { id: 'beauty', name: 'Beauty', description: 'Soft, rounded, lifestyle', isPremium: true, layoutTag: 'Beauty' },
];

/** Convenience list for Pro+ template selection. */
export const PREMIUM_TEMPLATE_OPTIONS: InvoiceTemplateOption[] = INVOICE_TEMPLATE_OPTIONS.filter(
  (t) => t.isPremium
);

/**
 * Combines the vendor's saved branding preferences with their current plan's
 * capabilities to produce the branding that should actually be rendered.
 *
 * This is the single source of truth for "what branding applies right now":
 * - Downgrades never delete saved data (we keep `settings` intact).
 * - If the plan no longer allows a feature, we fall back to the default
 *   (no logo, no brand color, default template, no thank-you/footer).
 *
 * Branding snapshot rule (Henry — please assess for MVP before external
 * invoice sharing goes live, not strictly a Phase 2 item):
 *   - Draft invoices may render using the vendor's current branding
 *     (i.e. this function).
 *   - When an invoice is first issued, sent or shared, capture an immutable
 *     `brandingSnapshot` on the invoice document and store it alongside the
 *     invoice data. The snapshot must include templateId, logoUri,
 *     accentColor/brandColor, thankYouMessage, footerText, seasonalTheme,
 *     and the vendor's effective plan tier at finalization time. (No
 *     printLayout — print/PDF styling is applied automatically by the
 *     renderer when generating PDF/print output.)
 *   - Paid invoices and any previously issued/sent/shared invoices must
 *     render from that snapshot, NOT from this function. This keeps a
 *     customer's copy visually stable even if the vendor later changes
 *     branding, switches templates, or downgrades plan.
 *   - Future vendor branding changes apply only to new invoices created
 *     after the change. Existing issued/paid invoices are never retroactively
 *     re-rendered with new branding.
 *   - Backend integration note: when `brandingSnapshot` is added to the
 *     invoice document, the public/internal invoice pages should branch on
 *     invoice status — draft → getEffectiveInvoiceBranding();
 *     issued/sent/shared/paid → render from invoice.brandingSnapshot.
 */
export interface EffectiveInvoiceBranding {
  /** Logo to render, or null if plan doesn't allow / vendor hasn't uploaded. */
  logoUri: string | null;
  /** Brand color to render, or null if plan doesn't allow / vendor hasn't set. */
  brandColor: string | null;
  /** Thank-you message, or null if plan doesn't allow / vendor hasn't set. */
  thankYouMessage: string | null;
  /** Footer text, or null if plan doesn't allow / vendor hasn't set. */
  footerText: string | null;
  /** Template to render. Falls back to 'default' if the plan doesn't allow
   * premium templates and the saved template is a premium ID. */
  templateId: DocumentTemplateId;
  /** Pro+ seasonal theme, or null if not allowed / not set. */
  seasonalTheme: string | null;
  /** The raw capability flags for convenience — screens use these to decide
   * which sections to show vs. lock. */
  capabilities: DocumentBranding;
}

export function getEffectiveInvoiceBranding(
  plan: VendorPlan,
  settings: InvoiceBrandingSettings,
  realLimits?: PlanLimits | null
): EffectiveInvoiceBranding {
  const caps = getDocumentBranding(plan, realLimits);
  const isPremiumTemplate = settings.templateId !== 'default';
  const templateId: DocumentTemplateId =
    isPremiumTemplate && !caps.allowPremiumTemplates ? 'default' : settings.templateId;
  return {
    logoUri: caps.allowLogo ? settings.logoUri : null,
    brandColor: caps.allowBrandColor ? settings.brandColor : null,
    thankYouMessage: caps.allowThankYouMessage ? settings.thankYouMessage : null,
    footerText: caps.allowCustomFooter ? settings.footerText : null,
    templateId,
    seasonalTheme: caps.allowPremiumTemplates ? settings.seasonalTheme : null,
    capabilities: caps,
  };
}

/** Friendly display name for a template ID. */
export function getTemplateDisplayName(templateId: DocumentTemplateId): string {
  return INVOICE_TEMPLATE_OPTIONS.find((t) => t.id === templateId)?.name ?? 'Platform Default';
}

/** Resolve whether a template is selectable for the current plan. */
export function isTemplateSelectable(
  templateId: DocumentTemplateId,
  caps: DocumentBranding
): boolean {
  if (templateId === 'default') return true;
  return caps.allowPremiumTemplates;
}
