import React, { useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, Platform } from 'react-native';
import { Colors } from '@/constants/colors';
import { INVOICE_BREAKPOINTS } from '@/constants/invoiceLayout';
import {
  InvoiceLayoutProvider,
  useInvoiceLayout,
} from '@/contexts/InvoiceLayoutContext';
import type { DocumentTemplateId } from '@/constants/documentBranding';
import type { Currency } from '@/utils/formatPrice';

import DefaultTemplate from './invoice-templates/DefaultTemplate';
import ClassicTemplate from './invoice-templates/ClassicTemplate';
import ModernTemplate from './invoice-templates/ModernTemplate';
import ElegantTemplate from './invoice-templates/ElegantTemplate';
import RestaurantTemplate from './invoice-templates/RestaurantTemplate';
import RetailTemplate from './invoice-templates/RetailTemplate';
import BeautyTemplate from './invoice-templates/BeautyTemplate';

/**
 * Invoice item as rendered by every template. Description is shown below the
 * item name when present.
 */
export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  description?: string;
}

/**
 * Shared invoice data contract. Every template receives the same fields and
 * decides how to lay them out. Optional vendor contact details are surfaced
 * where the template has room for them.
 */
export interface InvoiceRendererData {
  invoiceNumber: string;
  vendorName: string;
  customerName: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string | null;
  currency: Currency;
  lastUpdated?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  amountPaid?: number;
  balanceDue?: number;
  fulfilmentMethod?: 'pickup' | 'delivery' | 'service' | 'none';
  fulfilmentDetails?: {
    location?: string;
    address?: string;
    serviceLocation?: string;
    deliveryFee?: number;
    dateTime?: string;
    instructions?: string;
    notes?: string;
    isFlexible?: boolean;
  } | null;
  /** Delivery fee as a top-level total-breakdown entry. When > 0 it appears
   *  as its own row in the totals block (Subtotal → Delivery fee → Tax →
   *  Discount → Total) and is included in the invoice total. Pulled from
   *  `fulfilmentDetails.deliveryFee` for delivery invoices; 0 otherwise. */
  deliveryFee?: number;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorAddress?: string;
  vendorWebsite?: string;
}

export interface InvoiceRendererBranding {
  logoUri: string | null;
  brandColor: string | null;
  thankYouMessage: string | null;
  footerText: string | null;
  templateId: DocumentTemplateId;
  poweredBySubtle: boolean;
  showLogo: boolean;
  showThankYou: boolean;
  showFooter: boolean;
  showBrandedHeader: boolean;
}

interface InvoiceRendererProps {
  data: InvoiceRendererData;
  branding: InvoiceRendererBranding;
  style?: ViewStyle;
  hidePoweredBy?: boolean;
  mode?: 'card' | 'page';
  seasonalTheme?: string | null;
  printMode?: boolean;
}

const SEASONAL_THEMES: Record<string, { emoji: string; label: string; tint: string; accent: string }> = {
  holiday: { emoji: '\u2744\uFE0F', label: 'Season\'s Greetings', tint: '#EAF4FF', accent: '#1E5BB8' },
  valentine: { emoji: '\u2764\uFE0F', label: 'With love', tint: '#FDECEF', accent: '#D6396B' },
  easter: { emoji: '\uD83C\uDF95', label: 'Happy Easter', tint: '#FFF6E6', accent: '#C97A1B' },
  summer: { emoji: '\u2600\uFE0F', label: 'Summer Special', tint: '#FFF7E6', accent: '#E08A00' },
  halloween: { emoji: '\uD83C\uDF83', label: 'Spooky Season', tint: '#F5F0FF', accent: '#6D4AAE' },
  christmas: { emoji: '\uD83C\uDF84', label: 'Merry Christmas', tint: '#EFF7EE', accent: '#1F7A3A' },
};

const templateMap: Record<
  DocumentTemplateId,
  React.ComponentType<{ data: InvoiceRendererData; branding: InvoiceRendererBranding }>
> = {
  default: DefaultTemplate,
  classic: ClassicTemplate,
  modern: ModernTemplate,
  elegant: ElegantTemplate,
  restaurant: RestaurantTemplate,
  retail: RetailTemplate,
  beauty: BeautyTemplate,
};

export function InvoiceRenderer({
  data,
  branding,
  style,
  mode = 'card',
  seasonalTheme,
  printMode = false,
}: InvoiceRendererProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  return (
    <View
      style={[
        styles.container,
        mode === 'page' && styles.pageContainer,
        style,
      ]}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <PageCanvas mode={mode} printMode={printMode}>
        <InvoiceLayoutProvider
          containerWidth={printMode ? INVOICE_BREAKPOINTS.PRINT_WIDTH : containerWidth}
          printMode={printMode}
        >
          <InvoiceContent
            data={data}
            branding={branding}
            seasonalTheme={seasonalTheme}
          />
        </InvoiceLayoutProvider>
      </PageCanvas>
    </View>
  );
}

function InvoiceContent({
  data,
  branding,
  seasonalTheme,
}: {
  data: InvoiceRendererData;
  branding: InvoiceRendererBranding;
  seasonalTheme?: string | null;
}) {
  const { layout } = useInvoiceLayout();
  const Template = templateMap[branding.templateId] ?? DefaultTemplate;
  const seasonal = seasonalTheme ? SEASONAL_THEMES[seasonalTheme] : null;

  return (
    <>
      {seasonal && (
        <View
          style={[
            styles.seasonalBanner,
            {
              backgroundColor: seasonal.tint,
              marginHorizontal: layout.pagePadding,
              marginTop: layout.pagePadding,
              marginBottom: layout.blockGap,
            },
          ]}
        >
          <Text style={styles.seasonalEmoji}>{seasonal.emoji}</Text>
          <Text style={[styles.seasonalLabel, { color: seasonal.accent }]}>
            {seasonal.label}
          </Text>
        </View>
      )}
      <Template data={data} branding={branding} />
    </>
  );
}

function PageCanvas({
  mode,
  printMode,
  children,
}: {
  mode: 'card' | 'page';
  printMode?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.page,
        mode === 'card' && styles.cardPage,
        mode === 'page' && styles.pageMode,
        printMode && styles.printPage,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  pageContainer: {
    width: '100%',
    maxWidth: INVOICE_BREAKPOINTS.MAX_PAGE_WIDTH,
    alignSelf: 'center',
  },
  page: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  cardPage: {
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DDE3',
    ...Platform.select({
      ios: {
        shadowColor: Colors.text,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  pageMode: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D9DDE3',
  },
  printPage: {
    borderRadius: 0,
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    borderWidth: 1,
    borderColor: '#BBBBBB',
  },
  seasonalBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  seasonalEmoji: {
    fontSize: 13,
  },
  seasonalLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
});

export default InvoiceRenderer;
