import React, { ReactNode } from 'react';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ExternalOrdersProvider } from '@/contexts/ExternalOrdersContext';
import { OrderCompletionProvider } from '@/contexts/OrderCompletionContext';
import { CustomOrderProvider } from '@/contexts/CustomOrderContext';
import { InvoiceProvider } from '@/contexts/InvoiceContext';
import { AppointmentReminderProvider } from '@/contexts/AppointmentReminderContext';
import { ChangeRequestsProvider } from '@/contexts/ChangeRequestsContext';

interface OrdersProvidersProps {
  children: ReactNode;
}

export function OrdersProviders({ children }: OrdersProvidersProps) {
  return (
    <OrdersProvider>
      <ExternalOrdersProvider>
        <OrderCompletionProvider>
          <CustomOrderProvider>
            <InvoiceProvider>
              <AppointmentReminderProvider>
                <ChangeRequestsProvider>
                  {children}
                </ChangeRequestsProvider>
              </AppointmentReminderProvider>
            </InvoiceProvider>
          </CustomOrderProvider>
        </OrderCompletionProvider>
      </ExternalOrdersProvider>
    </OrdersProvider>
  );
}
