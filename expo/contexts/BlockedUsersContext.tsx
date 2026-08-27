import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';

export type BlockDirection = 'self' | 'other';

export interface BlockedUser {
  id: string;
  name: string;
  role: 'customer' | 'vendor';
  chatId: string;
  blockedAt: string;
  /** Who initiated the block. 'self' = current user blocked them. 'other' = they blocked current user. */
  direction?: BlockDirection;
  /** Optional backend document ID. Kept for future backend reconciliation. */
  backendId?: string;
}

/** Backend payload shape Henry will expose. The context maps this to the local BlockedUser shape. */
export interface BlockedUserBackendRecord {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  blockedUserRole: 'customer' | 'vendor';
  chatId: string;
  blockedAt: string;
  /** Whether the current user is the blocker. */
  isBlocker: boolean;
}

export interface ArchivedChat {
  chatId: string;
  archivedAt: string;
  reason: 'manual' | 'blocked';
}

interface BlockedUsersContextType {
  blockedUsers: BlockedUser[];
  archivedChats: ArchivedChat[];
  blockUser: (user: BlockedUser) => void;
  unblockUser: (userId: string) => void;
  archiveChat: (chatId: string, reason: 'manual' | 'blocked') => void;
  unarchiveChat: (chatId: string) => void;
  isUserBlocked: (userId: string) => boolean;
  isChatArchived: (chatId: string) => boolean;
  getBlockedUserByChatId: (chatId: string) => BlockedUser | undefined;
  /**
   * Backend-ready loader. When Henry exposes the real endpoint, swap this
   * implementation to fetch from the network and replace local storage.
   * Until then, it remains a no-op surface.
   */
  loadBlockedUsersFromBackend: (records: BlockedUserBackendRecord[]) => Promise<void>;
}

const BlockedUsersContext = createContext<BlockedUsersContextType | undefined>(undefined);

const BLOCKED_USERS_KEY = '@the platform_blocked_users';
const ARCHIVED_CHATS_KEY = '@the platform_archived_chats';

export function BlockedUsersProvider({ children }: { children: React.ReactNode }) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [archivedChats, setArchivedChats] = useState<ArchivedChat[]>([]);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoadedRef.current) return;
    const save = async () => {
      try {
        await Promise.all([
          AsyncStorage.setItem(BLOCKED_USERS_KEY, JSON.stringify(blockedUsers)),
          AsyncStorage.setItem(ARCHIVED_CHATS_KEY, JSON.stringify(archivedChats)),
        ]);
      } catch (error) {
        console.error('Error saving blocked users data:', error);
      }
    };
    save();
  }, [blockedUsers, archivedChats]);

  const loadData = async () => {
    try {
      const [blockedData, archivedData] = await Promise.all([
        AsyncStorage.getItem(BLOCKED_USERS_KEY),
        AsyncStorage.getItem(ARCHIVED_CHATS_KEY),
      ]);

      if (blockedData) {
        setBlockedUsers(JSON.parse(blockedData));
      }
      if (archivedData) {
        setArchivedChats(JSON.parse(archivedData));
      }
      isLoadedRef.current = true;
    } catch (error) {
      console.error('Error loading blocked users data:', error);
      isLoadedRef.current = true;
    }
  };

  const blockUser = useCallback((user: BlockedUser) => {
    const normalized: BlockedUser = { ...user, direction: user.direction ?? 'self' };
    setBlockedUsers((prev) => {
      const exists = prev.find((u) => u.id === normalized.id);
      if (exists) return prev;
      return [...prev, normalized];
    });

    setArchivedChats((prev) => {
      const exists = prev.find((c) => c.chatId === normalized.chatId);
      if (exists) return prev;
      return [...prev, { chatId: normalized.chatId, archivedAt: new Date().toISOString(), reason: 'blocked' as const }];
    });
    console.log('User blocked:', normalized);

    // This local record used to be the whole story: the real blockUser
    // callable (and the send-message block check behind it) already existed
    // server-side and worked correctly, but was never called, so a "blocked"
    // user could still message the blocker — the app just hid it locally.
    if (auth.currentUser && normalized.direction === 'self') {
      const call = callable<{ blockedUid: string; reason?: string }, { success: true; blockId: string }>('blockUser');
      call({ blockedUid: normalized.id }).catch((err) =>
        console.error('[BlockedUsers] blockUser callable failed:', err)
      );
    }
  }, []);

  const unblockUser = useCallback((userId: string) => {
    setBlockedUsers((prev) => {
      const user = prev.find((u) => u.id === userId);
      if (user) {
        setArchivedChats((prevChats) => prevChats.filter((c) => c.chatId !== user.chatId));
      }
      return prev.filter((u) => u.id !== userId);
    });
    console.log('User unblocked:', userId);

    if (auth.currentUser) {
      const call = callable<{ blockedUid: string }, { success: true }>('unblockUser');
      call({ blockedUid: userId }).catch((err) =>
        console.error('[BlockedUsers] unblockUser callable failed:', err)
      );
    }
  }, []);

  const archiveChat = useCallback((chatId: string, reason: 'manual' | 'blocked') => {
    setArchivedChats((prev) => {
      const exists = prev.find((c) => c.chatId === chatId);
      if (exists) return prev;
      return [...prev, { chatId, archivedAt: new Date().toISOString(), reason }];
    });
    console.log('Chat archived:', chatId, reason);
  }, []);

  const unarchiveChat = useCallback((chatId: string) => {
    setArchivedChats((prev) => prev.filter((c) => c.chatId !== chatId));
    console.log('Chat unarchived:', chatId);
  }, []);

  const isUserBlocked = useCallback((userId: string): boolean => {
    return blockedUsers.some((u) => u.id === userId);
  }, [blockedUsers]);

  const isChatArchived = useCallback((chatId: string): boolean => {
    return archivedChats.some((c) => c.chatId === chatId);
  }, [archivedChats]);

  const getBlockedUserByChatId = useCallback((chatId: string): BlockedUser | undefined => {
    return blockedUsers.find((u) => u.chatId === chatId);
  }, [blockedUsers]);

  const loadBlockedUsersFromBackend = useCallback(async (records: BlockedUserBackendRecord[]) => {
    const mapped: BlockedUser[] = records.map((r) => ({
      id: r.blockedUserId,
      name: r.blockedUserName,
      role: r.blockedUserRole,
      chatId: r.chatId,
      blockedAt: r.blockedAt,
      direction: r.isBlocker ? 'self' : 'other',
      backendId: r.id,
    }));
    setBlockedUsers(mapped);
    isLoadedRef.current = true;
  }, []);

  // The blocks collection is real (functions/src/blocks/blockFunctions.ts) and
  // firestore.rules already allows a signed-in user to read their own
  // blockerUid rows (`allow read: if ... request.auth.uid == resource.data.blockerUid`)
  // - only the AsyncStorage-only read path (above) was ever wired up, so a
  // block placed on another device, or restored after a reinstall, never
  // showed here even though the block itself was real and enforced server-side.
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'blocks'), where('blockerUid', '==', uid), where('isActive', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const records: BlockedUserBackendRecord[] = snap.docs.map((d) => {
        const data = d.data() as {
          blockedUid: string; blockedRole: 'customer' | 'vendor';
          vendorId?: string | null; customerId?: string | null;
          blockedSnapshot: { displayName: string; businessName: string | null };
          blockedAt: { toDate?: () => Date } | null;
        };
        // Deterministic commerce thread id, same convention
        // createCommerceConversation.ts uses to name the thread doc.
        const chatId = data.customerId && data.vendorId ? `commerce_${data.customerId}_${data.vendorId}` : '';
        return {
          id: d.id,
          blockedUserId: data.blockedUid,
          blockedUserName: data.blockedSnapshot.businessName ?? data.blockedSnapshot.displayName,
          blockedUserRole: data.blockedRole,
          chatId,
          blockedAt: data.blockedAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          isBlocker: true,
        };
      });
      loadBlockedUsersFromBackend(records);
    }, (error) => console.error('[BlockedUsers] blocks listener failed:', error));
    return unsubscribe;
  }, [loadBlockedUsersFromBackend]);

  return (
    <BlockedUsersContext.Provider
      value={{
        blockedUsers,
        archivedChats,
        blockUser,
        unblockUser,
        archiveChat,
        unarchiveChat,
        isUserBlocked,
        isChatArchived,
        getBlockedUserByChatId,
        loadBlockedUsersFromBackend,
      }}
    >
      {children}
    </BlockedUsersContext.Provider>
  );
}

const defaultBlockedUsersContext: BlockedUsersContextType = {
  blockedUsers: [],
  archivedChats: [],
  blockUser: () => {},
  unblockUser: () => {},
  archiveChat: () => {},
  unarchiveChat: () => {},
  isUserBlocked: () => false,
  isChatArchived: () => false,
  getBlockedUserByChatId: () => undefined,
  loadBlockedUsersFromBackend: async () => {},
};

export function useBlockedUsers(): BlockedUsersContextType {
  const context = useContext(BlockedUsersContext);
  if (context === undefined) {
    console.warn('[useBlockedUsers] Used outside BlockedUsersProvider — returning defaults');
    return defaultBlockedUsersContext;
  }
  return context;
}
