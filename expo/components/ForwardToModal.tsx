import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search, Check, Send, Package } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useInbox } from '@/contexts/InboxContext';
import { chatService } from '@/services/chatService';
import { InboxSnapshot } from '@/mocks/inboxData';
import type { CatalogItemData } from '@/mocks/chatData';

// ─── Forward Payload Types ───────────────────────────────────────────────────

export interface CatalogItemForwardPayload {
  type: 'catalog_item';
  itemId: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  stockLabel?: string;
}

// Extendable: add | InvoiceForwardPayload | ReceiptForwardPayload etc.
export type ForwardPayload = CatalogItemForwardPayload;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ForwardToModalProps {
  visible: boolean;
  payload: ForwardPayload | null;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const AVATAR_COLORS = [
  '#F97316', '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#3B82F6', '#EC4899', '#14B8A6', '#84CC16',
];

const getAvatarColor = (key: string): string => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getBadgeLabel = (item: InboxSnapshot): string => {
  if (item.conversationType === 'order') return 'Order';
  if (item.conversationType === 'custom_order') return 'Custom';
  return 'Inquiry';
};

// Searchable keywords for a conversation's type (e.g. "order", "custom", "inquiry").
const getTypeKeywords = (item: InboxSnapshot): string => {
  if (item.conversationType === 'order') return 'order';
  if (item.conversationType === 'custom_order') return 'custom order custom_order';
  return 'inquiry pre-order pre_order_inquiry';
};

const getBadgeStyle = (item: InboxSnapshot) => {
  if (item.conversationType === 'order') return { bg: '#EFF6FF', text: '#3B82F6' };
  if (item.conversationType === 'custom_order') return { bg: Colors.primarySoft, text: Colors.primary };
  return { bg: '#F3F4F6', text: Colors.textSecondary };
};

// ─── Chat Row ─────────────────────────────────────────────────────────────────

interface ChatRowProps {
  item: InboxSnapshot;
  selected: boolean;
  onToggle: (id: string) => void;
}

const ChatRow = React.memo(({ item, selected, onToggle }: ChatRowProps) => {
  const displayName = formatName(item.title);
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(item.customerId ?? displayName);
  const badge = getBadgeStyle(item);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
    onToggle(item.conversationId);
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[styles.chatRow, selected && styles.chatRowSelected]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        {/* Info */}
        <View style={styles.chatInfo}>
          <View style={styles.chatNameRow}>
            <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
            <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.typeBadgeText, { color: badge.text }]}>
                {getBadgeLabel(item)}
              </Text>
            </View>
          </View>
          <Text style={styles.chatPreview} numberOfLines={1}>
            {item.lastMessageText || 'No messages yet'}
          </Text>
        </View>

        {/* Selection circle */}
        <View style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}>
          {selected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ForwardToModal({ visible, payload, onClose }: ForwardToModalProps) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const slideAnim = useRef(new Animated.Value(600)).current;
  const searchRef = useRef<TextInput>(null);

  const { getFilteredVendorInbox } = useInbox();

  // Animate in/out
  useEffect(() => {
    if (visible) {
      setQuery('');
      setSelectedIds(new Set());
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 68,
        friction: 11,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 600,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const allChats = useMemo(() => {
    return getFilteredVendorInbox('all').filter(item => !!item.chatId);
  }, [getFilteredVendorInbox]);

  const filteredChats = useMemo(() => {
    if (!query.trim()) return allChats;
    const q = query.toLowerCase();
    return allChats.filter(item =>
      (item.title ?? '').toLowerCase().includes(q) ||
      (item.lastMessageText ?? '').toLowerCase().includes(q) ||
      (item.publicOrderId ?? '').toLowerCase().includes(q) ||
      (item.customerPublicId ?? '').toLowerCase().includes(q) ||
      getTypeKeywords(item).includes(q)
    );
  }, [allChats, query]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const buildMessage = (p: ForwardPayload) => {
    if (p.type === 'catalog_item') {
      const catalogItemData: CatalogItemData = {
        id: p.itemId,
        name: p.name,
        price: p.price,
        image: p.image,
        description: p.stockLabel,
      };
      return {
        type: 'catalog_item' as const,
        content: p.name,
        sender: 'vendor' as const,
        catalogItemData,
      };
    }
    // Future payload types handled here
    return null;
  };

  const handleSend = async () => {
    if (!payload || selectedIds.size === 0 || sending) return;
    setSending(true);

    const msg = buildMessage(payload);
    if (!msg) {
      setSending(false);
      return;
    }

    const targets = allChats.filter(c => selectedIds.has(c.conversationId) && c.chatId);

    await Promise.all(
      targets.map(chat =>
        chatService.sendMessage({
          chatId: chat.chatId!,
          ...msg,
        })
      )
    );

    setSending(false);
    onClose();

    const count = targets.length;
    Alert.alert(
      'Forwarded',
      count === 1
        ? `${payload.type === 'catalog_item' ? payload.name : 'Item'} sent to ${formatName(targets[0].title)}.`
        : `Forwarded to ${count} conversations.`,
      [{ text: 'OK' }]
    );
  };

  const selectedCount = selectedIds.size;

  const renderItem = useCallback(({ item }: { item: InboxSnapshot }) => (
    <ChatRow
      item={item}
      selected={selectedIds.has(item.conversationId)}
      onToggle={toggleSelect}
    />
  ), [selectedIds, toggleSelect]);

  const keyExtractor = useCallback((item: InboxSnapshot) => item.conversationId, []);

  if (!visible && (slideAnim as unknown as { __getValue: () => number }).__getValue() >= 600) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop — isolated from keyboard avoidance so it never fires on keyboard open */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Sheet container — pointerEvents="box-none" passes touches outside the sheet to the backdrop */}
      <View style={styles.sheetOuter} pointerEvents="box-none">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 12 },
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.headerBtn}
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <X size={18} color={Colors.text} strokeWidth={2.5} />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Forward To</Text>

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  selectedCount > 0 && !sending && styles.sendBtnActive,
                ]}
                onPress={handleSend}
                activeOpacity={0.8}
                disabled={selectedCount === 0 || sending}
              >
                {selectedCount > 0 ? (
                  <>
                    <Send size={14} color="#FFFFFF" strokeWidth={2.5} />
                    <Text style={styles.sendBtnText}>
                      Send{selectedCount > 1 ? ` (${selectedCount})` : ''}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.sendBtnText, styles.sendBtnTextDim]}>Send</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Payload preview pill */}
            {payload?.type === 'catalog_item' && (
              <View style={styles.payloadPreview}>
                <View style={styles.payloadIconWrap}>
                  <Package size={14} color={Colors.primary} strokeWidth={2} />
                </View>
                <Text style={styles.payloadName} numberOfLines={1}>{payload.name}</Text>
                {payload.stockLabel && (
                  <Text style={styles.payloadStock}>{payload.stockLabel}</Text>
                )}
              </View>
            )}

            {/* Search */}
            <View style={styles.searchWrap}>
              <Search size={15} color={Colors.textMuted} strokeWidth={2} />
              <TextInput
                ref={searchRef}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search customers or chats…"
                placeholderTextColor={Colors.inputPlaceholder}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={Colors.textMuted} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>
                {query.trim() ? `${filteredChats.length} result${filteredChats.length !== 1 ? 's' : ''}` : 'Conversations'}
              </Text>
              {selectedCount > 0 && (
                <Text style={styles.selectedCount}>{selectedCount} selected</Text>
              )}
            </View>

            {/* Chat list */}
            <FlatList
              data={filteredChats}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              style={styles.list}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No conversations found</Text>
                  <Text style={styles.emptySubtitle}>Try a different search term</Text>
                </View>
              }
            />
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,12,15,0.46)',
  },
  sheetOuter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '82%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 24,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderDark,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceMuted,
    justifyContent: 'center',
    minWidth: 60,
  },
  sendBtnActive: {
    backgroundColor: Colors.primary,
  },
  sendBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  sendBtnTextDim: {
    color: Colors.textMuted,
  },
  payloadPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.primarySofter,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,122,40,0.14)',
  },
  payloadIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payloadName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.1,
  },
  payloadStock: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    paddingVertical: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  selectedCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: -0.1,
  },
  list: {
    flex: 1,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
    borderRadius: 0,
  },
  chatRowSelected: {
    backgroundColor: Colors.primarySofter,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  chatInfo: {
    flex: 1,
    gap: 3,
  },
  chatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  chatName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  typeBadge: {
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chatPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  selectionCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  selectionCircleSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
