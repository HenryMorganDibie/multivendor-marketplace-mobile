import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Modal,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { useCatalog } from '@/contexts/CatalogContext';
import { Colors } from '@/constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AddCategoryScreen() {
  const { addCategory, categories } = useCatalog();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');

  const isDuplicate = categories.some(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase()
  );
  const isValid = name.trim().length > 0 && !isDuplicate;

  const handleSave = () => {
    if (!isValid) return;
    addCategory(name.trim());
    router.back();
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Pressable style={styles.overlay} onPress={handleCancel}>
        <Pressable onPress={(e) => e.stopPropagation()} style={styles.sheet}>
          {/* Drag handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>New Category</Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            Choose a name customers will see when browsing your catalog.
          </Text>

          {/* Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g., Desserts, Main Dishes"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
            {name.length > 0 && (
              <Text style={styles.charCount}>{name.length}/50</Text>
            )}
          </View>

          {/* Duplicate warning */}
          {name.trim().length > 0 && isDuplicate && (
            <View style={styles.warning}>
              <Text style={styles.warningText}>A category with this name already exists.</Text>
            </View>
          )}

          {/* CTA */}
          <TouchableOpacity
            style={[styles.createBtn, !isValid && styles.createBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid}
            activeOpacity={0.8}
          >
            <Text style={[styles.createBtnText, !isValid && styles.createBtnTextDisabled]}>
              Create Category
            </Text>
          </TouchableOpacity>

          <View style={{ height: insets.bottom > 0 ? insets.bottom : 16 }} />
        </Pressable>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cancelBtn: {
    width: 64,
  },
  cancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  inputWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    padding: 0,
    letterSpacing: -0.2,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '400',
  },
  warning: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  warningText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  createBtnDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  createBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: -0.2,
  },
  createBtnTextDisabled: {
    color: Colors.textMuted,
  },
});
