import React, { useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Plus, Minus, ShoppingCart } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { mockCategories, mockMenuItems, MenuItem, mockVendor } from '@/mocks/vendorData';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { getMenuItemDisplayPrice } from '@/utils/itemPricing';

const ITEM_CARD_WIDTH = 160;

export default function CategoryItemsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { items: cartItems, addItem, removeItem, vendorCartCount } = useCart();

  const cartScaleAnim = React.useRef(new Animated.Value(0)).current;
  const [cartVisible, setCartVisible] = React.useState(false);
  const cartVisibleRef = React.useRef(false);

  React.useEffect(() => {
    if (vendorCartCount > 0 && !cartVisibleRef.current) {
      cartVisibleRef.current = true;
      setCartVisible(true);
      cartScaleAnim.setValue(0.7);
      Animated.spring(cartScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 200,
        friction: 8,
      }).start();
    } else if (vendorCartCount === 0 && cartVisibleRef.current) {
      cartVisibleRef.current = false;
      Animated.timing(cartScaleAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }).start(() => setCartVisible(false));
    }
  }, [vendorCartCount, cartScaleAnim]);

  const category = useMemo(() => {
    return mockCategories.find((cat) => cat.id === id);
  }, [id]);

  const categoryItems = useMemo(() => {
    return mockMenuItems.filter((item) => item.categoryId === id);
  }, [id]);

  const getItemQuantityInCart = (itemId: string) => {
    return cartItems
      .filter((cartItem) => cartItem.id === itemId)
      .reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  };

  const handleAddToCart = (item: MenuItem) => {
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: getMenuItemDisplayPrice(item),
      image: item.image,
    });
    console.log('Added to cart:', item.name);
  };

  const handleIncrementItem = (item: MenuItem, e: any) => {
    e.stopPropagation();
    if (item.addOns && item.addOns.length > 0) {
      handleItemPress(item.id);
      return;
    }
    addItem({
      id: item.id,
      name: item.name,
      price: getMenuItemDisplayPrice(item),
      image: item.image,
    });
  };

  const handleDecrementItem = (itemId: string, e: any) => {
    e.stopPropagation();
    removeItem(itemId);
  };

  const handleItemPress = (itemId: string) => {
    router.push(`/item/${itemId}` as any);
  };

  const renderItemCard = (item: MenuItem) => {
    const quantityInCart = getItemQuantityInCart(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.itemCard}
        onPress={() => handleItemPress(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.itemImageContainer}>
          <Image source={{ uri: item.image }} style={styles.itemImage} />
          {!item.inStock && (
            <View style={styles.outOfStockBadge}>
              <Text style={styles.outOfStockText}>Out of stock</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.inStock && quantityInCart === 0 && (
              <TouchableOpacity
                style={styles.addIconButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart(item);
                }}
                activeOpacity={0.7}
              >
                <Plus size={18} color={Colors.text} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.itemMetadata}>
            {formatPriceWithCommas(item.price, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}
          </Text>
          {item.description && (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          )}
          {item.inStock && quantityInCart > 0 && (
            <View style={styles.itemActionArea}>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={(e) => handleDecrementItem(item.id, e)}
                  activeOpacity={0.7}
                >
                  <Minus size={16} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantityInCart}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={(e) => handleIncrementItem(item, e)}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={Colors.text} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: category?.name || 'Category',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
          headerBackTitle: '',
          headerTitleAlign: 'center',
        }}
      />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.itemsGrid}>
          {categoryItems.map((item) => renderItemCard(item))}
        </View>
        {categoryItems.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No items in this category</Text>
          </View>
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {cartVisible && (
        <Animated.View style={[
          styles.floatingCartButton,
          { transform: [{ scale: cartScaleAnim }] },
        ]}>
          <TouchableOpacity
            style={styles.floatingCartInner}
            onPress={() => router.push('/cart' as any)}
            activeOpacity={0.85}
          >
            <ShoppingCart size={24} color={Colors.text} />
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{vendorCartCount}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  itemsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  itemCard: {
    width: ITEM_CARD_WIDTH,
    backgroundColor: Colors.background,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemImageContainer: {
    position: 'relative' as const,
  },
  itemImage: {
    width: ITEM_CARD_WIDTH,
    height: 120,
    backgroundColor: Colors.border,
  },
  outOfStockBadge: {
    position: 'absolute' as const,
    top: 8,
    left: 8,
    backgroundColor: Colors.error,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  outOfStockText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  itemInfo: {
    padding: 12,
  },
  itemNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
  },
  addIconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 8,
  },
  itemMetadata: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  itemDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  itemActionArea: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  quantityButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quantityText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    minWidth: 22,
    textAlign: 'center' as const,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  bottomSpacer: {
    height: 120,
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
    top: -4,
    right: -4,
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
  },
});
