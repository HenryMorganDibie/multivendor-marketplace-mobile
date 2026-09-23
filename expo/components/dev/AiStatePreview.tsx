/**
 * DEVELOPMENT-ONLY — Platform AI state preview tool.
 *
 * Purpose: lets designers/QA visually preview every customer-facing Platform AI
 * state (eligible, empty, loading/typing, product recommendation, customer
 * quota reached, vendor quota reached, basic plan no-AI) from a single screen,
 * without having to manipulate mock data or wait for quota counters to fill.
 *
 * Isolation guarantees:
 *  - Visible ONLY when `__DEV__` is true. The whole file is dead code in
 *    production builds; Metro/Expo tree-shakes anything that isn't imported
 *    from a production-reachable path, and the sole entry point is the
 *    `__DEV__`-gated button in `app/chat/ai/[vendorId].tsx`.
 *  - Uses LOCAL React state only. It does NOT call `useCustomerAiUsage`,
 *    `recordReply`, `useVendorMenu`, or AsyncStorage. The real mock quota
 *    counters are never touched.
 *  - All preview data is inline below; no shared contexts are mutated.
 *
 * Henry (backend integration): delete this file and remove the single
 * `__DEV__` import + render block in `app/chat/ai/[vendorId].tsx`. There are
 * no other references. Safe to remove at any time — it carries no business
 * logic.
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, Stack } from 'expo-router';
import {
  ChevronLeft,
  Send,
  Sparkles,
  MessageCircle,
  Store,
  Lock,
  Beaker,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { formatPrice } from '@/utils/formatPrice';
import type { Currency } from '@/utils/formatPrice';
import { CUSTOMER_AI_MONTHLY_LIMIT } from '@/utils/platformAiLimits';

/* ------------------------------------------------------------------ */
/* Preview state enum                                                  */
/* ------------------------------------------------------------------ */

export type AiPreviewState =
  | 'eligible'
  | 'empty'
  | 'loading'
  | 'recommendation'
  | 'customer_quota'
  | 'vendor_quota'
  | 'basic_plan';

const PREVIEW_STATES: { id: AiPreviewState; label: string; hint: string }[] = [
  { id: 'eligible', label: 'Eligible AI', hint: 'Chat with input enabled' },
  { id: 'empty', label: 'Empty state', hint: 'Greeting + hint card' },
  { id: 'loading', label: 'Loading / typing', hint: 'Typing dots' },
  { id: 'recommendation', label: 'Product cards', hint: 'Vendor-grounded items' },
  { id: 'customer_quota', label: 'Customer quota reached', hint: '5/5 used' },
  { id: 'vendor_quota', label: 'Vendor quota reached', hint: 'Vendor limit hit' },
  { id: 'basic_plan', label: 'Basic plan · no AI', hint: 'Entry hidden' },
];

const PREVIEW_VENDOR = {
  id: 'preview-vendor',
  name: 'Preview Bistro',
  currency: 'NGN' as Currency,
};

const PREVIEW_ITEMS = [
  {
    id: 'preview-item-1',
    name: 'Jollof Rice Bowl',
    description: 'Smoky party-style jollof with chicken',
    price: 2500,
    image: undefined as string | undefined,
  },
  {
    id: 'preview-item-2',
    name: 'Grilled Tilapia',
    description: 'Charcoal-grilled with pepper sauce',
    price: 4200,
    salePrice: 3800,
    image: undefined as string | undefined,
  },
  {
    id: 'preview-item-3',
    name: 'Plantain Platter',
    description: 'Crispy dodo with spicy garnish',
    price: 1500,
    image: undefined as string | undefined,
  },
];

/* ------------------------------------------------------------------ */
/* Sub-renderers — mirror the real AI screen's visual language          */
/* ------------------------------------------------------------------ */

const AI_BUBBLE_BG = '#FFF4EC';
const AI_BUBBLE_BORDER = 'rgba(255, 122, 40, 0.22)';
const AI_HEADER_TINT = '#FFF6EF';
const AI_CANVAS = '#FBF6F1';

function AiHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerAiAvatar}>
        <Sparkles size={16} color={Colors.white} />
      </View>
      <View style={styles.headerCenter}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.chatName}>{title}</Text>
          <View style={styles.headerAiPill}>
            <Sparkles size={9} color={Colors.primary} />
            <Text style={styles.headerAiPillText}>AI Assistant</Text>
          </View>
        </View>
        <Text style={styles.chatInfo} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function AiContextBanner({ vendorName }: { vendorName: string }) {
  return (
    <View style={styles.aiContextBanner}>
      <Sparkles size={11} color={Colors.primary} />
      <Text style={styles.aiContextBannerText}>
        AI assistant for {vendorName}. Recommendations are based on this
        vendor's storefront. Confirm availability and custom requests directly
        with the vendor.
      </Text>
    </View>
  );
}

function AiAvatarCircle() {
  return (
    <View style={styles.aiAvatarCircle}>
      <Sparkles size={12} color={Colors.white} />
    </View>
  );
}

function AiLabelRow() {
  return (
    <View style={styles.aiLabelRow}>
      <Text style={styles.aiLabel}>Platform AI</Text>
      <View style={styles.aiLabelPill}>
        <Text style={styles.aiLabelPillText}>AI</Text>
      </View>
    </View>
  );
}

function AiBubble({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.messageBubble, styles.aiBubble]}>
      <Text style={styles.messageText}>{children}</Text>
    </View>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <View style={[styles.messageBubble, styles.userBubble]}>
      <Text style={[styles.messageText, styles.userMessageText]}>{children}</Text>
    </View>
  );
}

function TypingBubble() {
  return (
    <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
      <View style={styles.typingDot} />
      <View style={[styles.typingDot, styles.typingDotMid]} />
      <View style={[styles.typingDot, styles.typingDotLate]} />
    </View>
  );
}

function ItemCard({
  item,
  currency,
}: {
  item: (typeof PREVIEW_ITEMS)[number];
  currency: Currency;
}) {
  const effectivePrice = item.salePrice ?? item.price;
  const hasDiscount = item.salePrice != null && item.salePrice < item.price;
  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardContent}>
        <View style={styles.itemImageContainer}>
          {item.image ? (
            <Image
              source={{ uri: item.image }}
              style={styles.itemImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.itemImagePlaceholder}>
              <Text style={styles.itemImagePlaceholderText}>📦</Text>
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>
            {item.name}
          </Text>
          {item.description ? (
            <Text style={styles.itemDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.priceRow}>
            {hasDiscount && (
              <Text style={styles.itemPriceOriginal}>
                {formatPrice(item.price, currency)}
              </Text>
            )}
            <Text style={styles.itemPrice}>
              {formatPrice(effectivePrice, currency)}
            </Text>
          </View>
        </View>
        <View style={styles.viewButton}>
          <Text style={styles.viewButtonText}>View</Text>
        </View>
      </View>
    </View>
  );
}

function QuotaBanner({
  title,
  message,
  actions,
}: {
  title: string;
  message: string;
  actions: { label: string; primary: boolean; icon: React.ReactNode }[];
}) {
  return (
    <View style={styles.quotaBanner}>
      <View style={styles.quotaBannerIcon}>
        <Sparkles size={18} color={Colors.textMuted} />
      </View>
      <View style={styles.quotaBannerBody}>
        <Text style={styles.quotaBannerTitle}>{title}</Text>
        <Text style={styles.quotaBannerMessage}>{message}</Text>
        <View style={styles.quotaBannerActions}>
          {actions.map((a) => (
            <View
              key={a.label}
              style={a.primary ? styles.quotaActionPrimary : styles.quotaActionSecondary}
            >
              {a.icon}
              <Text
                style={a.primary ? styles.quotaActionPrimaryText : styles.quotaActionSecondaryText}
              >
                {a.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function ComposerPreview({ disabled }: { disabled: boolean }) {
  return (
    <View style={styles.inputContainer}>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        placeholder={disabled ? 'AI unavailable' : `Ask ${PREVIEW_VENDOR.name}…`}
        placeholderTextColor={Colors.inputPlaceholder}
        editable={!disabled}
        multiline
      />
      <View style={[styles.sendButton, disabled && styles.sendButtonDisabled]}>
        <Send size={17} color={Colors.white} />
      </View>
    </View>
  );
}

function QuotaFooter({ remaining }: { remaining: number }) {
  return (
    <View style={styles.quotaFooter}>
      <Sparkles size={10} color={Colors.primary} />
      <Text style={styles.quotaFooterText}>
        {remaining} of {CUSTOMER_AI_MONTHLY_LIMIT} AI replies left this month
      </Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Main preview screen                                                  */
/* ------------------------------------------------------------------ */

export default function AiStatePreview() {
  const router = useRouter();
  const [selected, setSelected] = useState<AiPreviewState>('eligible');

  const currency = PREVIEW_VENDOR.currency;

  const content = useMemo(() => {
    switch (selected) {
      case 'eligible':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <AiBubble>
                    Hi 👋 Welcome to Preview Bistro. I can help you explore the menu and explain how to order.
                  </AiBubble>
                </View>
              </View>
              <View style={[styles.messageBubbleContainer, styles.userMessageContainer]}>
                <View style={styles.messageContentWrapper}>
                  <UserBubble>What do you recommend?</UserBubble>
                </View>
              </View>
            </>
          ),
          footer: (
            <>
              <ComposerPreview disabled={false} />
              <QuotaFooter remaining={4} />
            </>
          ),
        };
      case 'empty':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <AiBubble>
                    Hi 👋 Welcome to Preview Bistro. I'm the Platform AI assistant for this store.
                  </AiBubble>
                </View>
              </View>
              <View style={styles.emptyHintCard}>
                <View style={styles.emptyHintIconWrap}>
                  <Sparkles size={18} color={Colors.primary} />
                </View>
                <Text style={styles.emptyHintTitle}>Ask me anything about Preview Bistro</Text>
                <Text style={styles.emptyHintMessage}>
                  I can help you explore the catalog, explain policies, or guide you to place an order.
                </Text>
              </View>
            </>
          ),
          footer: (
            <>
              <ComposerPreview disabled={false} />
              <QuotaFooter remaining={5} />
            </>
          ),
        };
      case 'loading':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={[styles.messageBubbleContainer, styles.userMessageContainer]}>
                <View style={styles.messageContentWrapper}>
                  <UserBubble>Most popular items?</UserBubble>
                </View>
              </View>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <TypingBubble />
                </View>
              </View>
            </>
          ),
          footer: (
            <>
              <ComposerPreview disabled={false} />
              <QuotaFooter remaining={3} />
            </>
          ),
        };
      case 'recommendation':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={[styles.messageBubbleContainer, styles.userMessageContainer]}>
                <View style={styles.messageContentWrapper}>
                  <UserBubble>What's on the menu?</UserBubble>
                </View>
              </View>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <AiBubble>Here are a few favourites from Preview Bistro:</AiBubble>
                  <View style={styles.itemsContainer}>
                    {PREVIEW_ITEMS.map((item) => (
                      <ItemCard key={item.id} item={item} currency={currency} />
                    ))}
                  </View>
                </View>
              </View>
            </>
          ),
          footer: (
            <>
              <ComposerPreview disabled={false} />
              <QuotaFooter remaining={3} />
            </>
          ),
        };
      case 'customer_quota':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <AiBubble>
                    Here are a few favourites from Preview Bistro:
                  </AiBubble>
                </View>
              </View>
            </>
          ),
          footer: (
            <QuotaBanner
              title={`You've reached your Platform AI limit for ${PREVIEW_VENDOR.name} this month.`}
              message="You can still browse the storefront or message the vendor directly."
              actions={[
                {
                  label: 'View Storefront',
                  primary: true,
                  icon: <Store size={14} color={Colors.primary} />,
                },
                {
                  label: 'Message Vendor',
                  primary: false,
                  icon: <MessageCircle size={14} color={Colors.textSecondary} />,
                },
              ]}
            />
          ),
        };
      case 'vendor_quota':
        return {
          banner: <AiContextBanner vendorName={PREVIEW_VENDOR.name} />,
          body: (
            <>
              <View style={styles.messageBubbleContainer}>
                <AiAvatarCircle />
                <View style={styles.messageContentWrapper}>
                  <AiLabelRow />
                  <AiBubble>Here are a few favourites from Preview Bistro:</AiBubble>
                </View>
              </View>
            </>
          ),
          footer: (
            <QuotaBanner
              title="Platform AI is unavailable right now."
              message="This vendor has reached their monthly AI reply limit. You can still message the vendor directly."
              actions={[
                {
                  label: 'Message Vendor',
                  primary: true,
                  icon: <MessageCircle size={14} color={Colors.white} />,
                },
              ]}
            />
          ),
        };
      case 'basic_plan':
        return {
          banner: null,
          body: (
            <View style={styles.gatingWrap}>
              <View style={styles.gatingIconWrap}>
                <Sparkles size={26} color={Colors.textMuted} />
              </View>
              <Text style={styles.gatingTitle}>Platform AI isn't available for this store.</Text>
              <Text style={styles.gatingMessage}>
                {PREVIEW_VENDOR.name} hasn't enabled Platform AI. You can still browse the storefront or message them directly.
              </Text>
              <View style={styles.gatingActions}>
                <View style={styles.gatingPrimaryBtn}>
                  <Store size={16} color={Colors.white} />
                  <Text style={styles.gatingPrimaryText}>View Storefront</Text>
                </View>
                <View style={styles.gatingSecondaryBtn}>
                  <MessageCircle size={16} color={Colors.primary} />
                  <Text style={styles.gatingSecondaryText}>Message Vendor</Text>
                </View>
              </View>
            </View>
          ),
          footer: null,
        };
    }
  }, [selected, currency]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.devBadgeIcon}>
            <Beaker size={15} color={Colors.primary} />
          </View>
          <View style={styles.headerCenter}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.chatName}>AI State Preview</Text>
              <View style={styles.devPill}>
                <Text style={styles.devPillText}>DEV ONLY</Text>
              </View>
            </View>
            <Text style={styles.chatInfo}>Development tool · not in production</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* State selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.selectorScroll}
          contentContainerStyle={styles.selectorContent}
        >
          {PREVIEW_STATES.map((s) => {
            const active = s.id === selected;
            return (
              <TouchableOpacity
                key={s.id}
                style={[styles.selectorChip, active && styles.selectorChipActive]}
                onPress={() => setSelected(s.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.selectorChipText, active && styles.selectorChipTextActive]}>
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.selectorHint}>
          {PREVIEW_STATES.find((s) => s.id === selected)?.hint}
        </Text>
      </SafeAreaView>

      {/* Preview viewport — mimics the real AI screen */}
      <View style={styles.previewWrap}>
        {content.banner}
        <ScrollView
          style={styles.previewBody}
          contentContainerStyle={styles.previewBodyContent}
          showsVerticalScrollIndicator={false}
        >
          {content.body}
        </ScrollView>
        {content.footer ? (
          <View style={styles.previewFooter}>{content.footer}</View>
        ) : null}
      </View>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Styles                                                               */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  safeArea: { backgroundColor: AI_HEADER_TINT },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AI_HEADER_TINT,
  },
  headerAiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
    flexShrink: 0,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  devBadgeIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
    flexShrink: 0,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
  },
  headerCenter: { flex: 1, minWidth: 0 },
  headerTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 1,
  },
  chatInfo: { fontSize: 12, color: Colors.textSecondary },
  headerAiPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: Colors.primaryTint,
    borderRadius: 10,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
  },
  headerAiPillText: {
    fontSize: 9.5,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  devPill: {
    backgroundColor: Colors.errorLight,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  devPillText: {
    fontSize: 8.5,
    fontWeight: '700' as const,
    color: Colors.error,
    letterSpacing: 0.5,
  },
  headerSpacer: { width: 38 },

  selectorScroll: {
    backgroundColor: AI_HEADER_TINT,
    maxHeight: 48,
  },
  selectorContent: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 8,
  },
  selectorChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  selectorChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectorChipText: {
    fontSize: 12.5,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  selectorChipTextActive: {
    color: Colors.white,
    fontWeight: '700' as const,
  },
  selectorHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    paddingHorizontal: 14,
    paddingBottom: 8,
    backgroundColor: AI_HEADER_TINT,
  },

  previewWrap: { flex: 1, backgroundColor: AI_CANVAS },
  previewBody: { flex: 1, backgroundColor: AI_CANVAS },
  previewBodyContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 2,
  },
  previewFooter: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: AI_BUBBLE_BORDER,
  },

  aiContextBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: AI_BUBBLE_BORDER,
  },
  aiContextBannerText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 14.5,
  },

  messageBubbleContainer: {
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
  },
  userMessageContainer: { flexDirection: 'row-reverse' as const },
  aiAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 15,
    flexShrink: 0,
  },
  messageContentWrapper: { flex: 1, gap: 4 },
  aiLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginLeft: 2,
    marginBottom: 2,
  },
  aiLabel: {
    fontSize: 10.5,
    fontWeight: '600' as const,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  aiLabelPill: {
    backgroundColor: Colors.primaryTint,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
  },
  aiLabelPillText: {
    fontSize: 8.5,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 5,
    alignSelf: 'flex-end' as const,
  },
  aiBubble: {
    backgroundColor: AI_BUBBLE_BG,
    borderBottomLeftRadius: 5,
    alignSelf: 'flex-start' as const,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
  },
  messageText: {
    fontSize: 14.5,
    color: Colors.text,
    lineHeight: 20,
  },
  userMessageText: { color: Colors.white },

  typingBubble: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    opacity: 0.4,
  },
  typingDotMid: { opacity: 0.65 },
  typingDotLate: { opacity: 0.9 },

  emptyHintCard: {
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
    padding: 18,
    marginTop: 14,
    gap: 8,
  },
  emptyHintIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primaryTint,
  },
  emptyHintTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  emptyHintMessage: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 17,
  },

  itemsContainer: { gap: 7, marginTop: 2 },
  itemCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden' as const,
    maxWidth: 300,
  },
  itemCardContent: {
    flexDirection: 'row' as const,
    padding: 10,
    gap: 10,
    alignItems: 'center' as const,
  },
  itemImageContainer: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden' as const,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  itemImage: { width: '100%' as const, height: '100%' as const },
  itemImagePlaceholder: {
    width: '100%' as const,
    height: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  itemImagePlaceholderText: { fontSize: 22 },
  itemInfo: { flex: 1, gap: 2, minWidth: 0 },
  itemName: {
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 17,
  },
  itemDescription: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 15,
  },
  priceRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 1,
  },
  itemPrice: {
    fontSize: 13.5,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  itemPriceOriginal: {
    fontSize: 11,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  viewButton: {
    backgroundColor: Colors.primaryTint,
    borderRadius: 16,
    paddingVertical: 7,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  viewButtonText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
  },

  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.background,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: Platform.OS === 'ios' ? 9 : 8,
    fontSize: 15,
    color: Colors.text,
    minHeight: 40,
    maxHeight: 96,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputDisabled: {
    backgroundColor: Colors.disabled,
    color: Colors.disabledText,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.7,
  },

  quotaFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: AI_HEADER_TINT,
    borderTopWidth: 1,
    borderTopColor: AI_BUBBLE_BORDER,
  },
  quotaFooterText: {
    fontSize: 10.5,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },

  quotaBanner: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
  },
  quotaBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    flexShrink: 0,
  },
  quotaBannerBody: { flex: 1, gap: 6 },
  quotaBannerTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  quotaBannerMessage: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  quotaBannerActions: {
    flexDirection: 'row' as const,
    gap: 8,
    flexWrap: 'wrap' as const,
    marginTop: 4,
  },
  quotaActionPrimary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  quotaActionPrimaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  quotaActionSecondary: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    backgroundColor: Colors.background,
    borderRadius: 18,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  quotaActionSecondaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },

  gatingWrap: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 28,
    paddingBottom: 32,
    backgroundColor: AI_CANVAS,
  },
  gatingIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 18,
  },
  gatingTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
    lineHeight: 22,
  },
  gatingMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 22,
  },
  gatingActions: {
    flexDirection: 'row' as const,
    gap: 10,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
  },
  gatingPrimaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    backgroundColor: Colors.primary,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 18,
  },
  gatingPrimaryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  gatingSecondaryBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    backgroundColor: Colors.background,
    borderRadius: 22,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  gatingSecondaryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
