import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { uploadInvoiceLogo } from '@/lib/invoices/uploadInvoiceLogo';
import {
  Upload,
  Image as ImageIcon,
  Lock,
  Check,
  Sparkles,
  Palette,
  Type,
  LayoutTemplate,
  Trash2,
} from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import InvoiceRenderer, { type InvoiceRendererData } from '@/components/InvoiceRenderer';
import { Colors } from '@/constants/colors';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useVendor } from '@/contexts/VendorContext';
import { useInvoiceBranding } from '@/contexts/InvoiceBrandingContext';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { Alert } from '@/utils/alert';
import {
  INVOICE_TEMPLATE_OPTIONS,
  PREMIUM_TEMPLATE_OPTIONS,
  type DocumentTemplateId,
  type InvoiceBrandingSettings,
  isTemplateSelectable,
  getTemplateDisplayName,
  getEffectiveInvoiceBranding,
} from '@/constants/documentBranding';
import {
  INVOICE_TEXT_LIMITS,
  formatInvoiceCharacterCount,
  getInvoiceTextLimitError,
  sanitizeInvoiceText,
} from '@/constants/invoiceTextLimits';
import type { Currency } from '@/utils/formatPrice';

/**
 * Invoice Branding settings — controls how vendor invoices look.
 *
 * Plan-based behavior (exactly matches the approved the platform plan matrix):
 *  - Basic:  the platform Default template only. No logo, no brand color, no
 *            thank-you message, no footer text.
 *  - Standard: the platform Default template only, plus logo upload.
 *  - Pro:      the platform Default template only, plus logo, brand color,
 *              thank-you message, and footer text.
 *  - Pro+:     the platform Default plus all premium templates (Classic, Modern,
 *              Elegant, Restaurant, Retail, Beauty), plus seasonal themes
 *              and print layout.
 *
 * Vendors never manually design the full invoice. They pick a ready-made
 * template and fill in the branding fields allowed by their plan. Premium
 * templates are locked for Basic/Standard/Pro and show a lock + upgrade CTA.
 *
 * Downgrade safety: saved branding data is never deleted. Disabling a feature
 * only suppresses it in `getEffectiveInvoiceBranding`. Re-upgrading restores the
 * saved value instantly. The mock `InvoiceBrandingContext` persists the full
 * settings object in AsyncStorage so selections survive leaving the screen.
 *
 * Backend integration note (Henry):
 *   Persist the saved object under `vendorBranding/{vendorId}` (or equivalent)
 *   with these fields:
 *     templateId, logoUrl, accentColor, thankYouMessage, footerText,
 *     seasonalTheme
 *   (no printLayout — print/PDF styling is a system behavior, not branding.)
 *   The local context is already shaped 1:1 with that payload. Replace the
 *   AsyncStorage save with the backend write and keep the rest of the UI.
 *
 * Render contract: draft invoices, new invoices, and the live preview use
 * `effectiveBranding`. When an invoice is first issued, sent or shared,
 * Henry must capture an immutable `brandingSnapshot` on the invoice
 * document (templateId, logoUri, accentColor, thankYouMessage, footerText,
 * seasonalTheme, and effective plan tier at
 * finalization time). (No printLayout — print/PDF styling is applied
 * automatically by the renderer when generating PDF/print output.)
 * Issued/sent/shared/paid invoices render from that
 * snapshot so a customer's copy stays visually stable even if the vendor
 * later changes branding, switches templates, or downgrades plan. Future
 * vendor branding changes apply only to new invoices. Please assess this
 * for MVP before external invoice sharing goes live.
 */
export default function InvoiceBrandingScreen() {
  const router = useRouter();
  const { plan } = useVendorPlan();
  const { vendor } = useVendor();
  const { settings, effectiveBranding, isLoading, isSaving, updateBranding, resetBranding } =
    useInvoiceBranding();

  // Local editable copy. We commit to context only on Save so the discard
  // flow works the same way as every other editor screen in the app.
  const [draft, setDraft] = useState<InvoiceBrandingSettings>(settings);
  // Color palette is always visible inside the BRAND COLOR card — no toggle,
  // no hex input, no "Hide" button. `showAllColors` expands the curated set
  // from the initial 6 to the full ~36 via "View more colors".
  const [showAllColors, setShowAllColors] = useState<boolean>(false);
  // Blocks Save while the logo is still going up, so a storage path is never
  // saved as a half-uploaded object or a local file:// uri.
  const [uploadingLogo, setUploadingLogo] = useState<boolean>(false);

  // Re-sync draft when the persisted settings load/change externally.
  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const unsavedChanges = useUnsavedChanges(draft, false);

  const caps = effectiveBranding.capabilities;
  const accent = draft.brandColor ?? Colors.primary;
  const vendorName = vendor.name || 'Your business';
  const currency: Currency = (vendor.currency as Currency) || 'NGN';
  const vendorSlug = useMemo(
    () =>
      vendor.name
        ? vendor.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12).toUpperCase()
        : 'VENDOR',
    [vendor.name]
  );
  // Approved invoice number format: VENDORSLUG-INV-12345
  const previewInvoiceNumber = `${vendorSlug}-INV-12345`;

  const handleSave = () => {
    const thankYouError = getInvoiceTextLimitError('thankYouMessage', draft.thankYouMessage);
    const footerError = getInvoiceTextLimitError('footerText', draft.footerText);
    if (thankYouError || footerError) {
      Alert.alert(
        'Text too long',
        [thankYouError, footerError].filter(Boolean).join('\n\n')
      );
      return;
    }

    // Persist the full draft. Locked fields are harmless because
    // getEffectiveInvoiceBranding gates them at render time. This preserves
    // values across downgrades and keeps the payload ready for Henry's
    // backend.
    //
    // Backend integration note (Henry): validate these same limits server-side:
    //   thankYouMessage ≤ 120 chars, footerText ≤ 300 chars.
    //   Reject oversized values rather than silently truncating.
    updateBranding({
      ...draft,
      thankYouMessage: draft.thankYouMessage ? sanitizeInvoiceText(draft.thankYouMessage) : null,
      footerText: draft.footerText ? sanitizeInvoiceText(draft.footerText) : null,
    });
    unsavedChanges.resetChanges();
    Alert.alert('Branding saved', 'New invoices will use your updated branding.');
    router.back();
  };

  const handleUploadLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow photo library access in Settings to upload a logo.'
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;
      // Shown immediately from the local uri so the preview is instant, then
      // uploaded. The saved value is the storage path, because a local file://
      // uri means nothing to the PDF renderer and the backend rejects it.
      const localUri = result.assets[0].uri;
      setDraft((d) => ({ ...d, logoUri: localUri }));
      try {
        setUploadingLogo(true);
        const path = await uploadInvoiceLogo(localUri);
        setDraft((d) => ({ ...d, logoUri: path }));
      } catch (error: any) {
        setDraft((d) => ({ ...d, logoUri: null }));
        Alert.alert('Logo upload failed', error?.message ?? 'Please try again.');
      } finally {
        setUploadingLogo(false);
      }
    } catch (e) {
      console.error('[InvoiceBranding] logo upload failed', e);
      Alert.alert('Upload failed', 'Could not pick that image. Please try again.');
    }
  };

  const handleRemoveLogo = () => {
    setDraft((d) => ({ ...d, logoUri: null }));
  };

  const handleReset = () => {
    Alert.alert(
      'Reset branding?',
      'This clears your logo, color, thank-you message, footer, and template. Paid invoices keep their snapshot.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetBranding();
            unsavedChanges.resetChanges();
          },
        },
      ]
    );
  };

  // Preview data — ONE consistent neutral dataset used for every template.
  // This is a branding preview only: it demonstrates the template layout,
  // vendor logo, business name, accent colour, thank-you message, and footer.
  // It must NEVER leak into a real invoice page. Real invoices use actual
  // invoice data. No fulfilment, no scheduling, no real customer details,
  // no notes, no fake address/phone/email/website. Currency is USD ($) so
  // the preview is locale-neutral and never confuses NGN formatting.
  const previewData: InvoiceRendererData = useMemo(
    () => ({
      invoiceNumber: previewInvoiceNumber,
      vendorName,
      customerName: 'Jane D.',
      statusLabel: 'Unpaid',
      statusColor: Colors.primary,
      statusBg: Colors.primarySoft,
      items: [
        {
          id: '1',
          name: 'Large BBQ Chicken Pizza',
          description: 'Contains: chicken breast',
          quantity: 2,
          unitPrice: 24.99,
          total: 49.98,
        },
        {
          id: '2',
          name: 'Grilled Chicken',
          description: '',
          quantity: 1,
          unitPrice: 9.99,
          total: 9.99,
        },
      ],
      subtotal: 59.97,
      tax: 0,
      discount: 3.99,
      total: 55.98,
      currency: 'USD' as Currency,
      // No notes — notes belong to an individual invoice, not branding.
      // No fulfilment — fulfilment belongs to an individual invoice.
      // No vendor contact details — only show what the real vendor profile
      // provides, and the branding preview is not the place for them.
    }),
    [previewInvoiceNumber, vendorName]
  );

  // Effective branding is recomputed from the draft so the preview updates
  // immediately while the user edits, even before Save is pressed.
  const previewBranding = useMemo(
    () => getEffectiveInvoiceBranding(plan, draft),
    [plan, draft]
  );

  const rendererBranding = useMemo(
    () => ({
      logoUri: previewBranding.logoUri,
      brandColor: previewBranding.brandColor,
      thankYouMessage: previewBranding.thankYouMessage,
      footerText: previewBranding.footerText,
      templateId: previewBranding.templateId,
      poweredBySubtle: previewBranding.capabilities.poweredBythe platform === 'subtle',
      showLogo: previewBranding.capabilities.allowLogo,
      showThankYou: previewBranding.capabilities.allowThankYouMessage,
      showFooter: previewBranding.capabilities.allowCustomFooter,
      showBrandedHeader: previewBranding.capabilities.allowBrandedHeader,
    }),
    [previewBranding]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <EditScreenHeader title="Invoice Branding" onBack={() => router.back()} showSave={false} />
        </SafeAreaView>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Invoice Branding"
          onBack={() => {
            if (unsavedChanges.hasUnsavedChanges) {
              unsavedChanges.handleExitAttempt();
            } else {
              router.back();
            }
          }}
          onSave={handleSave}
          saveEnabled={unsavedChanges.hasUnsavedChanges}
          isSaving={isSaving}
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <PlanBanner plan={plan} />

          {/* LOGO */}
          <Section title="LOGO" locked={!caps.allowLogo}>
            {!caps.allowLogo ? (
              <LockedCard
                icon={<ImageIcon size={20} color={Colors.textMuted} />}
                title="Add your logo to invoices"
                description="Upgrade to Standard to upload a logo that appears on every invoice."
                cta="Upgrade to Standard"
                onPressUpgrade={() => router.push('/vendor/settings/subscription' as any)}
              />
            ) : (
              <View style={styles.glassCard}>
                {draft.logoUri ? (
                  <View style={styles.logoPreviewRow}>
                    <View style={styles.logoBox}>
                      <Image source={{ uri: draft.logoUri }} style={styles.logoImage} contentFit="cover" />
                    </View>
                    <View style={styles.logoActions}>
                      <TouchableOpacity
                        style={styles.logoActionButton}
                        onPress={handleUploadLogo}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.logoActionText}>Change</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.logoActionButton, styles.logoActionDanger]}
                        onPress={handleRemoveLogo}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={14} color={Colors.error} />
                        <Text style={[styles.logoActionText, { color: Colors.error }]}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleUploadLogo}
                    activeOpacity={0.8}
                  >
                    <Upload size={22} color={Colors.primary} />
                    <Text style={styles.uploadButtonText}>Upload Logo</Text>
                    <Text style={styles.uploadHint}>PNG or JPG, square, max 2MB</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Section>

          {/* BRAND COLOR */}
          <Section title="BRAND COLOR" locked={!caps.allowBrandColor}>
            {!caps.allowBrandColor ? (
              <LockedCard
                icon={<Palette size={20} color={Colors.textMuted} />}
                title="Customize invoice colors"
                description="Upgrade to Pro to set an accent color for invoice headers and totals."
                cta="Upgrade to Pro"
                onPressUpgrade={() => router.push('/vendor/settings/subscription' as any)}
              />
            ) : (
              <View style={styles.glassCard}>
                {/* Selected color name — friendly, never a hex value. */}
                <View style={styles.colorRow}>
                  <View
                    style={[
                      styles.colorSwatch,
                      draft.brandColor ? { backgroundColor: draft.brandColor } : null,
                    ]}
                  >
                    {!draft.brandColor && <Text style={styles.colorSwatchPlaceholder}>A</Text>}
                  </View>
                  <View style={styles.colorInfo}>
                    <Text style={styles.colorLabel}>Accent color</Text>
                    <Text style={styles.colorValue}>
                      {getAccentColorName(draft.brandColor)}
                    </Text>
                  </View>
                </View>

                <ColorPalette
                  value={draft.brandColor}
                  showAll={showAllColors}
                  onToggleShowAll={() => setShowAllColors((v) => !v)}
                  onChange={(c) => setDraft((d) => ({ ...d, brandColor: c }))}
                  onClear={() => setDraft((d) => ({ ...d, brandColor: null }))}
                />
              </View>
            )}
          </Section>

          {/* THANK-YOU MESSAGE */}
          <Section title="THANK-YOU MESSAGE" locked={!caps.allowThankYouMessage}>
            {!caps.allowThankYouMessage ? (
              <LockedCard
                icon={<Type size={20} color={Colors.textMuted} />}
                title="Add a thank-you message"
                description="Upgrade to Pro to show a short thank-you note under your business name."
                cta="Upgrade to Pro"
                onPressUpgrade={() => router.push('/vendor/settings/subscription' as any)}
              />
            ) : (
              <View style={styles.glassCard}>
                <TextInput
                  style={styles.input}
                  value={draft.thankYouMessage ?? ''}
                  onChangeText={(t) =>
                    setDraft((d) => ({ ...d, thankYouMessage: t.slice(0, INVOICE_TEXT_LIMITS.thankYouMessage) || null }))
                  }
                  placeholder="e.g. Thank you for your business!"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={INVOICE_TEXT_LIMITS.thankYouMessage}
                />
                <View style={styles.inputFooterRow}>
                  <Text style={styles.inputHint}>Shown under your business name. Optional.</Text>
                  <Text style={styles.characterCount}>
                    {formatInvoiceCharacterCount('thankYouMessage', draft.thankYouMessage)}
                  </Text>
                </View>
                {getInvoiceTextLimitError('thankYouMessage', draft.thankYouMessage) && (
                  <Text style={styles.limitError}>
                    {getInvoiceTextLimitError('thankYouMessage', draft.thankYouMessage)}
                  </Text>
                )}
              </View>
            )}
          </Section>

          {/* FOOTER TEXT */}
          <Section title="FOOTER TEXT" locked={!caps.allowCustomFooter}>
            {!caps.allowCustomFooter ? (
              <LockedCard
                icon={<Type size={20} color={Colors.textMuted} />}
                title="Add a custom footer"
                description="Upgrade to Pro to print a footer line at the bottom of every invoice."
                cta="Upgrade to Pro"
                onPressUpgrade={() => router.push('/vendor/settings/subscription' as any)}
              />
            ) : (
              <View style={styles.glassCard}>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={draft.footerText ?? ''}
                  onChangeText={(t) =>
                    setDraft((d) => ({ ...d, footerText: t.slice(0, INVOICE_TEXT_LIMITS.footerText) || null }))
                  }
                  placeholder="e.g. Bank: First Bank • Acct: 1234567890 • Ref: invoice number"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  maxLength={INVOICE_TEXT_LIMITS.footerText}
                />
                <View style={styles.inputFooterRow}>
                  <Text style={[styles.inputHint, styles.inputHintFlex]}>
                    Add business information or direct-payment instructions. Never include a PIN, password, CVV or verification code.
                  </Text>
                  <Text style={styles.characterCount}>
                    {formatInvoiceCharacterCount('footerText', draft.footerText)}
                  </Text>
                </View>
                {getInvoiceTextLimitError('footerText', draft.footerText) && (
                  <Text style={styles.limitError}>
                    {getInvoiceTextLimitError('footerText', draft.footerText)}
                  </Text>
                )}
              </View>
            )}
          </Section>

          {/* PREMIUM TEMPLATES */}
          <Section title="INVOICE TEMPLATE" locked={!caps.allowPremiumTemplates}>
            <View style={styles.templateGrid}>
              <TemplateOption
                id="default"
                name="the platform Default"
                description="Clean, standard layout"
                selected={draft.templateId === 'default'}
                onSelect={() => setDraft((d) => ({ ...d, templateId: 'default' }))}
                locked={false}
                accent={accent}
              />
              {PREMIUM_TEMPLATE_OPTIONS.map((tpl) => {
                const locked = !caps.allowPremiumTemplates;
                return (
                  <TemplateOption
                    key={tpl.id}
                    id={tpl.id}
                    name={tpl.name}
                    description={tpl.description}
                    selected={draft.templateId === tpl.id && !locked}
                    onSelect={() => setDraft((d) => ({ ...d, templateId: tpl.id as DocumentTemplateId }))}
                    locked={locked}
                    accent={accent}
                  />
                );
              })}
            </View>
            {!caps.allowPremiumTemplates && (
              <LockedCard
                icon={<LayoutTemplate size={20} color={Colors.textMuted} />}
                title="Premium invoice templates"
                description="Upgrade to Pro+ to unlock Classic, Modern, Elegant, Restaurant, Retail, and Beauty templates."
                cta="Upgrade to Pro+"
                onPressUpgrade={() => router.push('/vendor/settings/subscription' as any)}
              />
            )}
          </Section>

          {/* LIVE PREVIEW */}
          <Section title="LIVE PREVIEW">
            <View style={styles.previewWrap}>
              <InvoiceRenderer
                data={previewData}
                branding={rendererBranding}
                mode="page"
                seasonalTheme={previewBranding.seasonalTheme}
                style={styles.previewRenderer}
              />
              <Text style={styles.previewCaption}>
                Preview: {getTemplateDisplayName(previewBranding.templateId)}.{' '}
                {previewBranding.templateId === 'default'
                  ? 'Unpaid and new invoices will use the default the platform layout.'
                  : 'Unpaid and new invoices will use this premium template.'}
              </Text>
            </View>
          </Section>

          {/* RESET */}
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleReset}
            activeOpacity={0.7}
          >
            <Trash2 size={16} color={Colors.error} />
            <Text style={styles.resetText}>Reset branding to defaults</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Plan banner                                                                */
/* -------------------------------------------------------------------------- */

function PlanBanner({ plan }: { plan: string }) {
  const label = plan === 'pro+' ? 'Pro+' : plan.charAt(0).toUpperCase() + plan.slice(1);
  const subtitle = useMemo(() => {
    switch (plan) {
      case 'basic': return 'the platform Default template · vendor name only';
      case 'standard': return 'the platform Default template + logo';
      case 'pro': return 'the platform Default template + logo, color, thank-you, footer';
      case 'pro+': return 'All templates + all branding features';
      default: return '';
    }
  }, [plan]);
  return (
    <View style={styles.planBanner}>
      <View style={styles.planBadge}>
        <Sparkles size={13} color={Colors.primary} />
        <Text style={styles.planBadgeText}>{label} plan</Text>
      </View>
      <Text style={styles.planSubtitle}>{subtitle}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Locked card (Basic / upgrade prompts)                                      */
/* -------------------------------------------------------------------------- */

interface LockedCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onPressUpgrade: () => void;
}

function LockedCard({ icon, title, description, cta, onPressUpgrade }: LockedCardProps) {
  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedHeader}>
        <View style={styles.lockedIcon}>{icon}</View>
        <View style={styles.lockedHeaderText}>
          <Text style={styles.lockedTitle}>{title}</Text>
          <Text style={styles.lockedDescription}>{description}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.lockedCta}
        onPress={onPressUpgrade}
        activeOpacity={0.8}
      >
        <Lock size={14} color={Colors.primary} />
        <Text style={styles.lockedCtaText}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Section                                                                    */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  locked,
  children,
}: {
  title: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {locked && (
          <View style={styles.sectionLockBadge}>
            <Lock size={10} color={Colors.textMuted} />
            <Text style={styles.sectionLockText}>Locked</Text>
          </View>
        )}
      </View>
      {children}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Template option row                                                        */
/* -------------------------------------------------------------------------- */

function TemplateOption({
  id,
  name,
  description,
  selected,
  onSelect,
  locked,
  accent,
}: {
  id: DocumentTemplateId;
  name: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  locked: boolean;
  accent: string;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.templateCard,
        selected && [styles.templateCardSelected, { borderColor: accent }],
        locked && styles.templateCardLocked,
      ]}
      onPress={locked ? undefined : onSelect}
      activeOpacity={locked ? 1 : 0.7}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: locked }}
    >
      {locked && (
        <View style={styles.templateCardLockOverlay}>
          <Lock size={14} color={Colors.white} />
        </View>
      )}
      <TemplateThumbnail templateId={id} accent={accent} />
      <View style={styles.templateCardInfo}>
        <Text style={[styles.templateCardName, locked && { color: Colors.textMuted }]}>{name}</Text>
        <Text style={styles.templateCardDescription}>{description}</Text>
      </View>
      <View
        style={[
          styles.templateCardRadio,
          selected && [styles.templateCardRadioActive, { backgroundColor: accent, borderColor: accent }],
        ]}
      >
        {selected && <Check size={12} color={Colors.white} strokeWidth={3} />}
      </View>
    </TouchableOpacity>
  );
}

function TemplateThumbnail({
  templateId,
  accent,
}: {
  templateId: DocumentTemplateId;
  accent: string;
}) {
  const line = (color: string, width: string | number, height: number, marginTop: number, extraStyle?: Record<string, unknown>) => (
    <View
      style={[{ backgroundColor: color, width, height, marginTop, borderRadius: 1 }, extraStyle]}
    />
  );
  const row = (key: number, leftWidth: string, rightWidth: string) => (
    <View
      key={key}
      style={{ flexDirection: 'row', marginTop: 5, justifyContent: 'space-between' }}
    >
      <View style={{ backgroundColor: '#D9DDE3', width: leftWidth, height: 4, borderRadius: 1 }} />
      <View style={{ backgroundColor: '#D9DDE3', width: rightWidth, height: 4, borderRadius: 1 }} />
    </View>
  );
  const pill = (key: number, color: string) => (
    <View
      key={key}
      style={{ backgroundColor: color, width: 24, height: 10, borderRadius: 4, marginRight: 4 }}
    />
  );

  switch (templateId) {
    case 'classic':
      return (
        <View style={styles.templateCardThumbnail}>
          {line(Colors.text, '100%', 4, 0)}
          <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'space-between' }}>
            {line(Colors.text, '45%', 6, 0)}
            {line(Colors.textSecondary, '40%', 3, 0)}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8, justifyContent: 'space-between' }}>
            {line(Colors.textMuted, '30%', 3, 0)}
            {line(Colors.textMuted, '30%', 3, 0)}
          </View>
          {line(Colors.borderDark, '100%', 1, 10)}
          {row(1, '55%', '22%')}
          {row(2, '45%', '22%')}
          {row(3, '50%', '22%')}
          <View
            style={{
              borderWidth: 1,
              borderColor: '#D9DDE3',
              borderRadius: 2,
              padding: 4,
              marginTop: 10,
            }}
          >
            {line(accent, '35%', 3, 0)}
          </View>
        </View>
      );
    case 'modern':
      return (
        <View style={styles.templateCardThumbnail}>
          <View
            style={{
              backgroundColor: accent,
              borderRadius: 4,
              padding: 6,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {line(Colors.white, '40%', 4, 0)}
            {line(Colors.white, '25%', 8, 0)}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            {pill(1, '#EEF0F4')}
            {pill(2, '#EEF0F4')}
          </View>
          {row(3, '50%', '22%')}
          {row(4, '40%', '22%')}
          <View
            style={{
              backgroundColor: accent,
              borderRadius: 4,
              height: 12,
              marginTop: 10,
            }}
          />
        </View>
      );
    case 'elegant':
      return (
        <View style={[styles.templateCardThumbnail, { alignItems: 'center' }]}>
          {line(Colors.text, '55%', 5, 0)}
          {line(accent, '30%', 1, 6)}
          <View style={{ flexDirection: 'row', marginTop: 8, width: '100%', justifyContent: 'space-between' }}>
            {line(Colors.textMuted, '35%', 3, 0)}
            {line(Colors.textMuted, '35%', 3, 0)}
          </View>
          {line(Colors.borderDark, '100%', 1, 10)}
          {row(1, '55%', '22%')}
          {row(2, '45%', '22%')}
          {line(Colors.textSecondary, '45%', 3, 10)}
        </View>
      );
    case 'restaurant':
      return (
        <View style={styles.templateCardThumbnail}>
          {line(Colors.text, '50%', 5, 0)}
          <View
            style={{
              borderWidth: 1,
              borderStyle: 'dashed' as const,
              borderColor: accent,
              borderRadius: 4,
              padding: 4,
              marginTop: 6,
            }}
          >
            {line(accent, '40%', 3, 0)}
          </View>
          {row(1, '45%', '22%')}
          {row(2, '50%', '22%')}
          {row(3, '40%', '22%')}
          <View
            style={{
              backgroundColor: accent,
              borderRadius: 4,
              height: 12,
              marginTop: 10,
            }}
          />
        </View>
      );
    case 'retail':
      return (
        <View style={styles.templateCardThumbnail}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            {line(Colors.text, '35%', 4, 0)}
            {line(Colors.textMuted, '30%', 3, 0)}
          </View>
          {line(Colors.borderDark, '100%', 1, 8)}
          {row(1, '30%', '18%')}
          {row(2, '35%', '18%')}
          {row(3, '28%', '18%')}
          {row(4, '32%', '18%')}
          {row(5, '30%', '18%')}
        </View>
      );
    case 'beauty':
      return (
        <View style={styles.templateCardThumbnail}>
          <View
            style={{
              backgroundColor: `${accent}18`,
              borderRadius: 8,
              padding: 6,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            {line(accent, 10, 10, 0)}
            {line(Colors.text, '40%', 4, 0, { marginLeft: 6 })}
          </View>
          {row(1, '50%', '22%')}
          {row(2, '45%', '22%')}
          <View
            style={{
              backgroundColor: `${accent}14`,
              borderRadius: 6,
              height: 14,
              marginTop: 10,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 4,
            }}
          >
            {line(accent, '30%', 3, 0)}
            {line(accent, '25%', 5, 0)}
          </View>
        </View>
      );
    case 'default':
    default:
      return (
        <View style={styles.templateCardThumbnail}>
          {line(Colors.text, '40%', 5, 0)}
          {line(Colors.textMuted, '30%', 3, 6)}
          {line(Colors.borderDark, '100%', 1, 10)}
          {row(1, '55%', '22%')}
          {row(2, '45%', '22%')}
          {line(accent, '35%', 3, 10)}
        </View>
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Toggle row (Pro+ extras)                                                   */
/* -------------------------------------------------------------------------- */

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.toggleRow}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.7}
    >
      <View style={styles.toggleRowLeft}>
        <View style={styles.toggleIcon}>{icon}</View>
        <Text style={styles.toggleLabel}>{label}</Text>
      </View>
      <View style={[styles.togglePill, value && styles.togglePillActive]}>
        <View style={[styles.toggleKnob, value && styles.toggleKnobActive]} />
      </View>
    </TouchableOpacity>
  );
}

/* -------------------------------------------------------------------------- */
/* Curated color palette — friendly names only, no hex UI                     */
/* -------------------------------------------------------------------------- */

/** Curated accent colors. The initial six are the "popular" set shown by
 *  default; the rest appear when the vendor taps "View more colors". */
interface CuratedColor {
  hex: string;
  name: string;
}

const PRIMARY_COLORS: CuratedColor[] = [
  { hex: '#FF7A28', name: 'the platform Orange' },
  { hex: '#0B0C0F', name: 'Black' },
  { hex: '#10A862', name: 'Emerald Green' },
  { hex: '#2563EB', name: 'Royal Blue' },
  { hex: '#7C3AED', name: 'Purple' },
  { hex: '#DB2777', name: 'Rose Pink' },
];

const EXTENDED_COLORS: CuratedColor[] = [
  { hex: '#E5484D', name: 'Crimson' },
  { hex: '#F59E0B', name: 'Amber' },
  { hex: '#FACC15', name: 'Sunflower' },
  { hex: '#84CC16', name: 'Lime' },
  { hex: '#059669', name: 'Forest Green' },
  { hex: '#0EA5E9', name: 'Sky Blue' },
  { hex: '#0F766E', name: 'Teal' },
  { hex: '#1E40AF', name: 'Navy' },
  { hex: '#4338CA', name: 'Indigo' },
  { hex: '#9333EA', name: 'Violet' },
  { hex: '#C026D3', name: 'Magenta' },
  { hex: '#BE185D', name: 'Raspberry' },
  { hex: '#B91C1C', name: 'Brick Red' },
  { hex: '#D97706', name: 'Burnt Orange' },
  { hex: '#A16207', name: 'Olive' },
  { hex: '#15803D', name: 'Pine' },
  { hex: '#0D9488', name: 'Jade' },
  { hex: '#0369A1', name: 'Ocean' },
  { hex: '#1D4ED8', name: 'Cobalt' },
  { hex: '#6D28D9', name: 'Grape' },
  { hex: '#A21CAF', name: 'Plum' },
  { hex: '#831843', name: 'Wine' },
  { hex: '#78350F', name: 'Cocoa' },
  { hex: '#44403C', name: 'Charcoal' },
  { hex: '#525252', name: 'Slate' },
  { hex: '#737373', name: 'Stone' },
  { hex: '#EC4899', name: 'Bubblegum' },
  { hex: '#F97316', name: 'Tangerine' },
  { hex: '#FDE68A', name: 'Cream' },
  { hex: '#FCA5A5', name: 'Blush' },
];

/** All curated colors, primary first. Used to resolve a hex → friendly name. */
const ALL_CURATED_COLORS: CuratedColor[] = [...PRIMARY_COLORS, ...EXTENDED_COLORS];

/** Friendly name for a hex value. Falls back to "the platform default" when null,
 *  and "Custom" only if a non-curated hex somehow slips through (rare). */
function getAccentColorName(hex: string | null | undefined): string {
  if (!hex) return 'the platform default';
  const match = ALL_CURATED_COLORS.find(
    (c) => c.hex.toUpperCase() === hex.toUpperCase(),
  );
  return match ? match.name : 'Custom';
}

function ColorPalette({
  value,
  showAll,
  onToggleShowAll,
  onChange,
  onClear,
}: {
  value: string | null;
  showAll: boolean;
  onToggleShowAll: () => void;
  onChange: (hex: string) => void;
  onClear: () => void;
}) {
  const colors = showAll ? [...PRIMARY_COLORS, ...EXTENDED_COLORS] : PRIMARY_COLORS;
  return (
    <View style={styles.colorPaletteWrap}>
      <View style={styles.colorSwatchesRow}>
        {colors.map((color) => {
          const active = (value ?? '').toUpperCase() === color.hex.toUpperCase();
          return (
            <TouchableOpacity
              key={color.hex}
              style={[
                styles.colorSwatchOption,
                { backgroundColor: color.hex },
                active && styles.colorSwatchOptionActive,
              ]}
              onPress={() => onChange(color.hex)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${color.name}${active ? ', selected' : ''}`}
            >
              {active && <Check size={16} color={Colors.white} strokeWidth={3} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.colorActionsRow}>
        <TouchableOpacity
          style={styles.colorTextAction}
          onPress={onToggleShowAll}
          activeOpacity={0.7}
        >
          <Text style={styles.colorTextActionText}>
            {showAll ? 'Show fewer colors' : 'View more colors'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.colorTextAction}
          onPress={onClear}
          activeOpacity={0.7}
        >
          <Text style={[styles.colorTextActionText, { color: Colors.textSecondary }]}>
            Use the platform default
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },

  /* Plan banner */
  planBanner: {
    marginTop: 16,
    marginBottom: 4,
    padding: 16,
    backgroundColor: Colors.primaryTint,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFE0CC',
  },
  planBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 6,
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  planSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 19,
  },

  /* Section */
  section: {
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  sectionLockBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionLockText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },

  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
  },

  /* Locked card */
  lockedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed' as const,
  },
  lockedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 14,
  },
  lockedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockedHeaderText: {
    flex: 1,
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  lockedDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  lockedCta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
    backgroundColor: Colors.primaryTint,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  lockedCtaText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  /* Logo upload */
  uploadButton: {
    alignItems: 'center' as const,
    paddingVertical: 24,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginTop: 10,
  },
  uploadHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  logoPreviewRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden' as const,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  logoActions: {
    flex: 1,
    gap: 8,
  },
  logoActionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'flex-start' as const,
  },
  logoActionDanger: {
    borderColor: '#FECACA',
  },
  logoActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  /* Color */
  colorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 14,
  },
  colorSwatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  colorSwatchPlaceholder: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  colorInfo: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  colorValue: {
    fontSize: 12,
    color: Colors.textMuted,
  },

  /* Curated palette */
  colorPaletteWrap: {
    marginTop: 4,
  },
  colorSwatchesRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
    marginBottom: 14,
  },
  colorSwatchOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  colorSwatchOptionActive: {
    borderWidth: 3,
    borderColor: Colors.text,
  },
  colorActionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    flexWrap: 'wrap' as const,
    paddingTop: 4,
  },
  colorTextAction: {
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  colorTextActionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  /* Text inputs */
  input: {
    fontSize: 15,
    color: Colors.text,
    padding: 0,
    minHeight: 22,
  },
  multilineInput: {
    minHeight: 52,
    paddingTop: 0,
  },
  inputHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 8,
  },
  inputHintFlex: {
    flex: 1,
    marginRight: 12,
  },
  inputFooterRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    justifyContent: 'space-between' as const,
    marginTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'] as const,
  },
  limitError: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 8,
  },

  /* Template options */
  templateGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  templateCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    padding: 10,
  },
  templateCardSelected: {
    backgroundColor: '#FFFDFB',
  },
  templateCardLocked: {
    opacity: 0.55,
  },
  templateCardThumbnail: {
    width: '100%',
    height: 72,
    backgroundColor: '#FAFBFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEF0F4',
    padding: 8,
    overflow: 'hidden' as const,
  },
  templateCardInfo: {
    marginTop: 10,
    marginBottom: 8,
  },
  templateCardName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  templateCardDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  templateCardRadio: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.white,
  },
  templateCardRadioActive: {
    borderWidth: 0,
  },
  templateCardLockOverlay: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: 'rgba(11,12,15,0.55)',
    zIndex: 1,
  },

  /* Toggle row */
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 2,
  },
  toggleRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  toggleIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primaryTint,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  togglePill: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center' as const,
  },
  togglePillActive: {
    backgroundColor: Colors.primary,
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.white,
    transform: [{ translateX: 0 }],
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },

  /* Live preview */
  previewWrap: {
    marginTop: 4,
    backgroundColor: '#F4F5F8',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
  },
  previewRenderer: {
    width: '100%',
    maxWidth: 760,
  },
  previewCaption: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 14,
    paddingHorizontal: 8,
    lineHeight: 17,
  },

  /* Reset */
  resetButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.error,
  },

  bottomSpacer: {
    height: 48,
  },
});
