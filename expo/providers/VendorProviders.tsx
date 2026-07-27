import React, { ReactNode } from 'react';
import { VendorPickupProvider } from '@/contexts/VendorPickupContext';
import { VendorFulfillmentProvider } from '@/contexts/VendorFulfillmentContext';
import { VendorAutoAcceptProvider } from '@/contexts/VendorAutoAcceptContext';
import { VendorCustomerNotesProvider } from '@/contexts/VendorCustomerNotesContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ExternalOrdersProvider } from '@/contexts/ExternalOrdersContext';
import { OrderCompletionProvider } from '@/contexts/OrderCompletionContext';
import { CustomOrderProvider } from '@/contexts/CustomOrderContext';
import { InvoiceProvider } from '@/contexts/InvoiceContext';
import { InvoiceBrandingProvider } from '@/contexts/InvoiceBrandingContext';
import { AppointmentReminderProvider } from '@/contexts/AppointmentReminderContext';
import { VendorQuietHoursProvider } from '@/contexts/VendorQuietHoursContext';
import { VendorChatModeProvider } from '@/contexts/VendorChatModeContext';
import { VendorDraftProvider } from '@/contexts/VendorDraftContext';
import { ChangeRequestsProvider } from '@/contexts/ChangeRequestsContext';
import { ReviewsProvider } from '@/contexts/ReviewsContext';
import { VendorOnboardingProvider } from '@/contexts/VendorOnboardingContext';

interface VendorProvidersProps {
  children: ReactNode;
}

export function VendorProviders({ children }: VendorProvidersProps) {
  console.log('[VendorProviders] Mounting vendor provider tree');
  return (
    <VendorFulfillmentProvider>
        <VendorPickupProvider>
          <VendorAutoAcceptProvider>
            <VendorCustomerNotesProvider>
              <OrdersProvider>
                    <ExternalOrdersProvider>
                      <OrderCompletionProvider>
                        <CustomOrderProvider>
                          <InvoiceProvider>
                            <InvoiceBrandingProvider>
                              <AppointmentReminderProvider>
                              <VendorQuietHoursProvider>
                                <VendorChatModeProvider>
                                  <VendorDraftProvider>
                                    <ChangeRequestsProvider>
                          <ReviewsProvider>
                                      <VendorOnboardingProvider>
                                        {children}
                                      </VendorOnboardingProvider>
                          </ReviewsProvider>
                                    </ChangeRequestsProvider>
                                  </VendorDraftProvider>
                                </VendorChatModeProvider>
                              </VendorQuietHoursProvider>
                            </AppointmentReminderProvider>
                            </InvoiceBrandingProvider>
                          </InvoiceProvider>
                        </CustomOrderProvider>
                      </OrderCompletionProvider>
                    </ExternalOrdersProvider>
                  </OrdersProvider>
            </VendorCustomerNotesProvider>
          </VendorAutoAcceptProvider>
        </VendorPickupProvider>
      </VendorFulfillmentProvider>
  );
}
