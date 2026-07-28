import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Clock, AlertCircle, CheckCircle2, RefreshCw, Pencil } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';

/**
 * Phase 2 — the vendor's view of an item's moderation state.
 *
 * Read from getCatalogItemModeration rather than the catalog list, because the
 * proposed values and any rejection reason live in a private subcollection that
 * the item document deliberately does not expose (customers can read the item
 * document directly, and Firestore rules cannot hide individual fields).
 *
 * Four states a vendor can be in, and they need genuinely different messages:
 *  - pending: first review, not visible to customers yet
 *  - rejected: refused, needs editing and resubmitting
 *  - approved with a pending revision: live version still showing, edit queued
 *  - approved with a rejected revision: live version still showing, edit refused
 */

type BackendModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

interface PendingRevisionView {
  status: 'pending' | 'rejected';
  rejectionReason: string | null;
  proposedChanges: Record<string, unknown>;
  liveValues: Record<string, unknown>;
}

interface ModerationResponse {
  success: true;
  moderationStatus: BackendModerationStatus;
  rejectionReason: string | null;
  isVisibleToCustomers: boolean;
  hasPendingRevision: boolean;
  pendingRevision: PendingRevisionView | null;
}

/** Field keys are backend names; vendors should see human labels. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  categoryId: 'Category',
  basePrice: 'Price',
  salePrice: 'Sale price',
  photos: 'Photos',
  addOnGroups: 'Add-ons',
};

function describeChangedFields(changes: Record<string, unknown>): string {
  const labels = Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k);
  if (labels.length === 0) return 'Changes';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

export default function CatalogItemModerationCard({
  itemId,
  onEdit,
}: {
  itemId: string;
  onEdit?: () => void;
}) {
  const [data, setData] = useState<ModerationResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const get = callable<{ itemId: string }, ModerationResponse>('getCatalogItemModeration');
      const res = await get({ itemId });
      setData(res.data);
    } catch (err) {
      console.error('[ItemModeration] Failed to load:', err);
      setError("Couldn't load this item's review status.");
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (isLoading) {
    return (
      <View style={styles.card} testID="item-moderation-loading">
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.card} testID="item-moderation-error">
        <View style={styles.row}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
        <TouchableOpacity style={styles.retryRow} onPress={() => void load()} testID="item-moderation-retry">
          <RefreshCw size={14} color={Colors.primary} strokeWidth={2.5} />
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data) return null;

  const { moderationStatus, rejectionReason, pendingRevision } = data;

  // A refused edit is the most urgent thing to surface: the item is still live,
  // but the vendor's intended change was refused and needs action.
  if (pendingRevision?.status === 'rejected') {
    return (
      <View style={[styles.card, styles.cardDanger]} testID="item-moderation-revision-rejected">
        <View style={styles.row}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={styles.titleDanger}>Your change wasn&apos;t approved</Text>
        </View>
        <Text style={styles.body}>
          {describeChangedFields(pendingRevision.proposedChanges)} couldn&apos;t be updated. Customers
          are still seeing the version that was approved before.
        </Text>
        {pendingRevision.rejectionReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{pendingRevision.rejectionReason}</Text>
          </View>
        ) : null}
        {onEdit ? (
          <TouchableOpacity style={styles.actionButton} onPress={onEdit} testID="item-moderation-edit">
            <Pencil size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.actionText}>Edit and resubmit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (pendingRevision?.status === 'pending') {
    return (
      <View style={[styles.card, styles.cardPending]} testID="item-moderation-revision-pending">
        <View style={styles.row}>
          <Clock size={16} color="#B45309" strokeWidth={2} />
          <Text style={styles.titlePending}>Change under review</Text>
        </View>
        <Text style={styles.body}>
          {describeChangedFields(pendingRevision.proposedChanges)} {Object.keys(pendingRevision.proposedChanges).length === 1 ? 'is' : 'are'} waiting
          for approval. Customers keep seeing the approved version until it&apos;s reviewed, so your
          listing stays live.
        </Text>
      </View>
    );
  }

  if (moderationStatus === 'rejected') {
    return (
      <View style={[styles.card, styles.cardDanger]} testID="item-moderation-rejected">
        <View style={styles.row}>
          <AlertCircle size={16} color={Colors.error} strokeWidth={2} />
          <Text style={styles.titleDanger}>Not approved</Text>
        </View>
        <Text style={styles.body}>
          This item isn&apos;t visible to customers. Make the changes below and it&apos;ll go back for
          review automatically.
        </Text>
        {rejectionReason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{rejectionReason}</Text>
          </View>
        ) : null}
        {onEdit ? (
          <TouchableOpacity style={styles.actionButton} onPress={onEdit} testID="item-moderation-edit">
            <Pencil size={14} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.actionText}>Edit and resubmit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  if (moderationStatus === 'pending') {
    return (
      <View style={[styles.card, styles.cardPending]} testID="item-moderation-pending">
        <View style={styles.row}>
          <Clock size={16} color="#B45309" strokeWidth={2} />
          <Text style={styles.titlePending}>Under review</Text>
        </View>
        <Text style={styles.body}>
          Visible only to you until it&apos;s approved. It can&apos;t be ordered or appear in search
          yet.
        </Text>
      </View>
    );
  }

  // Approved and nothing outstanding — confirm it plainly rather than showing
  // nothing, so a vendor can tell "approved" from "not loaded".
  return (
    <View style={[styles.card, styles.cardOk]} testID="item-moderation-approved">
      <View style={styles.row}>
        <CheckCircle2 size={16} color="#16A34A" strokeWidth={2} />
        <Text style={styles.titleOk}>Approved</Text>
      </View>
      <Text style={styles.body}>
        {data.isVisibleToCustomers
          ? 'Live and visible to customers.'
          : 'Approved, but hidden from your storefront by your own settings.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  cardPending: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  cardDanger: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  cardOk: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  row: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7 },
  titlePending: { fontSize: 14.5, fontWeight: '700' as const, color: '#92400E' },
  titleDanger: { fontSize: 14.5, fontWeight: '700' as const, color: '#991B1B' },
  titleOk: { fontSize: 14.5, fontWeight: '700' as const, color: '#166534' },
  body: { fontSize: 13, lineHeight: 19, color: Colors.textSecondary, marginTop: 6 },
  reasonBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.035)',
  },
  reasonLabel: {
    fontSize: 10.5,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    color: Colors.textMuted,
  },
  reasonText: { fontSize: 13, lineHeight: 19, color: Colors.text, marginTop: 3 },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  actionText: { fontSize: 13.5, fontWeight: '700' as const, color: '#FFFFFF' },
  errorText: { flex: 1, fontSize: 13, color: Colors.textSecondary },
  retryRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 8 },
  retryText: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
});
