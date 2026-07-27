import React, { type ReactNode, useEffect, useState } from 'react';
import { VendorProviders } from './VendorProviders';
import { CustomerProviders } from './CustomerProviders';
import { DiscoveryProviders } from './DiscoveryProviders';
import { ChatProviders } from './ChatProviders';
import { CustomerNotificationProvider } from '@/contexts/CustomerNotificationContext';
import { VendorRelationshipProvider } from '@/contexts/VendorRelationshipContext';
import { VendorFilterProvider } from '@/contexts/VendorFilterContext';
import { CustomerSupportChatProvider } from '@/contexts/CustomerSupportChatContext';
import { VendorSupportChatProvider } from '@/contexts/VendorSupportChatContext';

interface Props {
  children: ReactNode;
}

/**
 * Mounts Discovery + Chat providers immediately (needed for initial route render),
 * then defers the heavy Vendor + Customer trees (~28 providers) until after the
 * first frame so the Rork preview doesn't hit the 6000ms timeout.
 *
 * All notification providers (push, quiet-hours, etc.) live inside their
 * respective Vendor / Customer / Chat trees — no separate wrapper needed.
 */
function DeferredVendorCustomerProviders({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const id = setTimeout(() => setMounted(true), 16);
      return () => clearTimeout(id);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <VendorFilterProvider>
      <VendorProviders>
        <CustomerProviders>{children}</CustomerProviders>
      </VendorProviders>
    </VendorFilterProvider>
  );
}

export function DeferredProviders({ children }: Props) {
  return (
    <CustomerNotificationProvider>
      <VendorRelationshipProvider>
        <DiscoveryProviders>
        <ChatProviders>
          {/*
           * Support-chat providers are mounted eagerly (NOT deferred) because the
           * customer landing screen (chats) and vendor chats list consume them on
           * first render. Leaving them in the deferred Customer/Vendor trees made
           * the hooks return undefined during the initial frame, which crashed the
           * tree (black screen). They only use AsyncStorage, so early mount is cheap.
           */}
          <CustomerSupportChatProvider>
            <VendorSupportChatProvider>
              <DeferredVendorCustomerProviders>
                {children}
              </DeferredVendorCustomerProviders>
            </VendorSupportChatProvider>
          </CustomerSupportChatProvider>
        </ChatProviders>
      </DiscoveryProviders>
        </VendorRelationshipProvider>
    </CustomerNotificationProvider>
  );
}
