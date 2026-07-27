import React, { ReactNode } from 'react';
import { DiscoveryProviders } from '@/providers/DiscoveryProviders';
import { NotificationProviders } from '@/providers/NotificationProviders';
import { ChatProviders } from '@/providers/ChatProviders';
import { OrdersProviders } from '@/providers/OrdersProviders';
import { CartProviders } from '@/providers/CartProviders';
import { RoleBasedProviders } from '@/providers/RoleBasedProviders';
import { VendorRelationshipProvider } from '@/contexts/VendorRelationshipContext';

interface DeferredProvidersProps {
  children: ReactNode;
}

/**
 * Renders the full provider tree immediately.
 * Previously used a phase-based setTimeout pattern that caused full subtree
 * unmount/remount on phase transitions — replaced with a stable single tree.
 * Each context handles its own lazy initialization internally.
 */
export function DeferredProviders({ children }: DeferredProvidersProps) {
  return (
    <VendorRelationshipProvider>
      <DiscoveryProviders>
        <ChatProviders>
          <RoleBasedProviders>
          <NotificationProviders>
            <OrdersProviders>
              <CartProviders>
                {children}
              </CartProviders>
            </OrdersProviders>
          </NotificationProviders>
          </RoleBasedProviders>
        </ChatProviders>
      </DiscoveryProviders>
    </VendorRelationshipProvider>
  );
}
