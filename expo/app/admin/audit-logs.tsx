import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuditLog, AuditLog, AuditEventType } from '@/contexts/AuditLogContext';

/**
 * Audit logs belong to the separate Admin Web Portal, not the production mobile
 * app. This route is intentionally disabled in mobile builds: it redirects away
 * so it can never be reached, while the implementation below is preserved for
 * reference / potential internal tooling. Flip ADMIN_AUDIT_LOGS_ENABLED only in
 * a non-production internal build.
 */
const ADMIN_AUDIT_LOGS_ENABLED = false;

export default function AuditLogsRoute() {
  if (!ADMIN_AUDIT_LOGS_ENABLED) {
    return <Redirect href="/" />;
  }
  return <AuditLogsScreen />;
}

function AuditLogsScreen() {
  const router = useRouter();
  const { getAllLogs, loadLogs } = useAuditLog();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<AuditEventType | 'all'>('all');

  useEffect(() => {
    const loadData = async () => {
      await loadLogs();
      const allLogs = getAllLogs();
      setLogs(allLogs);
      setFilteredLogs(allLogs);
    };
    loadData();
  }, [loadLogs, getAllLogs]);

  useEffect(() => {
    let filtered = [...logs];

    if (selectedEventType !== 'all') {
      filtered = filtered.filter((log) => log.eventType === selectedEventType);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.orderId?.toLowerCase().includes(query) ||
          log.vendorId?.toLowerCase().includes(query) ||
          log.customerId?.toLowerCase().includes(query) ||
          log.eventType.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  }, [logs, searchQuery, selectedEventType]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getEventTypeLabel = (eventType: AuditEventType) => {
    const labels: Record<AuditEventType, string> = {
      order_created: 'Order Created',
      order_accepted: 'Order Accepted',
      order_status_changed: 'Status Changed',
      order_completed: 'Order Completed',
      payment_request_sent: 'Payment Request',
      partial_payment_marked: 'Partial Payment',
      full_payment_marked: 'Full Payment',
      payment_adjusted: 'Payment Adjusted',
      chat_enabled: 'Chat Enabled',
      chat_disabled: 'Chat Disabled',
      vendor_chat_input_disabled: 'Vendor Input Disabled',
    };
    return labels[eventType] || eventType;
  };

  const getEventTypeColor = (eventType: AuditEventType) => {
    switch (eventType) {
      case 'order_created':
      case 'order_accepted':
        return Colors.primary;
      case 'order_status_changed':
        return Colors.primary;
      case 'order_completed':
        return Colors.success;
      case 'payment_request_sent':
      case 'partial_payment_marked':
      case 'full_payment_marked':
      case 'payment_adjusted':
        return Colors.success;
      case 'chat_enabled':
        return Colors.primary;
      case 'chat_disabled':
      case 'vendor_chat_input_disabled':
        return Colors.error;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Audit Logs</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by order, vendor, or customer ID"
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedEventType === 'all' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedEventType('all')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEventType === 'all' && styles.filterChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedEventType === 'order_created' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedEventType('order_created')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEventType === 'order_created' && styles.filterChipTextActive,
              ]}
            >
              Order Created
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedEventType === 'order_status_changed' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedEventType('order_status_changed')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEventType === 'order_status_changed' && styles.filterChipTextActive,
              ]}
            >
              Status Changes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedEventType === 'payment_request_sent' && styles.filterChipActive,
            ]}
            onPress={() => setSelectedEventType('payment_request_sent')}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedEventType === 'payment_request_sent' && styles.filterChipTextActive,
              ]}
            >
              Payment Requests
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              (selectedEventType === 'full_payment_marked' ||
                selectedEventType === 'partial_payment_marked') &&
                styles.filterChipActive,
            ]}
            onPress={() =>
              setSelectedEventType(
                selectedEventType === 'full_payment_marked' || selectedEventType === 'partial_payment_marked'
                  ? 'all'
                  : 'full_payment_marked'
              )
            }
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterChipText,
                (selectedEventType === 'full_payment_marked' ||
                  selectedEventType === 'partial_payment_marked') &&
                  styles.filterChipTextActive,
              ]}
            >
              Payments
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{logs.length}</Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{filteredLogs.length}</Text>
            <Text style={styles.statLabel}>Filtered</Text>
          </View>
        </View>

        {filteredLogs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No audit logs found</Text>
          </View>
        ) : (
          <View style={styles.logsContainer}>
            {filteredLogs.map((log) => (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View
                    style={[
                      styles.eventBadge,
                      { backgroundColor: getEventTypeColor(log.eventType) },
                    ]}
                  >
                    <Text style={styles.eventBadgeText}>
                      {getEventTypeLabel(log.eventType)}
                    </Text>
                  </View>
                  <Text style={styles.logTimestamp}>{formatTimestamp(log.timestamp)}</Text>
                </View>

                {log.orderId && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>Order ID:</Text>
                    <Text style={styles.logValue}>{log.orderId}</Text>
                  </View>
                )}

                {log.vendorId && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>Vendor ID:</Text>
                    <Text style={styles.logValue}>{log.vendorId}</Text>
                  </View>
                )}

                {log.customerId && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>Customer ID:</Text>
                    <Text style={styles.logValue}>{log.customerId}</Text>
                  </View>
                )}

                {log.previousState && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>Previous State:</Text>
                    <Text style={styles.logValue}>{log.previousState}</Text>
                  </View>
                )}

                {log.newState && (
                  <View style={styles.logRow}>
                    <Text style={styles.logLabel}>New State:</Text>
                    <Text style={styles.logValue}>{log.newState}</Text>
                  </View>
                )}

                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <View style={styles.metadataSection}>
                    <Text style={styles.metadataLabel}>Metadata:</Text>
                    <View style={styles.metadataContent}>
                      <Text style={styles.metadataText}>
                        {JSON.stringify(log.metadata, null, 2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 12,
  },
  filterScrollView: {
    maxHeight: 50,
  },
  filterContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center' as const,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  logsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  logHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  eventBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  logTimestamp: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  logRow: {
    flexDirection: 'row' as const,
    marginBottom: 8,
  },
  logLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    width: 120,
    fontWeight: '500' as const,
  },
  logValue: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  metadataSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  metadataLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  metadataContent: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
  },
  metadataText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontFamily: 'monospace' as const,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center' as const,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
