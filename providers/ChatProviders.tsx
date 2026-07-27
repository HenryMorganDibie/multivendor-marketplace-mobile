import React, { ReactNode } from 'react';
import { BlockedUsersProvider } from '@/contexts/BlockedUsersContext';
import { ChatPrivacyProvider } from '@/contexts/ChatPrivacyContext';
import { ChatReadProvider } from '@/contexts/ChatReadContext';
import { ContactCardsProvider } from '@/contexts/ContactCardsContext';
import { InboxProvider } from '@/contexts/InboxContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { AuditLogProvider } from '@/contexts/AuditLogContext';
import { ChangeRequestsProvider } from '@/contexts/ChangeRequestsContext';

interface ChatProvidersProps {
  children: ReactNode;
}

export function ChatProviders({ children }: ChatProvidersProps) {
  console.log('[ChatProviders] Mounting chat provider tree');
  return (
    <BlockedUsersProvider>
      <ChatPrivacyProvider>
        <ChatReadProvider>
          <ContactCardsProvider>
            <InboxProvider>
              <ChatProvider>
                <AuditLogProvider>
                  <ChangeRequestsProvider>
                    {children}
                  </ChangeRequestsProvider>
                </AuditLogProvider>
              </ChatProvider>
            </InboxProvider>
          </ContactCardsProvider>
        </ChatReadProvider>
      </ChatPrivacyProvider>
    </BlockedUsersProvider>
  );
}
