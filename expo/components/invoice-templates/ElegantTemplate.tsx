import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
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
  PlatformFooter,
  LabelText,
  SectionDivider,
  MoneyText,
  type InvoiceTemplateData,
  type InvoiceTemplateBranding,
} from './InvoiceTemplateParts';
import { Colors } from '@/constants/colors';

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif' });

export default function ElegantTemplate({
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
      {/* Centered header with decorative rule */}
      <View style={styles.header}>
        {branding.showLogo && branding.logoUri ? (
          <LogoImage uri={branding.logoUri} size={layout.compact ? 42 : 48} />
        ) : null}
        <Text style={[styles.vendorName, { fontFamily: SERIF }]} numberOfLines={2}>
          {data.vendorName}
        </Text>
        <View style={[styles.accentRule, { backgroundColor: accent }]} />
        <Text style={[styles.invoiceTitle, { fontFamily: SERIF }]}>INVOICE</Text>
      </View>

      {/* From / Invoice to */}
      <View style={[styles.infoRow, layout.compact && styles.infoRowCompact]}>
        <View style={styles.infoCol}>
          <LabelText style={{ fontFamily: SERIF }}>From</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.vendorName}
          </Text>
          {data.vendorAddress ? (
            <Text style={styles.infoLine} numberOfLines={2}>
              {data.vendorAddress}
            </Text>
          ) : null}
          {data.vendorPhone ? <Text style={styles.infoLine}>{data.vendorPhone}</Text> : null}
          {data.vendorEmail ? <Text style={styles.infoLine}>{data.vendorEmail}</Text> : null}
        </View>
        <View style={styles.infoCol}>
          <LabelText style={{ fontFamily: SERIF }}>Invoice to</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.customerName}
          </Text>
          <View style={styles.metaLine}>
            <Text style={styles.metaLabel}>Number </Text>
            <Text style={styles.metaValue} numberOfLines={1}>
              {data.invoiceNumber}
            </Text>
          </View>
          {issueStr ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Issued </Text>
              <Text style={styles.metaValue}>{issueStr}</Text>
            </View>
          ) : null}
          {dueStr ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Due </Text>
              <Text style={styles.metaValue}>{dueStr}</Text>
            </View>
          ) : null}
          <View style={styles.statusLine}>
            <Text style={styles.metaLabel}>Status </Text>
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

      <SectionDivider color={accent} style={{ marginVertical: layout.sectionGap }} />

      {/* Items */}
      {layout.compact ? (
        <CompactItemList items={data.items} currency={data.currency} />
      ) : (
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { fontFamily: SERIF }, styles.colDescription]}>
              Description
            </Text>
            <Text style={[styles.tableHeaderCell, { fontFamily: SERIF }, styles.colQty]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, { fontFamily: SERIF }, styles.colPrice]}>
              Unit price
            </Text>
            <Text style={[styles.tableHeaderCell, { fontFamily: SERIF }, styles.colAmount]}>
              Amount
            </Text>
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

      <SectionDivider color={accent} style={{ marginVertical: layout.sectionGap }} />

      {/* Subtle totals */}
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
        <View style={[styles.grandTotal, { borderTopColor: accent }]}>
          <Text style={[styles.grandTotalLabel, { fontFamily: SERIF, color: accent }]}>Total</Text>
          <MoneyText
            amount={data.total}
            currency={data.currency}
            style={[styles.grandTotalValue, { color: accent }]}
          />
        </View>
      </View>

      {/* Fulfilment (elegant two-column variant) */}
      {data.fulfilmentMethod && data.fulfilmentMethod !== 'none' && (
        <View style={{ marginTop: layout.sectionGap }}>
          <ElegantFulfilment data={data} />
        </View>
      )}

      {/* Notes */}
      {data.notes ? (
        <>
          <SectionDivider color={accent} style={{ marginVertical: layout.sectionGap }} />
          <LabelText style={[{ fontFamily: SERIF }, { marginBottom: layout.rowGap }]}>Notes</LabelText>
          <Text style={styles.notesText} numberOfLines={20}>
            {data.notes}
          </Text>
        </>
      ) : null}

      {/* Thank-you */}
      {branding.showThankYou && branding.thankYouMessage ? (
        <View style={[styles.thankYouBlock, { marginTop: layout.sectionGap }]}>
          <Text style={[styles.thankYouText, { fontFamily: SERIF }]}>
            {branding.thankYouMessage}
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
        <PlatformFooter subtle={branding.poweredBySubtle} />
      </View>
    </View>
  );
}

function ElegantFulfilment({ data }: { data: InvoiceTemplateData }) {
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
    <View style={styles.fulfilmentRow}>
      <View style={styles.fulfilmentCol}>
        <LabelText style={{ fontFamily: SERIF }}>Fulfilment</LabelText>
        <Text style={styles.fulfilmentValue}>{title}</Text>
      </View>
      <View style={styles.fulfilmentCol}>
        {primaryLine ? (
          <Text style={styles.fulfilmentValue} numberOfLines={2}>
            {primaryLine}
          </Text>
        ) : null}
        {dateStr ? (
          <Text style={styles.fulfilmentValue}>
            {dateStr}
            {timeStr ? ` · ${timeStr}` : ''}
          </Text>
        ) : details.isFlexible ? (
          <Text style={styles.fulfilmentValue}>Time flexible</Text>
        ) : null}
        {secondary ? <Text style={styles.fulfilmentValue}>{secondary}</Text> : null}
      </View>
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
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  vendorName: {
    fontSize: 22,
    color: Colors.text,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
  },
  accentRule: {
    height: 1,
    width: 90,
    marginTop: 10,
  },
  invoiceTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 3,
    color: Colors.textSecondary,
    marginTop: 10,
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
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  infoLine: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  metaLine: {
    flexDirection: 'row',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaValue: {
    fontSize: 11,
    color: Colors.text,
    fontWeight: '500',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  table: {
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBC4BC',
  },
  tableHeaderCell: {
    fontSize: 11,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E0D9',
  },
  itemName: {
    fontSize: 13,
    fontWeight: '500',
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
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 1,
  },
  grandTotalValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  fulfilmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  fulfilmentCol: {
    flex: 1,
    minWidth: 140,
  },
  fulfilmentValue: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
    lineHeight: 18,
  },
  notesText: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  thankYouBlock: {
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
