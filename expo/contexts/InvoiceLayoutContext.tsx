import React, { createContext, useContext, useMemo } from 'react';
import {
  resolveInvoiceLayout,
  resolvePrintInvoiceLayout,
  type InvoiceLayoutSpec,
} from '@/constants/invoiceLayout';

export interface InvoiceLayoutContextValue {
  /** Measured width of the invoice document container, in points. */
  containerWidth: number;
  /** Resolved responsive layout tokens for the current container width. */
  layout: InvoiceLayoutSpec;
}

const InvoiceLayoutContext = createContext<InvoiceLayoutContextValue>({
  containerWidth: 0,
  layout: resolveInvoiceLayout(0),
});

export function InvoiceLayoutProvider({
  containerWidth,
  printMode,
  children,
}: {
  containerWidth: number;
  printMode?: boolean;
  children: React.ReactNode;
}) {
  const layout = useMemo<InvoiceLayoutSpec>(() => {
    if (printMode) {
      return resolvePrintInvoiceLayout();
    }
    return resolveInvoiceLayout(containerWidth);
  }, [containerWidth, printMode]);

  const value = useMemo<InvoiceLayoutContextValue>(
    () => ({ containerWidth, layout }),
    [containerWidth, layout]
  );

  return (
    <InvoiceLayoutContext.Provider value={value}>
      {children}
    </InvoiceLayoutContext.Provider>
  );
}

export function useInvoiceLayout(): InvoiceLayoutContextValue {
  return useContext(InvoiceLayoutContext);
}

export type { InvoiceLayoutSpec } from '@/constants/invoiceLayout';
