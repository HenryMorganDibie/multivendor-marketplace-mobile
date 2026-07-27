import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  X,
  Star,
  MapPin,
  Store,
  CheckCircle,
  Clock,
  Truck,
  ShoppingBag,
  Package,
  ChevronRight,
} from 'lucide-react-native';
import type { Vendor } from '@/mocks/vendorData';

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
  const insets = useSafeAreaInsets();

  if (!vendor) return null;

  const fulfillmentIcons: { label: string; icon: React.ReactNode }[] = [
    ...(vendor.pickup ? [{ label: 'Pickup', icon: <ShoppingBag size={13} color="#FF8C42" /> }] : []),
    ...(vendor.delivery ? [{ label: 'Delivery', icon: <Truck size={13} color="#FF8C42" /> }] : []),
    ...(vendor.shipping ? [{ label: 'Shipping', icon: <Package size={13} color="#FF8C42" /> }] : []),
  ];

  const locationParts = [vendor.area, vendor.city, vendor.region].filter(Boolean);
  const locationText = locationParts.slice(0, 2).join(', ');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <View style={styles.handle} />

          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <X size={18} color="#6B7280" strokeWidth={2} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Banner + Logo */}
            <View style={styles.headerArea}>
              {vendor.bannerImage ? (
                <Image source={{ uri: vendor.bannerImage }} style={styles.banner} resizeMode="cover" />
              ) : (
                <View style={[styles.banner, styles.bannerPlaceholder]} />
              )}

              <View style={styles.logoWrapper}>
                {vendor.logoImage ? (
                  <Image source={{ uri: vendor.logoImage }} style={styles.logo} resizeMode="cover" />
                ) : (
                  <View style={styles.logoFallback}>
                    <Store size={28} color="#FF8C42" />
                  </View>
                )}
              </View>
            </View>

            {/* Info */}
            <View style={styles.body}>
              {/* Name + verified */}
              <View style={styles.nameRow}>
                <Text style={styles.vendorName} numberOfLines={1}>
                  {vendor.name}
                </Text>
                {vendor.isVerified && (
                  <CheckCircle size={16} color="#FF8C42" fill="#FF8C42" style={{ marginLeft: 6 }} />
                )}
              </View>

              {/* Category */}
              <Text style={styles.category}>{vendor.category}</Text>

              {/* Rating + location */}
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Star size={13} color="#FF8C42" fill="#FF8C42" />
                  <Text style={styles.metaText}>
                    {vendor.rating.toFixed(1)}
                    <Text style={styles.metaMuted}> ({vendor.reviewCount})</Text>
                  </Text>
                </View>
                {locationText ? (
                  <View style={styles.metaItem}>
                    <MapPin size={13} color="#9CA3AF" />
                    <Text style={styles.metaMutedText}>{locationText}</Text>
                  </View>
                ) : null}
                <View style={styles.metaItem}>
                  <Clock size={13} color={vendor.isOpenNow ? '#22C55E' : '#9CA3AF'} />
                  <Text style={[styles.metaMutedText, vendor.isOpenNow && styles.openText]}>
                    {vendor.isOpenNow ? 'Open now' : 'Closed'}
                  </Text>
                </View>
              </View>

              {/* Description */}
              {vendor.description ? (
                <Text style={styles.description} numberOfLines={3}>
                  {vendor.description}
                </Text>
              ) : null}

              {/* Fulfillment badges */}
              {fulfillmentIcons.length > 0 && (
                <View style={styles.fulfillmentRow}>
                  {fulfillmentIcons.map(({ label, icon }) => (
                    <View key={label} style={styles.fulfillmentBadge}>
                      {icon}
                      <Text style={styles.fulfillmentLabel}>{label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Divider */}
              <View style={styles.divider} />

              {/* CTA */}
              <TouchableOpacity
                style={styles.viewStoreBtn}
                onPress={() => onViewStore(vendor.id)}
                activeOpacity={0.82}
              >
                <Text style={styles.viewStoreBtnText}>Visit Store</Text>
                <ChevronRight size={16} color="#FFFFFF" strokeWidth={2.2} />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 16,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerArea: {
    position: 'relative',
    marginBottom: 36,
  },
  banner: {
    width: '100%',
    height: 110,
    backgroundColor: '#F3F4F6',
  },
  bannerPlaceholder: {
    backgroundColor: '#FFF4EC',
  },
  logoWrapper: {
    position: 'absolute',
    bottom: -32,
    left: 20,
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF4EC',
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  vendorName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  category: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  metaMuted: {
    fontWeight: '400',
    color: '#9CA3AF',
  },
  metaMutedText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '400',
  },
  openText: {
    color: '#22C55E',
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    marginBottom: 14,
  },
  fulfillmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  fulfillmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFF4EC',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  fulfillmentLabel: {
    fontSize: 12,
    color: '#FF8C42',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 16,
  },
  viewStoreBtn: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  viewStoreBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
