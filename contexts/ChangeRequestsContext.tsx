import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo } from 'react';
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

export const [ChangeRequestsProvider, useChangeRequests] = createContextHook(() => {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);

  const getRequestForOrder = useCallback(
    (orderId: string): ChangeRequest | undefined => {
      return requests.find((r) => r.orderId === orderId && r.status === 'pending');
    },
    [requests]
  );

  const createChangeRequest = useCallback(
    (input: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): ChangeRequest => {
      const newRequest: ChangeRequest = {
        ...input,
        id: `cr_${Date.now()}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      console.log('[ChangeRequests] Created request:', newRequest.id, 'for order:', input.orderId);
      setRequests((prev) => [...prev, newRequest]);
      return newRequest;
    },
    []
  );

  const acceptChangeRequest = useCallback((requestId: string, customerChanges?: ChangeRequestChange[]): boolean => {
    let found = false;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          found = true;
          const updated: ChangeRequest = {
            ...r,
            status: 'accepted' as ChangeRequestStatus,
          };
          if (customerChanges) {
            updated.changes = customerChanges;
            let proposedTotal = r.originalTotal;
            for (const change of customerChanges) {
              if (change.action === 'remove') {
                proposedTotal -= change.originalItem.price * change.originalItem.quantity;
              } else if (change.action === 'adjust_quantity' && change.newQuantity !== undefined) {
                const diff = change.newQuantity - change.originalItem.quantity;
                proposedTotal += diff * change.originalItem.price;
              } else if (change.action === 'replace' && change.replacementItem) {
                proposedTotal -= change.originalItem.price * change.originalItem.quantity;
                proposedTotal += change.replacementItem.price * (change.newQuantity ?? change.originalItem.quantity);
              }
            }
            updated.proposedTotal = Math.max(0, proposedTotal);
          }
          return updated;
        }
        return r;
      })
    );
    console.log('[ChangeRequests] Accepted:', requestId, customerChanges ? 'with customer modifications' : '');
    return found;
  }, []);

  const declineChangeRequest = useCallback((requestId: string): boolean => {
    let found = false;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          found = true;
          return { ...r, status: 'declined' as ChangeRequestStatus };
        }
        return r;
      })
    );
    console.log('[ChangeRequests] Declined:', requestId);
    return found;
  }, []);

  const clearRequestForOrder = useCallback((orderId: string) => {
    setRequests((prev) => prev.filter((r) => r.orderId !== orderId));
  }, []);

  return useMemo(
    () => ({
      requests,
      getRequestForOrder,
      createChangeRequest,
      acceptChangeRequest,
      declineChangeRequest,
      clearRequestForOrder,
    }),
    [requests, getRequestForOrder, createChangeRequest, acceptChangeRequest, declineChangeRequest, clearRequestForOrder]
  );
});
