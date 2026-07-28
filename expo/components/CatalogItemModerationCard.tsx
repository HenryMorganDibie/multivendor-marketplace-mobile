import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Clock, AlertCircle, RefreshCw, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

/**
 * Phase 2 — the vendor's view of an item's moderation state.
 *
 * Modelled on the WhatsApp Business catalog pattern the client specified: a compact
 * strip directly beneath the product image, not a large coloured status card.
 * The product image and details stay the focus; moderation is a thin band of
 * context above them. An item awaiting review is a normal part of listing, so
 * it should not dominate the screen like an error would.
 *
 * Read from getCatalogItemModeration rather than the catalog document, because
 * the proposed edit and any rejection reason live in a private subcollection
 * that customers cannot read.
 *
 * The four states carry genuinely different consequences, which is why the copy
 * differs rather than being one generic "pending" message:
 *  - new item under review: not visible to customers at all
 *  - approved + changes under review: still live, customers see the old version
 *  - approved + changes refused: still live, the edit needs fixing
 *  - approved: live, no outstanding work
 */

type BackendModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

interface PendingRevisionView {
  status: 'pending' | 'rejected';
  rejectionReason: string | null;
  proposedChanges: Record<string, unknown>;
  liveValues: Record<string, unknown>;
}

export interface ItemModerationState {
  success: true;
  moderationStatus: BackendModerationStatus;
  rejectionReason: string | null;
  isVisibleToCustomers: boolean;
  hasPendingRevision: boolean;
  pendingRevision: PendingRevisionView | null;
}

/** Sentence-case labels. Ordinary words like price and name are not proper
 * nouns and shouldn't be capitalised mid-sentence. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  categoryId: 'Category',
  basePrice: 'Price',
  salePrice: 'Sale price',
  photos: 'Photos',
  addOnGroups: 'Add-ons',
};

/** Renders a proposed or live value in a form a vendor can actually read:
 * prices formatted as money, photo arrays as a count, not raw JSON. */
function formatFieldValue(key: string, value: unknown, currency: Currency): string {
  if (value === null || value === undefined || value === '') return 'Not set';
  if (key === 'basePrice' || key === 'salePrice') {
    return formatPriceWithCommas(Number(value), currency);
  }
  if (key === 'photos' && Array.isArray(value)) {
    return value.length === 1 ? '1 photo' : `${value.length} photos`;
  }
  if (key === 'addOnGroups' && Array.isArray(value)) {
    return value.length === 1 ? '1 add-on group' : `${value.length} add-on groups`;
  }
  return String(value);
}

export default function CatalogItemModerationCard({
  itemId,
  currency,
  onEdit,
  onLearnMore,
  onStateLoaded,
}: {
  itemId: string;
  currency: Currency;
  onEdit?: () => void;
  onLearnMore?: () => void;
  /** Lets the host screen disable actions that don't apply yet. Critically,
   * this differs by state: a brand-new item under review must not be shared,
   * but an approved item with a pending edit stays fully shareable and
   * orderable, because the approved version is still live. */
  onStateLoaded?: (state: ItemModerationState | null) => void;
}) {
  const [data, setData] = useState<ItemModerationState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const get = callable<{ itemId: string }, ItemModerationState>('getCatalogItemModeration');
      const res = await get({ itemId });
      setData(res.data);
      onStateLoaded?.(res.data);
    } catch (err) {
      console.error('[ItemModeration] Failed to load:', err);
      setError("Couldn't load this item's review status.");
      onStateLoaded?.(null);
    } finally {
      setIsLoading(false);
    }
  }, [itemId, onStateLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={[styles.strip, styles.stripNeutral]} testID="item-moderation-loading">
        <ActivityIndicator size="small" color={Colors.textSecondary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.strip, styles.stripNeutral]} testID="item-moderation-error">
        <AlertCircle size={17} color={Colors.error} strokeWidth={2} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.body}>{error}</Text>
          <TouchableOpacity style={styles.retryRow} onPress={() => void load()} testID="item-moderation-retry">
            <RefreshCw size={12} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.link}>Try again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data) return null;
  const { moderationStatus, rejectionReason, pendingRevision } = data;

  /** Compact, expandable comparison of what customers see now versus what was
   * submitted. Without this a vendor can't tell whether the name and price on
   * screen are the live values or their pending edit. */
  const renderComparison = (revision: PendingRevisionView, changesHeading: string) => {
    const keys = Object.keys(revision.proposedChanges);
    if (keys.length === 0) return null;
    return (
      <View style={styles.comparisonWrap}>
        <TouchableOpacity
          style={styles.comparisonToggle}
          onPress={() => setShowComparison((v) => !v)}
          activeOpacity={0.7}
          testID="item-moderation-comparison-toggle"
        >
          <Text style={styles.link}>{showComparison ? 'Hide details' : 'View details'}</Text>
          {showComparison
            ? <ChevronUp size={14} color={Colors.primary} strokeWidth={2.5} />
            : <ChevronDown size={14} color={Colors.primary} strokeWidth={2.5} />}
        </TouchableOpacity>

        {showComparison && (
          <View style={styles.comparison} testID="item-moderation-comparison">
            <Text style={styles.comparisonHeading}>Currently visible to customers</Text>
            {keys.map((k) => (
              <View key={`live-${k}`} style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>{FIELD_LABELS[k] ?? k}</Text>
                <Text style={styles.comparisonValue}>{formatFieldValue(k, revision.liveValues[k], currency)}</Text>
              </View>
            ))}

            <Text style={[styles.comparisonHeading, styles.comparisonHeadingSpaced]}>{changesHeading}</Text>
            {keys.map((k) => (
              <View key={`new-${k}`} style={styles.comparisonRow}>
                <Text style={styles.comparisonLabel}>{FIELD_LABELS[k] ?? k}</Text>
                <Text style={styles.comparisonValue}>{formatFieldValue(k, revision.proposedChanges[k], currency)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  if (pendingRevision?.status === 'rejected') {
    return (
      <View style={[styles.strip, styles.stripDanger]} testID="item-moderation-revision-rejected">
        <AlertCircle size={17} color="#DC2626" strokeWidth={2} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.title}>Your changes were not approved.</Text>
          <Text style={styles.body}>Customers can still see the currently approved version.</Text>
          {pendingRevision.rejectionReason ? (
            <View style={styles.reasonBlock}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{pendingRevision.rejectionReason}</Text>
            </View>
          ) : null}
          {renderComparison(pendingRevision, 'Changes not approved')}
          {onEdit ? (
            <TouchableOpacity style={styles.actionButton} onPress={onEdit} testID="item-moderation-edit">
              <Text style={styles.actionText}>Edit and Resubmit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  if (pendingRevision?.status === 'pending') {
    return (
      <View style={[styles.strip, styles.stripNeutral]} testID="item-moderation-revision-pending">
        <Clock size={17} color={Colors.textSecondary} strokeWidth={2} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.title}>Your changes are under review.</Text>
          <Text style={styles.body}>
            Customers can still see the currently approved version while we review your changes.{' '}
            {onLearnMore ? <Text style={styles.link} onPress={onLearnMore}>Learn more</Text> : null}
          </Text>
          {renderComparison(pendingRevision, 'Changes under review')}
        </View>
      </View>
    );
  }

  if (moderationStatus === 'rejected') {
    return (
      <View style={[styles.strip, styles.stripDanger]} testID="item-moderation-rejected">
        <AlertCircle size={17} color="#DC2626" strokeWidth={2} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.title}>This item was not approved.</Text>
          <Text style={styles.body}>Customers cannot see it in your storefront.</Text>
          {rejectionReason ? (
            <View style={styles.reasonBlock}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{rejectionReason}</Text>
            </View>
          ) : null}
          {onEdit ? (
            <TouchableOpacity style={styles.actionButton} onPress={onEdit} testID="item-moderation-edit">
              <Text style={styles.actionText}>Edit and Resubmit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }

  if (moderationStatus === 'pending') {
    return (
      <View style={[styles.strip, styles.stripNeutral]} testID="item-moderation-pending">
        <Clock size={17} color={Colors.textSecondary} strokeWidth={2} style={styles.icon} />
        <View style={styles.textCol}>
          <Text style={styles.title}>This item is under review.</Text>
          <Text style={styles.body}>
            Once approved, customers will be able to see it in your storefront.{' '}
            {onLearnMore ? <Text style={styles.link} onPress={onLearnMore}>Learn more</Text> : null}
          </Text>
        </View>
      </View>
    );
  }

  // Approved with nothing outstanding: a small inline indicator, not a large
  // permanent success card. A normal live item shouldn't spend screen space
  // telling the vendor it's normal.
  return (
    <View style={styles.approvedRow} testID="item-moderation-approved">
      <CheckCircle2 size={15} color={Colors.success} strokeWidth={2.5} />
      <Text style={styles.approvedLabel}>Approved</Text>
      <Text style={styles.approvedSub}>
        {data.isVisibleToCustomers ? 'Visible to customers' : 'Hidden by your settings'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Compact full-width strip flush under the gallery, WhatsApp-style, rather
  // than an inset coloured card.
  strip: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  stripNeutral: { backgroundColor: Colors.surfaceMuted ?? '#EFF1F5' },
  stripDanger: { backgroundColor: Colors.errorLight ?? '#FEF2F2' },
  icon: { marginRight: 10, marginTop: 1 },
  textCol: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, marginBottom: 2 },
  body: { fontSize: 13.5, lineHeight: 19, color: Colors.textSecondary },
  link: { fontSize: 13.5, fontWeight: '600' as const, color: Colors.primary },
  retryRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 5, marginTop: 5 },

  reasonBlock: { marginTop: 9 },
  reasonLabel: { fontSize: 12, fontWeight: '700' as const, color: Colors.text },
  reasonText: { fontSize: 13.5, lineHeight: 19, color: Colors.textSecondary, marginTop: 1 },

  comparisonWrap: { marginTop: 9 },
  comparisonToggle: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 4 },
  comparison: {
    marginTop: 9,
    padding: 11,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  comparisonHeading: { fontSize: 11.5, fontWeight: '700' as const, color: Colors.textMuted, letterSpacing: 0.3 },
  comparisonHeadingSpaced: { marginTop: 11 },
  comparisonRow: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, gap: 12, marginTop: 5 },
  comparisonLabel: { fontSize: 13, color: Colors.textSecondary },
  comparisonValue: { flex: 1, fontSize: 13, color: Colors.text, textAlign: 'right' as const, fontWeight: '500' as const },

  actionButton: {
    alignSelf: 'flex-start' as const,
    marginTop: 11,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 9,
    backgroundColor: Colors.primary,
  },
  actionText: { fontSize: 13.5, fontWeight: '700' as const, color: '#FFFFFF' },

  approvedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  approvedLabel: { fontSize: 13.5, fontWeight: '700' as const, color: Colors.success },
  approvedSub: { fontSize: 13, color: Colors.textSecondary },
});
