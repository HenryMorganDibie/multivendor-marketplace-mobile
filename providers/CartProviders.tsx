import React, { ReactNode } from 'react';

interface CartProvidersProps {
  children: ReactNode;
}

export function CartProviders({ children }: CartProvidersProps) {
  return <>{children}</>;
}
