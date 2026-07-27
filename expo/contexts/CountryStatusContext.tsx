import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { getCountryStatusInfo } from '@/utils/countryStatus';

export const [CountryStatusProvider, useCountryStatus] = createContextHook(() => {
  const { countryCode, countryName } = useUserLocation();
  const { verifiedVendors } = useVendorFilter();

  const statusInfo = useMemo(() => {
    const vendorCount = verifiedVendors.length;
    const name = countryName || 'your region';
    const code = countryCode || '';

    const info = getCountryStatusInfo(code, name, vendorCount);
    console.log('[COUNTRY_STATUS] Discovery visible:', info.discoveryVisible, '| vendors:', vendorCount, '/', info.discoveryThreshold);
    return info;
  }, [countryCode, countryName, verifiedVendors.length]);

  return useMemo(() => ({
    ...statusInfo,
  }), [statusInfo]);
});
