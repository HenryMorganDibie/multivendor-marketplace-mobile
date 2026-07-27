import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';

export default function ContactSupport() {
  const router = useRouter();
  const [issueDescription, setIssueDescription] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);

  const handleSubmit = () => {
    if (issueDescription.trim().length < 10) {
      Alert.alert('Description Required', 'Please provide a detailed description of your issue (at least 10 characters).');
      return;
    }

    console.log('Support request submitted:', issueDescription);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Contact Support',
            headerStyle: { backgroundColor: '#000' },
            headerTintColor: '#fff',
            headerTitleStyle: { color: '#fff' },
          }}
        />
        <View style={styles.successContainer}>
          <CheckCircle size={64} color="#00C853" />
          <Text style={styles.successTitle}>Request Submitted</Text>
          <Text style={styles.successMessage}>
            Thank you for contacting the platform Support. We&apos;ve received your request and will respond as soon as possible.
          </Text>
          <Text style={styles.successSubtext}>
            You&apos;ll receive a response via email within 24-48 hours.
          </Text>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Contact Support',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          Having an issue? Describe the problem below and our support team will get back to you.
        </Text>

        <View style={styles.formSection}>
          <Text style={styles.label}>Issue Description</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Describe your issue in detail..."
            placeholderTextColor="#666"
            value={issueDescription}
            onChangeText={setIssueDescription}
            multiline
            numberOfLines={8}
            textAlignVertical="top"
          />
          <Text style={styles.helperText}>
            Include as much detail as possible, such as what you were doing when the issue occurred, error messages, and device information.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What to expect:</Text>
          <Text style={styles.infoText}>
            • Our team reviews all support requests{'\n'}
            • You&apos;ll receive a response within 24-48 hours{'\n'}
            • Complex issues may require additional follow-up{'\n'}
            • Check your email for our response
          </Text>
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          activeOpacity={0.7}
        >
          <Text style={styles.submitButtonText}>Submit Request</Text>
        </TouchableOpacity>
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
  description: {
    fontSize: 15,
    color: '#888',
    lineHeight: 22,
    marginBottom: 24,
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#fff',
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 22,
  },
  submitButton: {
    backgroundColor: '#0096FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#fff',
    marginTop: 24,
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  doneButton: {
    backgroundColor: '#0096FF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 32,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
