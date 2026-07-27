import { Chat, mockChats } from '@/mocks/chatData';

/**
 * chatRepository — data-access boundary for chats/conversations.
 *
 * SCAFFOLD ONLY. Operates on the SHARED `mockChats` array reference so the
 * lookup helpers in `mocks/chatData.ts` see writes immediately (the existing
 * in-place mutation contract). chatService keeps its pub/sub layer and delegates
 * raw reads/mutations here.
 *
 * TODO(Henry): replace with Firestore `conversations/{conversationId}` reads +
 * a `messages` subcollection. Keep the method names stable.
 */
const chats: Chat[] = mockChats;

export const chatRepository = {
  /** Shared chat-store reference. */
  all(): Chat[] {
    return chats;
  },

  /** Synchronous lookup by id. */
  findById(chatId: string): Chat | undefined {
    return chats.find((c) => c.id === chatId);
  },

  /** Appends a chat to the shared store. */
  insert(chat: Chat): Chat {
    chats.push(chat);
    return chat;
  },
};
