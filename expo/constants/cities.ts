export interface CityInfo {
  name: string;
  regionId: string;
  regionName: string;
  countryCode: string;
}

export const NIGERIAN_CITIES: CityInfo[] = [
  { name: 'Lekki', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Victoria Island', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Ikeja', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Surulere', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Yaba', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Ajah', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Ikoyi', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Maryland', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Festac', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },
  { name: 'Oshodi', regionId: 'NG-LA', regionName: 'Lagos', countryCode: 'NG' },

  { name: 'Wuse 2', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Garki', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Maitama', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Asokoro', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Gwarinpa', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Jabi', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },
  { name: 'Kubwa', regionId: 'NG-FC', regionName: 'Abuja', countryCode: 'NG' },

  { name: 'Port Harcourt', regionId: 'NG-RI', regionName: 'Rivers', countryCode: 'NG' },
  { name: 'Obio-Akpor', regionId: 'NG-RI', regionName: 'Rivers', countryCode: 'NG' },

  { name: 'Ibadan', regionId: 'NG-OY', regionName: 'Oyo', countryCode: 'NG' },
  { name: 'Ogbomosho', regionId: 'NG-OY', regionName: 'Oyo', countryCode: 'NG' },

  { name: 'Kano City', regionId: 'NG-KN', regionName: 'Kano', countryCode: 'NG' },
  { name: 'Kaduna City', regionId: 'NG-KD', regionName: 'Kaduna', countryCode: 'NG' },
  { name: 'Benin City', regionId: 'NG-ED', regionName: 'Edo', countryCode: 'NG' },
  { name: 'Warri', regionId: 'NG-DE', regionName: 'Delta', countryCode: 'NG' },
  { name: 'Asaba', regionId: 'NG-DE', regionName: 'Delta', countryCode: 'NG' },
  { name: 'Enugu City', regionId: 'NG-EN', regionName: 'Enugu', countryCode: 'NG' },
  { name: 'Onitsha', regionId: 'NG-AN', regionName: 'Anambra', countryCode: 'NG' },
  { name: 'Awka', regionId: 'NG-AN', regionName: 'Anambra', countryCode: 'NG' },
  { name: 'Owerri', regionId: 'NG-IM', regionName: 'Imo', countryCode: 'NG' },
  { name: 'Aba', regionId: 'NG-AB', regionName: 'Abia', countryCode: 'NG' },
  { name: 'Uyo', regionId: 'NG-AK', regionName: 'Akwa Ibom', countryCode: 'NG' },
  { name: 'Calabar', regionId: 'NG-CR', regionName: 'Cross River', countryCode: 'NG' },
  { name: 'Akure', regionId: 'NG-ON', regionName: 'Ondo', countryCode: 'NG' },
  { name: 'Osogbo', regionId: 'NG-OS', regionName: 'Osun', countryCode: 'NG' },
  { name: 'Abeokuta', regionId: 'NG-OG', regionName: 'Ogun', countryCode: 'NG' },
  { name: 'Ado-Ekiti', regionId: 'NG-EK', regionName: 'Ekiti', countryCode: 'NG' },
  { name: 'Ilorin', regionId: 'NG-KW', regionName: 'Kwara', countryCode: 'NG' },
  { name: 'Jos', regionId: 'NG-PL', regionName: 'Plateau', countryCode: 'NG' },
  { name: 'Makurdi', regionId: 'NG-BE', regionName: 'Benue', countryCode: 'NG' },
];

export const US_CITIES: CityInfo[] = [
  { name: 'Houston', regionId: 'US-TX', regionName: 'Texas', countryCode: 'US' },
  { name: 'Dallas', regionId: 'US-TX', regionName: 'Texas', countryCode: 'US' },
  { name: 'Austin', regionId: 'US-TX', regionName: 'Texas', countryCode: 'US' },
  { name: 'Los Angeles', regionId: 'US-CA', regionName: 'California', countryCode: 'US' },
  { name: 'San Francisco', regionId: 'US-CA', regionName: 'California', countryCode: 'US' },
  { name: 'New York City', regionId: 'US-NY', regionName: 'New York', countryCode: 'US' },
  { name: 'Miami', regionId: 'US-FL', regionName: 'Florida', countryCode: 'US' },
  { name: 'Chicago', regionId: 'US-IL', regionName: 'Illinois', countryCode: 'US' },
  { name: 'Atlanta', regionId: 'US-GA', regionName: 'Georgia', countryCode: 'US' },
];

export const CANADIAN_CITIES: CityInfo[] = [
  { name: 'Toronto', regionId: 'CA-ON', regionName: 'Ontario', countryCode: 'CA' },
  { name: 'Ottawa', regionId: 'CA-ON', regionName: 'Ontario', countryCode: 'CA' },
  { name: 'Montreal', regionId: 'CA-QC', regionName: 'Quebec', countryCode: 'CA' },
  { name: 'Vancouver', regionId: 'CA-BC', regionName: 'British Columbia', countryCode: 'CA' },
  { name: 'Calgary', regionId: 'CA-AB', regionName: 'Alberta', countryCode: 'CA' },
];

export const ALL_CITIES: CityInfo[] = [
  ...NIGERIAN_CITIES,
  ...US_CITIES,
  ...CANADIAN_CITIES,
];

export function getCitiesByRegion(regionId: string): CityInfo[] {
  return ALL_CITIES.filter(c => c.regionId === regionId);
}

export function getCitiesByCountry(countryCode: string): CityInfo[] {
  return ALL_CITIES.filter(c => c.countryCode === countryCode);
}

export function getCityByName(name: string, regionId: string): CityInfo | undefined {
  return ALL_CITIES.find(
    c => c.name.toLowerCase() === name.toLowerCase() && c.regionId === regionId
  );
}
