export interface CountryInfo {
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  flag: string;
}

export const COUNTRIES: CountryInfo[] = [
  { code: 'NG', name: 'Nigeria', currencyCode: 'NGN', currencySymbol: '₦', currencyName: 'Nigerian Naira', flag: '🇳🇬' },
  { code: 'US', name: 'United States', currencyCode: 'USD', currencySymbol: '$', currencyName: 'US Dollar', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', currencyCode: 'CAD', currencySymbol: 'CA$', currencyName: 'Canadian Dollar', flag: '🇨🇦' },
  { code: 'GB', name: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', currencyName: 'British Pound', flag: '🇬🇧' },
  { code: 'GH', name: 'Ghana', currencyCode: 'GHS', currencySymbol: 'GH₵', currencyName: 'Ghanaian Cedi', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', currencyCode: 'KES', currencySymbol: 'KSh', currencyName: 'Kenyan Shilling', flag: '🇰🇪' },
  { code: 'ZA', name: 'South Africa', currencyCode: 'ZAR', currencySymbol: 'R', currencyName: 'South African Rand', flag: '🇿🇦' },
  { code: 'AE', name: 'United Arab Emirates', currencyCode: 'AED', currencySymbol: 'AED', currencyName: 'UAE Dirham', flag: '🇦🇪' },
  { code: 'AU', name: 'Australia', currencyCode: 'AUD', currencySymbol: 'A$', currencyName: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', currencyCode: 'EUR', currencySymbol: '€', currencyName: 'Euro', flag: '🇩🇪' },
  { code: 'FR', name: 'France', currencyCode: 'EUR', currencySymbol: '€', currencyName: 'Euro', flag: '🇫🇷' },
  { code: 'IN', name: 'India', currencyCode: 'INR', currencySymbol: '₹', currencyName: 'Indian Rupee', flag: '🇮🇳' },
  { code: 'JP', name: 'Japan', currencyCode: 'JPY', currencySymbol: '¥', currencyName: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', currencyCode: 'BRL', currencySymbol: 'R$', currencyName: 'Brazilian Real', flag: '🇧🇷' },
  { code: 'MX', name: 'Mexico', currencyCode: 'MXN', currencySymbol: 'MX$', currencyName: 'Mexican Peso', flag: '🇲🇽' },
];

export const COUNTRY_CHANGE_COOLDOWN_DAYS = 90;
export const SUSPICIOUS_COOLDOWN_DAYS = 180;

export interface CountryChangeReason {
  id: string;
  label: string;
  description: string;
}

export const COUNTRY_CHANGE_REASONS: CountryChangeReason[] = [
  { id: 'relocated', label: 'I have relocated', description: 'I moved to a new country permanently' },
  { id: 'traveling_long_term', label: 'Extended travel', description: 'I am staying in another country for an extended period' },
  { id: 'incorrect_initial', label: 'Incorrect initial selection', description: 'I selected the wrong country during setup' },
  { id: 'business_reasons', label: 'Business reasons', description: 'I need to operate in a different market' },
  { id: 'other', label: 'Other reason', description: 'Another reason not listed above' },
];

export function getCountryByCode(code: string): CountryInfo | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getCurrencyForCountry(countryCode: string): { currencyCode: string; currencySymbol: string } | undefined {
  const country = getCountryByCode(countryCode);
  if (!country) return undefined;
  return { currencyCode: country.currencyCode, currencySymbol: country.currencySymbol };
}

export function formatPriceWithCurrency(amount: number, currencySymbol: string): string {
  const formatted = Number(amount).toFixed(2);
  const [whole, decimal] = formatted.split('.');
  const wholeWithCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currencySymbol}${wholeWithCommas}.${decimal}`;
}
