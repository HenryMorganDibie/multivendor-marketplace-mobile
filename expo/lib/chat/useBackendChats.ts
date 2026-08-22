import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { chatService } from '@/services/chatService';
import { mapChatThreadDoc, mapMessageDoc } from './mapChatDoc';
import type { Chat, ChatMessage } from '@/mocks/chatData';

// Was orderBy('createdAt','asc') with no limit, per thread, for EVERY thread
// the signed-in user is in simultaneously — a customer with a dozen vendor
// conversations opened a dozen live listeners, each pulling that thread's
// entire message history just to populate an inbox preview. Reads the most
// recent MESSAGE_PAGE_SIZE messages (descending, reversed below back to
// chronological order) instead. Realtime for new messages is unaffected —
// they land within the most-recent window and this snapshot fires again.
// Loading older messages beyond this window is not built by this pass; the
// screens read whatever chatService.getByIdSync returns, same as before.
const MESSAGE_PAGE_SIZE = 50;

/**
 * Keeps chatService's store filled with the signed-in user's real threads.
 *
 * chatService documents its own store as the seam a Firestore listener should
 * replace, and its public API is what every chat screen already reads. So
 * rather than rewriting those screens, this hydrates the store behind them and
 * they get real conversations without changing.
 *
 * Two levels of listener: one on the threads the user is in, and one per thread
 * on its messages. The nested ones matter — a message arriving has to re-render
 * the open conversation, and a thread document changing does not tell you that.
 *
 * Threads are matched on `participants` rather than on vendorId or customerId
 * separately, so one query serves both sides of the app.
 */
export function useBackendChats(): { ready: boolean } {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Per-thread message unsubscribes, and the latest messages per thread, held
    // outside React state: they change on every message and re-rendering this
    // hook for each one would be pointless work.
    const messageUnsubs = new Map<string, () => void>();
    const messagesByChat = new Map<string, ChatMessage[]>();
    const threadDocs = new Map<string, Record<string, unknown>>();

    let unsubscribeThreads: (() => void) | undefined;

    const push = () => {
      const merged: Chat[] = [];
      for (const [chatId, data] of threadDocs) {
        merged.push(mapChatThreadDoc(chatId, data, messagesByChat.get(chatId) ?? []));
      }
      // Most recent conversation first, which is the order every inbox expects.
      merged.sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));
      chatService.hydrateFromBackend(merged);
    };

    const unsubscribeAuth = auth.onAuthStateChanged((fbUser) => {
      unsubscribeThreads?.();
      messageUnsubs.forEach((fn) => fn());
      messageUnsubs.clear();
      messagesByChat.clear();
      threadDocs.clear();

      if (!fbUser) { setReady(false); return; }

      // mockChats starts pre-seeded with ~20 fixture conversations (module
      // load runs before this listener resolves), and a real signed-in user
      // could see that fixture inbox for a moment before the first snapshot
      // below lands — the same "empty beats fixture" reasoning as the error
      // handler further down, just applied before the wait too, not only
      // after a failure.
      chatService.hydrateFromBackend([]);

      unsubscribeThreads = onSnapshot(
        query(
          collection(db, 'chatThreads'),
          where('participants', 'array-contains', fbUser.uid),
          orderBy('lastMessageAt', 'desc'),
        ),
        (snap) => {
          const live = new Set<string>();

          snap.docs.forEach((d) => {
            live.add(d.id);
            threadDocs.set(d.id, d.data());

            if (!messageUnsubs.has(d.id)) {
              const unsub = onSnapshot(
                query(collection(db, 'chatThreads', d.id, 'messages'), orderBy('createdAt', 'desc'), limit(MESSAGE_PAGE_SIZE)),
                (msgSnap) => {
                  const mapped = msgSnap.docs.map((m) => mapMessageDoc(m.id, m.data()));
                  mapped.reverse(); // desc query, back to ascending chronological order
                  messagesByChat.set(d.id, mapped);
                  push();
                },
                (err) => console.error('[Chat] Message subscription failed:', err),
              );
              messageUnsubs.set(d.id, unsub);
            }
          });

          // A thread the user has left or that was removed: stop listening to
          // its messages, or the listener leaks and keeps billing reads.
          for (const [chatId, unsub] of messageUnsubs) {
            if (!live.has(chatId)) {
              unsub();
              messageUnsubs.delete(chatId);
              messagesByChat.delete(chatId);
              threadDocs.delete(chatId);
            }
          }

          push();
          setReady(true);
        },
        (err) => {
          // An empty inbox beats fixture conversations against people the
          // vendor has never spoken to.
          console.error('[Chat] Thread subscription failed:', err);
          chatService.hydrateFromBackend([]);
          setReady(true);
        },
      );
    });

    return () => {
      unsubscribeThreads?.();
      messageUnsubs.forEach((fn) => fn());
      unsubscribeAuth();
    };
  }, []);

  return { ready };
}
