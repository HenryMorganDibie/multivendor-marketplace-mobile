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
  MoneyText,
  type InvoiceTemplateData,
  type InvoiceTemplateBranding,
} from './InvoiceTemplateParts';
import { Colors } from '@/constants/colors';

export default function ModernTemplate({
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
  const paid = typeof data.amountPaid === 'number' ? data.amountPaid : 0;
  const balance = typeof data.balanceDue === 'number' ? data.balanceDue : Math.max(0, data.total - paid);
  const amountDue = paid > 0 ? balance : data.total;

  return (
    <View style={[styles.page, { padding: layout.pagePadding }]}>
      {/* Large colored header block */}
      <View style={[styles.headerBlock, { backgroundColor: accent }]}>
        <View style={[styles.headerLeft, layout.compact && styles.headerLeftCompact]}>
          {branding.showLogo && branding.logoUri ? (
            <LogoImage uri={branding.logoUri} size={layout.compact ? 36 : 42} />
          ) : null}
          <View style={styles.headerTextBlock}>
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
        <View style={[styles.headerRight, layout.compact && styles.headerRightCompact]}>
          <LabelText style={styles.amountDueLabel}>Amount due</LabelText>
          <MoneyText
            amount={amountDue}
            currency={data.currency}
            style={styles.amountDueValue}
          />
          <View style={styles.headerStatus}>
            <StatusBadge
              label={data.statusLabel}
              color={data.statusColor}
              backgroundColor={data.statusBg}
              small
            />
          </View>
        </View>
      </View>

      {/* Invoice metadata in compact pills */}
      <View style={[styles.metaGrid, { marginTop: layout.blockGap, marginBottom: layout.sectionGap }]}>
        <View style={styles.metaPill}>
          <LabelText style={styles.metaPillLabel}>Invoice #</LabelText>
          <Text style={styles.metaPillValue} numberOfLines={1}>
            {data.invoiceNumber}
          </Text>
        </View>
        <View style={styles.metaPill}>
          <LabelText style={styles.metaPillLabel}>Billed to</LabelText>
          <Text style={styles.metaPillValue} numberOfLines={1}>
            {data.customerName}
          </Text>
        </View>
        {issueStr ? (
          <View style={styles.metaPill}>
            <LabelText style={styles.metaPillLabel}>Issued</LabelText>
            <Text style={styles.metaPillValue}>{issueStr}</Text>
          </View>
        ) : null}
        {dueStr ? (
          <View style={styles.metaPill}>
            <LabelText style={styles.metaPillLabel}>Due</LabelText>
            <Text style={styles.metaPillValue}>{dueStr}</Text>
          </View>
        ) : null}
      </View>

      {/* Fulfilment */}
      {data.fulfilmentMethod && data.fulfilmentMethod !== 'none' && (
        <View style={{ marginBottom: layout.sectionGap }}>
          <FulfilmentDetails data={data} />
        </View>
      )}

      {/* Items */}
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

      {/* Totals breakdown + payment summary + total bar */}
      <View style={{ marginTop: layout.sectionGap }}>
        <TotalsRows data={data} />
        <PaymentSummary data={data} />
      </View>
      <View style={[styles.totalBar, { backgroundColor: accent, marginTop: layout.blockGap }]}>
        <Text style={styles.totalBarLabel}>Total</Text>
        <MoneyText amount={data.total} currency={data.currency} style={styles.totalBarValue} />
      </View>

      {/* Notes */}
      {data.notes ? (
        <View style={[styles.notesBlock, { borderLeftColor: accent, marginTop: layout.sectionGap }]}>
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

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
  },
  headerBlock: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    borderRadius: 14,
    padding: 18,
    gap: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 180,
  },
  headerLeftCompact: {
    width: '100%',
    minWidth: '100%',
  },
  headerTextBlock: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
  thankYou: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 3,
  },
  headerRight: {
    alignItems: 'flex-end',
    minWidth: 160,
  },
  headerRightCompact: {
    alignItems: 'flex-start',
    width: '100%',
    minWidth: '100%',
  },
  amountDueLabel: {
    color: 'rgba(255,255,255,0.82)',
  },
  amountDueValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.white,
    marginTop: 2,
  },
  headerStatus: {
    marginTop: 6,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    backgroundColor: '#F4F5F8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
    flex: 1,
  },
  metaPillLabel: {
    fontSize: 9,
    marginBottom: 2,
  },
  metaPillValue: {
    fontSize: 11,
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
    paddingVertical: 10,
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
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalBarLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  totalBarValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.white,
  },
  notesBlock: {
    paddingLeft: 12,
    borderLeftWidth: 3,
  },
  notesText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 19,
  },
  footerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
