import React, { useCallback, useMemo, type RefObject } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Alert } from '@/utils/alert';
import Toast from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import {
  Award,
  ShoppingBag,
  DollarSign,
  MapPin,
  MessageSquare,
  ClipboardList,
  FileText,
  Receipt,
  Copy,
  Send,
  X,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { Colors } from '@/constants/colors';
import { ChatMessage } from '@/mocks/chatData';
import { mockVendor } from '@/mocks/vendorData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { useVendorOrderChat } from '@/features/chat/hooks/useVendorOrderChat';
import { ChatHeader } from '@/features/chat/components/ChatHeader';
import { OrderContextBanner } from '@/features/chat/components/OrderContextBanner';
import { MessageList } from '@/features/chat/components/MessageList';
import { ChatComposer } from '@/features/chat/components/ChatComposer';
import {
  transformSystemMessageForVendor,
  formatDate,
  formatTime,
  formatOrderStatus,
} from '@/features/chat/selectors/chatSelectors';
import StatusBadge from '@/components/StatusBadge';

type Props = {
  orderId: string;
};

export const VendorOrderChatScreen = ({ orderId }: Props) => {
  const vm = useVendorOrderChat(orderId);
  const { toastVisible, showToast } = useToast();

  const transformMessage = useCallback(
    (content: string) => transformSystemMessageForVendor(content, vm.customerFirstName),
    [vm.customerFirstName]
  );

  const handleViewContactDetails = useCallback((data: Parameters<typeof vm.setSecureContactData>[0]) => {
    vm.setSecureContactData(data);
    vm.setShowSecureContactModal(true);
  }, [vm]);

  const handleCreateCustomOrder = useCallback(() => {
    console.log('Create custom order tapped');
    const newProposalId = `proposal-${Date.now()}`;
    const chatId = `chat-order-${orderId}`;
    const vendorSlug = 'sanste';
    const formattedCustomerName = formatCustomerNameFromFull(vm.order?.customerName || 'Customer');
    router.push(
      `/vendor/custom-order/${newProposalId}?chatId=${encodeURIComponent(chatId)}&customerName=${encodeURIComponent(formattedCustomerName)}&vendorId=${vm.vendorId}&vendorSlug=${vendorSlug}` as any
    );
  }, [orderId, vm.order?.customerName, vm.vendorId]);

  const handleSendPaymentRequest = useCallback(() => {
    vm.setShowActionsMenu(false);
    if (vm.activeOrders.length === 0) {
      Alert.alert('No Active Orders', 'Payment requests can only be sent for accepted orders.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    if (vm.existingPaymentRequest) {
      setTimeout(() => vm.setShowExistingPaymentModal(true), 300);
      return;
    }
    setTimeout(() => {
      router.push(`/vendor/send-payment-request/${vm.order?.id}?fromOrder=${vm.order?.id}` as any);
    }, 300);
  }, [vm]);

  const handleResendPaymentRequest = useCallback(() => {
    vm.setShowExistingPaymentModal(false);
    Alert.alert('Payment Request Resent', 'The payment request has been resent to the customer.', [{ text: 'OK' }]);
  }, [vm]);

  const handleCopyPaymentInstructions = useCallback(async () => {
    if (!vm.existingPaymentRequest?.paymentRequestData) return;
    const pd = vm.existingPaymentRequest.paymentRequestData;
    let instructions = `Amount: ${formatPriceWithCommas(pd.amount, (mockVendor.currency as Currency) || 'NGN')}\nMethod: ${pd.paymentMethod}`;
    if (pd.bankName) instructions += `\nBank: ${pd.bankName}`;
    if (pd.accountName) instructions += `\nAccount Name: ${pd.accountName}`;
    if (pd.accountNumber) instructions += `\nAccount Number: ${pd.accountNumber}`;
    if (pd.message) instructions += `\nNote: ${pd.message}`;
    await Clipboard.setStringAsync(instructions);
    showToast();
  }, [vm.existingPaymentRequest, showToast]);

  const handleCatalogPress = useCallback(() => {
    vm.setShowCatalogModal(true);
    vm.setSelectedCatalogItems([]);
  }, [vm]);

  const handleSendCatalogItems = useCallback(() => {
    console.log('Sending catalog items:', vm.selectedCatalogItems);
    vm.setShowCatalogModal(false);
    vm.setSelectedCatalogItems([]);
  }, [vm]);

  const handlePickupDetailsPress = useCallback(() => {
    vm.setShowPickupModal(true);
    vm.setEditingPickup(false);
  }, [vm]);

  const handleSendPickupDetails = useCallback(() => {
    console.log('Sending pickup details:', { address: vm.pickupAddress, instructions: vm.pickupInstructions });
    const pickupMessage: ChatMessage = {
      id: `m${Date.now()}`,
      type: 'pickup-details',
      content: 'Pickup details sent',
      sender: 'vendor',
      timestamp: new Date().toISOString(),
      pickupDetailsData: {
        address: vm.pickupAddress,
        instructions: vm.pickupInstructions,
        scheduledDate: vm.order?.scheduledDate,
        scheduledTime: vm.order?.scheduledTime,
      },
    };
    console.log('Pickup details message created:', pickupMessage);
    vm.setShowPickupModal(false);
    vm.setEditingPickup(false);
  }, [vm]);

  const handleQuickReplyPress = useCallback(() => {
    vm.setShowActionsMenu(false);
    if (vm.quickReplies.length === 0) {
      setTimeout(() => router.push('/vendor/settings/quick-replies' as any), 300);
    } else {
      setTimeout(() => vm.setShowQuickRepliesModal(true), 300);
    }
  }, [vm]);

  const handleInvoicePress = useCallback(() => {
    vm.setShowActionsMenu(false);
    if (vm.activeOrders.length === 0) {
      Alert.alert('No Active Orders', 'Invoices can only be generated for accepted orders.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    if (vm.plan === 'basic') {
      Alert.alert(
        'Upgrade Required',
        'Invoice generation is available on Standard and Pro plans.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Upgrade', onPress: () => router.push('/vendor/settings/subscription' as any) }]
      );
      return;
    }
    vm.setDocumentType('invoice');
    if (vm.activeOrders.length > 1) {
      setTimeout(() => vm.setShowOrderSelectionModal(true), 300);
    } else {
      setTimeout(() => router.push(`/vendor/invoice/${vm.activeOrders[0].id}?chatId=${encodeURIComponent(vm.chatId)}` as any), 300);
    }
  }, [vm]);

  const handleReceiptPress = useCallback(() => {
    vm.setShowActionsMenu(false);
    if (vm.activeOrders.length === 0) {
      Alert.alert('No Active Orders', 'Receipts can only be generated for accepted orders.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    if (vm.plan === 'basic') {
      Alert.alert(
        'Upgrade Required',
        'Receipt generation is available on Standard and Pro plans.',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Upgrade', onPress: () => router.push('/vendor/settings/subscription' as any) }]
      );
      return;
    }
    vm.setDocumentType('receipt');
    if (vm.activeOrders.length > 1) {
      setTimeout(() => vm.setShowOrderSelectionModal(true), 300);
    } else {
      setTimeout(() => router.push(`/vendor/receipt/${vm.activeOrders[0].id}?chatId=${encodeURIComponent(vm.chatId)}` as any), 300);
    }
  }, [vm]);

  const handleSelectQuickReply = useCallback((shortcut: string) => {
    vm.setMessageText(`/${shortcut}`);
    vm.setShowQuickRepliesModal(false);
  }, [vm]);

  const handleBlockCustomer = useCallback(() => {
    if (!vm.isCompleted && !vm.isRejected && vm.order?.status !== 'cancelled') {
      Alert.alert('Cannot block customer', 'You can only block customers after the order is completed or cancelled.', [{ text: 'OK', style: 'default' }]);
      return;
    }
    Alert.alert(
      'Block customer',
      'This will archive the chat and prevent further messages. Order history will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            vm.blockUser({
              id: `customer-${orderId}`,
              name: vm.order?.customerName || 'Customer',
              role: 'customer',
              chatId: vm.chatId,
              blockedAt: new Date().toISOString(),
            });
            vm.setSystemActionMessages((prev) => [
              ...prev,
              { id: `action-block-${Date.now()}`, content: `You blocked ${vm.customerDisplayName}` },
            ]);
            console.log('Customer blocked');
          },
        },
      ]
    );
  }, [vm, orderId]);

  const handleSelectOrder = useCallback((selectedOrderId: string) => {
    vm.setShowOrderSelectionModal(false);
    setTimeout(() => {
      if (vm.documentType === 'invoice') {
        router.push(`/vendor/invoice/${selectedOrderId}?chatId=${encodeURIComponent(vm.chatId)}` as any);
      } else if (vm.documentType === 'receipt') {
        router.push(`/vendor/receipt/${selectedOrderId}?chatId=${encodeURIComponent(vm.chatId)}` as any);
      }
      vm.setDocumentType(null);
    }, 300);
  }, [vm]);

  const chatProposalNode = useMemo(() => {
    const proposal = vm.chatProposal;
    if (!proposal) return null;
    const itemCount = proposal.items.reduce((sum, item) => sum + item.quantity, 0);
    const handleViewCustomOrder = () => {
      router.push(
        `/vendor/custom-order/${proposal.id}?chatId=${encodeURIComponent(vm.chatId)}&customerName=${encodeURIComponent(proposal.customerName)}&vendorId=${proposal.vendorId}&vendorSlug=${proposal.vendorSlug}` as any
      );
    };
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.customOrderPreviewCard}>
          <View style={styles.customOrderPreviewContent}>
            <View style={styles.customOrderPreviewImagePlaceholder}>
              <Text style={styles.customOrderPreviewImagePlaceholderText}>🛒</Text>
            </View>
            <View style={styles.customOrderPreviewInfo}>
              <Text style={styles.customOrderPreviewTitle}>Custom Order Proposal</Text>
              <Text style={styles.customOrderPreviewItems}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
              <Text style={styles.customOrderPreviewTotal}>{formatPriceWithCommas(proposal.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.customOrderPreviewButton} onPress={handleViewCustomOrder} activeOpacity={0.7}>
            <Text style={styles.customOrderPreviewButtonText}>View custom order</Text>
          </TouchableOpacity>
          <Text style={styles.customOrderPreviewTimestamp}>{formatTime(proposal.updatedAt)}</Text>
        </View>
      </View>
    );
  }, [vm.chatProposal, vm.chatId]);

  const demoCatalogNode = useMemo(() => (
    <View style={styles.systemMessageContainer}>
      <View style={styles.catalogItemCard}>
        <Text style={styles.catalogItemCardLabel}>Catalog item shared</Text>
        <View style={styles.catalogItemCardContent}>
          <View style={styles.catalogItemCardImageContainer}>
            <View style={styles.catalogItemCardImagePlaceholder} />
          </View>
          <View style={styles.catalogItemCardInfo}>
            <Text style={styles.catalogItemCardName}>Puff Puff (20 pcs)</Text>
            <Text style={styles.catalogItemCardPrice}>{formatPriceWithCommas(1500, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.catalogItemCardButton} onPress={() => router.push('/vendor/catalog/item/demo-1' as any)} activeOpacity={0.7}>
          <Text style={styles.catalogItemCardButtonText}>View item</Text>
        </TouchableOpacity>
      </View>
    </View>
  ), []);

  if (!vm.chat || !vm.order) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹</Text>
            </TouchableOpacity>
            <View style={styles.headerContent}>
              <Text style={styles.errorText}>Order not found</Text>
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="vendor-order-chat-screen">
      <Stack.Screen options={{ headerShown: false }} />

      <ChatHeader
        customerDisplayName={vm.customerDisplayName}
        customerInitials={vm.customerInitials}
        customerAvatarColor={vm.customerAvatarColor}
        orderId={orderId}
        publicOrderId={vm.order.publicOrderId}
        onAvatarPress={() => vm.setShowCustomerProfile(true)}
        trustLabel={[vm.trustIndicators.orderLabel, vm.trustIndicators.joinedLabel].filter(Boolean).join(' · ')}
      />

      <OrderContextBanner
        pinnedOrders={vm.pinnedOrders}
        existingPaymentRequest={vm.existingPaymentRequest}
      />

      {vm.isBlocked && (
        <View style={styles.blockedBanner}>
          <Text style={styles.blockedBannerText}>You&apos;ve blocked this user. You can unblock them in Settings.</Text>
        </View>
      )}

      <View style={styles.flex}>
        <MessageList
          messages={vm.chat.messages}
          scrollViewRef={vm.scrollViewRef as RefObject<ScrollView>}
          orderId={orderId}
          publicOrderId={vm.order.publicOrderId}
          isCompleted={vm.isCompleted}
          orderStatus={vm.order.status}
          systemActionMessages={vm.systemActionMessages}
          onShowCopyToast={showToast}
          onViewContactDetails={handleViewContactDetails}
          transformSystemMessage={transformMessage}
          headerComponent={demoCatalogNode}
          footerComponent={chatProposalNode}
        />

        <ChatComposer
          messageText={vm.messageText}
          onChangeText={vm.handleMessageTextChange}
          onSend={vm.handleSendMessage}
          onPlusPress={() => vm.setShowActionsMenu(true)}
          isDisabled={vm.chatAvailability.isVendorInputDisabled}
          disabledReason={vm.chatAvailability.vendorReason || vm.chatAvailability.reason}
          validationError={vm.validationError}
          isBlocked={vm.isBlocked}
          quickReplies={vm.quickReplies}
          onQuickReplyTrigger={() => vm.setShowQuickRepliesModal(true)}
        />
      </View>

      {/* Actions Menu Modal */}
      <Modal visible={vm.showActionsMenu} animationType="slide" transparent onRequestClose={() => vm.setShowActionsMenu(false)}>
        <TouchableOpacity style={styles.actionsMenuOverlay} activeOpacity={1} onPress={() => vm.setShowActionsMenu(false)}>
          <View style={styles.actionsMenuContainer}>
            <View style={styles.actionsMenuGrid}>
              {[
                { icon: DollarSign, label: 'Payment', onPress: () => { vm.setShowActionsMenu(false); setTimeout(() => handleSendPaymentRequest(), 300); }, disabled: false },
                { icon: MapPin, label: 'Pickup', onPress: () => { vm.setShowActionsMenu(false); setTimeout(() => handlePickupDetailsPress(), 300); }, disabled: false },
                { icon: ShoppingBag, label: 'Catalog', onPress: () => { vm.setShowActionsMenu(false); setTimeout(() => handleCatalogPress(), 300); }, disabled: false },
                { icon: MessageSquare, label: 'Quick replies', onPress: handleQuickReplyPress, disabled: false },
                { icon: FileText, label: 'Invoice', onPress: handleInvoicePress, disabled: vm.plan === 'basic', upgrade: vm.plan === 'basic' },
                { icon: Receipt, label: 'Receipt', onPress: handleReceiptPress, disabled: vm.plan === 'basic', upgrade: vm.plan === 'basic' },
                { icon: ClipboardList, label: 'Custom Order', onPress: () => { vm.setShowActionsMenu(false); setTimeout(() => handleCreateCustomOrder(), 300); }, disabled: false },
              ].map(({ icon: Icon, label, onPress, disabled, upgrade }) => (
                <TouchableOpacity key={label} style={styles.actionsMenuGridItem} onPress={onPress} activeOpacity={0.7}>
                  <View style={[styles.actionsMenuIconCircle, disabled && styles.actionsMenuIconCircleDisabled]}>
                    <Icon size={24} color={disabled ? Colors.textSecondary : Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>{label}</Text>
                  {upgrade && <Text style={styles.actionsMenuUpgradeText}>Upgrade</Text>}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Catalog Modal */}
      <Modal visible={vm.showCatalogModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => vm.setShowCatalogModal(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => vm.setShowCatalogModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Catalog</Text>
            <TouchableOpacity onPress={handleSendCatalogItems} disabled={vm.selectedCatalogItems.length === 0}>
              <Text style={[styles.modalActionText, vm.selectedCatalogItems.length === 0 && styles.modalActionTextDisabled]}>Send</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {vm.categories.map((category) => {
              const categoryItems = vm.catalogItems.filter((item) => item.categoryId === category.id && item.isAvailable);
              if (categoryItems.length === 0) return null;
              return (
                <View key={category.id} style={styles.catalogSection}>
                  <Text style={styles.catalogSectionTitle}>{category.name}</Text>
                  {categoryItems.map((item) => {
                    const isSelected = vm.selectedCatalogItems.includes(item.id);
                    const displayPrice = item.salePrice || item.basePrice;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.catalogItem, isSelected && styles.catalogItemSelected]}
                        onPress={() => vm.setSelectedCatalogItems((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])}
                        activeOpacity={0.7}
                      >
                        <View style={styles.catalogItemLeft}>
                          {item.photos[0] ? (
                            <Image source={{ uri: item.photos[0] }} style={styles.catalogItemImage} contentFit="cover" />
                          ) : (
                            <View style={styles.catalogItemImagePlaceholder}>
                              <Text style={styles.catalogItemImagePlaceholderText}>📷</Text>
                            </View>
                          )}
                          <View style={styles.catalogItemInfo}>
                            <Text style={styles.catalogItemName}>{item.name}</Text>
                            {item.description && <Text style={styles.catalogItemDescription} numberOfLines={1}>{item.description}</Text>}
                            <Text style={styles.catalogItemPrice}>{formatPriceWithCommas(displayPrice, (mockVendor.currency as Currency) || 'NGN')}</Text>
                          </View>
                        </View>
                        <View style={[styles.catalogCheckbox, isSelected && styles.catalogCheckboxSelected]}>
                          {isSelected && <Text style={styles.catalogCheckmark}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Pickup Modal */}
      <Modal visible={vm.showPickupModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => vm.setShowPickupModal(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => vm.setShowPickupModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pickup Details</Text>
            <TouchableOpacity onPress={() => { vm.setShowPickupModal(false); router.push('/vendor/settings/pickup-details' as any); }}>
              <Text style={styles.modalActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickupContent} showsVerticalScrollIndicator={false}>
            {!vm.pickupAddress.trim() ? (
              <View style={styles.pickupEmptyState}>
                <View style={styles.pickupEmptyIcon}><MapPin size={48} color={Colors.textMuted} strokeWidth={1.5} /></View>
                <Text style={styles.pickupEmptyTitle}>No pickup details saved</Text>
                <Text style={styles.pickupEmptyDescription}>Set up your pickup address and instructions in Settings to quickly share them with customers.</Text>
                <TouchableOpacity style={styles.pickupSetupButton} onPress={() => { vm.setShowPickupModal(false); router.push('/vendor/settings/pickup-details' as any); }} activeOpacity={0.7}>
                  <Text style={styles.pickupSetupButtonText}>Set up pickup details</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.pickupInfoBanner}>
                  <Text style={styles.pickupInfoText}>📍 Saved from Settings · Tap Settings to update</Text>
                </View>
                <View style={styles.pickupSection}>
                  <Text style={styles.pickupLabel}>Pickup Address</Text>
                  <View style={styles.pickupValueCard}><Text style={styles.pickupValue}>{vm.pickupAddress}</Text></View>
                </View>
                {vm.pickupInstructions.trim() && (
                  <View style={styles.pickupSection}>
                    <Text style={styles.pickupLabel}>Pickup Instructions</Text>
                    <View style={styles.pickupValueCard}><Text style={styles.pickupValue}>{vm.pickupInstructions}</Text></View>
                  </View>
                )}
                <TouchableOpacity style={styles.sendPickupButton} onPress={handleSendPickupDetails} activeOpacity={0.7}>
                  <Text style={styles.sendPickupButtonText}>Send to chat</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Quick Replies Modal */}
      <Modal visible={vm.showQuickRepliesModal} animationType="slide" transparent onRequestClose={() => vm.setShowQuickRepliesModal(false)}>
        <TouchableOpacity style={styles.quickRepliesOverlay} activeOpacity={1} onPress={() => vm.setShowQuickRepliesModal(false)}>
          <KeyboardAvoidingView style={styles.quickRepliesKeyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.quickRepliesContainer}>
                <View style={styles.quickRepliesHeader}>
                  <View style={styles.quickRepliesHeaderLeft} />
                  <Text style={styles.quickRepliesTitle}>Quick Replies</Text>
                  <TouchableOpacity style={styles.quickRepliesEditButton} onPress={() => { vm.setShowQuickRepliesModal(false); setTimeout(() => router.push('/vendor/settings/quick-replies' as any), 300); }} activeOpacity={0.7}>
                    <Text style={styles.quickRepliesEditText}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.quickRepliesList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" bounces={false}>
                  {vm.quickReplies.length === 0 ? (
                    <View style={styles.quickRepliesEmptyContainer}>
                      <Text style={styles.quickRepliesEmpty}>No quick replies saved</Text>
                      <Text style={styles.quickRepliesEmptySubtext}>Tap Manage to create your first quick reply</Text>
                    </View>
                  ) : (
                    vm.quickReplies.map((reply) => (
                      <TouchableOpacity key={reply.id} style={styles.quickReplyItem} onPress={() => handleSelectQuickReply(reply.shortcut)} activeOpacity={0.7}>
                        <Text style={styles.quickReplyShortcut}>/{reply.shortcut}</Text>
                        <Text style={styles.quickReplyMessage} numberOfLines={2}>{reply.message}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Customer Profile Modal */}
      <Modal visible={vm.showCustomerProfile} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => vm.setShowCustomerProfile(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.profileHeader}>
            <View style={styles.profileHeaderLeft} />
            <Text style={styles.profileTitle}>Customer Profile</Text>
            <TouchableOpacity onPress={() => vm.setShowCustomerProfile(false)} style={styles.profileCloseButton}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.profileContent} showsVerticalScrollIndicator={false}>
            <View style={styles.profileAvatarSection}>
              <View style={[styles.profileAvatarLarge, { backgroundColor: vm.customerAvatarColor }]}>
                <Text style={styles.profileAvatarLargeText}>{vm.customerInitials}</Text>
              </View>
              <Text style={styles.profileCustomerName}>{vm.customerDisplayName}</Text>
            </View>
            <View style={styles.profileSummaryCard}>
              <View style={styles.profileSummaryRow}>
                {[
                  { label: 'Total orders', value: vm.getCustomerOrderHistory().length },
                  { label: 'Completed', value: vm.getCompletedOrdersCount() },
                  { label: 'Last order', value: vm.getLastOrderDate() ? formatDate(vm.getLastOrderDate()!) : '-' },
                ].map((item, index, arr) => (
                  <React.Fragment key={item.label}>
                    <View style={styles.profileSummaryItem}>
                      <Text style={styles.profileSummaryLabel}>{item.label}</Text>
                      <Text style={styles.profileSummaryValue}>{item.value}</Text>
                    </View>
                    {index < arr.length - 1 && <View style={styles.profileSummaryDivider} />}
                  </React.Fragment>
                ))}
              </View>
              {vm.getCompletedOrdersCount() >= 2 && (
                <View style={styles.repeatBadge}>
                  <Award size={14} color={Colors.success} />
                  <Text style={styles.repeatBadgeText}>Repeat Customer</Text>
                </View>
              )}
            </View>
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Vendor Notes</Text>
              <View style={styles.notesCardContainer}>
                <TouchableOpacity style={styles.notesCard} onPress={vm.handleOpenNotesModal} activeOpacity={0.7}>
                  <Text style={[styles.notesCardText, !vm.customerNoteText && styles.notesCardPlaceholder]}>
                    {vm.customerNoteText || 'Add notes about this customer...'}
                  </Text>
                </TouchableOpacity>
                <View style={styles.notesFooterRow}>
                  <Text style={styles.notesHelperText}>Only you can see this</Text>
                  {vm.customerNoteMeta.updatedAt && vm.customerNoteText ? (
                    <Text style={styles.notesLastUpdated}>
                      Last updated: {new Date(vm.customerNoteMeta.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
            <View style={styles.profileSection}>
              <View style={styles.profileSectionHeader}>
                <Text style={styles.profileSectionTitle}>Order History</Text>
                {vm.getCustomerOrderHistory().length > 3 && (
                  <TouchableOpacity onPress={() => { vm.setShowCustomerProfile(false); setTimeout(() => router.push(`/vendor/customer-orders/${vm.customerId}?customerName=${encodeURIComponent(vm.customerDisplayName)}&vendorId=${vm.vendorId}` as any), 300); }} activeOpacity={0.7}>
                    <Text style={styles.seeAllText}>See all</Text>
                  </TouchableOpacity>
                )}
              </View>
              {vm.getCustomerOrderHistory().length === 0 ? (
                <Text style={styles.emptyText}>No orders yet</Text>
              ) : (
                vm.getCustomerOrderHistory().slice(0, 3).map((historyOrder) => (
                  <TouchableOpacity key={historyOrder.id} style={styles.orderHistoryCard} onPress={() => { vm.setShowCustomerProfile(false); router.push(`/vendor/orders/${historyOrder.id}` as any); }} activeOpacity={0.7}>
                    <View style={styles.orderHistoryMain}>
                      <View style={styles.orderHistoryLeft}>
                        <Text style={styles.orderHistoryId}>{formatVendorOrderId(historyOrder.publicOrderId)}</Text>
                        <Text style={styles.orderHistoryDate}>{formatDate(historyOrder.orderDate)}</Text>
                      </View>
                      <View style={styles.orderHistoryRight}>
                        <Text style={styles.orderHistoryAmount}>{formatPriceWithCommas(historyOrder.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
                        <StatusBadge status={historyOrder.status} label={formatOrderStatus(historyOrder.status)} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
            <View style={styles.profileActionsSection}>
              <TouchableOpacity style={styles.actionButton} onPress={() => { vm.setShowCustomerProfile(false); handleBlockCustomer(); }} activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>Block {vm.customerDisplayName}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={() => { vm.setShowCustomerProfile(false); setTimeout(() => router.push(`/report-vendor?type=customer&name=${encodeURIComponent(vm.customerDisplayName)}` as any), 300); }} activeOpacity={0.7}>
                <Text style={styles.actionButtonText}>Report {vm.customerDisplayName}</Text>
              </TouchableOpacity>
              {vm.getCustomerSinceDate() && (
                <Text style={styles.customerSinceText}>Customer since {formatDate(vm.getCustomerSinceDate()!)}</Text>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Secure Contact Modal */}
      <Modal visible={vm.showSecureContactModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { vm.setShowSecureContactModal(false); vm.setSecureContactData(null); }}>
        <SafeAreaView style={styles.secureModalContainer} edges={['top', 'bottom']}>
          <View style={styles.secureModalHeader}>
            <Text style={styles.secureModalTitle}>Contact Details</Text>
            <TouchableOpacity onPress={() => { vm.setShowSecureContactModal(false); vm.setSecureContactData(null); }} style={styles.secureModalCloseButton}>
              <X size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.secureModalContent}>
            <View style={styles.secureWarningBanner}>
              <Text style={styles.secureWarningText}>🔒 Secure View · Contact details will expire when order is completed</Text>
            </View>
            {vm.secureContactData?.name && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Full Name</Text>
                <Text style={styles.secureContactValue}>{vm.secureContactData.name}</Text>
              </View>
            )}
            {vm.secureContactData?.phone && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Phone Number</Text>
                <Text style={styles.secureContactValue}>{vm.secureContactData.phone}</Text>
              </View>
            )}
            {vm.secureContactData?.address && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Address</Text>
                <Text style={styles.secureContactValue}>{vm.secureContactData.address}</Text>
              </View>
            )}
            {vm.secureContactData?.note && (
              <View style={styles.secureContactSection}>
                <Text style={styles.secureContactLabel}>Delivery / Pickup Note</Text>
                <Text style={[styles.secureContactValue, styles.secureContactValueMultiline]}>{vm.secureContactData.note}</Text>
              </View>
            )}
            <View style={styles.securePrivacyNotice}>
              <Text style={styles.securePrivacyText}>⚠️ Privacy Notice</Text>
              <Text style={styles.securePrivacyDescription}>
                • Contact details are order-scoped and time-bound{"\n"}
                • Access expires automatically when order is completed{"\n"}
                • Do not share or save this information externally
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Notes Modal */}
      <Modal visible={vm.showNotesModal} animationType="slide" presentationStyle="fullScreen" onRequestClose={vm.handleCancelNote}>
        <SafeAreaView style={styles.notesModalContainer} edges={['top']}>
          <View style={styles.notesModalHeader}>
            <TouchableOpacity onPress={vm.handleCancelNote} style={styles.notesModalHeaderButton}>
              <Text style={styles.notesModalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.notesModalTitle}>Notes</Text>
            <TouchableOpacity onPress={vm.handleSaveNote} style={styles.notesModalHeaderButton}>
              <Text style={styles.notesModalSave}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.notesModalContent}>
            <TextInput
              style={styles.notesModalInput}
              placeholder="Add notes about this customer..."
              placeholderTextColor={Colors.textSecondary}
              value={vm.tempNoteText}
              onChangeText={vm.setTempNoteText}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.notesModalFooter}>
              <Text style={styles.notesModalHelperText}>Notes are visible only to you.</Text>
              <Text style={styles.notesModalCharCount}>{vm.tempNoteText.length} / 500</Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Existing Payment Modal */}
      <Modal visible={vm.showExistingPaymentModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => vm.setShowExistingPaymentModal(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => vm.setShowExistingPaymentModal(false)}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Payment Request</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.existingPaymentContent} showsVerticalScrollIndicator={false}>
            {vm.existingPaymentRequest?.paymentRequestData && (
              <>
                <View style={styles.existingPaymentStatusCard}>
                  <View style={styles.existingPaymentStatusDot} />
                  <Text style={styles.existingPaymentStatusText}>Awaiting customer payment</Text>
                </View>
                <View style={styles.existingPaymentAmountCard}>
                  <Text style={styles.existingPaymentAmountLabel}>AMOUNT REQUESTED</Text>
                  <Text style={styles.existingPaymentAmountValue}>{formatPriceWithCommas(vm.existingPaymentRequest.paymentRequestData.amount, (mockVendor.currency as Currency) || 'NGN')}</Text>
                  <Text style={styles.existingPaymentMethodText}>{vm.existingPaymentRequest.paymentRequestData.paymentMethod}</Text>
                </View>
                {vm.existingPaymentRequest.paymentRequestData.bankName && (
                  <View style={styles.existingPaymentDetailCard}>
                    <Text style={styles.existingPaymentDetailTitle}>Payment Details</Text>
                    <View style={styles.existingPaymentDetailRow}>
                      <Text style={styles.existingPaymentDetailLabel}>Bank</Text>
                      <Text style={styles.existingPaymentDetailValue}>{vm.existingPaymentRequest.paymentRequestData.bankName}</Text>
                    </View>
                    {vm.existingPaymentRequest.paymentRequestData.accountName && (
                      <View style={styles.existingPaymentDetailRow}>
                        <Text style={styles.existingPaymentDetailLabel}>Account Name</Text>
                        <Text style={styles.existingPaymentDetailValue}>{vm.existingPaymentRequest.paymentRequestData.accountName}</Text>
                      </View>
                    )}
                    {vm.existingPaymentRequest.paymentRequestData.accountNumber && (
                      <View style={styles.existingPaymentDetailRow}>
                        <Text style={styles.existingPaymentDetailLabel}>Account Number</Text>
                        <Text style={styles.existingPaymentDetailValue}>{vm.existingPaymentRequest.paymentRequestData.accountNumber}</Text>
                      </View>
                    )}
                  </View>
                )}
                {vm.existingPaymentRequest.paymentRequestData.message && (
                  <View style={styles.existingPaymentNoteCard}>
                    <Text style={styles.existingPaymentNoteLabel}>NOTE</Text>
                    <Text style={styles.existingPaymentNoteText}>{vm.existingPaymentRequest.paymentRequestData.message}</Text>
                  </View>
                )}
                <View style={styles.existingPaymentActions}>
                  <TouchableOpacity style={styles.existingPaymentResendButton} onPress={handleResendPaymentRequest} activeOpacity={0.7}>
                    <Send size={16} color={Colors.white} />
                    <Text style={styles.existingPaymentResendText}>Resend to Customer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.existingPaymentCopyButton} onPress={handleCopyPaymentInstructions} activeOpacity={0.7}>
                    <Copy size={16} color={Colors.primary} />
                    <Text style={styles.existingPaymentCopyText}>Copy Payment Instructions</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.existingPaymentDuplicateNote}>A payment request already exists for this order. You can resend or copy the instructions above.</Text>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Order Selection Modal */}
      <Modal visible={vm.showOrderSelectionModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { vm.setShowOrderSelectionModal(false); vm.setDocumentType(null); }}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => { vm.setShowOrderSelectionModal(false); vm.setDocumentType(null); }}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Order</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView style={styles.orderSelectionContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.orderSelectionDescription}>
              Select the order you want to generate {vm.documentType === 'invoice' ? 'an invoice' : 'a receipt'} for.
            </Text>
            {vm.activeOrders.map((orderItem) => {
              const orderDate = new Date(orderItem.orderDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <TouchableOpacity key={orderItem.id} style={styles.orderSelectionItem} onPress={() => handleSelectOrder(orderItem.id)} activeOpacity={0.7}>
                  <View>
                    <Text style={styles.orderSelectionOrderId}>{formatVendorOrderId(orderItem.publicOrderId)}</Text>
                    <View style={styles.orderSelectionRow}>
                      <Text style={styles.orderSelectionDate}>{orderDate}</Text>
                      <View style={[styles.orderSelectionStatusPill, orderItem.status === 'completed' && styles.orderSelectionStatusPillCompleted, orderItem.status === 'accepted' && styles.orderSelectionStatusPillAccepted, orderItem.status === 'in_progress' && styles.orderSelectionStatusPillInProgress]}>
                        <Text style={[styles.orderSelectionStatusText, orderItem.status === 'completed' && styles.orderSelectionStatusTextCompleted, orderItem.status === 'accepted' && styles.orderSelectionStatusTextAccepted, orderItem.status === 'in_progress' && styles.orderSelectionStatusTextInProgress]}>
                          {formatOrderStatus(orderItem.status)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderSelectionTotal}>{formatPriceWithCommas(orderItem.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
      <Toast visible={toastVisible} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { backgroundColor: Colors.background },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  backText: { fontSize: 28, color: Colors.text },
  headerContent: { flex: 1, marginLeft: 8 },
  errorText: { fontSize: 16, color: Colors.textMuted },
  blockedBanner: { backgroundColor: Colors.errorLight, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  blockedBannerText: { fontSize: 13, color: Colors.error, textAlign: 'center' },
  systemMessageContainer: { alignItems: 'center', marginVertical: 6, paddingHorizontal: 24 },
  actionsMenuOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  actionsMenuContainer: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 16, paddingBottom: 32, paddingHorizontal: 16 },
  actionsMenuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 8 },
  actionsMenuGridItem: { width: '22%', alignItems: 'center', paddingVertical: 8 },
  actionsMenuIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionsMenuIconCircleDisabled: { backgroundColor: Colors.border, opacity: 0.6 },
  actionsMenuGridItemText: { fontSize: 11, color: Colors.text, textAlign: 'center', fontWeight: '500', lineHeight: 14 },
  actionsMenuUpgradeText: { fontSize: 9, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  modalCancelText: { fontSize: 16, color: Colors.primary, fontWeight: '500' },
  modalActionText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  modalActionTextDisabled: { opacity: 0.4 },
  modalContent: { flex: 1 },
  catalogSection: { paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.background },
  catalogSectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary, marginBottom: 12 },
  catalogItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 12, backgroundColor: Colors.surface, borderRadius: 12, marginBottom: 8, borderWidth: 2, borderColor: 'transparent' },
  catalogItemSelected: { backgroundColor: Colors.border },
  catalogItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  catalogItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: Colors.border },
  catalogItemImagePlaceholder: { width: 50, height: 50, borderRadius: 8, backgroundColor: Colors.border, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  catalogItemImagePlaceholderText: { fontSize: 24 },
  catalogItemInfo: { flex: 1 },
  catalogItemName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  catalogItemDescription: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  catalogItemPrice: { fontSize: 14, fontWeight: '600', color: Colors.text },
  catalogCheckbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: Colors.textSecondary, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  catalogCheckboxSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  catalogCheckmark: { fontSize: 14, color: Colors.white, fontWeight: '700' },
  pickupContent: { flex: 1, paddingHorizontal: 16 },
  pickupEmptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 80 },
  pickupEmptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  pickupEmptyTitle: { fontSize: 20, fontWeight: '600', color: Colors.text, marginBottom: 12, textAlign: 'center' },
  pickupEmptyDescription: { fontSize: 15, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  pickupSetupButton: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12 },
  pickupSetupButtonText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  pickupInfoBanner: { backgroundColor: Colors.surface, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: Colors.surface },
  pickupInfoText: { fontSize: 13, color: Colors.primary, textAlign: 'center', fontWeight: '500' },
  pickupSection: { marginTop: 24 },
  pickupLabel: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  pickupValue: { fontSize: 15, color: Colors.text, lineHeight: 22 },
  pickupValueCard: { backgroundColor: Colors.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  sendPickupButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 32, marginBottom: 20 },
  sendPickupButtonText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  quickRepliesOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)', justifyContent: 'flex-end' },
  quickRepliesKeyboardAvoid: { justifyContent: 'flex-end' },
  quickRepliesContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '70%', maxHeight: '80%' },
  quickRepliesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  quickRepliesHeaderLeft: { width: 50 },
  quickRepliesTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, textAlign: 'center', flex: 1 },
  quickRepliesEditButton: { paddingHorizontal: 8, paddingVertical: 4 },
  quickRepliesEditText: { fontSize: 16, fontWeight: '600', color: Colors.success },
  quickRepliesList: { maxHeight: 400 },
  quickRepliesEmptyContainer: { paddingVertical: 40, paddingHorizontal: 20, alignItems: 'center' },
  quickRepliesEmpty: { fontSize: 15, color: Colors.textMuted, textAlign: 'center', marginBottom: 8 },
  quickRepliesEmptySubtext: { fontSize: 13, color: Colors.textMuted, textAlign: 'center' },
  quickReplyItem: { paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.cardBorder },
  quickReplyShortcut: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginBottom: 4 },
  quickReplyMessage: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.background },
  profileHeaderLeft: { width: 40 },
  profileTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'center' },
  profileCloseButton: { padding: 8 },
  profileContent: { flex: 1, backgroundColor: Colors.background },
  profileAvatarSection: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  profileAvatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  profileAvatarLargeText: { fontSize: 32, fontWeight: '600', color: Colors.white },
  profileCustomerName: { fontSize: 24, fontWeight: '600', color: Colors.text },
  profileTrustIndicators: { fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center' },
  profileSummaryCard: { marginHorizontal: 20, marginBottom: 24, backgroundColor: Colors.surface, borderRadius: 16, padding: 16 },
  profileSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  profileSummaryItem: { flex: 1, alignItems: 'center' },
  profileSummaryLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '500' },
  profileSummaryValue: { fontSize: 16, fontWeight: '700', color: Colors.text },
  profileSummaryDivider: { width: 1, height: 28, backgroundColor: Colors.border },
  profileSection: { marginBottom: 24 },
  profileSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  profileSectionTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 20, marginBottom: 12 },
  seeAllText: { fontSize: 15, color: Colors.primary, fontWeight: '500', paddingHorizontal: 20 },
  repeatBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  repeatBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.success },
  notesCardContainer: { backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 16, marginHorizontal: 20, borderRadius: 16 },
  notesCard: { minHeight: 80, justifyContent: 'center' },
  notesCardText: { fontSize: 17, color: Colors.text, lineHeight: 24 },
  notesCardPlaceholder: { color: Colors.textSecondary },
  notesFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  notesHelperText: { fontSize: 13, color: Colors.textSecondary },
  notesLastUpdated: { fontSize: 12, color: Colors.textMuted },
  orderHistoryCard: { backgroundColor: Colors.surface, marginBottom: 8, marginHorizontal: 20, borderRadius: 16, overflow: 'hidden' },
  orderHistoryMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  orderHistoryLeft: { flex: 1 },
  orderHistoryId: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  orderHistoryDate: { fontSize: 13, color: Colors.textSecondary },
  orderHistoryRight: { alignItems: 'flex-end' },
  orderHistoryAmount: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  orderStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.border },
  orderStatusBadgeCompleted: { backgroundColor: Colors.charcoal },
  orderStatusBadgeAccepted: { backgroundColor: Colors.charcoal },
  orderStatusBadgeInProgress: { backgroundColor: Colors.charcoal },
  orderStatusBadgeCancelled: { backgroundColor: Colors.charcoal },
  orderStatusBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  orderStatusBadgeTextCompleted: { color: Colors.success },
  orderStatusBadgeTextAccepted: { color: Colors.primary },
  orderStatusBadgeTextInProgress: { color: Colors.primary },
  orderStatusBadgeTextCancelled: { color: Colors.error },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 32, paddingHorizontal: 20 },
  profileActionsSection: { backgroundColor: Colors.surface, paddingTop: 8, paddingBottom: 16, marginTop: 24, marginHorizontal: 20, borderRadius: 16 },
  actionButton: { paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionButtonText: { fontSize: 17, color: Colors.error, fontWeight: '400' },
  customerSinceText: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 12, paddingHorizontal: 16 },
  secureModalContainer: { flex: 1, backgroundColor: Colors.surface },
  secureModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  secureModalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text },
  secureModalCloseButton: { padding: 8 },
  secureModalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  secureWarningBanner: { backgroundColor: Colors.border, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  secureWarningText: { fontSize: 13, color: Colors.star, textAlign: 'center', fontWeight: '500' },
  secureContactSection: { marginBottom: 24 },
  secureContactLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  secureContactValue: { fontSize: 17, color: Colors.text, lineHeight: 24 },
  secureContactValueMultiline: { lineHeight: 26 },
  securePrivacyNotice: { marginTop: 32, padding: 16, backgroundColor: Colors.border, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  securePrivacyText: { fontSize: 15, fontWeight: '600', color: Colors.star, marginBottom: 8 },
  securePrivacyDescription: { fontSize: 13, color: Colors.textSecondary, lineHeight: 20 },
  notesModalContainer: { flex: 1, backgroundColor: Colors.background },
  notesModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.background },
  notesModalHeaderButton: { padding: 8 },
  notesModalTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, flex: 1, textAlign: 'center' },
  notesModalCancel: { fontSize: 16, color: Colors.text },
  notesModalSave: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  notesModalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  notesModalInput: { backgroundColor: Colors.surface, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, fontSize: 17, color: Colors.text, textAlignVertical: 'top', minHeight: 200 },
  notesModalFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingHorizontal: 4 },
  notesModalHelperText: { fontSize: 13, color: Colors.textSecondary },
  notesModalCharCount: { fontSize: 13, color: Colors.textMuted },
  existingPaymentContent: { flex: 1, paddingHorizontal: 16 },
  existingPaymentStatusCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, marginTop: 20, gap: 10, borderWidth: 1, borderColor: '#FDE68A' },
  existingPaymentStatusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary },
  existingPaymentStatusText: { fontSize: 15, fontWeight: '600', color: '#92400E' },
  existingPaymentAmountCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 20, marginTop: 16, alignItems: 'center' },
  existingPaymentAmountLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 1, marginBottom: 8 },
  existingPaymentAmountValue: { fontSize: 32, fontWeight: '700', color: Colors.text, letterSpacing: -0.5 },
  existingPaymentMethodText: { fontSize: 14, color: Colors.textSecondary, marginTop: 6 },
  existingPaymentDetailCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  existingPaymentDetailTitle: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 },
  existingPaymentDetailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  existingPaymentDetailLabel: { fontSize: 14, color: Colors.textSecondary },
  existingPaymentDetailValue: { fontSize: 14, fontWeight: '500', color: Colors.text },
  existingPaymentNoteCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, marginTop: 12 },
  existingPaymentNoteLabel: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.5, marginBottom: 6 },
  existingPaymentNoteText: { fontSize: 15, color: Colors.text, lineHeight: 22, fontStyle: 'italic' },
  existingPaymentActions: { marginTop: 24, gap: 10 },
  existingPaymentResendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, gap: 8 },
  existingPaymentResendText: { fontSize: 16, fontWeight: '600', color: Colors.white },
  existingPaymentCopyButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderColor: Colors.primary, gap: 8 },
  existingPaymentCopyText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  existingPaymentDuplicateNote: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', marginTop: 20, marginBottom: 40, lineHeight: 18, paddingHorizontal: 16 },
  orderSelectionContent: { flex: 1, paddingHorizontal: 16 },
  orderSelectionDescription: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginVertical: 16 },
  orderSelectionItem: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  orderSelectionOrderId: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  orderSelectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderSelectionDate: { fontSize: 14, color: Colors.textSecondary },
  orderSelectionStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: Colors.cardBorder },
  orderSelectionStatusPillAccepted: { backgroundColor: Colors.surface },
  orderSelectionStatusPillInProgress: { backgroundColor: Colors.warningLight },
  orderSelectionStatusPillCompleted: { backgroundColor: Colors.successLight },
  orderSelectionStatusText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  orderSelectionStatusTextAccepted: { color: Colors.primary },
  orderSelectionStatusTextInProgress: { color: Colors.primary },
  orderSelectionStatusTextCompleted: { color: Colors.success },
  orderSelectionTotal: { fontSize: 18, fontWeight: '700', color: Colors.text },
  customOrderPreviewCard: { backgroundColor: Colors.background, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, padding: 12, maxWidth: '85%', width: '100%' },
  customOrderPreviewContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  customOrderPreviewImagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: Colors.cardBorder, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  customOrderPreviewImagePlaceholderText: { fontSize: 28 },
  customOrderPreviewInfo: { flex: 1 },
  customOrderPreviewTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  customOrderPreviewItems: { fontSize: 14, color: Colors.textSecondary, marginBottom: 2 },
  customOrderPreviewTotal: { fontSize: 16, fontWeight: '700', color: Colors.text },
  customOrderPreviewButton: { backgroundColor: Colors.primary, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  customOrderPreviewButtonText: { fontSize: 15, fontWeight: '600', color: Colors.white },
  customOrderPreviewTimestamp: { fontSize: 11, color: Colors.textMuted, marginTop: 8, textAlign: 'right' },
  catalogItemCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 12, maxWidth: '90%', width: '100%', borderWidth: 1, borderColor: Colors.border },
  catalogItemCardLabel: { fontSize: 12, color: Colors.textSecondary, marginBottom: 10 },
  catalogItemCardContent: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  catalogItemCardImageContainer: { width: 56, height: 56, borderRadius: 8, marginRight: 12, overflow: 'hidden' },
  catalogItemCardImagePlaceholder: { width: 56, height: 56, backgroundColor: Colors.border, borderRadius: 8 },
  catalogItemCardInfo: { flex: 1 },
  catalogItemCardName: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  catalogItemCardPrice: { fontSize: 15, fontWeight: '600', color: Colors.text },
  catalogItemCardButton: { paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  catalogItemCardButtonText: { fontSize: 15, color: Colors.primary, fontWeight: '500' },
});
