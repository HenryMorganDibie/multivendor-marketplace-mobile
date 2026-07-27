import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { mockVendor } from '@/mocks/vendorData';
import LaektivaModal from '@/components/LaektivaModal';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';

export default function OrderRequestScreen() {
  const router = useRouter();
  const { requestId } = useLocalSearchParams();
  
  const [isItemsExpanded, setIsItemsExpanded] = useState(false);
  const [isCancelModalVisible, setIsCancelModalVisible] = useState(false);

  const mockRequestData = {
    requestReference: requestId || 'REQ-240915-8392',
    vendorName: mockVendor.name,
    submittedAt: new Date(),
    items: [
      { name: 'Meat Pie', quantity: 2, price: 500 },
      { name: 'Puff Puff', quantity: 1, price: 2000, addOns: ['Extra spice', 'Extra sauce'] },
      { name: 'Spring Rolls', quantity: 3, price: 300 },
    ],
    fulfillmentType: 'Pickup',
    preferredDate: 'Wed, Dec 25',
    preferredTime: '2:30 PM',
  };

  const totalItems = mockRequestData.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleBackPress = () => {
    router.back();
  };

  const handleCancelRequest = () => {
    setIsCancelModalVisible(true);
  };

  const confirmCancelRequest = () => {
    console.log('Cancelling order request:', mockRequestData.requestReference);
    setIsCancelModalVisible(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Order request</Text>
            <Text style={styles.headerSubtitle}>{mockRequestData.vendorName}</Text>
          </View>
          <View style={styles.headerButton} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerTitle}>Waiting for vendor confirmation</Text>
            <Text style={styles.statusBannerSubtext}>
              {mockRequestData.vendorName} is reviewing your request and will confirm availability.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER SNAPSHOT</Text>
            <View style={styles.sectionContent}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Vendor</Text>
                <Text style={styles.infoValue}>{mockRequestData.vendorName}</Text>
              </View>

              <View style={styles.itemsHeader}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Items</Text>
                  <Text style={styles.infoValue}>{totalItems} items</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsItemsExpanded(!isItemsExpanded)}
                  style={styles.expandButton}
                  activeOpacity={0.7}
                >
                  {isItemsExpanded ? (
                    <ChevronUp size={20} color={Colors.text} />
                  ) : (
                    <ChevronDown size={20} color={Colors.text} />
                  )}
                </TouchableOpacity>
              </View>

              {isItemsExpanded && (
                <View style={styles.itemsList}>
                  {mockRequestData.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>
                          {item.quantity}x {item.name}
                        </Text>
                        {item.addOns && item.addOns.length > 0 && (
                          <View style={styles.addOnsContainer}>
                            {item.addOns.map((addOn, idx) => (
                              <Text key={idx} style={styles.addOnText}>
                                + {addOn}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={styles.itemPrice}>{formatPriceWithCommas(item.price * item.quantity, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Fulfillment</Text>
                <Text style={styles.infoValue}>{mockRequestData.fulfillmentType}</Text>
              </View>

              {mockRequestData.preferredDate && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Preferred time</Text>
                  <Text style={styles.infoValue}>
                    {mockRequestData.preferredDate} • {mockRequestData.preferredTime}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REQUEST REFERENCE</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.requestReference}>{mockRequestData.requestReference}</Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelRequest}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>Cancel request</Text>
        </TouchableOpacity>
      </SafeAreaView>

      <LaektivaModal
        visible={isCancelModalVisible}
        title="Cancel order request?"
        message={`This request hasn't been accepted yet. If you cancel now, ${mockRequestData.vendorName} won't review it. You can place a new request anytime.`}
        primaryButton={{
          label: 'Cancel request',
          onPress: confirmCancelRequest,
        }}
        secondaryButton={{
          label: 'Keep request',
          onPress: () => setIsCancelModalVisible(false),
        }}
        onRequestClose={() => setIsCancelModalVisible(false)}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  statusBanner: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusBannerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  statusBannerSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    textAlign: 'right' as const,
    flex: 1,
    marginLeft: 16,
  },
  itemsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  expandButton: {
    padding: 4,
    marginLeft: 8,
  },
  itemsList: {
    paddingTop: 8,
    paddingBottom: 12,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: Colors.cardBorder,
    marginLeft: 8,
  },
  itemRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  addOnsContainer: {
    marginTop: 4,
  },
  addOnText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginLeft: 12,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  requestReference: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bottomSpacer: {
    height: 100,
  },
  bottomActions: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cancelButton: {
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
    alignItems: 'center' as const,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.error,
  },

});
