import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Plus, ArrowUp, FileText, Package, MessageSquare, MapPin, Info } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ChatMessage } from '@/mocks/chatData';
import { chatService } from '@/services/chatService';
import { useChats } from '@/contexts/ChatContext';
import { useCatalog } from '@/contexts/CatalogContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { useVendor } from '@/contexts/VendorContext';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { useVendorDrafts } from '@/contexts/VendorDraftContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { validateChatMessage } from '@/utils/chatValidation';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

const formatVendorDisplayName = (fullName?: string): string => {
  if (!fullName) return 'Unknown Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

export default function VendorPreOrderChatScreen() {
  const router = useRouter();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const { getVendorPreOrderChatByCustomerId, addMessageToChat } = useChats();
  const { vendorInbox, updateInboxAfterMessage } = useInbox();
  const { vendor } = useVendor();

  const preOrderChat = getVendorPreOrderChatByCustomerId(customerId);
  const customerName = formatVendorDisplayName(preOrderChat?.customerName);
  const customerPublicId = preOrderChat?.customerId
    ? `CUSTOMER-${preOrderChat.customerId.toUpperCase()}`
    : undefined;


  const [messages, setMessages] = useState<ChatMessage[]>(preOrderChat?.messages || []);

  useEffect(() => {
    if (preOrderChat) {
      setMessages(preOrderChat.messages);
    }
  }, [preOrderChat]);
  const [messageText, setMessageText] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<string[]>([]);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [editingPickup, setEditingPickup] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false);
  const [quickReplies, setQuickReplies] = useState<{id: string; shortcut: string; message: string}[]>([]);
  const { items: catalogItems, categories } = useCatalog();
  const { pickupDetails, isLoaded: isPickupLoaded } = useVendorPickup();
  const { getDraft, saveDraft, clearDraft } = useVendorDrafts();

  const chatId = preOrderChat?.id ?? '';
  const { markChatAsRead } = useChatRead();

  /** Clear unread for vendor when this chat opens. */
  useEffect(() => {
    if (!chatId) return;
    markChatAsRead(chatId, 'vendor');
  }, [chatId, markChatAsRead]);

  useEffect(() => {
    if (!chatId) return;
    const draft = getDraft(chatId);
    if (draft) {
      setMessageText(draft);
    }
  }, [chatId, getDraft]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [messages]);

  useEffect(() => {
    loadQuickReplies();
  }, []);

  useEffect(() => {
    if (showQuickRepliesModal) {
      loadQuickReplies();
    }
  }, [showQuickRepliesModal]);

  useEffect(() => {
    if (showPickupModal && !editingPickup && isPickupLoaded) {
      const fullAddress = pickupDetails.unit 
        ? `${pickupDetails.streetAddress}, ${pickupDetails.unit}`
        : pickupDetails.streetAddress;
      setPickupAddress(fullAddress);
      setPickupInstructions(pickupDetails.instructions);
    }
  }, [showPickupModal, editingPickup, pickupDetails, isPickupLoaded]);

  const loadQuickReplies = async () => {
    try {
      const stored = await AsyncStorage.getItem('quickReplies');
      if (stored) {
        setQuickReplies(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load quick replies:', error);
    }
  };

  const handleBackPress = () => {
    router.back();
  };

  const handleSendMessage = () => {
    // isSendingMessage guard: messageText only clears once React re-renders,
    // so a rapid double-tap could fire this handler twice on the same
    // content before that happens, sending the same message twice.
    if (messageText.trim() === '' || !preOrderChat || isSendingMessage) return;

    const messageContent = messageText.trim();

    const validation = validateChatMessage(messageContent);
    if (!validation.isValid) {
      setValidationError(validation.errorMessage || 'Invalid message');
      setTimeout(() => setValidationError(null), 4000);
      return;
    }

    setIsSendingMessage(true);

    addMessageToChat(preOrderChat.id, {
      type: 'text',
      content: messageContent,
      sender: 'vendor',
    });

    if (preOrderChat.id) {
      chatService
        .sendMessage({
          chatId: preOrderChat.id,
          type: 'text',
          content: messageContent,
          sender: 'vendor',
        })
        .then((m) => console.log('[VENDOR PRE-ORDER CHAT] Message persisted via chatService:', m.id))
        .catch((err) => console.log('[VENDOR PRE-ORDER CHAT] sendMessage failed:', err))
        .finally(() => setIsSendingMessage(false));
    } else {
      setIsSendingMessage(false);
    }

    clearDraft(chatId);
    setMessageText('');
    console.log('[PRE-ORDER CHAT] Vendor message sent:', messageContent);

    const conv = vendorInbox.find(item => item.customerId === customerId && item.conversationType === 'inquiry');
    if (conv) {
      updateInboxAfterMessage({
        conversationId: conv.conversationId,
        lastMessageText: messageContent,
        lastSenderId: vendor?.id ?? '',
        senderRole: 'vendor',
      });
      console.log('[PRE-ORDER CHAT] Vendor inbox snapshot updated:', conv.conversationId);
    }
  };

  const handleMessageTextChange = (text: string) => {
    setMessageText(text);
    if (chatId) {
      saveDraft(chatId, text);
    }
  };

  const handleCreateCustomOrder = () => {
    setShowActionsMenu(false);
    const newCustomOrderId = `custom-${Date.now()}`;
    console.log('Creating custom order from pre-order chat:', newCustomOrderId, 'for customer:', customerName);
    setTimeout(() => {
      router.push(`/vendor/custom-order/${newCustomOrderId}?customerName=${encodeURIComponent(customerName)}&chatId=${encodeURIComponent(chatId)}` as any);
    }, 300);
  };

  const handlePlusButtonPress = () => {
    setShowActionsMenu(true);
  };

  const handleCatalogPress = () => {
    setShowActionsMenu(false);
    setTimeout(() => {
      setShowCatalogModal(true);
      setSelectedCatalogItems([]);
    }, 300);
  };

  const handleSendCatalogItems = () => {
    console.log('Sending catalog items:', selectedCatalogItems);
    setShowCatalogModal(false);
    setSelectedCatalogItems([]);
  };

  const handlePickupDetailsPress = () => {
    setShowActionsMenu(false);
    setTimeout(() => {
      setShowPickupModal(true);
      setEditingPickup(false);
    }, 300);
  };

  const handleSendPickupDetails = () => {
    console.log('Sending pickup details:', { address: pickupAddress, instructions: pickupInstructions });
    setShowPickupModal(false);
    setEditingPickup(false);
  };

  const handleQuickReplyPress = () => {
    setShowActionsMenu(false);
    if (quickReplies.length === 0) {
      setTimeout(() => {
        router.push('/vendor/settings/quick-replies' as any);
      }, 300);
    } else {
      setTimeout(() => {
        setShowQuickRepliesModal(true);
      }, 300);
    }
  };

  const handleSelectQuickReply = (message: string) => {
    setMessageText(message);
    setShowQuickRepliesModal(false);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'new_inquiry') {
      return (
        <View key={message.id} style={styles.newInquiryContainer}>
          <View style={styles.newInquiryDividerRow}>
            <View style={styles.newInquiryDividerLine} />
            <Text style={styles.newInquiryLabel}>New Inquiry</Text>
            <View style={styles.newInquiryDividerLine} />
          </View>
          <Text style={styles.newInquiryTimestamp}>{formatTime(message.timestamp)}</Text>
        </View>
      );
    }

    if (message.type === 'catalog_item' && message.catalogItemData) {
      const item = message.catalogItemData;
      const isOutgoing = message.sender === 'vendor';
      const displayPrice = (item.price || 0).toFixed(2);

      return (
        <View key={message.id} style={styles.systemMessageContainer}>
          <View style={styles.catalogItemCard}>
            <Text style={styles.catalogItemCardLabel}>
              {isOutgoing ? 'Catalog item shared' : 'Item shared by vendor'}
            </Text>
            <View style={styles.catalogItemCardContent}>
              <View style={styles.catalogItemCardImageContainer}>
                {item.image ? (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.catalogItemCardImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.catalogItemCardImagePlaceholder} />
                )}
              </View>
              <View style={styles.catalogItemCardInfo}>
                <Text style={styles.catalogItemCardName}>{item.name}</Text>
                {!isOutgoing && item.description && (
                  <Text style={styles.catalogItemCardDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <Text style={styles.catalogItemCardPrice}>{formatPriceWithCommas(Number(displayPrice) || 0, (vendor.currency as Currency) || 'NGN')}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.catalogItemCardButton}
              onPress={() => {
                console.log('View catalog item:', item.id);
                if (item.id) {
                  router.push(`/vendor/catalog/item/${item.id}` as any);
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.catalogItemCardButtonText}>View item</Text>
            </TouchableOpacity>
            <Text style={styles.catalogItemCardTimestamp}>{formatTime(message.timestamp)}</Text>
          </View>
        </View>
      );
    }

    const isOutgoing = message.sender === 'vendor';
    const customerInitial = (preOrderChat?.customerName || 'C').trim().charAt(0).toUpperCase();

    return (
      <View
        key={message.id}
        style={[
          styles.messageBubbleContainer,
          isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
        ]}
      >
        <View style={styles.bubbleWithTail}>
          {!isOutgoing && (
            <View style={styles.incomingAvatarSlot}>
              <View style={styles.incomingAvatar}>
                <Text style={styles.incomingAvatarText}>{customerInitial}</Text>
              </View>
            </View>
          )}
          {!isOutgoing && (
            <View style={styles.bubbleTailIncoming} />
          )}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {message.content}
            </Text>
            <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
          {isOutgoing && (
            <View style={styles.bubbleTailOutgoing} />
          )}
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
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{customerName}</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {customerPublicId || 'Pre-order inquiry'}
              </Text>
            </View>
            {/* Reserved for future call/video actions. Intentionally empty. */}
            <View style={styles.headerActionsSlot} />
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
            <View style={styles.preOrderInfoBanner}>
              <Info size={16} color={Colors.textSecondary} strokeWidth={2} />
              <View style={styles.preOrderInfoTextWrap}>
                <Text style={styles.preOrderInfoTitle}>This is a pre-order inquiry</Text>
                <Text style={styles.preOrderInfoSubtitle}>No order has been placed yet.</Text>
              </View>
            </View>
            {messages.length === 0 ? (
              <View style={styles.emptyConversationState} testID="vendor-pre-order-empty-state">
                <Text style={styles.emptyConversationTitle}>Start your conversation</Text>
                <Text style={styles.emptyConversationText}>Start your conversation with this customer.</Text>
              </View>
            ) : (
              messages.map((message) => renderMessage(message))
            )}
          </ScrollView>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          {validationError && (
            <View style={styles.validationErrorContainer}>
              <Text style={styles.validationErrorText}>{validationError}</Text>
            </View>
          )}
          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={styles.plusButton}
              onPress={handlePlusButtonPress}
              activeOpacity={0.7}
            >
              <View style={styles.plusCircle}>
                <Plus size={20} color={Colors.textSecondary} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.input}
                placeholder="Send a message…"
                placeholderTextColor="#AEAEB2"
                value={messageText}
                onChangeText={handleMessageTextChange}
                multiline
                maxLength={500}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                messageText.trim() !== '' && styles.sendButtonActive,
              ]}
              onPress={handleSendMessage}
              disabled={messageText.trim() === '' || isSendingMessage}
              activeOpacity={0.8}
            >
              <ArrowUp
                size={18}
                color={messageText.trim() !== '' ? '#FFFFFF' : '#AEAEB2'}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <Modal
          visible={showActionsMenu}
          animationType="slide"
          transparent
          onRequestClose={() => setShowActionsMenu(false)}
        >
          <TouchableOpacity
            style={styles.actionsMenuOverlay}
            activeOpacity={1}
            onPress={() => setShowActionsMenu(false)}
          >
            <View style={styles.actionsMenuContainer}>
              <View style={styles.actionsMenuGrid}>
                <TouchableOpacity
                  style={styles.actionsMenuGridItem}
                  onPress={handleCatalogPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionsMenuIconCircle}>
                    <Package size={24} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>Catalog</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionsMenuGridItem}
                  onPress={handleCreateCustomOrder}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionsMenuIconCircle}>
                    <FileText size={24} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>Custom Order</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionsMenuGridItem}
                  onPress={handleQuickReplyPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionsMenuIconCircle}>
                    <MessageSquare size={24} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>Quick replies</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionsMenuGridItem}
                  onPress={handlePickupDetailsPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.actionsMenuIconCircle}>
                    <MapPin size={24} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.actionsMenuGridItemText}>Pickup</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal
          visible={showCatalogModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCatalogModal(false)}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.catalogModalHeader}>
              <TouchableOpacity onPress={() => setShowCatalogModal(false)}>
                <Text style={styles.catalogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.catalogModalTitle}>Catalog</Text>
              <TouchableOpacity
                onPress={handleSendCatalogItems}
                disabled={selectedCatalogItems.length === 0}
              >
                <Text style={[
                  styles.catalogSendText,
                  selectedCatalogItems.length === 0 && styles.catalogSendTextDisabled
                ]}>Send</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.catalogContent} showsVerticalScrollIndicator={false}>
              {categories.map(category => {
                const categoryItems = catalogItems.filter(item => item.categoryId === category.id && item.isAvailable);
                if (categoryItems.length === 0) return null;

                return (
                  <View key={category.id} style={styles.catalogSection}>
                    <Text style={styles.catalogSectionTitle}>{category.name}</Text>
                    {categoryItems.map(item => {
                      const isSelected = selectedCatalogItems.includes(item.id);
                      const displayPrice = item.salePrice || item.basePrice;

                      return (
                        <TouchableOpacity
                          key={item.id}
                          style={[
                            styles.catalogItem,
                            isSelected && styles.catalogItemSelected
                          ]}
                          onPress={() => {
                            setSelectedCatalogItems(prev =>
                              prev.includes(item.id)
                                ? prev.filter(id => id !== item.id)
                                : [...prev, item.id]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.catalogItemLeft}>
                            {item.photos[0] ? (
                              <Image
                                source={{ uri: item.photos[0] }}
                                style={styles.catalogItemImage}
                                contentFit="cover"
                              />
                            ) : (
                              <View style={styles.catalogItemImagePlaceholder}>
                                <Text style={styles.catalogItemImagePlaceholderText}>📷</Text>
                              </View>
                            )}
                            <View style={styles.catalogItemInfo}>
                              <Text style={styles.catalogItemName}>{item.name}</Text>
                              {item.description && (
                                <Text style={styles.catalogItemDescription} numberOfLines={1}>
                                  {item.description}
                                </Text>
                              )}
                              <Text style={styles.catalogItemPrice}>{formatPriceWithCommas(displayPrice, (vendor.currency as Currency) || 'NGN')}</Text>
                            </View>
                          </View>
                          <View style={[
                            styles.catalogCheckbox,
                            isSelected && styles.catalogCheckboxSelected
                          ]}>
                            {isSelected && <Text style={styles.catalogCheckmark}>✓</Text>}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showPickupModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowPickupModal(false)}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.pickupModalHeader}>
              <TouchableOpacity onPress={() => setShowPickupModal(false)}>
                <Text style={styles.pickupCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.pickupModalTitle}>Pickup Details</Text>
              <TouchableOpacity onPress={handleSendPickupDetails}>
                <Text style={styles.pickupSendText}>Send</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickupContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.pickupDescription}>
                Share pickup information with the customer.
              </Text>

              <Text style={styles.pickupFieldLabel}>Pickup Address</Text>
              <TextInput
                style={styles.pickupInput}
                placeholder="Enter pickup address"
                placeholderTextColor={Colors.textSecondary}
                value={pickupAddress}
                onChangeText={setPickupAddress}
                multiline
                editable={editingPickup}
              />

              <Text style={styles.pickupFieldLabel}>Instructions (Optional)</Text>
              <TextInput
                style={[styles.pickupInput, styles.pickupTextArea]}
                placeholder="E.g., Ring doorbell, parking info"
                placeholderTextColor={Colors.textSecondary}
                value={pickupInstructions}
                onChangeText={setPickupInstructions}
                multiline
                textAlignVertical="top"
                editable={editingPickup}
              />

              {!editingPickup && (
                <TouchableOpacity
                  style={styles.editPickupButton}
                  onPress={() => setEditingPickup(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.editPickupButtonText}>Edit details</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal
          visible={showQuickRepliesModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowQuickRepliesModal(false)}
        >
          <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
            <View style={styles.quickReplyModalHeader}>
              <TouchableOpacity onPress={() => setShowQuickRepliesModal(false)}>
                <Text style={styles.quickReplyCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.quickReplyModalTitle}>Quick Replies</Text>
              <View style={styles.quickReplyHeaderSpacer} />
            </View>

            <ScrollView style={styles.quickReplyContent}>
              {quickReplies.map((reply) => (
                <TouchableOpacity
                  key={reply.id}
                  style={styles.quickReplyItem}
                  onPress={() => handleSelectQuickReply(reply.message)}
                  activeOpacity={0.7}
                >
                  <View style={styles.quickReplyItemContent}>
                    <Text style={styles.quickReplyShortcut}>/{reply.shortcut}</Text>
                    <Text style={styles.quickReplyMessage} numberOfLines={2}>{reply.message}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </SafeAreaView>
        </Modal>
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
    backgroundColor: Colors.background,
  },
  headerActionsSlot: {
    width: 40,
    height: 40,
  },
  headerButton: {
    padding: 8,
    flexShrink: 0,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 0,
    minWidth: 0,
  },
  headerSpacer: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F7F3EF',
  },
  messagesContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexGrow: 1,
  },

  messageBubbleContainer: {
    marginBottom: 8,
  },
  incomingAvatarSlot: {
    width: 26,
    marginRight: 6,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
  },
  incomingAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#A78BCA',
  },
  incomingAvatarText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  preOrderInfoBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    gap: 10,
  },
  preOrderInfoTextWrap: {
    flex: 1,
  },
  preOrderInfoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  preOrderInfoSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  emptyConversationState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  emptyConversationTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center' as const,
  },
  emptyConversationText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  outgoingMessageContainer: {
    alignItems: 'flex-end' as const,
  },
  incomingMessageContainer: {
    alignItems: 'flex-start' as const,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: '#EDEEF2',
    borderBottomLeftRadius: 4,
  },
  bubbleWithTail: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
  },
  bubbleTailOutgoing: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: Colors.primary,
    borderRightWidth: 10,
    borderRightColor: 'transparent' as const,
    marginBottom: 2,
    marginLeft: -2,
  },
  bubbleTailIncoming: {
    width: 0,
    height: 0,
    borderTopWidth: 10,
    borderTopColor: '#EDEEF2',
    borderLeftWidth: 10,
    borderLeftColor: 'transparent' as const,
    marginBottom: 2,
    marginRight: -2,
  },
  messageText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  outgoingMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(0,0,0,0.4)',
    alignSelf: 'flex-end' as const,
  },
  outgoingMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  inputSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  plusButton: {
    paddingBottom: 2,
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    minHeight: 38,
    justifyContent: 'center' as const,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
    lineHeight: 21,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 1,
  },
  sendButtonActive: {
    backgroundColor: Colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  actionsMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  actionsMenuContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  actionsMenuGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'flex-start' as const,
    gap: 8,
  },
  actionsMenuGridItem: {
    width: '22%',
    alignItems: 'center' as const,
    paddingVertical: 8,
  },
  actionsMenuIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 8,
  },
  actionsMenuGridItemText: {
    fontSize: 11,
    color: Colors.text,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  catalogModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  catalogCancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  catalogModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogSendText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  catalogSendTextDisabled: {
    opacity: 0.4,
  },
  catalogContent: {
    flex: 1,
  },
  catalogSection: {
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  catalogSectionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  catalogItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  catalogItemSelected: {
    backgroundColor: Colors.border,
  },
  catalogItemLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  catalogItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  catalogItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  catalogItemImagePlaceholderText: {
    fontSize: 20,
  },
  catalogItemInfo: {
    flex: 1,
  },
  catalogItemName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  catalogItemDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  catalogItemPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 12,
  },
  catalogCheckboxSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  catalogCheckmark: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  pickupModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickupCancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  pickupModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickupSendText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  pickupContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    backgroundColor: Colors.background,
  },
  pickupDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
    lineHeight: 20,
  },
  pickupFieldLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  pickupInput: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 20,
  },
  pickupTextArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  editPickupButton: {
    backgroundColor: Colors.border,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 8,
  },
  editPickupButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  quickReplyModalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  quickReplyCancelText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  quickReplyModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  quickReplyHeaderSpacer: {
    width: 60,
  },
  quickReplyContent: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  quickReplyItem: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
  },
  quickReplyItemContent: {
    flex: 1,
  },
  quickReplyShortcut: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  quickReplyMessage: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  catalogItemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    maxWidth: '90%',
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catalogItemCardLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  catalogItemCardContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  catalogItemCardImageContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 12,
    overflow: 'hidden' as const,
  },
  catalogItemCardImage: {
    width: 56,
    height: 56,
  },
  catalogItemCardImagePlaceholder: {
    width: 56,
    height: 56,
    backgroundColor: Colors.border,
    borderRadius: 8,
  },
  catalogItemCardInfo: {
    flex: 1,
  },
  catalogItemCardName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  catalogItemCardDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 6,
  },
  catalogItemCardPrice: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  catalogItemCardButton: {
    paddingVertical: 10,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  catalogItemCardButtonText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  catalogItemCardTimestamp: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
  },
  validationErrorContainer: {
    backgroundColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  validationErrorText: {
    fontSize: 13,
    color: Colors.primary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  newInquiryContainer: {
    alignItems: 'center' as const,
    marginVertical: 12,
    paddingHorizontal: 4,
  },
  newInquiryDividerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    width: '100%' as const,
    gap: 10,
  },
  newInquiryDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  newInquiryLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#3B82F6',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  newInquiryTimestamp: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
