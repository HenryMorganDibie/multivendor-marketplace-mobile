import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { mockVendor } from '@/mocks/vendorData';

export default function OrderPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { clearCart } = useCart();
  const [isPolicyModalVisible, setIsPolicyModalVisible] = useState(false);

  const fulfillmentType = params.fulfillmentType as string;
  const orderNote = params.orderNote as string;
  const subtotal = Number(params.subtotal);
  const tax = Number(params.tax);
  const discount = Number(params.discount);
  const total = Number(params.total);
  const itemsJson = params.items as string;
  const items = JSON.parse(itemsJson);
  const preferredDate = params.preferredDate as string;
  const preferredTime = params.preferredTime as string;

  const handleBackPress = () => {
    router.back();
  };

  const handleConfirmOrder = () => {
    const orderRequestId = `REQ-${Date.now()}`;
    const publicOrderId = `SANSTE-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Math.floor(Math.random() * 10000)}`;
    
    console.log('Order confirmed and sent:', {
      orderRequestId,
      publicOrderId,
      vendor: mockVendor.name,
      fulfillmentType,
      items,
      subtotal,
      tax,
      discount,
      total,
      orderNote: orderNote || undefined,
      preferredDate: preferredDate || undefined,
      preferredTime: preferredTime || undefined,
    });

    Alert.alert(
      'Order Request Sent',
      `Your ${fulfillmentType.toLowerCase()} order request has been sent to ${mockVendor.name}. They will review and confirm availability.`,
      [
        {
          text: 'OK',
          onPress: () => {
            clearCart();
            router.replace({
              pathname: '/chat/order/[orderId]' as any,
              params: {
                orderId: orderRequestId,
                vendorName: mockVendor.name,
                orderStatus: 'pending_vendor_review',
                publicOrderId: publicOrderId,
              },
            });
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ArrowLeft size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Preview</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.vendorNameContainer}>
          <Text style={styles.vendorName}>{mockVendor.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FULFILLMENT</Text>
          <View style={styles.sectionContent}>
            <Text style={styles.fulfillmentText}>{fulfillmentType}</Text>
            {(preferredDate || preferredTime) && (
              <View style={styles.preferredTimeContainer}>
                <Text style={styles.preferredTimeLabel}>Preferred time:</Text>
                <Text style={styles.preferredTimeValue}>
                  {preferredDate && preferredTime
                    ? `${preferredDate} at ${preferredTime}`
                    : preferredDate || preferredTime}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ITEMS</Text>
          <View style={styles.sectionContent}>
            {items.map((item: any, index: number) => (
              <View key={`${item.id}-${index}`} style={styles.itemRow}>
                <View style={styles.itemInfo}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}> ×{item.quantity}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₦{item.price.toLocaleString()}</Text>
                  {item.addOns && item.addOns.length > 0 && (
                    <View style={styles.addOnsList}>
                      <Text style={styles.addOnsLabel}>Add-ons:</Text>
                      {item.addOns.map((addOn: any) => (
                        <Text key={addOn.id} style={styles.addOnItem}>
                          • {addOn.name} +₦{addOn.price.toLocaleString()}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {orderNote && orderNote.trim() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER NOTE</Text>
            <View style={styles.sectionContent}>
              <Text style={styles.orderNoteText}>&ldquo;{orderNote}&rdquo;</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUMMARY</Text>
          <View style={styles.sectionContent}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>₦{subtotal.toLocaleString()}</Text>
            </View>
            {mockVendor.taxEnabled && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tax:</Text>
                <Text style={styles.summaryValue}>₦{Math.round(tax).toLocaleString()}</Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount:</Text>
              <Text style={styles.summaryValue}>₦{discount.toLocaleString()}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabelTotal}>Total:</Text>
              <Text style={styles.summaryValueTotal}>₦{Math.round(total).toLocaleString()}</Text>
            </View>
          </View>
        </View>

        {mockVendor.policy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>VENDOR BUSINESS POLICY</Text>
            <View style={styles.sectionContent}>
              <TouchableOpacity
                style={styles.policyButton}
                onPress={() => setIsPolicyModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.policyButtonText}>Vendor Business Policy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.disclaimerContainer}>
          <Text style={styles.disclaimerText}>
            By submitting this order request, the vendor will review and confirm availability.
          </Text>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleConfirmOrder}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Confirm & send order request</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <Modal
        visible={isPolicyModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPolicyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalGlassCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Vendor Policy</Text>
              <TouchableOpacity
                onPress={() => setIsPolicyModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.policyText}>{mockVendor.policy}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeArea: {
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  vendorNameContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  vendorName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#000',
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#999',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  fulfillmentText: {
    fontSize: 17,
    color: '#000',
    fontWeight: '500' as const,
  },
  itemRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  itemInfo: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  itemName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  itemQuantity: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#000',
  },
  itemPrice: {
    fontSize: 16,
    color: '#000',
    marginBottom: 8,
  },
  addOnsList: {
    marginTop: 4,
  },
  addOnsLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 4,
  },
  addOnItem: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    marginBottom: 2,
  },
  orderNoteText: {
    fontSize: 16,
    color: '#000',
    fontStyle: 'italic' as const,
    lineHeight: 24,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#000',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  summaryLabelTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#000',
  },
  summaryValueTotal: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#000',
  },
  disclaimerContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  disclaimerText: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  submitContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  submitButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
  },
  bottomSpacer: {
    height: 40,
  },
  policyButton: {
    paddingVertical: 12,
  },
  policyButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
  },
  modalGlassCard: {
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3A3A3A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
    flex: 1,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'absolute' as const,
    right: 16,
    top: 12,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#B8B8B8',
    fontWeight: '400' as const,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  policyText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#E0E0E0',
    paddingBottom: 40,
  },
  preferredTimeContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  preferredTimeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 4,
  },
  preferredTimeValue: {
    fontSize: 15,
    color: '#000',
  },
});
