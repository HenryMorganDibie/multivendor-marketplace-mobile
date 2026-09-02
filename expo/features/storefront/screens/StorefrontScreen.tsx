import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Modal,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { ShoppingCart, Clock, MapPin, ExternalLink, Globe, ChevronRight, FileText, Package, AlertCircle, Instagram } from 'lucide-react-native';
import { VendorPolicyModal } from '@/components/VendorPolicyModal';
import Toast from '@/components/Toast';
import VendorStatusGate, { normalizeVendorStatus } from '@/components/VendorStatusGate';
import { Vendor } from '@/mocks/vendorData';
import { useStorefrontViewModel } from '@/features/storefront/hooks/useStorefrontViewModel';
import StorefrontHeader from '@/features/storefront/components/StorefrontHeader';
import StorefrontCatalog from '@/features/storefront/components/StorefrontCatalog';
import { formatPrice } from '@/utils/formatPrice';

interface StorefrontScreenProps {
  vendor: Vendor;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;

function StorefrontContent({ vendor }: StorefrontScreenProps) {
  const vm = useStorefrontViewModel(vendor);
  const vendorDetailsTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const vendorDetailsPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        return gestureState.dy > 8 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (gestureState.dy > 0) {
          vendorDetailsTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dy > 80 || gestureState.vy > 0.5) {
          Animated.timing(vendorDetailsTranslateY, {
            toValue: SCREEN_HEIGHT,
            duration: 250,
            useNativeDriver: true,
          }).start(() => vm.setShowVendorDetails(false));
        } else {
          Animated.spring(vendorDetailsTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
    })
  ).current;

  React.useEffect(() => {
    if (vm.showVendorDetails) {
      vendorDetailsTranslateY.setValue(SCREEN_HEIGHT);
      Animated.spring(vendorDetailsTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [vm.showVendorDetails, vendorDetailsTranslateY]);

  return (
    <View style={styles.container}>
      <StorefrontHeader
        vendorFavorited={vm.vendorFavorited}
        onBackPress={vm.handleBackPress}
        onToggleFavorite={vm.handleToggleFavorite}
        onMenuPress={vm.handleMenuPress}
      />

      <StorefrontCatalog
        vendor={vendor}
        categories={vm.categories}
        filteredItems={vm.filteredItems}
        groupedItems={vm.groupedItems}
        orderAgainItems={vm.orderAgainItems}
        hasCompletedOrderWithVendor={vm.hasCompletedOrderWithVendor}
        selectedCategory={vm.selectedCategory}
        searchQuery={vm.searchQuery}
        isStoreOpen={vm.isStoreOpen}
        isVendorBlocked={vm.isVendorBlocked}
        canChat={vm.canChat}
        canUsePlatformAi={vm.canUsePlatformAi}
        canAddToCart={vm.canAddToCart}
        chatMode={vm.chatMode}
        layout={vm.layout}
        getItemQuantityInCart={vm.getItemQuantityInCart}
        onCategorySelect={vm.setSelectedCategory}
        onSearchChange={vm.setSearchQuery}
        onClearSearch={() => vm.setSearchQuery('')}
        onItemPress={vm.handleItemPress}
        onAddToCart={vm.handleAddToCart}
        onIncrementItem={vm.handleIncrementItem}
        onDecrementItem={vm.handleDecrementItem}
        onVendorNamePress={vm.handleVendorNamePress}
        onViewPolicy={vm.handleViewPolicy}
        onAskAI={vm.handleAskAI}
        onMessageVendor={vm.handleMessageVendor}
      />

      {vm.cartVisible && (
        <Animated.View style={[styles.floatingCartButton, { transform: [{ scale: vm.cartScaleAnim }] }]}>
          <TouchableOpacity
            style={styles.floatingCartInner}
            onPress={vm.handleCartPress}
            activeOpacity={0.85}
          >
            <ShoppingCart size={24} color={Colors.text} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{vm.vendorCartCount}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Modal
        visible={vm.showVendorDetails}
        animationType="none"
        transparent
        onRequestClose={() => vm.setShowVendorDetails(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            Animated.timing(vendorDetailsTranslateY, {
              toValue: SCREEN_HEIGHT,
              duration: 250,
              useNativeDriver: true,
            }).start(() => vm.setShowVendorDetails(false));
          }}
        >
          <Animated.View
            style={[styles.modalGlassContainer, { transform: [{ translateY: vendorDetailsTranslateY }] }]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View {...vendorDetailsPanResponder.panHandlers}>
                <View style={styles.modalDragHandle} />
              </View>

              <View style={styles.modalHeader}>
                <Text style={styles.modalVendorName}>{vendor.name}</Text>
                {vendor.username ? (
                  <Text style={styles.modalUsername}>@{vendor.username}</Text>
                ) : null}
                <Text style={styles.modalMetadata}>
                  ⭐ {vendor.rating} ({vendor.reviewCount}) · {vendor.category}
                </Text>
                {vendor.area ? (
                  <View style={styles.modalCityRow}>
                    <MapPin size={12} color='#AAAAAA' />
                    <Text style={styles.modalAreaText}>{vendor.city}{vendor.area ? `, ${vendor.area}` : ''}</Text>
                  </View>
                ) : null}
                {vendor.description && vendor.description.trim().length > 0 ? (
                  <View style={styles.modalDescriptionBlock}>
                    <Text
                      style={styles.modalAboutText}
                      numberOfLines={vm.descriptionExpanded ? undefined : 3}
                    >
                      {vendor.description}
                    </Text>
                    {vendor.description.length > 120 && (
                      <TouchableOpacity
                        onPress={() => vm.setDescriptionExpanded(!vm.descriptionExpanded)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.modalReadMore}>
                          {vm.descriptionExpanded ? 'Show less' : 'See more'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>

              {(vendor.pickup || vendor.delivery || vendor.shipping) && (
                <>
                  <View style={styles.modalSectionBlock}>
                    <Text style={styles.modalSectionTitle}>Fulfillment</Text>
                    <View style={styles.modalFulfillmentChips}>
                      {vendor.pickup && (
                        <View style={styles.modalChip}>
                          <Text style={styles.modalChipText}>Pickup</Text>
                        </View>
                      )}
                      {vendor.delivery && (
                        <View style={styles.modalChip}>
                          <Text style={styles.modalChipText}>Delivery</Text>
                        </View>
                      )}
                      {vendor.shipping && vendor.shippingScope === 'domestic' && (
                        <View style={styles.modalChip}>
                          <Text style={styles.modalChipText}>Ships Nationwide</Text>
                        </View>
                      )}
                      {vendor.shipping && vendor.shippingScope === 'international' && (
                        <View style={styles.modalChip}>
                          <Text style={styles.modalChipText}>Ships Worldwide</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.modalDivider} />
                </>
              )}

              {vendor.businessHours && vendor.businessHours.trim().length > 0 && (
                <>
                  <View style={styles.modalSectionBlock}>
                    <Text style={styles.modalSectionTitle}>Opening Hours</Text>
                    <View style={styles.modalInfoRow}>
                      <View style={styles.modalInfoIconWrap}>
                        <Clock size={16} color='#6B7280' />
                      </View>
                      <Text style={styles.modalInfoText}>{vendor.businessHours}</Text>
                    </View>
                  </View>
                  <View style={styles.modalDivider} />
                </>
              )}

              {vendor.minimumOrderAmount ? (
                <>
                  <View style={styles.modalSectionBlock}>
                    <View style={styles.modalInfoRow}>
                      <View style={styles.modalInfoIconWrap}>
                        <Package size={16} color='#6B7280' />
                      </View>
                      <Text style={styles.modalInfoText}>Minimum order: {formatPrice(vendor.minimumOrderAmount)}</Text>
                    </View>
                  </View>
                  <View style={styles.modalDivider} />
                </>
              ) : null}

              {vendor.contactLinks && (vendor.contactLinks.website || vendor.contactLinks.instagram || vendor.contactLinks.tiktok) && (
                <>
                  <View style={styles.modalSectionBlock}>
                    <Text style={styles.modalSectionTitle}>Connect with {vendor.name}</Text>
                    {vendor.contactLinks.website && (
                      <TouchableOpacity
                        style={styles.modalLinkRow}
                        onPress={() => vm.handleOpenLink(vendor.contactLinks!.website!)}
                        activeOpacity={0.7}
                      >
                        <Globe size={16} color='#6B7280' />
                        <Text style={styles.modalLinkRowText}>Website</Text>
                        <ExternalLink size={14} color={Colors.primary} style={{ marginLeft: 'auto' } as any} />
                      </TouchableOpacity>
                    )}
                    {vendor.contactLinks.instagram && (
                      <TouchableOpacity
                        style={styles.modalLinkRow}
                        onPress={() => vm.handleOpenLink(vendor.contactLinks!.instagram!)}
                        activeOpacity={0.7}
                      >
                        <Instagram size={16} color='#E1306C' />
                        <Text style={styles.modalLinkRowText}>Instagram</Text>
                        <ExternalLink size={14} color={Colors.primary} style={{ marginLeft: 'auto' } as any} />
                      </TouchableOpacity>
                    )}
                    {vendor.contactLinks.tiktok && (
                      <TouchableOpacity
                        style={styles.modalLinkRow}
                        onPress={() => vm.handleOpenLink(vendor.contactLinks!.tiktok!)}
                        activeOpacity={0.7}
                      >
                        <Globe size={16} color='#010101' />
                        <Text style={styles.modalLinkRowText}>TikTok</Text>
                        <ExternalLink size={14} color={Colors.primary} style={{ marginLeft: 'auto' } as any} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.modalDivider} />
                </>
              )}

              <View style={styles.modalActionsBlock}>
                {vendor.policy && vendor.policy.trim().length > 0 && (
                  <>
                    <TouchableOpacity
                      style={styles.modalActionRow}
                      onPress={() => {
                        Animated.timing(vendorDetailsTranslateY, {
                          toValue: SCREEN_HEIGHT,
                          duration: 200,
                          useNativeDriver: true,
                        }).start(() => {
                          vm.setShowVendorDetails(false);
                          setTimeout(() => vm.handleViewPolicy(), 300);
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.modalActionIconWrap}>
                        <FileText size={18} color='#2B2B2B' />
                      </View>
                      <Text style={styles.modalActionRowText}>{vendor.name}'s Business Policy</Text>
                      <ChevronRight size={18} color='#C0C0C0' />
                    </TouchableOpacity>
                    <View style={styles.modalActionDivider} />
                  </>
                )}

                <View style={styles.trustMessageRow}>
                  <Text style={styles.trustMessageText}>Payments handled by {vendor.name}</Text>
                </View>

                <View style={styles.modalActionDivider} />

                <TouchableOpacity
                  onPress={vm.handleReportPress}
                  style={styles.reportButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.reportButtonText}>Report an issue</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBottomSpacer} />
            </ScrollView>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={vm.showClosedModal}
        animationType="slide"
        transparent
        onRequestClose={() => vm.setShowClosedModal(false)}
      >
        <TouchableOpacity
          style={styles.closedModalOverlay}
          activeOpacity={1}
          onPress={() => vm.setShowClosedModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.closedModalContainer}>
            <View style={styles.closedModalHandle} />

            <View style={styles.closedModalIconRow}>
              <View style={styles.closedModalIconBg}>
                <AlertCircle size={28} color='#FF8C42' />
              </View>
            </View>

            <Text style={styles.closedModalTitle}>Store is currently closed</Text>
            <Text style={styles.closedModalMessage}>
              {vendor.businessHours
                ? (() => {
                    const match = vendor.businessHours.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                    return match ? `Opens at ${match[1]}` : 'This vendor is not accepting orders right now. You can still browse their store.';
                  })()
                : 'This vendor is not accepting orders right now. You can still browse their store.'}
            </Text>

            {vendor.awayMessage || vendor.closedMessage ? (
              <View style={styles.closedModalVendorMessage}>
                <Text style={styles.closedModalVendorMessageText}>
                  {vendor.awayMessage || vendor.closedMessage}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.closedModalPrimaryButton}
              onPress={() => vm.setShowClosedModal(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.closedModalPrimaryButtonText}>View Store</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <VendorPolicyModal
        visible={vm.showPolicyModal}
        onClose={() => vm.setShowPolicyModal(false)}
        policy={vendor.policy || ''}
        vendorName={vendor.name}
      />

      <Toast visible={vm.showCopiedToast} />
    </View>
  );
}

export default function StorefrontScreen({ vendor }: StorefrontScreenProps) {
  const normalizedStatus = normalizeVendorStatus(vendor.vendorStatus);
  return (
    <VendorStatusGate vendorStatus={normalizedStatus} vendorName={vendor.name}>
      <StorefrontContent vendor={vendor} />
    </VendorStatusGate>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  floatingCartButton: {
    position: 'absolute' as const,
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 10,
  },
  floatingCartInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cartBadge: {
    position: 'absolute' as const,
    top: -5,
    right: -5,
    backgroundColor: '#E53935',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
    lineHeight: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end' as const,
  },
  modalGlassContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '90%' as any,
    overflow: 'hidden' as const,
    paddingBottom: 32,
  },
  modalDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
  },
  modalUsername: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 6,
    fontWeight: '400' as const,
  },
  trustMessageRow: {
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  trustMessageText: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
  modalCityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 3,
  },
  modalDescriptionBlock: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F2',
  },
  modalContent: {
    flex: 1,
  },
  modalVendorName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    marginBottom: 4,
    lineHeight: 28,
  },
  modalMetadata: {
    fontSize: 13,
    color: '#8A8A8A',
    lineHeight: 19,
  },
  modalAreaText: {
    fontSize: 12,
    color: '#AAAAAA',
    lineHeight: 17,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginHorizontal: 0,
  },
  modalSectionBlock: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  modalSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#8A8A8A',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  modalAboutText: {
    fontSize: 15,
    color: '#4A4A4A',
    lineHeight: 23,
  },
  modalReadMore: {
    fontSize: 14,
    color: '#FF8C42',
    fontWeight: '600' as const,
    marginTop: 6,
  },
  modalInfoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  modalInfoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalInfoText: {
    fontSize: 15,
    color: '#4A4A4A',
    flex: 1,
    lineHeight: 21,
  },
  modalFulfillmentChips: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  modalChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F2F2F2',
  },
  modalChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#2B2B2B',
  },
  modalLinkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    paddingVertical: 10,
  },
  modalLinkRowText: {
    fontSize: 15,
    color: '#2B2B2B',
    flex: 1,
  },
  modalActionsBlock: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  modalActionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 14,
  },
  modalActionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F2F2F2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalActionRowText: {
    fontSize: 15,
    color: '#2B2B2B',
    flex: 1,
    fontWeight: '500' as const,
  },
  modalActionDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginLeft: 46,
  },
  reportButton: {
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  reportButtonText: {
    fontSize: 15,
    color: '#D94040',
    fontWeight: '500' as const,
  },
  modalBottomSpacer: {
    height: 40,
  },
  closedModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  closedModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  closedModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 24,
  },
  closedModalIconRow: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  closedModalIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,140,66,0.10)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  closedModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    marginBottom: 10,
  },
  closedModalMessage: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 20,
  },
  closedModalVendorMessage: {
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.20)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  closedModalVendorMessageText: {
    fontSize: 14,
    color: '#2B2B2B',
    textAlign: 'center' as const,
    lineHeight: 20,
    fontStyle: 'italic' as const,
  },
  closedModalPrimaryButton: {
    backgroundColor: '#FF8C42',
    height: 52,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  closedModalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

});
