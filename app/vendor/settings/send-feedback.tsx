import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

type FeedbackType = 'feature' | 'problem' | 'general' | null;

export default function SendFeedbackScreen() {
  const params = useLocalSearchParams();
  const [selectedType, setSelectedType] = useState<FeedbackType>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (params.type === 'problem') {
      setSelectedType('problem');
    }
  }, [params.type]);

  const handleSend = async () => {
    if (!selectedType || !message.trim()) {
      return;
    }

    setIsSending(true);
    console.log('Send feedback:', { type: selectedType, message });
    
    setTimeout(() => {
      setIsSending(false);
      Alert.alert('', 'Feedback sent. Thank you.');
      router.back();
    }, 1000);
  };

  const canSend = selectedType !== null && message.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Send Feedback',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SELECT TYPE</Text>
            <View style={styles.glassCard}>
              <TouchableOpacity
                style={[
                  styles.typeOption,
                  selectedType === 'feature' && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType('feature')}
                activeOpacity={0.8}
              >
                <View style={styles.typeInfo}>
                  <Text style={styles.typeName}>Suggest a feature</Text>
                  <Text style={styles.typeDescription}>
                    Share ideas for new features or improvements
                  </Text>
                </View>
                {selectedType === 'feature' && <View style={styles.selectedBadge} />}
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  selectedType === 'problem' && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType('problem')}
                activeOpacity={0.8}
              >
                <View style={styles.typeInfo}>
                  <Text style={styles.typeName}>Report a problem</Text>
                  <Text style={styles.typeDescription}>
                    Let us know about bugs or issues
                  </Text>
                </View>
                {selectedType === 'problem' && <View style={styles.selectedBadge} />}
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[
                  styles.typeOption,
                  selectedType === 'general' && styles.typeOptionSelected,
                ]}
                onPress={() => setSelectedType('general')}
                activeOpacity={0.8}
              >
                <View style={styles.typeInfo}>
                  <Text style={styles.typeName}>General feedback</Text>
                  <Text style={styles.typeDescription}>
                    Share your thoughts and experiences
                  </Text>
                </View>
                {selectedType === 'general' && <View style={styles.selectedBadge} />}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MESSAGE</Text>
            <View style={styles.glassCard}>
              <TextInput
                style={styles.messageInput}
                value={message}
                onChangeText={(text) => {
                  if (text.length <= 500) {
                    setMessage(text);
                  }
                }}
                placeholder="Tell us more..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={8}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.charCount}>{message.length} / 500</Text>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.sendButton, (!canSend || isSending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            activeOpacity={0.8}
            disabled={!canSend || isSending}
          >
            <Text style={[styles.sendButtonText, (!canSend || isSending) && styles.sendButtonTextDisabled]}>
              {isSending ? 'Sending...' : 'Send Feedback'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
  },
  typeOption: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
  typeOptionSelected: {
    opacity: 1,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0A84FF',
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 16,
  },
  messageInput: {
    fontSize: 17,
    color: '#FFFFFF',
    minHeight: 150,
    padding: 0,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 13,
    color: '#666',
    textAlign: 'right' as const,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  sendButton: {
    backgroundColor: '#0A84FF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: '#2C2C2E',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  sendButtonTextDisabled: {
    color: '#666',
  },
  bottomSpacer: {
    height: 40,
  },
});
