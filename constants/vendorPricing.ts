export type PricingBand = 'A' | 'B' | 'C' | 'D';

export interface CountryPricing {
  band: PricingBand;
  currency: string;
  currencySymbol: string;
  basic: number;
  standard: {
    regular: number;
    founder: number;
  };
  pro: {
    regular: number;
    founder: number;
  };
  proPlus: {
    regular: number;
    founder: number;
  };
}

export const COUNTRY_PRICING: Record<string, CountryPricing> = {
  'Nigeria': {
    band: 'A',
    currency: 'NGN',
    currencySymbol: '₦',
    basic: 0,
    standard: {
      regular: 9000,
      founder: 6000,
    },
    pro: {
      regular: 20000,
      founder: 15000,
    },
    proPlus: {
      regular: 50000,
      founder: 35000,
    },
  },
  'Ghana': {
    band: 'A',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    basic: 0,
    standard: {
      regular: 85,
      founder: 60,
    },
    pro: {
      regular: 240,
      founder: 180,
    },
    proPlus: {
      regular: 600,
      founder: 420,
    },
  },
  'Kenya': {
    band: 'A',
    currency: 'KES',
    currencySymbol: 'KSh',
    basic: 0,
    standard: {
      regular: 1900,
      founder: 1350,
    },
    pro: {
      regular: 5400,
      founder: 4050,
    },
    proPlus: {
      regular: 13500,
      founder: 9450,
    },
  },
  'Egypt': {
    band: 'A',
    currency: 'EGP',
    currencySymbol: 'E£',
    basic: 0,
    standard: {
      regular: 740,
      founder: 530,
    },
    pro: {
      regular: 2100,
      founder: 1575,
    },
    proPlus: {
      regular: 5250,
      founder: 3675,
    },
  },
  'South Africa': {
    band: 'B',
    currency: 'ZAR',
    currencySymbol: 'R',
    basic: 0,
    standard: {
      regular: 270,
      founder: 190,
    },
    pro: {
      regular: 720,
      founder: 540,
    },
    proPlus: {
      regular: 1620,
      founder: 1135,
    },
  },
  'Morocco': {
    band: 'B',
    currency: 'MAD',
    currencySymbol: 'MAD',
    basic: 0,
    standard: {
      regular: 150,
      founder: 105,
    },
    pro: {
      regular: 400,
      founder: 300,
    },
    proPlus: {
      regular: 900,
      founder: 630,
    },
  },
  'Turkey': {
    band: 'B',
    currency: 'TRY',
    currencySymbol: '₺',
    basic: 0,
    standard: {
      regular: 530,
      founder: 370,
    },
    pro: {
      regular: 1410,
      founder: 1060,
    },
    proPlus: {
      regular: 3180,
      founder: 2225,
    },
  },
  'United Kingdom': {
    band: 'C',
    currency: 'GBP',
    currencySymbol: '£',
    basic: 0,
    standard: {
      regular: 20,
      founder: 14,
    },
    pro: {
      regular: 60,
      founder: 45,
    },
    proPlus: {
      regular: 120,
      founder: 84,
    },
  },
  'Canada': {
    band: 'C',
    currency: 'CAD',
    currencySymbol: '$',
    basic: 0,
    standard: {
      regular: 35,
      founder: 25,
    },
    pro: {
      regular: 100,
      founder: 75,
    },
    proPlus: {
      regular: 200,
      founder: 140,
    },
  },
  'Australia': {
    band: 'C',
    currency: 'AUD',
    currencySymbol: '$',
    basic: 0,
    standard: {
      regular: 40,
      founder: 28,
    },
    pro: {
      regular: 115,
      founder: 86,
    },
    proPlus: {
      regular: 230,
      founder: 161,
    },
  },
  'United States': {
    band: 'D',
    currency: 'USD',
    currencySymbol: '$',
    basic: 0,
    standard: {
      regular: 29,
      founder: 20,
    },
    pro: {
      regular: 99,
      founder: 74,
    },
    proPlus: {
      regular: 199,
      founder: 139,
    },
  },
};

export const FOUNDER_PRICING_CAP_PER_COUNTRY = 300;

export function formatPrice(amount: number, currencySymbol: string): string {
  if (amount === 0) return 'Free';
  
  const formattedAmount = amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  
  return `${currencySymbol}${formattedAmount}`;
}

export function getPricingForCountry(country: string): CountryPricing | null {
  return COUNTRY_PRICING[country] || null;
}
