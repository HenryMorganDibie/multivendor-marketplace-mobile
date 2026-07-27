import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function ChatHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Chat with Vendors',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Pre-Order Chat vs Order Chat</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Pre-Order Chat:</Text> Before placing an order, you can message a vendor to ask questions, discuss custom requests, or clarify details. This is a general conversation not tied to a specific order.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Order Chat:</Text> Once you place an order, a dedicated chat opens for that specific order. Use this to track progress, coordinate pickup/delivery, and handle any order-specific communication.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What You Can Send</Text>
          <Text style={styles.paragraph}>
            In customer chat, you can send:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Text messages</Text>
            <Text style={styles.bullet}>• Images and photos</Text>
            <Text style={styles.bullet}>• Contact cards (view-once, expires after order completion)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What You Cannot Send</Text>
          <Text style={styles.paragraph}>
            The following are not supported in customer chat:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Videos</Text>
            <Text style={styles.bullet}>• Voice messages</Text>
            <Text style={styles.bullet}>• Documents or files</Text>
            <Text style={styles.bullet}>• Location sharing</Text>
          </View>
          <Text style={styles.paragraph}>
            If you need to share complex information, consider using a contact card or sharing a phone number/email via text.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>When Chat Closes Automatically</Text>
          <Text style={styles.paragraph}>
            Order chats remain open during the entire order lifecycle. After an order is completed or cancelled, the chat becomes read-only after a grace period.
          </Text>
          <Text style={styles.paragraph}>
            Pre-order chats remain open indefinitely unless you or the vendor archive the conversation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Chat Notifications</Text>
          <Text style={styles.paragraph}>
            You&apos;ll receive push notifications when vendors reply. You can customize notification settings in your profile under Settings → Notifications.
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
});
