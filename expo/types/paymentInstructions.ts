/**
 * Mobile types for the Batch 2B `setVendorPaymentInstructions` callable and
 * its `paymentInstructionsCurrent` read document, mirrored exactly from the
 * deployed backend contract (multivendor-marketplace-platform @ bda8cb90ba89a9e52a970a6705d6730a2a7c272c,
 * functions/src/types5.ts / functions/src/vendors/setVendorPaymentInstructions.ts).
 *
 * The request types intentionally have NO countryCode/currencyCode field --
 * those are server-derived and rejected outright if the client sends them.
 * The read-record types DO carry countryCode/currencyCode, since the server
 * stamps them onto what it stores; mobile only ever displays those values,
 * never computes or sends them.
 */

export type RoutingCodeType =
  | 'sort_code'          // UK, Ireland
  | 'routing_number'     // US (ABA)
  | 'transit_number'     // Canada
  | 'institution_number' // Canada (paired with transit_number)
  | 'bsb'                // Australia
  | 'ifsc'               // India
  | 'swift_bic';         // international wire routing, pairs with an account_number for any country

export interface RoutingCode {
  type: RoutingCodeType;
  value: string;
}

export type BankAccountIdentifier =
  | {
      type: 'account_number';
      value: string;
      routing?: RoutingCode[];
    }
  | {
      type: 'iban';
      value: string;
      swiftBic?: string;
    };

export type ContactIdentifier =
  | { type: 'email'; value: string }
  | { type: 'phone'; value: string }; // E.164 once stored by the server

// ─── Request shapes (sent to the callable) ─────────────────────────────────
// No countryCode/currencyCode anywhere below -- server-derived, never client input.

export interface BankTransferDestinationInput {
  type: 'bank_transfer';
  institutionName: string;
  recipientName: string;
  identifier: BankAccountIdentifier;
}

export interface ContactTransferDestinationInput {
  type: 'contact_transfer';
  recipientName: string;
  identifier: ContactIdentifier;
}

export type PaymentDestinationInput = BankTransferDestinationInput | ContactTransferDestinationInput;

export interface SetPaymentInstructionsRequest {
  idempotencyKey: string;
  acceptCash: boolean;
  paymentDestination: PaymentDestinationInput | null;
}

export interface SetPaymentInstructionsResponse {
  success: true;
  recordId: string;
  version: number;
  changed: boolean;
}

// ─── Read shapes (from vendors/{vendorId}/paymentInstructionsCurrent/current) ─
// countryCode/currencyCode ARE present here -- server-stamped, display-only.

export interface BankTransferDestinationRecord {
  type: 'bank_transfer';
  countryCode: string;
  currencyCode: string;
  institutionName: string;
  recipientName: string;
  identifier: BankAccountIdentifier;
}

export interface ContactTransferDestinationRecord {
  type: 'contact_transfer';
  countryCode: string;
  currencyCode: string;
  recipientName: string;
  identifier: ContactIdentifier;
}

export type PaymentDestinationRecord = BankTransferDestinationRecord | ContactTransferDestinationRecord;

/** vendors/{vendorId}/paymentInstructionsCurrent/current. Absence of the document itself means "unconfigured" -- there is no separate boolean for that state. */
export interface PaymentInstructionsCurrentDoc {
  currentRecordId: string;
  currentVersion: number;
  acceptCash: boolean;
  paymentDestination: PaymentDestinationRecord | null;
  updatedAt: unknown; // Firestore Timestamp -- not needed as a display value in 2C.1
}
