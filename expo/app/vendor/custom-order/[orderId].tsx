import React, { useState, useEffect, useRef } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  PanResponder,
  PanResponderInstance,
  Platform } from 'react-native';
import { Alert } from '@/utils/alert';
import DiscardChangesModal from '@/components/DiscardChangesModal';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChevronLeft, Plus, Trash2, Edit2, ChevronDown, Lock, CheckCircle, Clock } from 'lucide-react-native';
import { useCustomOrders, CustomOrderItem } from '@/contexts/CustomOrderContext';
import { useQuery } from '@tanstack/react-query';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { formatPriceWithCommas, getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

interface SwipeableItemProps {
  item: CustomOrderItem;
  onEdit: () => void;
  onDelete: () => void;
  isDraft: boolean;
}

function SwipeableItem({ item, onEdit, onDelete, isDraft }: SwipeableItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const SWIPE_THRESHOLD = -80;
  const ACTION_WIDTH = 160;

  const panResponder = useRef<PanResponderInstance>(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return isDraft && Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const newValue = Math.max(gestureState.dx, -ACTION_WIDTH);
          translateX.setValue(newValue);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < SWIPE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH,
            useNativeDriver: true,
            friction: 8,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const handleEdit = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    onEdit();
  };

  const handleDelete = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
    onDelete();
  };

  return (
    <View style={styles.swipeableContainer}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity onPress={handleEdit} style={styles.editAction}>
          <Edit2 size={20} color={Colors.white} strokeWidth={2} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteAction}>
          <Trash2 size={20} color={Colors.white} strokeWidth={2} />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[styles.itemCardAnimated, { transform: [{ translateX }] }]}
        {...(isDraft ? panResponder.panHandlers : {})}
      >
        <View style={styles.itemCard}>
          <View style={styles.itemDetails}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.description && (
              <Text style={styles.itemDescription}>{item.description}</Text>
            )}
            {item.note && (
              <Text style={styles.itemNote}>Note: {item.note}</Text>
            )}
            <Text style={styles.itemMeta}>
              {item.quantity} × {formatPriceWithCommas(item.unitPrice, (mockVendor.currency as Currency) || 'NGN')}
            </Text>
          </View>
          <View style={styles.itemRight}>
            <Text style={styles.itemAmount}>{formatPriceWithCommas(item.amount, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export default function VendorCustomOrderScreen() {
  const { orderId: proposalId, chatId, customerName, vendorId, vendorSlug } = useLocalSearchParams();
  const { proposals, createProposal, updateProposal, deleteProposal, sendProposal, recallProposal } = useCustomOrders();
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CustomOrderItem | null>(null);

  const taxQuery = useQuery({
    queryKey: ['taxSettings'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem('taxSettings');
      return stored ? JSON.parse(stored) : { collectTax: false, taxPercentage: 0 };
    },
  });

  const taxSettings = taxQuery.data || { collectTax: false, taxPercentage: 0 };

  const [fulfillmentMethod, setFulfillmentMethod] = useState<'pickup' | 'delivery' | undefined>(undefined);
  const [preferredDate, setPreferredDate] = useState<Date | undefined>(undefined);
  const [preferredTime, setPreferredTime] = useState<Date | undefined>(undefined);
  const [orderNote, setOrderNote] = useState('');
  const [showFulfillmentPicker, setShowFulfillmentPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [tempTime, setTempTime] = useState<Date>(new Date());

  const [itemName, setItemName] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemNote, setItemNote] = useState('');
  const [itemQuantity, setItemQuantity] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [showDiscardDraftModal, setShowDiscardDraftModal] = useState(false);

  let proposal = proposals.find((p) => p.id === proposalId);

  useEffect(() => {
    if (!proposal && proposalId && typeof proposalId === 'string' && chatId && customerName && vendorId && vendorSlug) {
      console.log('[VendorCustomOrder] Creating new custom order proposal:', proposalId);
      createProposal(
        proposalId as string,
        chatId as string,
        customerName as string,
        vendorId as string,
        vendorSlug as string
      );
    }
  }, [proposalId, chatId, customerName, vendorId, vendorSlug, proposal, createProposal]);

  useEffect(() => {
    if (proposal) {
      setFulfillmentMethod(proposal.fulfillmentMethod);
      if (proposal.preferredDate) {
        setPreferredDate(new Date(proposal.preferredDate));
      }
      if (proposal.preferredTime) {
        const timeParts = proposal.preferredTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (timeParts) {
          const hours = parseInt(timeParts[1]);
          const minutes = parseInt(timeParts[2]);
          const isPM = timeParts[3].toUpperCase() === 'PM';
          const date = new Date();
          date.setHours(isPM && hours !== 12 ? hours + 12 : !isPM && hours === 12 ? 0 : hours);
          date.setMinutes(minutes);
          setPreferredTime(date);
        }
      }
      setOrderNote(proposal.orderNote || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.id]);

  proposal = proposals.find((p) => p.id === proposalId);

  if (!proposal) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Custom Order</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Loading...</Text>
        </View>
      </View>
    );
  }

  const isDraft = proposal.state === 'DRAFT';
  const isProposalSent = proposal.state === 'PROPOSAL_SENT';
  const isOrderRequested = proposal.state === 'ORDER_REQUESTED';

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemDescription('');
    setItemQuantity('1');
    setItemPrice('');
    setShowAddItemModal(true);
  };

  const handleOpenEditItem = (item: CustomOrderItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemDescription(item.description || '');
    setItemNote(item.note || '');
    setItemQuantity(item.quantity.toString());
    setItemPrice(item.unitPrice.toString());
    setShowAddItemModal(true);
  };

  const handleSaveItem = () => {
    if (!itemName.trim() || !itemPrice.trim()) return;

    const quantity = parseInt(itemQuantity) || 1;
    const unitPrice = parseFloat(itemPrice) || 0;
    const amount = quantity * unitPrice;

    let updatedItems: CustomOrderItem[];

    if (editingItem) {
      updatedItems = proposal.items.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              name: itemName.trim(),
              description: itemDescription.trim() || undefined,
              note: itemNote.trim() || undefined,
              quantity,
              unitPrice,
              amount,
            }
          : item
      );
    } else {
      const newItem: CustomOrderItem = {
        id: `item_${Date.now()}`,
        name: itemName.trim(),
        description: itemDescription.trim() || undefined,
        note: itemNote.trim() || undefined,
        quantity,
        unitPrice,
        amount,
      };
      updatedItems = [...proposal.items, newItem];
    }

    const subtotal = updatedItems.reduce((sum: number, item: CustomOrderItem) => sum + item.amount, 0);
    const taxAmount = taxSettings.collectTax ? (subtotal * taxSettings.taxPercentage) / 100 : 0;
    const total = subtotal + taxAmount;

    updateProposal(proposal.id, {
      items: updatedItems,
      subtotal,
      taxAmount: taxSettings.collectTax ? taxAmount : undefined,
      total,
    });

    setItemName('');
    setItemDescription('');
    setItemNote('');
    setItemQuantity('1');
    setItemPrice('');
    setEditingItem(null);
    setShowAddItemModal(false);
  };

  const handleRemoveItem = (itemId: string) => {
    Alert.alert(
      'Delete item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedItems = proposal.items.filter((item) => item.id !== itemId);
            const subtotal = updatedItems.reduce((sum: number, item: CustomOrderItem) => sum + item.amount, 0);
            const taxAmount = taxSettings.collectTax ? (subtotal * taxSettings.taxPercentage) / 100 : 0;
            const total = subtotal + taxAmount;

            updateProposal(proposal.id, {
              items: updatedItems,
              subtotal,
              taxAmount: taxSettings.collectTax ? taxAmount : undefined,
              total,
            });
          },
        },
      ]
    );
  };

  const handleSendProposal = () => {
    if (proposal.items.length === 0) {
      Alert.alert('No items', 'Please add at least one item before sending.');
      return;
    }

    if (!fulfillmentMethod) {
      Alert.alert('Missing information', 'Please select a fulfillment method.');
      return;
    }

    if (!preferredDate) {
      Alert.alert('Missing information', 'Please select a preferred date.');
      return;
    }

    if (!preferredTime) {
      Alert.alert('Missing information', 'Please select a preferred time.');
      return;
    }

    Alert.alert(
      'Send proposal to customer?',
      'The customer will be able to review and accept or reject this proposal.',
      [
        {
          text: 'Send',
          onPress: () => {
            const dateStr = preferredDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            });
            const timeStr = preferredTime.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            updateProposal(proposal.id, {
              fulfillmentMethod,
              preferredDate: dateStr,
              preferredTime: timeStr,
              orderNote: orderNote.trim() || undefined,
            });
            sendProposal(proposal.id);
            console.log('[VendorCustomOrder] Proposal sent to customer');
            router.back();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleRecallProposal = () => {
    Alert.alert(
      'Recall proposal?',
      'This will move the proposal back to draft so you can make changes.',
      [
        {
          text: 'Recall',
          onPress: () => {
            recallProposal(proposal.id);
            console.log('[VendorCustomOrder] Proposal recalled to DRAFT');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleDiscardDraft = () => {
    setShowDiscardDraftModal(true);
  };

  const handleConfirmDiscardDraft = () => {
    setShowDiscardDraftModal(false);
    deleteProposal(proposal.id);
    router.back();
  };

  const getStateBadgeStyle = () => {
    if (isDraft) return styles.stateBadgeDraft;
    if (isProposalSent) return styles.stateBadgeSent;
    if (isOrderRequested) return styles.stateBadgeOrderRequested;
    return styles.stateBadgeDraft;
  };

  const getStateBadgeTextStyle = () => {
    if (isDraft) return styles.stateBadgeTextDraft;
    if (isProposalSent) return styles.stateBadgeTextSent;
    if (isOrderRequested) return styles.stateBadgeTextOrderRequested;
    return styles.stateBadgeTextDraft;
  };

  const getStateLabel = () => {
    if (isDraft) return 'Draft';
    if (isProposalSent) return 'Proposal Sent';
    if (isOrderRequested) return 'Order Requested';
    return 'Draft';
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Custom Order</Text>
            <View style={[styles.stateBadge, getStateBadgeStyle()]}>
              <Text style={[styles.stateBadgeText, getStateBadgeTextStyle()]}>{getStateLabel()}</Text>
            </View>
          </View>
          {isProposalSent && (
            <TouchableOpacity onPress={handleRecallProposal} style={styles.headerEditButton}>
              <Text style={styles.headerEditText}>Recall</Text>
            </TouchableOpacity>
          )}
          {(isDraft || isOrderRequested) && <View style={styles.headerSpacer} />}
        </View>
      </SafeAreaView>

      {isOrderRequested && (
        <View style={styles.lockedBanner}>
          <Lock size={14} color={Colors.success} strokeWidth={2} />
          <Text style={styles.lockedBannerText}>
            Customer accepted this proposal — order is now requested
          </Text>
        </View>
      )}

      {isProposalSent && (
        <View style={styles.sentBanner}>
          <Clock size={14} color={Colors.warning} strokeWidth={2} />
          <Text style={styles.sentBannerText}>
            Awaiting customer review — editing disabled
          </Text>
        </View>
      )}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>Customer</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyFieldValue}>{formatCustomerNameFromFull(proposal.customerName)}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>Fulfillment</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Fulfillment Method *</Text>
            <TouchableOpacity
              style={[styles.pickerButton, !isDraft && styles.fieldDisabled]}
              onPress={() => isDraft && setShowFulfillmentPicker(true)}
              disabled={!isDraft}
            >
              <Text style={[styles.pickerButtonText, !fulfillmentMethod && styles.placeholderText]}>
                {fulfillmentMethod ? (fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery') : 'Select method'}
              </Text>
              {isDraft && <ChevronDown size={20} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Date *</Text>
            <TouchableOpacity
              style={[styles.settingsRow, !isDraft && styles.settingsRowDisabled]}
              onPress={() => {
                if (isDraft) {
                  setTempDate(preferredDate || new Date());
                  setShowDatePicker(true);
                }
              }}
              disabled={!isDraft}
              activeOpacity={0.7}
            >
              <Text style={[styles.settingsRowText, !preferredDate && styles.placeholderText]}>
                {preferredDate
                  ? preferredDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : 'Select date'}
              </Text>
              {isDraft && <ChevronDown size={20} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Preferred Time *</Text>
            <TouchableOpacity
              style={[styles.settingsRow, !isDraft && styles.settingsRowDisabled]}
              onPress={() => {
                if (isDraft) {
                  setTempTime(preferredTime || new Date());
                  setShowTimePicker(true);
                }
              }}
              disabled={!isDraft}
              activeOpacity={0.7}
            >
              <Text style={[styles.settingsRowText, !preferredTime && styles.placeholderText]}>
                {preferredTime
                  ? preferredTime.toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  : 'Select time'}
              </Text>
              {isDraft && <ChevronDown size={20} color={Colors.textMuted} />}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Items</Text>
          </View>

          {proposal.items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No items added yet</Text>
            </View>
          ) : (
            proposal.items.map((item: CustomOrderItem) => (
              <SwipeableItem
                key={item.id}
                item={item}
                onEdit={() => handleOpenEditItem(item)}
                onDelete={() => handleRemoveItem(item.id)}
                isDraft={isDraft}
              />
            ))
          )}

          {isDraft && (
            <TouchableOpacity onPress={handleOpenAddItem} style={styles.addItemButton}>
              <Plus size={20} color={Colors.primary} strokeWidth={2} />
              <Text style={styles.addItemButtonText}>Add item</Text>
            </TouchableOpacity>
          )}
        </View>

        {isDraft && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Order Note (Optional)</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea]}
              placeholder="Add any special instructions or notes for this order"
              placeholderTextColor={Colors.textMuted}
              value={orderNote}
              onChangeText={setOrderNote}
              multiline
              maxLength={500}
              editable={isDraft}
            />
          </View>
        )}

        {!isDraft && proposal.orderNote && (
          <View style={styles.infoSection}>
            <Text style={styles.infoSectionTitle}>Order Note</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.readOnlyFieldValue}>{proposal.orderNote}</Text>
            </View>
          </View>
        )}

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>{formatPriceWithCommas(proposal.subtotal, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
          {proposal.taxAmount && proposal.taxAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax</Text>
              <Text style={styles.summaryValue}>{formatPriceWithCommas(proposal.taxAmount, (mockVendor.currency as Currency) || 'NGN')}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.summaryTotalLabel}>
              {(isDraft || isProposalSent) && taxSettings.collectTax ? 'Estimated total' : 'Total'}
            </Text>
            <Text style={styles.summaryTotalValue}>{formatPriceWithCommas(proposal.total, (mockVendor.currency as Currency) || 'NGN')}</Text>
          </View>
        </View>

        {isOrderRequested && (
          <View style={styles.orderRequestedCard}>
            <CheckCircle size={20} color={Colors.success} strokeWidth={2} />
            <View style={styles.orderRequestedCardContent}>
              <Text style={styles.orderRequestedTitle}>Order Requested</Text>
              <Text style={styles.orderRequestedSubtext}>
                The customer accepted this proposal. You will receive the order request shortly.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {isDraft && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleDiscardDraft}>
            <Text style={styles.secondaryButtonText}>Discard draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (proposal.items.length === 0 || !fulfillmentMethod || !preferredDate || !preferredTime) && styles.primaryButtonDisabled
            ]}
            onPress={handleSendProposal}
            disabled={proposal.items.length === 0 || !fulfillmentMethod || !preferredDate || !preferredTime}
          >
            <Text style={styles.primaryButtonText}>Send Proposal</Text>
          </TouchableOpacity>
        </SafeAreaView>
      )}

      {isProposalSent && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleRecallProposal}>
            <Text style={styles.secondaryButtonText}>Recall Proposal</Text>
          </TouchableOpacity>
          <View style={styles.primaryButtonLocked}>
            <Clock size={16} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.primaryButtonLockedText}>Awaiting customer</Text>
          </View>
        </SafeAreaView>
      )}

      {isOrderRequested && (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={[styles.primaryButton, styles.primaryButtonSuccess]}>
            <CheckCircle size={18} color={Colors.white} strokeWidth={2} />
            <Text style={[styles.primaryButtonText, { marginLeft: 8 }]}>Order Requested</Text>
          </View>
        </SafeAreaView>
      )}

      <Modal
        visible={showAddItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddItemModal(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddItemModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingItem ? 'Edit Item' : 'Add Item'}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Item Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Custom Cake"
                placeholderTextColor={Colors.textMuted}
                value={itemName}
                onChangeText={setItemName}
                maxLength={100}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Optional details"
                placeholderTextColor={Colors.textMuted}
                value={itemDescription}
                onChangeText={setItemDescription}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Item Note</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Optional note (visible to customer)"
                placeholderTextColor={Colors.textMuted}
                value={itemNote}
                onChangeText={setItemNote}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputSection, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Quantity *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor={Colors.textMuted}
                  value={itemQuantity}
                  onChangeText={setItemQuantity}
                  keyboardType="number-pad"
                />
              </View>

              <View style={[styles.inputSection, styles.halfWidth]}>
                <Text style={styles.inputLabel}>Unit Price *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  value={itemPrice}
                  onChangeText={setItemPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.primaryButton, (!itemName.trim() || !itemPrice.trim()) && styles.primaryButtonDisabled]}
              onPress={handleSaveItem}
              disabled={!itemName.trim() || !itemPrice.trim()}
            >
              <Text style={styles.primaryButtonText}>{editingItem ? 'Save changes' : 'Add item'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showFulfillmentPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowFulfillmentPicker(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowFulfillmentPicker(false)}
        >
          <View style={styles.pickerContainer}>
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setFulfillmentMethod('pickup');
                setShowFulfillmentPicker(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Pickup</Text>
            </TouchableOpacity>
            <View style={styles.pickerDivider} />
            <TouchableOpacity
              style={styles.pickerOption}
              onPress={() => {
                setFulfillmentMethod('delivery');
                setShowFulfillmentPicker(false);
              }}
            >
              <Text style={styles.pickerOptionText}>Delivery</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {Platform.OS === 'ios' && showDatePicker && (
        <Modal
          visible={showDatePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.datePickerButton}>
                  <Text style={styles.datePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPreferredDate(tempDate);
                    setShowDatePicker(false);
                  }}
                  style={styles.datePickerButton}
                >
                  <Text style={[styles.datePickerButtonText, styles.datePickerButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                  if (selectedDate) setTempDate(selectedDate);
                }}
                minimumDate={new Date()}
                textColor={Colors.text}
                style={styles.datePickerIOS}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {Platform.OS === 'android' && showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selectedDate) setPreferredDate(selectedDate);
          }}
          minimumDate={new Date()}
        />
      )}

      {Platform.OS === 'ios' && showTimePicker && (
        <Modal
          visible={showTimePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.datePickerOverlay}
            activeOpacity={1}
            onPress={() => setShowTimePicker(false)}
          >
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <TouchableOpacity onPress={() => setShowTimePicker(false)} style={styles.datePickerButton}>
                  <Text style={styles.datePickerButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    setPreferredTime(tempTime);
                    setShowTimePicker(false);
                  }}
                  style={styles.datePickerButton}
                >
                  <Text style={[styles.datePickerButtonText, styles.datePickerButtonDone]}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempTime}
                mode="time"
                display="spinner"
                onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
                  if (selectedTime) setTempTime(selectedTime);
                }}
                textColor={Colors.text}
                style={styles.datePickerIOS}
              />
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {Platform.OS === 'android' && showTimePicker && (
        <DateTimePicker
          value={tempTime}
          mode="time"
          display="default"
          onChange={(event: DateTimePickerEvent, selectedTime?: Date) => {
            setShowTimePicker(false);
            if (event.type === 'set' && selectedTime) setPreferredTime(selectedTime);
          }}
        />
      )}
      <DiscardChangesModal
        visible={showDiscardDraftModal}
        onKeepEditing={() => setShowDiscardDraftModal(false)}
        onDiscard={handleConfirmDiscardDraft}
        title="Discard draft?"
        message="All items will be lost. This cannot be undone."
        keepEditingLabel="Keep Draft"
        discardLabel="Discard Draft"
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stateBadgeDraft: {
    backgroundColor: Colors.surface,
  },
  stateBadgeSent: {
    backgroundColor: Colors.warningLight,
  },
  stateBadgeOrderRequested: {
    backgroundColor: Colors.successLight,
  },
  stateBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  stateBadgeTextDraft: {
    color: Colors.textSecondary,
  },
  stateBadgeTextSent: {
    color: Colors.warning,
  },
  stateBadgeTextOrderRequested: {
    color: Colors.success,
  },
  headerSpacer: {
    width: 56,
  },
  headerEditButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  headerEditText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  lockedBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.successLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.successBorder,
  },
  lockedBannerText: {
    fontSize: 13,
    color: Colors.success,
    flex: 1,
    fontWeight: '500' as const,
  },
  sentBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.warningLight,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warningBorder,
  },
  sentBannerText: {
    fontSize: 13,
    color: Colors.warning,
    flex: 1,
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  infoSection: {
    marginTop: 16,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  infoSectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  readOnlyField: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  readOnlyFieldValue: {
    fontSize: 16,
    color: Colors.text,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  fieldInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  fieldDisabled: {
    opacity: 0.6,
  },
  pickerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 16,
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  swipeableContainer: {
    marginBottom: 1,
    overflow: 'hidden' as const,
    marginHorizontal: 16,
  },
  actionsContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    width: 160,
  },
  editAction: {
    width: 80,
    backgroundColor: Colors.primary,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deleteAction: {
    width: 80,
    backgroundColor: Colors.error,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  actionText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  itemCardAnimated: {
    backgroundColor: Colors.surface,
  },
  itemCard: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  itemNote: {
    fontSize: 13,
    color: Colors.primary,
    fontStyle: 'italic' as const,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  itemRight: {
    alignItems: 'flex-end' as const,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  addItemButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  summary: {
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  summaryValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  summaryTotal: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 8,
  },
  summaryTotalLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  summaryTotalValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  orderRequestedCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.successLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.successBorder,
  },
  orderRequestedCardContent: {
    flex: 1,
  },
  orderRequestedTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.success,
    marginBottom: 4,
  },
  orderRequestedSubtext: {
    fontSize: 13,
    color: Colors.success,
    lineHeight: 18,
    opacity: 0.8,
  },
  bottomSpacer: {
    height: 32,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
    flexDirection: 'row' as const,
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    height: 52,
  },
  primaryButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  primaryButtonSuccess: {
    backgroundColor: Colors.success,
  },
  primaryButtonLocked: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    height: 52,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  primaryButtonLockedText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.border,
    height: 52,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalHeaderSpacer: {
    width: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  inputSection: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.text,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  row: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  pickerContainer: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden' as const,
  },
  pickerOption: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  pickerOptionText: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pickerDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsRowDisabled: {
    opacity: 0.6,
  },
  settingsRowText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
  },
  datePickerContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  datePickerButton: {
    padding: 4,
  },
  datePickerButtonText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  datePickerButtonDone: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  datePickerIOS: {
    height: 200,
  },
});
