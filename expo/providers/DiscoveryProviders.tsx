import React, { ReactNode } from 'react';
import { CartProvider } from '@/contexts/CartContext';
import { UserLocationProvider } from '@/contexts/UserLocationContext';

import { CatalogProvider } from '@/contexts/CatalogContext';
import { CountryStatusProvider } from '@/contexts/CountryStatusContext';
import { RecentlyViewedProvider } from '@/contexts/RecentlyViewedContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { DiscoveryProvider } from '@/contexts/DiscoveryContext';
import { VendorNotificationProvider } from '@/contexts/VendorNotificationContext';
import { VendorPlanContext } from '@/contexts/VendorPlanContext';
import { VendorProvider } from '@/contexts/VendorContext';
import { TodaysNoteProvider } from '@/contexts/TodaysNoteContext';
import { VerificationProvider } from '@/contexts/VerificationContext';

interface DiscoveryProvidersProps {
  children: ReactNode;
}

export function DiscoveryProviders({ children }: DiscoveryProvidersProps) {
  return (
    <CartProvider>
      <UserLocationProvider>
        <CatalogProvider>
            <CountryStatusProvider>
              <RecentlyViewedProvider>
                <FavoritesProvider>
                  <DiscoveryProvider>
                    <VendorNotificationProvider>
                      <VendorPlanContext>
                        <VendorProvider>
                        <TodaysNoteProvider>
                          <VerificationProvider>
                            {children}
                          </VerificationProvider>
                        </TodaysNoteProvider>
                      </VendorProvider>
                      </VendorPlanContext>
                    </VendorNotificationProvider>
                  </DiscoveryProvider>
                </FavoritesProvider>
              </RecentlyViewedProvider>
            </CountryStatusProvider>
          </CatalogProvider>
      </UserLocationProvider>
    </CartProvider>
  );
}
