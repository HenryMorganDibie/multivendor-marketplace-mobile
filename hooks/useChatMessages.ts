import { useEffect, useState } from 'react';
import { chatService } from '@/services/chatService';
import type { Chat, ChatMessage } from '@/mocks/chatData';

/**
 * Subscribes to chatService writes for a specific chatId and returns a
 * monotonically increasing version counter alongside the latest chat
 * snapshot. Screens can use the version to drive re-renders, and the
 * snapshot to read the freshest `messages` array directly.
 *
 * Firebase migration: replace the subscribe body with `onSnapshot` on the
 * chat document; the hook's return shape stays the same.
 */
export function useChatSubscription(chatId: string | undefined): {
  version: number;
  chat: Chat | undefined;
} {
  const [version, setVersion] = useState<number>(() =>
    chatId ? chatService.getVersion(chatId) : 0
  );

  useEffect(() => {
    if (!chatId) return;
    setVersion(chatService.getVersion(chatId));
    const unsubscribe = chatService.subscribe(chatId, () => {
      setVersion(v => v + 1);
    });
    return unsubscribe;
  }, [chatId]);

  const chat = chatId ? chatService.getByIdSync(chatId) : undefined;
  return { version, chat };
}

/**
 * Merges incoming chatService messages into an existing local message list.
 *
 * - Preserves locally-synthesized messages (e.g. system status headers) that
 *   aren't backed by chatService.
 * - Replaces in place any local message whose id matches a store message
 *   (so future writes can update fields like `status` without dup-ing rows).
 * - Appends new store messages that aren't present locally, in their store
 *   order, so reply / contact-card / catalog item bubbles flow naturally.
 * - Skips ids listed in `hiddenIds` to honor in-session clear-chat actions.
 */
export function mergeChatMessages(
  prev: ChatMessage[],
  incoming: ChatMessage[],
  hiddenIds?: ReadonlySet<string>
): ChatMessage[] {
  if (incoming.length === 0) return prev;

  const incomingById = new Map<string, ChatMessage>(
    incoming.map(m => [m.id, m])
  );
  const seen = new Set<string>();
  const next: ChatMessage[] = [];

  for (const msg of prev) {
    if (hiddenIds?.has(msg.id)) {
      seen.add(msg.id);
      continue;
    }
    const fresh = incomingById.get(msg.id);
    next.push(fresh ?? msg);
    seen.add(msg.id);
  }

  for (const msg of incoming) {
    if (seen.has(msg.id)) continue;
    if (hiddenIds?.has(msg.id)) continue;
    next.push(msg);
  }

  return next;
}
