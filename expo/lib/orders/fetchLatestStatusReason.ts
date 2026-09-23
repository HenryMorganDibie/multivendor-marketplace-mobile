import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { OrderStatus } from '@/mocks/ordersData';

/**
 * The human-readable reason for a rejected/cancelled order, durably
 * persisted server-side at orders/{orderId}/events/{eventId}.metadata.reason
 * (written once, by updateOrderStatus.ts, in the same call that sets the
 * order's terminal status) but never mapped onto the order document itself,
 * so mapOrderDoc has nothing to rehydrate it from directly.
 *
 * At most one STATUS_CHANGED event can exist with after.status equal to a
 * given terminal status for a given order: 'rejected' and 'cancelled' both
 * have no outgoing transition anywhere in the backend's transition tables
 * (VENDOR_TRANSITIONS/CUSTOMER_TRANSITIONS in updateOrderStatus.ts), so
 * neither can be reached a second time, and the transaction's compare-and-set
 * guard means a retried/concurrent call throws before ever writing a second
 * event. limit(1) is therefore a read-optimization on a structurally
 * guaranteed-unique result, not a correctness workaround.
 *
 * Both filters are plain equality (no orderBy/range mixed in), so this reads
 * under Firestore's default automatic single-field indexing with no composite
 * index required.
 */
export async function fetchLatestStatusReason(
  orderId: string,
  status: Extract<OrderStatus, 'rejected' | 'cancelled'>
): Promise<string | undefined> {
  const eventsQuery = query(
    collection(db, 'orders', orderId, 'events'),
    where('eventType', '==', 'STATUS_CHANGED'),
    where('after.status', '==', status),
    limit(1)
  );
  const snap = await getDocs(eventsQuery);
  const reason = snap.docs[0]?.data()?.metadata?.reason;
  return typeof reason === 'string' ? reason : undefined;
}
