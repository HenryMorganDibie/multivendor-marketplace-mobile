import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  ChevronLeft,
  Send,
  Sparkles,
  MessageCircle,
  MoreVertical,
  Store,
  Lock,
} from 'lucide-react-native';
import { ChatActionMenu, ChatActionItem } from '@/components/ChatActionMenu';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { mockVendors } from '@/mocks/vendorData';
import type { Vendor, MenuItem } from '@/mocks/vendorData';
import { useVendorMenu } from '@/data/hooks';
import { useCustomerAiUsage } from '@/contexts/CustomerAiUsageContext';
import { formatPrice } from '@/utils/formatPrice';
import type { Currency } from '@/utils/formatPrice';
import {
  vendorPlanAllowsAi,
  isVendorAiQuotaExhausted,
  getVendorAiRemaining,
  resolveAiQuotaState,
  CUSTOMER_AI_MONTHLY_LIMIT,
} from '@/utils/the platformAiLimits';

const AI_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

// AI chat uses a warm cream palette (NOT the vendor chat's cool gray #E9E9EB)
// so customers always visually distinguish the platform AI replies from a real
// vendor's messages. The accent stays in the platform's orange family.
const AI_BUBBLE_BG = '#FFF4EC'; // warm cream — AI's signature surface
const AI_BUBBLE_BG_DEEPER = '#FDEFE0'; // slightly deeper for nested/tool cards
const AI_BUBBLE_BORDER = 'rgba(255, 122, 40, 0.22)';
const AI_HEADER_TINT = '#FFF6EF'; // warm header band, never used by vendor chat
const AI_CANVAS = '#FBF6F1'; // warm off-white canvas behind the messages

const SUGGESTION_PROMPTS = [
  'What do you offer?',
  'Most popular items?',
  'Anything available today?',
  'How do I place an order?',
];

/**
 * Customer-facing the platform AI chat for a specific vendor.
 *
 * Plan + quota gating:
 *  - Basic plan → unreachable (storefront hides the AI button). If a stale
 *    deep link lands here, we render a "not available" state.
 *  - Vendor monthly quota exhausted → input disabled, friendly banner,
 *    "Message Vendor" fallback.
 *  - Customer per-vendor monthly quota (5) exhausted → input disabled,
 *    friendly banner, "View Storefront" + "Message Vendor" fallbacks.
 *
 * Catalog grounding:
 *  - The AI only ever sees and recommends items from THIS vendor's actual
 *    storefront catalog (via `useVendorMenu(vendorId)`). No global mock
 *    items, no other-vendor items. The tool validates every `itemId`
 *    against the in-scope catalog before rendering a card.
 *  - Each item card links to `/item/[id]` with this vendor's id.
 */
export default function VendorAIChatScreen() {
  const router = useRouter();
  const { vendorId } = useLocalSearchParams<{ vendorId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordedReplyIdsRef = useRef<Set<string>>(new Set());

  // Resolve vendor. Fall back to a sentinel that the plan gate will catch.
  const vendor: Vendor | undefined = useMemo(
    () => mockVendors.find((v) => v.id === vendorId),
    [vendorId]
  );

  // Vendor's real storefront catalog (same hook the storefront screen uses).
  const { data: menuData, isLoading: isMenuLoading } = useVendorMenu(vendorId ?? '');
  const catalogItems: MenuItem[] = useMemo(
    () => (menuData?.items ?? []).filter((item) => {
      const moderationStatus = (item as any)?.moderationStatus;
      return !moderationStatus || moderationStatus === 'approved';
    }),
    [menuData]
  );
  const availableItems: MenuItem[] = useMemo(
    () => catalogItems.filter((item) => item.inStock),
    [catalogItems]
  );

  // Customer per-vendor monthly AI usage.
  const {
    getUsage,
    getRemaining: getCustomerRemaining,
    isExhausted: isCustomerExhausted,
    recordReply,
    isLoading: isUsageLoading,
  } = useCustomerAiUsage();

  // Combined quota state — recomputed whenever vendor catalog, vendor, or
  // customer usage changes. `available` is the only state that allows
  // sending. The vendor plan gate is checked first; if it fails we render
  // the "not available" state below instead of the chat.
  const quotaState = useMemo(() => {
    if (!vendor) return { kind: 'available' as const };
    if (!vendorPlanAllowsAi(vendor)) return { kind: 'plan_blocked' as const };
    return resolveAiQuotaState(vendor, getUsage(vendor.id));
  }, [vendor, getUsage]);

  const canUseAi = vendor != null && vendorPlanAllowsAi(vendor) && quotaState.kind === 'available';

  const catalogList = useMemo(
    () =>
      availableItems
        .map(
          (item) =>
            `- ID: ${item.id} | ${item.name} (${formatPrice(item.salePrice ?? item.price, (vendor?.currency as Currency) || 'NGN')})${item.description ? `: ${item.description}` : ''}`
        )
        .join('\n'),
    [availableItems, vendor]
  );

  const systemPrompt = useMemo(() => {
    if (!vendor) return '';
    const fulfillmentOptions = [
      vendor.pickup && 'Pickup',
      vendor.delivery && 'Delivery',
      vendor.shipping && 'Shipping',
    ]
      .filter(Boolean)
      .join(', ');

    return `You are the platform AI, a virtual assistant representing ${vendor.name}.

VENDOR INFORMATION:
- Name: ${vendor.name}
- Category: ${vendor.category}
- Location: ${vendor.area}
- Rating: ${vendor.rating}/5 (${vendor.reviewCount} reviews)
- Fulfillment: ${fulfillmentOptions || 'Contact vendor for details'}
- Business Hours: ${vendor.businessHours || 'Not specified'}
- Minimum Order: ${vendor.minimumOrderAmount ? formatPrice(vendor.minimumOrderAmount, (vendor.currency as Currency) || 'NGN') : 'None'}
- Status: ${vendor.storeStatus === 'open' ? 'Currently open' : 'Currently closed'}

CATALOG (Available Items/Services — ONLY from this vendor, ${vendor.name}):
${catalogList || 'No items currently listed'}

Business Policy:
${vendor.policy || 'No policy specified'}

YOUR ROLE:
1. Help customers discover items, products, or services and answer questions about what ${vendor.name} offers
2. Explain business policies, hours, fulfillment options, and how to order
3. Show catalog items using the show_store_items tool when relevant
4. Guide customers to browse and place orders via the app UI
5. Adapt your tone and language to the vendor's actual business type — do NOT assume food

STRICT LIMITATIONS:
- DO NOT add items to cart or place orders on behalf of the customer
- DO NOT process or collect payments
- DO NOT make up or invent item IDs, names, or prices not listed in the catalog
- DO NOT reference items from any other vendor — only items in the CATALOG section above
- Always direct customers to the app UI for transactions
- Example: "To order, please add items to your cart from the storefront."

WHAT YOU CANNOT CONFIRM (escalate to the vendor instead):
- DO NOT claim an item is currently in stock or available right now — catalog
  listings are not real-time inventory. Say "based on the storefront listing"
  and tell the customer to confirm current availability with ${vendor.name}
  directly.
- DO NOT promise a specific fulfillment or delivery time, ETA, or turnaround.
  Describe the vendor's listed fulfillment options only (Pickup/Delivery/
  Shipping) and direct the customer to message ${vendor.name} for timing.
- DO NOT accept, approve, or confirm any custom request, modification, or
  special order on behalf of ${vendor.name}. Forward all custom requests to
  the vendor via the escalate_to_vendor tool or tell the customer to message
  ${vendor.name} directly.
- DO NOT state that an order has been accepted, confirmed, or scheduled. Order
  acceptance is the vendor's decision — only the vendor can confirm it.
- If a customer needs any of the above, ALWAYS route them to ${vendor.name}
  directly: "I can't confirm that — message ${vendor.name} and they'll sort it
  out for you."

ESCALATION RULE:
- If you truly cannot answer a question OR the customer explicitly asks to speak with a human or the vendor directly, use the escalate_to_vendor tool
- Do NOT escalate for routine questions — only use it when genuinely needed

CRITICAL IDENTITY RULES:
- You represent ${vendor.name}, NOT the platform the platform
- Never use "we", "our", or "us" when referring to vendor actions
- Always reference the vendor explicitly by name: "${vendor.name}"
- WRONG: "Our cancellation policy requires..." → CORRECT: "${vendor.name}'s cancellation policy requires..."
- WRONG: "We offer pickup and delivery" → CORRECT: "${vendor.name} offers pickup and delivery"

When showing catalog items:
- Use show_store_items tool to display item cards
- Only reference items from the CATALOG section above using their exact IDs
- Treat the catalog as the vendor's storefront listing, NOT a live stock
  feed. Never say an item "is in stock right now" or "is available today" —
  say it "is listed on the storefront" and offer to connect the customer to
  ${vendor.name} to confirm availability.
- Show 3–5 items at a time unless specifically requested otherwise
- NEVER generate or invent item IDs, names, or prices
- If no matching items exist in the catalog, respond with text only

Be friendly, clear, and concise. Adapt to the vendor's business type.`;
  }, [vendor, catalogList]);

  const greetingText = useMemo(
    () =>
      vendor
        ? `Hi 👋 Welcome to **${vendor.name}**.\n\nI'm the the platform AI assistant for this store. I can help answer questions, explain services, and help you explore what **${vendor.name}** offers.`
        : '',
    [vendor]
  );

  const { messages, error, sendMessage, setMessages } = useRorkAgent({
    tools: {
      show_store_items: createRorkTool({
        description: `Display catalog item or product cards from ${vendor?.name ?? 'this store'}'s store. CRITICAL: Only use item IDs that exist in THIS vendor's catalog. Never generate fake IDs. Never reference items from another vendor.`,
        zodSchema: z.object({
          items: z
            .array(
              z.object({
                itemId: z
                  .string()
                  .describe('The exact ID of the catalog item from the catalog list'),
                vendorId: z
                  .string()
                  .describe(`The vendor ID — always use "${vendor?.id ?? ''}" for this vendor`),
              })
            )
            .describe(
              'Array of catalog items to display (show 3–5 items). Each item MUST have a real itemId from the catalog.'
            ),
        }),
        execute: (args) => {
          // Hard validation against this vendor's actual in-stock catalog.
          const validItems = args.items.filter((item: { itemId: string; vendorId: string }) =>
            availableItems.some((catalogItem) => catalogItem.id === item.itemId) &&
            (!vendor || item.vendorId === vendor.id)
          );
          if (validItems.length === 0) {
            return 'No valid items found. Please only reference items that exist in this vendor catalog.';
          }
          return `Successfully displayed ${validItems.length} item(s)`;
        },
      }),
      escalate_to_vendor: createRorkTool({
        description: `Offer the customer an option to chat directly with ${vendor?.name ?? 'the vendor'} when the AI cannot answer or when the customer requests human support.`,
        zodSchema: z.object({
          reason: z
            .string()
            .describe('Brief reason why escalation is being offered')
            .optional(),
        }),
        execute: (args) => {
          console.log('[AI CHAT] Escalation triggered:', args.reason);
          return `Escalation card shown for ${vendor?.name ?? 'the vendor'}`;
        },
      }),
    },
  });

  // Seed greeting once a vendor + catalog are ready and the chat is usable.
  useEffect(() => {
    if (!vendor || !canUseAi) return;
    if (messages.length === 0) {
      setMessages([
        {
          id: 'system',
          role: 'system',
          content: systemPrompt,
          parts: [{ type: 'text', text: systemPrompt }],
        } as any,
        {
          id: 'greeting',
          role: 'assistant',
          content: greetingText,
          parts: [{ type: 'text', text: greetingText }],
        } as any,
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor?.id, canUseAi, messages.length]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // Count successful AI assistant turns toward the customer's per-vendor
  // monthly quota. We only count distinct assistant messages with text
  // content (greeting excluded) — one increment per delivered reply.
  useEffect(() => {
    if (!vendor || !canUseAi) return;
    for (const m of messages as any[]) {
      if (m.role !== 'assistant' || m.id === 'greeting' || m.id === 'system') continue;
      if (recordedReplyIdsRef.current.has(m.id)) continue;
      const hasText = Array.isArray(m.parts) && m.parts.some((p: any) => p.type === 'text' && p.text);
      if (!hasText) continue;
      recordedReplyIdsRef.current.add(m.id);
      recordReply(vendor.id);
    }
  }, [messages, vendor, canUseAi, recordReply]);

  const resetExpiryTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    expiryTimerRef.current = setTimeout(() => {
      console.log('[AI CHAT] Session expired after 30 minutes of inactivity');
      setIsSessionExpired(true);
    }, AI_SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!canUseAi) return;
    resetExpiryTimer();
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [resetExpiryTimer, canUseAi]);

  const handleStartNewSession = () => {
    console.log('[AI CHAT] Starting new session');
    setIsSessionExpired(false);
    setMessages([]);
    recordedReplyIdsRef.current.clear();
    resetExpiryTimer();
  };

  const handleSendMessage = useCallback(
    (text?: string) => {
      const content = (text ?? messageText).trim();
      if (content === '' || isSending || isSessionExpired || !canUseAi) return;
      setIsSending(true);
      resetExpiryTimer();
      sendMessage(content);
      if (!text) setMessageText('');
      setTimeout(() => setIsSending(false), 1000);
    },
    [messageText, isSending, isSessionExpired, canUseAi, resetExpiryTimer, sendMessage]
  );

  const handleViewItem = useCallback(
    (itemId: string) => {
      if (!vendor) return;
      console.log('[AI CHAT] Navigating to item:', itemId, 'vendor:', vendor.id);
      router.push({
        pathname: '/item/[id]' as any,
        params: { id: itemId, vendorId: vendor.id },
      });
    },
    [router, vendor]
  );

  const handleEscalateToVendor = useCallback(() => {
    if (!vendor) return;
    console.log('[AI CHAT] Navigating to vendor inquiry chat:', vendor.id);
    router.push(`/chat/${vendor.id}` as any);
  }, [router, vendor]);

  const handleViewStorefront = useCallback(() => {
    if (!vendor) return;
    router.push(`/store/${vendor.id}` as any);
  }, [router, vendor]);

  const handleMessageVendor = useCallback(() => {
    if (!vendor) return;
    router.push(`/chat/${vendor.id}` as any);
  }, [router, vendor]);

  /* --------------------------- gating states --------------------------- */

  if (!vendor) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerAiAvatar}>
              <Sparkles size={16} color={Colors.white} />
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.chatName}>the platform AI</Text>
              <Text style={styles.chatInfo}>Store not found</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.gatingWrap}>
          <Text style={styles.gatingTitle}>This store is not available.</Text>
        </View>
      </>
    );
  }

  // Basic plan vendor — customers can never open the platform AI for them.
  if (!vendorPlanAllowsAi(vendor)) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerAiAvatarMuted}>
              <Lock size={15} color={Colors.white} />
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.chatName}>the platform AI</Text>
              <Text style={styles.chatInfo}>{vendor.name}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.gatingWrap}>
          <View style={styles.gatingIconWrap}>
            <Sparkles size={26} color={Colors.textMuted} />
          </View>
          <Text style={styles.gatingTitle}>the platform AI isn't available for this store.</Text>
          <Text style={styles.gatingMessage}>
            {vendor.name} hasn't enabled the platform AI. You can still browse the storefront or message them directly.
          </Text>
          <View style={styles.gatingActions}>
            <TouchableOpacity
              style={styles.gatingPrimaryBtn}
              onPress={handleViewStorefront}
              activeOpacity={0.8}
            >
              <Store size={16} color={Colors.white} />
              <Text style={styles.gatingPrimaryText}>View Storefront</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.gatingSecondaryBtn}
              onPress={handleMessageVendor}
              activeOpacity={0.8}
            >
              <MessageCircle size={16} color={Colors.primary} />
              <Text style={styles.gatingSecondaryText}>Message Vendor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  /* ----------------------- loading + chat states ----------------------- */

  if (isMenuLoading || isUsageLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerAiAvatar}>
              <Sparkles size={16} color={Colors.white} />
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.chatName}>the platform AI</Text>
              <Text style={styles.chatInfo}>{vendor.name}</Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </>
    );
  }

  const showSuggestions =
    messages.length > 0 && !messages.some((m: any) => m.role === 'user');

  const renderItemCard = (itemId: string) => {
    // Hard-grounded against this vendor's in-stock catalog. Anything not in
    // `availableItems` is silently dropped — never falls back to global mock
    // items or another vendor's catalog.
    const item = availableItems.find((m) => m.id === itemId);
    if (!item) return null;
    const effectivePrice = item.salePrice ?? item.price;
    const hasDiscount =
      item.salePrice != null && item.salePrice < item.price;
    const currency: Currency = (vendor.currency as Currency) || 'NGN';
    return (
      <View key={item.id} style={styles.itemCard}>
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
          <TouchableOpacity
            style={styles.viewButton}
            onPress={() => handleViewItem(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return '';
    const date = ts instanceof Date ? ts : new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = (message: any, index: number) => {
    if (message.role === 'system') return null;
    const isUser = message.role === 'user';
    const timestamp = formatTimestamp(message.createdAt ?? message.timestamp);

    return (
      <View
        key={message.id || `msg-${index}`}
        style={[styles.messageBubbleContainer, isUser && styles.userMessageContainer]}
      >
        {!isUser && (
          <View style={styles.aiAvatarCircle}>
            <Sparkles size={12} color={Colors.white} />
          </View>
        )}
        <View style={[styles.messageContentWrapper, isUser && styles.userContentWrapper]}>
          {!isUser && (
            <View style={styles.aiLabelRow}>
              <Text style={styles.aiLabel}>the platform AI</Text>
              <View style={styles.aiLabelPill}>
                <Text style={styles.aiLabelPillText}>AI</Text>
              </View>
            </View>
          )}
          {message.parts?.map((part: any, partIndex: number) => {
            if (part.type === 'text' && part.text) {
              return (
                <View
                  key={`${message.id}-text-${partIndex}`}
                  style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}
                >
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                    {part.text}
                  </Text>
                </View>
              );
            }

            if (part.type === 'tool') {
              if (part.toolName === 'show_store_items') {
                if (part.state === 'input-streaming' || part.state === 'input-available') {
                  return (
                    <View
                      key={`${message.id}-tool-${partIndex}`}
                      style={styles.toolLoadingContainer}
                    >
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={styles.toolLoadingText}>Finding items…</Text>
                    </View>
                  );
                }

                if (part.state === 'output-available' && part.input?.items) {
                  return (
                    <View key={`${message.id}-tool-${partIndex}`} style={styles.itemsContainer}>
                      {part.input.items
                        .filter((item: any) =>
                          availableItems.some((m) => m.id === item.itemId) &&
                          (!vendor || item.vendorId === vendor.id)
                        )
                        .map((item: any) => renderItemCard(item.itemId))}
                    </View>
                  );
                }

                if (part.state === 'output-error') {
                  return (
                    <View
                      key={`${message.id}-tool-${partIndex}`}
                      style={styles.errorContainer}
                    >
                      <Text style={styles.errorText}>Failed to load items</Text>
                    </View>
                  );
                }
              }

              if (part.toolName === 'escalate_to_vendor') {
                if (part.state === 'output-available') {
                  return (
                    <View
                      key={`${message.id}-tool-${partIndex}`}
                      style={styles.escalationCard}
                    >
                      <View style={styles.escalationIconRow}>
                        <MessageCircle size={15} color={Colors.primary} />
                        <Text style={styles.escalationTitle}>
                          Connect with {vendor.name}
                        </Text>
                      </View>
                      <Text style={styles.escalationText}>
                        I can connect you with {vendor.name} directly for personalized assistance.
                      </Text>
                      <TouchableOpacity
                        style={styles.escalationButton}
                        onPress={handleEscalateToVendor}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.escalationButtonText}>
                          Message {vendor.name}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                }
              }
            }

            return null;
          })}
          {timestamp ? (
            <Text
              style={[styles.messageTimestamp, isUser && styles.userMessageTimestamp]}
            >
              {timestamp}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerAiAvatar}>
              <Sparkles size={16} color={Colors.white} />
            </View>
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.chatName}>the platform AI</Text>
                <View style={styles.headerAiPill}>
                  <Sparkles size={9} color={Colors.primary} />
                  <Text style={styles.headerAiPillText}>AI Assistant</Text>
                </View>
              </View>
              <Text style={styles.chatInfo} numberOfLines={1}>
                {vendor.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowOptionsMenu(true)}
              style={styles.headerButton}
              testID="ai-chat-header-ellipsis"
              accessibilityLabel="More options"
            >
              <MoreVertical size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>
          {/* AI context banner — makes it unambiguous this is an AI assistant,
              not the vendor replying directly. Vendor chat has no such band. */}
          <View style={styles.aiContextBanner}>
            <Sparkles size={11} color={Colors.primary} />
            <Text style={styles.aiContextBannerText}>
              AI assistant for {vendor.name}. Recommendations are based on this vendor's storefront. Confirm availability and custom requests directly with the vendor.
            </Text>
          </View>
        </SafeAreaView>

        <View style={styles.contentWrapper}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Distinct AI conversation canvas — warm off-white, never the
                cool gray vendor chat uses. */}
            <View style={styles.messagesInner}>
            {messages.map((message, index) => renderMessage(message, index))}

            {/* Empty state — only greeting is present and the customer hasn't
                typed yet. Polished hint rather than blank space. */}
            {!showSuggestions && messages.length <= 2 && !isSending && (
              <View style={styles.emptyHintCard}>
                <View style={styles.emptyHintIconWrap}>
                  <Sparkles size={18} color={Colors.primary} />
                </View>
                <Text style={styles.emptyHintTitle}>Ask me anything about {vendor.name}</Text>
                <Text style={styles.emptyHintMessage}>
                  I can help you explore the catalog, explain policies, or guide you to place an order.
                </Text>
              </View>
            )}

            {/* AI typing indicator — distinct from vendor chat's spinner. */}
            {isSending && (
              <View style={styles.messageBubbleContainer}>
                <View style={styles.aiAvatarCircle}>
                  <Sparkles size={12} color={Colors.white} />
                </View>
                <View style={styles.messageContentWrapper}>
                  <View style={styles.aiLabelRow}>
                    <Text style={styles.aiLabel}>the platform AI</Text>
                    <View style={styles.aiLabelPill}>
                      <Text style={styles.aiLabelPillText}>AI</Text>
                    </View>
                  </View>
                  <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
                    <View style={styles.typingDot} />
                    <View style={[styles.typingDot, styles.typingDotMid]} />
                    <View style={[styles.typingDot, styles.typingDotLate]} />
                  </View>
                </View>
              </View>
            )}

            {showSuggestions && (
              <View style={styles.suggestionsWrapper}>
                <Text style={styles.suggestionsLabel}>Suggested questions</Text>
                <View style={styles.suggestionsGrid}>
                  {SUGGESTION_PROMPTS.map((prompt) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.suggestionChip}
                      onPress={() => handleSendMessage(prompt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.suggestionChipText}>{prompt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {error && (
              <View style={styles.errorMessageContainer}>
                <Text style={styles.errorMessageText}>
                  Failed to send message. Please try again.
                </Text>
              </View>
            )}

            {isSessionExpired && (
              <View style={styles.sessionExpiredCard}>
                <Text style={styles.sessionExpiredTitle}>Session expired</Text>
                <Text style={styles.sessionExpiredMessage}>
                  Your session ended after 30 minutes of inactivity.
                </Text>
                <TouchableOpacity
                  style={styles.newSessionButton}
                  onPress={handleStartNewSession}
                  activeOpacity={0.7}
                >
                  <Text style={styles.newSessionButtonText}>Start new session</Text>
                </TouchableOpacity>
              </View>
            )}
            </View>
          </ScrollView>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          {/* Quota banners — replace the input when a quota is exhausted. */}
          {quotaState.kind === 'vendor_exhausted' && (
            <QuotaBanner
              icon={<Sparkles size={18} color={Colors.textMuted} />}
              title="the platform AI is unavailable right now."
              message="This vendor has reached their monthly AI reply limit. You can still message the vendor directly."
              actions={[
                {
                  label: 'Message Vendor',
                  icon: <MessageCircle size={14} color={Colors.primary} />,
                  onPress: handleMessageVendor,
                  primary: true,
                },
              ]}
            />
          )}
          {quotaState.kind === 'customer_exhausted' && (
            <QuotaBanner
              icon={<Sparkles size={18} color={Colors.textMuted} />}
              title={`You've reached your the platform AI limit for ${vendor.name} this month.`}
              message="You can still browse the storefront or message the vendor directly."
              actions={[
                {
                  label: 'View Storefront',
                  icon: <Store size={14} color={Colors.primary} />,
                  onPress: handleViewStorefront,
                  primary: true,
                },
                {
                  label: 'Message Vendor',
                  icon: <MessageCircle size={14} color={Colors.textSecondary} />,
                  onPress: handleMessageVendor,
                  primary: false,
                },
              ]}
            />
          )}

          {/* Input bar — only when AI is usable. */}
          {canUseAi && !isSessionExpired && quotaState.kind === 'available' && (
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  (messageText.trim() === '' || isSending) && styles.inputIdle,
                ]}
                placeholder={`Ask ${vendor.name}…`}
                placeholderTextColor={Colors.inputPlaceholder}
                value={messageText}
                onChangeText={setMessageText}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (messageText.trim() === '' || isSending) && styles.sendButtonDisabled,
                ]}
                onPress={() => handleSendMessage()}
                disabled={messageText.trim() === '' || isSending}
                activeOpacity={0.7}
              >
                {isSending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Send size={17} color={Colors.white} />
                )}
              </TouchableOpacity>
            </View>
          )}

          {canUseAi && isSessionExpired && (
            <View style={styles.expiredInputBanner}>
              <Text style={styles.expiredInputBannerText}>
                Session expired · Start a new session to continue
              </Text>
            </View>
          )}

          {/* Subtle remaining-count indicator — customer's own per-vendor
              monthly AI allowance. Vendor-side quota is internal and never
              surfaced to the customer. Mock-driven now; backend stays
              authoritative once Henry wires the quota endpoint. */}
          {canUseAi && quotaState.kind === 'available' && (
            <View style={styles.quotaFooter}>
              <Sparkles size={10} color={Colors.primary} />
              <Text style={styles.quotaFooterText}>
                {getCustomerRemaining(vendor.id)} of {CUSTOMER_AI_MONTHLY_LIMIT} AI replies left this month
              </Text>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>

      <ChatActionMenu
        visible={showOptionsMenu}
        onClose={() => setShowOptionsMenu(false)}
        actions={((): ChatActionItem[] => [
          {
            id: 'view-vendor',
            label: 'View vendor profile',
            onPress: () => router.push(`/store/${vendor.id}` as any),
          },
          {
            id: 'chat-vendor',
            label: 'Chat with vendor directly',
            onPress: () => router.push(`/chat/${vendor.id}` as any),
          },
          {
            id: 'help',
            label: 'Help',
            onPress: () => router.push('/help-center' as any),
          },
          // DEVELOPMENT-ONLY entry to the AI state preview tool.
          // The whole action is gated by __DEV__ so it cannot appear in
          // production builds. Henry: remove this action (and delete
          // components/dev/AiStatePreview.tsx + app/chat/ai/_dev-preview.tsx)
          // during backend integration. No other cleanup needed.
          ...(__DEV__
            ? [{
                id: 'dev-ai-preview',
                label: '🧪 AI State Preview (Dev)',
                onPress: () => router.push('/chat/ai/_dev-preview' as any),
              } as ChatActionItem]
            : []),
        ])()}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Quota banner (vendor exhausted / customer exhausted)                       */
/* -------------------------------------------------------------------------- */

interface QuotaAction {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary: boolean;
}

function QuotaBanner({
  icon,
  title,
  message,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  actions: QuotaAction[];
}) {
  return (
    <View style={styles.quotaBanner}>
      <View style={styles.quotaBannerIcon}>{icon}</View>
      <View style={styles.quotaBannerBody}>
        <Text style={styles.quotaBannerTitle}>{title}</Text>
        <Text style={styles.quotaBannerMessage}>{message}</Text>
        <View style={styles.quotaBannerActions}>
          {actions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={a.primary ? styles.quotaActionPrimary : styles.quotaActionSecondary}
              onPress={a.onPress}
              activeOpacity={0.75}
            >
              {a.icon}
              <Text
                style={a.primary ? styles.quotaActionPrimaryText : styles.quotaActionSecondaryText}
              >
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AI_CANVAS,
  },
  safeArea: {
    backgroundColor: AI_HEADER_TINT,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: AI_CANVAS,
  },

  /* Header — warm tinted band, distinct from vendor chat's white header */
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: AI_HEADER_TINT,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
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
  headerAiAvatarMuted: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.textMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 10,
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
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
  headerSpacer: {
    width: 38,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 1,
  },
  chatInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
  },

  /* AI context banner — makes clear this is AI, not the vendor directly */
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

  /* Gating (Basic plan / not found) */
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

  /* Messages */
  contentWrapper: {
    flex: 1,
    backgroundColor: AI_CANVAS,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: AI_CANVAS,
  },
  messagesContent: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexGrow: 1,
  },
  messagesInner: {
    gap: 2,
  },
  messageBubbleContainer: {
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
  },
  userMessageContainer: {
    flexDirection: 'row-reverse' as const,
  },
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
  messageContentWrapper: {
    flex: 1,
    gap: 4,
  },
  userContentWrapper: {
    alignItems: 'flex-end' as const,
  },
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
  } as ViewStyle,
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 5,
    alignSelf: 'flex-end' as const,
  },
  aiBubble: {
    // Warm cream — the AI's signature surface. Deliberately NOT the cool
    // gray (#E9E9EB) that vendor chat uses for incoming messages.
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
  userMessageText: {
    color: Colors.white,
  },
  messageTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 3,
    marginLeft: 2,
  },
  userMessageTimestamp: {
    alignSelf: 'flex-end' as const,
    marginRight: 2,
    marginLeft: 0,
  },

  /* Typing indicator — three pulsing dots in a warm AI bubble */
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
  typingDotMid: {
    opacity: 0.65,
  },
  typingDotLate: {
    opacity: 0.9,
  },

  /* Empty hint card — shown once after the greeting if the user is idle */
  emptyHintCard: {
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
    padding: 18,
    marginTop: 14,
    marginHorizontal: 4,
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

  /* Suggestions */
  suggestionsWrapper: {
    marginTop: 6,
    marginBottom: 6,
  },
  suggestionsLabel: {
    fontSize: 10.5,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    marginLeft: 31,
    letterSpacing: 0.3,
  },
  suggestionsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 7,
    marginLeft: 31,
  },
  suggestionChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  suggestionChipText: {
    fontSize: 12.5,
    color: Colors.text,
    fontWeight: '400' as const,
  },

  /* Item cards — WhatsApp Business product card feel */
  itemsContainer: {
    gap: 7,
    marginTop: 2,
  },
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
  itemImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  itemImagePlaceholder: {
    width: '100%' as const,
    height: '100%' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  itemImagePlaceholderText: {
    fontSize: 22,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
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

  /* Tool loading / errors */
  toolLoadingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: AI_BUBBLE_BG_DEEPER,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    borderBottomLeftRadius: 5,
    alignSelf: 'flex-start' as const,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
  },
  toolLoadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    alignSelf: 'flex-start' as const,
  },
  errorText: {
    fontSize: 12.5,
    color: Colors.error,
  },

  /* Escalation */
  escalationCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AI_BUBBLE_BORDER,
    padding: 12,
    gap: 7,
    maxWidth: 300,
  },
  escalationIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  escalationTitle: {
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  escalationText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  escalationButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center' as const,
    marginTop: 1,
  },
  escalationButtonText: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: Colors.white,
  },

  /* Session expired */
  errorMessageContainer: {
    backgroundColor: Colors.errorLight,
    padding: 11,
    borderRadius: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorMessageText: {
    fontSize: 12.5,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  sessionExpiredCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 18,
    marginTop: 14,
    alignItems: 'center' as const,
    gap: 7,
  },
  sessionExpiredTitle: {
    fontSize: 14.5,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sessionExpiredMessage: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 17,
  },
  newSessionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 11,
    paddingVertical: 9,
    paddingHorizontal: 22,
    marginTop: 3,
  },
  newSessionButtonText: {
    fontSize: 13.5,
    fontWeight: '600' as const,
    color: Colors.white,
  },

  /* Input bar — compact, WhatsApp Business-style. Warm-tinted border to
     keep the AI chat visually distinct from vendor chat's neutral input. */
  inputSafeArea: {
    backgroundColor: Colors.background,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: AI_BUBBLE_BORDER,
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
  inputIdle: {},
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
  expiredInputBanner: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  expiredInputBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
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

  /* Quota banner */
  quotaBanner: {
    flexDirection: 'row' as const,
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: AI_BUBBLE_BORDER,
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
  quotaBannerBody: {
    flex: 1,
    gap: 6,
  },
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
});
