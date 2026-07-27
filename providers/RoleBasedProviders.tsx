import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { VendorProviders } from './VendorProviders';
import { CustomerProviders } from './CustomerProviders';

interface Props {
  children: ReactNode;
}

export function RoleBasedProviders({ children }: Props) {
  const { user } = useAuth();

  if (user?.role === 'vendor') {
    return <VendorProviders>{children}</VendorProviders>;
  }

  return <CustomerProviders>{children}</CustomerProviders>;
}
