import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
} from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, FileText, Package, StickyNote, Trash2 } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { type Order } from '@/mocks/ordersData';
import { useExternalOrders, type ExternalOrder, type ExternalOrderDraft } from '@/contexts/ExternalOrdersContext';
import { useOrders } from '@/contexts/OrdersContext';
import StatusBadge from '@/components/StatusBadge';
import { getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { formatPriceCents, formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';
import LaektivaModal from '@/components/LaektivaModal';

type FilterType = 'all' | 'new' | 'accepted' | 'confirmed' | 'in_progress' | 'past' | 'today' | 'awaiting_payment';

/**
 * Provenance is tagged once, at the point the real-orders and legacy-local
 * arrays are merged, rather than inferred afterwards from field shape.
 * `orderSource` alone can't distinguish these two — it's required on both a
 * real Order (`'internal' | 'external'`) and a legacy ExternalOrder
 * (`'external'` only) — so a shape-based guess would have to keep chasing
 * whatever field happens to differ today. Tagging here means the render
 * path never needs an `as Order` / `as ExternalOrder` cast to know which it
 * has.
 */
type OrderListRow =
  | { kind: 'order'; order: Order }
  | { kind: 'legacyExternal'; record: ExternalOrder };

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  new: 'New',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  past: 'Past',
  today: 'Today',
  awaiting_payment: 'Awaiting Payment',
};

interface SwipeableExternalCardProps {
  children: React.ReactNode;
  onDeleteRequest: () => void;
  openId: string | null;
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

function SwipeableExternalCard({
  children,
  onDeleteRequest,
  openId,
  id,
  onOpen,
  onClose,
}: SwipeableExternalCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = openId === id;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -88));
        } else if (isOpen && gs.dx > 0) {
          translateX.setValue(Math.max(-88, -88 + gs.dx));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -44) {
          Animated.spring(translateX, { toValue: -88, useNativeDriver: true }).start(() =>
            onOpen(id)
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() =>
            onClose()
          );
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!isOpen) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [isOpen, translateX]);

  return (
    <View style={swipeStyles.wrapper}>
      <View style={swipeStyles.deleteAction}>
        <TouchableOpacity
          onPress={onDeleteRequest}
          style={swipeStyles.deleteButton}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  wrapper: {
    position: 'relative' as const,
    marginBottom: 10,
    overflow: 'hidden' as const,
    borderRadius: 14,
  },
  deleteAction: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 88,
    backgroundColor: Colors.destructive,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 14,
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});

export default function VendorOrdersScreen() {
  const router = useRouter();
  const { getTodayOrders, todayNote, updateTodayNote, deleteExternalOrder, drafts, deleteDraft } = useExternalOrders();
  const { orders } = useOrders();
  const { vendor } = useVendor();
  const { filter: incomingFilter } = useLocalSearchParams<{ filter?: string }>();
  const [activeFilter, setActiveFilter] = useState<FilterType>(
    incomingFilter === 'AWAITING_PAYMENT' ? 'awaiting_payment' : 'all'
  );

  useEffect(() => {
    if (incomingFilter === 'AWAITING_PAYMENT') {
      setActiveFilter('awaiting_payment');
    }
  }, [incomingFilter]);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  /**
   * Real external orders (recorded via add-external.tsx -> createExternalOrder)
   * carry orderSource: 'external' on the real order document, same as the
   * legacy AsyncStorage-only ExternalOrder objects from useExternalOrders().
   * Excluding every orderSource === 'external' order here meant a real,
   * backend-recorded external order never appeared on this screen under any
   * filter - not just today's, since `filtered` is always derived from this
   * list. Real orders belong in the real list regardless of source; only the
   * legacy local records (a separate, AsyncStorage-only type) are tagged
   * `kind: 'legacyExternal'` below.
   */
  const platformOrders = orders;

  const rows = useMemo<OrderListRow[]>(() => {
    let filtered = platformOrders;

    if (activeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = platformOrders.filter((order) => {
        switch (activeFilter) {
          case 'new':
            return order.status === 'requested';
          case 'accepted':
            return order.status === 'accepted';
          case 'awaiting_payment':
            return order.paymentStatus === 'payment_pending';
          case 'confirmed':
            return order.status === 'confirmed';
          case 'in_progress':
            return order.status === 'in_progress';
          case 'past':
            return (
              order.status === 'completed' ||
              order.status === 'cancelled' ||
              order.status === 'rejected'
            );
          case 'today': {
            const orderDate = new Date(order.orderDate);
            const orderDay = new Date(
              orderDate.getFullYear(),
              orderDate.getMonth(),
              orderDate.getDate()
            );
            const diffDays = Math.floor(
              (orderDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            return diffDays === 0;
          }
          default:
            return true;
        }
      });
    }

    const orderRows: OrderListRow[] = filtered.map((order) => ({ kind: 'order', order }));

    if (activeFilter === 'today') {
      const legacyRows: OrderListRow[] = getTodayOrders().map((record) => ({
        kind: 'legacyExternal',
        record,
      }));
      return [...legacyRows, ...orderRows];
    }

    return orderRows;
  }, [activeFilter, getTodayOrders, platformOrders]);

  const handleOrderPress = (order: Order) => {
    console.log('Opening vendor order:', order.id);
    router.push({
      pathname: '/vendor/orders/[orderId]' as any,
      params: { orderId: order.id },
    });
  };

  const handleExternalOrderPress = (orderId: string) => {
    console.log('Opening external order:', orderId);
    router.push({
      pathname: '/vendor/orders/external/[orderId]' as any,
      params: { orderId },
    });
  };

  const handleRecordExternalOrder = () => {
    setShowActionSheet(false);
    router.push('/vendor/orders/add-external' as any);
  };

  const handleAddNote = () => {
    setNoteInput(todayNote);
    setIsEditingNote(true);
  };

  const handleSaveNote = async () => {
    try {
      await updateTodayNote(noteInput);
      setIsEditingNote(false);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  const handleCancelNote = () => {
    setIsEditingNote(false);
    setNoteInput('');
  };

  const handleDeleteRequest = useCallback((orderId: string) => {
    setDeleteOrderId(orderId);
    setShowDeleteModal(true);
    setOpenSwipeId(null);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteOrderId) return;
    try {
      await deleteExternalOrder(deleteOrderId);
      console.log('External order deleted:', deleteOrderId);
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Failed to delete the order. Please try again.');
    } finally {
      setShowDeleteModal(false);
      setDeleteOrderId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteOrderId(null);
  };

  const handleDeleteDraftRequest = (draft: ExternalOrderDraft) => {
    Alert.alert(
      'Delete draft?',
      'This draft and any attached screenshots will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDraft(draft.id);
            } catch (error) {
              console.error('Failed to delete draft:', error);
              Alert.alert('Error', 'Failed to delete the draft. Please try again.');
            }
          },
        },
      ]
    );
  };

  const renderOrderCard = ({ item }: { item: OrderListRow }) => {
    if (item.kind === 'legacyExternal') {
      const extOrder = item.record;
      const totalItemCount = extOrder.items.reduce((sum, i) => sum + i.quantity, 0);

      let scheduledDate = 'Not scheduled';
      const date = new Date(extOrder.fulfillmentDate);
      const todayD = new Date();
      const tomorrow = new Date(todayD);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === todayD.toDateString()) {
        scheduledDate = 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        scheduledDate = 'Tomorrow';
      } else {
        scheduledDate = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
      const scheduledTime = extOrder.fulfillmentTime || 'No time set';
      const isUnpaid =
        extOrder.paymentStatus === 'payment_pending' ||
        extOrder.paymentStatus === 'partially_received';

      const cardContent = (
        <TouchableOpacity
          style={[styles.orderCard, styles.orderCardNoMargin]}
          onPress={() => handleExternalOrderPress(extOrder.id)}
          activeOpacity={0.7}
        >
          <View style={styles.orderCardContent}>
            <View style={styles.orderRow}>
              <Text style={styles.customerName}>{extOrder.customerName || 'Customer'}</Text>
              <View style={styles.statusRow}>
                {isUnpaid ? (
                  <View style={styles.unpaidExternalPill}>
                    <Text style={styles.unpaidExternalPillText}>PAYMENT PENDING</Text>
                  </View>
                ) : (
                  <View style={styles.externalPill}>
                    <Text style={styles.externalPillText}>EXTERNAL</Text>
                  </View>
                )}
              </View>
            </View>

            <Text style={styles.orderId}>{extOrder.id}</Text>

            <View style={styles.orderRow}>
              <Text style={styles.detailText}>{extOrder.fulfillmentType}</Text>
              <Text style={styles.detailText}>•</Text>
              <Text style={styles.detailText}>{scheduledDate}</Text>
              <Text style={styles.detailText}>•</Text>
              <Text style={styles.detailText}>{scheduledTime}</Text>
            </View>

            <View style={styles.orderRow}>
              <Text style={styles.detailText}>
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
              </Text>
              <Text style={styles.totalAmount}>
                {formatPriceWithCommas(extOrder.total, (vendor.currency as Currency) || 'NGN')}
              </Text>
            </View>
          </View>

          <View style={styles.orderActions}>
            <TouchableOpacity
              style={styles.viewDetailsButton}
              onPress={() => handleExternalOrderPress(extOrder.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.viewDetailsButtonText}>View details</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      );

      return (
        <SwipeableExternalCard
          id={extOrder.id}
          openId={openSwipeId}
          onOpen={(id) => setOpenSwipeId(id)}
          onClose={() => setOpenSwipeId(null)}
          onDeleteRequest={() => handleDeleteRequest(extOrder.id)}
        >
          <>{cardContent}</>
        </SwipeableExternalCard>
      );
    }

    const order = item.order;
    const isRealExternal = order.orderSource === 'external';
    const totalItemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
    const scheduledDate = order.scheduledDate
      ? new Date(order.scheduledDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      : 'Not scheduled';
    const scheduledTime = order.scheduledTime || 'No time set';

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(order)}
        activeOpacity={0.7}
      >
        <View style={styles.orderCardContent}>
          <View style={styles.orderRow}>
            <Text style={styles.customerName}>{order.customerName || 'Customer'}</Text>
            <View style={styles.statusRow}>
              {isRealExternal && (
                <View style={styles.externalPill}>
                  <Text style={styles.externalPillText}>EXTERNAL</Text>
                </View>
              )}
              <StatusBadge
                status={order.status}
                label={getVendorOrderStatusLabel(order.status)}
              />
            </View>
          </View>

          <Text style={styles.orderId}>{order.publicOrderId}</Text>

          <View style={styles.orderRow}>
            <Text style={styles.detailText}>{order.fulfillmentType}</Text>
            <Text style={styles.detailText}>•</Text>
            <Text style={styles.detailText}>{scheduledDate}</Text>
            <Text style={styles.detailText}>•</Text>
            <Text style={styles.detailText}>{scheduledTime}</Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={styles.detailText}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.totalAmount}>
              {formatPriceCents(order.total, (vendor.currency as Currency) || 'NGN')}
            </Text>
          </View>
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => handleOrderPress(order)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewDetailsButtonText}>View details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const filters: FilterType[] = ['all', 'new', 'accepted', 'confirmed', 'in_progress', 'past', 'today', 'awaiting_payment'];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={handleAddNote} activeOpacity={0.7}>
              <StickyNote
                size={22}
                strokeWidth={2}
                color={todayNote ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowActionSheet(true)} activeOpacity={0.7}>
              <Plus size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRowContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {FILTER_LABELS[filter]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeFilter === 'today' && (
          <View style={styles.addNoteRow}>
            {!isEditingNote && !todayNote && (
              <TouchableOpacity style={styles.addNoteButton} onPress={handleAddNote}>
                <Text style={styles.addNoteText}>+ Add today&apos;s note</Text>
              </TouchableOpacity>
            )}

            {isEditingNote && (
              <View style={styles.noteEditContainer}>
                <TextInput
                  style={styles.noteInput}
                  value={noteInput}
                  onChangeText={setNoteInput}
                  placeholder="Add a note for today..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  autoFocus
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={handleCancelNote} style={styles.noteActionButton}>
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveNote} style={styles.noteActionButton}>
                    <Text style={styles.noteSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {drafts.length > 0 && (
        <View style={styles.draftsSection}>
          <Text style={styles.draftsSectionTitle}>Drafts</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.draftsRowContent}
          >
            {drafts.map((draft) => (
              <TouchableOpacity
                key={draft.id}
                style={styles.draftCard}
                activeOpacity={0.7}
                onPress={() =>
                  router.push({
                    pathname: '/vendor/orders/add-external' as any,
                    params: { draftId: draft.id },
                  })
                }
              >
                <View style={styles.draftCardHeader}>
                  <Text style={styles.draftCardName} numberOfLines={1}>
                    {draft.customerName || 'Draft order'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleDeleteDraftRequest(draft)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={14} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.draftCardMeta}>
                  {draft.items.length} {draft.items.length === 1 ? 'item' : 'items'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {rows.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No orders match your filters</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          renderItem={renderOrderCard}
          keyExtractor={(item) => (item.kind === 'order' ? `order-${item.order.id}` : `legacy-${item.record.id}`)}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setOpenSwipeId(null)}
        />
      )}

      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionSheet(false)}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>New Order</Text>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                setShowActionSheet(false);
                console.log('Create Platform order - Coming soon');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconContainer}>
                <Package size={22} color={Colors.text} strokeWidth={2} />
              </View>
              <View style={styles.actionSheetTextContainer}>
                <Text style={styles.actionSheetOptionText}>Create Platform order</Text>
                <Text style={styles.actionSheetOptionDescription}>
                  Start a new order through Platform
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={handleRecordExternalOrder}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconContainer}>
                <FileText size={22} color={Colors.text} strokeWidth={2} />
              </View>
              <View style={styles.actionSheetTextContainer}>
                <Text style={styles.actionSheetOptionText}>Add external order</Text>
                <Text style={styles.actionSheetOptionDescription}>
                  Log an order from outside Platform
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancel}
              onPress={() => setShowActionSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <LaektivaModal
        visible={showDeleteModal}
        title="Delete external order?"
        message="This order was created manually and will be permanently removed."
        primaryButton={{
          label: 'Delete order',
          onPress: handleConfirmDelete,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: handleCancelDelete,
          variant: 'outlined',
        }}
        destructive
        onRequestClose={handleCancelDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    marginLeft: 12,
  },
  addButton: { padding: 4 },
  filtersSection: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterRowContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 14, fontWeight: '500' as const, color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' as const },
  addNoteRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  addNoteButton: { alignSelf: 'flex-start' as const },
  addNoteText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '400' as const },
  noteEditContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  noteInput: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  noteActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 8,
  },
  noteActionButton: { paddingVertical: 6, paddingHorizontal: 12 },
  noteCancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' as const },
  noteSaveText: { fontSize: 14, color: Colors.primary, fontWeight: '600' as const },
  statusRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  externalPill: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  externalPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  unpaidExternalPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unpaidExternalPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  draftsSection: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingTop: 12,
    paddingBottom: 12,
  },
  draftsSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  draftsRowContent: { paddingHorizontal: 16, gap: 10 },
  draftCard: {
    width: 150,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  draftCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
    gap: 6,
  },
  draftCardName: { fontSize: 14, fontWeight: '600' as const, color: Colors.text, flex: 1 },
  draftCardMeta: { fontSize: 12, color: Colors.textSecondary },
  ordersList: { paddingHorizontal: 16, paddingVertical: 16 },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardNoMargin: {
    marginBottom: 0,
  },
  orderCardContent: { marginBottom: 12 },
  orderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  customerName: { fontSize: 16, fontWeight: '700' as const, color: '#1A1A1A' },
  orderId: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  detailText: { fontSize: 13, color: Colors.textSecondary, marginRight: 6 },
  totalAmount: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  orderActions: { marginTop: 4 },
  viewDetailsButton: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  emptyStateText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' as const },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  actionSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderDark,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  actionSheetOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  actionSheetIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  actionSheetTextContainer: { flex: 1 },
  actionSheetOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  actionSheetOptionDescription: { fontSize: 13, color: Colors.textSecondary },
  actionSheetCancel: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center' as const,
    backgroundColor: Colors.cardBorder,
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
