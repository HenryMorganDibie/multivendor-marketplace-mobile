import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Keyboard,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import {
  ChevronLeft,
  Star,
  ShoppingBag,
  CheckCircle,
  TrendingUp,
  Pencil,
  Utensils,
} from 'lucide-react-native';
import { mockOrders } from '@/mocks/ordersData';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import StatusBadge from '@/components/StatusBadge';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { Colors } from '@/constants/colors';
import { useVendorCustomerNotes } from '@/contexts/VendorCustomerNotesContext';

const CURRENCY: Currency = (mockVendor.currency as Currency) || 'NGN';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();
}

interface LoyaltyLevel {
  label: string;
  color: string;
  bg: string;
  borderColor: string;
}

function getLoyaltyLevel(completedOrders: number): LoyaltyLevel {
  if (completedOrders <= 1)
    return { label: 'New Customer', color: '#6B7280', bg: '#F9FAFB', borderColor: '#E5E7EB' };
  if (completedOrders <= 4)
    return { label: 'Repeat Customer', color: '#2563EB', bg: '#EFF6FF', borderColor: '#BFDBFE' };
  if (completedOrders <= 9)
    return { label: 'Loyal Customer', color: '#D97706', bg: '#FFFBEB', borderColor: '#FDE68A' };
  return { label: 'VIP Customer', color: '#7C3AED', bg: '#F5F3FF', borderColor: '#DDD6FE' };
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatOrderStatus(status: string): string {
  switch (status) {
    case 'requested': return 'Requested';
    case 'accepted': return 'Accepted';
    case 'confirmed': return 'Confirmed';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'rejected': return 'Rejected';
    case 'expired': return 'Expired';
    default: return status;
  }
}

interface FavoriteItem {
  name: string;
  count: number;
}

export default function CustomerOrdersScreen() {
  const { customerId, customerName, vendorId } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
    vendorId: string;
  }>();

  const { getNote, getNoteWithMeta, saveNote } = useVendorCustomerNotes();
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [draftNote, setDraftNote] = useState('');

  const resolvedVendorId = vendorId ?? mockVendor.id;
  const resolvedCustomerId = customerId ?? '';

  const vendorNote = getNote(resolvedVendorId, resolvedCustomerId);
  const noteMeta = getNoteWithMeta(resolvedVendorId, resolvedCustomerId);

  const handleOpenNotesModal = useCallback(() => {
    setDraftNote(vendorNote);
    setShowNotesModal(true);
    console.log('[CustomerProfile] Opening notes modal, current note:', vendorNote);
  }, [vendorNote]);

  const handleSaveNote = useCallback(() => {
    Keyboard.dismiss();
    saveNote(resolvedVendorId, resolvedCustomerId, draftNote);
    setShowNotesModal(false);
    console.log('[CustomerProfile] Note saved via context');
  }, [draftNote, resolvedVendorId, resolvedCustomerId, saveNote]);

  const handleCancelNote = useCallback(() => {
    setShowNotesModal(false);
    Keyboard.dismiss();
  }, []);

  const customerOrders = useMemo(() => {
    return mockOrders
      .filter((o) => {
        const matchDirect = o.customerId === customerId;
        const matchLegacy = `customer-${o.id}` === customerId;
        const vendorMatch = vendorId ? o.vendorId === vendorId : true;
        return (matchDirect || matchLegacy) && vendorMatch;
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [customerId, vendorId]);

  const totalOrders = customerOrders.length;

  const completedOrders = useMemo(
    () => customerOrders.filter((o) => o.status === 'completed'),
    [customerOrders]
  );

  const completedCount = completedOrders.length;

  const totalSpent = useMemo(
    () => completedOrders.reduce((sum, o) => sum + o.total, 0),
    [completedOrders]
  );

  const loyalty = getLoyaltyLevel(completedCount);

  const favoriteItems = useMemo((): FavoriteItem[] => {
    const countMap: Record<string, number> = {};
    customerOrders.forEach((order) => {
      order.items.forEach((item) => {
        countMap[item.name] = (countMap[item.name] ?? 0) + item.quantity;
      });
    });
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
  }, [customerOrders]);

  const displayName = customerName ?? 'Customer';
  const initials = getInitials(displayName);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Customer Profile</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar + Name */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.customerName}>{displayName}</Text>
          <Text style={styles.customerSub}>Customer</Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <View style={styles.statIconWrap}>
              <ShoppingBag size={16} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>{totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={[styles.statIconWrap, styles.statIconGreen]}>
              <CheckCircle size={16} color="#16A34A" strokeWidth={2} />
            </View>
            <Text style={styles.statValue}>{completedCount}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statItem}>
            <View style={[styles.statIconWrap, styles.statIconBlue]}>
              <TrendingUp size={16} color="#2563EB" strokeWidth={2} />
            </View>
            <Text style={[styles.statValue, styles.statValueSmall]} numberOfLines={1} adjustsFontSizeToFit>
              {formatPriceWithCommas(totalSpent, CURRENCY)}
            </Text>
            <Text style={styles.statLabel}>Total Spent</Text>
          </View>
        </View>

        {/* Loyalty Tag */}
        <View style={styles.loyaltyWrap}>
          <View style={[styles.loyaltyBadge, { backgroundColor: loyalty.bg, borderColor: loyalty.borderColor }]}>
            <Star size={14} color={loyalty.color} strokeWidth={2} fill={loyalty.color} />
            <Text style={[styles.loyaltyLabel, { color: loyalty.color }]}>{loyalty.label}</Text>
          </View>
        </View>

        {/* Vendor Notes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Vendor Notes</Text>
            <TouchableOpacity
              onPress={handleOpenNotesModal}
              style={styles.editBtn}
              activeOpacity={0.7}
              testID="vendor-notes-action-btn"
            >
              <Pencil size={14} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.editBtnText}>{vendorNote ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          {vendorNote ? (
            <TouchableOpacity
              onPress={handleOpenNotesModal}
              style={styles.noteDisplay}
              activeOpacity={0.8}
              testID="vendor-note-preview"
            >
              <Text style={styles.noteText} numberOfLines={3}>{vendorNote}</Text>
              {noteMeta.updatedAt && (
                <Text style={styles.noteTimestamp}>
                  Last updated {new Date(noteMeta.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleOpenNotesModal}
              style={styles.noteEmpty}
              activeOpacity={0.7}
              testID="vendor-note-empty"
            >
              <Text style={styles.noteEmptyText}>Tap to add a private note about this customer</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.notePrivacyHint}>Only you can see this</Text>
        </View>

        {/* Favorite Items */}
        {favoriteItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Favorite Items</Text>
            </View>
            <View style={styles.favItemsCard}>
              {favoriteItems.map((item, index) => (
                <View
                  key={item.name}
                  style={[
                    styles.favItemRow,
                    index < favoriteItems.length - 1 && styles.favItemRowBorder,
                  ]}
                >
                  <View style={styles.favItemLeft}>
                    <View style={styles.favItemRank}>
                      <Text style={styles.favItemRankText}>{index + 1}</Text>
                    </View>
                    <View style={styles.favItemIconWrap}>
                      <Utensils size={14} color={Colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={styles.favItemName} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <View style={styles.favItemCountBadge}>
                    <Text style={styles.favItemCountText}>
                      {item.count} {item.count === 1 ? 'order' : 'orders'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Order History */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Order History</Text>
            <Text style={styles.sectionCount}>{totalOrders}</Text>
          </View>

          {customerOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <ShoppingBag size={32} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.emptyText}>No orders yet</Text>
            </View>
          ) : (
            customerOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/vendor/orders/${order.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={styles.orderCardHeader}>
                  <Text style={styles.orderId}>{formatVendorOrderId(order.publicOrderId)}</Text>
                  <StatusBadge
                    status={order.status}
                    label={formatOrderStatus(order.status)}
                  />
                </View>

                <View style={styles.orderCardRow}>
                  <Text style={styles.orderLabel}>Date</Text>
                  <Text style={styles.orderValue}>{formatDate(order.orderDate)}</Text>
                </View>

                <View style={styles.orderCardRow}>
                  <Text style={styles.orderLabel}>Fulfillment</Text>
                  <Text style={styles.orderValue}>
                    {order.fulfillmentType === 'Delivery' ? 'Delivery' : 'Pickup'}
                  </Text>
                </View>

                <View style={styles.orderCardRow}>
                  <Text style={styles.orderLabel}>Amount</Text>
                  <Text style={styles.orderAmount}>
                    {formatPriceWithCommas(order.total, CURRENCY)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showNotesModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCancelNote}
      >
        <SafeAreaView style={styles.notesModalContainer} edges={['top']}>
          <View style={styles.notesModalHeader}>
            <TouchableOpacity onPress={handleCancelNote} style={styles.notesModalHeaderBtn}>
              <Text style={styles.notesModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.notesModalTitle}>Vendor Notes</Text>
            <TouchableOpacity onPress={handleSaveNote} style={styles.notesModalHeaderBtn}>
              <Text style={styles.notesModalSave}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notesModalContent}>
            <TextInput
              style={styles.notesModalInput}
              placeholder="Add notes about this customer…"
              placeholderTextColor={Colors.textMuted}
              value={draftNote}
              onChangeText={setDraftNote}
              multiline
              maxLength={500}
              autoFocus
              testID="vendor-notes-input"
            />
            <Text style={styles.notesCharCount}>{draftNote.length}/500</Text>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F5F7',
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },

  /* Profile Card */
  profileCard: {
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  customerName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  customerSub: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },

  /* Stats Row */
  statsRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.background,
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: {
    flex: 1,
    alignItems: 'center' as const,
    gap: 4,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  statIconGreen: {
    backgroundColor: '#F0FDF4',
  },
  statIconBlue: {
    backgroundColor: '#EFF6FF',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  statValueSmall: {
    fontSize: 14,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 4,
  },

  /* Loyalty */
  loyaltyWrap: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    alignItems: 'flex-start' as const,
  },
  loyaltyBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  loyaltyLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },

  /* Sections */
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  /* Vendor Notes */
  editBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noteDisplay: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  noteTimestamp: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 8,
    fontWeight: '400' as const,
  },
  noteEmpty: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed' as const,
  },
  noteEmptyText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  notePrivacyHint: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    fontWeight: '400' as const,
  },

  /* Notes Modal */
  notesModalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  notesModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  notesModalHeaderBtn: {
    padding: 8,
    minWidth: 60,
  },
  notesModalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  notesModalCancel: {
    fontSize: 16,
    color: Colors.text,
  },
  notesModalSave: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'right' as const,
  },
  notesModalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  notesModalInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: 'top' as const,
    minHeight: 180,
    lineHeight: 22,
  },
  notesCharCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 8,
  },

  /* Favorite Items */
  favItemsCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  favItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  favItemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  favItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  favItemRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  favItemRankText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  favItemIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  favItemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  favItemCountBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  favItemCountText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },

  /* Order Cards */
  orderCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  orderCardRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  orderLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  orderValue: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  orderAmount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 40,
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textMuted,
  },
});
