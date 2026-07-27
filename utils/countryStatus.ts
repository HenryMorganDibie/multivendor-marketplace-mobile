export type CountryStatus = 'ACTIVE' | 'WAITLIST_ONLY' | 'COMING_SOON';

export interface CountryStatusInfo {
  status: CountryStatus;
  countryName: string;
  launchTimeline?: string;
  vendorActivationAllowed: boolean;
  orderingAllowed: boolean;
  discoveryVisible: boolean;
  waitlistRegistrationAllowed: boolean;
}

export interface CountryStatusConfig {
  status: CountryStatus;
  launchTimeline?: string;
}

const COUNTRY_STATUS_MAP: Record<string, CountryStatusConfig> = {
  NG: { status: 'ACTIVE' },
  US: { status: 'COMING_SOON', launchTimeline: 'Q4 2026' },
  CA: { status: 'COMING_SOON', launchTimeline: 'Q4 2026' },
  GB: { status: 'COMING_SOON', launchTimeline: 'Q1 2027' },
  GH: { status: 'WAITLIST_ONLY' },
  KE: { status: 'WAITLIST_ONLY' },
  ZA: { status: 'COMING_SOON', launchTimeline: 'Q2 2027' },
  AE: { status: 'COMING_SOON', launchTimeline: 'Q1 2027' },
  AU: { status: 'COMING_SOON', launchTimeline: 'Q2 2027' },
  DE: { status: 'COMING_SOON', launchTimeline: 'Q1 2027' },
  FR: { status: 'COMING_SOON', launchTimeline: 'Q1 2027' },
  IN: { status: 'COMING_SOON', launchTimeline: 'Q3 2027' },
  JP: { status: 'COMING_SOON', launchTimeline: 'Q3 2027' },
  BR: { status: 'COMING_SOON', launchTimeline: 'Q2 2027' },
  MX: { status: 'COMING_SOON', launchTimeline: 'Q2 2027' },
};

const DEFAULT_STATUS: CountryStatusConfig = { status: 'COMING_SOON' };

export function getCountryStatusByCode(countryCode: string): CountryStatusInfo {
  const config = COUNTRY_STATUS_MAP[countryCode] || DEFAULT_STATUS;
  const countryName = countryCode || 'your region';

  return buildCountryStatusInfo(config.status, countryName, config.launchTimeline);
}

function buildCountryStatusInfo(
  status: CountryStatus,
  countryName: string,
  launchTimeline?: string
): CountryStatusInfo {
  switch (status) {
    case 'ACTIVE':
      return {
        status,
        countryName,
        launchTimeline,
        vendorActivationAllowed: true,
        orderingAllowed: true,
        discoveryVisible: true,
        waitlistRegistrationAllowed: false,
      };
    case 'WAITLIST_ONLY':
      return {
        status,
        countryName,
        launchTimeline,
        vendorActivationAllowed: false,
        orderingAllowed: false,
        discoveryVisible: false,
        waitlistRegistrationAllowed: true,
      };
    case 'COMING_SOON':
      return {
        status,
        countryName,
        launchTimeline,
        vendorActivationAllowed: false,
        orderingAllowed: false,
        discoveryVisible: false,
        waitlistRegistrationAllowed: false,
      };
  }
}

export function getCountryStatus(): CountryStatusInfo {
  return {
    status: 'ACTIVE',
    countryName: 'Nigeria',
    vendorActivationAllowed: true,
    orderingAllowed: true,
    discoveryVisible: true,
    waitlistRegistrationAllowed: false,
  };
}
