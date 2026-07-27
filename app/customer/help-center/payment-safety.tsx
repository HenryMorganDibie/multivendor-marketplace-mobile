import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ShieldAlert } from 'lucide-react-native';

export default function PaymentSafety() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Payment Safety',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.importantBox}>
          <ShieldAlert size={20} color="#FFB800" style={styles.importantIcon} />
          <View style={styles.importantContent}>
            <Text style={styles.importantTitle}>Important</Text>
            <Text style={styles.importantText}>
              the platform does not receive, hold, or process customer payments. All payments are made directly between you and the vendor.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Only Pay After Reviewing Order Details</Text>
          <Text style={styles.paragraph}>
            Never send payment before you&apos;ve:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Reviewed the complete order details</Text>
            <Text style={styles.bullet}>• Confirmed pricing and item quantities</Text>
            <Text style={styles.bullet}>• Received a formal payment request from the vendor</Text>
            <Text style={styles.bullet}>• Verified the vendor&apos;s payment instructions</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Confirm Vendor Details Before Paying</Text>
          <Text style={styles.paragraph}>
            Before sending payment, double-check:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• The vendor&apos;s account name matches their the platform profile</Text>
            <Text style={styles.bullet}>• Payment account numbers or details look legitimate</Text>
            <Text style={styles.bullet}>• The amount matches your order total</Text>
          </View>
          <Text style={styles.paragraph}>
            If something doesn&apos;t match, ask the vendor to clarify before proceeding.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Keep Payment Proof</Text>
          <Text style={styles.paragraph}>
            Always save proof of payment:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Transaction receipts</Text>
            <Text style={styles.bullet}>• Reference numbers</Text>
            <Text style={styles.bullet}>• Screenshots of completed transfers</Text>
            <Text style={styles.bullet}>• Bank confirmation messages</Text>
          </View>
          <Text style={styles.paragraph}>
            You may need these if there&apos;s a dispute or if the vendor requests proof that payment was sent.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Use Chat History as Reference</Text>
          <Text style={styles.paragraph}>
            All communication in the platform chat is saved. Use this as a record of:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Payment requests</Text>
            <Text style={styles.bullet}>• Agreed-upon amounts</Text>
            <Text style={styles.bullet}>• Payment instructions</Text>
            <Text style={styles.bullet}>• Delivery or pickup arrangements</Text>
          </View>
          <Text style={styles.paragraph}>
            Never move financial discussions outside the platform chat.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Red Flags to Watch For</Text>
          <Text style={styles.paragraph}>
            Be cautious if a vendor:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Requests payment before order confirmation</Text>
            <Text style={styles.bullet}>• Asks you to pay to a different person&apos;s account</Text>
            <Text style={styles.bullet}>• Pressures you to pay immediately without explanation</Text>
            <Text style={styles.bullet}>• Refuses to provide proper payment instructions</Text>
            <Text style={styles.bullet}>• Asks for payment via unusual or untraceable methods</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>If Something Goes Wrong</Text>
          <Text style={styles.paragraph}>
            If you encounter payment issues:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Contact the vendor via order chat first</Text>
            <Text style={styles.bullet}>• Save all proof of payment and communication</Text>
            <Text style={styles.bullet}>• If unresolved, report the vendor through their profile</Text>
            <Text style={styles.bullet}>• Contact the platform Support for guidance</Text>
          </View>
          <Text style={styles.paragraph}>
            While the platform cannot refund payments, we can investigate vendor behavior and take action if policies are violated.
          </Text>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related articles</Text>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/payment' as any)}
          >
            <Text style={styles.relatedLinkText}>How payments work on the platform</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/reporting-problem' as any)}
          >
            <Text style={styles.relatedLinkText}>Reporting a problem</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
  },
  importantBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  importantIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  importantContent: {
    flex: 1,
  },
  importantTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFB800',
    marginBottom: 4,
  },
  importantText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 20,
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
  relatedSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  relatedLink: {
    paddingVertical: 12,
  },
  relatedLinkText: {
    fontSize: 15,
    color: '#0096FF',
  },
});
