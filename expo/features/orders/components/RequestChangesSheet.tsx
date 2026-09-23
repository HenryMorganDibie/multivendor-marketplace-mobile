import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Animated,
  Platform,
  KeyboardAvoidingView,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { ArrowLeft, Minus, Plus, RefreshCw, Search, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas } from '@/utils/formatPrice';
import type { OrderItem } from '@/mocks/ordersData';
import type { MenuItem } from '@/mocks/vendorData';
import { mockMenuItems } from '@/mocks/vendorData';
import type { ChangeRequestIssueType, ChangeRequestChange } from '@/contexts/ChangeRequestsContext';

interface EditableItem {
  original: OrderItem;
  action: 'unchanged' | 'adjust_quantity' | 'remove' | 'replace';
  newQuantity: number;
  replacementItem?: MenuItem;
}

interface RequestChangesSheetProps {
  visible: boolean;
  orderId: string;
  orderItems: OrderItem[];
  vendorName: string;
  onDismiss: () => void;
  onSendRequest: (params: {
    issueType: ChangeRequestIssueType;
    changes: ChangeRequestChange[];
    vendorMessage?: string;
  }) => void | Promise<void>;
}

export default function RequestChangesSheet({
  visible,
  orderId: _orderId,
  orderItems,
  vendorName: _vendorName,
  onDismiss,
  onSendRequest,
}: RequestChangesSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [editableItems, setEditableItems] = useState<EditableItem[]>([]);
  const [vendorNote, setVendorNote] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [substituteItemId, setSubstituteItemId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const resetState = useCallback(() => {
    setEditableItems(
      orderItems.map((item) => ({
        original: item,
        action: 'unchanged' as const,
        newQuantity: item.quantity,
      }))
    );
    setVendorNote('');
    setIsSending(false);
    setSubstituteItemId(null);
    setSearchQuery('');
  }, [orderItems]);

  useEffect(() => {
    if (visible) {
      resetState();
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(0);
    }
  }, [visible, slideAnim, resetState]);

  const handleDismiss = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  }, [slideAnim, onDismiss]);

  const handleQuantityChange = useCallback((itemId: string, delta: number) => {
    setEditableItems((prev) =>
      prev.map((ei) => {
        if (ei.original.id !== itemId) return ei;
        const newQty = Math.max(0, ei.newQuantity + delta);
        if (newQty === 0) {
          return { ...ei, action: 'remove' as const, newQuantity: 0 };
        }
        if (newQty === ei.original.quantity && ei.action !== 'replace') {
          return { ...ei, action: 'unchanged' as const, newQuantity: newQty };
        }
        if (ei.action === 'replace') {
          return { ...ei, newQuantity: newQty };
        }
        return { ...ei, action: 'adjust_quantity' as const, newQuantity: newQty };
      })
    );
  }, []);

  const handleRemoveItem = useCallback((itemId: string) => {
    setEditableItems((prev) =>
      prev.map((ei) => {
        if (ei.original.id !== itemId) return ei;
        return { ...ei, action: 'remove' as const, newQuantity: 0, replacementItem: undefined };
      })
    );
  }, []);

  const handleRestoreItem = useCallback((itemId: string) => {
    setEditableItems((prev) =>
      prev.map((ei) => {
        if (ei.original.id !== itemId) return ei;
        return {
          ...ei,
          action: 'unchanged' as const,
          newQuantity: ei.original.quantity,
          replacementItem: undefined,
        };
      })
    );
  }, []);

  const handleOpenSubstitute = useCallback((itemId: string) => {
    setSubstituteItemId(itemId);
    setSearchQuery('');
  }, []);

  const handleSelectReplacement = useCallback((menuItem: MenuItem) => {
    if (!substituteItemId) return;
    setEditableItems((prev) =>
      prev.map((ei) => {
        if (ei.original.id !== substituteItemId) return ei;
        return {
          ...ei,
          action: 'replace' as const,
          replacementItem: menuItem,
          newQuantity: ei.newQuantity > 0 ? ei.newQuantity : ei.original.quantity,
        };
      })
    );
    setSubstituteItemId(null);
    setSearchQuery('');
  }, [substituteItemId]);

  const filteredMenu = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return mockMenuItems.filter((m) => {
      if (!m.inStock) return false;
      if (substituteItemId && m.id === substituteItemId) return false;
      return m.name.toLowerCase().includes(q);
    });
  }, [searchQuery, substituteItemId]);

  const originalTotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      const addOnTotal = item.addOns?.reduce((s, a) => s + a.price, 0) ?? 0;
      return sum + (item.price + addOnTotal) * item.quantity;
    }, 0);
  }, [orderItems]);

  const proposedTotal = useMemo(() => {
    return editableItems.reduce((sum, ei) => {
      if (ei.action === 'remove') return sum;
      if (ei.action === 'replace' && ei.replacementItem) {
        return sum + ei.replacementItem.price * ei.newQuantity;
      }
      const addOnTotal = ei.original.addOns?.reduce((s, a) => s + a.price, 0) ?? 0;
      return sum + (ei.original.price + addOnTotal) * ei.newQuantity;
    }, 0);
  }, [editableItems]);

  const hasChanges = useMemo(() => {
    return editableItems.some((ei) => ei.action !== 'unchanged');
  }, [editableItems]);

  const totalDiff = proposedTotal - originalTotal;

  const buildChanges = useCallback((): ChangeRequestChange[] => {
    return editableItems
      .filter((ei) => ei.action !== 'unchanged')
      .map((ei) => {
        let priceDiff = 0;
        const origLineTotal = ei.original.price * ei.original.quantity;
        if (ei.action === 'remove') {
          priceDiff = -origLineTotal;
        } else if (ei.action === 'adjust_quantity') {
          priceDiff = (ei.newQuantity - ei.original.quantity) * ei.original.price;
        } else if (ei.action === 'replace' && ei.replacementItem) {
          priceDiff = ei.replacementItem.price * ei.newQuantity - origLineTotal;
        }
        return {
          originalItem: ei.original,
          action: ei.action,
          replacementItem: ei.replacementItem,
          newQuantity: ei.newQuantity,
          priceDifference: priceDiff,
        };
      });
  }, [editableItems]);

  const handleSend = useCallback(async () => {
    if (!hasChanges) return;
    setIsSending(true);
    const changes = buildChanges();
    try {
      await onSendRequest({
        issueType: 'structured_edit',
        changes,
        vendorMessage: vendorNote.trim() || undefined,
      });
      // On success the parent dismisses this sheet, which triggers
      // resetState() the next time it opens. On failure the parent shows
      // its own error alert and leaves the sheet open, so isSending must
      // come back down here or the button stays stuck disabled.
    } finally {
      setIsSending(false);
    }
  }, [hasChanges, buildChanges, vendorNote, onSendRequest]);

  const SwipeableItemCard = useCallback(({ ei }: { ei: EditableItem }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const deleteOpacity = useRef(new Animated.Value(0)).current;
    const screenWidth = Dimensions.get('window').width;
    const SWIPE_THRESHOLD = -80;
    const isRemoved = ei.action === 'remove';

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gestureState) => {
          return !isRemoved && Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 20;
        },
        onPanResponderGrant: () => {
          translateX.extractOffset();
        },
        onPanResponderMove: (_evt, gestureState) => {
          if (gestureState.dx > 0) {
            translateX.setValue(0);
            return;
          }
          translateX.setValue(Math.max(gestureState.dx, -screenWidth * 0.4));
          const progress = Math.min(Math.abs(gestureState.dx) / Math.abs(SWIPE_THRESHOLD), 1);
          deleteOpacity.setValue(progress);
        },
        onPanResponderRelease: (_evt, gestureState) => {
          translateX.flattenOffset();
          if (gestureState.dx < SWIPE_THRESHOLD) {
            Animated.timing(translateX, {
              toValue: -screenWidth,
              duration: 250,
              useNativeDriver: true,
            }).start(() => {
              handleRemoveItem(ei.original.id);
              translateX.setValue(0);
              deleteOpacity.setValue(0);
            });
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              tension: 80,
              friction: 10,
            }).start();
            Animated.timing(deleteOpacity, {
              toValue: 0,
              duration: 150,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          translateX.flattenOffset();
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
          Animated.timing(deleteOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }).start();
        },
      })
    ).current;

    const isReplaced = ei.action === 'replace';
    const displayName = isReplaced && ei.replacementItem ? ei.replacementItem.name : ei.original.name;
    const displayPrice = isReplaced && ei.replacementItem ? ei.replacementItem.price : ei.original.price;
    const displayImage = isReplaced && ei.replacementItem ? ei.replacementItem.image : ei.original.image;
    const lineTotal = isRemoved ? 0 : displayPrice * ei.newQuantity;

    return (
      <View style={styles.swipeContainer}>
        <Animated.View style={[styles.deleteBackground, { opacity: deleteOpacity }]}>
          <Trash2 size={20} color="#fff" strokeWidth={2} />
          <Text style={styles.deleteBackgroundText}>Delete</Text>
        </Animated.View>
        <Animated.View
          style={[{ transform: [{ translateX }] }]}
          {...(isRemoved ? {} : panResponder.panHandlers)}
        >
          <View style={[styles.editItemCard, isRemoved && styles.editItemCardRemoved]}>
            <View style={styles.editItemTop}>
              {displayImage ? (
                <Image source={{ uri: displayImage }} style={styles.editItemImage} contentFit="cover" />
              ) : (
                <View style={styles.editItemImagePlaceholder}>
                  <Text style={styles.editItemInitial}>{displayName.charAt(0)}</Text>
                </View>
              )}
              <View style={styles.editItemInfo}>
                {isReplaced && (
                  <Text style={styles.replacedLabel}>
                    Replacing: {ei.original.name}
                  </Text>
                )}
                <Text
                  style={[styles.editItemName, isRemoved && styles.editItemNameRemoved]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text style={[styles.editItemPrice, isRemoved && styles.editItemPriceRemoved]}>
                  {isRemoved ? 'Removed' : formatPriceWithCommas(lineTotal, 'NGN')}
                </Text>
              </View>
            </View>

            {!isRemoved ? (
              <View style={styles.editItemActions}>
                <View style={styles.quantityStepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleQuantityChange(ei.original.id, -1)}
                    activeOpacity={0.7}
                    testID={`qty-minus-${ei.original.id}`}
                  >
                    <Minus size={16} color={Colors.text} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <Text style={styles.stepperQty}>{ei.newQuantity}</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => handleQuantityChange(ei.original.id, 1)}
                    activeOpacity={0.7}
                    testID={`qty-plus-${ei.original.id}`}
                  >
                    <Plus size={16} color={Colors.text} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.substituteBtn}
                  onPress={() => handleOpenSubstitute(ei.original.id)}
                  activeOpacity={0.7}
                  testID={`substitute-${ei.original.id}`}
                >
                  <RefreshCw size={14} color="#2563EB" strokeWidth={2} />
                  <Text style={styles.substituteBtnText}>Substitute</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.restoreBtn}
                onPress={() => handleRestoreItem(ei.original.id)}
                activeOpacity={0.7}
                testID={`restore-${ei.original.id}`}
              >
                <Text style={styles.restoreBtnText}>Restore item</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    );
  }, [handleQuantityChange, handleRemoveItem, handleRestoreItem, handleOpenSubstitute]);

  if (substituteItemId) {
    const currentItem = editableItems.find((ei) => ei.original.id === substituteItemId);
    return (
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={() => setSubstituteItemId(null)}>
        <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetInner}>
              <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => setSubstituteItemId(null)} activeOpacity={0.7}>
                  <ArrowLeft size={22} color={Colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                  <Text style={styles.headerTitle}>Choose replacement</Text>
                  {currentItem && (
                    <Text style={styles.headerSubtitle} numberOfLines={1}>
                      Replacing "{currentItem.original.name}"
                    </Text>
                  )}
                </View>
                <View style={styles.headerRightSpacer} />
              </View>

              <View style={styles.searchContainer}>
                <Search size={16} color={Colors.textMuted} strokeWidth={2} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search menu items..."
                  placeholderTextColor={Colors.textMuted}
                  autoFocus={false}
                  clearButtonMode="while-editing"
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.replacementList}>
                {filteredMenu.map((menuItem) => (
                  <TouchableOpacity
                    key={menuItem.id}
                    style={styles.menuItemRow}
                    onPress={() => handleSelectReplacement(menuItem)}
                    activeOpacity={0.7}
                    testID={`menu-item-${menuItem.id}`}
                  >
                    {menuItem.image ? (
                      <Image source={{ uri: menuItem.image }} style={styles.menuItemImage} contentFit="cover" />
                    ) : (
                      <View style={styles.menuItemImagePlaceholder}>
                        <Text style={styles.menuItemInitial}>{menuItem.name.charAt(0)}</Text>
                      </View>
                    )}
                    <View style={styles.menuItemTextBlock}>
                      <Text style={styles.menuItemName}>{menuItem.name}</Text>
                      <Text style={styles.menuItemPrice}>{formatPriceWithCommas(menuItem.price, 'NGN')}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {filteredMenu.length === 0 && (
                  <Text style={styles.emptyMenuText}>No items found</Text>
                )}
                <View style={styles.listBottomSpacer} />
              </ScrollView>
            </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleDismiss}>
      <View style={[styles.fullScreen, { paddingTop: insets.top }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetInner}
          >
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={handleDismiss} activeOpacity={0.7}>
                <ArrowLeft size={22} color={Colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>Edit request</Text>
                <Text style={styles.headerSubtitle}>Adjust items before sending to customer</Text>
              </View>
              <View style={styles.headerRightSpacer} />
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {editableItems.map((ei) => (
                <SwipeableItemCard key={ei.original.id} ei={ei} />
              ))}

              <View style={styles.totalSection}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Original total</Text>
                  <Text style={styles.totalOriginalValue}>{formatPriceWithCommas(originalTotal, 'NGN')}</Text>
                </View>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Proposed total</Text>
                  <Text style={styles.totalProposedValue}>{formatPriceWithCommas(proposedTotal, 'NGN')}</Text>
                </View>
                {totalDiff !== 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Difference</Text>
                    <Text
                      style={[
                        styles.totalDiffValue,
                        { color: totalDiff < 0 ? Colors.success : Colors.error },
                      ]}
                    >
                      {totalDiff > 0 ? '+' : '−'}{formatPriceWithCommas(Math.abs(totalDiff), 'NGN')}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.noteSection}>
                <Text style={styles.noteSectionLabel}>Note to customer (optional)</Text>
                <View style={styles.noteInputWrapper}>
                  <TextInput
                    style={styles.noteInput}
                    value={vendorNote}
                    onChangeText={(t) => setVendorNote(t.slice(0, 200))}
                    placeholder="Explain why you're requesting changes..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={200}
                  />
                  <Text style={styles.charCounter}>{vendorNote.length}/200</Text>
                </View>
              </View>

              <View style={styles.bottomSpacer} />
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
              <TouchableOpacity
                style={[styles.sendButton, (!hasChanges || isSending) && styles.sendButtonDisabled]}
                onPress={handleSend}
                disabled={!hasChanges || isSending}
                activeOpacity={0.8}
                testID="send-request-button"
              >
                <Text style={styles.sendButtonText}>
                  {isSending ? 'Sending...' : 'Send request'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.footerNote}>
                Customer will review and can adjust before accepting.
              </Text>
            </View>
          </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  sheetInner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerRightSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  swipeContainer: {
    marginBottom: 10,
    overflow: 'hidden' as const,
    borderRadius: 14,
  },
  deleteBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    paddingRight: 24,
    gap: 8,
  },
  deleteBackgroundText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  editItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editItemCardRemoved: {
    backgroundColor: '#FAFAFA',
    borderColor: Colors.borderLight,
    opacity: 0.7,
  },
  editItemTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  editItemImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  editItemImagePlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  editItemInitial: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  editItemInfo: {
    flex: 1,
  },
  replacedLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#2563EB',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  editItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  editItemNameRemoved: {
    textDecorationLine: 'line-through' as const,
    color: Colors.textMuted,
  },
  editItemPrice: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  editItemPriceRemoved: {
    color: Colors.error,
    fontWeight: '600' as const,
  },
  editItemActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  quantityStepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperQty: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  substituteBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  substituteBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#2563EB',
  },
  restoreBtn: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(255,140,66,0.1)',
  },
  restoreBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  totalSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  totalOriginalValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  totalProposedValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalDiffValue: {
    fontSize: 14,
    fontWeight: '700' as const,
  },
  noteSection: {
    marginBottom: 16,
  },
  noteSectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  noteInputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
  },
  noteInput: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top' as const,
    lineHeight: 20,
  },
  charCounter: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 4,
  },
  bottomSpacer: {
    height: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
  },
  sendButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#FFD4B0',
    shadowOpacity: 0,
    elevation: 0,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  footerNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
    lineHeight: 17,
  },
  searchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 2,
  },
  replacementList: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  menuItemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  menuItemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 12,
  },
  menuItemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
    marginRight: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  menuItemInitial: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  menuItemTextBlock: {
    flex: 1,
  },
  menuItemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  menuItemPrice: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emptyMenuText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    paddingVertical: 24,
  },
  listBottomSpacer: {
    height: 24,
  },
});
