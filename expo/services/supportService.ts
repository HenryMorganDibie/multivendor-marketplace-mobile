import type { UserRole } from '@/types/domain';

/**
 * supportService — single boundary for the platform Support conversation.
 *
 * SCAFFOLD ONLY. Reads the same AsyncStorage records that
 * `CustomerSupportChatContext` / `VendorSupportChatContext` own. Those contexts
 * stay the live, reactive source for the support chat UI; this service is the
 * stable async API Henry will repoint at Firestore
 * (`supportConversations/{uid}/messages`).
 *
 * Support is one of the four conversation kinds in the backend model
 * (inquiry, order, AI help, support).
 *
 * TODO(Henry): back these with Firestore support conversations + an agent inbox.
 */
import { supportRepository } from '@/services/repositories/supportRepository';

/**
 * Role-agnostic support message shape. Customer and vendor support contexts
 * each declare their own `SupportMessage` (differing only in the `sender`
 * union); this service uses the superset so it can read/write either feed.
 */
export interface SupportMessage {
  id: string;
  type: 'text' | 'system';
  content: string;
  sender: 'customer' | 'vendor' | 'support' | 'system';
  timestamp: string;
}

export interface SupportConversation {
  id: string;
  conversationType: 'support';
  createdAt: string;
  lastActivityAt: string;
  messages: SupportMessage[];
  isActive: boolean;
}

export const supportService = {
  /** Returns the support conversation for the given audience, or null. */
  async getConversation(role: UserRole): Promise<SupportConversation | null> {
    return supportRepository.read(role);
  },

  /** Returns the messages in the support conversation. */
  async getMessages(role: UserRole): Promise<SupportMessage[]> {
    const conversation = await this.getConversation(role);
    return conversation?.messages ?? [];
  },

  /**
   * Appends a customer/vendor message to the support conversation.
   * TODO(Henry): write to Firestore and notify the support agent inbox.
   */
  async sendMessage(role: UserRole, content: string): Promise<SupportMessage | null> {
    try {
      const conversation = await this.getConversation(role);
      if (!conversation) {
        console.error('[supportService] No support conversation to append to');
        return null;
      }
      const message: SupportMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'text',
        content,
        sender: role === 'vendor' ? 'vendor' : 'customer',
        timestamp: new Date().toISOString(),
      };
      const updated: SupportConversation = {
        ...conversation,
        messages: [...conversation.messages, message],
        lastActivityAt: message.timestamp,
      };
      await supportRepository.write(role, updated);
      return message;
    } catch (error) {
      console.error('[supportService] Failed to send message:', error);
      return null;
    }
  },
};
