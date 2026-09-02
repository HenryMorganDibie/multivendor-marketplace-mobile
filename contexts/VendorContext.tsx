import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Vendor, mockVendor } from "@/mocks/vendorData";

const VENDOR_PROFILE_STORAGE_KEY = '@platform_vendor_profile';

type VendorContextType = {
  vendor: Vendor;
  updateVendor: (updates: Partial<Vendor>) => void;
  isLoading: boolean;
};

const VendorContext = createContext<VendorContextType | undefined>(undefined);

export const VendorProvider = ({ children }: { children: React.ReactNode }) => {
  const [vendor, setVendor] = useState<Vendor>(mockVendor);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadVendorProfile = async () => {
      try {
        const stored = await AsyncStorage.getItem(VENDOR_PROFILE_STORAGE_KEY);
        if (stored) {
          const storedProfile = JSON.parse(stored) as Partial<Vendor>;
          console.log('[VendorContext] Loaded vendor profile from storage:', storedProfile.name);
          setVendor(prev => ({ ...prev, ...storedProfile }));
        }
      } catch (error) {
        console.error('[VendorContext] Failed to load vendor profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    void loadVendorProfile();
  }, []);

  const updateVendor = useCallback((updates: Partial<Vendor>) => {
    console.log('[VendorContext] updateVendor called with:', updates);
    setVendor(prev => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem(VENDOR_PROFILE_STORAGE_KEY, JSON.stringify(updated)).catch(
        (err) => console.error('[VendorContext] Failed to save vendor profile:', err)
      );
      return updated;
    });
  }, []);

  const value = useMemo(() => ({ vendor, updateVendor, isLoading }), [vendor, updateVendor, isLoading]);

  return (
    <VendorContext.Provider value={value}>
      {children}
    </VendorContext.Provider>
  );
};

export const useVendor = (): VendorContextType => {
  const context = useContext(VendorContext);
  if (!context) {
    throw new Error('[useVendor] Must be used within VendorProvider');
  }
  return context;
};

export { VENDOR_PROFILE_STORAGE_KEY };
