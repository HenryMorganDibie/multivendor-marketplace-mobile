import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, orderBy, query, limit as fbLimit, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

export type VendorNotificationType =
  | 'new_order'
  | 'customer_cancelled_order'
  | 'order_expired'
  | 'new_customer_message'
  | 'new_support_message'
  | 'verification_requested'
  | 'verification_approved'
  | 'verification_rejected'
  | 'account_warning'
  | 'account_restriction'
  | (string & {});

export type NotificationDomain = 'order' | 'vendor_chat' | 'customer_chat' | 'support' | 'verification' | 'system' | (string & {});

export interface VendorNotification {
  id: string;
  type: VendorNotificationType;
  domain: NotificationDomain;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  fullOrderId?: string;
  orderId?: string;
  actorName: string;
  deepLink?: string | null;
}

const NOTIFICATION_PAGE_SIZE = 50;

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

/**
 * Vendor-side counterpart to CustomerNotificationContext — same real
 * users/{uid}/notifications subcollection, same recipientUid (the vendor
 * owner's own authenticated uid, not the business/vendorId). See that file
 * for why the client-generated notifyNewOrder/notifyCustomerCancelledOrder/
 * etc. functions were removed rather than ported: notification documents
 * are Cloud-Functions-only to create.
 */
export const [VendorNotificationProvider, useVendorNotifications] = createContextHook(() => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<VendorNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const uid = user?.id ?? auth.currentUser?.uid;
    if (!uid) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      fbLimit(NOTIFICATION_PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: VendorNotification[] = snap.docs.map((d) => {
          const data = d.data();
          const metadata = data.metadata as Record<string, unknown> | undefined;
          return {
            id: d.id,
            type: (data.type as string) ?? 'system',
            domain: (data.domain as string) ?? 'system',
            title: (data.title as string) ?? '',
            message: (data.body as string) ?? '',
            timestamp: toIsoString(data.createdAt),
            read: Boolean(data.read),
            fullOrderId: metadata?.orderId as string | undefined,
            orderId: metadata?.orderId as string | undefined,
            actorName: (data.title as string) ?? '',
            deepLink: (data.deepLink as string | null | undefined) ?? null,
          };
        });
        setNotifications(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('[VendorNotifications] Live subscription failed:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  const markAsRead = useCallback((notificationId: string) => {
    const uid = user?.id ?? auth.currentUser?.uid;
    if (!uid) return;
    void updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
    }).catch((error) => console.error('[VendorNotifications] Failed to mark read:', error));
  }, [user?.id]);

  const markAllAsRead = useCallback(() => {
    const uid = user?.id ?? auth.currentUser?.uid;
    if (!uid) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    for (const n of unread) {
      batch.update(doc(db, 'users', uid, 'notifications', n.id), { read: true, readAt: serverTimestamp() });
    }
    void batch.commit().catch((error) => console.error('[VendorNotifications] Failed to mark all read:', error));
  }, [user?.id, notifications]);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const unreadHighPriorityCount = notifications.filter(
    n => !n.read && (n.type === 'new_order' || n.type === 'customer_cancelled_order')
  ).length;

  const hasUnreadMediumPriority = notifications.some(
    n => !n.read && (n.type === 'new_customer_message' || n.type === 'verification_requested')
  );

  const clearOrderBadges = useCallback(() => {
    const uid = user?.id ?? auth.currentUser?.uid;
    if (!uid) return;
    const targets = notifications.filter(
      n => !n.read && (n.type === 'new_order' || n.type === 'customer_cancelled_order')
    );
    if (targets.length === 0) return;
    const batch = writeBatch(db);
    for (const n of targets) {
      batch.update(doc(db, 'users', uid, 'notifications', n.id), { read: true, readAt: serverTimestamp() });
    }
    void batch.commit().catch((error) => console.error('[VendorNotifications] Failed to clear order badges:', error));
  }, [user?.id, notifications]);

  return {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
    unreadHighPriorityCount,
    hasUnreadMediumPriority,
    clearOrderBadges,
  };
});
