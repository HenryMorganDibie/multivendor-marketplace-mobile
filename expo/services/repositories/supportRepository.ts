import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserRole } from '@/types/domain';
import type { SupportConversation } from '@/services/supportService';

/**
 * supportRepository — data-access boundary for the platform Support conversation.
 *
 * SCAFFOLD ONLY. Reads/writes the same AsyncStorage records the support contexts
 * own (`customer_support_chat`, `vendor_support_chat`). supportService delegates
 * here; the contexts remain the live, reactive source for the support chat UI.
 *
 * TODO(Henry): replace with Firestore support conversations + an agent inbox.
 */
const CUSTOMER_STORAGE_KEY = 'customer_support_chat';
const VENDOR_STORAGE_KEY = 'vendor_support_chat';

function storageKey(role: UserRole): string {
  return role === 'vendor' ? VENDOR_STORAGE_KEY : CUSTOMER_STORAGE_KEY;
}

export const supportRepository = {
  /** Raw support conversation for an audience, or null. */
  async read(role: UserRole): Promise<SupportConversation | null> {
    try {
      const stored = await AsyncStorage.getItem(storageKey(role));
      return stored ? (JSON.parse(stored) as SupportConversation) : null;
    } catch (error) {
      console.error('[supportRepository] Failed to read conversation:', error);
      return null;
    }
  },

  /** Persists the support conversation for an audience. */
  async write(role: UserRole, conversation: SupportConversation): Promise<void> {
    try {
      await AsyncStorage.setItem(storageKey(role), JSON.stringify(conversation));
    } catch (error) {
      console.error('[supportRepository] Failed to write conversation:', error);
    }
  },
};
