import React, { useState, useMemo } from 'react';
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
import { ChevronLeft, MapPin, Check, Info, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { Region } from '@/constants/regions';

export default function RegionSettingsScreen() {
  const router = useRouter();
  const { 
    regionId,
    getAvailableRegions,
    setRegion,
  } = useUserLocation();

  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(regionId);
  const [searchQuery, setSearchQuery] = useState('');
  const availableRegions = getAvailableRegions();

  const filteredRegions = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableRegions;
    }
    const query = searchQuery.toLowerCase();
    return availableRegions.filter(region => 
      region.name.toLowerCase().includes(query)
    );
  }, [availableRegions, searchQuery]);

  const handleBackPress = () => {
    router.back();
  };

  const handleRegionSelect = async (region: Region) => {
    setSelectedRegionId(region.id);
    await setRegion(region.id);
    console.log('[REGION_SETTINGS] Region selected:', region.name);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Region</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              Select your Region. Vendors are filtered by this region.
            </Text>
          </View>
        </View>

        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search regions..."
              placeholderTextColor={Colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {filteredRegions.length} REGION{filteredRegions.length !== 1 ? 'S' : ''}
          </Text>
          <View style={styles.regionsList}>
            {filteredRegions.map((region, index) => {
              const isSelected = selectedRegionId === region.id;
              
              return (
                <React.Fragment key={region.id}>
                  <TouchableOpacity
                    style={styles.regionRow}
                    onPress={() => handleRegionSelect(region)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.regionLeft}>
                      <MapPin size={20} color={Colors.border} />
                      <Text style={styles.regionName}>{region.name}</Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <Check size={16} color={Colors.text} />
                      </View>
                    )}
                  </TouchableOpacity>
                  {index < filteredRegions.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
            {filteredRegions.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No regions found</Text>
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
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
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
  searchSection: {
    marginTop: 16,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
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
  regionsList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  regionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  regionLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  regionName: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
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
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
