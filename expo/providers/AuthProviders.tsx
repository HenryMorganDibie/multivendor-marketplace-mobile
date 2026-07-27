import React, { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { AuditLogProvider } from '@/contexts/AuditLogContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

interface AuthProvidersProps {
  children: ReactNode;
}

export function AuthProviders({ children }: AuthProvidersProps) {
  return (
    <AuditLogProvider>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </AuditLogProvider>
  );
}
