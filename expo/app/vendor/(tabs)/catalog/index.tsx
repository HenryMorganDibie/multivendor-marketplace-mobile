import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  Share,
  Image,
  SectionList,
  FlatList,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Package, FolderPlus, Share2, Clock, ChevronRight, Search, X, EyeOff, Pencil, Trash2, Folder, AlertCircle } from 'lucide-react-native';
import { router, Stack } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import { useCatalog, CatalogItem, Category } from '@/contexts/CatalogContext';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { Colors } from '@/constants/colors';
import { getBottomOverlayPadding } from '@/lib/constants/layout';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { useVendor } from '@/contexts/VendorContext';
import { shareStorefront, checkShareable } from '@/lib/storefront/shareStorefront';

type FilterTab = 'all' | 'categories' | 'low_stock' | 'hidden';

const PREVIEW_LIMIT = 3;

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

export default function VendorCatalogScreen() {
  const { categories, getItemsByCategory, items, addCategory, updateItem, deleteItem } = useCatalog();
  const { vendor } = useVendor();
  const insets = useSafeAreaInsets();
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const countryStatus = useCountryStatus();
  const isWaitlisted = countryStatus.isWaitlistOnly;
  const currencySymbol = (mockVendor.currency as Currency) || 'NGN';

  const [showSearch, setShowSearch] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const openSwipeRef = useRef<Swipeable | null>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: showSearch ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (!showSearch) setSearchQuery('');
    });
  }, [showSearch, searchAnim]);

  const handleToggleSearch = useCallback(() => {
    setShowSearch((v) => !v);
  }, []);

  const matchesItemQuery = useCallback(
    (item: CatalogItem, q: string): boolean => {
      if (!q) return true;
      const category = categories.find((c) => c.id === item.categoryId);
      const tag = getItemTag(item);
      const haystack: string[] = [
        item.name,
        category?.name ?? '',
        formatPriceWithCommas(item.salePrice ?? item.basePrice, currencySymbol),
        String(item.salePrice ?? item.basePrice),
        item.isHidden ? 'hidden' : 'visible',
        item.isOutOfStock ? 'unavailable' : 'available',
        item.isFeatured ? 'featured bestseller' : '',
        tag ? getTagLabel(tag, item) : '',
      ];
      return haystack.some((h) => h.toLowerCase().includes(q));
    },
    [categories, currencySymbol]
  );

  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return items.filter((item) => {
      if (q && !matchesItemQuery(item, q)) return false;
      if (activeTab === 'low_stock') {
        if (item.trackInventory) {
          const qty = item.inventoryQuantity ?? 0;
          const threshold = item.lowStockThreshold ?? 5;
          return qty <= threshold;
        }
        return item.isOutOfStock;
      }
      if (activeTab === 'hidden') return item.isHidden;
      return true;
    });
  }, [items, searchQuery, activeTab, matchesItemQuery]);

  const sections = useMemo(() => {
    if (activeTab !== 'all') return [];
    const q = searchQuery.toLowerCase().trim();
    const sorted = [...categories]
      .filter((cat) => {
        const catItems = getItemsByCategory(cat.id);
        if (cat.id === 'uncategorized' && catItems.length === 0) return false;
        if (q) {
          return catItems.some((i) => matchesItemQuery(i, q));
        }
        return catItems.length > 0 || cat.id !== 'uncategorized';
      })
      .sort((a, b) => a.order - b.order);

    return sorted.map((cat) => {
      const catItems = getItemsByCategory(cat.id).filter((i) =>
        q ? matchesItemQuery(i, q) : true
      );
      const featuredFirst = [...catItems].sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return 0;
      });
      return {
        category: cat,
        title: cat.name,
        itemCount: catItems.length,
        data: featuredFirst.slice(0, PREVIEW_LIMIT),
        hasMore: catItems.length > PREVIEW_LIMIT,
      };
    });
  }, [categories, getItemsByCategory, searchQuery, activeTab, matchesItemQuery]);

  const handlePlusPress = () => {
    if (isWaitlisted) {
      Alert.alert(
        'Catalog Publishing Unavailable',
        'the platform is in limited availability in your country. Catalog publishing will be available when we fully launch.',
        [{ text: 'OK' }]
      );
      return;
    }
    setShowActionSheet(true);
  };

  const handleShareCatalog = async () => {
    try {
      await Share.share({
        message: 'Check out my catalog on the platform! View products and prices.\n\nOrders and payments are handled directly by the vendor.',
      });
    } catch (error) {
      console.error('Error sharing catalog:', error);
    }
  };

  const handleAddItem = () => {
    setShowActionSheet(false);
    router.push('/vendor/catalog/add-item' as any);
  };

  const handleAddCategory = () => {
    setShowActionSheet(false);
    setShowAddCategoryModal(true);
    setCategoryName('');
  };

  const handleSaveCategory = () => {
    const trimmedName = categoryName.trim();
    if (!trimmedName) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }
    if (categories.some((cat) => cat.name.toLowerCase() === trimmedName.toLowerCase())) {
      Alert.alert('Duplicate', 'A category with this name already exists.');
      return;
    }
    addCategory(trimmedName);
    setShowAddCategoryModal(false);
    setCategoryName('');
    Alert.alert('Success', 'Category created successfully.');
  };

  const handleToggleHidden = (item: CatalogItem) => {
    openSwipeRef.current?.close();
    updateItem(item.id, { ...item, isHidden: !item.isHidden });
  };

  const handleDeleteItem = (item: CatalogItem) => {
    openSwipeRef.current?.close();
    Alert.alert('Delete Item', `Delete "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(item.id) },
    ]);
  };

  const hasAnyItems = items.length > 0;

  const renderRightActions = (item: CatalogItem) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeEdit]}
        onPress={() => {
          openSwipeRef.current?.close();
          router.push(`/vendor/catalog/item/${item.id}/edit` as any);
        }}
        activeOpacity={0.8}
      >
        <Pencil size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.swipeActionText}>Edit</Text>
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

  const renderLeftActions = (item: CatalogItem) => (
    <View style={styles.swipeActionsLeft}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.swipeHide]}
        onPress={() => handleToggleHidden(item)}
        activeOpacity={0.8}
      >
        <EyeOff size={18} color="#fff" strokeWidth={2} />
        <Text style={styles.swipeActionText}>{item.isHidden ? 'Show' : 'Hide'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItemRow = (item: CatalogItem, showDivider: boolean = false) => {
    const displayPrice = item.salePrice ?? item.basePrice;
    const isPromo = item.salePrice !== undefined && item.salePrice !== null && item.salePrice < item.basePrice;
    const tag = getItemTag(item);
    const isPending = item.moderationStatus === 'pending_review';
    const isHidden = item.isHidden;

    return (
      <Swipeable
        key={item.id}
        ref={(ref) => {
          if (ref) swipeableRefs.current.set(item.id, ref);
          else swipeableRefs.current.delete(item.id);
        }}
        renderRightActions={() => renderRightActions(item)}
        renderLeftActions={() => renderLeftActions(item)}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
        rightThreshold={40}
        leftThreshold={40}
        onSwipeableWillOpen={() => {
          const ref = swipeableRefs.current.get(item.id);
          if (openSwipeRef.current && openSwipeRef.current !== ref) {
            openSwipeRef.current.close();
          }
          openSwipeRef.current = ref || null;
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
            </View>
            <View style={styles.itemRowBottom}>
              {isPromo ? (
                <View style={styles.priceRow}>
                  <Text style={styles.itemRowPriceStrikethrough}>
                    {formatPriceWithCommas(item.basePrice, currencySymbol)}
                  </Text>
                  <Text style={[
                    styles.itemRowPricePromo,
                    (isHidden || isPending) && styles.itemRowPriceMuted,
                  ]}>
                    {formatPriceWithCommas(displayPrice, currencySymbol)}
                  </Text>
                </View>
              ) : (
                <Text style={[
                  styles.itemRowPrice,
                  isHidden && styles.itemRowPriceMuted,
                  isPending && !isHidden && styles.itemRowPricePending,
                ]}>
                  {formatPriceWithCommas(displayPrice, currencySymbol)}
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
        {showDivider && <View style={styles.itemDivider} />}
      </Swipeable>
    );
  };

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; itemCount: number; category: Category; hasMore: boolean };
  }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{section.title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>{section.itemCount}</Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => router.push(`/vendor/catalog/category/${section.category.id}` as any)}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.viewAllLink}
      >
        <Text style={styles.seeAllText}>View all</Text>
        <ChevronRight size={14} color={Colors.primary} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );

  const renderSectionItem = ({
    item,
    section,
  }: {
    item: CatalogItem;
    section: { data: CatalogItem[] };
  }) => {
    const isLast = section.data.indexOf(item) === section.data.length - 1;
    return renderItemRow(item, !isLast);
  };

  const renderCategoriesTab = () => (
    <FlatList
      data={categories.filter((cat) => {
        const count = getItemsByCategory(cat.id).length;
        return !(cat.id === 'uncategorized' && count === 0);
      }).sort((a, b) => a.order - b.order)}
      keyExtractor={(cat) => cat.id}
      contentContainerStyle={[styles.flatListContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
      ItemSeparatorComponent={() => <View style={styles.catSeparator} />}
      renderItem={({ item: cat }) => {
        const count = getItemsByCategory(cat.id).length;
        return (
          <TouchableOpacity
            style={styles.categoryRow}
            onPress={() => router.push(`/vendor/catalog/category/${cat.id}` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryRowLeft}>
              <View style={styles.categoryIcon}>
                <Folder size={18} color={Colors.primary} strokeWidth={2} />
              </View>
              <View>
                <Text style={styles.categoryRowName}>{cat.name}</Text>
                <Text style={styles.categoryRowCount}>{count} item{count !== 1 ? 's' : ''}</Text>
              </View>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        );
      }}
    />
  );

  const renderFlatItems = (tabLabel: string) => {
    if (filteredItems.length === 0) {
      return (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <Package size={40} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyText}>No {tabLabel} items</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.flatListContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
        renderItem={({ item, index }) =>
          renderItemRow(item, index < filteredItems.length - 1)
        }
      />
    );
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'categories', label: 'Categories' },
    { key: 'low_stock', label: 'Low stock' },
    { key: 'hidden', label: 'Hidden' },
  ];

  const lowStockCount = items.filter((i) => {
    if (i.trackInventory) {
      const qty = i.inventoryQuantity ?? 0;
      const threshold = i.lowStockThreshold ?? 5;
      return qty <= threshold;
    }
    return i.isOutOfStock;
  }).length;
  const hiddenCount = items.filter((i) => i.isHidden).length;

  const tabBadge = (key: FilterTab): number | null => {
    if (key === 'low_stock') return lowStockCount || null;
    if (key === 'hidden') return hiddenCount || null;
    return null;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Catalog</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={handleToggleSearch}
                activeOpacity={0.7}
              >
                <Search size={21} color={showSearch ? Colors.primary : Colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handleShareCatalog} activeOpacity={0.7}>
                <Share2 size={21} color={Colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={handlePlusPress} activeOpacity={0.7}>
                <Plus size={21} color={Colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>

          <Animated.View
            style={[
              styles.searchContainer,
              {
                height: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 56] }),
                opacity: searchAnim,
                overflow: 'hidden',
              },
            ]}
          >
            <View style={styles.searchBar}>
              <Search size={15} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search items..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                clearButtonMode="never"
                autoFocus={showSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={15} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>

          <View style={styles.tabsContainer}>
            {tabs.map((tab) => {
              const badge = tabBadge(tab.key);
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
                  {badge ? (
                    <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>{badge}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>

        {isWaitlisted ? (
          <View style={styles.waitlistState}>
            <View style={styles.waitlistIconContainer}>
              <Clock size={48} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.waitlistTitle}>Catalog publishing unavailable</Text>
            <Text style={styles.waitlistText}>
              the platform is in limited availability in your country. Catalog publishing will be available when we fully launch.
            </Text>
          </View>
        ) : !hasAnyItems ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Package size={48} color={Colors.textMuted} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyText}>No items yet</Text>
            <Text style={styles.emptySubtext}>Add your first item to start selling.</Text>
            <TouchableOpacity
              style={styles.emptyStateCTA}
              onPress={() => router.push('/vendor/catalog/add-item' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyStateCTAText}>Add new item</Text>
            </TouchableOpacity>
          </View>
        ) : activeTab === 'categories' ? (
          renderCategoriesTab()
        ) : activeTab === 'low_stock' ? (
          renderFlatItems('low stock')
        ) : activeTab === 'hidden' ? (
          renderFlatItems('hidden')
        ) : (
          sections.length === 0 && searchQuery.length > 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Search size={40} color={Colors.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyText}>No results for "{searchQuery}"</Text>
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              renderItem={renderSectionItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
              renderSectionFooter={({ section }) =>
                section.hasMore ? (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => router.push(`/vendor/catalog/category/${section.category.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.viewAllButtonText}>View all {section.itemCount} items</Text>
                    <ChevronRight size={15} color={Colors.primary} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.sectionSpacer} />
                )
              }
            />
          )
        )}

        <Modal visible={showActionSheet} transparent animationType="slide" onRequestClose={() => setShowActionSheet(false)}>
          <Pressable style={styles.bottomSheetOverlay} onPress={() => setShowActionSheet(false)}>
            <View style={styles.bottomSheetContainer}>
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={styles.bottomSheetHandle} />
                <View style={styles.bottomSheetContent}>
                  <TouchableOpacity style={styles.bottomSheetOption} onPress={handleAddItem} activeOpacity={0.7}>
                    <View style={styles.bottomSheetOptionIcon}>
                      <Plus size={24} color={Colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>New Item</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.bottomSheetOption} onPress={handleAddCategory} activeOpacity={0.7}>
                    <View style={styles.bottomSheetOptionIcon}>
                      <FolderPlus size={24} color={Colors.primary} strokeWidth={2} />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>New Category</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </Pressable>
        </Modal>

        <Modal
          visible={showAddCategoryModal}
          transparent
          animationType="slide"
          onRequestClose={() => { Keyboard.dismiss(); setShowAddCategoryModal(false); }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <Pressable
              style={styles.addCategoryOverlay}
              onPress={() => { Keyboard.dismiss(); setShowAddCategoryModal(false); }}
            >
              <Pressable onPress={(e) => e.stopPropagation()} style={styles.addCategorySheet}>
                {/* Drag handle */}
                <View style={styles.acHandle} />

                {/* Header */}
                <View style={styles.acHeader}>
                  <TouchableOpacity
                    onPress={() => { Keyboard.dismiss(); setShowAddCategoryModal(false); }}
                    style={styles.acCancelBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.acCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <Text style={styles.acTitle}>New Category</Text>
                  <View style={{ width: 64 }} />
                </View>

                {/* Subtitle */}
                <Text style={styles.acSubtitle}>
                  Choose a name customers will see when browsing your catalog.
                </Text>

                {/* Input */}
                <View style={styles.acInputWrapper}>
                  <TextInput
                    style={styles.acInput}
                    placeholder="e.g., Desserts, Main Dishes"
                    placeholderTextColor={Colors.textMuted}
                    value={categoryName}
                    onChangeText={setCategoryName}
                    autoFocus
                    maxLength={50}
                    returnKeyType="done"
                    onSubmitEditing={handleSaveCategory}
                  />
                  {categoryName.length > 0 && (
                    <Text style={styles.acCharCount}>{categoryName.length}/50</Text>
                  )}
                </View>

                {/* Duplicate warning */}
                {categoryName.trim().length > 0 &&
                  categories.some((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()) && (
                  <View style={styles.acWarning}>
                    <Text style={styles.acWarningText}>A category with this name already exists.</Text>
                  </View>
                )}

                {/* CTA */}
                <TouchableOpacity
                  style={[
                    styles.acCreateBtn,
                    (!categoryName.trim() || categories.some((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()))
                      && styles.acCreateBtnDisabled,
                  ]}
                  onPress={handleSaveCategory}
                  disabled={!categoryName.trim() || categories.some((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase())}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.acCreateBtnText,
                    (!categoryName.trim() || categories.some((c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()))
                      && styles.acCreateBtnTextDisabled,
                  ]}>
                    Create Category
                  </Text>
                </TouchableOpacity>

                {/* Safe area spacer */}
                <View style={{ height: insets.bottom > 0 ? insets.bottom : 16 }} />
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
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
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: '#111111',
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 13,
    paddingHorizontal: 13,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  tabsContainer: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingBottom: 6,
    gap: 8,
  },
  tab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    gap: 5,
  },
  tabActive: {
    backgroundColor: Colors.text,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.background,
    fontWeight: '600' as const,
  },
  tabBadge: {
    backgroundColor: Colors.borderDark,
    borderRadius: 7,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 17,
    alignItems: 'center' as const,
  },
  tabBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  flatListContent: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingTop: 18,
    paddingBottom: 6,
  },
  sectionHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  viewAllLink: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    gap: 12,
    borderRadius: 0,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
  swipeActionsLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  swipeAction: {
    width: 76,
    height: '100%' as any,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  swipeEdit: {
    backgroundColor: '#3B82F6',
  },
  swipeDelete: {
    backgroundColor: Colors.error,
  },
  swipeHide: {
    backgroundColor: '#6B7280',
  },
  swipeActionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  viewAllButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 10,
    gap: 3,
    marginBottom: 2,
  },
  viewAllButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sectionSpacer: {
    height: 4,
  },
  categoryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: Colors.background,
  },
  categoryRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  categoryRowName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  categoryRowCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  catSeparator: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginLeft: 52,
  },
  waitlistState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingBottom: 24,
  },
  waitlistIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  waitlistTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    letterSpacing: -0.4,
    textAlign: 'center' as const,
  },
  waitlistText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  emptySubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateCTA: {
    paddingVertical: 13,
    paddingHorizontal: 32,
    backgroundColor: Colors.primary,
    borderRadius: 12,
  },
  emptyStateCTAText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  bottomSheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  bottomSheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  bottomSheetContent: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  bottomSheetOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  bottomSheetOptionIcon: {
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 16,
  },
  bottomSheetOptionText: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  addCategoryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  addCategorySheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 20,
  },
  acHandle: {
    width: 32,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 10,
  },
  acHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  acCancelBtn: {
    width: 64,
  },
  acCancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  acTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
  },
  acSubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  acInputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  acInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    padding: 0,
    letterSpacing: -0.2,
  },
  acCharCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  acWarning: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  acWarningText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500' as const,
  },
  acCreateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
  },
  acCreateBtnDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  acCreateBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    letterSpacing: -0.2,
  },
  acCreateBtnTextDisabled: {
    color: Colors.textMuted,
  },
});
