export type Currency = 'NGN' | 'CAD' | 'USD' | 'GBP' | 'EUR' | 'JPY' | 'KRW' | 'VND' | 'GHS' | 'KES' | 'ZAR' | 'AED' | 'AUD' | 'INR' | 'BRL' | 'MXN';

interface CurrencyConfig {
  symbol: string;
  decimals: number;
  minorUnitMultiplier: number;
}

const CURRENCY_CONFIG: Record<Currency, CurrencyConfig> = {
  NGN: { symbol: '\u20A6', decimals: 2, minorUnitMultiplier: 100 },
  CAD: { symbol: 'CA$', decimals: 2, minorUnitMultiplier: 100 },
  USD: { symbol: 'US$', decimals: 2, minorUnitMultiplier: 100 },
  GBP: { symbol: '\u00A3', decimals: 2, minorUnitMultiplier: 100 },
  EUR: { symbol: '\u20AC', decimals: 2, minorUnitMultiplier: 100 },
  JPY: { symbol: '\u00A5', decimals: 0, minorUnitMultiplier: 1 },
  KRW: { symbol: '\u20A9', decimals: 0, minorUnitMultiplier: 1 },
  VND: { symbol: '\u20AB', decimals: 0, minorUnitMultiplier: 1 },
  GHS: { symbol: 'GH\u20B5', decimals: 2, minorUnitMultiplier: 100 },
  KES: { symbol: 'KSh', decimals: 2, minorUnitMultiplier: 100 },
  ZAR: { symbol: 'R', decimals: 2, minorUnitMultiplier: 100 },
  AED: { symbol: '\u062F.\u0625', decimals: 2, minorUnitMultiplier: 100 },
  AUD: { symbol: 'A$', decimals: 2, minorUnitMultiplier: 100 },
  INR: { symbol: '\u20B9', decimals: 2, minorUnitMultiplier: 100 },
  BRL: { symbol: 'R$', decimals: 2, minorUnitMultiplier: 100 },
  MXN: { symbol: 'MX$', decimals: 2, minorUnitMultiplier: 100 },
};

const COUNTRY_CODE_TO_CURRENCY: Record<string, Currency> = {
  NG: 'NGN',
  CA: 'CAD',
  US: 'USD',
  GB: 'GBP',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  AE: 'AED',
  AU: 'AUD',
  DE: 'EUR',
  FR: 'EUR',
  IN: 'INR',
  JP: 'JPY',
  BR: 'BRL',
  MX: 'MXN',
};

export function getCurrencyFromCountryCode(countryCode: string): Currency {
  return COUNTRY_CODE_TO_CURRENCY[countryCode] ?? 'NGN';
}

export function isCurrency(value: string | undefined | null): value is Currency {
  if (!value) return false;
  return value in CURRENCY_CONFIG;
}

export function getCurrencyDecimals(currency: Currency): number {
  return CURRENCY_CONFIG[currency]?.decimals ?? 2;
}

export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_CONFIG[currency]?.symbol ?? '';
}

export function getMinorUnitMultiplier(currency: Currency): number {
  return CURRENCY_CONFIG[currency]?.minorUnitMultiplier ?? 100;
}

function formatWithDecimals(amount: number, decimals: number): string {
  if (decimals === 0) {
    return Math.round(amount).toString();
  }
  return Number(amount).toFixed(decimals);
}

function formatWithCommasAndDecimals(amount: number, decimals: number): string {
  if (decimals === 0) {
    const whole = Math.round(amount).toString();
    return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  const formatted = Number(amount).toFixed(decimals);
  const [whole, decimal] = formatted.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${wholeWithCommas}.${decimal}`;
}

export function formatPrice(amount: number, currency: Currency = 'NGN'): string {
  const config = CURRENCY_CONFIG[currency];
  const symbol = config.symbol;
  const formatted = formatWithDecimals(amount, config.decimals);
  return `${symbol}${formatted}`;
}

export function formatPriceWithCommas(amount: number, currency: Currency = 'NGN'): string {
  const config = CURRENCY_CONFIG[currency];
  const symbol = config.symbol;
  const formatted = formatWithCommasAndDecimals(amount, config.decimals);
  return `${symbol}${formatted}`;
}

export function formatPriceCents(amountInCents: number, currency: Currency = 'NGN'): string {
  const config = CURRENCY_CONFIG[currency];
  const symbol = config.symbol;
  const amountInUnits = amountInCents / config.minorUnitMultiplier;
  const formatted = formatWithCommasAndDecimals(amountInUnits, config.decimals);
  return `${symbol}${formatted}`;
}

export function formatAmountForInput(amount: number, currency: Currency = 'NGN'): string {
  const config = CURRENCY_CONFIG[currency];
  return formatWithDecimals(amount, config.decimals);
}

export function formatAmountForDisplay(amount: number, currency: Currency = 'NGN'): string {
  const config = CURRENCY_CONFIG[currency];
  return formatWithCommasAndDecimals(amount, config.decimals);
}

export function formatCompactCurrency(amount: number, currency: Currency = 'NGN'): string {
  const symbol = CURRENCY_CONFIG[currency]?.symbol ?? '';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const val = abs / 1_000_000_000;
    const formatted = val % 1 === 0 ? `${val}` : parseFloat(val.toFixed(1)).toString();
    return `${sign}${symbol}${formatted}B`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const formatted = val % 1 === 0 ? `${val}` : parseFloat(val.toFixed(2)).toString();
    return `${sign}${symbol}${formatted}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    const formatted = val % 1 === 0 ? `${val}` : parseFloat(val.toFixed(1)).toString();
    return `${sign}${symbol}${formatted}K`;
  }
  return `${sign}${symbol}${formatWithCommasAndDecimals(abs, CURRENCY_CONFIG[currency]?.decimals ?? 2)}`;
}
