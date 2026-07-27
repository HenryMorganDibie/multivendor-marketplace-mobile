import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Sparkles, MessageCircle } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { createRorkTool, useRorkAgent } from '@rork-ai/toolkit-sdk';
import { z } from 'zod';
import { mockVendor, mockMenuItems } from '@/mocks/vendorData';
import { formatPrice } from '@/utils/formatPrice';

const AI_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const AI_BUBBLE_BG = '#EEEEF2';

const SUGGESTION_PROMPTS = [
  'What services or products do you offer?',
  'What are your most popular items?',
  'Do you have anything available today?',
  'How do I place an order?',
];

export default function LaektivaAIChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSessionExpired, setIsSessionExpired] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const vendor = mockVendor;
  const availableItems = mockMenuItems.filter(item => item.inStock);

  const catalogList = availableItems
    .map(item =>
      `- ID: ${item.id} | ${item.name} (${formatPrice(item.price)})${item.description ? `: ${item.description}` : ''}`
    )
    .join('\n');

  const fulfillmentOptions = [
    vendor.pickup && 'Pickup',
    vendor.delivery && 'Delivery',
    vendor.shipping && 'Shipping',
  ]
    .filter(Boolean)
    .join(', ');

  const systemPrompt = `You are the platform AI, a virtual assistant representing ${vendor.name}.

VENDOR INFORMATION:
- Name: ${vendor.name}
- Category: ${vendor.category}
- Location: ${vendor.area}
- Rating: ${vendor.rating}/5 (${vendor.reviewCount} reviews)
- Fulfillment: ${fulfillmentOptions || 'Contact vendor for details'}
- Business Hours: ${vendor.businessHours || 'Not specified'}
- Minimum Order: ${vendor.minimumOrderAmount ? formatPrice(vendor.minimumOrderAmount) : 'None'}
- Status: ${vendor.storeStatus === 'open' ? 'Currently open' : 'Currently closed'}

CATALOG (Available Items/Services):
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
- Always direct customers to the app UI for transactions
- Example: "To order, please add items to your cart from the storefront."

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
- Only show items that are in stock (all listed above are in stock)
- Show 3–5 items at a time unless specifically requested otherwise
- NEVER generate or invent item IDs, names, or prices
- If no matching items exist in the catalog, respond with text only

Be friendly, clear, and concise. Adapt to the vendor's business type.`;

  const greetingText = `Hi 👋 Welcome to **${vendor.name}**.\n\nI'm the the platform AI assistant for this store. I can help answer questions, explain services, and help you explore what **${vendor.name}** offers.`;

  const { messages, error, sendMessage, setMessages } = useRorkAgent({
    tools: {
      show_store_items: createRorkTool({
        description: `Display catalog item or product cards from ${vendor.name}'s store. CRITICAL: Only use item IDs that exist in the vendor's catalog. Never generate fake IDs.`,
        zodSchema: z.object({
          items: z
            .array(
              z.object({
                itemId: z
                  .string()
                  .describe('The exact ID of the catalog item (e.g., "1", "2", "5")'),
                vendorId: z
                  .string()
                  .describe('The vendor ID — always use "v1" for this vendor'),
              })
            )
            .describe(
              'Array of catalog items to display (show 3–5 items). Each item MUST have a real itemId from the catalog.'
            ),
        }),
        execute: args => {
          const validItems = args.items.filter((item: { itemId: string }) =>
            availableItems.some(catalogItem => catalogItem.id === item.itemId)
          );
          if (validItems.length === 0) {
            return 'No valid items found. Please only reference items that exist in the vendor catalog.';
          }
          return `Successfully displayed ${validItems.length} item(s)`;
        },
      }),
      escalate_to_vendor: createRorkTool({
        description: `Offer the customer an option to chat directly with ${vendor.name} when the AI cannot answer or when the customer requests human support.`,
        zodSchema: z.object({
          reason: z
            .string()
            .describe('Brief reason why escalation is being offered')
            .optional(),
        }),
        execute: args => {
          console.log('[AI CHAT] Escalation triggered:', args.reason);
          return `Escalation card shown for ${vendor.name}`;
        },
      }),
    },
  });

  useEffect(() => {
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
  }, [messages.length]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const resetExpiryTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    expiryTimerRef.current = setTimeout(() => {
      console.log('[AI CHAT] Session expired after 30 minutes of inactivity');
      setIsSessionExpired(true);
    }, AI_SESSION_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    resetExpiryTimer();
    return () => {
      if (expiryTimerRef.current) clearTimeout(expiryTimerRef.current);
    };
  }, [resetExpiryTimer]);

  const handleStartNewSession = () => {
    console.log('[AI CHAT] Starting new session');
    setIsSessionExpired(false);
    setMessages([]);
    resetExpiryTimer();
  };

  const handleSendMessage = useCallback(
    (text?: string) => {
      const content = (text ?? messageText).trim();
      if (content === '' || isSending || isSessionExpired) return;
      setIsSending(true);
      resetExpiryTimer();
      sendMessage(content);
      if (!text) setMessageText('');
      setTimeout(() => setIsSending(false), 1000);
    },
    [messageText, isSending, isSessionExpired, resetExpiryTimer, sendMessage]
  );

  const handleViewItem = (itemId: string, vendorId: string) => {
    console.log('[AI CHAT] Navigating to item:', itemId, 'vendor:', vendorId);
    router.push({
      pathname: `/item/${itemId}` as any,
      params: { vendorId },
    });
  };

  const handleEscalateToVendor = () => {
    console.log('[AI CHAT] Navigating to vendor inquiry chat:', vendor.id);
    router.push(`/chat/${vendor.id}` as any);
  };

  const showSuggestions =
    messages.length > 0 && !messages.some((m: any) => m.role === 'user');

  const renderItemCard = (itemId: string, vendorId: string) => {
    const item = mockMenuItems.find(m => m.id === itemId);
    if (!item) return null;
    return (
      <View key={item.id} style={styles.itemCard}>
        <View style={styles.itemCardContent}>
          <View style={styles.itemImageContainer}>
            {item.image ? (
              <Image
                source={{ uri: item.image }}
                style={styles.itemImage}
                resizeMode="cover"
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
            <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => handleViewItem(item.id, vendorId)}
          activeOpacity={0.7}
        >
          <Text style={styles.viewButtonText}>View Item</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMessage = (message: any, index: number) => {
    if (message.role === 'system') return null;
    const isUser = message.role === 'user';

    return (
      <View
        key={message.id || `msg-${index}`}
        style={[styles.messageBubbleContainer, isUser && styles.userMessageContainer]}
      >
        <View
          style={[styles.messageContentWrapper, isUser && styles.userContentWrapper]}
        >
          {!isUser && <Text style={styles.aiLabel}>the platform AI</Text>}
          {message.parts?.map((part: any, partIndex: number) => {
            if (part.type === 'text' && part.text) {
              return (
                <View
                  key={`${message.id}-text-${partIndex}`}
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  <Text style={[styles.messageText, isUser && styles.userMessageText]}>
                    {part.text}
                  </Text>
                </View>
              );
            }

            if (part.type === 'tool') {
              if (part.toolName === 'show_store_items') {
                if (
                  part.state === 'input-streaming' ||
                  part.state === 'input-available'
                ) {
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
                    <View
                      key={`${message.id}-tool-${partIndex}`}
                      style={styles.itemsContainer}
                    >
                      {part.input.items
                        .filter((item: any) =>
                          mockMenuItems.some(m => m.id === item.itemId)
                        )
                        .map((item: any) => renderItemCard(item.itemId, item.vendorId))}
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
                        <MessageCircle size={16} color={Colors.primary} />
                        <Text style={styles.escalationTitle}>
                          Connect with {vendor.name}
                        </Text>
                      </View>
                      <Text style={styles.escalationText}>
                        I can connect you with {vendor.name} directly for personalized
                        assistance.
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
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerAiIcon}>
                  <Sparkles size={12} color={Colors.white} />
                </View>
                <Text style={styles.chatName}>the platform AI</Text>
              </View>
              <Text style={styles.chatInfo}>{vendor.name}</Text>
            </View>
            <View style={styles.headerSpacer} />
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
            {messages.map((message, index) => renderMessage(message, index))}

            {showSuggestions && (
              <View style={styles.suggestionsWrapper}>
                <Text style={styles.suggestionsLabel}>Suggested questions</Text>
                <View style={styles.suggestionsGrid}>
                  {SUGGESTION_PROMPTS.map(prompt => (
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
          </ScrollView>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          {isSessionExpired && (
            <View style={styles.expiredInputBanner}>
              <Text style={styles.expiredInputBannerText}>
                Session expired · Start a new session to continue
              </Text>
            </View>
          )}
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, isSessionExpired && styles.inputDisabled]}
              placeholder={
                isSessionExpired
                  ? 'Session expired'
                  : `Ask anything about ${vendor.name}…`
              }
              placeholderTextColor={Colors.inputPlaceholder}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={500}
              editable={!isSessionExpired}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (messageText.trim() === '' || isSending || isSessionExpired) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={() => handleSendMessage()}
              disabled={messageText.trim() === '' || isSending || isSessionExpired}
              activeOpacity={0.7}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Send size={18} color='#FFFFFF' />
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
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
    borderBottomColor: Colors.cardBorder,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerSpacer: {
    width: 40,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 2,
  },
  headerAiIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  chatInfo: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginLeft: 0,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  messageBubbleContainer: {
    marginBottom: 12,
  },
  userMessageContainer: {
    alignItems: 'flex-end' as const,
  },
  messageContentWrapper: {
    gap: 4,
  },
  userContentWrapper: {
    alignItems: 'flex-end' as const,
  },
  aiLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    marginLeft: 4,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end' as const,
    maxWidth: '75%',
  },
  aiBubble: {
    backgroundColor: AI_BUBBLE_BG,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  userMessageText: {
    color: Colors.white,
  },
  suggestionsWrapper: {
    marginTop: 8,
    marginBottom: 8,
  },
  suggestionsLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.3,
  },
  suggestionsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
  },
  suggestionChip: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  suggestionChipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  itemsContainer: {
    gap: 8,
    marginTop: 2,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
    maxWidth: 280,
  },
  itemCardContent: {
    flexDirection: 'row' as const,
    padding: 12,
    gap: 10,
  },
  itemImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden' as const,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  itemImage: {
    width: 60,
    height: 60,
  },
  itemImagePlaceholder: {
    width: 60,
    height: 60,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  itemImagePlaceholderText: {
    fontSize: 24,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center' as const,
    gap: 2,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  itemDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  viewButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  toolLoadingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: AI_BUBBLE_BG,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start' as const,
    maxWidth: '78%',
  },
  toolLoadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  escalationCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 14,
    gap: 8,
    maxWidth: 280,
  },
  escalationIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  escalationTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  escalationText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  escalationButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center' as const,
    marginTop: 2,
  },
  escalationButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  errorContainer: {
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    alignSelf: 'flex-start' as const,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
  },
  errorMessageContainer: {
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorMessageText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center' as const,
  },
  sessionExpiredCard: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    alignItems: 'center' as const,
    gap: 8,
  },
  sessionExpiredTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  sessionExpiredMessage: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  newSessionButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
    marginTop: 4,
  },
  newSessionButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  inputSafeArea: {
    backgroundColor: Colors.surface,
  },
  expiredInputBanner: {
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  expiredInputBannerText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
  },
  inputDisabled: {
    opacity: 0.5,
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
  },
});
