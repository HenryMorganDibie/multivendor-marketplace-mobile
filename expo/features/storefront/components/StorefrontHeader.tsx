import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MoreVertical, Heart } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface StorefrontHeaderProps {
  vendorFavorited: boolean;
  onBackPress: () => void;
  onToggleFavorite: () => void;
  onMenuPress: () => void;
}

/**
 * Top navigation bar for the storefront. Back / favorite / share-menu only.
 * Store search now lives in the sticky catalog header (DoorDash-style) so it
 * stays accessible while scrolling — see StorefrontCatalog.
 */
export default function StorefrontHeader({
  vendorFavorited,
  onBackPress,
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
});
