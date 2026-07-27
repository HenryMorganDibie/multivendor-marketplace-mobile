import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Lock, Package, Truck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { OrderSnapshot } from '@/mocks/ordersData';

interface Props {
  snapshot: OrderSnapshot;
  vendorName: string;
  confirmedAt: string;
}

function formatAmount(amount: number): string {
  return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OrderReceiptCard({ snapshot, vendorName, confirmedAt }: Props) {
  const totalItems = snapshot.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.lockBadge}>
              <Lock size={10} color="#fff" strokeWidth={2.5} />
              <Text style={styles.lockBadgeText}>LOCKED RECEIPT</Text>
            </View>
            <Text style={styles.title}>Order Receipt</Text>
            <Text style={styles.subtitle}>
              Confirmed by {vendorName}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.itemsSection}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.tableItemCol]}>Item</Text>
            <Text style={[styles.tableHeaderText, styles.tableQtyCol]}>Qty</Text>
            <Text style={[styles.tableHeaderText, styles.tablePriceCol]}>Price</Text>
          </View>

          {snapshot.items.map((item, index) => {
            const addOnTotal = item.addOns?.reduce((sum, a) => sum + a.price, 0) ?? 0;
            const unitPrice = item.price_at_order + addOnTotal;
            const lineTotal = unitPrice * item.quantity;

            return (
              <View key={index}>
                <View style={styles.itemRow}>
                  <Text style={[styles.itemName, styles.tableItemCol]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.itemQty, styles.tableQtyCol]}>
                    {item.quantity}
                  </Text>
                  <Text style={[styles.itemPrice, styles.tablePriceCol]}>
                    {snapshot.currency}{formatAmount(lineTotal)}
                  </Text>
                </View>
                {item.addOns && item.addOns.length > 0 && (
                  <View style={styles.addOnsContainer}>
                    {item.addOns.map((addOn, idx) => (
                      <View key={idx} style={styles.addOnRow}>
                        <Text style={styles.addOnName}>+ {addOn.name}</Text>
                        <Text style={styles.addOnPrice}>
                          +{snapshot.currency}{formatAmount(addOn.price)}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.divider} />

        <View style={styles.summarySection}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{totalItems} item{totalItems !== 1 ? 's' : ''}</Text>
            <Text style={styles.summaryValue}>
              {snapshot.currency}{formatAmount(snapshot.subtotal_at_order)}
            </Text>
          </View>
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryTotalLabel}>Subtotal</Text>
            <Text style={styles.summaryTotalValue}>
              {snapshot.currency}{formatAmount(snapshot.subtotal_at_order)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaSection}>
          <View style={styles.metaRow}>
            {snapshot.fulfillmentType === 'Pickup' ? (
              <Package size={13} color={Colors.textMuted} strokeWidth={2} />
            ) : (
              <Truck size={13} color={Colors.textMuted} strokeWidth={2} />
            )}
            <Text style={styles.metaText}>{snapshot.fulfillmentType}</Text>
            {snapshot.scheduledDate && snapshot.scheduledTime && (
              <Text style={styles.metaText}>
                · {snapshot.scheduledDate} at {snapshot.scheduledTime}
              </Text>
            )}
          </View>
          {snapshot.notes && (
            <View style={styles.notesRow}>
              <Text style={styles.notesLabel}>Note:</Text>
              <Text style={styles.notesText}>{snapshot.notes}</Text>
            </View>
          )}
          <Text style={styles.confirmedAt}>Receipt generated {formatDate(confirmedAt)}</Text>
        </View>

        <View style={styles.immutableNotice}>
          <Lock size={11} color={Colors.textMuted} strokeWidth={2} />
          <Text style={styles.immutableNoticeText}>
            This receipt cannot be modified after payment confirmation.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 0,
    paddingVertical: 4,
  },
  card: {
    backgroundColor: '#FAFAF8',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D4C9A8',
    overflow: 'hidden' as const,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: '#F5F0E8',
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
  },
  headerLeft: {
    gap: 4,
    flex: 1,
  },
  lockBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#8B7355',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
    marginBottom: 2,
  },
  lockBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#7C6C55',
    fontWeight: '500' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#E8E0CC',
  },
  itemsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 2,
  },
  tableHeader: {
    flexDirection: 'row' as const,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDE8D8',
    marginBottom: 6,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  tableItemCol: {
    flex: 1,
  },
  tableQtyCol: {
    width: 32,
    textAlign: 'center' as const,
  },
  tablePriceCol: {
    width: 80,
    textAlign: 'right' as const,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 5,
  },
  itemName: {
    fontSize: 13,
    color: '#2B2B2B',
    fontWeight: '500' as const,
    lineHeight: 18,
  },
  itemQty: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  itemPrice: {
    fontSize: 13,
    color: '#2B2B2B',
    fontWeight: '600' as const,
  },
  addOnsContainer: {
    paddingLeft: 10,
    paddingBottom: 4,
    gap: 2,
  },
  addOnRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
  },
  addOnName: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
  },
  addOnPrice: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  summarySection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  summaryTotalRow: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#EDE8D8',
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  summaryTotalValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#2B2B2B',
  },
  metaSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  notesRow: {
    flexDirection: 'row' as const,
    gap: 4,
    alignItems: 'flex-start' as const,
  },
  notesLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600' as const,
  },
  notesText: {
    fontSize: 12,
    color: Colors.textMuted,
    flex: 1,
    fontStyle: 'italic' as const,
  },
  confirmedAt: {
    fontSize: 11,
    color: '#B8A98A',
    marginTop: 2,
  },
  immutableNotice: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F0EBE0',
    borderTopWidth: 1,
    borderTopColor: '#E8E0CC',
  },
  immutableNoticeText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    fontStyle: 'italic' as const,
  },
});
