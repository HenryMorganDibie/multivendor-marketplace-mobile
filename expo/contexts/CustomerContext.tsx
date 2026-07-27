import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useUserLocation } from './UserLocationContext';
import { useFavorites } from './FavoritesContext';
import { useAuth } from './AuthContext';

export const [CustomerProvider, useCustomer] = createContextHook(() => {
  const auth = useAuth();
  const location = useUserLocation();
  const favorites = useFavorites();

  const customerProfile = useMemo(() => ({
    id: auth.user?.id ?? null,
    identifier: auth.user?.identifier ?? null,
    firstName: auth.user?.firstName ?? null,
    lastName: auth.user?.lastName ?? null,
    role: auth.user?.role ?? null,
  }), [auth.user]);

  const customerLocation = useMemo(() => ({
    countryCode: location.countryCode,
    countryName: location.countryName,
    currencyCode: location.currencyCode,
    currencySymbol: location.currencySymbol,
    regionId: location.regionId,
    regionName: location.regionName,
    city: location.city,
    isOnboarded: location.isOnboarded,
    hasCompletedInitialLocationSetup: location.hasCompletedInitialLocationSetup,
    isLoading: location.isLoading,
  }), [location]);

  const customerFavorites = useMemo(() => ({
    favoriteVendorIds: favorites.favoriteVendorIds,
    isFavorite: favorites.isFavorite,
    toggleFavorite: favorites.toggleFavorite,
    addFavorite: favorites.addFavorite,
    removeFavorite: favorites.removeFavorite,
    isLoaded: favorites.isLoaded,
  }), [favorites]);

  const locationLabel = useMemo(() => {
    const parts: string[] = [];
    if (location.city) parts.push(location.city);
    if (location.regionName) parts.push(location.regionName);
    if (location.countryName) parts.push(location.countryName);
    return parts.join(', ') || 'Location not set';
  }, [location.city, location.regionName, location.countryName]);

  return useMemo(() => ({
    profile: customerProfile,
    location: customerLocation,
    favorites: customerFavorites,
    locationLabel,
    isAuthenticated: auth.isAuthenticated,
  }), [customerProfile, customerLocation, customerFavorites, locationLabel, auth.isAuthenticated]);
});
