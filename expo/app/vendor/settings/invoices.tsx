import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  PanResponder,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import {
  ChevronLeft,
  Plus,
  SlidersHorizontal,
  Search,
  X,
  Send,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Trash2,
  FileText,
  Clock,
} from 'lucide-react-native';
import { useInvoices } from '@/contexts/InvoiceContext';
import type { Invoice, InvoiceStatus, InvoiceCustomerSource } from '@/contexts/InvoiceContext';
import { formatPrice, type Currency } from '@/utils/formatPrice';
import { formatInvoiceCustomerName } from '@/utils/internalCustomerName';
import { useVendor } from '@/contexts/VendorContext';
import { Alert } from '@/utils/alert';
import { Colors } from '@/constants/colors';

type StatusPillKey = 'all' | 'drafts' | 'paid' | 'unpaid' | 'overdue' | 'partially_paid';

type FilterStatus = 'all' | InvoiceStatus | 'overdue' | 'partially_paid' | 'drafts';
type FilterCustomerType = 'all' | InvoiceCustomerSource;
type DateRangeKey = 'all' | 'today' | 'week' | 'month' | 'custom';
type AmountSort = 'none' | 'low_high' | 'high_low';

interface FilterState {
  status: FilterStatus;
  customerType: FilterCustomerType;
  dateRange: DateRangeKey;
  amountSort: AmountSort;
  customStart?: string;
  customEnd?: string;
}

const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  customerType: 'all',
  dateRange: 'all',
  amountSort: 'none',
};

const STATUS_PILLS: { key: StatusPillKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'partially_paid', label: 'Partial' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
];

const FILTER_STATUS_OPTIONS: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All statuses' },
  { key: 'drafts', label: 'Drafts' },
  { key: 'sent_in_chat', label: 'Unpaid (issued)' },
  { key: 'partially_paid', label: 'Partially Paid' },
  { key: 'paid', label: 'Paid' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'cancelled', label: 'Cancelled' },
];

const FILTER_CUSTOMER_OPTIONS: { key: FilterCustomerType; label: string }[] = [
  { key: 'all', label: 'All customers' },
  { key: 'the platform', label: 'Internal' },
  { key: 'external', label: 'External' },
];

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'custom', label: 'Custom' },
];

const AMOUNT_OPTIONS: { key: AmountSort; label: string }[] = [
  { key: 'none', label: 'Default' },
  { key: 'low_high', label: 'Low to High' },
  { key: 'high_low', label: 'High to Low' },
];

/** MVP: an invoice is "overdue" if it is an unpaid, non-draft, non-cancelled invoice older than 7 days.
 *  Real due-date logic is a Phase 2 TODO when Henry adds a dueDate field to the backend. */
const OVERDUE_AGE_DAYS = 7;

function isOverdue(inv: Invoice): boolean {
  if (inv.status === 'paid' || inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'expired' || inv.status === 'void') {
    return false;
  }
  // Derived overdue: issued AND balance > 0 AND due date in the past.
  // Never manually selected; computed from dueDate + remaining balance.
  if (inv.dueDate) {
    const dueMs = new Date(inv.dueDate).getTime();
    if (!Number.isNaN(dueMs) && dueMs < Date.now()) {
      const balance = Math.max(0, inv.total - (inv.payments ?? []).reduce((s, p) => s + p.amount, 0));
      return balance > 0;
    }
  }
  // Legacy fallback for mock invoices without an explicit dueDate.
  const created = new Date(inv.createdAt);
  const ageMs = Date.now() - created.getTime();
  return ageMs > OVERDUE_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** Fully paid only — partially paid invoices are NOT counted as Paid. */
function isFullyPaid(inv: Invoice): boolean {
  return inv.status === 'paid';
}

/** Partially paid: vendor has recorded a partial payment but balance remains. */
function isPartiallyPaid(inv: Invoice): boolean {
  return inv.paymentStatus === 'partially_paid' && inv.status !== 'paid' && inv.status !== 'cancelled' && inv.status !== 'expired' && inv.status !== 'void';
}

function isUnpaid(inv: Invoice): boolean {
  if (isFullyPaid(inv) || isPartiallyPaid(inv) || isOverdue(inv)) return false;
  if (inv.status === 'draft' || inv.status === 'cancelled' || inv.status === 'expired' || inv.status === 'void') return false;
  return true;
}

function isDraft(inv: Invoice): boolean {
  return inv.status === 'draft';
}

/** Amount paid across recorded payments (mock). */
function getAmountPaid(inv: Invoice): number {
  return (inv.payments ?? []).reduce((s, p) => s + p.amount, 0);
}

/** Remaining balance (never negative). */
function getBalanceDue(inv: Invoice): number {
  return Math.max(0, inv.total - getAmountPaid(inv));
}

function isWithinRange(iso: string, range: DateRangeKey): boolean {
  if (range === 'all') return true;
  const d = new Date(iso);
  const now = new Date();
  if (range === 'today') {
    return d.toDateString() === now.toDateString();
  }
  if (range === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return d >= start;
  }
  if (range === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

function formatCardDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface CardStatusConfig {
  icon: React.ReactNode;
  pillLabel: string;
  pillColor: string;
  pillBg: string;
}

function getCardStatusConfig(inv: Invoice): CardStatusConfig {
  if (isFullyPaid(inv)) {
    return {
      icon: <CheckCircle2 size={22} color={Colors.success} />,
      pillLabel: 'Paid',
      pillColor: Colors.success,
      pillBg: Colors.successLight,
    };
  }
  if (isPartiallyPaid(inv)) {
    return {
      icon: <CheckCircle2 size={22} color={Colors.warning} />,
      pillLabel: 'Partial',
      pillColor: Colors.warning,
      pillBg: Colors.warningLight,
    };
  }
  if (isOverdue(inv)) {
    return {
      icon: <AlertTriangle size={22} color={Colors.error} />,
      pillLabel: 'Overdue',
      pillColor: Colors.error,
      pillBg: Colors.errorLight,
    };
  }
  if (inv.status === 'draft') {
    return {
      icon: <Clock size={22} color={Colors.textMuted} />,
      pillLabel: 'Draft',
      pillColor: Colors.textMuted,
      pillBg: Colors.surface,
    };
  }
  if (inv.status === 'cancelled' || inv.status === 'void') {
    return {
      icon: <X size={22} color={Colors.textMuted} />,
      pillLabel: inv.status === 'void' ? 'Void' : 'Cancelled',
      pillColor: Colors.textMuted,
      pillBg: Colors.surface,
    };
  }
  // Sent / unpaid (sent_in_chat, shared_externally, viewed — all unpaid in MVP)
  return {
    icon: <Send size={22} color={Colors.warning} />,
    pillLabel: 'Unpaid',
    pillColor: Colors.warning,
    pillBg: Colors.warningLight,
  };
}

const SWIPE_ACTION_WIDTH = 84;
const SWIPE_THRESHOLD = 40;

interface SwipeableInvoiceCardProps {
  invoice: Invoice;
  onPress: () => void;
  onDeleteDraft: () => void;
}

/**
 * Invoice row. Swipe behavior is status-aware:
 * - Draft: exposes a single "Delete Draft" swipe action (confirmation handled
 *   by the caller). Duplicate is available via the row's detail screen.
 * - Sent / paid / partially paid / overdue / cancelled / expired: NO swipe
 *   action. The row stays stationary when swiped — no grey delete panel, no
 *   "Locked" label. An issued invoice that should no longer be used is
 *   marked Void/Cancelled, never deleted, so the financial record stays
 *   intact. (Phase 2: Void action on the detail screen.)
 */
function SwipeableInvoiceCard({
  invoice,
  onPress,
  onDeleteDraft,
}: SwipeableInvoiceCardProps) {
  // The signed-in vendor, for the currency fallback below. Read here rather
  // than passed down: the row is rendered in a list and threading it through
  // props would mean touching every call site for one field.
  const { vendor } = useVendor();
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  // Only draft invoices expose a swipe action. Every other status is a flat,
  // stationary row — no swipe panel, no "Locked" label.
  const swipeEnabled = invoice.status === 'draft';

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        swipeEnabled &&
        Math.abs(g.dx) > 8 &&
        Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const maxOpen = -SWIPE_ACTION_WIDTH;
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, maxOpen));
        } else if (isOpen.current && g.dx > 0) {
          translateX.setValue(Math.max(maxOpen, maxOpen + g.dx));
        }
      },
      onPanResponderRelease: (_, g) => {
        const maxOpen = -SWIPE_ACTION_WIDTH;
        if (g.dx < -SWIPE_THRESHOLD && !isOpen.current) {
          Animated.spring(translateX, { toValue: maxOpen, useNativeDriver: true, bounciness: 0 }).start(() => {
            isOpen.current = true;
          });
        } else if (g.dx > SWIPE_THRESHOLD && isOpen.current) {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start(() => {
            isOpen.current = false;
          });
        } else {
          Animated.spring(translateX, {
            toValue: isOpen.current ? maxOpen : 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  };

  const handlePress = () => {
    if (isOpen.current) {
      close();
    } else {
      onPress();
    }
  };

  const handleDeleteDraft = () => {
    close();
    onDeleteDraft();
  };

  const status = getCardStatusConfig(invoice);
  // Privacy: internal the platform customers always render as "First L."; external
  // customers use the vendor-typed display name verbatim. Never the full surname.
  const customerLabel = formatInvoiceCustomerName(invoice.customerName, invoice.customerSource);
  const sourceLabel: string = invoice.customerSource === 'external' ? 'External' : 'Internal';
  const vendorCurrency = (invoice.currency as Currency) || (vendor.currency as Currency) || 'NGN';
  const paidAmount = getAmountPaid(invoice);
  const balanceAmount = getBalanceDue(invoice);
  const showPartialLine = isPartiallyPaid(invoice) && paidAmount > 0;

  const renderCardBody = () => (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={styles.statusIconWrap}>{status.icon}</View>

      <View style={styles.cardBody}>
        <Text style={styles.invoiceNumber} numberOfLines={1}>
          {invoice.invoiceNumber}
        </Text>
        <Text style={styles.customerName} numberOfLines={1}>
          {customerLabel}
        </Text>
        {showPartialLine ? (
          <Text style={styles.partialLine} numberOfLines={1}>
            Paid {formatPrice(paidAmount, vendorCurrency)} · Balance {formatPrice(balanceAmount, vendorCurrency)}
          </Text>
        ) : null}
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{formatCardDate(invoice.createdAt)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <View style={styles.sourcePill}>
            <Text style={styles.sourcePillText}>{sourceLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.cardRight}>
        <Text style={styles.amount} numberOfLines={1}>
          {formatPrice(invoice.total, vendorCurrency)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: status.pillBg }]}>
          <Text style={[styles.statusPillText, { color: status.pillColor }]}>
            {status.pillLabel}
          </Text>
        </View>
      </View>

      <ChevronRight size={16} color={Colors.textMuted} style={styles.chevron} />
    </TouchableOpacity>
  );

  // Issued/paid/overdue/cancelled/expired rows: stationary, no swipe panel.
  if (!swipeEnabled) {
    return <View style={styles.cardContainer}>{renderCardBody()}</View>;
  }

  // Draft rows: single "Delete Draft" swipe action behind the card.
  return (
    <View style={styles.cardContainer}>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteAction]}
          onPress={handleDeleteDraft}
          activeOpacity={0.7}
        >
          <Trash2 size={18} color={Colors.white} />
          <Text style={styles.actionText}>Delete Draft</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.cardWrapper, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {renderCardBody()}
      </Animated.View>
    </View>
  );
}

function FilterSection({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      <View style={styles.filterOptionsRow}>
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterOption, active && styles.filterOptionActive]}
              onPress={() => onChange(opt.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function InvoicesScreen() {
  const { invoices, deleteInvoice } = useInvoices();
  // Currency falls back to the signed-in vendor's, not the demo one's.
  const { vendor } = useVendor();

  const [activePill, setActivePill] = useState<StatusPillKey>('all');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pendingFilters, setPendingFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const pillCounts = useMemo(() => {
    // Paid counts only FULLY paid invoices; partially paid counts separately
    // so a vendor can find invoices with an outstanding balance. Drafts are
    // invoices that have not been issued yet.
    return {
      all: invoices.length,
      drafts: invoices.filter(isDraft).length,
      paid: invoices.filter(isFullyPaid).length,
      unpaid: invoices.filter(isUnpaid).length,
      partially_paid: invoices.filter(isPartiallyPaid).length,
      overdue: invoices.filter(isOverdue).length,
    } as Record<StatusPillKey, number>;
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let list = invoices.slice();

    // Status pill filter (top-level, always applies)
    if (activePill === 'drafts') {
      list = list.filter(isDraft);
    } else if (activePill === 'paid') {
      list = list.filter(isFullyPaid);
    } else if (activePill === 'unpaid') {
      list = list.filter(isUnpaid);
    } else if (activePill === 'partially_paid') {
      list = list.filter(isPartiallyPaid);
    } else if (activePill === 'overdue') {
      list = list.filter(isOverdue);
    }

    // Modal filters
    if (filters.status !== 'all') {
      if (filters.status === 'overdue') {
        list = list.filter(isOverdue);
      } else if (filters.status === 'partially_paid') {
        list = list.filter(isPartiallyPaid);
      } else if (filters.status === 'drafts') {
        list = list.filter(isDraft);
      } else {
        list = list.filter((i) => i.status === filters.status);
      }
    }
    if (filters.customerType !== 'all') {
      list = list.filter((i) => (i.customerSource ?? 'the platform') === filters.customerType);
    }
    if (filters.dateRange !== 'all' && filters.dateRange !== 'custom') {
      list = list.filter((i) => isWithinRange(i.createdAt, filters.dateRange));
    }
    if (filters.dateRange === 'custom') {
      // Phase 2: custom date picker. For MVP we keep the option but treat as no-op.
    }

    // Search
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => {
        const name = formatInvoiceCustomerName(i.customerName, i.customerSource).toLowerCase();
        return (
          i.invoiceNumber.toLowerCase().includes(q) ||
          name.includes(q) ||
          String(i.total).includes(q)
        );
      });
    }

    // Amount sort
    if (filters.amountSort === 'low_high') {
      list.sort((a, b) => a.total - b.total);
    } else if (filters.amountSort === 'high_low') {
      list.sort((a, b) => b.total - a.total);
    } else {
      // Newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return list;
  }, [invoices, activePill, filters, searchQuery]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.status !== 'all') n++;
    if (filters.customerType !== 'all') n++;
    if (filters.dateRange !== 'all') n++;
    if (filters.amountSort !== 'none') n++;
    return n;
  }, [filters]);

  const openFilterModal = () => {
    setPendingFilters(filters);
    setShowFilterModal(true);
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setShowFilterModal(false);
  };

  const clearFilters = () => {
    setPendingFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setShowFilterModal(false);
  };

  const handleCreate = useCallback(() => {
    router.push('/vendor/settings/create-invoice' as any);
  }, []);

  const handlePressInvoice = useCallback((inv: Invoice) => {
    router.push(`/vendor/invoice/${inv.id}` as any);
  }, []);

  // Only draft invoices can be deleted via the swipe action. Issued, paid,
  // partially paid, overdue, cancelled, and expired invoices are never
  // deleted from the list — they stay as a financial record and should be
  // voided/cancelled instead (Phase 2: Void action on the detail screen).
  const handleDeleteDraft = useCallback(
    (inv: Invoice) => {
      if (inv.status !== 'draft') return;
      Alert.alert(
        'Delete draft invoice?',
        `${inv.invoiceNumber} will be permanently removed. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Draft',
            style: 'destructive',
            onPress: () => {
              void deleteInvoice(inv.id);
            },
          },
        ]
      );
    },
    [deleteInvoice]
  );

  const renderItem = useCallback(
    ({ item }: { item: Invoice }) => (
      <SwipeableInvoiceCard
        invoice={item}
        onPress={() => handlePressInvoice(item)}
        onDeleteDraft={() => handleDeleteDraft(item)}
      />
    ),
    [handlePressInvoice, handleDeleteDraft]
  );

  const ListFooter = () => <View style={styles.footerWrap} />;

  const ListEmpty = () => {
    if (invoices.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <FileText size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No invoices yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first invoice and share it with a customer.
          </Text>
          <TouchableOpacity
            style={styles.emptyAction}
            onPress={handleCreate}
            activeOpacity={0.7}
          >
            <Plus size={15} color={Colors.primary} />
            <Text style={styles.emptyActionText}>Create Invoice</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <Search size={26} color={Colors.textMuted} />
        </View>
        <Text style={styles.emptyTitle}>No invoices found</Text>
        <Text style={styles.emptyDescription}>Try changing your filters.</Text>
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.emptyClearBtn}
            onPress={clearFilters}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyClearText}>Clear filters</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerIconBtn}
            activeOpacity={0.65}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Invoices
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={handleCreate}
              style={styles.headerIconBtn}
              activeOpacity={0.7}
              accessibilityLabel="Create invoice"
            >
              <Plus size={21} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={openFilterModal}
              style={[styles.headerIconBtn, activeFilterCount > 0 && styles.headerIconBtnActive]}
              activeOpacity={0.7}
              accessibilityLabel="Filter invoices"
            >
              <SlidersHorizontal size={20} color={Colors.text} strokeWidth={2} />
              {activeFilterCount > 0 && <View style={styles.filterDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowSearch((v) => !v)}
              style={[styles.headerIconBtn, showSearch && styles.headerIconBtnActive]}
              activeOpacity={0.7}
              accessibilityLabel="Search invoices"
            >
              <Search size={20} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search bar */}
        {showSearch && (
          <View style={styles.searchBar}>
            <Search size={16} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search invoice number, customer, or amount"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Status pills */}
        <View style={styles.pillBar}>
          <FlatList
            horizontal
            data={STATUS_PILLS}
            keyExtractor={(p) => p.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillBarContent}
            renderItem={({ item: pill }) => {
              const isActive = activePill === pill.key;
              const count = pillCounts[pill.key];
              return (
                <TouchableOpacity
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setActivePill(pill.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {pill.label}
                    {count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <FlatList
          data={filteredInvoices}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={filteredInvoices.length > 0 ? ListFooter : null}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      </SafeAreaView>

      {/* Filter modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter invoices</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <FilterSection
                title="STATUS"
                options={FILTER_STATUS_OPTIONS}
                value={pendingFilters.status}
                onChange={(key) => setPendingFilters((f) => ({ ...f, status: key as FilterStatus }))}
              />
              <FilterSection
                title="CUSTOMER TYPE"
                options={FILTER_CUSTOMER_OPTIONS}
                value={pendingFilters.customerType}
                onChange={(key) =>
                  setPendingFilters((f) => ({ ...f, customerType: key as FilterCustomerType }))
                }
              />
              <FilterSection
                title="DATE RANGE"
                options={DATE_RANGE_OPTIONS}
                value={pendingFilters.dateRange}
                onChange={(key) => setPendingFilters((f) => ({ ...f, dateRange: key as DateRangeKey }))}
              />
              <FilterSection
                title="AMOUNT"
                options={AMOUNT_OPTIONS}
                value={pendingFilters.amountSort}
                onChange={(key) => setPendingFilters((f) => ({ ...f, amountSort: key as AmountSort }))}
              />
              {pendingFilters.dateRange === 'custom' && (
                <Text style={styles.customNote}>
                  Custom date range is coming soon. For now, pick a preset range.
                </Text>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalClearBtn}
                onPress={clearFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.modalClearText}>Clear filters</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={applyFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.modalApplyText}>Apply filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  safeArea: {
    flex: 1,
  },

  /* Header */
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative' as const,
  },
  headerIconBtnActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginHorizontal: 4,
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  filterDot: {
    position: 'absolute' as const,
    top: 7,
    right: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },

  /* Search */
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },

  /* Pills */
  pillBar: {
    backgroundColor: Colors.background,
    paddingBottom: 12,
  },
  pillBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.background,
    fontWeight: '600' as const,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  /* Card */
  cardContainer: {
    position: 'relative' as const,
    marginBottom: 10,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  actionsRow: {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'stretch' as const,
  },
  actionButton: {
    width: SWIPE_ACTION_WIDTH,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  deleteAction: {
    backgroundColor: Colors.error,
  },
  actionText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  cardWrapper: {
    backgroundColor: Colors.background,
    borderRadius: 14,
  },
  // Card layout: fixed horizontal padding so the resting row is never
  // clipped on the left, and the body uses minWidth:0 so the invoice number
  // can ellipsize cleanly instead of pushing the right column off-screen.
  card: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    minHeight: 92,
  },
  statusIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    marginRight: 11,
    flexShrink: 0,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  customerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  metaText: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  metaDot: {
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  sourcePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sourcePillText: {
    fontSize: 10.5,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  cardRight: {
    alignItems: 'flex-end' as const,
    marginRight: 6,
    flexShrink: 0,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  chevron: {
    opacity: 0.4,
  },

  /* Footer */
  footerWrap: {
    height: 24,
  },
  /* Partial paid line */
  partialLine: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    marginBottom: 4,
    fontVariant: ['tabular-nums'] as any,
  },

  /* Empty */
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  emptyDescription: {
    fontSize: 13.5,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: Colors.primaryTint,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  emptyClearBtn: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  emptyClearText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  /* Filter modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: Platform.OS === 'ios' ? 24 : 18,
    maxHeight: '90%' as any,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  filterSection: {
    marginBottom: 22,
  },
  filterSectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  filterOptionsRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterOptionActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  customNote: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic' as const,
    marginTop: -10,
    marginBottom: 6,
  },
  modalFooter: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSoft,
  },
  modalClearBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
  },
  modalClearText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalApplyBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
  },
  modalApplyText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
