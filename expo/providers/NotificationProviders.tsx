import React, { ReactNode } from 'react';
import { CustomerNotificationProvider } from '@/contexts/CustomerNotificationContext';
import { CustomerPushNotificationProvider } from '@/contexts/CustomerPushNotificationContext';
import { VendorNotificationProvider } from '@/contexts/VendorNotificationContext';
import { VendorPushNotificationProvider } from '@/contexts/VendorPushNotificationContext';
import { VendorQuietHoursProvider } from '@/contexts/VendorQuietHoursContext';

interface NotificationProvidersProps {
  children: ReactNode;
}

export function NotificationProviders({ children }: NotificationProvidersProps) {
  return (
    <CustomerNotificationProvider>
      <CustomerPushNotificationProvider>
        <VendorNotificationProvider>
          <VendorPushNotificationProvider>
            <VendorQuietHoursProvider>
              {children}
            </VendorQuietHoursProvider>
          </VendorPushNotificationProvider>
        </VendorNotificationProvider>
      </CustomerPushNotificationProvider>
    </CustomerNotificationProvider>
  );
}
