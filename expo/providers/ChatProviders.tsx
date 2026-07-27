import React, { ReactNode } from 'react';
import { BlockedUsersProvider } from '@/contexts/BlockedUsersContext';
import { ChatReadProvider } from '@/contexts/ChatReadContext';
import { ChatPrivacyProvider } from '@/contexts/ChatPrivacyContext';
import { InboxProvider } from '@/contexts/InboxContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ContactCardsProvider } from '@/contexts/ContactCardsContext';
import { VendorPushNotificationProvider } from '@/contexts/VendorPushNotificationContext';
import { VendorAwayMessageProvider } from '@/contexts/VendorAwayMessageContext';

interface ChatProvidersProps {
  children: ReactNode;
}

export function ChatProviders({ children }: ChatProvidersProps) {
  return (
    <VendorPushNotificationProvider>
      <VendorAwayMessageProvider>
        <BlockedUsersProvider>
          <ChatReadProvider>
            <ChatPrivacyProvider>
              <InboxProvider>
                <ChatProvider>
                  <ContactCardsProvider>
                    {children}
                  </ContactCardsProvider>
                </ChatProvider>
              </InboxProvider>
            </ChatPrivacyProvider>
          </ChatReadProvider>
        </BlockedUsersProvider>
      </VendorAwayMessageProvider>
    </VendorPushNotificationProvider>
  );
}
