export interface Region {
  id: string;
  name: string;
  countryCode: string;
  type: 'state' | 'province';
}

export const NIGERIAN_STATES: Region[] = [
  { id: 'NG-LA', name: 'Lagos', countryCode: 'NG', type: 'state' },
  { id: 'NG-FC', name: 'Abuja', countryCode: 'NG', type: 'state' },
  { id: 'NG-RI', name: 'Rivers', countryCode: 'NG', type: 'state' },
  { id: 'NG-OY', name: 'Oyo', countryCode: 'NG', type: 'state' },
  { id: 'NG-KN', name: 'Kano', countryCode: 'NG', type: 'state' },
  { id: 'NG-KD', name: 'Kaduna', countryCode: 'NG', type: 'state' },
  { id: 'NG-ON', name: 'Ondo', countryCode: 'NG', type: 'state' },
  { id: 'NG-OS', name: 'Osun', countryCode: 'NG', type: 'state' },
  { id: 'NG-OG', name: 'Ogun', countryCode: 'NG', type: 'state' },
  { id: 'NG-ED', name: 'Edo', countryCode: 'NG', type: 'state' },
  { id: 'NG-DE', name: 'Delta', countryCode: 'NG', type: 'state' },
  { id: 'NG-AN', name: 'Anambra', countryCode: 'NG', type: 'state' },
  { id: 'NG-EN', name: 'Enugu', countryCode: 'NG', type: 'state' },
  { id: 'NG-AB', name: 'Abia', countryCode: 'NG', type: 'state' },
  { id: 'NG-IM', name: 'Imo', countryCode: 'NG', type: 'state' },
  { id: 'NG-AK', name: 'Akwa Ibom', countryCode: 'NG', type: 'state' },
  { id: 'NG-CR', name: 'Cross River', countryCode: 'NG', type: 'state' },
  { id: 'NG-EB', name: 'Ebonyi', countryCode: 'NG', type: 'state' },
  { id: 'NG-EK', name: 'Ekiti', countryCode: 'NG', type: 'state' },
  { id: 'NG-KW', name: 'Kwara', countryCode: 'NG', type: 'state' },
  { id: 'NG-NG', name: 'Niger', countryCode: 'NG', type: 'state' },
  { id: 'NG-BE', name: 'Benue', countryCode: 'NG', type: 'state' },
  { id: 'NG-PL', name: 'Plateau', countryCode: 'NG', type: 'state' },
  { id: 'NG-BA', name: 'Bauchi', countryCode: 'NG', type: 'state' },
  { id: 'NG-BO', name: 'Borno', countryCode: 'NG', type: 'state' },
  { id: 'NG-GO', name: 'Gombe', countryCode: 'NG', type: 'state' },
  { id: 'NG-AD', name: 'Adamawa', countryCode: 'NG', type: 'state' },
  { id: 'NG-YO', name: 'Yobe', countryCode: 'NG', type: 'state' },
  { id: 'NG-TA', name: 'Taraba', countryCode: 'NG', type: 'state' },
  { id: 'NG-JI', name: 'Jigawa', countryCode: 'NG', type: 'state' },
  { id: 'NG-KT', name: 'Katsina', countryCode: 'NG', type: 'state' },
  { id: 'NG-SO', name: 'Sokoto', countryCode: 'NG', type: 'state' },
  { id: 'NG-ZA', name: 'Zamfara', countryCode: 'NG', type: 'state' },
  { id: 'NG-KE', name: 'Kebbi', countryCode: 'NG', type: 'state' },
  { id: 'NG-NA', name: 'Nasarawa', countryCode: 'NG', type: 'state' },
  { id: 'NG-KO', name: 'Kogi', countryCode: 'NG', type: 'state' },
  { id: 'NG-BY', name: 'Bayelsa', countryCode: 'NG', type: 'state' },
];

export const US_STATES: Region[] = [
  { id: 'US-TX', name: 'Texas', countryCode: 'US', type: 'state' },
  { id: 'US-CA', name: 'California', countryCode: 'US', type: 'state' },
  { id: 'US-NY', name: 'New York', countryCode: 'US', type: 'state' },
  { id: 'US-FL', name: 'Florida', countryCode: 'US', type: 'state' },
  { id: 'US-IL', name: 'Illinois', countryCode: 'US', type: 'state' },
  { id: 'US-PA', name: 'Pennsylvania', countryCode: 'US', type: 'state' },
  { id: 'US-OH', name: 'Ohio', countryCode: 'US', type: 'state' },
  { id: 'US-GA', name: 'Georgia', countryCode: 'US', type: 'state' },
  { id: 'US-NC', name: 'North Carolina', countryCode: 'US', type: 'state' },
  { id: 'US-MI', name: 'Michigan', countryCode: 'US', type: 'state' },
];

export const CANADIAN_PROVINCES: Region[] = [
  { id: 'CA-ON', name: 'Ontario', countryCode: 'CA', type: 'province' },
  { id: 'CA-QC', name: 'Quebec', countryCode: 'CA', type: 'province' },
  { id: 'CA-BC', name: 'British Columbia', countryCode: 'CA', type: 'province' },
  { id: 'CA-AB', name: 'Alberta', countryCode: 'CA', type: 'province' },
  { id: 'CA-MB', name: 'Manitoba', countryCode: 'CA', type: 'province' },
  { id: 'CA-SK', name: 'Saskatchewan', countryCode: 'CA', type: 'province' },
  { id: 'CA-NS', name: 'Nova Scotia', countryCode: 'CA', type: 'province' },
  { id: 'CA-NB', name: 'New Brunswick', countryCode: 'CA', type: 'province' },
  { id: 'CA-NL', name: 'Newfoundland and Labrador', countryCode: 'CA', type: 'province' },
  { id: 'CA-PE', name: 'Prince Edward Island', countryCode: 'CA', type: 'province' },
  { id: 'CA-NT', name: 'Northwest Territories', countryCode: 'CA', type: 'province' },
  { id: 'CA-YT', name: 'Yukon', countryCode: 'CA', type: 'province' },
  { id: 'CA-NU', name: 'Nunavut', countryCode: 'CA', type: 'province' },
];

export const ALL_REGIONS: Region[] = [
  ...NIGERIAN_STATES,
  ...US_STATES,
  ...CANADIAN_PROVINCES,
];

export function getRegionsByCountry(countryCode: string): Region[] {
  switch (countryCode) {
    case 'NG':
      return NIGERIAN_STATES;
    case 'US':
      return US_STATES;
    case 'CA':
      return CANADIAN_PROVINCES;
    default:
      return [];
  }
}

export function getRegionById(regionId: string): Region | undefined {
  return ALL_REGIONS.find(r => r.id === regionId);
}

export function getRegionByName(name: string, countryCode: string): Region | undefined {
  return ALL_REGIONS.find(r => r.name.toLowerCase() === name.toLowerCase() && r.countryCode === countryCode);
}

export function formatLocation(city: string, region: string): string {
  return `${city}, ${region}`;
}
