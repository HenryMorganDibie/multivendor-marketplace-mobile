export interface PaymentRecord {
  amount: number;
  timestamp: string;
}

export function validatePartialPaymentAmount(
  partialPaymentAmount: string,
  balanceDue: number
): { valid: boolean; error?: string } {
  const amount = parseFloat(partialPaymentAmount);
  
  if (!partialPaymentAmount || isNaN(amount) || amount <= 0) {
    return {
      valid: false,
      error: 'Please enter a valid payment amount greater than 0.',
    };
  }
  
  if (amount > balanceDue / 100) {
    return {
      valid: false,
      error: `Partial payment cannot exceed the outstanding balance.`,
    };
  }
  
  return { valid: true };
}

export function calculatePaymentUpdate(
  paymentType: 'full' | 'partial',
  partialPaymentAmount: string,
  balanceDue: number,
  currentAmountPaid: number,
  calculatedTotal: number
): {
  amountReceived: number;
  newTotalPaid: number;
  newBalanceDue: number;
  paymentStatus: 'paid' | 'partially_paid';
} {
  const amountReceived =
    paymentType === 'full' ? balanceDue : Math.round(parseFloat(partialPaymentAmount) * 100);
  const newTotalPaid = currentAmountPaid + amountReceived;
  const newBalanceDue = calculatedTotal - newTotalPaid;

  return {
    amountReceived,
    newTotalPaid,
    newBalanceDue,
    paymentStatus: newBalanceDue === 0 ? 'paid' : 'partially_paid',
  };
}

export function getTotalPaidFromHistory(paymentHistory: PaymentRecord[]): number {
  return paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
}

export function hasPaymentHistory(paymentHistory: PaymentRecord[]): boolean {
  return paymentHistory.length > 0;
}
