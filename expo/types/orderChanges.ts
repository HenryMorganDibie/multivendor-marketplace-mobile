export interface OrderChangeItem {
  itemId: string;
  name: string;
  originalQty: number;
  newQty: number;
  removed: boolean;
  originalPrice: number;
  newPrice: number;
}

export type ChangeRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export interface OrderChangeRequest {
  orderId: string;
  vendorId: string;
  changes: OrderChangeItem[];
  oldTotal: number;
  newTotal: number;
  reason: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
}
