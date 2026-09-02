import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BlockedUser {
  id: string;
  name: string;
  role: 'customer' | 'vendor';
  chatId: string;
  blockedAt: string;
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
}

const BlockedUsersContext = createContext<BlockedUsersContextType | undefined>(undefined);

const BLOCKED_USERS_KEY = '@platform_blocked_users';
const ARCHIVED_CHATS_KEY = '@platform_archived_chats';

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
    setBlockedUsers((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) return prev;
      return [...prev, user];
    });

    setArchivedChats((prev) => {
      const exists = prev.find((c) => c.chatId === user.chatId);
      if (exists) return prev;
      return [...prev, { chatId: user.chatId, archivedAt: new Date().toISOString(), reason: 'blocked' as const }];
    });
    console.log('User blocked:', user);
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
};

export function useBlockedUsers(): BlockedUsersContextType {
  const context = useContext(BlockedUsersContext);
  if (context === undefined) {
    console.warn('[useBlockedUsers] Used outside BlockedUsersProvider — returning defaults');
    return defaultBlockedUsersContext;
  }
  return context;
}
