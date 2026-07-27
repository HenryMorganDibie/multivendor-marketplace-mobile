import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Linking,
  Platform,
} from 'react-native';
import { MapPin, Clock, Globe, Instagram, ChevronRight, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { Vendor } from '@/mocks/vendorData';
import { formatPrice } from '@/utils/formatPrice';
import { formatWeeklyHours } from '@/utils/formatBusinessHours';
import { Colors } from '@/constants/colors';

interface VendorProfileModalProps {
  visible: boolean;
  vendor: Vendor;
  onClose: () => void;
  onViewPolicy: () => void;
  onReport: () => void;
}

export default function VendorProfileModal({
  visible,
  vendor,
  onClose,
  onViewPolicy,
  onReport,
}: VendorProfileModalProps) {
  const hoursLines = useMemo(() => {
    if (!vendor.weeklyHours) return null;
    return formatWeeklyHours(vendor.weeklyHours);
  }, [vendor.weeklyHours]);

  const hasLinks =
    vendor.contactLinks &&
    (vendor.contactLinks.website || vendor.contactLinks.instagram || vendor.contactLinks.tiktok);

  const hasFulfillment = vendor.pickup || vendor.delivery || vendor.shipping;

  const handleOpenLink = (url: string) => {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url).catch((err) => console.log('Failed to open link:', err));
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.sheetWrapper}>
          <View style={styles.sheet}>
            <View style={styles.handleBar} />

            <ScrollView
              style={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerIdentity}>
                  {vendor.logoImage ? (
                    <Image source={{ uri: vendor.logoImage }} style={styles.logo} />
                  ) : (
                    <View style={styles.logoFallback}>
                      <Text style={styles.logoFallbackText}>
                        {vendor.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.headerText}>
                    <Text style={styles.vendorName}>{vendor.name}</Text>
                    <Text style={styles.username}>@{vendor.username}</Text>
                  </View>
                </View>
                <View style={styles.headerMeta}>
                  <Text style={styles.ratingText}>
                    ⭐ {vendor.rating} ({vendor.reviewCount})
                  </Text>
                  <View style={styles.locationRow}>
                    <MapPin size={14} color={Colors.textSecondary} />
                    <Text style={styles.locationText}>
                      {vendor.city ? `${vendor.city}, ${vendor.region || vendor.area}` : vendor.area}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Fulfillment */}
              {hasFulfillment && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>FULFILLMENT</Text>
                    <View style={styles.badgeRow}>
                      {vendor.pickup && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Pickup</Text>
                        </View>
                      )}
                      {vendor.delivery && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>Delivery</Text>
                        </View>
                      )}
                      {vendor.shipping && vendor.shippingScope === 'domestic' && (
                        <View style={[styles.badge, styles.badgeAccent]}>
                          <Text style={[styles.badgeText, styles.badgeTextAccent]}>Ships Nationwide</Text>
                        </View>
                      )}
                      {vendor.shipping && vendor.shippingScope === 'international' && (
                        <View style={[styles.badge, styles.badgeAccent]}>
                          <Text style={[styles.badgeText, styles.badgeTextAccent]}>Ships Worldwide</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Opening Hours */}
              {hoursLines && hoursLines.length > 0 && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>OPENING HOURS</Text>
                    <View style={styles.hoursContainer}>
                      <Clock size={18} color={Colors.textSecondary} style={{ marginTop: 2 }} />
                      <View style={styles.hoursLines}>
                        {hoursLines.map((line, idx) => (
                          <View key={idx} style={styles.hoursRow}>
                            <Text style={styles.hoursDay}>{line.label}</Text>
                            <Text
                              style={[
                                styles.hoursTime,
                                line.isClosed && styles.hoursTimeClosed,
                              ]}
                            >
                              {line.hours}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Minimum Order */}
              {vendor.minimumOrderAmount != null && vendor.minimumOrderAmount > 0 && (
                <>
                  <View style={styles.inlineRow}>
                    <ShieldCheck size={18} color={Colors.textSecondary} />
                    <Text style={styles.inlineLabel}>Minimum order:</Text>
                    <Text style={styles.inlineValue}>
                      {formatPrice(vendor.minimumOrderAmount, (vendor.currency as any) || 'NGN')}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Links */}
              {hasLinks && (
                <>
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>CONNECT WITH {vendor.name.toUpperCase()}</Text>
                    {vendor.contactLinks?.website && (
                      <TouchableOpacity
                        style={styles.linkRow}
                        onPress={() => handleOpenLink(vendor.contactLinks!.website!)}
                        activeOpacity={0.6}
                      >
                        <Globe size={20} color={Colors.textSecondary} />
                        <Text style={styles.linkText}>Website</Text>
                        <ChevronRight size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                    {vendor.contactLinks?.instagram && (
                      <TouchableOpacity
                        style={styles.linkRow}
                        onPress={() => handleOpenLink(vendor.contactLinks!.instagram!)}
                        activeOpacity={0.6}
                      >
                        <Instagram size={20} color={Colors.textSecondary} />
                        <Text style={styles.linkText}>Instagram</Text>
                        <ChevronRight size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                    {vendor.contactLinks?.tiktok && (
                      <TouchableOpacity
                        style={styles.linkRow}
                        onPress={() => handleOpenLink(vendor.contactLinks!.tiktok!)}
                        activeOpacity={0.6}
                      >
                        <View style={styles.tiktokIcon}>
                          <Text style={styles.tiktokIconText}>♪</Text>
                        </View>
                        <Text style={styles.linkText}>TikTok</Text>
                        <ChevronRight size={18} color={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.divider} />
                </>
              )}

              {/* Business Policy */}
              <TouchableOpacity
                style={styles.policyRow}
                onPress={() => {
                  onClose();
                  setTimeout(onViewPolicy, 300);
                }}
                activeOpacity={0.6}
              >
                <Text style={styles.policyRowText}>{vendor.name}'s Business Policy</Text>
                <ChevronRight size={18} color={Colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Trust Message */}
              <View style={styles.trustSection}>
                <Text style={styles.trustText}>
                  Payments handled by {vendor.name}
                </Text>
              </View>

              {/* Report */}
              <TouchableOpacity
                style={styles.reportRow}
                onPress={() => {
                  onClose();
                  setTimeout(onReport, 300);
                }}
                activeOpacity={0.6}
              >
                <AlertTriangle size={14} color={Colors.error} />
                <Text style={styles.reportText}>Report an issue</Text>
              </TouchableOpacity>

              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  sheetWrapper: {
    maxHeight: '88%',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 18,
  },
  headerIdentity: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  logoFallbackText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  headerText: {
    flex: 1,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 28,
  },
  username: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginTop: 4,
  },
  ratingText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  badgeAccent: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FDBA74',
  },
  badgeTextAccent: {
    color: '#C2410C',
  },
  hoursContainer: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  hoursLines: {
    flex: 1,
    gap: 6,
  },
  hoursRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  hoursDay: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
    minWidth: 70,
  },
  hoursTime: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  hoursTimeClosed: {
    color: Colors.error,
    fontWeight: '500' as const,
  },
  inlineRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  inlineLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  inlineValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    gap: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  tiktokIcon: {
    width: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tiktokIconText: {
    fontSize: 18,
    color: Colors.textSecondary,
  },
  policyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  policyRowText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  trustSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  trustText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  reportRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
  },
  reportText: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '400' as const,
  },
});
