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

export default function BeautyTemplate({
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

  return (
    <View style={[styles.page, { padding: layout.pagePadding }]}>
      {/* Soft premium header */}
      <View style={[styles.header, { backgroundColor: `${accent}10` }, layout.compact && styles.headerCompact]}>
        {branding.showLogo && branding.logoUri ? (
          <LogoImage uri={branding.logoUri} size={layout.compact ? 38 : 44} />
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
        </View>
      </View>

      {/* Service / appointment details */}
      {method && method !== 'none' && (
        <View style={[styles.appointmentCard, { borderColor: `${accent}40` }]}>
          <Text style={[styles.appointmentLabel, { color: accent }]}>
            {method === 'pickup'
              ? 'Pickup details'
              : method === 'delivery'
                ? 'Delivery details'
                : 'Appointment details'}
          </Text>
          <View style={[styles.appointmentGrid, { gap: layout.blockGap }]}>
            {method === 'pickup' && details.location ? (
              <View style={styles.appointmentItem}>
                <LabelText>Location</LabelText>
                <Text style={styles.appointmentItemValue} numberOfLines={2}>
                  {details.location}
                </Text>
              </View>
            ) : null}
            {method === 'delivery' && details.address ? (
              <View style={styles.appointmentItem}>
                <LabelText>Address</LabelText>
                <Text style={styles.appointmentItemValue} numberOfLines={2}>
                  {details.address}
                </Text>
              </View>
            ) : null}
            {method === 'service' && details.serviceLocation ? (
              <View style={styles.appointmentItem}>
                <LabelText>Location</LabelText>
                <Text style={styles.appointmentItemValue} numberOfLines={2}>
                  {details.serviceLocation}
                </Text>
              </View>
            ) : null}
            {details.dateTime ? (
              <View style={styles.appointmentItem}>
                <LabelText>Date & time</LabelText>
                <Text style={styles.appointmentItemValue}>
                  {formatInvoiceDate(details.dateTime)}
                  {formatInvoiceTime(details.dateTime)
                    ? ` · ${formatInvoiceTime(details.dateTime)}`
                    : ''}
                </Text>
              </View>
            ) : details.isFlexible ? (
              <View style={styles.appointmentItem}>
                <LabelText>Date & time</LabelText>
                <Text style={styles.appointmentItemValue}>Time flexible</Text>
              </View>
            ) : null}
            {details.instructions || details.notes ? (
              <View style={styles.appointmentItem}>
                <LabelText>Notes</LabelText>
                <Text style={styles.appointmentItemValue} numberOfLines={2}>
                  {details.instructions || details.notes}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Refined two-column customer / invoice section */}
      <View style={[styles.infoRow, layout.compact && styles.infoRowCompact]}>
        <View style={styles.infoCol}>
          <LabelText>Customer</LabelText>
          <Text style={styles.infoValue} numberOfLines={2}>
            {data.customerName}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <LabelText>Invoice</LabelText>
          <Text style={styles.infoValue} numberOfLines={1}>
            {data.invoiceNumber}
          </Text>
          {issueStr ? <Text style={styles.infoDate}>Issued {issueStr}</Text> : null}
          {dueStr ? <Text style={styles.infoDate}>Due {dueStr}</Text> : null}
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

      <SectionDivider color={`${accent}40`} style={{ marginVertical: layout.sectionGap }} />

      {/* Service items */}
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

      <SectionDivider color={`${accent}40`} style={{ marginVertical: layout.sectionGap }} />

      {/* Soft amount-due block */}
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
        <View style={[styles.amountDueBox, { backgroundColor: `${accent}10` }]}>
          <Text style={[styles.amountDueLabel, { color: accent }]}>Amount due</Text>
          <MoneyText
            amount={data.total}
            currency={data.currency}
            style={[styles.amountDueValue, { color: accent }]}
          />
        </View>
      </View>

      {/* Notes */}
      {data.notes ? (
        <View style={{ marginTop: layout.sectionGap }}>
          <LabelText style={{ marginBottom: layout.rowGap }}>Notes</LabelText>
          <Text style={styles.notesText} numberOfLines={20}>
            {data.notes}
          </Text>
        </View>
      ) : null}

      {/* Thank-you */}
      {branding.showThankYou && branding.thankYouMessage ? (
        <View style={[styles.thankYouBlock, { marginTop: layout.sectionGap }]}>
          <Text style={styles.thankYouText}>{branding.thankYouMessage}</Text>
        </View>
      ) : null}

      {/* Footer */}
      {branding.showFooter && branding.footerText ? (
        <View style={[{ marginTop: layout.sectionGap }, styles.footerBlock]}>
          <LabelText style={{ marginBottom: layout.rowGap }}>Payment instructions & policies</LabelText>
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  headerCompact: {
    flexWrap: 'wrap',
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  vendorName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: 0.2,
  },
  thankYou: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  appointmentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  appointmentLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  appointmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  appointmentItem: {
    minWidth: 130,
  },
  appointmentItemValue: {
    fontSize: 12,
    color: Colors.text,
    marginTop: 2,
    lineHeight: 18,
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
    borderBottomColor: '#E5E0E9',
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
    borderBottomColor: '#F0ECEF',
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
  amountDueBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  amountDueLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  amountDueValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  notesText: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
  },
  thankYouBlock: {
    alignItems: 'center',
  },
  thankYouText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footerBlock: {
    padding: 12,
    backgroundColor: '#F8F9FB',
    borderRadius: 10,
  },
  footerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
