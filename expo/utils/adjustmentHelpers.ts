export interface Adjustment {
  label: string;
  amount: number;
}

export function validateAdjustment(
  label: string,
  amount: string
): { valid: boolean; error?: string } {
  if (!label.trim()) {
    return { valid: false, error: 'Please enter a label for the adjustment' };
  }

  const parsedAmount = parseFloat(amount);
  if (!amount || isNaN(parsedAmount)) {
    return { valid: false, error: 'Please enter a valid amount' };
  }

  return { valid: true };
}

export function calculateAdjustmentTotal(adjustments: Adjustment[]): number {
  return adjustments.reduce((sum, adj) => sum + adj.amount, 0);
}

export function applyAdjustmentToTotal(baseTotal: number, adjustmentTotal: number): number {
  return baseTotal + adjustmentTotal;
}
