const PROHIBITED_USERNAMES = [
  'cakes',
  'food',
  'delivery',
  'fashion',
  'electronics',
  'beauty',
  'home',
  'art',
  'services',
  'catering',
  'the platform',
  'admin',
  'support',
  'help',
  'customer',
  'vendor',
  'system',
  'official',
  'verified',
  'test',
  'null',
  'undefined',
];

const RESERVED_PREFIXES = ['the platform', 'admin', 'support', 'help', 'official'];

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateUsername(username: string): UsernameValidationResult {
  const trimmed = username.trim();

  if (!trimmed) {
    return { isValid: false, error: 'Username is required' };
  }

  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters' };
  }

  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username must be 30 characters or less' };
  }

  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username can only contain letters, numbers, and underscores',
    };
  }

  if (!/^[a-zA-Z0-9]/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Username must start with a letter or number',
    };
  }

  const lowerUsername = trimmed.toLowerCase();

  if (PROHIBITED_USERNAMES.includes(lowerUsername)) {
    return {
      isValid: false,
      error: 'This username is not allowed',
    };
  }

  for (const prefix of RESERVED_PREFIXES) {
    if (lowerUsername.startsWith(prefix)) {
      return {
        isValid: false,
        error: 'This username is reserved',
      };
    }
  }

  return { isValid: true };
}

export function formatUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function generateSystemUsername(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortId = '';
  for (let i = 0; i < 5; i++) {
    shortId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `the platform-${shortId}`;
}

export function isUsernameSearch(query: string): boolean {
  const trimmed = query.trim();
  return trimmed.startsWith('@') || /^[a-zA-Z0-9_]{3,30}$/.test(trimmed);
}

export function extractUsername(query: string): string {
  const trimmed = query.trim();
  if (trimmed.startsWith('@')) {
    return trimmed.slice(1).toLowerCase();
  }
  return trimmed.toLowerCase();
}
