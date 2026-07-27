import { useMemo } from 'react';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';

interface BlockGuardResult {
  canInitiateChat: boolean;
  canCreateDraft: boolean;
  canSubmitOrder: boolean;
  canUseAI: boolean;
  isBlocked: boolean;
  isMutualBlock: boolean;
}

export function useBlockGuard(currentUserId: string, targetUserId: string): BlockGuardResult {
  const { isUserBlocked } = useBlockedUsers();

  return useMemo(() => {
    const currentBlockedTarget = isUserBlocked(targetUserId);
    const targetBlockedCurrent = isUserBlocked(currentUserId);
    const isMutualBlock = currentBlockedTarget && targetBlockedCurrent;
    const isBlocked = currentBlockedTarget || targetBlockedCurrent;

    return {
      canInitiateChat: !isBlocked,
      canCreateDraft: !isBlocked,
      canSubmitOrder: !isBlocked,
      canUseAI: !isBlocked,
      isBlocked,
      isMutualBlock,
    };
  }, [currentUserId, targetUserId, isUserBlocked]);
}
