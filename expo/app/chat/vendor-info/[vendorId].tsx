import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Store,
  Search,
  Share2,
  Heart,
  ShoppingBag,
  ImageIcon,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { mockVendors } from '@/mocks/vendorData';

import { useFavorites } from '@/contexts/FavoritesContext';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { chatService } from '@/services/chatService';
import { signalChatSearchActivation } from '@/utils/chatSearchSignal';
import { getVendorStorefrontPath, canAccessStorefront } from '@/utils/vendorLookup';
import { Alert } from '@/utils/alert';

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter((p) => p.length > 0);
  if (parts.length === 0) return 'V';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getStableColor = (name: string): string => {
  const colors = ['#E8845C', '#22C55E', '#5B9BD5', '#E89B6C', '#7BC8B8', '#F0C75E', '#A78BCA', '#6AADDB'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

type ConfirmKind = 'block' | 'clear' | null;

export default function VendorChatInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const vendorId = (params.vendorId as string) || '';
  const chatId = (params.chatId as string) || '';

  const vendor = useMemo(
    () => mockVendors.find((v) => v.id === vendorId),
    [vendorId],
  );

  const { isFavorite, toggleFavorite } = useFavorites();
  const { blockUser } = useBlockedUsers();
  const favorited = vendor ? isFavorite(vendor.id) : false;

  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [chatCleared, setChatCleared] = useState<boolean>(false);
  const heartScale = useRef(new Animated.Value(1)).current;

  const handleBack = useCallback(() => {
    try {
      router.back();
    } catch {
      router.replace('/customer/(tabs)/chats' as any);
    }
  }, [router]);

  const handleViewStorefront = useCallback(() => {
    if (!vendor) return;
    const access = canAccessStorefront(vendor.id, true);
    if (!access.allowed) {
      Alert.alert('Store Unavailable', access.message ?? 'This store is temporarily unavailable.');
      return;
    }
    const path = getVendorStorefrontPath(vendor.id);
    if (!path || path === '/') {
      Alert.alert('Store Unavailable', "We couldn't resolve this vendor's storefront.");
      return;
    }
    router.push(path as any);
  }, [router, vendor]);

  const handleSearch = useCallback(() => {
    if (!vendor) return;
    if (!chatId) {
      Alert.alert('No conversation', 'There is no active conversation to search in.');
      return;
    }
    // Signal the already-mounted chat screen to open search when it regains
    // focus, then navigate back to it. This avoids remounting the chat screen
    // (which would lose loaded messages and show the empty state).
    signalChatSearchActivation(vendor.id);
    router.back();
  }, [router, vendor, chatId]);

  const handleShare = useCallback(async () => {
    if (!vendor) return;
    try {
      await Share.share({
        message: `Check out ${vendor.name} on the platform${vendor.username ? ` — @${vendor.username}` : ''}`,
      });
    } catch (err) {
      console.log('[VendorChatInfo] share failed:', err);
    }
  }, [vendor]);

  const handleFavorite = useCallback(() => {
    if (!vendor) return;
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, speed: 40, bounciness: 10 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
    toggleFavorite(vendor.id);
  }, [vendor, toggleFavorite, heartScale]);

  const handleViewOrders = useCallback(() => {
    if (!vendor) return;
    router.push({
      pathname: '/orders' as any,
      params: { vendorId: vendor.id, vendorName: vendor.name },
    });
  }, [router, vendor]);

  const handleConfirm = useCallback(() => {
    if (!vendor) {
      setConfirm(null);
      return;
    }
    if (confirm === 'block') {
      blockUser({
        id: `vendor-${vendor.id}`,
        name: vendor.name,
        role: 'vendor',
        chatId: chatId || `vendor-${vendor.id}`,
        blockedAt: new Date().toISOString(),
      });
    } else if (confirm === 'clear') {
      if (chatId) {
        try {
          chatService.clearLocalMessages(chatId);
        } catch (err) {
          console.log('[VendorChatInfo] clear local messages failed:', err);
        }
      }
      setChatCleared(true);
    }
    setConfirm(null);
  }, [confirm, vendor, chatId, blockUser]);

  if (!vendor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
          <View style={styles.fallbackHeader}>
            <TouchableOpacity onPress={handleBack} style={styles.fallbackBackBtn} hitSlop={10}>
              <ChevronLeft size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.fallbackHeaderTitle}>Vendor</Text>
            <View style={styles.fallbackBackBtn} />
          </View>
          <View style={styles.missingState}>
            <Text style={styles.missingTitle}>Vendor unavailable</Text>
            <Text style={styles.missingText}>
              We couldn't load this vendor's details. Please go back and try again.
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  const vendorColor = getStableColor(vendor.name);
  const initials = getInitials(vendor.name);
  const handle = vendor.username ? `@${vendor.username}` : `@${vendor.id.toLowerCase()}`;

  const confirmConfig = (() => {
    if (confirm === 'block') {
      return {
        title: `Block ${vendor.name}?`,
        message: 'You will stop receiving messages from this vendor. Existing orders and receipts remain accessible.',
        cta: 'Block vendor',
        destructive: true,
      };
    }
    if (confirm === 'clear') {
      return {
        title: 'Clear chat?',
        message: 'This removes messages from your view only. Orders and transaction history will still remain available.',
        cta: 'Clear',
        destructive: true,
      };
    }
    return null;
  })();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Banner + back button */}
          <View style={styles.bannerWrap}>
            {vendor.bannerImage ? (
              <Image
                source={{ uri: vendor.bannerImage }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: vendorColor }]} />
            )}
            <View style={styles.bannerScrim} />
            <SafeAreaView edges={['top']} style={styles.bannerTopBar} pointerEvents="box-none">
              <TouchableOpacity
                onPress={handleBack}
                style={styles.bannerBackBtn}
                hitSlop={10}
                accessibilityLabel="Back"
              >
                <ChevronLeft size={20} color="#FFFFFF" />
              </TouchableOpacity>
              {/* Save button — top-right corner of banner */}
              <TouchableOpacity
                onPress={handleFavorite}
                style={styles.bannerBackBtn}
                hitSlop={10}
                accessibilityLabel={favorited ? 'Remove from saved' : 'Save vendor'}
              >
                <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                  <Heart
                    size={17}
                    color={favorited ? '#FF3B30' : '#FFFFFF'}
                    fill={favorited ? '#FF3B30' : 'transparent'}
                    strokeWidth={2}
                  />
                </Animated.View>
              </TouchableOpacity>
            </SafeAreaView>
          </View>

          {/* Identity */}
          <View style={styles.identityWrap}>
            <View style={styles.logoRing}>
              {vendor.logoImage ? (
                <Image source={{ uri: vendor.logoImage }} style={styles.logoImage} contentFit="cover" />
              ) : (
                <View style={[styles.logoFallback, { backgroundColor: vendorColor }]}>
                  <Text style={styles.logoInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.vendorName} numberOfLines={1}>{vendor.name}</Text>
              {vendor.isVerified && (
                <BadgeCheck size={16} color={Colors.primary} strokeWidth={2.2} />
              )}
            </View>

            <Text style={styles.vendorHandle} numberOfLines={1}>{handle}</Text>
            <Text style={styles.vendorCategory} numberOfLines={1}>{vendor.category}</Text>
          </View>

          {/* Quick actions — compact WhatsApp-style chips */}
          <View style={styles.quickRow}>
            <QuickAction
              icon={<Store size={16} color={Colors.textSecondary} strokeWidth={1.8} />}
              label="Storefront"
              onPress={handleViewStorefront}
            />
            <QuickAction
              icon={<Search size={16} color={Colors.textSecondary} strokeWidth={1.8} />}
              label="Search"
              onPress={handleSearch}
            />
            <QuickAction
              icon={<Share2 size={16} color={Colors.textSecondary} strokeWidth={1.8} />}
              label="Share"
              onPress={handleShare}
            />
          </View>

          {/* Relationship section */}
          <View style={styles.section}>
            <SectionRow
              icon={<ShoppingBag size={18} color={Colors.textSecondary} strokeWidth={1.8} />}
              label="Orders"
              sublabel={`With ${vendor.name}`}
              onPress={handleViewOrders}
            />
            <SectionRow
              icon={<ImageIcon size={18} color={Colors.textMuted} strokeWidth={1.8} />}
              label="Media & Docs"
              sublabel="Coming soon"
              disabled
              last
            />
          </View>

          {/* Safety section — text-only rows, no icons */}
          <Text style={styles.sectionLabel}>Safety</Text>
          <View style={styles.section}>
            <SafetyRow
              label="Report vendor"
              onPress={() => {
                if (!vendor) return;
                router.push({
                  pathname: '/report-vendor' as any,
                  params: { vendorId: vendor.id, vendorName: vendor.name },
                });
              }}
            />
            <SafetyRow
              label="Block vendor"
              destructive
              onPress={() => setConfirm('block')}
            />
            <SafetyRow
              label="Clear chat"
              destructive
              onPress={() => setConfirm('clear')}
              last
            />
          </View>

          {chatCleared && (
            <View style={styles.toast}>
              <Text style={styles.toastText}>Chat history cleared from your view.</Text>
            </View>
          )}

          <Text style={styles.footerNote}>
            Orders, receipts and payment history remain available even after clearing chat.
          </Text>
        </ScrollView>

        {/* Confirm Modal */}
        <Modal
          visible={!!confirmConfig}
          transparent
          animationType="fade"
          onRequestClose={() => setConfirm(null)}
        >
          <Pressable style={styles.modalScrim} onPress={() => setConfirm(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <Text style={styles.modalTitle}>{confirmConfig?.title}</Text>
              <Text style={styles.modalBody}>{confirmConfig?.message}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalBtnCancel]}
                  onPress={() => setConfirm(null)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalBtn,
                    confirmConfig?.destructive ? styles.modalBtnDestructive : styles.modalBtnPrimary,
                  ]}
                  onPress={handleConfirm}
                >
                  <Text style={styles.modalActionText}>{confirmConfig?.cta}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onPress,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.quickAction, active && styles.quickActionActive]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={styles.quickActionIconWrap}>{icon}</View>
      <Text style={[styles.quickActionLabel, active && styles.quickActionLabelActive]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SectionRow({
  icon,
  label,
  sublabel,
  onPress,
  disabled,
  last,
}: {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.sectionRow, !last && styles.sectionRowDivider, disabled && styles.rowDisabled]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.65}
      disabled={disabled || !onPress}
    >
      <View style={styles.sectionRowIcon}>{icon}</View>
      <View style={styles.sectionRowText}>
        <Text style={[styles.sectionRowLabel, disabled && styles.sectionRowLabelMuted]}>{label}</Text>
        {sublabel && <Text style={styles.sectionRowSublabel}>{sublabel}</Text>}
      </View>
      {!disabled && onPress && <ChevronRight size={16} color={Colors.textMuted} strokeWidth={1.8} />}
    </TouchableOpacity>
  );
}

function SafetyRow({
  label,
  onPress,
  destructive,
  last,
}: {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.safetyRow, !last && styles.sectionRowDivider]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <Text style={[styles.safetyRowLabel, destructive && styles.safetyRowLabelDestructive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BANNER_H = 152;
const LOGO_SIZE = 76;

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 48,
  },

  // Banner
  bannerWrap: {
    width: '100%' as const,
    height: BANNER_H,
    backgroundColor: Colors.border,
    overflow: 'hidden' as const,
  },
  bannerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  bannerTopBar: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
  },
  bannerBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Identity
  identityWrap: {
    alignItems: 'center' as const,
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  logoRing: {
    width: LOGO_SIZE + 4,
    height: LOGO_SIZE + 4,
    borderRadius: (LOGO_SIZE + 4) / 2,
    backgroundColor: Colors.background,
    marginTop: -(LOGO_SIZE / 2 + 2),
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoImage: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
  },
  logoFallback: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  logoInitials: {
    fontSize: 26,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  nameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 12,
    maxWidth: '100%' as const,
  },
  vendorName: {
    fontSize: 19,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    letterSpacing: -0.2,
  },
  vendorHandle: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  vendorCategory: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  // Quick actions
  quickRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 10,
  },
  quickAction: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  quickActionActive: {
    backgroundColor: 'rgba(255,59,48,0.07)',
  },
  quickActionIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  quickActionLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  quickActionLabelActive: {
    color: '#FF3B30',
  },

  // Section container
  section: {
    marginHorizontal: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.7,
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
  },

  // Section rows (with icon)
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 11,
  },
  sectionRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sectionRowIcon: {
    width: 28,
    height: 28,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionRowText: {
    flex: 1,
  },
  sectionRowLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  sectionRowLabelMuted: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  sectionRowSublabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rowDisabled: {
    opacity: 0.55,
  },

  // Safety rows (text-only, no icons)
  safetyRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  safetyRowLabel: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
  safetyRowLabelDestructive: {
    color: Colors.error,
  },

  // Toast
  toast: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: Colors.successLight,
  },
  toastText: {
    fontSize: 13,
    color: Colors.success,
    fontWeight: '400' as const,
  },

  // Footer note
  footerNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 16,
    paddingHorizontal: 28,
    marginTop: 14,
  },

  // Modal
  modalScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 28,
  },
  modalCard: {
    width: '100%' as const,
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalBtnCancel: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  modalBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  modalBtnDestructive: {
    backgroundColor: Colors.error,
  },
  modalActionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },

  // Fallback (missing vendor) header
  fallbackHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  fallbackBackBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  fallbackHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  missingState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  missingTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  missingText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
});
