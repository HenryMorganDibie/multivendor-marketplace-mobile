import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { MessageCircle, Share2, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useInvoices } from '@/contexts/InvoiceContext';
import { formatPrice } from '@/utils/formatPrice';
import EditScreenHeader from '@/components/EditScreenHeader';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';

export default function SendInvoiceScreen() {
  const { invoiceId } = useLocalSearchParams();
  const { getInvoiceById, sendInvoiceInChat, markInvoiceSharedExternally } = useInvoices();
  const invoice = getInvoiceById(invoiceId as string);

  const [showNoChatModal, setShowNoChatModal] = useState(false);
  const [isSharingExternally, setIsSharingExternally] = useState(false);

  if (!invoice) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <EditScreenHeader title="Send Invoice" onBack={() => router.back()} showSave={false} />
        </SafeAreaView>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Invoice not found</Text>
        </View>
      </View>
    );
  }

  /** Internal chat send — only allowed when a chatId is already bound */
  const handleSendInChat = async () => {
    if (!invoice.chatId) {
      // No valid the platform chat is bound — show the blocking modal
      setShowNoChatModal(true);
      return;
    }
    try {
      await sendInvoiceInChat(invoice.id, invoice.chatId, invoice.customerId);
      router.replace({
        pathname: '/vendor/(tabs)/chats',
      } as any);
    } catch (error) {
      console.error('Error sending invoice in chat:', error);
    }
  };

  /** External share — opens native share sheet; no fake success modal */
  const handleShareExternally = async () => {
    const itemLines = invoice.items
      .map((item) => `• ${item.name} ×${item.quantity}: ${formatPrice(item.total, invoice.currency)}`)
      .join('\n');
    const message =
      `Invoice ${invoice.invoiceNumber}\n` +
      `Customer: ${invoice.customerName}\n` +
      (invoice.customerPhone ? `Phone: ${invoice.customerPhone}\n` : '') +
      `\nItems:\n${itemLines}\n` +
      `\nTotal: ${formatPrice(invoice.total, invoice.currency)}` +
      (invoice.notes ? `\n\nNotes: ${invoice.notes}` : '');

    setIsSharingExternally(true);
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({ title: `Invoice ${invoice.invoiceNumber}`, text: message });
        } else {
          await navigator.clipboard.writeText(message);
        }
      } else {
        await Share.share({ message, title: `Invoice ${invoice.invoiceNumber}` });
      }
      // Only update status after the share sheet is dismissed — no alert
      await markInvoiceSharedExternally(invoice.id);
    } catch (error) {
      // User cancelled share — do nothing
    } finally {
      setIsSharingExternally(false);
    }
  };

  const isAlreadySent =
    invoice.status === 'sent_in_chat' || invoice.status === 'shared_externally';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Send Invoice" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* INVOICE PREVIEW CARD */}
          <Text style={styles.sectionTitle}>INVOICE PREVIEW</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewInvoiceNumber}>{invoice.invoiceNumber}</Text>
                <Text style={styles.previewCustomer}>{invoice.customerName}</Text>
                {invoice.customerPhone ? (
                  <Text style={styles.previewContact}>{invoice.customerPhone}</Text>
                ) : null}
                {invoice.customerEmail ? (
                  <Text style={styles.previewContact}>{invoice.customerEmail}</Text>
                ) : null}
              </View>
              <Text style={styles.previewTotal}>{formatPrice(invoice.total, invoice.currency)}</Text>
            </View>

            <View style={styles.previewDivider} />

            {invoice.items.map((item, index) => (
              <View key={index} style={styles.previewItemRow}>
                <View style={styles.previewItemLeft}>
                  <Text style={styles.previewItemName}>{item.name}</Text>
                  <Text style={styles.previewItemQty}>
                    ×{item.quantity} @ {formatPrice(item.unitPrice, invoice.currency)}
                  </Text>
                </View>
                <Text style={styles.previewItemTotal}>
                  {formatPrice(item.total, invoice.currency)}
                </Text>
              </View>
            ))}

            {invoice.items.length > 0 && <View style={styles.previewDivider} />}

            <View style={styles.previewTotalsRow}>
              <Text style={styles.previewTotalsLabel}>Total</Text>
              <Text style={styles.previewTotalsValue}>
                {formatPrice(invoice.total, invoice.currency)}
              </Text>
            </View>
          </View>

          {/* STATUS NOTE if already delivered */}
          {isAlreadySent && (
            <View style={styles.alreadySentBanner}>
              <AlertCircle size={15} color={Colors.primary} />
              <Text style={styles.alreadySentText}>
                {invoice.status === 'sent_in_chat'
                  ? 'This invoice was already sent in a the platform chat.'
                  : 'This invoice was already shared externally.'}
                {' '}You can resend it below.
              </Text>
            </View>
          )}

          {/* SEND OPTIONS */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SEND OPTIONS</Text>

          {/* Internal — requires bound chatId */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleSendInChat}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: Colors.primarySoft }]}>
              <MessageCircle size={22} color={Colors.primary} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Send in the platform Chat</Text>
              <Text style={styles.optionDescription}>
                {invoice.chatId
                  ? 'Attach this invoice to the customer\'s existing chat thread.'
                  : 'Requires an open customer conversation. Tap to learn more.'}
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* External share */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleShareExternally}
            activeOpacity={0.7}
            disabled={isSharingExternally}
          >
            <View style={[styles.optionIconWrap, { backgroundColor: '#E8F8EE' }]}>
              <Share2 size={22} color={Colors.success} />
            </View>
            <View style={styles.optionBody}>
              <Text style={styles.optionTitle}>Share Externally</Text>
              <Text style={styles.optionDescription}>
                Send via WhatsApp, SMS, email, or any other app. No the platform account needed.
              </Text>
            </View>
            <ChevronRight size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* External note */}
          <Text style={styles.footerNote}>
            External sharing does not require a the platform account. Internal chat sending requires an existing customer conversation.
          </Text>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {/* BLOCKING MODAL — no valid chat bound */}
      <LaektivaModal
        visible={showNoChatModal}
        title="No the platform chat selected"
        message="To send an invoice inside the platform, select an existing customer conversation or share this invoice externally."
        primaryButton={{
          label: 'Select Chat',
          onPress: () => {
            setShowNoChatModal(false);
            router.push('/vendor/(tabs)/chats' as any);
          },
        }}
        secondaryButton={{
          label: 'Share Externally',
          onPress: () => {
            setShowNoChatModal(false);
            handleShareExternally();
          },
        }}
        tertiaryButton={{
          label: 'Cancel',
          onPress: () => setShowNoChatModal(false),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  errorText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  // Invoice preview card
  previewCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  previewHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  previewInvoiceNumber: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  previewCustomer: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  previewContact: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 1,
  },
  previewTotal: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  previewDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  previewItemRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
    paddingVertical: 4,
  },
  previewItemLeft: {
    flex: 1,
  },
  previewItemName: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  previewItemQty: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  previewItemTotal: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  previewTotalsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  previewTotalsLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  previewTotalsValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  // Already sent banner
  alreadySentBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  alreadySentText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  // Option cards
  optionCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  optionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  optionBody: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    textAlign: 'center' as const,
    paddingHorizontal: 8,
    marginTop: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
