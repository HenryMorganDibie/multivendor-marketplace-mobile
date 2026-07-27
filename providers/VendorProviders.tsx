import React, { ReactNode } from 'react';
import { VendorProvider } from '@/contexts/VendorContext';
import { VendorPlanContext } from '@/contexts/VendorPlanContext';
import { VendorPickupProvider } from '@/contexts/VendorPickupContext';
import { VendorFulfillmentProvider } from '@/contexts/VendorFulfillmentContext';
import { VendorAutoAcceptProvider } from '@/contexts/VendorAutoAcceptContext';
import { VendorCustomerNotesProvider } from '@/contexts/VendorCustomerNotesContext';
import { VerificationProvider } from '@/contexts/VerificationContext';
import { TodaysNoteProvider } from '@/contexts/TodaysNoteContext';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ExternalOrdersProvider } from '@/contexts/ExternalOrdersContext';
import { OrderCompletionProvider } from '@/contexts/OrderCompletionContext';
import { CustomOrderProvider } from '@/contexts/CustomOrderContext';
import { InvoiceProvider } from '@/contexts/InvoiceContext';
import { AppointmentReminderProvider } from '@/contexts/AppointmentReminderContext';
import { VendorNotificationProvider } from '@/contexts/VendorNotificationContext';
import { VendorPushNotificationProvider } from '@/contexts/VendorPushNotificationContext';
import { VendorQuietHoursProvider } from '@/contexts/VendorQuietHoursContext';
import { VendorAwayMessageProvider } from '@/contexts/VendorAwayMessageContext';
import { VendorChatModeProvider } from '@/contexts/VendorChatModeContext';
import { VendorDraftProvider } from '@/contexts/VendorDraftContext';
import { VendorSupportChatProvider } from '@/contexts/VendorSupportChatContext';
import { ReviewsProvider } from '@/contexts/ReviewsContext';

interface VendorProvidersProps {
  children: ReactNode;
}

/**
 * Renders all vendor providers as a stable tree.
 * Previously used a multi-phase setTimeout pattern that caused full subtree
 * unmount/remount 2x in the first second — replaced with a single stable tree.
 */
export function VendorProviders({ children }: VendorProvidersProps) {
  return (
    <VendorProvider>
      <VendorPlanContext>
        <VendorFulfillmentProvider>
          <VendorPickupProvider>
            <VendorAutoAcceptProvider>
              <VendorCustomerNotesProvider>
                <VerificationProvider>
                  <TodaysNoteProvider>
                    <OrdersProvider>
                      <ExternalOrdersProvider>
                        <OrderCompletionProvider>
                          <CustomOrderProvider>
                            <InvoiceProvider>
                              <AppointmentReminderProvider>
                                <VendorNotificationProvider>
                                  <VendorPushNotificationProvider>
                                    <VendorQuietHoursProvider>
                                      <VendorAwayMessageProvider>
                                        <VendorChatModeProvider>
                                          <VendorDraftProvider>
                                            <VendorSupportChatProvider>
                                              <ReviewsProvider>
                                                {children}
                                              </ReviewsProvider>
                                            </VendorSupportChatProvider>
                                          </VendorDraftProvider>
                                        </VendorChatModeProvider>
                                      </VendorAwayMessageProvider>
                                    </VendorQuietHoursProvider>
                                  </VendorPushNotificationProvider>
                                </VendorNotificationProvider>
                              </AppointmentReminderProvider>
                            </InvoiceProvider>
                          </CustomOrderProvider>
                        </OrderCompletionProvider>
                      </ExternalOrdersProvider>
                    </OrdersProvider>
                  </TodaysNoteProvider>
                </VerificationProvider>
              </VendorCustomerNotesProvider>
            </VendorAutoAcceptProvider>
          </VendorPickupProvider>
        </VendorFulfillmentProvider>
      </VendorPlanContext>
    </VendorProvider>
  );
}
