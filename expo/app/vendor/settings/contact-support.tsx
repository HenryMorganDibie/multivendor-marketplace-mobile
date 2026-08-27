import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import { Paperclip, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import * as ImagePicker from 'expo-image-picker';
import { callable } from '@/lib/firebase';

interface CreateTicketResponse {
  success: true;
  ticketId: string;
  chatId: string;
  created: boolean;
}

export default function ContactSupportScreen() {
  const routerNav = useRouter();
  const [message, setMessage] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages(prev => [...prev, ...newImages].slice(0, 3));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  // Files into the same real support-ticket system as report-problem.tsx and
  // support-chat.tsx (createSupportTicket/sendChatMessage), rather than the
  // console.log-and-fake-success this screen previously did. Picked images
  // are still previewed but not uploaded anywhere - no screen in the app has
  // a real chat-attachment upload path yet, so that stays unbuilt, not a
  // regression from this fix.
  const handleSend = async () => {
    if (!message.trim()) return;

    setIsSending(true);
    try {
      const createTicket = callable<{ subject: string; initialMessage: string }, CreateTicketResponse>(
        'createSupportTicket'
      );
      const res = await createTicket({ subject: 'Contact Support', initialMessage: message.trim() });

      if (!res.data.created) {
        const sendMessage = callable<{ chatId: string; type: string; content: string }, unknown>(
          'sendChatMessage'
        );
        await sendMessage({ chatId: res.data.chatId, type: 'text', content: message.trim() });
      }

      setIsSending(false);
      Alert.alert('', 'Message sent. We\'ll get back to you soon.');
      router.back();
    } catch (error) {
      setIsSending(false);
      const msg = (error as { message?: string })?.message ?? 'Could not send your message. Please try again.';
      Alert.alert('Could not send', msg);
    }
  };

  const canSend = message.trim().length > 0;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Contact Support"
          onBack={() => routerNav.back()}
          onSave={handleSend}
          saveLabel={isSending ? 'Sending...' : 'Send'}
          saveEnabled={canSend && !isSending}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue or question..."
            placeholderTextColor="#666"
            multiline
            autoFocus
          />

          {images.length > 0 && (
            <View style={styles.imagePreviewContainer}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imagePreview}>
                  <Image source={{ uri }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemoveImage(index)}
                    activeOpacity={0.7}
                  >
                    <X size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handlePickImage}
            activeOpacity={0.7}
            disabled={images.length >= 3}
          >
            <Paperclip size={24} color={images.length >= 3 ? '#666' : '#0A84FF'} />
          </TouchableOpacity>
          {images.length > 0 && (
            <Text style={styles.imageCount}>{images.length}/3</Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  messageInput: {
    fontSize: 17,
    color: '#FFFFFF',
    minHeight: 200,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  imagePreview: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  attachButton: {
    padding: 8,
  },
  imageCount: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  sendButton: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0A84FF',
    marginRight: 16,
  },
  sendButtonDisabled: {
    color: '#666',
  },
});
