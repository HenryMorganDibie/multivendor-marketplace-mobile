import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  LogoImage,
  StatusBadge,
  PaymentSummary,
  TotalsRows,
  formatInvoiceDate,
  formatInvoiceTime,
  formatMoney,
  useInvoiceLayout,
  CompactItemList,
  the platformFooter,
  LabelText,
  SectionDivider,
  MoneyText,
  type InvoiceTemplateData,
  type InvoiceTemplateBranding,
} from './InvoiceTemplateParts';
import { Colors } from '@/constants/colors';

export default function RestaurantTemplate({
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
  const details = data.fulfilmentDetails ?? {};
  const method = data.fulfilmentMethod;
  const dateStr = details.dateTime ? formatInvoiceDate(details.dateTime) : null;
  const timeStr = details.dateTime ? formatInvoiceTime(details.dateTime) : null;

  return (
    <View style={[styles.page, { padding: layout.pagePadding }]}>
      {/* Warm menu-style header */}
      <View style={[styles.header, layout.compact && styles.headerCompact]}>
        {branding.showLogo && branding.logoUri ? (
          <LogoImage uri={branding.logoUri} size={layout.compact ? 40 : 46} />
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.vendorName} numberOfLines={2}>
            {data.vendorName}
          </Text>
          {branding.showThankYou && branding.thankYouMessage ? (
            <Text style={styles.thankYou} numberOfLines={2}>
              {branding.thankYouMessage}
            </Text>
          ) : null}
          {(data.vendorAddress || data.vendorPhone || data.vendorEmail) && (
            <View style={styles.contactLine}>
              {data.vendorAddress ? (
                <Text style={styles.contact} numberOfLines={1}>
                  {data.vendorAddress}
                </Text>
              ) : null}
              {data.vendorPhone ? <Text style={styles.contact}>{data.vendorPhone}</Text> : null}
            </View>
          )}
        </View>
      </View>

      <View style={styles.headerDivider} />

      {/* Fulfilment information shown prominently */}
      {method && method !== 'none' && (
        <View style={[styles.fulfilmentBox, { borderColor: accent }]}>
          <Text style={[styles.fulfilmentTitle, { color: accent }]}>
            {method === 'pickup' ? 'Pickup' : method === 'delivery' ? 'Delivery' : 'Service / Appointment'}
          </Text>
          <View style={[styles.fulfilmentGrid, { gap: layout.blockGap }]}>
            {method === 'pickup' && details.location ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Location</LabelText>
                <Text style={styles.fulfilmentItemValue} numberOfLines={2}>
                  {details.location}
                </Text>
              </View>
            ) : null}
            {method === 'delivery' && details.address ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Address</LabelText>
                <Text style={styles.fulfilmentItemValue} numberOfLines={2}>
                  {details.address}
                </Text>
              </View>
            ) : null}
            {method === 'service' && details.serviceLocation ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Location</LabelText>
                <Text style={styles.fulfilmentItemValue} numberOfLines={2}>
                  {details.serviceLocation}
                </Text>
              </View>
            ) : null}
            {dateStr ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Date & time</LabelText>
                <Text style={styles.fulfilmentItemValue}>
                  {dateStr}
                  {timeStr ? ` · ${timeStr}` : ''}
                </Text>
              </View>
            ) : details.isFlexible ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Date & time</LabelText>
                <Text style={styles.fulfilmentItemValue}>Time flexible</Text>
              </View>
            ) : null}
            {details.instructions ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Instructions</LabelText>
                <Text style={styles.fulfilmentItemValue} numberOfLines={2}>
                  {details.instructions}
                </Text>
              </View>
            ) : null}
            {details.notes ? (
              <View style={styles.fulfilmentItem}>
                <LabelText>Notes</LabelText>
                <Text style={styles.fulfilmentItemValue} numberOfLines={2}>
                  {details.notes}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Customer & invoice details */}
      <View style={[styles.infoRow, layout.compact && styles.infoRowCompact]}>
        <View style={styles.infoCol}>
          <LabelText>Customer</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.customerName}
          </Text>
        </View>
        <View style={[styles.infoCol, { alignItems: 'flex-end' }]}>
          <Text style={styles.infoNumber} numberOfLines={1}>
            {data.invoiceNumber}
          </Text>
          <Text style={styles.infoDate}>
            {issueStr ? `Issued ${issueStr}` : ''}
            {issueStr && dueStr ? ' · ' : ''}
            {dueStr ? `Due ${dueStr}` : ''}
          </Text>
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

      <SectionDivider color="#F2E5D8" style={{ marginVertical: layout.sectionGap }} />

      {/* Order / catering bill style item list */}
      {layout.compact ? (
        <CompactItemList items={data.items} currency={data.currency} />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colItem]}>Item</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Price</Text>
            <Text style={[styles.tableHeaderCell, styles.colTotal]}>Total</Text>
          </View>
          {data.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <View style={styles.colItem}>
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
                style={[styles.cell, styles.colTotal]}
              />
            </View>
          ))}
        </View>
      )}

      {method === 'delivery' && typeof details.deliveryFee === 'number' && details.deliveryFee > 0 && (
        <View style={styles.deliveryFeeRow}>
          <Text style={styles.deliveryFeeLabel}>Delivery fee</Text>
          <MoneyText
            amount={details.deliveryFee}
            currency={data.currency}
            style={styles.deliveryFeeValue}
          />
        </View>
      )}

      <SectionDivider color="#F2E5D8" style={{ marginVertical: layout.sectionGap }} />

      {/* Strong total section */}
      <View
        style={[
          styles.totalsBlock,
          {
            width: layout.compact ? '100%' : layout.totalsWidth,
            alignSelf: layout.compact ? 'stretch' : 'flex-end',
            marginTop: layout.sectionGap,
          },
        ]}
      >
        <TotalsRows data={data} />
        <PaymentSummary data={data} />
        <View style={[styles.grandTotal, { backgroundColor: accent }]}>
          <Text style={styles.grandTotalLabel}>Total</Text>
          <MoneyText amount={data.total} currency={data.currency} style={styles.grandTotalValue} />
        </View>
      </View>

      {/* Notes */}
      {data.notes ? (
        <View style={[{ marginTop: layout.sectionGap }, styles.notesBox]}>
          <LabelText style={{ marginBottom: layout.rowGap }}>Notes / Dietary instructions</LabelText>
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
        <the platformFooter subtle={branding.poweredBySubtle} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFBF7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  thankYou: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  contactLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  contact: {
    fontSize: 11,
    color: Colors.textMuted,
    marginRight: 8,
  },
  headerDivider: {
    height: 2,
    backgroundColor: '#F2E5D8',
    marginVertical: 16,
  },
  fulfilmentBox: {
    borderWidth: 1,
    borderStyle: 'dashed' as const,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  fulfilmentTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  fulfilmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  fulfilmentItem: {
    minWidth: 130,
  },
  fulfilmentItemValue: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  infoNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  infoDate: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusWrap: {
    marginTop: 6,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2E5D8',
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
    borderBottomColor: '#F2E5D8',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  itemDescription: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  cell: {
    fontSize: 12,
    color: Colors.text,
  },
  colItem: {
    flex: 2,
    paddingRight: 6,
  },
  colQty: {
    width: 36,
  },
  colPrice: {
    width: 70,
    textAlign: 'right',
  },
  colTotal: {
    width: 70,
    textAlign: 'right',
  },
  deliveryFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  deliveryFeeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  deliveryFeeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  totalsBlock: {
    alignItems: 'flex-end',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  totalLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingRight: 12,
  },
  totalValue: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  grandTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.white,
  },
  notesBox: {
    backgroundColor: '#FFF8F0',
    borderRadius: 8,
    padding: 12,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
