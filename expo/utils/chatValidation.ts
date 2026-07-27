export interface ChatValidationResult {
  isValid: boolean;
  errorMessage?: string;
}

const URL_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.(com|net|org|io|ng)\b/i,
];

const EMAIL_PATTERN = /@[\w.-]+\.\w+/i;

const PHONE_PATTERNS = [
  /\b\d{7,}\b/,
  /\+\d{1,3}[\s-]?\d/,
];

const PAYMENT_BYPASS_PHRASES = [
  'whatsapp',
  'whatsapp me',
  'dm me',
  'call me',
  'contact me',
  'text me',
  'pay me directly',
  'outside payment',
  'bank transfer',
  'manual transfer',
  'momo',
  'cash app',
  'zelle',
];

const CRYPTO_TERMS = [
  'crypto',
  'cryptocurrency',
  'bitcoin',
  'btc',
  'ethereum',
  'eth',
  'usdt',
  'usdc',
  'tether',
  'binance',
  'coinbase',
  'wallet address',
  'blockchain',
  'send crypto',
  'transfer crypto',
];

export function validateChatMessage(message: string): ChatValidationResult {
  const trimmedMessage = message.trim();
  
  if (!trimmedMessage) {
    return { isValid: true };
  }

  const lowerMessage = trimmedMessage.toLowerCase();

  for (const pattern of URL_PATTERNS) {
    if (pattern.test(trimmedMessage)) {
      return {
        isValid: false,
        errorMessage: 'Direct contact information or external payment methods are not allowed in chat.',
      };
    }
  }

  if (EMAIL_PATTERN.test(trimmedMessage)) {
    return {
      isValid: false,
      errorMessage: 'Direct contact information or external payment methods are not allowed in chat.',
    };
  }

  for (const pattern of PHONE_PATTERNS) {
    if (pattern.test(trimmedMessage)) {
      return {
        isValid: false,
        errorMessage: 'Direct contact information or external payment methods are not allowed in chat.',
      };
    }
  }

  for (const phrase of PAYMENT_BYPASS_PHRASES) {
    const regex = new RegExp('\\b' + phrase.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (regex.test(trimmedMessage)) {
      return {
        isValid: false,
        errorMessage: 'Direct contact information or external payment methods are not allowed in chat.',
      };
    }
  }

  for (const term of CRYPTO_TERMS) {
    const regex = new RegExp('\\b' + term.replace(/\s+/g, '\\s+') + '\\b', 'i');
    if (regex.test(trimmedMessage)) {
      return {
        isValid: false,
        errorMessage: 'Direct contact information or external payment methods are not allowed in chat.',
      };
    }
  }

  return { isValid: true };
}
