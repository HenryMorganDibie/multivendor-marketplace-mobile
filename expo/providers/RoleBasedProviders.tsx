import React, { ReactNode } from 'react';
import { VendorProviders } from './VendorProviders';
import { CustomerProviders } from './CustomerProviders';
import { DiscoveryProviders } from './DiscoveryProviders';
import { ChatProviders } from './ChatProviders';

interface Props {
  children: ReactNode;
}

export function RoleBasedProviders({ children }: Props) {
  console.log('[RoleBasedProviders] Mounting all providers (vendor + customer)');
  return (
    <DiscoveryProviders>
      <ChatProviders>
        <VendorProviders>
          <CustomerProviders>
            {children}
          </CustomerProviders>
        </VendorProviders>
      </ChatProviders>
    </DiscoveryProviders>
  );
}
