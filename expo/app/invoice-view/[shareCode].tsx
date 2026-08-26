import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, MessageCircle, Smartphone, Sparkles, FileText } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useInvoices,
  getAmountPaid,
  getBalanceDue,
  resolvePaymentStatus,
} from '@/contexts/InvoiceContext';
import type { Invoice, InvoicePaymentStatus } from '@/contexts/InvoiceContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import InvoiceRenderer, { type InvoiceRendererData } from '@/components/InvoiceRenderer';
import {
  DEFAULT_INVOICE_BRANDING_SETTINGS,
  getEffectiveInvoiceBranding,
  type InvoiceBrandingSettings,
} from '@/constants/documentBranding';
import { useVendor } from '@/contexts/VendorContext';
import { formatInvoiceCustomerName } from '@/utils/internalCustomerName';
import { Colors } from '@/constants/colors';

const INVOICE_BRANDING_STORAGE_KEY = 'vendor_invoice_branding_v1';

/**
 * Resolve the customer-facing payment status for the invoice, including the
 * "overdue" heuristic (unpaid / partially_paid AND due date in the past).
 * Returns the approved customer-visible label + colours. Per the invoice MVP
 * spec, "Pending Payment" is the consistent customer-facing term for unpaid
 * invoices (clearer than "Unpaid").
 */
function getPaymentStatusDisplay(
  invoice: Invoice,
): { status: InvoicePaymentStatus | 'overdue'; label: string; color: string; bg: string } {
  const effectivePaymentStatus = resolvePaymentStatus(
    invoice.total,
    invoice.payments,
    invoice.paymentStatus,
  );
  const nowMs = Date.now();
  const dueMs = invoice.dueDate ? new Date(invoice.dueDate).getTime() : NaN;
  const isOverdue =
    effectivePaymentStatus !== 'paid' &&
    !Number.isNaN(dueMs) &&
    dueMs < nowMs;

  if (isOverdue) {
    return { status: 'overdue', label: 'Overdue', color: Colors.error, bg: Colors.errorLight };
  }
  switch (effectivePaymentStatus) {
    case 'paid':
      return { status: 'paid', label: 'Paid', color: Colors.success, bg: Colors.successLight };
    case 'partially_paid':
      return {
        status: 'partially_paid',
        label: 'Partially Paid',
        color: Colors.warning,
        bg: Colors.warningLight,
      };
    case 'unpaid':
    default:
      return {
        status: 'unpaid',
        label: 'Pending Payment',
        color: Colors.textSecondary,
        bg: Colors.surface,
      };
  }
}

/**
 * Invoice page — the in-app representation of https://the platform.app/i/{shareCode}.
 * Read-only, live: reflects the latest saved invoice state. Branding is applied
 * automatically from the vendor's saved branding settings and current plan.
 *
 * Two experiences share this route and the same InvoiceRenderer:
 * - Public (share URL, no `viewer` param): external customer lands here from the
 *   secure share link. the platform acquisition CTA only — no "Contact Vendor"
 *   button. Customer name is shown verbatim as the vendor typed it.
 * - Logged-in the platform customer (`viewer=customer`, opened from the chat invoice
 *   card): in-app experience. The existing chat is the contact channel, so the
 *   helper reads "Need changes? Reply in chat." and Back returns to the chat
 *   thread via the `returnTo` param. Internal customer is shown as "First L."
 *   (privacy-safe) via formatInvoiceCustomerName.
 *
 * MVP rules enforced here:
 *   - No Pay Now / Record Payment / Mark as Paid / Edit / Delete / Convert to
 *     Order. the platform does not process payments.
 *   - No "Viewed" status, no view tracking. The invoice status is never flipped
 *     to `viewed` on this screen.
 *   - Customer-facing status uses payment-status labels (Pending Payment /
 *     Partially Paid / Paid / Overdue), not the invoice lifecycle status.
 *
 * Backend integration note (Henry):
 *   The public page currently reads the saved branding from AsyncStorage because
 *   the InvoiceBrandingProvider is only mounted in the vendor app tree. Once the
 *   backend has a `vendorBranding/{vendorId}` document, replace this local read
 *   with a fetch for that document and pass it to `getEffectiveInvoiceBranding`.
 */
export default function PublicInvoiceScreen() {
  const {
    shareCode,
    viewer,
    returnTo,
  } = useLocalSearchParams<{ shareCode: string; viewer?: string; returnTo?: string }>();
  const isInAppCustomerView = viewer === 'customer';
  const { getInvoiceByShareCode, fetchPublicInvoice } = useInvoices();
  const { plan } = useVendorPlan();
  // The signed-in vendor, used for the contact block when the invoice does not
  // carry its own. A customer viewing a shared link sees the vendor details
  // stored on the invoice, not this.
  const { vendor } = useVendor();
  const localInvoice = getInvoiceByShareCode(shareCode ?? '');

  // getInvoiceByShareCode only ever matches an invoice already loaded into
  // this device's own state (the signed-in vendor's own invoices, or demo
  // seed data) — for anyone else opening a shared link, including the
  // customer the invoice is actually for, it never matches, and the screen
  // showed "Invoice unavailable" unconditionally. fetchPublicInvoice already
  // existed correctly (round-trips to getPublicInvoice for a non-owner) but
  // nothing here ever called it.
  const [remoteInvoice, setRemoteInvoice] = useState<Invoice | undefined>(undefined);
  const [isFetchingRemote, setIsFetchingRemote] = useState(false);

  useEffect(() => {
    if (localInvoice || !shareCode) return;
    let cancelled = false;
    setIsFetchingRemote(true);
    fetchPublicInvoice(shareCode)
      .then((inv) => {
        if (!cancelled) setRemoteInvoice(inv);
      })
      .catch((err) => {
        console.error('[PublicInvoice] fetchPublicInvoice failed:', err);
      })
      .finally(() => {
        if (!cancelled) setIsFetchingRemote(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shareCode, localInvoice, fetchPublicInvoice]);

  const invoice = localInvoice ?? remoteInvoice;

  const [savedSettings, setSavedSettings] = useState<InvoiceBrandingSettings>(
    DEFAULT_INVOICE_BRANDING_SETTINGS,
  );
  const [loadingBranding, setLoadingBranding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const stored = await AsyncStorage.getItem(INVOICE_BRANDING_STORAGE_KEY);
        if (!cancelled) {
          if (stored) {
            const parsed = JSON.parse(stored) as Partial<InvoiceBrandingSettings>;
            setSavedSettings({ ...DEFAULT_INVOICE_BRANDING_SETTINGS, ...parsed });
          }
          setLoadingBranding(false);
        }
      } catch (e) {
        console.error('[PublicInvoice] failed to load branding settings', e);
        if (!cancelled) setLoadingBranding(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // NOTE: No view-tracking effect. Per the invoice MVP spec, invoices never
  // flip to a "viewed" status and there is no "Viewed" status shown to
  // customers. Removed the previous `updateInvoice({ status: 'viewed' })`
  // call intentionally.

  const effectiveBranding = getEffectiveInvoiceBranding(plan, savedSettings);

  /**
   * Back handler. For the in-app customer view we prefer the explicit
   * `returnTo` chat-thread path so the customer lands back in the same
   * vendor chat / order thread they came from. If the router has a back
   * history we use it (preserves scroll position); otherwise we fall back
   * to `returnTo` or, last resort, the customer chats list — never Home.
   */
  const handleBack = () => {
    if (returnTo) {
      // Prefer router.back() when there's history (keeps scroll position in
      // the chat thread). If back fails (cold-launched straight to the
      // invoice URL), push returnTo so the chat still opens.
      if (router.canGoBack()) {
        router.back();
      } else {
        router.push(returnTo as any);
      }
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else if (isInAppCustomerView) {
      router.replace('/customer/(tabs)/chats' as any);
    } else {
      router.back();
    }
  };

  if (!invoice && isFetchingRemote) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.errorContainer, { flex: 1, justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
              <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Invoice</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconWrap}>
            <FileText size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.errorTitle}>Invoice unavailable</Text>
          <Text style={styles.errorText}>This invoice could not be loaded.</Text>
          <TouchableOpacity
            style={styles.errorAction}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.errorActionText}>
              {isInAppCustomerView ? 'Back to chat' : 'Go back'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusDisplay = getPaymentStatusDisplay(invoice);
  const amountPaid = getAmountPaid(invoice.payments);
  const balanceDue = getBalanceDue(invoice.total, invoice.payments);
  const lastUpdated = new Date(invoice.updatedAt ?? invoice.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  // Privacy: internal the platform customers always render as "First L." External
  // customers use the vendor-typed display name verbatim. For the public
  // external page we show the customer name as stored (which Henry should
  // already have stored privacy-safe for internal customers at the data
  // boundary; here we defensively apply the privacy formatter only for the
  // in-app customer view so we never leak a full surname on an internal
  // surface).
  const displayCustomerName = isInAppCustomerView
    ? formatInvoiceCustomerName(invoice.customerName, invoice.customerSource)
    : invoice.customerName;

  const invoiceData: InvoiceRendererData = {
    invoiceNumber: invoice.invoiceNumber,
    vendorName: vendor.name,
    customerName: displayCustomerName,
    statusLabel: statusDisplay.label,
    statusColor: statusDisplay.color,
    statusBg: statusDisplay.bg,
    items: invoice.items.map((item) => ({
      id: item.id ?? `${item.name}-${item.quantity}`,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    discount: invoice.discount,
    total: invoice.total,
    notes: invoice.notes,
    currency: invoice.currency,
    lastUpdated,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    amountPaid,
    balanceDue,
    fulfilmentMethod: invoice.fulfilmentMethod,
    fulfilmentDetails: invoice.fulfilmentDetails,
    deliveryFee:
      invoice.fulfilmentMethod === 'delivery' && invoice.fulfilmentDetails?.deliveryFee
        ? invoice.fulfilmentDetails.deliveryFee
        : 0,
    vendorPhone: vendor.phone,
    vendorEmail: vendor.email,
    vendorAddress: vendor.fullAddress,
    vendorWebsite: vendor.contactLinks?.website,
  };

  const rendererBranding = {
    logoUri: effectiveBranding.logoUri,
    brandColor: effectiveBranding.brandColor,
    thankYouMessage: effectiveBranding.thankYouMessage,
    footerText: effectiveBranding.footerText,
    templateId: effectiveBranding.templateId,
    poweredBySubtle: effectiveBranding.capabilities.poweredBythe platform === 'subtle',
    showLogo: effectiveBranding.capabilities.allowLogo,
    showThankYou: effectiveBranding.capabilities.allowThankYouMessage,
    showFooter: effectiveBranding.capabilities.allowCustomFooter,
    showBrandedHeader: effectiveBranding.capabilities.allowBrandedHeader,
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
            <ArrowLeft size={20} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Invoice</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loadingBranding ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : (
            <InvoiceRenderer
              data={invoiceData}
              branding={rendererBranding}
              mode="page"
              seasonalTheme={effectiveBranding.seasonalTheme}
              style={styles.invoiceRenderer}
            />
          )}

          <Text style={styles.lastUpdated}>Last updated {lastUpdated}</Text>

          {isInAppCustomerView ? (
            /* IN-APP CUSTOMER — chat already exists, no acquisition CTA. The
             * chat is the contact channel for invoice questions. */
            <View style={styles.helperCard}>
              <MessageCircle size={16} color={Colors.textSecondary} />
              <Text style={styles.helperText}>Need changes? Reply in chat.</Text>
            </View>
          ) : (
            /* PUBLIC SHARE URL — external customer. the platform acquisition CTA
             * only. "Powered by the platform" is rendered by InvoiceRenderer above
             * for the public page too. */
            <View style={styles.ctaCard}>
              <TouchableOpacity
                style={styles.ctaPrimary}
                onPress={() => Linking.openURL('https://the platform.app')}
                activeOpacity={0.8}
              >
                <Sparkles size={16} color={Colors.white} />
                <Text style={styles.ctaPrimaryText}>Get the platform</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaSecondary}
                onPress={() => Linking.openURL('https://the platform.app')}
                activeOpacity={0.8}
              >
                <Smartphone size={16} color={Colors.primary} />
                <Text style={styles.ctaSecondaryText}>Download app · Create your account</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSpacer: {
    width: 38,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
  },
  errorIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  errorAction: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  errorActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  loaderWrap: {
    paddingVertical: 24,
    alignItems: 'center' as const,
  },
  invoiceRenderer: {
    width: '100%',
  },
  lastUpdated: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 12,
  },
  helperCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  helperText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  ctaCard: {
    alignItems: 'center' as const,
    marginTop: 24,
    gap: 10,
  },
  ctaPrimary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignSelf: 'stretch' as const,
  },
  ctaPrimaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  ctaSecondary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    borderRadius: 12,
    paddingVertical: 13,
    alignSelf: 'stretch' as const,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ctaSecondaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});
