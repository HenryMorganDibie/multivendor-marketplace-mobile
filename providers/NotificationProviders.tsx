import React, { ReactNode } from 'react';

interface NotificationProvidersProps {
  children: ReactNode;
}

export function NotificationProviders({ children }: NotificationProvidersProps) {
  return <>{children}</>;
}
