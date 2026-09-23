import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, Modal } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight, Plus, Package, MoreVertical, EyeOff, Trash2, Star, Pencil, Clock } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useCatalog, CatalogItem } from '@/contexts/CatalogContext';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { useVendor } from '@/contexts/VendorContext';

const TAG_COLORS = {
  bestseller: { bg: '#FFF7ED', text: '#EA580C', border: '#FED7AA' },
  low_stock: { bg: '#FEF3CD', text: '#92400E', border: '#FDE68A' },
  out_of_stock: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
};

type ItemTag = 'bestseller' | 'low_stock' | 'out_of_stock';

function getItemTag(item: CatalogItem): ItemTag | null {
  if (item.trackInventory) {
    const qty = item.inventoryQuantity ?? 0;
    const threshold = item.lowStockThreshold ?? 5;
    if (qty === 0) return 'out_of_stock';
    if (qty <= threshold) return 'low_stock';
  } else if (item.isOutOfStock) {
    return 'out_of_stock';
  }
  if (item.isFeatured) return 'bestseller';
  return null;
}

function getTagLabel(tag: ItemTag, item: CatalogItem): string {
  if (tag === 'out_of_stock') return 'Unavailable';
  if (tag === 'low_stock') {
    if (item.trackInventory && item.inventoryQuantity !== undefined) {
      return `Only ${item.inventoryQuantity} left`;
    }
    return 'Low stock';
  }
  return 'Bestseller';
}

export default function CategoryItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getCategoryById, getItemsByCategory, deleteCategory, updateCategory, toggleItemHidden, deleteItem } = useCatalog();
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const openRowRef = useRef<Swipeable | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  const { vendor } = useVendor();
  const category = getCategoryById(id as string);
  const items = getItemsByCategory(id as string);
  const currency = (vendor.currency as Currency) || 'NGN';

  if (!category) {
    return null;
  }

  const handleEditCategory = () => {
    setShowCategoryMenu(false);
    Alert.prompt(
      'Edit Category',
      'Enter new category name',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save',
          style: 'default',
          onPress: async (text?: string) => {
            if (text && text.trim()) {
              try {
                await updateCategory(id as string, text.trim());
              } catch (error) {
                console.error('[Category] Failed to rename category:', error);
                const message = (error as { message?: string })?.message ?? 'Could not rename this category. Please try again.';
                Alert.alert('Something went wrong', message);
              }
            }
          },
        },
      ],
      'plain-text',
      category?.name
    );
  };

  const handleDeleteCategory = () => {
    setShowCategoryMenu(false);
    const itemCount = items.length;
    const message = itemCount > 0
      ? `Delete "${category?.name}"?\n\n${itemCount} item${itemCount > 1 ? 's' : ''} will be moved to Uncategorized.`
      : `Delete "${category?.name}"?`;

    Alert.alert(
      'Delete Category',
      message,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(id as string);
              router.back();
            } catch (error) {
              console.error('[Category] Failed to delete category:', error);
              const message = (error as { message?: string })?.message ?? 'Could not delete this category. Please try again.';
              Alert.alert('Something went wrong', message);
            }
          },
        },
      ]
    );
  };

  const handleToggleHidden = async (item: CatalogItem) => {
    if (openRowRef.current) openRowRef.current.close();
    try {
      await toggleItemHidden(item.id, !item.isHidden);
    } catch (error) {
      console.error('[Category] Failed to toggle item visibility:', error);
      const message = (error as { message?: string })?.message ?? 'Could not update this item. Please try again.';
      Alert.alert('Something went wrong', message);
    }
  };

  const handleDeleteItem = (item: CatalogItem) => {
    if (openRowRef.current) openRowRef.current.close();
    Alert.alert(
      'Delete Item',
      `Delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteItem(item.id) },
      ]
    );
  };

  const renderRightActions = (item: CatalogItem) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeEdit]}
        onPress={() => {
          openRowRef.current?.close();
          router.push(`/vendor/catalog/item/${item.id}/edit` as any);
        }}
        activeOpacity={0.8}
      >
        <Pencil size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.swipeActionText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeHide]}
        onPress={() => handleToggleHidden(item)}
        activeOpacity={0.8}
      >
        <EyeOff size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.swipeActionText}>{item.isHidden ? 'Show' : 'Hide'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeDelete]}
        onPress={() => handleDeleteItem(item)}
        activeOpacity={0.8}
      >
        <Trash2 size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item, index }: { item: CatalogItem; index: number }) => {
    const displayPrice = item.salePrice ?? item.basePrice;
    const isPromo = item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.basePrice;
    const isLast = index === items.length - 1;
    const tag = getItemTag(item);
    const isPending = item.moderationStatus === 'pending_review';
    const isHidden = item.isHidden;

    return (
      <Swipeable
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        friction={2}
        rightThreshold={40}
        onSwipeableWillOpen={() => {
          const currentRef = swipeableRefs.current.get(item.id);
          if (openRowRef.current && openRowRef.current !== currentRef) {
            openRowRef.current.close();
          }
          openRowRef.current = currentRef || null;
        }}
      >
        <TouchableOpacity
          style={[
            styles.itemRow,
            isHidden && styles.itemRowHidden,
            isPending && !isHidden && styles.itemRowPending,
          ]}
          onPress={() => router.push(`/vendor/catalog/item/${item.id}` as any)}
          activeOpacity={0.7}
        >
          {item.photos[0] ? (
            <Image
              source={{ uri: item.photos[0] }}
              style={[
                styles.itemThumbnail,
                isHidden && styles.itemThumbnailHidden,
                isPending && !isHidden && styles.itemThumbnailPending,
              ]}
            />
          ) : (
            <View style={[
              styles.itemThumbnail,
              styles.itemThumbnailPlaceholder,
              isHidden && styles.itemThumbnailHidden,
              isPending && !isHidden && styles.itemThumbnailPending,
            ]}>
              <Package size={22} color={Colors.textSecondary} strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.itemRowContent}>
            <View style={styles.itemRowTop}>
              <Text
                style={[
                  styles.itemRowName,
                  isHidden && styles.itemNameHidden,
                  isPending && !isHidden && styles.itemNamePending,
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              {tag && (
                <View style={[styles.tagBadge, { backgroundColor: TAG_COLORS[tag].bg, borderColor: TAG_COLORS[tag].border }]}>
                  <Text style={[styles.tagText, { color: TAG_COLORS[tag].text }]}>
                    {getTagLabel(tag, item)}
                  </Text>
                </View>
              )}
              {item.isFeatured && !tag && (
                <Star size={13} color={Colors.primary} fill={Colors.primary} />
              )}
            </View>
            <View style={styles.itemRowBottom}>
              {isPromo ? (
                <View style={styles.priceRow}>
                  <Text style={styles.itemRowPriceStrikethrough}>
                    {formatPriceWithCommas(item.basePrice, currency)}
                  </Text>
                  <Text style={[
                    styles.itemRowPricePromo,
                    (isHidden || isPending) && styles.itemRowPriceMuted,
                  ]}>
                    {formatPriceWithCommas(displayPrice, currency)}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.itemRowPrice,
                  isHidden && styles.itemRowPriceMuted,
                  isPending && !isHidden && styles.itemRowPricePending,
                ]}>
                  {formatPriceWithCommas(displayPrice, currency)}
                </Text>
              )}
              {isPending && !isHidden && (
                <View style={styles.pendingChip}>
                  <Clock size={10} color='#92400E' strokeWidth={2.5} />
                  <Text style={styles.pendingChipText}>Under review</Text>
                </View>
              )}
              {isHidden && (
                <View style={styles.hiddenChip}>
                  <EyeOff size={11} color={Colors.textMuted} strokeWidth={2} />
                  <Text style={styles.hiddenChipText}>Hidden</Text>
                </View>
              )}
            </View>
          </View>
          <ChevronRight size={16} color={Colors.textMuted} />
        </TouchableOpacity>
        {!isLast && <View style={styles.itemDivider} />}
      </Swipeable>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <ChevronLeft size={22} color={Colors.text} strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{category.name}</Text>
              <Text style={styles.headerSubtitle}>
                {items.length} item{items.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push(`/vendor/catalog/add-item?categoryId=${id}` as any)}
                activeOpacity={0.7}
              >
                <Plus size={22} color={Colors.primary} strokeWidth={2.5} />
              </TouchableOpacity>
              {!category.isSystem && (
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => setShowCategoryMenu(true)}
                  activeOpacity={0.7}
                >
                  <MoreVertical size={20} color={Colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </SafeAreaView>

        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Package size={36} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button above to add your first item to this category.
            </Text>
            <TouchableOpacity
              style={styles.emptyStateCTA}
              onPress={() => router.push(`/vendor/catalog/add-item?categoryId=${id}` as any)}
              activeOpacity={0.7}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.emptyStateCTAText}>Add item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}

        <Modal
          visible={showCategoryMenu}
          transparent
          animationType="slide"
          onRequestClose={() => setShowCategoryMenu(false)}
        >
          <TouchableOpacity
            style={styles.actionSheetOverlay}
            activeOpacity={1}
            onPress={() => setShowCategoryMenu(false)}
          >
            <View style={styles.actionSheetContainer}>
              <View style={styles.actionSheet}>
                <TouchableOpacity
                  style={styles.actionSheetOption}
                  onPress={handleEditCategory}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSheetOptionText}>Rename Category</Text>
                </TouchableOpacity>
                <View style={styles.actionSheetDivider} />
                <TouchableOpacity
                  style={styles.actionSheetOption}
                  onPress={handleDeleteCategory}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSheetOptionDestructive}>Delete Category</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.actionSheetCancel}>
                <TouchableOpacity
                  style={styles.actionSheetCancelButton}
                  onPress={() => setShowCategoryMenu(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionSheetCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 12,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
    width: 36 + 8 + 36,
    justifyContent: 'flex-end' as const,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    gap: 12,
  },
  itemThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: Colors.surface,
  },
  itemThumbnailPlaceholder: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemThumbnailHidden: {
    opacity: 0.35,
  },
  itemThumbnailPending: {
    opacity: 0.65,
  },
  itemRowHidden: {
    backgroundColor: '#FAFAFA',
  },
  itemRowPending: {
    backgroundColor: '#FFFDF8',
  },
  itemRowContent: {
    flex: 1,
    justifyContent: 'center' as const,
    gap: 4,
  },
  itemRowTop: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    flexWrap: 'wrap' as const,
  },
  itemRowName: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    flex: 1,
  },
  itemNameHidden: {
    color: Colors.textMuted,
  },
  itemNamePending: {
    color: Colors.textSecondary,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  itemRowBottom: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  itemRowPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  itemRowPriceMuted: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  itemRowPricePending: {
    color: Colors.textTertiary,
  },
  itemRowPriceStrikethrough: {
    fontSize: 13,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  itemRowPricePromo: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  hiddenChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: Colors.surface,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hiddenChipText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  pendingChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#FEF3CD',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pendingChipText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '500' as const,
  },
  itemDivider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginLeft: 76,
  },
  swipeActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  swipeAction: {
    width: 72,
    height: '100%' as any,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  swipeEdit: {
    backgroundColor: '#3B82F6',
  },
  swipeHide: {
    backgroundColor: '#6B7280',
  },
  swipeDelete: {
    backgroundColor: Colors.error,
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyStateCTA: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  emptyStateCTAText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
  },
  actionSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end' as const,
  },
  actionSheetContainer: {
    paddingHorizontal: 8,
    paddingBottom: 34,
  },
  actionSheet: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 8,
  },
  actionSheetOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  actionSheetOptionText: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '400' as const,
  },
  actionSheetOptionDestructive: {
    fontSize: 18,
    color: Colors.error,
    fontWeight: '400' as const,
  },
  actionSheetDivider: {
    height: 0.5,
    backgroundColor: Colors.border,
  },
  actionSheetCancel: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  actionSheetCancelButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  actionSheetCancelText: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
