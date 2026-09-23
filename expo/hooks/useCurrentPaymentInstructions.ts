import { useEffect, useState } from 'react';
import { doc, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { PaymentInstructionsCurrentDoc } from '@/types/paymentInstructions';

export interface UseCurrentPaymentInstructionsResult {
  data: PaymentInstructionsCurrentDoc | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Light structural guard on the raw snapshot payload -- not a re-
 * implementation of the backend's own validation (that authority stays
 * server-side), just enough to avoid treating a malformed/partial document
 * as a trustworthy PaymentInstructionsCurrentDoc downstream.
 */
function isPaymentInstructionsCurrentDoc(value: DocumentData): value is PaymentInstructionsCurrentDoc {
  return (
    typeof value.currentRecordId === 'string' &&
    typeof value.currentVersion === 'number' &&
    typeof value.acceptCash === 'boolean' &&
    (value.paymentDestination === null || typeof value.paymentDestination === 'object')
  );
}

/**
 * Owner-scoped live read of vendors/{vendorId}/paymentInstructionsCurrent/current.
 *
 * Deliberately its own hook, not merged into VendorContext: this is a
 * private, sensitive subcollection the backend keeps separate from the
 * public-ish vendor document on purpose (see firestore.rules), and nothing
 * about the broader app's vendor-identity resolution needs this data.
 *
 * The document not existing at all is a valid, expected state -- "never
 * configured" -- not an error. Only a real read failure (permission,
 * network, malformed payload) populates `error`.
 */
export function useCurrentPaymentInstructions(
  vendorId: string | undefined
): UseCurrentPaymentInstructionsResult {
  const [data, setData] = useState<PaymentInstructionsCurrentDoc | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!vendorId) {
      setData(null);
      setLoading(true);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const ref = doc(db, 'vendors', vendorId, 'paymentInstructionsCurrent', 'current');
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          // Unconfigured -- not an error.
          setData(null);
          setError(null);
          setLoading(false);
          return;
        }
        const raw = snap.data();
        if (!isPaymentInstructionsCurrentDoc(raw)) {
          setData(null);
          setError(new Error('Payment instructions data is in an unexpected format.'));
          setLoading(false);
          return;
        }
        setData(raw);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setData(null);
        setError(err instanceof Error ? err : new Error('Could not load payment instructions.'));
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [vendorId]);

  return { data, loading, error };
}
