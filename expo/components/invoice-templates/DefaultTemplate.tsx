import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  LogoImage,
  StatusBadge,
  PaymentSummary,
  FulfilmentDetails,
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

export default function DefaultTemplate({
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
  const showVendorContact = Boolean(
    data.vendorAddress || data.vendorPhone || data.vendorEmail || data.vendorWebsite
  );

  return (
    <View style={[styles.page, { padding: layout.pagePadding }]}>
      {/* Header: logo/name left, invoice metadata right */}
      <View style={[styles.headerRow, layout.compact && styles.headerRowCompact]}>
        <View style={[styles.vendorBlock, layout.compact && styles.vendorBlockCompact]}>
          {branding.showLogo && branding.logoUri ? (
            <LogoImage uri={branding.logoUri} size={layout.compact ? 36 : 44} />
          ) : null}
          <View style={styles.vendorTextBlock}>
            <Text style={styles.vendorName} numberOfLines={2}>
              {data.vendorName}
            </Text>
            {branding.showThankYou && branding.thankYouMessage ? (
              <Text style={styles.thankYou} numberOfLines={2}>
                {branding.thankYouMessage}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.invoiceMetaBlock, layout.compact && styles.invoiceMetaBlockCompact]}>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={styles.invoiceNumber} numberOfLines={1}>
            {data.invoiceNumber}
          </Text>
          {issueStr || dueStr ? (
            <Text style={styles.metaLine}>
              {issueStr ? `Issued ${issueStr}` : ''}
              {issueStr && dueStr ? ' · ' : ''}
              {dueStr ? `Due ${dueStr}` : ''}
            </Text>
          ) : null}
          <View style={styles.statusWrap}>
            <StatusBadge
              label={data.statusLabel}
              color={data.statusColor}
              backgroundColor={data.statusBg}
              small
            />
          </View>
        </View>
      </View>

      <SectionDivider color={Colors.borderDark} style={{ marginVertical: layout.sectionGap }} />

      {/* From / Bill to */}
      <View style={[styles.addressRow, layout.compact && styles.addressRowCompact]}>
        <View style={styles.addressCol}>
          <LabelText>From</LabelText>
          <Text style={styles.addressName} numberOfLines={2}>
            {data.vendorName}
          </Text>
          {showVendorContact && (
            <View style={styles.contactLines}>
              {data.vendorAddress ? (
                <Text style={styles.addressLine} numberOfLines={2}>
                  {data.vendorAddress}
                </Text>
              ) : null}
              {data.vendorPhone ? (
                <Text style={styles.addressLine}>{data.vendorPhone}</Text>
              ) : null}
              {data.vendorEmail ? (
                <Text style={styles.addressLine}>{data.vendorEmail}</Text>
              ) : null}
              {data.vendorWebsite ? (
                <Text style={styles.addressLine}>{data.vendorWebsite}</Text>
              ) : null}
            </View>
          )}
        </View>
        <View style={styles.addressCol}>
          <LabelText>Bill to</LabelText>
          <Text style={styles.addressName} numberOfLines={2}>
            {data.customerName}
          </Text>
        </View>
      </View>

      {/* Fulfilment */}
      {data.fulfilmentMethod && data.fulfilmentMethod !== 'none' && (
        <View style={{ marginTop: layout.sectionGap }}>
          <FulfilmentDetails data={data} />
        </View>
      )}

      {/* Items */}
      <View style={{ marginTop: layout.sectionGap }}>
        <LabelText style={{ marginBottom: layout.blockGap }}>ITEMS</LabelText>
        {layout.compact ? (
          <CompactItemList items={data.items} currency={data.currency} />
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
              <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
              <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
              <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit price</Text>
              <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
            </View>
            {data.items.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colItem]} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={[styles.cell, styles.colDescription]} numberOfLines={2}>
                  {item.description ?? ''}
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
      </View>

      {/* Totals — two-column layout (label left, amount right), no overlap.
          Uses the shared TotalsRows so delivery fee / tax / discount stay
          consistent across every template. Empty rows are hidden. */}
      <View
        style={[
          styles.totalsBlock,
          layout.compact && styles.totalsBlockCompact,
          { marginTop: layout.sectionGap },
        ]}
      >
        <View
          style={[
            styles.totalsInner,
            { width: layout.compact ? '100%' : layout.totalsWidth },
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

      {/* Footer / payment instructions */}
      {branding.showFooter && branding.footerText ? (
        <View style={{ marginTop: layout.sectionGap }}>
          <LabelText style={{ marginBottom: layout.rowGap }}>Payment instructions</LabelText>
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

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerRowCompact: {
    flexDirection: 'column',
  },
  vendorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  vendorBlockCompact: {
    width: '100%',
    minWidth: '100%',
  },
  vendorTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  thankYou: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  invoiceMetaBlock: {
    alignItems: 'flex-end',
    minWidth: 160,
  },
  invoiceMetaBlockCompact: {
    alignItems: 'flex-start',
    width: '100%',
    minWidth: '100%',
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 1,
  },
  invoiceNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 4,
  },
  metaLine: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },
  statusWrap: {
    marginTop: 6,
  },
  addressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  addressRowCompact: {
    flexDirection: 'column',
    gap: 14,
  },
  addressCol: {
    flex: 1,
    minWidth: 140,
  },
  contactLines: {
    marginTop: 4,
  },
  addressName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  addressLine: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderDark,
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  cell: {
    fontSize: 12,
    color: Colors.text,
  },
  colItem: {
    flex: 1.6,
    paddingRight: 6,
  },
  colDescription: {
    flex: 2,
    paddingRight: 6,
    color: Colors.textSecondary,
  },
  colQty: {
    width: 36,
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  colAmount: {
    width: 80,
    textAlign: 'right',
  },
  totalsBlock: {
    alignSelf: 'flex-end',
  },
  totalsBlockCompact: {
    alignSelf: 'stretch',
  },
  totalsInner: {
    alignSelf: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  notesText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 18,
  },
});
