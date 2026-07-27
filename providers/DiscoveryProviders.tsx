import React, { ReactNode } from 'react';
import { UserLocationProvider } from '@/contexts/UserLocationContext';
import { VendorFilterProvider } from '@/contexts/VendorFilterContext';
import { CatalogProvider } from '@/contexts/CatalogContext';

interface DiscoveryProvidersProps {
  children: ReactNode;
}

export function DiscoveryProviders({ children }: DiscoveryProvidersProps) {
  return (
    <UserLocationProvider>
      <VendorFilterProvider>
        <CatalogProvider>
          {children}
        </CatalogProvider>
      </VendorFilterProvider>
    </UserLocationProvider>
  );
}
