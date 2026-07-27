import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function PaymentHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Payment',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.importantBox}>
          <Text style={styles.importantText}>
            the platform does not receive, hold, or process customer payments.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>How Payment Works</Text>
          <Text style={styles.paragraph}>
            the platform is a marketplace platform that connects customers with vendors. All payments happen directly between you and the vendor, outside of the the platform app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Vendors Send Payment Requests</Text>
          <Text style={styles.paragraph}>
            When it&apos;s time to pay, the vendor will send you a payment request via the order chat. This request includes:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Total amount due</Text>
            <Text style={styles.bullet}>• Payment methods accepted (bank transfer, mobile money, cash, etc.)</Text>
            <Text style={styles.bullet}>• Payment instructions (account numbers, payment links, etc.)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>You Pay Externally</Text>
          <Text style={styles.paragraph}>
            Use the vendor&apos;s provided payment details to send payment through your preferred method. This might be:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Bank transfer</Text>
            <Text style={styles.bullet}>• Mobile money (M-Pesa, Airtel Money, etc.)</Text>
            <Text style={styles.bullet}>• Cash on pickup/delivery</Text>
            <Text style={styles.bullet}>• Third-party payment apps</Text>
          </View>
          <Text style={styles.paragraph}>
            The vendor controls which payment methods they accept.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Confirm Payment in Chat</Text>
          <Text style={styles.paragraph}>
            After you&apos;ve sent payment, return to the order chat and tap &quot;Mark as Paid&quot; on the payment request. This notifies the vendor that payment has been completed.
          </Text>
          <Text style={styles.paragraph}>
            You may be asked to provide a transaction reference or proof of payment via chat or image.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Payment Disputes</Text>
          <Text style={styles.paragraph}>
            Since the platform does not process payments, we cannot handle refunds or payment disputes directly. If there&apos;s an issue with payment, coordinate with the vendor via chat.
          </Text>
          <Text style={styles.paragraph}>
            If you cannot resolve the issue, contact the platform Support for guidance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Your Payment Security</Text>
          <Text style={styles.paragraph}>
            Never share payment details publicly in chat. Only send sensitive information (like transaction IDs) when specifically requested by the vendor.
          </Text>
          <Text style={styles.paragraph}>
            the platform does not ask customers for payment information or banking credentials.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  importantBox: {
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  importantText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFB800',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 8,
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 24,
  },
});
