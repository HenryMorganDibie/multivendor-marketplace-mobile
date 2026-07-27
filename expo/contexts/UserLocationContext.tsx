import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { 
  CountryInfo, 
  COUNTRIES, 
  getCountryByCode, 
  COUNTRY_CHANGE_COOLDOWN_DAYS,
  SUSPICIOUS_COOLDOWN_DAYS 
} from '@/constants/countries';
import { Region, getRegionsByCountry, getRegionById } from '@/constants/regions';

const LOCATION_STORAGE_KEY = '@the platform_user_location';
const LOCATION_LOG_KEY = '@the platform_location_log';

interface UserLocation {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  currencySymbol: string;
  regionId: string | null;
  regionName: string | null;
  city: string | null;
  area: string | null;
  lastCountryChange: string | null;
  isOnboarded: boolean;
  hasCompletedInitialLocationSetup: boolean;
}

interface LocationChangeLog {
  id: string;
  timestamp: string;
  oldCountry: string;
  newCountry: string;
  oldCurrency: string;
  newCurrency: string;
  deviceHash: string;
  reason: string;
  riskScore: number;
}

interface CountryChangeResult {
  success: boolean;
  error?: string;
}

const DEFAULT_LOCATION: UserLocation = {
  countryCode: '',
  countryName: '',
  currencyCode: '',
  currencySymbol: '',
  regionId: null,
  regionName: null,
  city: null,
  area: null,
  lastCountryChange: null,
  isOnboarded: false,
  hasCompletedInitialLocationSetup: false,
};

function generateDeviceHash(): string {
  const platform = Platform.OS;
  const timestamp = Date.now();
  return `${platform}_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
}

function calculateRiskScore(
  oldCountry: string, 
  newCountry: string, 
  changeHistory: LocationChangeLog[]
): number {
  let score = 0;
  
  const recentChanges = changeHistory.filter(log => {
    const changeDate = new Date(log.timestamp);
    const daysSinceChange = (Date.now() - changeDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceChange < 365;
  });
  
  if (recentChanges.length > 2) {
    score += 30;
  }
  
  const lastChange = changeHistory[changeHistory.length - 1];
  if (lastChange && lastChange.newCountry === oldCountry && lastChange.oldCountry === newCountry) {
    score += 20;
  }
  
  return Math.min(score, 100);
}

export const [UserLocationProvider, useUserLocation] = createContextHook(() => {
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [isLoading, setIsLoading] = useState(true);
  const [changeHistory, setChangeHistory] = useState<LocationChangeLog[]>([]);
  const [onCountryChangeCallback, setOnCountryChangeCallback] = useState<(() => void) | null>(null);

  const loadLocation = async () => {
    try {
      console.log('[LOCATION] Loading user location from storage');
      const stored = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setLocation(parsed);
        console.log('[LOCATION] Loaded location:', parsed.countryCode, parsed.currencyCode);
      } else {
        console.log('[LOCATION] No stored location, using default:', DEFAULT_LOCATION.countryCode);
      }
      
      const logsStored = await AsyncStorage.getItem(LOCATION_LOG_KEY);
      if (logsStored) {
        setChangeHistory(JSON.parse(logsStored));
      }
    } catch (error) {
      console.error('[LOCATION] Failed to load location:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLocation();
  }, []);

  const saveLocation = async (newLocation: UserLocation) => {
    try {
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLocation));
      setLocation(newLocation);
      console.log('[LOCATION] Saved location:', newLocation.countryCode, newLocation.currencyCode);
    } catch (error) {
      console.error('[LOCATION] Failed to save location:', error);
    }
  };

  const logLocationChange = useCallback(async (log: LocationChangeLog, currentHistory: LocationChangeLog[]) => {
    try {
      const newHistory = [...currentHistory, log];
      await AsyncStorage.setItem(LOCATION_LOG_KEY, JSON.stringify(newHistory));
      setChangeHistory(newHistory);
      console.log('[LOCATION] Logged country change:', log);
    } catch (error) {
      console.error('[LOCATION] Failed to log change:', error);
    }
  }, []);

  const setInitialCountry = useCallback(async (countryCode: string, regionId?: string, city?: string, area?: string): Promise<boolean> => {
    const country = getCountryByCode(countryCode);
    if (!country) {
      console.error('[LOCATION] Invalid country code:', countryCode);
      return false;
    }

    let selectedRegion: Region | undefined;
    if (regionId) {
      selectedRegion = getRegionById(regionId);
    } else {
      const regions = getRegionsByCountry(countryCode);
      selectedRegion = regions[0];
    }

    const newLocation: UserLocation = {
      countryCode: country.code,
      countryName: country.name,
      currencyCode: country.currencyCode,
      currencySymbol: country.currencySymbol,
      regionId: selectedRegion?.id || null,
      regionName: selectedRegion?.name || null,
      city: city ?? null,
      area: area ?? null,
      lastCountryChange: new Date().toISOString(),
      isOnboarded: true,
      hasCompletedInitialLocationSetup: true,
    };

    await saveLocation(newLocation);
    
    const log: LocationChangeLog = {
      id: `loc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      oldCountry: 'NONE',
      newCountry: country.code,
      oldCurrency: 'NONE',
      newCurrency: country.currencyCode,
      deviceHash: generateDeviceHash(),
      reason: 'initial_setup',
      riskScore: 0,
    };
    await logLocationChange(log, []);

    console.log('[LOCATION] Initial country set:', country.code, country.currencyCode);
    return true;
  }, [logLocationChange]);

  const getDaysUntilCountryChange = useCallback((): number => {
    if (!location.lastCountryChange) return 0;
    
    const lastChange = new Date(location.lastCountryChange);
    const now = new Date();
    const daysSinceChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
    
    const riskScore = changeHistory.length > 0 
      ? changeHistory[changeHistory.length - 1].riskScore 
      : 0;
    const cooldownDays = riskScore >= 50 ? SUSPICIOUS_COOLDOWN_DAYS : COUNTRY_CHANGE_COOLDOWN_DAYS;
    
    const daysRemaining = cooldownDays - daysSinceChange;
    return Math.max(0, daysRemaining);
  }, [location.lastCountryChange, changeHistory]);

  const canChangeCountry = useCallback((): boolean => {
    return getDaysUntilCountryChange() === 0;
  }, [getDaysUntilCountryChange]);

  const requestCountryChange = useCallback(async (
    newCountryCode: string, 
    reason: string
  ): Promise<CountryChangeResult> => {
    console.log('[LOCATION] Country change requested:', newCountryCode, reason);
    
    if (!canChangeCountry()) {
      const daysLeft = getDaysUntilCountryChange();
      return {
        success: false,
        error: `You can change your country in ${daysLeft} days.`,
      };
    }

    const newCountry = getCountryByCode(newCountryCode);
    if (!newCountry) {
      return {
        success: false,
        error: 'Invalid country selected.',
      };
    }

    if (newCountryCode === location.countryCode) {
      return {
        success: false,
        error: 'You are already in this country.',
      };
    }

    const riskScore = calculateRiskScore(location.countryCode, newCountryCode, changeHistory);
    
    const log: LocationChangeLog = {
      id: `loc_${Date.now()}`,
      timestamp: new Date().toISOString(),
      oldCountry: location.countryCode,
      newCountry: newCountry.code,
      oldCurrency: location.currencyCode,
      newCurrency: newCountry.currencyCode,
      deviceHash: generateDeviceHash(),
      reason,
      riskScore,
    };

    const regions = getRegionsByCountry(newCountry.code);
    const defaultRegion = regions[0];

    const newLocation: UserLocation = {
      countryCode: newCountry.code,
      countryName: newCountry.name,
      currencyCode: newCountry.currencyCode,
      currencySymbol: newCountry.currencySymbol,
      regionId: defaultRegion?.id || null,
      regionName: defaultRegion?.name || null,
      city: null,
      area: null,
      lastCountryChange: new Date().toISOString(),
      isOnboarded: true,
      hasCompletedInitialLocationSetup: true,
    };

    await saveLocation(newLocation);
    await logLocationChange(log, changeHistory);

    if (onCountryChangeCallback) {
      onCountryChangeCallback();
    }

    console.log('[LOCATION] Country changed successfully:', newCountry.code, newCountry.currencyCode);

    return { success: true };
  }, [location, changeHistory, canChangeCountry, getDaysUntilCountryChange, onCountryChangeCallback, logLocationChange]);

  const registerOnCountryChange = useCallback((callback: () => void) => {
    setOnCountryChangeCallback(() => callback);
  }, []);

  const getAvailableCountries = useCallback((): CountryInfo[] => {
    return COUNTRIES;
  }, []);

  const getLocationChangeHistory = useCallback((): LocationChangeLog[] => {
    return changeHistory;
  }, [changeHistory]);

  const setRegion = useCallback(async (regionId: string, city?: string) => {
    const region = getRegionById(regionId);
    if (!region) {
      console.error('[LOCATION] Invalid region ID:', regionId);
      return;
    }

    // If the region belongs to a different country than the current location
    // (e.g. just after setInitialCountry where state hasn't propagated yet, or
    // when the user explicitly picks a region from another country), sync the
    // country fields from the region instead of erroring out.
    let base = location;
    if (region.countryCode !== location.countryCode) {
      const country = getCountryByCode(region.countryCode);
      if (!country) {
        console.warn('[LOCATION] Region country has no matching country entry:', region.countryCode);
        return;
      }
      base = {
        ...location,
        countryCode: country.code,
        countryName: country.name,
        currencyCode: country.currencyCode,
        currencySymbol: country.currencySymbol,
      };
    }

    const newLocation: UserLocation = {
      ...base,
      regionId: region.id,
      regionName: region.name,
      city: city || null,
      area: null,
    };

    await saveLocation(newLocation);
    console.log('[LOCATION] Region updated:', region.name, city || '');
  }, [location]);

  const setArea = useCallback(async (area: string | null) => {
    const newLocation: UserLocation = {
      ...location,
      area: area || null,
    };
    await saveLocation(newLocation);
    console.log('[LOCATION] Area updated:', area || '(cleared)');
  }, [location]);

  const getAvailableRegions = useCallback((): Region[] => {
    return getRegionsByCountry(location.countryCode);
  }, [location.countryCode]);

  return {
    countryCode: location.countryCode,
    countryName: location.countryName,
    currencyCode: location.currencyCode,
    currencySymbol: location.currencySymbol,
    regionId: location.regionId,
    regionName: location.regionName,
    city: location.city,
    area: location.area,
    isOnboarded: location.isOnboarded,
    hasCompletedInitialLocationSetup: location.hasCompletedInitialLocationSetup,
    isLoading,
    setInitialCountry,
    setRegion,
    setArea,
    canChangeCountry,
    getDaysUntilCountryChange,
    requestCountryChange,
    getAvailableCountries,
    getAvailableRegions,
    getLocationChangeHistory,
    registerOnCountryChange,
  };
});
