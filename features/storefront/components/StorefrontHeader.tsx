import React from 'react';
import { View, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MoreVertical, Search, X, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface StorefrontHeaderProps {
  showSearch: boolean;
  searchQuery: string;
  vendorFavorited: boolean;
  onBackPress: () => void;
  onToggleSearch: () => void;
  onSearchChange: (text: string) => void;
  onClearSearch: () => void;
  onToggleFavorite: () => void;
  onMenuPress: () => void;
}

export default function StorefrontHeader({
  showSearch,
  searchQuery,
  vendorFavorited,
  onBackPress,
  onToggleSearch,
  onSearchChange,
  onClearSearch,
  onToggleFavorite,
  onMenuPress,
}: StorefrontHeaderProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBackPress} style={styles.headerButton}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity onPress={onToggleSearch} style={styles.headerButton}>
            <Search size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onToggleFavorite}
            style={styles.headerButton}
            testID="favorite-vendor-btn"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart
              size={24}
              color={vendorFavorited ? '#DC2626' : Colors.text}
              fill={vendorFavorited ? '#DC2626' : 'transparent'}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={onMenuPress} style={styles.headerButton}>
            <MoreVertical size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {showSearch && (
        <View style={styles.searchBar}>
          <Search size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu items..."
            value={searchQuery}
            onChangeText={onSearchChange}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={onClearSearch}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: {
    padding: 8,
    position: 'relative' as const,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
  },
});
