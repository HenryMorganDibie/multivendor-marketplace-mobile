import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface VendorQuickReply {
  id: string;
  shortcut: string;
  message: string;
}

// Extracted from the proven subscription that already lived inline in
// expo/app/vendor/chats/[orderId].tsx, so both chat pickers read the same
// vendors/{vendorId}/quickReplies data instead of drifting independently.
export function useVendorQuickReplies(vendorId: string | undefined): { quickReplies: VendorQuickReply[] } {
  const [quickReplies, setQuickReplies] = useState<VendorQuickReply[]>([]);

  useEffect(() => {
    if (!vendorId) {
      setQuickReplies([]);
      return;
    }
    setQuickReplies([]);
    const unsubscribe = onSnapshot(
      query(collection(db, 'vendors', vendorId, 'quickReplies'), orderBy('sortOrder', 'asc')),
      (snap) => {
        setQuickReplies(
          snap.docs.map((d) => {
            const data = d.data();
            const shortcutRaw = String(data.shortcut ?? '');
            return {
              id: d.id,
              shortcut: shortcutRaw.startsWith('/') ? shortcutRaw.slice(1) : shortcutRaw,
              message: (data.message as string) ?? '',
            };
          })
        );
      },
      (err) => console.error('[useVendorQuickReplies] subscription failed:', err)
    );
    return unsubscribe;
  }, [vendorId]);

  return { quickReplies };
}
