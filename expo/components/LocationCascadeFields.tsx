import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { ChevronDown, Search, Check, MapPin, Lock } from 'lucide-react-native';
import type { CountryInfo } from '@/constants/countries';
import { getStateLabel } from '@/constants/states';
import type { StateInfo } from '@/constants/states';
import type { AreaInfo } from '@/constants/areas';
import { useLocationCatalogue } from '@/hooks/useLocationCatalogue';
import ListStateView from '@/components/ListStateView';

/**
 * The lists come from the backend now, not from constants/countries.ts and
 * constants/areas.ts. Those held 17 countries and 134 areas, against 196
 * countries in the catalogue, so a vendor almost anywhere could not register.
 *
 * The backend shapes are mapped onto the local CountryInfo/StateInfo/AreaInfo
 * types rather than replacing them, so every selection handler and modal below
 * keeps working unchanged. countryCode maps to code, stateId to regionId.
 */

/**
 * Placeholder rows while a list loads. Shaped like the real rows so the sheet
 * does not jump when the data arrives.
 */
function LocationListSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <View key={i} style={styles.skeletonRow} />
      ))}
    </View>
  );
}

/**
 * Canonical location shape stored across the app. Matches the backend structure.
 */
export interface LocationValue {
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  areaId: string;
  areaName: string;
}

interface LocationCascadeErrors {
  country?: string;
  state?: string;
  area?: string;
}

interface LocationCascadeFieldsProps {
  value: LocationValue | null;
  onChange: (value: LocationValue | null) => void;
  errors?: LocationCascadeErrors;
  onClearError?: (key: keyof LocationCascadeErrors) => void;
  disabled?: boolean;
  testIDPrefix?: string;
  /** Renders the country selector only, hiding the state and area steps.
   * Used by vendor signup, where country is needed immediately (currency,
   * pricing, availability) but the finer location is deferred to onboarding. */
  countryOnly?: boolean;
  /** Shows the country as a fixed, non-editable row while leaving state and
   * area selectable — the mirror of countryOnly, for the onboarding step that
   * completes what signup deliberately left blank. Country is locked because
   * currency, plan pricing and country availability were all resolved from it
   * when the account was created; state and area carry none of that. */
  lockCountry?: boolean;
}

/**
 * Build a stable area id consistent with the rest of the app.
 * When no area is selected the state region id is used.
 */
function buildAreaId(stateCode: string, areaName: string): string {
  return areaName ? `${stateCode}:${areaName}` : stateCode;
}

/**
 * Format a stored location for display as "Area, State, Country".
 */
export function formatLocationLabel(location: Partial<LocationValue> | null | undefined): string {
  if (!location) return '';
  const parts = [location.areaName, location.stateName, location.countryName].filter(
    (p): p is string => !!p && p.trim().length > 0,
  );
  return parts.join(', ');
}

/**
 * Cascading Country → State → Area dropdown selectors. No free-text entry.
 * State stays disabled until a country is chosen; area until a state is chosen.
 * Emits the canonical {@link LocationValue} object on every change.
 */
export default function LocationCascadeFields({
  value,
  onChange,
  errors,
  onClearError,
  disabled = false,
  testIDPrefix = 'location',
  countryOnly = false,
  lockCountry = false,
}: LocationCascadeFieldsProps) {
  const catalogue = useLocationCatalogue();

  // Countries load as soon as the field is on screen rather than when the modal
  // opens, so the chosen country's name can be shown for an already-saved value
  // without the user having to open the picker first.
  useEffect(() => {
    catalogue.ensureCountries();
  }, [catalogue]);

  // States and areas are fetched only once their parent is chosen. Loading every
  // area for 196 countries to populate one dropdown would be tens of thousands
  // of records for a list of a few dozen.
  useEffect(() => {
    if (value?.countryCode) catalogue.ensureStates(value.countryCode);
  }, [value?.countryCode, catalogue]);

  useEffect(() => {
    if (value?.stateCode) catalogue.ensureAreas(value.stateCode);
  }, [value?.stateCode, catalogue]);

  const countryState = catalogue.countries;
  const stateState = catalogue.statesFor(value?.countryCode ?? '');
  const areaState = catalogue.areasFor(value?.stateCode ?? '');

  // Backend shapes mapped onto the local ones, so nothing downstream changes.
  const countryList = useMemo<CountryInfo[]>(
    () => countryState.items.map((c) => ({
      code: c.countryCode,
      name: c.name,
      currencyCode: c.currencyCode ?? '',
      currencySymbol: '',
      currencyName: '',
      flag: c.flagEmoji ?? '',
    })),
    [countryState.items],
  );

  const stateList = useMemo<StateInfo[]>(
    () => stateState.items.map((st) => ({ name: st.name, regionId: st.stateId })),
    [stateState.items],
  );

  const areaList = useMemo<AreaInfo[]>(
    () => areaState.items.map((a) => ({ name: a.name, regionId: a.locationId })),
    [areaState.items],
  );

  const selectedCountry = useMemo<CountryInfo | null>(
    () => (value?.countryCode ? countryList.find(c => c.code === value.countryCode) ?? null : null),
    [value?.countryCode, countryList],
  );
  const availableStates = stateList;
  const stateLabel = selectedCountry ? getStateLabel(selectedCountry.code) : 'State / Province';
  const selectedState = useMemo<StateInfo | null>(
    () => (value?.stateCode ? availableStates.find(s => s.regionId === value.stateCode) ?? null : null),
    [value?.stateCode, availableStates],
  );
  const availableAreas = areaList;
  const hasAreas = availableAreas.length > 0;
  const selectedArea = useMemo<AreaInfo | null>(
    () => (value?.areaName ? availableAreas.find(a => a.name === value.areaName) ?? null : null),
    [value?.areaName, availableAreas],
  );

  const [showCountryModal, setShowCountryModal] = useState<boolean>(false);
  const [showStateModal, setShowStateModal] = useState<boolean>(false);
  const [showAreaModal, setShowAreaModal] = useState<boolean>(false);
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [stateSearch, setStateSearch] = useState<string>('');
  const [areaSearch, setAreaSearch] = useState<string>('');

  const filteredCountries = countrySearch.trim()
    ? countryList.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
    : countryList;
  const filteredStates = stateSearch.trim()
    ? availableStates.filter(s => s.name.toLowerCase().includes(stateSearch.toLowerCase()))
    : availableStates;
  const filteredAreas = areaSearch.trim()
    ? availableAreas.filter(a => a.name.toLowerCase().includes(areaSearch.toLowerCase()))
    : availableAreas;

  const handleSelectCountry = useCallback((country: CountryInfo) => {
    onChange({
      countryCode: country.code,
      countryName: country.name,
      stateCode: '',
      stateName: '',
      areaId: '',
      areaName: '',
    });
    setShowCountryModal(false);
    setCountrySearch('');
    onClearError?.('country');
  }, [onChange, onClearError]);

  const handleSelectState = useCallback((state: StateInfo) => {
    if (!selectedCountry) return;
    // The new state's areas have not been fetched yet, so there is nothing to
    // check a previous area against. Clearing it is correct regardless: an area
    // from the old state can never be valid under the new one.
    onChange({
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      stateCode: state.regionId,
      stateName: state.name,
      // Left empty rather than falling back to the state id. Whether this state
      // has any areas is not known until they load, and the effect above will
      // fetch them; the area step stays hidden if the answer is none.
      areaId: '',
      areaName: '',
    });
    setShowStateModal(false);
    setStateSearch('');
    onClearError?.('state');
  }, [selectedCountry, onChange, onClearError]);

  const handleSelectArea = useCallback((area: AreaInfo) => {
    if (!selectedCountry || !selectedState) return;
    onChange({
      countryCode: selectedCountry.code,
      countryName: selectedCountry.name,
      stateCode: selectedState.regionId,
      stateName: selectedState.name,
      areaId: buildAreaId(selectedState.regionId, area.name),
      areaName: area.name,
    });
    setShowAreaModal(false);
    setAreaSearch('');
    onClearError?.('area');
  }, [selectedCountry, selectedState, onChange, onClearError]);

  const renderModal = (
    visible: boolean,
    title: string,
    searchValue: string,
    onSearch: (t: string) => void,
    onClose: () => void,
    children: React.ReactNode,
  ) => (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.modalClose}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              value={searchValue}
              onChangeText={onSearch}
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              autoCorrect={false}
            />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );

  return (
    <View>
      <View style={styles.fieldSection}>
        <Text style={styles.label}>Country</Text>
        <TouchableOpacity
          style={[styles.selectorButton, errors?.country ? styles.inputError : null]}
          onPress={() => setShowCountryModal(true)}
          activeOpacity={lockCountry ? 1 : 0.7}
          disabled={disabled || lockCountry}
          testID={`${testIDPrefix}-country`}
        >
          {selectedCountry ? (
            <View style={styles.countryRow}>
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.selectorText}>{selectedCountry.name}</Text>
            </View>
          ) : (
            <Text style={styles.selectorPlaceholder}>Select your country</Text>
          )}
          {lockCountry ? (
            <Lock size={16} color="#9CA3AF" strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
          )}
        </TouchableOpacity>
        {errors?.country ? <Text style={styles.errorText}>{errors.country}</Text> : null}
      </View>

      {/* Each step appears only once the one above it is answered. Previously
          all three rendered at once with the lower two greyed out, so a new
          user met three fields and could use one. A control that exists only to
          say "not yet" is worse than no control: it takes up the space, invites
          a tap, and does nothing. */}
      {!countryOnly && selectedCountry && (
        <View style={styles.fieldSection}>
          <Text style={styles.label}>{stateLabel}</Text>
          <TouchableOpacity
            style={[styles.selectorButton, errors?.state ? styles.inputError : null]}
            onPress={() => setShowStateModal(true)}
            activeOpacity={0.7}
            disabled={disabled}
            testID={`${testIDPrefix}-state`}
          >
            <Text style={[styles.selectorText, !selectedState && styles.selectorPlaceholder]}>
              {selectedState?.name || `Select your ${stateLabel.toLowerCase()}`}
            </Text>
            <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
          </TouchableOpacity>
          {errors?.state ? <Text style={styles.errorText}>{errors.state}</Text> : null}
        </View>
      )}

      {!countryOnly && selectedState && hasAreas && (
        <View style={styles.fieldSection}>
          <Text style={styles.label}>Area / City</Text>
          <TouchableOpacity
            style={[styles.selectorButton, errors?.area ? styles.inputError : null]}
            onPress={() => setShowAreaModal(true)}
            activeOpacity={0.7}
            disabled={disabled}
            testID={`${testIDPrefix}-area`}
          >
            <Text style={[styles.selectorText, !selectedArea && styles.selectorPlaceholder]}>
              {selectedArea?.name || 'Select your area'}
            </Text>
            <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
          </TouchableOpacity>
          {errors?.area ? <Text style={styles.errorText}>{errors.area}</Text> : null}
        </View>
      )}

      {renderModal(showCountryModal, 'Select Country', countrySearch, setCountrySearch, () => { setShowCountryModal(false); setCountrySearch(''); }, (
<ListStateView
          isLoading={countryState.loading}
          isError={!!countryState.error}
          isEmpty={filteredCountries.length === 0}
          onRetry={() => catalogue.retryCountries()}
          emptyIcon={<MapPin size={28} color="#FF8C42" strokeWidth={1.6} />}
          emptyTitle={countrySearch.trim() ? 'Nothing matched your search' : 'No countries available'}
          emptyDescription={countrySearch.trim() ? 'Try a different spelling.' : undefined}
          loadingSkeleton={<LocationListSkeleton />}
        >
        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalItem, selectedCountry?.code === item.code && styles.modalItemSelected]}
              onPress={() => handleSelectCountry(item)}
              activeOpacity={0.7}
            >
              <View style={styles.countryRow}>
                <Text style={styles.countryFlag}>{item.flag}</Text>
                <Text style={[styles.modalItemText, selectedCountry?.code === item.code && styles.modalItemTextSelected]}>{item.name}</Text>
              </View>
              {selectedCountry?.code === item.code && <Check size={18} color="#FF8C42" strokeWidth={2.5} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalList}
        />
        </ListStateView>
      ))}

      {renderModal(showStateModal, `Select ${stateLabel}`, stateSearch, setStateSearch, () => { setShowStateModal(false); setStateSearch(''); }, (
<ListStateView
          isLoading={stateState.loading}
          isError={!!stateState.error}
          isEmpty={filteredStates.length === 0}
          onRetry={() => catalogue.retryStates(value?.countryCode ?? '')}
          emptyIcon={<MapPin size={28} color="#FF8C42" strokeWidth={1.6} />}
          emptyTitle={stateSearch.trim() ? 'Nothing matched your search' : 'No states listed for this country'}
          emptyDescription={stateSearch.trim() ? 'Try a different spelling.' : undefined}
          loadingSkeleton={<LocationListSkeleton />}
        >
        <FlatList
          data={filteredStates}
          keyExtractor={(item) => item.regionId}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalItem, selectedState?.regionId === item.regionId && styles.modalItemSelected]}
              onPress={() => handleSelectState(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalItemText, selectedState?.regionId === item.regionId && styles.modalItemTextSelected]}>{item.name}</Text>
              {selectedState?.regionId === item.regionId && <Check size={18} color="#FF8C42" strokeWidth={2.5} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalList}
        />
        </ListStateView>
      ))}

      {renderModal(showAreaModal, 'Select Area', areaSearch, setAreaSearch, () => { setShowAreaModal(false); setAreaSearch(''); }, (
<ListStateView
          isLoading={areaState.loading}
          isError={!!areaState.error}
          isEmpty={filteredAreas.length === 0}
          onRetry={() => catalogue.retryAreas(value?.stateCode ?? '')}
          emptyIcon={<MapPin size={28} color="#FF8C42" strokeWidth={1.6} />}
          emptyTitle={areaSearch.trim() ? 'Nothing matched your search' : 'No areas listed for this state'}
          emptyDescription={areaSearch.trim() ? 'Try a different spelling.' : undefined}
          loadingSkeleton={<LocationListSkeleton />}
        >
        <FlatList
          data={filteredAreas}
          keyExtractor={(item) => item.name}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.modalItem, selectedArea?.name === item.name && styles.modalItemSelected]}
              onPress={() => handleSelectArea(item)}
              activeOpacity={0.7}
            >
              <Text style={[styles.modalItemText, selectedArea?.name === item.name && styles.modalItemTextSelected]}>{item.name}</Text>
              {selectedArea?.name === item.name && <Check size={18} color="#FF8C42" strokeWidth={2.5} />}
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.modalList}
        />
        </ListStateView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fieldSection: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500' as const, color: '#2B2B2B', marginBottom: 8, paddingHorizontal: 2 },
  selectorButton: {
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    borderWidth: 1, borderColor: '#EEEEEE',
  },
  selectorDisabled: { backgroundColor: '#F0F0F0' },
  selectorText: { fontSize: 16, color: '#2B2B2B' },
  selectorPlaceholder: { color: '#9CA3AF', fontSize: 16 },
  countryRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, flex: 1 },
  countryFlag: { fontSize: 20 },
  inputError: { borderColor: '#DC2626' },
  skeletonWrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  skeletonRow: {
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  errorText: { fontSize: 13, color: '#DC2626', marginTop: 6, paddingHorizontal: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' as const },
  modalContainer: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingTop: 8 },
  modalHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: '#2B2B2B' },
  modalClose: { fontSize: 15, color: '#FF8C42', fontWeight: '600' as const },
  searchContainer: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginHorizontal: 20, marginBottom: 8,
    backgroundColor: '#F7F7F8', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#2B2B2B' },
  modalList: { paddingHorizontal: 12, paddingBottom: 32 },
  modalItem: {
    flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const,
    paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12,
  },
  modalItemSelected: { backgroundColor: 'rgba(255,140,66,0.08)' },
  modalItemText: { fontSize: 16, color: '#2B2B2B' },
  modalItemTextSelected: { color: '#FF8C42', fontWeight: '600' as const },
});
