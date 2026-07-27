import React, { ReactNode } from 'react';
import { CartProvider } from '@/contexts/CartContext';
import { AbandonedCartProvider } from '@/contexts/AbandonedCartContext';
import { PromoContext } from '@/contexts/PromoContext';

interface CartProvidersProps {
  children: ReactNode;
}

export function CartProviders({ children }: CartProvidersProps) {
  return (
    <CartProvider>
      <AbandonedCartProvider>
        <PromoContext>
          {children}
        </PromoContext>
      </AbandonedCartProvider>
    </CartProvider>
  );
}
