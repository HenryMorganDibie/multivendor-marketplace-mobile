import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, ChevronRight, Search, ArrowLeft, Navigation } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { getRegionsByCountry, Region } from '@/constants/regions';
import { getCitiesByRegion, CityInfo } from '@/constants/cities';
import { CountryInfo } from '@/constants/countries';

type Step = 'country' | 'region' | 'city';

interface LocationSelectorModalProps {
  visible: boolean;
  onComplete: () => void;
}

export default function LocationSelectorModal({ visible, onComplete }: LocationSelectorModalProps) {
  const {
    setInitialCountry,
    setRegion,
    getAvailableCountries,
  } = useUserLocation();

  const [step, setStep] = useState<Step>('country');
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const countries = getAvailableCountries();

  const regions = useMemo(() => {
    if (!selectedCountry) return [];
    return getRegionsByCountry(selectedCountry.code);
  }, [selectedCountry]);

  const cities = useMemo(() => {
    if (!selectedRegion) return [];
    return getCitiesByRegion(selectedRegion.id);
  }, [selectedRegion]);

  const filteredCountries = useMemo(() => {
    if (!searchQuery.trim()) return countries;
    const q = searchQuery.toLowerCase().trim();
    return countries.filter(c => c.name.toLowerCase().includes(q));
  }, [countries, searchQuery]);

  const filteredRegions = useMemo(() => {
    if (!searchQuery.trim()) return regions;
    const q = searchQuery.toLowerCase().trim();
    return regions.filter(r => r.name.toLowerCase().includes(q));
  }, [regions, searchQuery]);

  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) return cities;
    const q = searchQuery.toLowerCase().trim();
    return cities.filter(c => c.name.toLowerCase().includes(q));
  }, [cities, searchQuery]);

  const handleCountrySelect = useCallback((country: CountryInfo) => {
    console.log('[LOCATION_MODAL] Country selected:', country.code);
    setSelectedCountry(country);
    setSelectedRegion(null);
    setSearchQuery('');
    setStep('region');
  }, []);

  const handleRegionSelect = useCallback(async (region: Region) => {
    console.log('[LOCATION_MODAL] Region selected:', region.name);
    setSelectedRegion(region);
    setSearchQuery('');

    const regionCities = getCitiesByRegion(region.id);
    if (regionCities.length > 0) {
      setStep('city');
    } else {
      if (!selectedCountry) return;
      setIsSubmitting(true);
      try {
        const success = await setInitialCountry(selectedCountry.code, region.id);
        if (success) {
          onComplete();
        }
      } catch (error) {
        console.error('[LOCATION_MODAL] Failed to set location:', error);
      } finally {
        setIsSubmitting(false);
      }
    }
  }, [selectedCountry, setInitialCountry, onComplete]);

  const handleCitySelect = useCallback(async (city: CityInfo | null) => {
    console.log('[LOCATION_MODAL] City selected:', city?.name || 'skipped');
    if (!selectedRegion || !selectedCountry) return;
    setIsSubmitting(true);
    try {
      console.log('[LOCATION_MODAL] Finalizing location:', selectedCountry.code, selectedRegion.id, city?.name);
      const success = await setInitialCountry(selectedCountry.code, selectedRegion.id);
      if (success && city) {
        await setRegion(selectedRegion.id, city.name);
      }
      if (success) {
        console.log('[LOCATION_MODAL] Location set successfully');
        onComplete();
      }
    } catch (error) {
      console.error('[LOCATION_MODAL] Failed to set location:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedRegion, selectedCountry, setInitialCountry, setRegion, onComplete]);

  const handleBack = useCallback(() => {
    setSearchQuery('');
    if (step === 'city') {
      setStep('region');
      setSelectedRegion(null);
    } else if (step === 'region') {
      setStep('country');
      setSelectedCountry(null);
    }
  }, [step]);

  const getStepTitle = () => {
    switch (step) {
      case 'country': return 'Select your country';
      case 'region': return `Select your state`;
      case 'city': return 'Select your city';
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case 'country': return 'This determines your currency and available vendors';
      case 'region': return `Choose your state in ${selectedCountry?.name}`;
      case 'city': return `Choose your city in ${selectedRegion?.name} (optional)`;
    }
  };

  const getSearchPlaceholder = () => {
    switch (step) {
      case 'country': return 'Search countries...';
      case 'region': return 'Search states...';
      case 'city': return 'Search cities...';
    }
  };

  const stepNumber = step === 'country' ? 1 : step === 'region' ? 2 : 3;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            {step !== 'country' ? (
              <TouchableOpacity
                onPress={handleBack}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <ArrowLeft size={22} color={Colors.text} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            <View style={styles.headerCenter}>
              <View style={styles.stepIndicator}>
                {[1, 2, 3].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.stepDot,
                      i <= stepNumber && styles.stepDotActive,
                      i < stepNumber && styles.stepDotCompleted,
                    ]}
                  />
                ))}
              </View>
            </View>
            <View style={styles.backButton} />
          </View>

          <View style={styles.titleSection}>
            <View style={styles.titleIconRow}>
              <View style={styles.titleIcon}>
                <Navigation size={20} color={Colors.primary} />
              </View>
              <Text style={styles.title}>{getStepTitle()}</Text>
            </View>
            <Text style={styles.subtitle}>{getStepSubtitle()}</Text>
          </View>

          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={getSearchPlaceholder()}
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
        </SafeAreaView>

        {isSubmitting ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Setting up your location...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.listContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 'country' && (
              <View style={styles.listCard}>
                {filteredCountries.map((country, index) => (
                  <React.Fragment key={country.code}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => handleCountrySelect(country)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.flagText}>{country.flag}</Text>
                      <View style={styles.listRowContent}>
                        <Text style={styles.listRowTitle}>{country.name}</Text>
                        <Text style={styles.listRowMeta}>
                          {country.currencySymbol} {country.currencyName}
                        </Text>
                      </View>
                      <ChevronRight size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {index < filteredCountries.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
                {filteredCountries.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No countries found</Text>
                  </View>
                )}
              </View>
            )}

            {step === 'region' && (
              <View style={styles.listCard}>
                {filteredRegions.map((region, index) => (
                  <React.Fragment key={region.id}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => handleRegionSelect(region)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.regionIcon}>
                        <MapPin size={16} color={Colors.primary} />
                      </View>
                      <View style={styles.listRowContent}>
                        <Text style={styles.listRowTitle}>{region.name}</Text>
                        <Text style={styles.listRowMeta}>{region.type}</Text>
                      </View>
                      <ChevronRight size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {index < filteredRegions.length - 1 && <View style={styles.divider} />}
                  </React.Fragment>
                ))}
                {filteredRegions.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No states found</Text>
                  </View>
                )}
              </View>
            )}

            {step === 'city' && (
              <>
                <TouchableOpacity
                  style={styles.skipCityButton}
                  onPress={() => handleCitySelect(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.skipCityText}>Skip — use entire state</Text>
                </TouchableOpacity>

                <View style={styles.listCard}>
                  {filteredCities.map((city, index) => (
                    <React.Fragment key={`${city.regionId}-${city.name}`}>
                      <TouchableOpacity
                        style={styles.listRow}
                        onPress={() => handleCitySelect(city)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.regionIcon}>
                          <MapPin size={16} color={Colors.textSecondary} />
                        </View>
                        <View style={styles.listRowContent}>
                          <Text style={styles.listRowTitle}>{city.name}</Text>
                          <Text style={styles.listRowMeta}>{city.regionName}</Text>
                        </View>
                        <ChevronRight size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                      {index < filteredCities.length - 1 && <View style={styles.divider} />}
                    </React.Fragment>
                  ))}
                  {filteredCities.length === 0 && (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>No cities found</Text>
                    </View>
                  )}
                </View>
              </>
            )}

            <View style={{ height: 60 }} />
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  stepIndicator: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  stepDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotCompleted: {
    backgroundColor: Colors.primary,
    opacity: 0.5,
  },
  titleSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  titleIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 6,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 4,
    paddingLeft: 46,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  listRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 15,
    paddingHorizontal: 16,
    gap: 12,
  },
  flagText: {
    fontSize: 28,
  },
  regionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  listRowContent: {
    flex: 1,
  },
  listRowTitle: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  listRowMeta: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 64,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  skipCityButton: {
    alignItems: 'center' as const,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipCityText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
