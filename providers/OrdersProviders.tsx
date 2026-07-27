import React, { ReactNode } from 'react';
import { OrdersProvider } from '@/contexts/OrdersContext';
import { ReviewsProvider } from '@/contexts/ReviewsContext';

interface OrdersProvidersProps {
  children: ReactNode;
}

export function OrdersProviders({ children }: OrdersProvidersProps) {
  return (
    <ReviewsProvider>
      <OrdersProvider>
        {children}
      </OrdersProvider>
    </ReviewsProvider>
  );
}
