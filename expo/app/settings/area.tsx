import React, { useState, useMemo, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Check, Info, Search, Navigation, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { getAreasByRegion, AreaInfo } from '@/constants/areas';

export default function AreaSettingsScreen() {
  const router = useRouter();
  const { regionId, regionName, area, setArea } = useUserLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState<string | null>(area);
  const [showSearch, setShowSearch] = useState(false);

  const areas = useMemo(() => {
    if (!regionId) return [];
    return getAreasByRegion(regionId);
  }, [regionId]);

  const filteredAreas = useMemo(() => {
    if (!searchQuery.trim()) return areas;
    const query = searchQuery.toLowerCase();
    return areas.filter(a => a.name.toLowerCase().includes(query));
  }, [areas, searchQuery]);

  const handleBackPress = useCallback(() => {
    router.back();
  }, [router]);

  const handleAreaSelect = useCallback(async (areaItem: AreaInfo) => {
    setSelectedArea(areaItem.name);
    await setArea(areaItem.name);
    console.log('[AREA_SETTINGS] Area selected:', areaItem.name);
  }, [setArea]);

  const toggleSearch = useCallback(() => {
    setShowSearch(prev => {
      if (prev) setSearchQuery('');
      return !prev;
    });
  }, []);

  if (!regionId) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Area</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.emptyContainer}>
          <Navigation size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Select a region first</Text>
          <Text style={styles.emptySubtitle}>
            Go back and choose your region to see available areas.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Area</Text>
          <TouchableOpacity onPress={toggleSearch} style={styles.headerButton}>
            {showSearch ? (
              <X size={22} color={Colors.text} />
            ) : (
              <Search size={22} color={Colors.text} />
            )}
          </TouchableOpacity>
        </View>
        {showSearch && (
          <View style={styles.searchSection}>
            <View style={styles.searchContainer}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder={`Search areas in ${regionName}...`}
                placeholderTextColor={Colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </SafeAreaView>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Select your area. Vendors are filtered by this location.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {filteredAreas.length} AREA{filteredAreas.length !== 1 ? 'S' : ''} IN {regionName?.toUpperCase()}
          </Text>
          <View style={styles.areasList}>
            {filteredAreas.map((areaItem, index) => {
              const isSelected = selectedArea === areaItem.name;

              return (
                <React.Fragment key={areaItem.name}>
                  <TouchableOpacity
                    style={styles.areaRow}
                    onPress={() => handleAreaSelect(areaItem)}
                    activeOpacity={0.7}
                    testID={`area-item-${areaItem.name}`}
                  >
                    <View style={styles.areaLeft}>
                      <MapPin size={20} color={isSelected ? Colors.primary : Colors.border} />
                      <Text style={[styles.areaName, isSelected && styles.areaNameSelected]}>
                        {areaItem.name}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Check size={16} color={Colors.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                  {index < filteredAreas.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
            {filteredAreas.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  {areas.length === 0
                    ? 'No areas available for this region yet'
                    : 'No areas match your search'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
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
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
    width: 40,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 40,
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoSection: {
    marginTop: 20,
  },
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  areasList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  areaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  areaLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  areaName: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  areaNameSelected: {
    color: Colors.primary,
  },
  selectedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 48,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 40,
  },
});
