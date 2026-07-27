import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function CustomOrder() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Custom Orders',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>What Is a Custom Order?</Text>
          <Text style={styles.paragraph}>
            A custom order is created by the vendor based on your specific request. This allows you to order items that aren&apos;t in the vendor&apos;s catalog, request modifications, or negotiate custom pricing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>How It Appears in Chat</Text>
          <Text style={styles.paragraph}>
            When a vendor creates a custom order for you, it appears in your chat as a preview card. This card shows:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Primary item image (or fallback icon)</Text>
            <Text style={styles.bullet}>• Item count (e.g. &quot;3 items&quot;)</Text>
            <Text style={styles.bullet}>• Estimated total amount</Text>
            <Text style={styles.bullet}>• Timestamp</Text>
            <Text style={styles.bullet}>• &quot;View custom order&quot; button</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Viewing Full Details</Text>
          <Text style={styles.paragraph}>
            Tap &quot;View custom order&quot; to open the full Custom Order Details page. Here you&apos;ll see:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Complete list of items</Text>
            <Text style={styles.bullet}>• Item quantities and prices</Text>
            <Text style={styles.bullet}>• Subtotal, tax (if applicable), and total</Text>
            <Text style={styles.bullet}>• Any notes or special instructions from the vendor</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Accepting or Declining</Text>
          <Text style={styles.paragraph}>
            After reviewing the custom order details, you can:
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Accept:</Text> The custom order becomes an active order and moves to &quot;Pending&quot; status. The vendor will then begin preparing your order.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Decline:</Text> The custom order is rejected. You can message the vendor to discuss changes or alternatives.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Multiple Active Orders</Text>
          <Text style={styles.paragraph}>
            If you have multiple active orders with the same vendor, they appear in the horizontal Active Orders rail above your chat messages. Each order can be accessed independently.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>When to Request a Custom Order</Text>
          <Text style={styles.paragraph}>
            Custom orders are useful for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Items not in the vendor&apos;s catalog</Text>
            <Text style={styles.bullet}>• Bulk orders with special pricing</Text>
            <Text style={styles.bullet}>• Modified versions of catalog items</Text>
            <Text style={styles.bullet}>• Complex requests requiring vendor approval</Text>
          </View>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related articles</Text>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/how-ordering-works' as any)}
          >
            <Text style={styles.relatedLinkText}>How ordering works on the platform</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/order-status' as any)}
          >
            <Text style={styles.relatedLinkText}>Order Status</Text>
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
  bold: {
    fontWeight: '600' as const,
    color: '#fff',
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
