import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import {
  DEFAULT_INVOICE_BRANDING_SETTINGS,
  getEffectiveInvoiceBranding,
  type InvoiceBrandingSettings,
  type EffectiveInvoiceBranding,
} from '@/constants/documentBranding';

/**
 * Vendor invoice branding preferences — local source of truth, shaped to be
 * a 1:1 drop-in for Henry's future Firestore `vendorBranding/{vendorId}`
 * document. The context owns persistence; the plan-aware resolution
 * (`getEffectiveInvoiceBranding`) lives in `constants/documentBranding.ts`
 * so the public invoice page and receipt preview can reuse it without
 * pulling in React.
 *
 * Downgrade safety: saved settings are never deleted here. A downgrade
 * simply causes `effectiveBranding` to suppress features the vendor's
 * current plan no longer allows. Re-upgrading restores them instantly.
 *
 * Backed by the server as of this commit. It was AsyncStorage only, so a
 * vendor's logo, colour, thank-you note, footer and template lived on one
 * device: lost on reinstall, absent on a second device, and invisible to the
 * PDF renderer, which reads invoiceBranding/{vendorId} through the Admin SDK.
 * updateInvoiceBranding has existed since Milestone 4 and nothing called it.
 *
 * The plan gate stays on the server. It refuses a field the plan does not allow
 * and says which plan is needed, so the screen shows that rather than deciding
 * for itself.
 */
const STORAGE_KEY = 'vendor_invoice_branding_v1';

export const [InvoiceBrandingProvider, useInvoiceBranding] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { plan } = useVendorPlan();

  // Live server branding, or null until the listener resolves. Wins over the
  // local copy once present, the same way backend invoices do.
  const [serverBranding, setServerBranding] = useState<InvoiceBrandingSettings | null>(null);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;
    const unsubscribeAuth = auth.onAuthStateChanged(async (fbUser) => {
      unsubscribeDoc?.();
      if (!fbUser) { setServerBranding(null); return; }
      const token = await fbUser.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) { setServerBranding(null); return; }

      unsubscribeDoc = onSnapshot(
        doc(db, 'invoiceBranding', vendorId),
        (snap) => {
          const data = snap.data();
          if (!data) { setServerBranding(DEFAULT_INVOICE_BRANDING_SETTINGS); return; }
          // Mapped back out of the backend's names. See the note in the save.
          setServerBranding({
            ...DEFAULT_INVOICE_BRANDING_SETTINGS,
            logoUri: (data.logoUrl as string) ?? null,
            brandColor: (data.brandColor as string) ?? null,
            thankYouMessage: (data.thankYouMessage as string) ?? null,
            footerText: (data.footerText as string) ?? null,
            templateId: (data.selectedTemplateId as InvoiceBrandingSettings['templateId'])
              ?? DEFAULT_INVOICE_BRANDING_SETTINGS.templateId,
            seasonalTheme: (data.selectedSeasonalThemeId as string) ?? null,
          });
        },
        (err) => {
          console.error('[InvoiceBranding] Live subscription failed:', err);
          setServerBranding(DEFAULT_INVOICE_BRANDING_SETTINGS);
        },
      );
    });
    return () => { unsubscribeDoc?.(); unsubscribeAuth(); };
  }, []);

  const brandingQuery = useQuery({
    queryKey: ['invoice-branding'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_INVOICE_BRANDING_SETTINGS;
      const parsed = JSON.parse(stored) as Partial<InvoiceBrandingSettings>;
      // Defensive merge — guarantees every field exists even if the stored
      // document predates a new field being added.
      return {
        ...DEFAULT_INVOICE_BRANDING_SETTINGS,
        ...parsed,
      } as InvoiceBrandingSettings;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: InvoiceBrandingSettings) => {
      if (!DEV_LOCAL_AUTH_ENABLED || serverBranding !== null) {
        const save = callable<Record<string, unknown>, { success: true }>('updateInvoiceBranding');
        // The paid frontend and the Milestone 4 backend named these fields
        // differently — logoUri/templateId/seasonalTheme against
        // logoUrl/selectedTemplateId/selectedSeasonalThemeId. Neither side is
        // wrong; they were built without the other in view, and the mismatch is
        // a large part of why this screen was never connected. Mapped here, in
        // one place, rather than renaming a field in a paid deliverable.
        //
        // logoUri is only sent when it is a real uploaded object path. While it
        // still holds a local file:// uri the upload has not happened, and the
        // backend rejects anything not under invoiceBranding/{vendorId}/.
        const uploadedLogo =
          settings.logoUri && !settings.logoUri.startsWith('file:')
            ? settings.logoUri
            : null;

        await save({
          logoUrl: uploadedLogo,
          brandColor: settings.brandColor ?? null,
          thankYouMessage: settings.thankYouMessage ?? null,
          footerText: settings.footerText ?? null,
          selectedTemplateId: settings.templateId ?? null,
          selectedSeasonalThemeId: settings.seasonalTheme ?? null,
        });
        // The listener brings the saved document back; no local write, so the
        // two copies cannot disagree.
        return settings;
      }
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-branding'] });
    },
  });

  const settings: InvoiceBrandingSettings =
    serverBranding ?? brandingQuery.data ?? DEFAULT_INVOICE_BRANDING_SETTINGS;

  const updateBranding = useCallback(
    (updates: Partial<InvoiceBrandingSettings>) => {
      const next: InvoiceBrandingSettings = { ...settings, ...updates };
      void saveMutation.mutateAsync(next);
    },
    [settings, saveMutation]
  );

  const resetBranding = useCallback(() => {
    void saveMutation.mutateAsync(DEFAULT_INVOICE_BRANDING_SETTINGS);
  }, [saveMutation]);

  /**
   * Plan-aware branding that should actually be rendered on invoices right
   * now. Use this for draft invoices, new invoices, and on-screen previews.
   * Issued/sent/shared/paid invoices must render from the immutable
   * `brandingSnapshot` captured on the invoice document at finalization
   * time (Henry — please assess for MVP before external invoice sharing
   * goes live, not strictly a Phase 2 item).
   */
  const effectiveBranding: EffectiveInvoiceBranding = getEffectiveInvoiceBranding(plan, settings);

  return {
    settings,
    effectiveBranding,
    isLoading: brandingQuery.isLoading,
    isSaving: saveMutation.isPending,
    updateBranding,
    resetBranding,
  };
});
