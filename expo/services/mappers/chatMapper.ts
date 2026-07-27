import type { Chat, ChatMessage, ConversationType } from '@/types/domain';
import { normalizeChatType } from '@/mocks/chatData';

/**
 * chatMapper — converts raw chat/message records into domain chat types and
 * normalizes the conversation type to the backend's four kinds.
 *
 * SCAFFOLD ONLY. Mock chats already match `Chat`, so `fromRaw` mainly
 * normalizes the legacy chat-type vocabulary into the canonical
 * `ConversationType` (pre_order_inquiry, order_chat, ai_help, support).
 *
 * TODO(Henry): map Firestore `conversations/{conversationId}` (+ `messages`
 * subcollection) documents into these shapes.
 */
export type RawChat = Record<string, unknown>;
export type RawChatMessage = Record<string, unknown>;

export const chatMapper = {
  /** Raw chat record → domain `Chat` (with normalized conversation type). */
  fromRaw(raw: RawChat): Chat {
    const chat = raw as unknown as Chat;
    return {
      ...chat,
      chatType: normalizeChatType(chat.chatType) as Chat['chatType'],
      messages: Array.isArray(chat.messages) ? chat.messages : [],
    };
  },

  /** Domain `Chat` → raw record for persistence. */
  toRaw(chat: Chat): RawChat {
    return { ...chat };
  },

  /** Raw message record → domain `ChatMessage`. */
  messageFromRaw(raw: RawChatMessage): ChatMessage {
    return raw as unknown as ChatMessage;
  },

  /** The chat's conversation kind in canonical form. */
  conversationType(chat: Chat): ConversationType {
    return normalizeChatType(chat.chatType) as ConversationType;
  },
};
