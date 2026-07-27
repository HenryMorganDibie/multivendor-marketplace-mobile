import { mockVendor, mockVendors } from '@/mocks/vendorData';
import { mockOrders, type Order } from '@/mocks/ordersData';
import { getCurrencyFromCountryCode } from '@/utils/formatPrice';

export type PaymentMethodType =
  | 'bank_transfer'
  | 'interac'
  | 'e_transfer'
  | 'mobile_money'
  | 'mobile_wallet'
  | 'cash'
  | 'cash_app'
  | 'phone_payment'
  | 'other';

export type PaymentMethodStatus =
  | 'pending_review'
  | 'active'
  | 'rejected'
  | 'disabled';

export interface PaymentMethod {
  id: string;
  vendorId: string;
  type: PaymentMethodType;
  label: string;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  maskedIdentifier?: string;
  status: PaymentMethodStatus;
  isPrimary: boolean;
  createdAt: string;
  approvedAt?: string;
}

export type PaymentRequestSnapshotStatus =
  | 'active'
  | 'resent'
  | 'replaced'
  | 'cancelled';

export interface PaymentRequestSnapshot {
  id: string;
  orderId: string;
  vendorId: string;
  customerId: string;
  selectedPaymentMethodId: string;
  methodType: PaymentMethodType;
  methodLabel: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  maskedIdentifier?: string;
  amount: number;
  currency: string;
  status: PaymentRequestSnapshotStatus;
  sentAt: string;
  resentAt?: string;
  replacedAt?: string;
  replacedBySnapshotId?: string;
}

export interface PaymentProofRecord {
  id: string;
  orderId: string;
  paymentRequestSnapshotId: string;
  files: { id: string; uri: string; mimeType: string; name?: string }[];
  note?: string;
  submittedAt: string;
  customerId: string;
}

const snapshots: Map<string, PaymentRequestSnapshot> = new Map();
const paymentProofs: Map<string, PaymentProofRecord> = new Map();

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getVendorPaymentMethods(vendorId: string): PaymentMethod[] {
  const vendor = mockVendors.find((v) => v.id === vendorId) ?? mockVendor;
  const methods: PaymentMethod[] = [];
  if (vendor.primaryPaymentMethod) {
    methods.push({
      id: `pm-${vendor.id}-primary`,
      vendorId: vendor.id,
      type: (vendor.primaryPaymentMethod.type as PaymentMethodType) ?? 'other',
      label: vendor.primaryPaymentMethod.name ?? 'Primary',
      accountName: vendor.primaryPaymentMethod.details?.accountName,
      accountNumber: vendor.primaryPaymentMethod.details?.accountNumber,
      bankName: vendor.primaryPaymentMethod.details?.bankName,
      maskedIdentifier: vendor.primaryPaymentMethod.details?.accountNumber
        ? `****${String(vendor.primaryPaymentMethod.details.accountNumber).slice(-4)}`
        : undefined,
      status: (vendor.primaryPaymentMethod as { status?: PaymentMethodStatus }).status ?? 'active',
      isPrimary: true,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    });
  }
  if (vendor.secondaryPaymentMethod) {
    methods.push({
      id: `pm-${vendor.id}-secondary`,
      vendorId: vendor.id,
      type: (vendor.secondaryPaymentMethod.type as PaymentMethodType) ?? 'other',
      label: vendor.secondaryPaymentMethod.name ?? 'Secondary',
      accountName: vendor.secondaryPaymentMethod.details?.accountName,
      accountNumber: vendor.secondaryPaymentMethod.details?.accountNumber,
      bankName: vendor.secondaryPaymentMethod.details?.bankName,
      maskedIdentifier: vendor.secondaryPaymentMethod.details?.accountNumber
        ? `****${String(vendor.secondaryPaymentMethod.details.accountNumber).slice(-4)}`
        : undefined,
      status: (vendor.secondaryPaymentMethod as { status?: PaymentMethodStatus }).status ?? 'active',
      isPrimary: false,
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    });
  }
  return methods;
}

export function getActivePaymentMethods(vendorId: string): PaymentMethod[] {
  return getVendorPaymentMethods(vendorId).filter((m) => m.status === 'active');
}

export function createPaymentRequestSnapshot(input: {
  orderId: string;
  vendorId: string;
  customerId: string;
  method: PaymentMethod;
  amount: number;
  currency: string;
}): PaymentRequestSnapshot {
  const snapshot: PaymentRequestSnapshot = {
    id: makeId('prs'),
    orderId: input.orderId,
    vendorId: input.vendorId,
    customerId: input.customerId,
    selectedPaymentMethodId: input.method.id,
    methodType: input.method.type,
    methodLabel: input.method.label,
    bankName: input.method.bankName,
    accountName: input.method.accountName,
    accountNumber: input.method.accountNumber,
    maskedIdentifier: input.method.maskedIdentifier,
    amount: input.amount,
    currency: input.currency,
    status: 'active',
    sentAt: new Date().toISOString(),
  };
  snapshots.set(snapshot.id, snapshot);
  console.log('[paymentRequestService] Created snapshot', snapshot.id);
  return snapshot;
}

export function getActiveSnapshotForOrder(
  orderId: string,
  order?: Order | null,
): PaymentRequestSnapshot | null {
  for (const s of snapshots.values()) {
    if (s.orderId === orderId && s.status === 'active') return s;
  }
  const found = order ?? mockOrders.find((o) => o.id === orderId) ?? null;
  if (!found) return null;
  const isUnpaid =
    found.paymentStatus !== 'payment_received' &&
    found.paymentState !== 'VENDOR_PAYMENT_CONFIRMED' &&
    found.paymentState !== 'ORDER_READY' &&
    found.paymentState !== 'ORDER_COMPLETED';
  const isActiveStatus = ['accepted', 'confirmed', 'in_progress'].includes(found.status);
  if (!isUnpaid || !isActiveStatus) return null;
  const vendorListed = mockVendors.find((v) => v.id === found.vendorId);
  const vendor = vendorListed ?? mockVendor;
  const pm = vendor.primaryPaymentMethod ?? mockVendor.primaryPaymentMethod;
  if (!pm) return null;
  const fallback: PaymentRequestSnapshot = {
    id: `prs-fallback-${found.id}`,
    orderId: found.id,
    vendorId: found.vendorId,
    customerId: found.customerId ?? 'customer-001',
    selectedPaymentMethodId: `pm-${vendor.id}-primary`,
    methodType: (pm.type as PaymentMethodType) ?? 'other',
    methodLabel: pm.name ?? 'Primary',
    bankName: pm.details?.bankName,
    accountName: pm.details?.accountName,
    accountNumber: pm.details?.accountNumber,
    maskedIdentifier: pm.details?.accountNumber
      ? `****${String(pm.details.accountNumber).slice(-4)}`
      : undefined,
    amount: (found.adjustedTotal ?? found.total) - (found.amountPaid ?? 0),
    currency:
      (vendor.currency as string) ||
      getCurrencyFromCountryCode(vendor.countryCode || 'NG'),
    status: 'active',
    sentAt: new Date().toISOString(),
  };
  console.log('[paymentRequestService] Using fallback snapshot for order', found.id);
  return fallback;
}

export function markSnapshotResent(snapshotId: string): PaymentRequestSnapshot | null {
  const s = snapshots.get(snapshotId);
  if (!s) return null;
  s.status = 'resent';
  s.resentAt = new Date().toISOString();
  console.log('[paymentRequestService] Resent snapshot', snapshotId);
  return s;
}

export function replaceSnapshot(
  previousSnapshotId: string,
  input: {
    orderId: string;
    vendorId: string;
    customerId: string;
    method: PaymentMethod;
    amount: number;
    currency: string;
  }
): PaymentRequestSnapshot | null {
  const prev = snapshots.get(previousSnapshotId);
  if (!prev) return null;
  const next = createPaymentRequestSnapshot(input);
  prev.status = 'replaced';
  prev.replacedAt = new Date().toISOString();
  prev.replacedBySnapshotId = next.id;
  console.log('[paymentRequestService] Replaced snapshot', previousSnapshotId, '->', next.id);
  return next;
}

export function submitPaymentProof(input: {
  orderId: string;
  paymentRequestSnapshotId: string;
  customerId: string;
  files: { id: string; uri: string; mimeType: string; name?: string }[];
  note?: string;
}): PaymentProofRecord {
  if (input.files.length < 1) {
    throw new Error('At least one proof file is required');
  }
  if (input.files.length > 5) {
    throw new Error('Maximum 5 proof files allowed');
  }
  const record: PaymentProofRecord = {
    id: makeId('proof'),
    orderId: input.orderId,
    paymentRequestSnapshotId: input.paymentRequestSnapshotId,
    files: input.files,
    note: input.note,
    submittedAt: new Date().toISOString(),
    customerId: input.customerId,
  };
  paymentProofs.set(record.id, record);
  console.log('[paymentRequestService] Submitted proof', record.id);
  return record;
}

export function getProofsForOrder(orderId: string): PaymentProofRecord[] {
  const out: PaymentProofRecord[] = [];
  for (const p of paymentProofs.values()) if (p.orderId === orderId) out.push(p);
  return out;
}

export const ACCEPTED_PROOF_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const;
export const MAX_PROOF_FILES = 5;
