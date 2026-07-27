import React, { memo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Heart, Star, MapPin } from 'lucide-react-native';
import { Vendor } from '@/mocks/vendorData';
import { Colors } from '@/constants/colors';
import { useResponsive } from '@/constants/layout';

interface VendorCardProps {
  vendor: Vendor;
  isFavorite: boolean;
  onToggleFavorite: (vendorId: string) => void;
  onPress?: (vendor: Vendor) => void;
  variant?: 'large' | 'compact';
  style?: ViewStyle;
  fixedWidth?: number;
}

function VendorCard({
  vendor,
  isFavorite,
  onToggleFavorite,
  onPress,
  variant = 'large',
  style,
  fixedWidth,
}: VendorCardProps) {
  const { cardWidth } = useResponsive();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleCardPress = useCallback(() => {
    if (onPress) {
      onPress(vendor);
      return;
    }
    if (!vendor?.username) return;
    router.push(`/store/${vendor.username.toLowerCase()}` as any);
  }, [vendor, router, onPress]);

  const handleFavoritePress = useCallback(() => {
    onToggleFavorite(vendor.id);
  }, [vendor.id, onToggleFavorite]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const resolvedCardWidth = fixedWidth ?? cardWidth;
  const isLarge = variant === 'large';
  const isNew = vendor.reviewCount < 10;
  const isTopRated = vendor.rating >= 4.8 && vendor.reviewCount >= 50;

  const getOpeningTimeLabel = (): string => {
    if (vendor.businessHours) {
      const match = vendor.businessHours.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
      if (match) return `Opens ${match[1]}`;
    }
    return 'Currently unavailable';
  };

  const renderStatusBadge = () => {
    if (isNew) {
      return (
        <View style={styles.statusBadge}>
          <Text style={styles.statusBadgeText}>New</Text>
        </View>
      );
    }
    if (isTopRated) {
      return (
        <View style={[styles.statusBadge, styles.statusBadgeGold]}>
          <Star size={9} color="#C2851A" fill="#C2851A" />
          <Text style={[styles.statusBadgeText, styles.statusBadgeTextGold]}>Top Rated</Text>
        </View>
      );
    }
    return null;
  };

  const getFulfillmentBadges = () => {
    const badges: string[] = [];
    if (vendor.pickup) badges.push('Pickup');
    if (vendor.delivery) badges.push('Delivery');
    if (vendor.shipping) {
      if (vendor.shippingScope === 'international') {
        badges.push('Ships Worldwide');
      } else {
        badges.push('Ships Nationwide');
      }
    }
    return badges;
  };

  const fulfillmentBadges = getFulfillmentBadges();

  const formatReviewCount = (count: number) => {
    if (count >= 100) return '100+';
    if (count >= 50) return '50+';
    return count.toString();
  };

  if (!vendor?.id) return null;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={handleCardPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        testID={`vendor-card-${vendor.id}`}
        style={[
          styles.card,
          isLarge ? { width: resolvedCardWidth } : styles.cardCompact,
          style,
        ]}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`View ${vendor.name} storefront`}
      >
        {/* Image Section */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: vendor.bannerImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80',
            }}
            style={[
              styles.image,
              isLarge ? styles.imageLarge : styles.imageCompact,
            ]}
            resizeMode="cover"
          />

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.32)']}
            style={styles.imageGradient}
          />

          {/* Status badge top-left */}
          <View style={styles.badgeContainer}>
            {renderStatusBadge()}
          </View>

          {/* Open/Closed indicator bottom-left */}
          {vendor.isOpenNow !== undefined && (
            <View style={[styles.openPill, !vendor.isOpenNow && styles.closedPill]}>
              <View style={[styles.openDot, !vendor.isOpenNow && styles.closedDot]} />
              <Text style={[styles.openPillText, !vendor.isOpenNow && styles.closedPillText]}>
                {vendor.isOpenNow ? 'Open' : 'Closed'}
              </Text>
            </View>
          )}

          {/* Favorite button */}
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={handleFavoritePress}
            testID={`favorite-btn-${vendor.id}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <View style={styles.favoriteButtonInner}>
              <Heart
                size={16}
                color={isFavorite ? '#FF3B30' : Colors.white}
                fill={isFavorite ? '#FF3B30' : 'transparent'}
                strokeWidth={2.5}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          <Text style={styles.vendorName} numberOfLines={1}>
            {vendor.name}
          </Text>

          <View style={styles.metaRow}>
            {vendor.area && (
              <View style={styles.locationRow}>
                <MapPin size={11} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {vendor.area}
                </Text>
              </View>
            )}
            {vendor.rating > 0 && vendor.reviewCount > 0 && (
              <>
                {vendor.area && <Text style={styles.metaDot}>·</Text>}
                <View style={styles.ratingRow}>
                  <Star size={12} color={Colors.star} fill={Colors.star} />
                  <Text style={styles.ratingText}>{vendor.rating.toFixed(1)}</Text>
                  <Text style={styles.reviewCountText}>({formatReviewCount(vendor.reviewCount)})</Text>
                </View>
              </>
            )}
          </View>

          {!vendor.isOpenNow && (
            <Text style={styles.availabilityText}>{getOpeningTimeLabel()}</Text>
          )}

          {fulfillmentBadges.length > 0 && (
            <View style={styles.fulfillmentRow}>
              {fulfillmentBadges.map((badge, index) => (
                <View key={index} style={styles.fulfillmentBadge}>
                  <Text style={styles.fulfillmentBadgeText}>{badge}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 18,
    overflow: 'hidden' as const,
  },
  cardCompact: {
    width: '100%',
  },
  imageContainer: {
    position: 'relative' as const,
  },
  image: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 18,
  },
  imageLarge: {
    height: 168,
  },
  imageCompact: {
    height: 184,
  },
  imageGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  badgeContainer: {
    position: 'absolute' as const,
    top: 10,
    left: 10,
    flexDirection: 'row' as const,
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusBadgeGold: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  statusBadgeTextGold: {
    color: '#92400E',
  },
  openPill: {
    position: 'absolute' as const,
    bottom: 10,
    left: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  closedPill: {
    backgroundColor: 'rgba(0,0,0,0.46)',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  closedDot: {
    backgroundColor: '#9CA3AF',
  },
  openPillText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  closedPillText: {
    color: 'rgba(255,255,255,0.85)',
  },
  favoriteButton: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
  },
  favoriteButtonInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  content: {
    paddingTop: 11,
    paddingBottom: 6,
    paddingHorizontal: 2,
  },
  vendorName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    marginBottom: 4,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 5,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  ratingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  metaDot: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  reviewCountText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  availabilityText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 4,
    fontWeight: '400' as const,
  },
  fulfillmentRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 5,
    marginTop: 2,
  },
  fulfillmentBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  fulfillmentBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondaryOnSurface,
    letterSpacing: 0.1,
  },
});

export default memo(VendorCard);
