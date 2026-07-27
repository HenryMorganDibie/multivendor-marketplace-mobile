import { BusinessCountry } from '@/contexts/VendorPlanContext';

export interface PaymentProvider {
  id: string;
  label: string;
  type: 'bank' | 'card' | 'wallet';
}

export const allowedPaymentProvidersByCountry: Record<BusinessCountry, PaymentProvider[]> = {
  'Canada': [
    { id: 'interac', label: 'Interac e-Transfer', type: 'bank' },
    { id: 'canadian_bank', label: 'Canadian Bank Transfer', type: 'bank' },
    { id: 'stripe_ca', label: 'Stripe (Canada)', type: 'card' },
    { id: 'square_ca', label: 'Square', type: 'card' },
  ],
  'Nigeria': [
    { id: 'nigerian_bank', label: 'Nigerian Bank Transfer', type: 'bank' },
    { id: 'paystack', label: 'Paystack', type: 'card' },
    { id: 'flutterwave', label: 'Flutterwave', type: 'card' },
    { id: 'opay', label: 'Opay', type: 'wallet' },
  ],
  'Ghana': [
    { id: 'ghana_bank', label: 'Ghana Bank Transfer', type: 'bank' },
    { id: 'mtn_mobile_money', label: 'MTN Mobile Money', type: 'wallet' },
    { id: 'vodafone_cash', label: 'Vodafone Cash', type: 'wallet' },
  ],
  'Kenya': [
    { id: 'mpesa', label: 'M-Pesa', type: 'wallet' },
    { id: 'kenya_bank', label: 'Kenyan Bank Transfer', type: 'bank' },
  ],
  'Egypt': [
    { id: 'egypt_bank', label: 'Egyptian Bank Transfer', type: 'bank' },
    { id: 'fawry', label: 'Fawry', type: 'wallet' },
  ],
  'South Africa': [
    { id: 'sa_bank', label: 'South African Bank Transfer', type: 'bank' },
    { id: 'payfast', label: 'PayFast', type: 'card' },
  ],
  'Morocco': [
    { id: 'morocco_bank', label: 'Moroccan Bank Transfer', type: 'bank' },
  ],
  'Turkey': [
    { id: 'turkey_bank', label: 'Turkish Bank Transfer', type: 'bank' },
    { id: 'iyzico', label: 'iyzico', type: 'card' },
  ],
  'United Kingdom': [
    { id: 'uk_bank', label: 'UK Bank Transfer', type: 'bank' },
    { id: 'stripe_uk', label: 'Stripe (UK)', type: 'card' },
  ],
  'Australia': [
    { id: 'au_bank', label: 'Australian Bank Transfer', type: 'bank' },
    { id: 'stripe_au', label: 'Stripe (Australia)', type: 'card' },
  ],
  'United States': [
    { id: 'us_bank', label: 'US Bank Transfer', type: 'bank' },
    { id: 'stripe_us', label: 'Stripe (US)', type: 'card' },
    { id: 'venmo', label: 'Venmo', type: 'wallet' },
    { id: 'cashapp', label: 'Cash App', type: 'wallet' },
  ],
};

export const nigerianBanks = [
  'Access Bank',
  'Citibank Nigeria',
  'Ecobank Nigeria',
  'Fidelity Bank',
  'First Bank of Nigeria',
  'First City Monument Bank (FCMB)',
  'Guaranty Trust Bank (GTBank)',
  'Heritage Bank',
  'Keystone Bank',
  'Polaris Bank',
  'Providus Bank',
  'Stanbic IBTC Bank',
  'Standard Chartered Bank',
  'Sterling Bank',
  'Union Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Unity Bank',
  'Wema Bank',
  'Zenith Bank',
];

export const canadianBanks = [
  'Royal Bank of Canada (RBC)',
  'Toronto-Dominion Bank (TD)',
  'Bank of Nova Scotia (Scotiabank)',
  'Bank of Montreal (BMO)',
  'Canadian Imperial Bank of Commerce (CIBC)',
  'National Bank of Canada',
  'Desjardins Group',
  'Tangerine Bank',
  'Simplii Financial',
  'EQ Bank',
];

export const ukBanks = [
  'Barclays',
  'HSBC',
  'Lloyds Bank',
  'NatWest',
  'Santander UK',
  'Royal Bank of Scotland',
  'TSB Bank',
  'Metro Bank',
];

export const usBanks = [
  'Bank of America',
  'Chase Bank',
  'Wells Fargo',
  'Citibank',
  'US Bank',
  'PNC Bank',
  'Capital One',
  'TD Bank',
];

export function getBanksForCountry(country: BusinessCountry): string[] {
  switch (country) {
    case 'Nigeria':
      return nigerianBanks;
    case 'Canada':
      return canadianBanks;
    case 'United Kingdom':
      return ukBanks;
    case 'United States':
      return usBanks;
    default:
      return [];
  }
}

export function supportsAccountNameResolution(country: BusinessCountry): boolean {
  return country === 'Nigeria';
}
