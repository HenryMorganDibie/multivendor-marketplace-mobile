import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, BellOff } from 'lucide-react-native';
import { useCustomerNotifications } from '@/contexts/CustomerNotificationContext';
import { getVendorStorefrontPath } from '@/utils/vendorLookup';
import {
  NotificationItem,
  NotificationItemData,
  mapNotificationType,
  isHighPriority,
  groupNotificationsByDate,
} from '@/components/NotificationItem';
import { Colors } from '@/constants/colors';

export default function CustomerNotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    markAsRead,
    markAllAsRead,
  } = useCustomerNotifications();

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  const mappedNotifications: NotificationItemData[] = useMemo(() => {
    return notifications.map(n => ({
      id: n.id,
      category: mapNotificationType(n.type),
      title: n.title,
      message: n.message,
      timestamp: n.timestamp,
      is_read: n.read,
      is_high_priority: isHighPriority(n.type),
      orderId: n.fullOrderId,
      _vendorId: n.vendorId,
      _domain: n.domain,
      _type: n.type,
    }));
  }, [notifications]);

  const sections = useMemo(() => groupNotificationsByDate(mappedNotifications), [mappedNotifications]);

  const handleNotificationPress = useCallback((notification: NotificationItemData) => {
    markAsRead(notification.id);
    const raw = notifications.find(n => n.id === notification.id);
    if (!raw) return;

    if (raw.domain === 'support') {
      router.push('/help-center' as any);
    } else if (raw.domain === 'customer_chat') {
      // sendChatMessage.ts sets domain by the RECIPIENT's role, so a
      // customer's own incoming-message notifications are 'customer_chat',
      // not 'vendor_chat' (that's what a vendor's incoming messages get) —
      // this branch never matched a real notification before.
      if (raw.vendorId) {
        router.push(`/chat/${raw.vendorId}` as any);
      } else {
        router.push('/customer/(tabs)/chats' as any);
      }
    } else if (raw.domain === 'order') {
      // getVendorStorefrontPath resolves against the local mocks/vendorData.ts
      // fixture array — a real vendorId is never in it, so this silently
      // fell through to '/' (app home) for every real order notification.
      // updateOrderStatus.ts and createOrder.ts both set metadata.orderId on
      // these, so route straight to the real order instead of through that
      // broken lookup.
      if (raw.orderId) {
        router.push(`/order/${raw.orderId}` as any);
      } else if (raw.vendorId) {
        router.push(getVendorStorefrontPath(raw.vendorId) as any);
      }
    }
  }, [markAsRead, notifications, router]);

  const renderItem = useCallback(({ item }: { item: NotificationItemData }) => (
    <NotificationItem notification={item} onPress={handleNotificationPress} />
  ), [handleNotificationPress]);

  const renderSectionHeader = useCallback(({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title.toUpperCase()}</Text>
    </View>
  ), []);

  const renderSeparator = useCallback(() => (
    <View style={styles.separator}>
      <View style={styles.separatorLine} />
    </View>
  ), []);

  const keyExtractor = useCallback((item: NotificationItemData) => item.id, []);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            testID="notifications-back"
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllButton}
              onPress={markAllAsRead}
              activeOpacity={0.7}
              testID="mark-all-read"
            >
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>
      </SafeAreaView>

      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ItemSeparatorComponent={renderSeparator}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[
          styles.listContent,
          sections.length === 0 && styles.listContentEmpty,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <BellOff size={32} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyDescription}>
              Updates about your orders and messages will appear here.
            </Text>
          </View>
        }
        ListFooterComponent={sections.length > 0 ? <View style={styles.footer} /> : null}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  headerPlaceholder: {
    width: 80,
  },
  listContent: {
    paddingTop: 4,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    backgroundColor: Colors.background,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  separator: {
    paddingLeft: 68,
    paddingRight: 16,
  },
  separatorLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECEDF0',
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  footer: {
    height: 40,
  },
});
