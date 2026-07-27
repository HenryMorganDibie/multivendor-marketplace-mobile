import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CustomerOrderRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (request: {
    description: string;
    quantity?: string;
    dateNeeded?: string;
    fulfillmentPreference?: string;
    notes?: string;
  }) => void;
}

export default function CustomerOrderRequestModal({
  visible,
  onClose,
  onSubmit,
}: CustomerOrderRequestModalProps) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dateNeeded, setDateNeeded] = useState('');
  const [fulfillmentPreference, setFulfillmentPreference] = useState<'pickup' | 'delivery' | ''>('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!description.trim()) return;

    onSubmit({
      description: description.trim(),
      quantity: quantity.trim() || undefined,
      dateNeeded: dateNeeded.trim() || undefined,
      fulfillmentPreference: fulfillmentPreference || undefined,
      notes: notes.trim() || undefined,
    });

    setDescription('');
    setQuantity('');
    setDateNeeded('');
    setFulfillmentPreference('');
    setNotes('');
  };

  const handleClose = () => {
    setDescription('');
    setQuantity('');
    setDateNeeded('');
    setFulfillmentPreference('');
    setNotes('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Custom Order Request</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>
              What are you looking for? <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe what you're looking for"
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Quantity / Size</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 2 plates, Large size"
              placeholderTextColor="#999"
              value={quantity}
              onChangeText={setQuantity}
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Date Needed</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Tomorrow, Jan 15"
              placeholderTextColor="#999"
              value={dateNeeded}
              onChangeText={setDateNeeded}
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Fulfillment Preference</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  fulfillmentPreference === 'pickup' && styles.radioButtonSelected,
                ]}
                onPress={() => setFulfillmentPreference('pickup')}
              >
                <Text
                  style={[
                    styles.radioButtonText,
                    fulfillmentPreference === 'pickup' && styles.radioButtonTextSelected,
                  ]}
                >
                  Pickup
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.radioButton,
                  fulfillmentPreference === 'delivery' && styles.radioButtonSelected,
                ]}
                onPress={() => setFulfillmentPreference('delivery')}
              >
                <Text
                  style={[
                    styles.radioButtonText,
                    fulfillmentPreference === 'delivery' && styles.radioButtonTextSelected,
                  ]}
                >
                  Delivery
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Additional Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any other details..."
              placeholderTextColor="#999"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={300}
            />
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, !description.trim() && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!description.trim()}
          >
            <Text style={styles.submitButtonText}>Send request</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#000',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '500' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#000',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  radioGroup: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  radioButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    alignItems: 'center' as const,
    backgroundColor: '#fff',
  },
  radioButtonSelected: {
    borderColor: '#000',
    backgroundColor: '#f8f8f8',
  },
  radioButtonText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#666',
  },
  radioButtonTextSelected: {
    color: '#000',
    fontWeight: '600' as const,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  submitButton: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  submitButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#fff',
  },
});
