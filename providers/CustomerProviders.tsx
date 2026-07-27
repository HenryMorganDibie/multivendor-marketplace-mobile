import React, { ReactNode } from 'react';
import { CountryStatusProvider } from '@/contexts/CountryStatusContext';
import { FavoritesProvider } from '@/contexts/FavoritesContext';
import { RecentlyViewedProvider } from '@/contexts/RecentlyViewedContext';
import { CartProvider } from '@/contexts/CartContext';
import { AbandonedCartProvider } from '@/contexts/AbandonedCartContext';
import { PromoContext } from '@/contexts/PromoContext';
import { CustomerNotificationProvider } from '@/contexts/CustomerNotificationContext';
import { CustomerPushNotificationProvider } from '@/contexts/CustomerPushNotificationContext';
import { CustomerDraftProvider } from '@/contexts/CustomerDraftContext';

interface CustomerProvidersProps {
  children: ReactNode;
}

/**
 * Renders all customer providers as a stable tree.
 * Previously used a setTimeout-based ready flag that caused full subtree
 * unmount/remount — replaced with a single stable tree.
 */
export function CustomerProviders({ children }: CustomerProvidersProps) {
  return (
    <CountryStatusProvider>
        <FavoritesProvider>
          <RecentlyViewedProvider>
            <CartProvider>
              <AbandonedCartProvider>
                <PromoContext>
                  <CustomerNotificationProvider>
                    <CustomerPushNotificationProvider>
                      <CustomerDraftProvider>
                        {children}
                      </CustomerDraftProvider>
                    </CustomerPushNotificationProvider>
                  </CustomerNotificationProvider>
                </PromoContext>
              </AbandonedCartProvider>
            </CartProvider>
          </RecentlyViewedProvider>
        </FavoritesProvider>
      </CountryStatusProvider>
  );
}
