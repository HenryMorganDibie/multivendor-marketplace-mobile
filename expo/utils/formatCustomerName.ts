export interface CustomerDisplayName {
  firstName: string;
  lastName?: string;
}

export function formatCustomerDisplayName(
  firstName?: string,
  lastName?: string
): string {
  if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
    return '';
  }

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName?.trim();

  if (!trimmedLast) {
    return trimmedFirst;
  }

  const lastInitial = trimmedLast.charAt(0).toUpperCase();
  return `${trimmedFirst} ${lastInitial}.`;
}

export function parseCustomerDisplayName(displayName: string): CustomerDisplayName | null {
  if (!displayName || typeof displayName !== 'string') {
    return null;
  }

  const trimmedName = displayName.trim();
  
  if (!trimmedName) {
    return null;
  }

  const parts = trimmedName.split(/\s+/);
  
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }
  
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ').replace(/\.$/, '');
  
  return { firstName, lastName: lastName || undefined };
}

export function formatCustomerNameFromFull(fullName: string): string {
  const parsed = parseCustomerDisplayName(fullName);
  if (!parsed) return 'Customer';
  return formatCustomerDisplayName(parsed.firstName, parsed.lastName) || 'Customer';
}

export default function formatCustomerName(customerName: string): string {
  const parsed = parseCustomerDisplayName(customerName);
  if (!parsed) return 'Customer';
  return formatCustomerDisplayName(parsed.firstName, parsed.lastName) || 'Customer';
}
