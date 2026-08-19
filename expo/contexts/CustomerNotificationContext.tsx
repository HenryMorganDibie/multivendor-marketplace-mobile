import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, orderBy, query, limit as fbLimit, updateDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

export type CustomerNotificationType =
  | 'order_sent'
  | 'order_accepted'
  | 'order_rejected'
  | 'order_ready'
  | 'partial_payment_confirmed'
  | 'payment_confirmed'
  | 'pickup_instructions'
  | 'new_vendor_message'
  | 'new_support_message'
  // Real backend-generated types this app didn't previously know about —
  // kept as a passthrough string below rather than a closed union, since
  // the real users/{uid}/notifications feed is server-generated and this
  // context does not get to decide what type values arrive.
  | (string & {});

export type NotificationDomain = 'order' | 'vendor_chat' | 'customer_chat' | 'support' | 'verification' | 'system' | (string & {});

export interface CustomerNotification {
  id: string;
  type: CustomerNotificationType;
  domain: NotificationDomain;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  orderId?: string;
  fullOrderId?: string;
  vendorId?: string;
  actorName: string;
  trackingLink?: string;
  deepLink?: string | null;
}

const NOTIFICATION_PAGE_SIZE = 50;

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

/**
 * Reads the real users/{uid}/notifications subcollection (Phase 3 spec,
 * populated server-side by createNotificationInternal — order events, chat
 * messages, pickup-details, etc). This used to be a fully client-generated,
 * AsyncStorage-only feed (notifyOrderSent/notifyOrderAccepted/... calling
 * addNotification locally) with zero real backend consumers and zero real
 * UI call sites for those creation functions — confirmed by a repo-wide
 * search before this rewrite. The client-generated functions are removed
 * entirely rather than ported: per Phase 3's own security rules, only
 * Cloud Functions may create a notification document at all
 * (`allow create: if false` for clients), so a client-side "notify" call
 * was never something that could correctly reach the real collection —
 * it was always going to be a second, fake, unsynced feed.
 */
export const [CustomerNotificationProvider, useCustomerNotifications] = createContextHook(() => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
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
        const list: CustomerNotification[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            type: (data.type as string) ?? 'system',
            domain: (data.domain as string) ?? 'system',
            title: (data.title as string) ?? '',
            message: (data.body as string) ?? '',
            timestamp: toIsoString(data.createdAt),
            read: Boolean(data.read),
            orderId: (data.metadata as Record<string, unknown> | undefined)?.orderId as string | undefined,
            fullOrderId: (data.metadata as Record<string, unknown> | undefined)?.orderId as string | undefined,
            vendorId: (data.vendorId as string | undefined) ?? undefined,
            actorName: (data.title as string) ?? '',
            deepLink: (data.deepLink as string | null | undefined) ?? null,
          };
        });
        setNotifications(list);
        setIsLoading(false);
      },
      (error) => {
        console.error('[CustomerNotifications] Live subscription failed:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.id]);

  const markAsRead = useCallback((notificationId: string) => {
    const uid = user?.id ?? auth.currentUser?.uid;
    if (!uid) return;
    // read/readAt are the only fields a client may write on its own
    // notification document (Phase 3 rules) — narrow, allowlisted update,
    // not a general write.
    void updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      read: true,
      readAt: serverTimestamp(),
    }).catch((error) => console.error('[CustomerNotifications] Failed to mark read:', error));
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
    void batch.commit().catch((error) => console.error('[CustomerNotifications] Failed to mark all read:', error));
  }, [user?.id, notifications]);

  const getUnreadCount = useCallback(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  return {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    getUnreadCount,
  };
});
