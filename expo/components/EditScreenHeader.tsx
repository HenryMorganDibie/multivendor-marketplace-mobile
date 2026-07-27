import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface EditScreenHeaderProps {
  title: string;
  onBack: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saveEnabled?: boolean;
  isSaving?: boolean;
  showSave?: boolean;
  testID?: string;
}

export default function EditScreenHeader({
  title,
  onBack,
  onSave,
  saveLabel = 'Save',
  saveEnabled = true,
  isSaving = false,
  showSave = true,
  testID,
}: EditScreenHeaderProps) {
  const canSave = saveEnabled && !isSaving;

  return (
    <View style={styles.header} testID={testID}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.65}
        testID={testID ? `${testID}-back` : undefined}
      >
        <ChevronLeft size={20} color={Colors.text} strokeWidth={2.2} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {showSave && onSave ? (
        <TouchableOpacity
          onPress={canSave ? onSave : undefined}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          disabled={!canSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          testID={testID ? `${testID}-save` : undefined}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.text} />
          ) : (
            <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
              {saveLabel}
            </Text>
          )}
        </TouchableOpacity>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    minHeight: 52,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginHorizontal: 8,
  },
  saveButton: {
    minWidth: 52,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
  },
  placeholder: {
    width: 52,
  },
});
