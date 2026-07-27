import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Star, MapPin, Clock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Vendor } from '@/mocks/vendorData';

interface VendorPreviewModalProps {
  visible: boolean;
  vendor: Vendor | null;
  onClose: () => void;
  onViewStore: (vendorId: string) => void;
}

export default function VendorPreviewModal({
  visible,
  vendor,
  onClose,
  onViewStore,
}: VendorPreviewModalProps) {
  if (!vendor) return null;

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

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.bannerContainer}>
              <Image
                source={{
                  uri: vendor.bannerImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80',
                }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(11, 11, 11, 0.9)']}
                style={styles.bannerGradient}
              />
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.vendorName}>{vendor.name}</Text>
              <Text style={styles.category}>{vendor.category}</Text>

              <View style={styles.metaRow}>
                {vendor.rating > 0 && vendor.reviewCount > 0 && (
                  <View style={styles.ratingContainer}>
                    <Star size={16} color="#FFD700" fill="#FFD700" />
                    <Text style={styles.ratingText}>
                      {vendor.rating.toFixed(1)} ({vendor.reviewCount} reviews)
                    </Text>
                  </View>
                )}
                {vendor.area && (
                  <View style={styles.locationContainer}>
                    <MapPin size={16} color="#8E8E93" />
                    <Text style={styles.locationText}>{vendor.area}</Text>
                  </View>
                )}
              </View>

              <View style={styles.statusRow}>
                <View style={[styles.statusIndicatorDot, { backgroundColor: vendor.isOpenNow ? '#34C759' : '#FF8C42' }]} />
                <Text style={[styles.statusText, vendor.isOpenNow && styles.statusTextOpen]}>
                  {vendor.isOpenNow ? 'Open Now' : (() => {
                    if (vendor.businessHours) {
                      const match = vendor.businessHours.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                      if (match) {
                        const now = new Date();
                        const openTime = match[1];
                        const openHourMatch = openTime.match(/(\d{1,2})/);
                        const isPM = /PM/i.test(openTime);
                        const openHour = openHourMatch ? parseInt(openHourMatch[1]) + (isPM && parseInt(openHourMatch[1]) !== 12 ? 12 : 0) : 0;
                        return now.getHours() >= openHour ? `Opens tomorrow at ${openTime}` : `Opens at ${openTime}`;
                      }
                    }
                    return 'Currently closed';
                  })()}
                </Text>
              </View>

              {fulfillmentBadges.length > 0 && (
                <View style={styles.fulfillmentSection}>
                  <Text style={styles.sectionTitle}>Available Options</Text>
                  <View style={styles.fulfillmentGrid}>
                    {fulfillmentBadges.map((badge, index) => (
                      <View key={index} style={styles.fulfillmentBadge}>
                        <Text style={styles.fulfillmentBadgeText}>{badge}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {vendor.description && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionTitle}>About</Text>
                  <Text style={styles.descriptionText}>{vendor.description}</Text>
                </View>
              )}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.viewStoreButton}
              onPress={() => {
                onClose();
                setTimeout(() => {
                  onViewStore(vendor.id);
                }, 100);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.viewStoreButtonText}>View Store</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0B0B0B',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  content: {
    flex: 1,
  },
  bannerContainer: {
    width: '100%',
    height: 240,
    position: 'relative' as const,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1C1C1E',
  },
  bannerGradient: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    height: 100,
  },
  infoSection: {
    padding: 20,
  },
  vendorName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 16,
  },
  metaRow: {
    gap: 12,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  ratingText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  locationContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: '#8E8E93',
  },
  statusRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 20,
  },
  statusIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    color: '#8E8E93',
    fontWeight: '500' as const,
  },
  statusTextOpen: {
    color: '#34C759',
  },
  fulfillmentSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  fulfillmentGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  fulfillmentBadge: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  fulfillmentBadgeText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  descriptionSection: {
    marginBottom: 20,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#D1D1D6',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },
  viewStoreButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  viewStoreButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
