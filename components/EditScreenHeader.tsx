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
        testID={testID ? `${testID}-back` : undefined}
      >
        <ChevronLeft size={24} color={Colors.text} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {showSave && onSave ? (
        <TouchableOpacity
          onPress={onSave}
          style={styles.saveButton}
          disabled={!canSave}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={testID ? `${testID}-save` : undefined}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text
              style={[
                styles.saveText,
                !canSave && styles.saveTextDisabled,
              ]}
            >
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    minHeight: 44,
  },
  backButton: {
    width: 40,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginHorizontal: 4,
  },
  saveButton: {
    minWidth: 40,
    height: 36,
    alignItems: 'flex-end' as const,
    justifyContent: 'center' as const,
    paddingRight: 4,
  },
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.5,
  },
  placeholder: {
    width: 40,
  },
});
