import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import { Plus, Percent, Gift, Truck, Tag, Zap, Pencil, Trash2, ChevronDown, Info } from 'lucide-react-native';
import { usePromo } from '@/contexts/PromoContext';
import { useVendor } from '@/contexts/VendorContext';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';
import type { VendorPromotion, StackingMode } from '@/mocks/promotionsData';
import { getPromotionCategory } from '@/mocks/promotionsData';
import EditScreenHeader from '@/components/EditScreenHeader';

const ICON_MAP: Record<string, any> = {
  percent: Percent,
  gift: Gift,
  truck: Truck,
  tag: Tag,
  zap: Zap,
};

const ICON_COLORS: Record<string, { bg: string; fg: string }> = {
  percent: { bg: '#FFF0E6', fg: '#FF8C42' },
  gift: { bg: '#F0FDF4', fg: '#16A34A' },
  truck: { bg: '#EFF6FF', fg: '#2563EB' },
  tag: { bg: '#FEF3C7', fg: '#D97706' },
  zap: { bg: '#FDF2F8', fg: '#DB2777' },
};

const REVEAL_WIDTH = 140;

function SwipeablePromoCard({
  promo,
  onEdit,
  onDelete,
}: {
  promo: VendorPromotion;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const translateX = useRef(new Animated.Value(0)).current;

  const springClose = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const springOpen = () => {
    Animated.spring(translateX, {
      toValue: -REVEAL_WIDTH,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -REVEAL_WIDTH));
        } else {
          translateX.setValue(Math.min(gs.dx * 0.15, 0));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -REVEAL_WIDTH / 2) {
          springOpen();
        } else {
          springClose();
        }
      },
    })
  ).current;

  const IconComponent = ICON_MAP[promo.icon] || Zap;
  const colors = ICON_COLORS[promo.icon] || ICON_COLORS.zap;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <View style={styles.swipeContainer}>
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={styles.editAction}
          onPress={() => {
            springClose();
            setTimeout(onEdit, 120);
          }}
          activeOpacity={0.85}
        >
          <Pencil size={18} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteAction}
          onPress={() => {
            springClose();
            setTimeout(onDelete, 120);
          }}
          activeOpacity={0.85}
        >
          <Trash2 size={18} color="#FFFFFF" />
          <Text style={styles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[styles.promoCard, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.promoCardInner}>
          <View style={[styles.promoIcon, { backgroundColor: colors.bg }]}>
            <IconComponent size={20} color={colors.fg} />
          </View>
          <View style={styles.promoContent}>
            <Text style={styles.promoTitle} numberOfLines={1}>{promo.title}</Text>
            <Text style={styles.promoDescription} numberOfLines={1}>{promo.shortDescription}</Text>
            <View style={styles.promoMeta}>
              <View style={[styles.statusDot, promo.active ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusLabel, promo.active ? styles.statusLabelActive : styles.statusLabelInactive]}>
                {promo.active ? 'Active' : 'Inactive'}
              </Text>
              <Text style={styles.dateSeparator}>·</Text>
              <Text style={styles.dateRange}>
                {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const STACKING_MODES: { value: StackingMode; label: string; description: string }[] = [
  { value: 'single', label: 'Single Promotion', description: 'Only 1 promotion applies per order' },
  { value: 'delivery_only', label: 'Delivery Stacking', description: 'Free delivery can stack with 1 other promo' },
  { value: 'advanced', label: 'Advanced Stacking', description: '1 discount + 1 value + free delivery can stack' },
];

export default function PromotionsScreen() {
  const router = useRouter();
  const { promotions, activePromotions, isLoading, canAddPromotion, maxPromotions, deletePromotion } = usePromo();
  const { vendor, updateVendor } = useVendor();
  const [deleteTarget, setDeleteTarget] = useState<VendorPromotion | null>(null);
  const [showStackingPicker, setShowStackingPicker] = useState(false);

  const currentStackingMode: StackingMode = vendor.promoStackingMode || 'single';
  const currentStackingLabel = STACKING_MODES.find((m) => m.value === currentStackingMode)?.label || 'Single Promotion';

  const isServiceVendor = vendor.category?.toLowerCase().includes('service');

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePromotion(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete promotion:', error);
    }
  };

  const handleCreate = () => {
    if (!canAddPromotion) return;
    router.push('/vendor/settings/create-promo' as any);
  };

  const handleEdit = (promoId: string) => {
    router.push({ pathname: '/vendor/settings/edit-promo' as any, params: { promoId } });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Promotions" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Create automatic promotions that apply at checkout. Max {maxPromotions} active at a time.
            </Text>
            <View style={styles.counterRow}>
              <Text style={styles.counterLabel}>Active promotions</Text>
              <View style={[styles.counterBadge, activePromotions.length >= maxPromotions && styles.counterBadgeFull]}>
                <Text style={[styles.counterText, activePromotions.length >= maxPromotions && styles.counterTextFull]}>
                  {activePromotions.length}/{maxPromotions}
                </Text>
              </View>
            </View>
          </View>

          {isServiceVendor && (
            <View style={styles.serviceNote}>
              <Text style={styles.serviceNoteText}>
                Service vendors can create Percentage and Flat discounts only.
              </Text>
            </View>
          )}

          {!isLoading && promotions.length === 0 && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Zap size={40} color={Colors.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No promotions yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the + icon to create your first promotion
              </Text>
            </View>
          )}

          {!isLoading && promotions.length > 0 && (
            <View style={styles.promoList}>
              <Text style={styles.promoListLabel}>SWIPE LEFT TO EDIT OR DELETE</Text>
              {promotions.map((promo) => {
                const cat = getPromotionCategory(promo.type);
                return (
                  <View key={promo.id}>
                    <SwipeablePromoCard
                      promo={promo}
                      onEdit={() => handleEdit(promo.id)}
                      onDelete={() => setDeleteTarget(promo)}
                    />
                    <View style={styles.categoryTag}>
                      <Text style={styles.categoryTagText}>
                        {cat === 'discount' ? 'DISCOUNT' : cat === 'value' ? 'VALUE' : 'DELIVERY'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.stackingSection}>
            <View style={styles.stackingSectionHeader}>
              <Text style={styles.stackingSectionTitle}>Promotion Stacking</Text>
              <TouchableOpacity
                style={styles.stackingInfoButton}
                activeOpacity={0.7}
              >
                <Info size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.stackingSectionDesc}>
              Control how promotions combine at checkout
            </Text>
            <TouchableOpacity
              style={styles.stackingSelector}
              onPress={() => setShowStackingPicker(!showStackingPicker)}
              activeOpacity={0.7}
              testID="stacking-mode-selector"
            >
              <Text style={styles.stackingSelectorLabel}>{currentStackingLabel}</Text>
              <ChevronDown size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            {showStackingPicker && (
              <View style={styles.stackingOptions}>
                {STACKING_MODES.map((mode) => (
                  <TouchableOpacity
                    key={mode.value}
                    style={[
                      styles.stackingOption,
                      currentStackingMode === mode.value && styles.stackingOptionActive,
                    ]}
                    onPress={() => {
                      updateVendor({ promoStackingMode: mode.value });
                      setShowStackingPicker(false);
                      console.log('[Promotions] Stacking mode changed to:', mode.value);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.stackingOptionContent}>
                      <Text style={[
                        styles.stackingOptionLabel,
                        currentStackingMode === mode.value && styles.stackingOptionLabelActive,
                      ]}>{mode.label}</Text>
                      <Text style={styles.stackingOptionDesc}>{mode.description}</Text>
                    </View>
                    {currentStackingMode === mode.value && (
                      <View style={styles.stackingOptionCheck}>
                        <View style={styles.stackingOptionCheckDot} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={deleteTarget !== null}
        title="Delete promotion?"
        message={deleteTarget ? `"${deleteTarget.title}" will be permanently removed.` : ''}
        primaryButton={{
          label: 'Delete',
          onPress: handleDelete,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setDeleteTarget(null),
        }}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  headerAddButton: {
    padding: 6,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  counterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  counterLabel: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  counterBadge: {
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counterBadgeFull: {
    backgroundColor: 'rgba(255, 140, 66, 0.12)',
  },
  counterText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  counterTextFull: {
    color: Colors.primary,
  },
  serviceNote: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  serviceNoteText: {
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 28,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  emptyCreateButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  emptyCreateButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  promoList: {
    marginTop: 20,
    gap: 10,
  },
  promoListLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  swipeContainer: {
    position: 'relative' as const,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  swipeActions: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    flexDirection: 'row' as const,
  },
  editAction: {
    flex: 1,
    backgroundColor: '#3B82F6',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deleteAction: {
    flex: 1,
    backgroundColor: '#DC2626',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  promoCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  promoCardInner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 14,
    gap: 12,
  },
  promoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  promoContent: {
    flex: 1,
  },
  promoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  promoDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  promoMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotActive: {
    backgroundColor: Colors.success,
  },
  statusDotInactive: {
    backgroundColor: Colors.textMuted,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  statusLabelActive: {
    color: Colors.success,
  },
  statusLabelInactive: {
    color: Colors.textMuted,
  },
  dateSeparator: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  dateRange: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bottomSpacer: {
    height: 40,
  },
  categoryTag: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryTagText: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  stackingSection: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
  },
  stackingSectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  stackingSectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  stackingInfoButton: {
    padding: 4,
  },
  stackingSectionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  stackingSelector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  stackingSelectorLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  stackingOptions: {
    marginTop: 8,
    gap: 6,
  },
  stackingOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 14,
  },
  stackingOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(255,140,66,0.04)',
  },
  stackingOptionContent: {
    flex: 1,
  },
  stackingOptionLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  stackingOptionLabelActive: {
    color: Colors.primary,
  },
  stackingOptionDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  stackingOptionCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 12,
  },
  stackingOptionCheckDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
});
