import React, { type ReactNode } from 'react';
import { View, Text, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas as formatPrice, type Currency } from '@/utils/formatPrice';
import { useInvoiceLayout, type InvoiceLayoutSpec } from '@/contexts/InvoiceLayoutContext';
import type { InvoiceRendererData, InvoiceRendererBranding } from '@/components/InvoiceRenderer';

export type InvoiceTemplateData = InvoiceRendererData;
export type InvoiceTemplateBranding = InvoiceRendererBranding;
export type { InvoiceLayoutSpec } from '@/contexts/InvoiceLayoutContext';
export { useInvoiceLayout } from '@/contexts/InvoiceLayoutContext';

// NOTE: The official Platform logo asset is not yet provided. Until it is,
// the footer renders as plain text ("Powered by Platform") with no image
// placeholder. Do NOT invent or render a fake logo glyph.

export function formatInvoiceDate(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function formatInvoiceTime(iso?: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatMoney(amount: number, currency: Currency): string {
  return formatPrice(amount, currency);
}

/**
 * Non-breaking amount text. Amounts should stay on one line and never shrink to
 * fit. Use this everywhere a price appears in an invoice.
 */
export function MoneyText({
  amount,
  currency,
  style,
  prefix,
  suffix,
  ...rest
}: {
  amount: number;
  currency: Currency;
  style?: TextStyle;
  prefix?: string;
  suffix?: string;
} & Omit<React.ComponentProps<typeof Text>, 'children' | 'style'>) {
  return (
    <Text
      {...rest}
      numberOfLines={1}
      adjustsFontSizeToFit={false}
      style={[styles.moneyText, style]}
    >
      {prefix}{formatMoney(amount, currency)}{suffix}
    </Text>
  );
}

export function LogoImage({ uri, size = 44 }: { uri?: string | null; size?: number }) {
  if (!uri) return null;
  return (
    <ExpoImage
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: size * 0.16 }}
      contentFit="cover"
    />
  );
}

export function StatusBadge({
  label,
  color,
  backgroundColor,
  small = false,
}: {
  label: string;
  color: string;
  backgroundColor: string;
  small?: boolean;
}) {
  return (
    <View style={[styles.statusBadge, { backgroundColor }, small && styles.statusBadgeSmall]}>
      <Text style={[styles.statusText, { color }, small && styles.statusTextSmall]}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Compact stacked item row used whenever the invoice container is narrow.
 * Preserves item name, optional description, quantity × unit price, and line total.
 */
export function CompactItemRow({
  item,
  index,
  currency,
}: {
  item: InvoiceTemplateData['items'][number];
  index?: number;
  currency: Currency;
}) {
  return (
    <View style={styles.compactRow}>
      <View style={styles.compactRowTop}>
        <View style={styles.compactRowLeft}>
          {index !== undefined && (
            <Text style={styles.compactRowIndex}>{index + 1}. </Text>
          )}
          <Text style={styles.compactRowName} numberOfLines={2}>
            {item.name}
          </Text>
        </View>
        <MoneyText
          amount={item.total}
          currency={currency}
          style={styles.compactRowTotal}
        />
      </View>
      {item.description ? (
        <Text style={styles.compactRowDesc} numberOfLines={3}>
          {item.description}
        </Text>
      ) : null}
      <Text style={styles.compactRowQty}>
        {item.quantity} × {formatMoney(item.unitPrice, currency)}
      </Text>
    </View>
  );
}

export function CompactItemList({
  items,
  currency,
  showIndex = false,
}: {
  items: InvoiceTemplateData['items'];
  currency: Currency;
  showIndex?: boolean;
}) {
  return (
    <View style={styles.compactList}>
      {items.map((item, idx) => (
        <CompactItemRow
          key={item.id}
          item={item}
          index={showIndex ? idx : undefined}
          currency={currency}
        />
      ))}
    </View>
  );
}

export function PaymentSummary({ data }: { data: InvoiceTemplateData }) {
  const paid = typeof data.amountPaid === 'number' ? data.amountPaid : 0;
  const balance =
    typeof data.balanceDue === 'number' ? data.balanceDue : Math.max(0, data.total - paid);
  if (paid <= 0) return null;
  const fullyPaid = balance <= 0;
  return (
    <View style={styles.paymentSummaryCard}>
      <View style={styles.paymentSummaryRow}>
        <Text style={styles.paymentSummaryLabel}>Amount paid</Text>
        <MoneyText
          amount={paid}
          currency={data.currency}
          style={[styles.paymentSummaryValue, { color: Colors.success }]}
        />
      </View>
      <View style={styles.paymentSummaryDivider} />
      <View style={styles.paymentSummaryRow}>
        <Text style={styles.paymentSummaryLabel}>
          {fullyPaid ? 'Balance' : 'Balance due'}
        </Text>
        <MoneyText
          amount={balance}
          currency={data.currency}
          style={[
            styles.paymentSummaryValue,
            fullyPaid && { color: Colors.textMuted },
          ]}
        />
      </View>
    </View>
  );
}

export function FulfilmentDetails({ data }: { data: InvoiceTemplateData }) {
  const method = data.fulfilmentMethod;
  if (!method || method === 'none') return null;
  const details = data.fulfilmentDetails ?? {};
  const title =
    method === 'pickup' ? 'Pickup' : method === 'delivery' ? 'Delivery' : 'Service / Appointment';
  const primaryLine =
    method === 'pickup'
      ? details.location
      : method === 'delivery'
        ? details.address
        : details.serviceLocation;
  const dateStr = details.dateTime ? formatInvoiceDate(details.dateTime) : null;
  const timeStr = details.dateTime ? formatInvoiceTime(details.dateTime) : null;
  const secondary =
    method === 'delivery' && typeof details.deliveryFee === 'number' && details.deliveryFee > 0
      ? `Delivery fee: ${formatMoney(details.deliveryFee, data.currency)}`
      : method === 'service'
        ? details.notes
        : details.instructions;
  return (
    <View style={styles.fulfilmentCard}>
      <Text style={styles.fulfilmentLabel}>FULFILMENT</Text>
      <Text style={styles.fulfilmentTitle}>{title}</Text>
      {primaryLine ? (
        <Text style={styles.fulfilmentLine} numberOfLines={2}>
          {primaryLine}
        </Text>
      ) : null}
      {dateStr ? (
        <Text style={styles.fulfilmentMeta}>
          {dateStr}
          {timeStr ? ` · ${timeStr}` : ''}
        </Text>
      ) : details.isFlexible ? (
        <Text style={styles.fulfilmentMeta}>Time flexible</Text>
      ) : null}
      {secondary ? (
        <Text style={styles.fulfilmentMeta} numberOfLines={3}>
          {secondary}
        </Text>
      ) : null}
    </View>
  );
}

export function TotalsRows({ data }: { data: InvoiceTemplateData }) {
  // Delivery fee appears as its own totals row when > 0. It is pulled from
  // either the top-level `deliveryFee` field or `fulfilmentDetails.deliveryFee`
  // (for backwards compatibility with older invoices that only stored it on
  // the fulfilment details object). It is already included in `data.total`.
  const deliveryFee =
    typeof data.deliveryFee === 'number' && data.deliveryFee > 0
      ? data.deliveryFee
      : data.fulfilmentMethod === 'delivery' &&
          typeof data.fulfilmentDetails?.deliveryFee === 'number' &&
          data.fulfilmentDetails.deliveryFee > 0
        ? data.fulfilmentDetails.deliveryFee
        : 0;
  return (
    <>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Subtotal</Text>
        <MoneyText amount={data.subtotal} currency={data.currency} style={styles.totalValue} />
      </View>
      {deliveryFee > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Delivery fee</Text>
          <MoneyText amount={deliveryFee} currency={data.currency} style={styles.totalValue} />
        </View>
      )}
      {data.tax > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tax</Text>
          <MoneyText amount={data.tax} currency={data.currency} style={styles.totalValue} />
        </View>
      )}
      {data.discount > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Discount</Text>
          <MoneyText
            amount={data.discount}
            currency={data.currency}
            style={[styles.totalValue, { color: Colors.success }]}
            prefix="-"
          />
        </View>
      )}
    </>
  );
}

/**
 * A simple totals block that can be reused by templates that want a clean,
 * right-aligned summary. Templates with more distinctive totals (Modern's bar,
 * Beauty's soft box) can compose from the pieces above instead.
 */
export function TotalsBlock({
  data,
  accent,
  children,
  fullWidth,
}: {
  data: InvoiceTemplateData;
  accent: string;
  children?: ReactNode;
  fullWidth?: boolean;
}) {
  const { layout } = useInvoiceLayout();
  return (
    <View
      style={[
        styles.totalsBlock,
        fullWidth ? { alignSelf: 'stretch', width: '100%' } : { width: layout.totalsWidth },
      ]}
    >
      <TotalsRows data={data} />
      {children}
      <PaymentSummary data={data} />
      <View style={[styles.grandTotal, { borderTopColor: accent }]}>
        <Text style={[styles.grandTotalLabel, { color: accent }]}>Total</Text>
        <MoneyText amount={data.total} currency={data.currency} style={[styles.grandTotalValue, { color: accent }]} />
      </View>
    </View>
  );
}

/** Reusable uppercase section label. */
export function LabelText({
  children,
  style,
}: {
  children: ReactNode;
  style?: TextStyle;
}) {
  return <Text style={[styles.labelText, style]}>{children}</Text>;
}

/** Standard horizontal divider. */
export function SectionDivider({
  color = Colors.borderDark,
  style,
}: {
  color?: string;
  style?: ViewStyle;
}) {
  return <View style={[styles.divider, { backgroundColor: color }, style]} />;
}

/** Branded footer shown at the bottom of every invoice.
 *  Until the official Platform logo is provided, this renders as plain
 *  centered text — "Powered by Platform" — with no image placeholder. */
export function PlatformFooter({ subtle = false }: { subtle?: boolean }) {
  return (
    <View style={styles.platformFooter}>
      <Text style={[styles.platformFooterText, subtle && styles.platformFooterSubtle]}>
        Powered by Platform
      </Text>
    </View>
  );
}

/**
 * Responsive metadata grid. On compact it stacks; on medium it uses two
 * columns; on wide it uses three columns. Each group shows a clear label
 * above its value.
 */
export function MetadataGrid({
  groups,
}: {
  groups: {
    key: string;
    label: string;
    value: ReactNode;
    align?: 'left' | 'right';
  }[];
}) {
  const { layout } = useInvoiceLayout();
  const itemWidth = layout.compact ? '100%' : layout.medium ? '50%' : '33%';
  return (
    <View style={styles.metadataGrid}>
      {groups.map((g) => (
        <View
          key={g.key}
          style={[
            styles.metadataItem,
            { width: itemWidth },
            g.align === 'right' && styles.metadataItemRight,
          ]}
        >
          <LabelText style={styles.metadataItemLabel}>{g.label}</LabelText>
          <View style={styles.metadataItemValueWrap}>{g.value}</View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  moneyText: {
    fontVariant: ['tabular-nums'],
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextSmall: {
    fontSize: 10,
  },
  compactList: {
    gap: 14,
  },
  compactRow: {
    paddingVertical: 4,
  },
  compactRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  compactRowLeft: {
    flexDirection: 'row',
    flex: 1,
    paddingRight: 12,
  },
  compactRowIndex: {
    fontSize: 13,
    color: Colors.textMuted,
    marginRight: 4,
  },
  compactRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    lineHeight: 20,
  },
  compactRowDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 3,
  },
  compactRowQty: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  compactRowTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentSummaryCard: {
    backgroundColor: '#F7FAF7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#DCEBD9',
    marginTop: 8,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  paymentSummaryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  paymentSummaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  paymentSummaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#DCEBD9',
    marginVertical: 4,
  },
  fulfilmentCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#F4F6F8',
  },
  fulfilmentLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  fulfilmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  fulfilmentLine: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  fulfilmentMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text,
  },
  totalsBlock: {
    alignSelf: 'flex-end',
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1.5,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  labelText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    lineHeight: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  platformFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  platformFooterText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  platformFooterSubtle: {
    color: Colors.textMuted,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metadataItem: {
    paddingRight: 12,
    marginBottom: 12,
  },
  metadataItemRight: {
    alignItems: 'flex-end',
    paddingRight: 0,
    paddingLeft: 12,
  },
  metadataItemLabel: {
    marginBottom: 4,
  },
  metadataItemValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
});

export default {
  formatInvoiceDate,
  formatInvoiceTime,
  formatMoney,
  LogoImage,
  StatusBadge,
  MoneyText,
  CompactItemRow,
  CompactItemList,
  PaymentSummary,
  FulfilmentDetails,
  TotalsRows,
  TotalsBlock,
  LabelText,
  SectionDivider,
  PlatformFooter,
  MetadataGrid,
};
