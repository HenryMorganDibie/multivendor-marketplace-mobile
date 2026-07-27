import React, { ReactNode } from 'react';
import { AbandonedCartProvider } from '@/contexts/AbandonedCartContext';
import { PromoContext } from '@/contexts/PromoContext';
import { CustomerPushNotificationProvider } from '@/contexts/CustomerPushNotificationContext';
import { CustomerDraftProvider } from '@/contexts/CustomerDraftContext';
import { CustomerAiUsageProvider } from '@/contexts/CustomerAiUsageContext';
import { CustomerProvider } from '@/contexts/CustomerContext';
import { SearchProvider } from '@/contexts/SearchContext';

interface CustomerProvidersProps {
  children: ReactNode;
}

export function CustomerProviders({ children }: CustomerProvidersProps) {
  console.log('[CustomerProviders] Mounting customer provider tree');
  return (
    <SearchProvider>
    <AbandonedCartProvider>
          <PromoContext>
            <CustomerPushNotificationProvider>
              <CustomerDraftProvider>
                <CustomerAiUsageProvider>
                  <CustomerProvider>
                    {children}
                  </CustomerProvider>
                </CustomerAiUsageProvider>
              </CustomerDraftProvider>
            </CustomerPushNotificationProvider>
          </PromoContext>
        </AbandonedCartProvider>
    </SearchProvider>
  );
}
