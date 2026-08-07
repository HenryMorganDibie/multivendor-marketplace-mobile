import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, X, LogOut, Package, Pencil } from 'lucide-react-native';
import { Alert } from '@/utils/alert';
import { useAuth } from '@/contexts/AuthContext';
import { callable } from '@/lib/firebase';
import { Colors } from '@/constants/colors';

/**
 * The minimum admin tool needed to actually use catalog moderation — the
 * backend (listCatalogModerationQueue, approveCatalogItem, rejectCatalogItem)
 * was built and paid for under Phase 2 and has had no caller at all: nobody
 * could approve anything without reading and writing Firestore by hand.
 *
 * This is deliberately small. It is not Milestone 5's admin portal — no
 * tickets, no reports, no audit log viewer, just the one queue that was
 * blocking every vendor's first item from ever going live.
 */

interface QueueEntry {
  vendorId: string;
  itemId: string;
  name: string;
  kind: 'new_item' | 'revision';
  submittedAt: unknown;
  proposedChanges?: Record<string, unknown>;
  previousRejectionReason?: string | null;
}

interface QueueResponse {
  success: true;
  newItems: QueueEntry[];
  revisions: QueueEntry[];
  counts: { newItems: number; revisions: number };
  truncated: { newItems: boolean; revisions: boolean };
}

function formatSubmittedAt(value: unknown): string {
  if (!value) return '';
  const ts = value as { toDate?: () => Date; seconds?: number };
  const date = typeof ts.toDate === 'function'
    ? ts.toDate()
    : typeof ts.seconds === 'number'
      ? new Date(ts.seconds * 1000)
      : null;
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
}

export default function AdminModerationScreen() {
  const { logout } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newItems, setNewItems] = useState<QueueEntry[]>([]);
  const [revisions, setRevisions] = useState<QueueEntry[]>([]);
  const [truncated, setTruncated] = useState({ newItems: false, revisions: false });
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<QueueEntry | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadQueue = useCallback(async () => {
    setError(null);
    try {
      const list = callable<{ limit?: number }, QueueResponse>('listCatalogModerationQueue');
      const res = await list({});
      setNewItems(res.data.newItems);
      setRevisions(res.data.revisions);
      setTruncated(res.data.truncated);
    } catch (err) {
      const message = (err as { message?: string })?.message
        ?? 'Could not load the moderation queue.';
      setError(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    void loadQueue();
  };

  const removeFromLists = (entry: QueueEntry) => {
    setNewItems((prev) => prev.filter((e) => e.itemId !== entry.itemId));
    setRevisions((prev) => prev.filter((e) => e.itemId !== entry.itemId));
  };

  const handleApprove = async (entry: QueueEntry) => {
    const key = `${entry.itemId}-approve`;
    setBusyKey(key);
    try {
      const approve = callable<{ vendorId: string; itemId: string }, { success: true }>('approveCatalogItem');
      await approve({ vendorId: entry.vendorId, itemId: entry.itemId });
      removeFromLists(entry);
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Could not approve this item.';
      Alert.alert('Approval failed', message);
    } finally {
      setBusyKey(null);
    }
  };

  const openReject = (entry: QueueEntry) => {
    setRejectTarget(entry);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    const key = `${rejectTarget.itemId}-reject`;
    setBusyKey(key);
    try {
      const reject = callable<{ vendorId: string; itemId: string; reason: string }, { success: true }>('rejectCatalogItem');
      await reject({ vendorId: rejectTarget.vendorId, itemId: rejectTarget.itemId, reason: rejectReason.trim() });
      removeFromLists(rejectTarget);
      setRejectTarget(null);
      setRejectReason('');
    } catch (err) {
      const message = (err as { message?: string })?.message ?? 'Could not reject this item.';
      Alert.alert('Rejection failed', message);
    } finally {
      setBusyKey(null);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const totalCount = newItems.length + revisions.length;

  const renderEntry = (entry: QueueEntry) => {
    const approveKey = `${entry.itemId}-approve`;
    const rejectKey = `${entry.itemId}-reject`;
    const isBusy = busyKey === approveKey || busyKey === rejectKey;
    return (
      <View key={entry.itemId} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.kindBadge}>
            {entry.kind === 'revision' ? (
              <Pencil size={12} color={Colors.primary} strokeWidth={2.5} />
            ) : (
              <Package size={12} color={Colors.primary} strokeWidth={2.5} />
            )}
            <Text style={styles.kindBadgeText}>{entry.kind === 'revision' ? 'Edit' : 'New item'}</Text>
          </View>
          {formatSubmittedAt(entry.submittedAt) ? (
            <Text style={styles.submittedAt}>{formatSubmittedAt(entry.submittedAt)}</Text>
          ) : null}
        </View>

        <Text style={styles.itemName}>{entry.name}</Text>
        <Text style={styles.vendorId}>Vendor: {entry.vendorId}</Text>

        {entry.kind === 'revision' && entry.proposedChanges ? (
          <View style={styles.changesBox}>
            <Text style={styles.changesLabel}>Proposed changes</Text>
            {Object.entries(entry.proposedChanges).map(([key, value]) => (
              <Text key={key} style={styles.changesLine} numberOfLines={2}>
                {key}: {JSON.stringify(value)}
              </Text>
            ))}
          </View>
        ) : null}

        {entry.previousRejectionReason ? (
          <Text style={styles.previousReason}>Previously rejected: {entry.previousRejectionReason}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => openReject(entry)}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            <X size={16} color={Colors.error} strokeWidth={2.5} />
            <Text style={[styles.actionButtonText, { color: Colors.error }]}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApprove(entry)}
            disabled={isBusy}
            activeOpacity={0.7}
          >
            {busyKey === approveKey ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Check size={16} color={Colors.white} strokeWidth={2.5} />
                <Text style={[styles.actionButtonText, { color: Colors.white }]}>Approve</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Catalog moderation</Text>
            <Text style={styles.subtitle}>
              {isLoading ? 'Loading…' : `${totalCount} awaiting review`}
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton} activeOpacity={0.7}>
            <LogOut size={20} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
      >
        {isLoading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centerBlock}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => void loadQueue()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : totalCount === 0 ? (
          <View style={styles.centerBlock}>
            <Text style={styles.emptyText}>Nothing waiting for review.</Text>
          </View>
        ) : (
          <>
            {newItems.map(renderEntry)}
            {revisions.map(renderEntry)}
            {(truncated.newItems || truncated.revisions) && (
              <Text style={styles.truncatedNote}>
                More items exist than shown here — refresh after clearing some of this queue.
              </Text>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setRejectTarget(null)} />
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Reject "{rejectTarget?.name}"</Text>
          <Text style={styles.modalSubtitle}>This reason is shown to the vendor.</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Why is this being rejected?"
            placeholderTextColor={Colors.textMuted}
            value={rejectReason}
            onChangeText={setRejectReason}
            multiline
            autoFocus
          />
          <View style={styles.modalActions}>
            <TouchableOpacity onPress={() => setRejectTarget(null)} style={styles.modalCancelButton}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleReject}
              disabled={!rejectReason.trim() || busyKey === `${rejectTarget?.itemId}-reject`}
              style={[
                styles.modalConfirmButton,
                !rejectReason.trim() && styles.modalConfirmButtonDisabled,
              ]}
            >
              {busyKey === `${rejectTarget?.itemId}-reject` ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.modalConfirmText}>Reject</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 22, fontWeight: '700' as const, color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  logoutButton: { padding: 8 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  centerBlock: { alignItems: 'center' as const, justifyContent: 'center' as const, paddingVertical: 80 },
  errorText: { fontSize: 15, color: Colors.error, textAlign: 'center' as const, marginBottom: 16 },
  retryButton: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: '600' as const, color: Colors.primary },
  emptyText: { fontSize: 15, color: Colors.textMuted },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  kindBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  kindBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.primary },
  submittedAt: { fontSize: 12, color: Colors.textMuted },
  itemName: { fontSize: 17, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  vendorId: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  changesBox: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  changesLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.textMuted, marginBottom: 4, textTransform: 'uppercase' as const },
  changesLine: { fontSize: 13, color: Colors.text, marginBottom: 2 },
  previousReason: { fontSize: 13, color: Colors.error, marginBottom: 8 },
  actionsRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
  actionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
  },
  rejectButton: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.error },
  approveButton: { backgroundColor: Colors.primary },
  actionButtonText: { fontSize: 14, fontWeight: '600' as const },
  truncatedNote: { fontSize: 12, color: Colors.textMuted, textAlign: 'center' as const, marginTop: 8 },
  modalOverlay: { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    position: 'absolute' as const,
    top: '30%' as any,
    left: 20,
    right: 20,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: Colors.textMuted, marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top' as const,
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row' as const, justifyContent: 'flex-end' as const, gap: 12 },
  modalCancelButton: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { fontSize: 15, fontWeight: '600' as const, color: Colors.textSecondary },
  modalConfirmButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.error,
    minWidth: 80,
    alignItems: 'center' as const,
  },
  modalConfirmButtonDisabled: { opacity: 0.5 },
  modalConfirmText: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
});
