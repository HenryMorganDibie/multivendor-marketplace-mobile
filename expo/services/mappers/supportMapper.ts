import type { SupportConversation, SupportMessage } from '@/services/supportService';

/**
 * supportMapper — converts raw support conversation/message records into the
 * role-agnostic support shapes.
 *
 * SCAFFOLD ONLY. Persisted support conversations already match the shape, so
 * this is a defensive normalization layer.
 *
 * TODO(Henry): map Firestore `supportConversations/{uid}` (+ `messages`
 * subcollection) documents into these shapes.
 */
export type RawSupportConversation = Record<string, unknown>;
export type RawSupportMessage = Record<string, unknown>;

export const supportMapper = {
  /** Raw support conversation record → domain `SupportConversation`. */
  fromRaw(raw: RawSupportConversation): SupportConversation {
    const conversation = raw as unknown as SupportConversation;
    return {
      ...conversation,
      conversationType: 'support',
      messages: Array.isArray(conversation.messages) ? conversation.messages : [],
    };
  },

  /** Domain `SupportConversation` → raw record for persistence. */
  toRaw(conversation: SupportConversation): RawSupportConversation {
    return { ...conversation };
  },

  /** Raw support message record → domain `SupportMessage`. */
  messageFromRaw(raw: RawSupportMessage): SupportMessage {
    return raw as unknown as SupportMessage;
  },
};
