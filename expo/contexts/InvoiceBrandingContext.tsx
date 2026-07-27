import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
 */
const STORAGE_KEY = 'vendor_invoice_branding_v1';

export const [InvoiceBrandingProvider, useInvoiceBranding] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { plan } = useVendorPlan();

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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-branding'] });
    },
  });

  const settings: InvoiceBrandingSettings = brandingQuery.data ?? DEFAULT_INVOICE_BRANDING_SETTINGS;

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
