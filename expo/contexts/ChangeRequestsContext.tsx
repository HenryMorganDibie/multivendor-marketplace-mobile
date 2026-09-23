import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, callable } from '@/lib/firebase';
import type { OrderItem } from '@/mocks/ordersData';
import type { MenuItem } from '@/mocks/vendorData';

export type ChangeRequestIssueType = 'item_unavailable' | 'adjust_quantity' | 'other' | 'structured_edit';
export type ChangeRequestItemAction = 'remove' | 'replace' | 'adjust_quantity' | 'unchanged';
export type ChangeRequestStatus = 'pending' | 'accepted' | 'declined';

export interface ChangeRequestChange {
  originalItem: OrderItem;
  action: ChangeRequestItemAction;
  replacementItem?: MenuItem;
  newQuantity?: number;
  priceDifference: number;
}

export interface ChangeRequest {
  id: string;
  orderId: string;
  vendorName: string;
  issueType: ChangeRequestIssueType;
  vendorMessage?: string;
  changes: ChangeRequestChange[];
  originalTotal: number;
  proposedTotal: number;
  status: ChangeRequestStatus;
  createdAt: string;
}

/**
 * What actually gets written into handleChangeRequest's proposedChanges,
 * alongside the `items` array the backend uses to reprice. `items` alone
 * (a flat before/after list) can't be turned back into remove/replace/
 * adjust_quantity per original line item without an ambiguous diff -
 * changeSummary is this UI's own change list, round-tripped through
 * Firestore verbatim so reading a change request back is lossless. The
 * backend never reads this field; it only exists for this screen.
 */
interface StoredChangeSummaryItem {
  originalItemId: string;
  originalName: string;
  originalPrice: number;
  originalImage?: string;
  originalQuantity: number;
  action: ChangeRequestItemAction;
  newQuantity?: number;
  replacementItemId?: string;
  replacementName?: string;
  replacementPrice?: number;
  replacementImage?: string;
}

function summaryToChange(s: StoredChangeSummaryItem): ChangeRequestChange {
  const originalItem: OrderItem = {
    id: s.originalItemId,
    name: s.originalName,
    price: s.originalPrice,
    image: s.originalImage,
    quantity: s.originalQuantity,
  };
  const replacementItem: MenuItem | undefined = s.replacementItemId
    ? ({
        id: s.replacementItemId,
        name: s.replacementName ?? '',
        price: s.replacementPrice ?? 0,
        image: s.replacementImage,
      } as MenuItem)
    : undefined;
  const origLineTotal = s.originalPrice * s.originalQuantity;
  let priceDifference = 0;
  if (s.action === 'remove') priceDifference = -origLineTotal;
  else if (s.action === 'adjust_quantity' && s.newQuantity !== undefined) {
    priceDifference = (s.newQuantity - s.originalQuantity) * s.originalPrice;
  } else if (s.action === 'replace' && replacementItem) {
    priceDifference = replacementItem.price * (s.newQuantity ?? s.originalQuantity) - origLineTotal;
  }
  return { originalItem, action: s.action, replacementItem, newQuantity: s.newQuantity, priceDifference };
}

function changeToSummary(c: ChangeRequestChange): StoredChangeSummaryItem {
  return {
    originalItemId: c.originalItem.id,
    originalName: c.originalItem.name,
    originalPrice: c.originalItem.price,
    originalImage: c.originalItem.image,
    originalQuantity: c.originalItem.quantity,
    action: c.action,
    newQuantity: c.newQuantity,
    replacementItemId: c.replacementItem?.id,
    replacementName: c.replacementItem?.name,
    replacementPrice: c.replacementItem?.price,
    replacementImage: c.replacementItem?.image,
  };
}

/**
 * Turns a change list into the flat items array handleChangeRequest's
 * repriceProposedItems expects - what the order's items should become if
 * this proposal is accepted as-is. Only itemId/quantity/selectedAddOns are
 * sent; price/name are re-derived server-side from the live catalog, same
 * as every other order-pricing path in this app never trusts a client total.
 */
function changesToBackendItems(changes: ChangeRequestChange[]): { itemId: string; quantity: number; selectedAddOns?: { groupId: string; optionId: string }[] }[] {
  const items: { itemId: string; quantity: number; selectedAddOns?: { groupId: string; optionId: string }[] }[] = [];
  for (const c of changes) {
    const selectedAddOns = c.originalItem.addOns?.map((a) => ({ groupId: a.groupId, optionId: a.id }));
    if (c.action === 'remove') continue;
    if (c.action === 'replace' && c.replacementItem) {
      items.push({ itemId: c.replacementItem.id, quantity: c.newQuantity ?? c.originalItem.quantity, selectedAddOns });
      continue;
    }
    items.push({ itemId: c.originalItem.id, quantity: c.newQuantity ?? c.originalItem.quantity, selectedAddOns });
  }
  return items;
}

interface ChangeRequestDocShape {
  changeRequestId: string;
  orderId: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  proposedChanges?: { items?: unknown; changeSummary?: StoredChangeSummaryItem[]; notes?: string };
  message?: string;
  createdAt?: { toDate?: () => Date };
}

function mapStatus(s: ChangeRequestDocShape['status']): ChangeRequestStatus {
  return s === 'ACCEPTED' ? 'accepted' : s === 'REJECTED' ? 'declined' : 'pending';
}

export const [ChangeRequestsProvider, useChangeRequests] = createContextHook(() => {
  const [requestsByOrder, setRequestsByOrder] = useState<Record<string, ChangeRequest[]>>({});
  const subscriptionsRef = useRef<Record<string, () => void>>({});

  /**
   * Idempotent - safe to call on every render/mount of a screen that needs
   * this order's change requests. The real vendorName/originalTotal aren't
   * on the backend document (handleChangeRequest never stores them - they're
   * display-only), so the caller supplies them from the order it already
   * has loaded, and they're stamped onto every request mapped for this order.
   */
  const subscribeToOrder = useCallback((orderId: string, vendorName: string, originalTotal: number) => {
    if (subscriptionsRef.current[orderId]) return;
    const q = query(collection(db, 'orders', orderId, 'changeRequests'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const mapped: ChangeRequest[] = snap.docs.map((d) => {
        const data = d.data() as ChangeRequestDocShape;
        const summary = Array.isArray(data.proposedChanges?.changeSummary) ? data.proposedChanges!.changeSummary! : [];
        const changes = summary.map(summaryToChange);
        const proposedTotal = changes.reduce((sum, c) => sum + c.priceDifference, originalTotal);
        return {
          id: data.changeRequestId ?? d.id,
          orderId,
          vendorName,
          issueType: 'structured_edit',
          vendorMessage: data.message,
          changes,
          originalTotal,
          proposedTotal: Math.max(0, proposedTotal),
          status: mapStatus(data.status),
          createdAt: data.createdAt?.toDate?.().toISOString() ?? new Date().toISOString(),
        };
      });
      setRequestsByOrder((prev) => ({ ...prev, [orderId]: mapped }));
    });
    subscriptionsRef.current[orderId] = unsubscribe;
  }, []);

  const requests = useMemo(() => Object.values(requestsByOrder).flat(), [requestsByOrder]);

  const getRequestForOrder = useCallback(
    (orderId: string): ChangeRequest | undefined => {
      return (requestsByOrder[orderId] ?? []).find((r) => r.status === 'pending');
    },
    [requestsByOrder]
  );

  /**
   * Vendor proposes changes on a real order. Persists to
   * orders/{orderId}/changeRequests via the real handleChangeRequest
   * callable (Phase 2's order status state machine) - previously this only
   * ever touched local React state, so a vendor's proposed changes never
   * reached the customer's device at all.
   */
  const createChangeRequest = useCallback(
    async (input: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): Promise<void> => {
      const fn = callable<Record<string, unknown>, { success: true; changeRequestId: string }>('handleChangeRequest');
      await fn({
        orderId: input.orderId,
        action: 'create',
        message: input.vendorMessage?.trim() || 'The vendor proposed changes to your order.',
        proposedChanges: {
          items: changesToBackendItems(input.changes),
          changeSummary: input.changes.map(changeToSummary),
        },
      });
    },
    []
  );

  const acceptChangeRequest = useCallback(async (changeRequestId: string, orderId: string, customerChanges?: ChangeRequestChange[]): Promise<void> => {
    const fn = callable<Record<string, unknown>, { success: true; status: string }>('handleChangeRequest');
    await fn({
      orderId,
      action: 'accept',
      changeRequestId,
      customerItems: customerChanges ? changesToBackendItems(customerChanges) : undefined,
    });
  }, []);

  const declineChangeRequest = useCallback(async (changeRequestId: string, orderId: string): Promise<void> => {
    const fn = callable<Record<string, unknown>, { success: true; status: string }>('handleChangeRequest');
    await fn({ orderId, action: 'reject', changeRequestId });
  }, []);

  return useMemo(
    () => ({
      requests,
      subscribeToOrder,
      getRequestForOrder,
      createChangeRequest,
      acceptChangeRequest,
      declineChangeRequest,
    }),
    [requests, subscribeToOrder, getRequestForOrder, createChangeRequest, acceptChangeRequest, declineChangeRequest]
  );
});
