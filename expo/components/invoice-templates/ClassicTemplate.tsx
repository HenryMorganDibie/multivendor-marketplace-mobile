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

export default function ClassicTemplate({
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
      {/* Strong top divider */}
      <View style={[styles.topDivider, { backgroundColor: Colors.text }]} />

      {/* Formal header */}
      <View style={[styles.headerRow, layout.compact && styles.headerRowCompact]}>
        <View style={[styles.vendorBlock, layout.compact && styles.vendorBlockCompact]}>
          {branding.showLogo && branding.logoUri ? (
            <LogoImage uri={branding.logoUri} size={layout.compact ? 34 : 38} />
          ) : null}
          <View style={styles.vendorTextBlock}>
            <Text style={styles.vendorName} numberOfLines={2}>
              {data.vendorName}
            </Text>
          </View>
        </View>
        <View style={[styles.contactBlock, layout.compact && styles.contactBlockCompact]}>
          {data.vendorAddress ? (
            <Text style={styles.contactLine} numberOfLines={2}>
              {data.vendorAddress}
            </Text>
          ) : null}
          {data.vendorPhone ? <Text style={styles.contactLine}>{data.vendorPhone}</Text> : null}
          {data.vendorEmail ? <Text style={styles.contactLine}>{data.vendorEmail}</Text> : null}
          {data.vendorWebsite ? <Text style={styles.contactLine}>{data.vendorWebsite}</Text> : null}
        </View>
      </View>

      {/* Customer and invoice details */}
      <View style={[styles.infoRow, layout.compact && styles.infoRowCompact]}>
        <View style={styles.infoCol}>
          <LabelText>Bill to</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.customerName}
          </Text>
        </View>
        <View style={[styles.infoCol, styles.invoiceCol]}>
          <View style={styles.invoiceDetailLine}>
            <LabelText style={styles.invoiceDetailLabel}>Invoice number</LabelText>
            <Text style={styles.invoiceDetailValue} numberOfLines={1}>
              {data.invoiceNumber}
            </Text>
          </View>
          {issueStr ? (
            <View style={styles.invoiceDetailLine}>
              <LabelText style={styles.invoiceDetailLabel}>Issue date</LabelText>
              <Text style={styles.invoiceDetailValue}>{issueStr}</Text>
            </View>
          ) : null}
          {dueStr ? (
            <View style={styles.invoiceDetailLine}>
              <LabelText style={styles.invoiceDetailLabel}>Due date</LabelText>
              <Text style={styles.invoiceDetailValue}>{dueStr}</Text>
            </View>
          ) : null}
          <View style={styles.statusLine}>
            <LabelText style={styles.invoiceDetailLabel}>Status</LabelText>
            <StatusBadge
              label={data.statusLabel}
              color={data.statusColor}
              backgroundColor={data.statusBg}
              small
            />
          </View>
        </View>
      </View>

      {/* Fulfilment */}
      {data.fulfilmentMethod && data.fulfilmentMethod !== 'none' && (
        <View style={{ marginTop: layout.sectionGap }}>
          <FulfilmentDetails data={data} />
        </View>
      )}

      <SectionDivider color="#D9D3CC" style={{ marginVertical: layout.sectionGap }} />

      {/* Thin-lined item table */}
      {layout.compact ? (
        <CompactItemList items={data.items} currency={data.currency} />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Unit price</Text>
            <Text style={[styles.tableHeaderCell, styles.colAmount]}>Amount</Text>
          </View>
          {data.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.colDescription}>
                <Text style={styles.itemName} numberOfLines={2}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={styles.itemDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
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

      <SectionDivider color="#D9D3CC" style={{ marginVertical: layout.sectionGap }} />

      {/* Total summary in a bordered box */}
      <View
        style={[
          styles.totalsBox,
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

      {/* Thank-you message */}
      {branding.showThankYou && branding.thankYouMessage ? (
        <View style={[styles.thankYouBox, { marginTop: layout.sectionGap }]}>
          <Text style={styles.thankYouText}>{branding.thankYouMessage}</Text>
        </View>
      ) : null}

      {/* Footer / payment instructions */}
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

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
  },
  topDivider: {
    height: 4,
    marginBottom: 18,
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
    marginLeft: 10,
    flex: 1,
  },
  vendorName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  contactBlock: {
    alignItems: 'flex-end',
    maxWidth: 220,
  },
  contactBlockCompact: {
    alignItems: 'flex-start',
    width: '100%',
    maxWidth: '100%',
  },
  contactLine: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 14,
    textAlign: 'right',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  infoRowCompact: {
    flexDirection: 'column',
    gap: 14,
  },
  infoCol: {
    flex: 1,
    minWidth: 140,
  },
  invoiceCol: {
    alignItems: 'flex-end',
  },
  invoiceDetailLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  invoiceDetailLabel: {
    textAlign: 'right',
    marginRight: 8,
    fontSize: 9,
  },
  invoiceDetailValue: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '500',
    minWidth: 90,
    textAlign: 'right',
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 4,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#D9D3CC',
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
    borderBottomColor: '#E8E3DC',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  itemDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  cell: {
    fontSize: 12,
    color: Colors.text,
  },
  colDescription: {
    flex: 2,
    paddingRight: 8,
  },
  colQty: {
    width: 38,
  },
  colPrice: {
    width: 80,
    textAlign: 'right',
  },
  colAmount: {
    width: 80,
    textAlign: 'right',
  },
  totalsBox: {
    borderWidth: 1,
    borderColor: '#D9D3CC',
    borderRadius: 4,
    padding: 14,
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
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  thankYouBox: {
    backgroundColor: '#FDFCFA',
    borderRadius: 4,
    padding: 12,
  },
  thankYouText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
