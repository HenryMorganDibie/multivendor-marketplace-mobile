import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send, Sparkles, ArrowLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useOrders } from '@/contexts/OrdersContext';
import { mockVendors } from '@/mocks/vendorData';

type MessageRole = 'ai' | 'user';
type FlowState = 'main' | 'sub' | 'done';

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: Date;
}

interface ActionChip {
  id: string;
  label: string;
  action: 'view_order' | 'message_vendor' | 'back_main' | 'report_vendor' | 'back_sub';
}

interface SubOption {
  id: string;
  label: string;
  response: string;
  actions: ActionChip[];
}

interface MainOption {
  id: string;
  label: string;
  intro: string; // AI message shown when this topic is selected
  subs: SubOption[];
}

type OrderStatus =
  | 'requested'
  | 'accepted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  requested: { bg: 'rgba(245,158,11,0.1)', text: '#B45309' },
  accepted: { bg: 'rgba(16,168,98,0.1)', text: '#0D7A50' },
  confirmed: { bg: 'rgba(16,168,98,0.1)', text: '#0D7A50' },
  in_progress: { bg: 'rgba(255,122,40,0.1)', text: '#C45A15' },
  completed: { bg: 'rgba(16,168,98,0.1)', text: '#0D7A50' },
  cancelled: { bg: 'rgba(229,72,77,0.1)', text: '#C0383D' },
  rejected: { bg: 'rgba(229,72,77,0.1)', text: '#C0383D' },
};

const VIEW_ORDER: ActionChip = { id: 'view_order', label: 'View Order Details', action: 'view_order' };
const MSG_VENDOR: ActionChip = { id: 'msg_vendor', label: 'Message Vendor', action: 'message_vendor' };
const BACK_MAIN: ActionChip = { id: 'back_main', label: 'Back to main options', action: 'back_main' };
const REPORT_VENDOR: ActionChip = { id: 'report_vendor', label: 'Report Vendor', action: 'report_vendor' };

/** Build the full topic tree — all content is non-escrow compliant */
const buildMainOptions = (vendorName: string): MainOption[] => [
  {
    id: 'order_question',
    label: 'Order question',
    intro: `Sure — what's your question about the order? Choose the closest topic below.`,
    subs: [
      {
        id: 'item_question',
        label: 'I have a question about an item',
        response: `For item-specific questions, the vendor is your best source. Message ${vendorName} directly from Order Details.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'pickup_details',
        label: 'I need pickup details',
        response: `Pickup details are set by the vendor. Check the order notes or message ${vendorName} to confirm the location and time.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'delivery_details',
        label: 'I need delivery details',
        response: `For delivery info, message ${vendorName} directly — they manage all logistics for this order.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'order_status',
        label: 'I need order status',
        response: `You can see the latest order status on the Order Details screen. For updates, message ${vendorName} directly.`,
        actions: [VIEW_ORDER, MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'contact_vendor',
        label: 'I need to contact the vendor',
        response: `Tap "Message Vendor" below — that opens a direct chat with ${vendorName} about this order.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
    ],
  },
  {
    id: 'payment_confirmation',
    label: 'Payment confirmation issue',
    intro: `Payments are confirmed directly by vendors — the platform doesn't process or hold payments. What's the issue?`,
    subs: [
      {
        id: 'no_confirmation',
        label: 'I paid but no confirmation yet',
        response: `Vendors confirm payments manually. If you haven't heard back, upload your proof of payment using "I've Paid" on Order Details, then message ${vendorName} to review it.`,
        actions: [VIEW_ORDER, MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'uploaded_proof',
        label: 'I uploaded proof of payment',
        response: `Great — ${vendorName} will be notified. If they haven't responded in a reasonable time, send a direct message to follow up.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'vendor_no_payment',
        label: 'Vendor says payment not received',
        response: `Check your payment proof in Order Details. Share the receipt or screenshot directly with ${vendorName} via chat. the platform doesn't verify or hold payments.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'partial_payment',
        label: 'I sent partial payment',
        response: `Let ${vendorName} know about the partial payment via chat, and agree on how to handle the remainder. Document everything in the order chat.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'wrong_amount',
        label: 'I paid the wrong amount',
        response: `Message ${vendorName} directly to clarify the discrepancy. Share proof of what was paid and agree on next steps together.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'wrong_method',
        label: 'I used the wrong payment method',
        response: `Contact ${vendorName} directly to sort out the payment method. They'll advise you on what to do next.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
    ],
  },
  {
    id: 'vendor_not_responding',
    label: 'Vendor not responding',
    intro: `That's frustrating. Tell me more so I can suggest the right next step.`,
    subs: [
      {
        id: 'stopped_replying',
        label: 'Vendor stopped replying',
        response: `Try sending a follow-up message to ${vendorName}. If they remain unresponsive for an extended period, you can report them from their profile.`,
        actions: [MSG_VENDOR, REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'payment_not_confirmed',
        label: 'Vendor has not confirmed payment',
        response: `Upload proof of payment via "I've Paid" on Order Details if you haven't already, then send ${vendorName} a direct message asking them to review it.`,
        actions: [VIEW_ORDER, MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'time_is_close',
        label: 'Pickup/delivery time is close',
        response: `Message ${vendorName} now to confirm everything is on track. If they don't respond and the deadline passes, you can report the issue from their profile.`,
        actions: [MSG_VENDOR, REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'missed_time',
        label: 'Vendor missed agreed time',
        response: `Send a follow-up message to ${vendorName} first. If there's still no response or resolution, you can report the vendor from their profile.`,
        actions: [MSG_VENDOR, REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'suspicious',
        label: "I'm worried this may be suspicious",
        response: `Trust your instincts. If something feels off — unusual payment requests or pressure tactics — report the vendor from their profile immediately.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
    ],
  },
  {
    id: 'pickup_delivery',
    label: 'Pickup or delivery question',
    intro: `Logistics are managed directly between you and ${vendorName}. What do you need help with?`,
    subs: [
      {
        id: 'where_pickup',
        label: 'Where is pickup?',
        response: `Check your order notes or message ${vendorName} to confirm the pickup address and any access details.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'pickup_unclear',
        label: 'Pickup instructions unclear',
        response: `Message ${vendorName} directly to clarify the pickup instructions. They can provide exact details or update the order notes.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'running_late',
        label: "I'm running late",
        response: `Let ${vendorName} know as soon as possible via the order chat. They'll adjust if they can.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'delivery_unclear',
        label: 'Delivery details unclear',
        response: `Message ${vendorName} for clarification on delivery — timing, address, or any special instructions.`,
        actions: [MSG_VENDOR, VIEW_ORDER, BACK_MAIN],
      },
      {
        id: 'vendor_changed_time',
        label: 'Vendor changed the time',
        response: `Reach out to ${vendorName} to confirm the new time and make sure it works for you. Update any arrangements on your end.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
    ],
  },
  {
    id: 'safety_concern',
    label: 'Safety concern',
    intro: `Your safety matters. These concerns may be reviewed by the platform. What are you experiencing?`,
    subs: [
      {
        id: 'suspicious_payment',
        label: 'Suspicious payment request',
        response: `Never pay outside an agreed method or send money to unverified accounts. Report this vendor immediately — the platform may review safety-related reports.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'fake_vendor',
        label: 'Fake vendor concern',
        response: `If you suspect this vendor isn't legitimate, report them now. the platform may investigate fake business reports.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'harassment',
        label: 'Harassment or abusive behavior',
        response: `This is taken seriously. Report the vendor from their profile — the platform may review reports of harassment or abusive conduct.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'inappropriate',
        label: 'Inappropriate content',
        response: `Report the vendor from their profile. Include as much detail as possible so the report can be reviewed appropriately.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'scam',
        label: 'I think this is a scam',
        response: `Thanks for flagging this. Do not make any further payments. Report this vendor — the platform may review scam and fraud reports immediately.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
      {
        id: 'report_the platform',
        label: 'Report vendor to the platform',
        response: `Tap "Report Vendor" below. the platform reviews safety-related reports including fraud, scams, and abuse. Normal order disputes are not escalated to human support.`,
        actions: [REPORT_VENDOR, BACK_MAIN],
      },
    ],
  },
  {
    id: 'more_options',
    label: 'More options',
    intro: `Of course. What kind of issue are you running into?`,
    subs: [
      {
        id: 'technical',
        label: 'Technical issue',
        response: `If you're having a technical problem with the app, try restarting it. If the issue persists, contact the platform support with a description of what happened.`,
        actions: [BACK_MAIN],
      },
      {
        id: 'chat_problem',
        label: 'Chat problem',
        response: `If messages aren't sending or loading, try closing and reopening the chat. Make sure you have a stable connection.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
      {
        id: 'app_issue',
        label: 'App issue',
        response: `For app-level issues, restarting usually helps. If the problem continues, try updating the app or reaching out to the platform support.`,
        actions: [BACK_MAIN],
      },
      {
        id: 'something_else',
        label: 'Something else',
        response: `Describe what's happening in the chat below and I'll do my best to point you in the right direction.`,
        actions: [MSG_VENDOR, BACK_MAIN],
      },
    ],
  },
];

const AI_FALLBACK =
  "For anything that needs immediate attention, message the vendor directly from Order Details. Is there anything else I can help with?";

export default function OrderSupportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = (params.orderId as string) || '';
  const { getOrder } = useOrders();

  const order = useMemo(() => getOrder(orderId), [orderId, getOrder]);
  const vendor = useMemo(
    () => (order ? mockVendors.find((v) => v.id === order.vendorId) : undefined),
    [order],
  );

  const statusKey = (order?.status as OrderStatus) ?? 'default';
  const vendorName = order?.vendorName ?? vendor?.name ?? 'the vendor';
  const vendorId = order?.vendorId ?? vendor?.id ?? '';
  const publicOrderId = order?.publicOrderId ?? orderId;
  const statusLabel = STATUS_LABELS[statusKey] ?? statusKey;
  const statusColor = STATUS_COLORS[statusKey] ?? STATUS_COLORS.completed;

  const mainOptions = useMemo(() => buildMainOptions(vendorName), [vendorName]);

  // Flow state machine
  const [flowState, setFlowState] = useState<FlowState>('main');
  const [activeMain, setActiveMain] = useState<MainOption | null>(null);
  const [activeSub, setActiveSub] = useState<SubOption | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'greeting',
      role: 'ai',
      text: `Hi! I can help with this order from ${vendorName}. What do you need help with?`,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const scrollRef = useRef<ScrollView>(null);
  const typingOpacity = useRef(new Animated.Value(0.4)).current;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const addUserMsg = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text, timestamp: new Date() },
    ]);
  }, []);

  const showTypingThenRespond = useCallback(
    (responseText: string, onDone?: () => void) => {
      setIsTyping(true);
      typingOpacity.setValue(0.4);
      Animated.loop(
        Animated.sequence([
          Animated.timing(typingOpacity, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(typingOpacity, { toValue: 0.4, duration: 420, useNativeDriver: true }),
        ]),
        { iterations: 4 },
      ).start();
      scrollToBottom();
      setTimeout(() => {
        setIsTyping(false);
        typingOpacity.setValue(0.4);
        setMessages((prev) => [
          ...prev,
          { id: `ai-${Date.now()}`, role: 'ai', text: responseText, timestamp: new Date() },
        ]);
        onDone?.();
        scrollToBottom();
      }, 1200);
    },
    [typingOpacity, scrollToBottom],
  );

  // User selects a main topic
  const handleSelectMain = useCallback(
    (opt: MainOption) => {
      addUserMsg(opt.label);
      setActiveMain(opt);
      scrollToBottom();
      showTypingThenRespond(opt.intro, () => setFlowState('sub'));
    },
    [addUserMsg, showTypingThenRespond, scrollToBottom],
  );

  // User selects a sub-option
  const handleSelectSub = useCallback(
    (sub: SubOption) => {
      addUserMsg(sub.label);
      setActiveSub(sub);
      scrollToBottom();
      showTypingThenRespond(sub.response, () => setFlowState('done'));
    },
    [addUserMsg, showTypingThenRespond, scrollToBottom],
  );

  // User taps an action chip
  const handleAction = useCallback(
    (chip: ActionChip) => {
      if (chip.action === 'back_main') {
        addUserMsg('Back to main options');
        setActiveMain(null);
        setActiveSub(null);
        showTypingThenRespond(
          `Of course! What else can I help you with?`,
          () => setFlowState('main'),
        );
        return;
      }
      if (chip.action === 'back_sub' && activeMain) {
        addUserMsg('Back');
        setActiveSub(null);
        showTypingThenRespond(activeMain.intro, () => setFlowState('sub'));
        return;
      }
      if (chip.action === 'view_order') {
        router.push(`/order/${orderId}` as any);
        return;
      }
      if (chip.action === 'message_vendor' && vendorId) {
        router.push(`/chat/${vendorId}` as any);
        return;
      }
      if (chip.action === 'report_vendor' && vendorId) {
        router.push({ pathname: '/report-vendor', params: { vendorId } } as any);
        return;
      }
    },
    [activeMain, orderId, vendorId, router, addUserMsg, showTypingThenRespond],
  );

  // Free-text send
  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    addUserMsg(trimmed);
    setInputText('');
    scrollToBottom();
    showTypingThenRespond(AI_FALLBACK);
  }, [inputText, addUserMsg, showTypingThenRespond, scrollToBottom]);

  const handleBack = useCallback(() => {
    try {
      router.back();
    } catch {
      router.replace('/orders' as any);
    }
  }, [router]);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  // Which chips to show below messages
  const renderChips = () => {
    if (isTyping) return null;

    if (flowState === 'main') {
      return (
        <View style={styles.chipsWrap}>
          {mainOptions.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={styles.chip}
              onPress={() => handleSelectMain(opt)}
              activeOpacity={0.65}
            >
              <Text style={styles.chipText}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (flowState === 'sub' && activeMain) {
      return (
        <View style={styles.chipsWrap}>
          {activeMain.subs.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={styles.chip}
              onPress={() => handleSelectSub(sub)}
              activeOpacity={0.65}
            >
              <Text style={styles.chipText}>{sub.label}</Text>
            </TouchableOpacity>
          ))}
          {/* Back to main */}
          <TouchableOpacity
            style={[styles.chip, styles.chipBack]}
            onPress={() => handleAction(BACK_MAIN)}
            activeOpacity={0.65}
          >
            <ArrowLeft size={12} color={Colors.textMuted} strokeWidth={2} />
            <Text style={[styles.chipText, styles.chipTextBack]}>Back to main options</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (flowState === 'done' && activeSub) {
      return (
        <View style={styles.chipsWrap}>
          {activeSub.actions.map((chip) => (
            <TouchableOpacity
              key={chip.id}
              style={[
                styles.chip,
                chip.action === 'back_main' ? styles.chipBack : styles.chipAction,
              ]}
              onPress={() => handleAction(chip)}
              activeOpacity={0.65}
            >
              {chip.action === 'back_main' && (
                <ArrowLeft size={12} color={Colors.textMuted} strokeWidth={2} />
              )}
              <Text
                style={[
                  styles.chipText,
                  chip.action === 'back_main'
                    ? styles.chipTextBack
                    : styles.chipTextAction,
                ]}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    return null;
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.headerBtn} hitSlop={10}>
              <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Help</Text>
              <View style={styles.headerSubRow}>
                <Sparkles size={9} color={Colors.primary} strokeWidth={2} />
                <Text style={styles.headerSub}>Powered by AI</Text>
              </View>
            </View>
            <View style={styles.headerBtn} />
          </View>
        </SafeAreaView>

        {/* Order context strip */}
        {order && (
          <View style={styles.contextStrip}>
            <View style={styles.contextLeft}>
              <Text style={styles.contextVendor}>{vendorName}</Text>
              <Text style={styles.contextOrderId}>{publicOrderId.toUpperCase()}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                {statusLabel}
              </Text>
            </View>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.messageList}
            contentContainerStyle={styles.messageListContent}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
          >
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[
                  styles.msgRow,
                  msg.role === 'user' ? styles.msgRowUser : styles.msgRowAi,
                ]}
              >
                <View
                  style={[
                    styles.msgBubble,
                    msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAi,
                  ]}
                >
                  <Text style={[styles.msgText, msg.role === 'user' && styles.msgTextUser]}>
                    {msg.text}
                  </Text>
                  <Text style={[styles.msgTime, msg.role === 'user' && styles.msgTimeUser]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <View style={[styles.msgRow, styles.msgRowAi]}>
                <View style={[styles.msgBubble, styles.msgBubbleAi, styles.typingBubble]}>
                  <Animated.View style={[styles.typingDots, { opacity: typingOpacity }]}>
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                    <View style={styles.typingDot} />
                  </Animated.View>
                </View>
              </View>
            )}

            {/* Context-aware chips */}
            {renderChips()}

            <View style={{ height: 12 }} />
          </ScrollView>

          {/* Input bar */}
          <SafeAreaView edges={['bottom']} style={styles.inputSafe}>
            <View style={styles.inputBar}>
              <TextInput
                style={styles.input}
                placeholder="Type a message…"
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleSend}
                returnKeyType="send"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim()}
                activeOpacity={0.8}
              >
                <Send size={16} color="#FFFFFF" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },

  // Header
  headerSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  headerSubRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginTop: 2,
  },
  headerSub: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },

  // Context strip
  contextStrip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundCanvas,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  contextLeft: { gap: 1 },
  contextVendor: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  contextOrderId: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '400' as const,
    letterSpacing: 0.3,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },

  // Messages
  messageList: { flex: 1 },
  messageListContent: { paddingHorizontal: 16, paddingTop: 14 },

  msgRow: { marginBottom: 6 },
  msgRowUser: { alignItems: 'flex-end' as const },
  msgRowAi: { alignItems: 'flex-start' as const },

  msgBubble: {
    maxWidth: '80%' as const,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 9,
    gap: 3,
  },
  msgBubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  msgBubbleAi: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
  },
  msgText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  msgTextUser: { color: '#FFFFFF' },
  msgTime: {
    fontSize: 10,
    color: Colors.textMuted,
    alignSelf: 'flex-end' as const,
  },
  msgTimeUser: { color: 'rgba(255,255,255,0.6)' },

  // Typing
  typingBubble: { paddingVertical: 12 },
  typingDots: { flexDirection: 'row' as const, gap: 5 },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },

  // Chips
  chipsWrap: {
    marginTop: 8,
    gap: 7,
    alignItems: 'flex-start' as const,
  },
  chip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipAction: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '40',
  },
  chipBack: {
    backgroundColor: Colors.backgroundCanvas,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  chipTextAction: {
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  chipTextBack: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },

  // Input bar
  inputSafe: {
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  inputBar: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    color: Colors.text,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendBtnDisabled: { opacity: 0.35 },
});
