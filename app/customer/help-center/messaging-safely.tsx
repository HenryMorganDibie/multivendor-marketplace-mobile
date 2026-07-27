import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle } from 'lucide-react-native';

export default function MessagingSafely() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Messaging Safely',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Keep Conversations Inside the platform Chat</Text>
          <Text style={styles.paragraph}>
            Always use the platform&apos;s built-in chat for all order-related communication. This protects both you and the vendor by keeping a record of all conversations.
          </Text>
          <Text style={styles.paragraph}>
            If a vendor asks you to move the conversation to another platform before completing an order, this may be a red flag.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Avoid Sharing Unnecessary Personal Information</Text>
          <Text style={styles.paragraph}>
            Only share contact information when it&apos;s necessary for order fulfillment. Use Contact Cards for sharing phone numbers or emails — they&apos;re view-once and expire after order completion.
          </Text>
          <Text style={styles.paragraph}>
            Never share:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Bank account passwords or PINs</Text>
            <Text style={styles.bullet}>• Social security numbers or ID numbers</Text>
            <Text style={styles.bullet}>• Credit card CVV codes</Text>
            <Text style={styles.bullet}>• Personal addresses (unless needed for delivery)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Report Suspicious Behavior</Text>
          <Text style={styles.paragraph}>
            If a vendor behaves inappropriately or makes you uncomfortable, report them immediately. Examples of suspicious behavior:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Requesting payment outside the platform before order confirmation</Text>
            <Text style={styles.bullet}>• Asking for sensitive personal information</Text>
            <Text style={styles.bullet}>• Pressuring you to complete transactions quickly</Text>
            <Text style={styles.bullet}>• Sending inappropriate or harassing messages</Text>
          </View>
        </View>

        <View style={styles.warningBox}>
          <AlertTriangle size={20} color="#FFB800" style={styles.warningIcon} />
          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>Safety Tip</Text>
            <Text style={styles.warningText}>
              If something feels wrong, trust your instincts. Block the vendor and report the issue to the platform Support.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What You Can Do</Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Block vendors who behave inappropriately</Text>
            <Text style={styles.bullet}>• Report vendors through their profile page</Text>
            <Text style={styles.bullet}>• Archive chats you no longer need</Text>
            <Text style={styles.bullet}>• Contact the platform Support if you need help</Text>
          </View>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related articles</Text>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/chat' as any)}
          >
            <Text style={styles.relatedLinkText}>Chat with Vendors</Text>
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
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderLeftWidth: 4,
    borderLeftColor: '#FFB800',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  warningIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFB800',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
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
