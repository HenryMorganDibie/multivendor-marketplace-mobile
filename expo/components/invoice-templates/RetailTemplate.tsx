import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  LogoImage,
  StatusBadge,
  PaymentSummary,
  TotalsRows,
  formatInvoiceDate,
  formatMoney,
  useInvoiceLayout,
  CompactItemList,
  platformFooter,
  LabelText,
  SectionDivider,
  MoneyText,
  type InvoiceTemplateData,
  type InvoiceTemplateBranding,
} from './InvoiceTemplateParts';
import { Colors } from '@/constants/colors';

export default function RetailTemplate({
  data,
  branding,
}: {
  data: InvoiceTemplateData;
  branding: InvoiceTemplateBranding;
}) {
  const { layout } = useInvoiceLayout();
  const accent = branding.brandColor ?? Colors.primary;
  const issueStr = formatInvoiceDate(data.issueDate);
  const dueStr = formatInvoiceDate(data.dueDate);

  return (
    <View style={[styles.page, { padding: layout.pagePadding }]}>
      {/* Compact business header */}
      <View style={[styles.headerRow, layout.compact && styles.headerRowCompact]}>
        <View style={[styles.headerLeft, layout.compact && styles.headerLeftCompact]}>
          {branding.showLogo && branding.logoUri ? (
            <LogoImage uri={branding.logoUri} size={layout.compact ? 28 : 32} />
          ) : null}
          <Text style={styles.vendorName} numberOfLines={2}>
            {data.vendorName}
          </Text>
        </View>
        <View style={[styles.headerRight, layout.compact && styles.headerRightCompact]}>
          <LabelText>Invoice</LabelText>
          <Text style={styles.invoiceNumber} numberOfLines={1}>
            {data.invoiceNumber}
          </Text>
        </View>
      </View>

      {/* Small customer and invoice details */}
      <View style={[styles.infoGrid, { gap: layout.blockGap }]}>
        <View style={styles.infoItem}>
          <LabelText>Bill to</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.customerName}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <LabelText>Issued</LabelText>
          <Text style={styles.infoValue}>{issueStr || '—'}</Text>
        </View>
        <View style={styles.infoItem}>
          <LabelText>Due</LabelText>
          <Text style={styles.infoValue}>{dueStr || '—'}</Text>
        </View>
        <View style={[styles.infoItem, { alignItems: 'flex-start' }]}>
          <StatusBadge
            label={data.statusLabel}
            color={data.statusColor}
            backgroundColor={data.statusBg}
            small
          />
        </View>
      </View>

      <SectionDivider color={Colors.borderDark} style={{ marginVertical: layout.sectionGap }} />

      {/* Fulfilment */}
      {data.fulfilmentMethod && data.fulfilmentMethod !== 'none' && (
        <View style={{ marginBottom: layout.sectionGap }}>
          <RetailFulfilment data={data} />
        </View>
      )}

      {/* Dense product table */}
      {layout.compact ? (
        <CompactItemList items={data.items} currency={data.currency} showIndex />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colNo]}>#</Text>
            <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cell, styles.colNo]}>{index + 1}</Text>
              <Text style={[styles.cell, styles.colItem]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[styles.cell, styles.colDesc]} numberOfLines={1}>
                {item.description || ''}
              </Text>
              <Text style={[styles.cell, styles.colQty]}>{item.quantity}</Text>
              <MoneyText
                amount={item.unitPrice}
                currency={data.currency}
                style={[styles.cell, styles.colPrice]}
              />
              <MoneyText
                amount={item.total}
                currency={data.currency}
                style={[styles.cell, styles.colAmount]}
              />
            </View>
          ))}
        </View>
      )}

      <SectionDivider color={Colors.borderDark} style={{ marginVertical: layout.sectionGap }} />

      {/* Right-aligned summary */}
      <View
        style={[
          styles.totalsBlock,
          {
            width: layout.compact ? '100%' : layout.totalsWidth,
            alignSelf: layout.compact ? 'stretch' : 'flex-end',
          },
        ]}
      >
        <TotalsRows data={data} />
        <PaymentSummary data={data} />
        <View style={[styles.grandTotal, { borderTopColor: accent }]}>
          <Text style={[styles.grandTotalLabel, { color: accent }]}>Total</Text>
          <MoneyText
            amount={data.total}
            currency={data.currency}
            style={[styles.grandTotalValue, { color: accent }]}
          />
        </View>
      </View>

      {/* Notes */}
      {data.notes ? (
        <View style={{ marginTop: layout.sectionGap }}>
          <LabelText style={{ marginBottom: layout.rowGap }}>NOTES</LabelText>
          <Text style={styles.notesText} numberOfLines={20}>
            {data.notes}
          </Text>
        </View>
      ) : null}

      {/* Footer */}
      {branding.showFooter && branding.footerText ? (
        <View style={{ marginTop: layout.sectionGap }}>
          <Text style={styles.footerText} numberOfLines={20}>
            {branding.footerText}
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: layout.sectionGap }}>
        <platformFooter subtle={branding.poweredBySubtle} />
      </View>
    </View>
  );
}

function RetailFulfilment({ data }: { data: InvoiceTemplateData }) {
  const method = data.fulfilmentMethod!;
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
    <View style={styles.fulfilmentCompact}>
      <LabelText>{title}</LabelText>
      {primaryLine ? <Text style={styles.fulfilmentLine}>{primaryLine}</Text> : null}
      {dateStr ? (
        <Text style={styles.fulfilmentLine}>
          {dateStr}
          {timeStr ? ` · ${timeStr}` : ''}
        </Text>
      ) : details.isFlexible ? (
        <Text style={styles.fulfilmentLine}>Time flexible</Text>
      ) : null}
      {secondary ? <Text style={styles.fulfilmentLine}>{secondary}</Text> : null}
    </View>
  );
}

function formatInvoiceTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  headerLeftCompact: {
    width: '100%',
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginLeft: 8,
    letterSpacing: -0.2,
  },
  headerRight: {
    alignItems: 'flex-end',
    minWidth: 140,
  },
  headerRightCompact: {
    alignItems: 'flex-start',
    width: '100%',
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    minWidth: 120,
    flex: 1,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text,
    marginTop: 2,
  },
  table: {
    marginTop: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDark,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cell: {
    fontSize: 11,
    color: Colors.text,
  },
  colNo: {
    width: 22,
  },
  colItem: {
    flex: 1.3,
    paddingRight: 4,
  },
  colDesc: {
    flex: 1.6,
    paddingRight: 4,
    color: Colors.textSecondary,
  },
  colQty: {
    width: 28,
  },
  colPrice: {
    width: 58,
    textAlign: 'right',
  },
  colAmount: {
    width: 58,
    textAlign: 'right',
  },
  totalsBlock: {
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1,
  },
  totalLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1.5,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  grandTotalValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  fulfilmentCompact: {
    backgroundColor: '#F4F5F8',
    borderRadius: 6,
    padding: 10,
  },
  fulfilmentLine: {
    fontSize: 11,
    color: Colors.text,
    lineHeight: 16,
    marginTop: 2,
  },
  notesText: {
    fontSize: 11,
    color: Colors.text,
    lineHeight: 16,
  },
  footerText: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 15,
  },
});
