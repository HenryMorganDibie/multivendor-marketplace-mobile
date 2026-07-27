export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

const URL_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\b[a-z0-9-]+\.(com|net|org|io|co|app|xyz|me|link|ly|gl|bit\.ly)\b/i,
  /\b[a-z0-9-]+\.co\.[a-z]{2}\b/i,
];

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

const PHONE_PATTERNS = [
  /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/,
  /\d{3}[\s.-]\d{3}[\s.-]\d{4}/,
  /\(\d{3}\)\s*\d{3}[\s.-]\d{4}/,
];

const SOCIAL_MEDIA_PATTERNS = [
  /@[a-zA-Z0-9_]{2,}/,
  /\b(instagram|facebook|twitter|tiktok|snapchat|telegram|whatsapp|wechat)[\s:]/i,
];

const PAYMENT_KEYWORDS = [
  /\b(payment|pay|transfer|bank|account|card|paypal|venmo|cashapp|zelle|e-?transfer|wire)\b/i,
  /\$(USD|CAD|EUR|GBP|NGN|INR)/i,
  /\b(send money|cash|deposit|routing number|iban|swift)\b/i,
];

export function containsURL(text: string): boolean {
  return URL_PATTERNS.some(pattern => pattern.test(text));
}

export function containsEmail(text: string): boolean {
  return EMAIL_PATTERN.test(text);
}

export function containsPhoneNumber(text: string): boolean {
  return PHONE_PATTERNS.some(pattern => pattern.test(text));
}

export function containsSocialMediaHandle(text: string): boolean {
  return SOCIAL_MEDIA_PATTERNS.some(pattern => pattern.test(text));
}

export function containsPaymentKeywords(text: string): boolean {
  return PAYMENT_KEYWORDS.some(pattern => pattern.test(text));
}

export function validateLabel(label: string): ValidationResult {
  if (!label.trim()) {
    return { isValid: false, error: 'Label is required' };
  }

  if (containsURL(label)) {
    return { isValid: false, error: 'Links are not allowed in labels' };
  }

  if (containsEmail(label)) {
    return { isValid: false, error: 'Email addresses are not allowed in labels' };
  }

  if (containsPhoneNumber(label)) {
    return { isValid: false, error: 'Phone numbers are not allowed in labels' };
  }

  return { isValid: true };
}

export function validateName(name: string): ValidationResult {
  if (!name.trim()) {
    return { isValid: true };
  }

  if (containsURL(name)) {
    return { isValid: false, error: 'Links are not allowed in names' };
  }

  if (containsEmail(name)) {
    return { isValid: false, error: 'Email addresses are not allowed in names' };
  }

  if (containsPhoneNumber(name)) {
    return { isValid: false, error: 'Phone numbers are not allowed in names' };
  }

  if (/\d{4,}/.test(name)) {
    return { isValid: false, error: 'Numbers are not allowed in names' };
  }

  return { isValid: true };
}

export function validatePhone(phone: string): ValidationResult {
  if (!phone.trim()) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 7) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  return { isValid: true };
}

export function validateAddress(address: string): ValidationResult {
  if (!address.trim()) {
    return { isValid: true };
  }

  if (containsURL(address)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsEmail(address)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsPhoneNumber(address)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsPaymentKeywords(address)) {
    return {
      isValid: false,
      error: 'For security reasons, payment instructions aren\'t allowed here. Please use this field for delivery address only.',
    };
  }

  return { isValid: true };
}

export function validateDeliveryNote(note: string): ValidationResult {
  if (!note.trim()) {
    return { isValid: true };
  }

  if (containsURL(note)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsEmail(note)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsPhoneNumber(note)) {
    return {
      isValid: false,
      error: 'For security reasons, links and contact details aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsSocialMediaHandle(note)) {
    return {
      isValid: false,
      error: 'For security reasons, social media handles aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (containsPaymentKeywords(note)) {
    return {
      isValid: false,
      error: 'For security reasons, payment instructions aren\'t allowed here. Please use this field for delivery instructions only.',
    };
  }

  if (note.length > 200) {
    return {
      isValid: false,
      error: 'Delivery note cannot exceed 200 characters',
    };
  }

  return { isValid: true };
}
