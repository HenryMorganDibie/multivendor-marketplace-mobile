export interface AreaInfo {
  name: string;
  regionId: string;
}

const LAGOS_AREAS: AreaInfo[] = [
  { name: 'Lekki', regionId: 'NG-LA' },
  { name: 'Victoria Island', regionId: 'NG-LA' },
  { name: 'Ikeja', regionId: 'NG-LA' },
  { name: 'Surulere', regionId: 'NG-LA' },
  { name: 'Yaba', regionId: 'NG-LA' },
  { name: 'Ajah', regionId: 'NG-LA' },
  { name: 'Ikoyi', regionId: 'NG-LA' },
  { name: 'Maryland', regionId: 'NG-LA' },
  { name: 'Festac', regionId: 'NG-LA' },
  { name: 'Oshodi', regionId: 'NG-LA' },
  { name: 'Ogba', regionId: 'NG-LA' },
  { name: 'Gbagada', regionId: 'NG-LA' },
  { name: 'Magodo', regionId: 'NG-LA' },
  { name: 'Ilupeju', regionId: 'NG-LA' },
  { name: 'Apapa', regionId: 'NG-LA' },
  { name: 'Mushin', regionId: 'NG-LA' },
  { name: 'Ojodu', regionId: 'NG-LA' },
  { name: 'Ogudu', regionId: 'NG-LA' },
  { name: 'Alimosho', regionId: 'NG-LA' },
  { name: 'Isolo', regionId: 'NG-LA' },
];

const ABUJA_AREAS: AreaInfo[] = [
  { name: 'Asokoro', regionId: 'NG-FC' },
  { name: 'Maitama', regionId: 'NG-FC' },
  { name: 'Wuse 2', regionId: 'NG-FC' },
  { name: 'Garki', regionId: 'NG-FC' },
  { name: 'Gwarinpa', regionId: 'NG-FC' },
  { name: 'Jabi', regionId: 'NG-FC' },
  { name: 'Kubwa', regionId: 'NG-FC' },
  { name: 'Lugbe', regionId: 'NG-FC' },
  { name: 'Utako', regionId: 'NG-FC' },
  { name: 'Wuye', regionId: 'NG-FC' },
  { name: 'Karu', regionId: 'NG-FC' },
  { name: 'Nyanya', regionId: 'NG-FC' },
  { name: 'Durumi', regionId: 'NG-FC' },
  { name: 'Gudu', regionId: 'NG-FC' },
  { name: 'Life Camp', regionId: 'NG-FC' },
];

const RIVERS_AREAS: AreaInfo[] = [
  { name: 'Port Harcourt GRA', regionId: 'NG-RI' },
  { name: 'Obio-Akpor', regionId: 'NG-RI' },
  { name: 'Eleme', regionId: 'NG-RI' },
  { name: 'Rumuokwuta', regionId: 'NG-RI' },
  { name: 'Trans Amadi', regionId: 'NG-RI' },
  { name: 'Rumuola', regionId: 'NG-RI' },
  { name: 'D-Line', regionId: 'NG-RI' },
  { name: 'Old GRA', regionId: 'NG-RI' },
];

const OYO_AREAS: AreaInfo[] = [
  { name: 'Bodija', regionId: 'NG-OY' },
  { name: 'Ring Road', regionId: 'NG-OY' },
  { name: 'Challenge', regionId: 'NG-OY' },
  { name: 'Mokola', regionId: 'NG-OY' },
  { name: 'Dugbe', regionId: 'NG-OY' },
  { name: 'Ojoo', regionId: 'NG-OY' },
  { name: 'UI Area', regionId: 'NG-OY' },
  { name: 'Agodi', regionId: 'NG-OY' },
];

const KANO_AREAS: AreaInfo[] = [
  { name: 'Nassarawa GRA', regionId: 'NG-KN' },
  { name: 'Sabon Gari', regionId: 'NG-KN' },
  { name: 'Bompai', regionId: 'NG-KN' },
  { name: 'Tarauni', regionId: 'NG-KN' },
  { name: 'Fagge', regionId: 'NG-KN' },
];

const KADUNA_AREAS: AreaInfo[] = [
  { name: 'Barnawa', regionId: 'NG-KD' },
  { name: 'Malali', regionId: 'NG-KD' },
  { name: 'Ungwan Rimi', regionId: 'NG-KD' },
  { name: 'Kakuri', regionId: 'NG-KD' },
  { name: 'Sabon Tasha', regionId: 'NG-KD' },
];

const EDO_AREAS: AreaInfo[] = [
  { name: 'GRA Benin', regionId: 'NG-ED' },
  { name: 'Ring Road', regionId: 'NG-ED' },
  { name: 'Uselu', regionId: 'NG-ED' },
  { name: 'Sapele Road', regionId: 'NG-ED' },
  { name: 'Ugbowo', regionId: 'NG-ED' },
];

const DELTA_AREAS: AreaInfo[] = [
  { name: 'Warri', regionId: 'NG-DE' },
  { name: 'Asaba', regionId: 'NG-DE' },
  { name: 'Effurun', regionId: 'NG-DE' },
  { name: 'Ughelli', regionId: 'NG-DE' },
];

const ANAMBRA_AREAS: AreaInfo[] = [
  { name: 'Onitsha', regionId: 'NG-AN' },
  { name: 'Awka', regionId: 'NG-AN' },
  { name: 'Nnewi', regionId: 'NG-AN' },
  { name: 'Ekwulobia', regionId: 'NG-AN' },
];

const ENUGU_AREAS: AreaInfo[] = [
  { name: 'Independence Layout', regionId: 'NG-EN' },
  { name: 'New Haven', regionId: 'NG-EN' },
  { name: 'GRA Enugu', regionId: 'NG-EN' },
  { name: 'Trans Ekulu', regionId: 'NG-EN' },
  { name: 'Achara Layout', regionId: 'NG-EN' },
];

const IMO_AREAS: AreaInfo[] = [
  { name: 'Owerri GRA', regionId: 'NG-IM' },
  { name: 'New Owerri', regionId: 'NG-IM' },
  { name: 'World Bank', regionId: 'NG-IM' },
  { name: 'Orji', regionId: 'NG-IM' },
];

const OGUN_AREAS: AreaInfo[] = [
  { name: 'Abeokuta GRA', regionId: 'NG-OG' },
  { name: 'Sagamu', regionId: 'NG-OG' },
  { name: 'Ijebu-Ode', regionId: 'NG-OG' },
  { name: 'Ota', regionId: 'NG-OG' },
];

const CROSS_RIVER_AREAS: AreaInfo[] = [
  { name: 'Calabar GRA', regionId: 'NG-CR' },
  { name: 'State Housing', regionId: 'NG-CR' },
  { name: 'Atimbo', regionId: 'NG-CR' },
  { name: 'Ikot Ansa', regionId: 'NG-CR' },
];

const TEXAS_AREAS: AreaInfo[] = [
  { name: 'Downtown Houston', regionId: 'US-TX' },
  { name: 'Midtown Houston', regionId: 'US-TX' },
  { name: 'The Heights', regionId: 'US-TX' },
  { name: 'Galleria', regionId: 'US-TX' },
  { name: 'Deep Ellum Dallas', regionId: 'US-TX' },
  { name: 'Uptown Dallas', regionId: 'US-TX' },
  { name: 'Downtown Austin', regionId: 'US-TX' },
  { name: 'South Congress', regionId: 'US-TX' },
];

const CALIFORNIA_AREAS: AreaInfo[] = [
  { name: 'Hollywood', regionId: 'US-CA' },
  { name: 'Santa Monica', regionId: 'US-CA' },
  { name: 'Downtown LA', regionId: 'US-CA' },
  { name: 'Venice', regionId: 'US-CA' },
  { name: 'Mission District SF', regionId: 'US-CA' },
  { name: 'SoMa SF', regionId: 'US-CA' },
  { name: 'Marina District SF', regionId: 'US-CA' },
];

const NEW_YORK_AREAS: AreaInfo[] = [
  { name: 'Manhattan', regionId: 'US-NY' },
  { name: 'Brooklyn', regionId: 'US-NY' },
  { name: 'Queens', regionId: 'US-NY' },
  { name: 'Harlem', regionId: 'US-NY' },
  { name: 'Williamsburg', regionId: 'US-NY' },
  { name: 'SoHo', regionId: 'US-NY' },
];

const FLORIDA_AREAS: AreaInfo[] = [
  { name: 'South Beach', regionId: 'US-FL' },
  { name: 'Brickell', regionId: 'US-FL' },
  { name: 'Wynwood', regionId: 'US-FL' },
  { name: 'Coral Gables', regionId: 'US-FL' },
  { name: 'Little Havana', regionId: 'US-FL' },
];

const ONTARIO_AREAS: AreaInfo[] = [
  { name: 'Downtown Toronto', regionId: 'CA-ON' },
  { name: 'Yorkville', regionId: 'CA-ON' },
  { name: 'Kensington Market', regionId: 'CA-ON' },
  { name: 'Liberty Village', regionId: 'CA-ON' },
  { name: 'Scarborough', regionId: 'CA-ON' },
  { name: 'North York', regionId: 'CA-ON' },
  { name: 'Etobicoke', regionId: 'CA-ON' },
];

const QUEBEC_AREAS: AreaInfo[] = [
  { name: 'Old Montreal', regionId: 'CA-QC' },
  { name: 'Plateau Mont-Royal', regionId: 'CA-QC' },
  { name: 'Mile End', regionId: 'CA-QC' },
  { name: 'Griffintown', regionId: 'CA-QC' },
  { name: 'Westmount', regionId: 'CA-QC' },
];

const BC_AREAS: AreaInfo[] = [
  { name: 'Downtown Vancouver', regionId: 'CA-BC' },
  { name: 'Kitsilano', regionId: 'CA-BC' },
  { name: 'Gastown', regionId: 'CA-BC' },
  { name: 'Yaletown', regionId: 'CA-BC' },
  { name: 'Commercial Drive', regionId: 'CA-BC' },
];

const AREAS_BY_REGION: Record<string, AreaInfo[]> = {
  'NG-LA': LAGOS_AREAS,
  'NG-FC': ABUJA_AREAS,
  'NG-RI': RIVERS_AREAS,
  'NG-OY': OYO_AREAS,
  'NG-KN': KANO_AREAS,
  'NG-KD': KADUNA_AREAS,
  'NG-ED': EDO_AREAS,
  'NG-DE': DELTA_AREAS,
  'NG-AN': ANAMBRA_AREAS,
  'NG-EN': ENUGU_AREAS,
  'NG-IM': IMO_AREAS,
  'NG-OG': OGUN_AREAS,
  'NG-CR': CROSS_RIVER_AREAS,
  'US-TX': TEXAS_AREAS,
  'US-CA': CALIFORNIA_AREAS,
  'US-NY': NEW_YORK_AREAS,
  'US-FL': FLORIDA_AREAS,
  'CA-ON': ONTARIO_AREAS,
  'CA-QC': QUEBEC_AREAS,
  'CA-BC': BC_AREAS,
};

export function getAreasByRegion(regionId: string): AreaInfo[] {
  return AREAS_BY_REGION[regionId] ?? [];
}

export function getAreaByName(name: string, regionId: string): AreaInfo | undefined {
  const areas = getAreasByRegion(regionId);
  return areas.find(a => a.name.toLowerCase() === name.toLowerCase());
}
