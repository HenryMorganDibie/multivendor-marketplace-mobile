import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useVendorAwayMessage, AwayScheduleType, formatTime } from '@/contexts/VendorAwayMessageContext';

const SCHEDULE_OPTIONS: { value: AwayScheduleType; label: string; description: string }[] = [
  {
    value: 'always',
    label: 'Always send',
    description: 'Send an away message whenever a customer contacts you.',
  },
  {
    value: 'outside_business_hours',
    label: 'Outside business hours',
    description: 'Active when outside standard hours (9 AM – 6 PM).',
  },
  {
    value: 'custom',
    label: 'Custom schedule',
    description: 'Set a specific time window for your away message.',
  },
];

const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    options.push(`${String(h).padStart(2, '0')}:00`);
    options.push(`${String(h).padStart(2, '0')}:30`);
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export default function AwayMessageScheduleScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useVendorAwayMessage();

  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  const handleSelectSchedule = (value: AwayScheduleType) => {
    void updateSettings({ schedule: value });
    console.log('[AwayMessageSchedule] Schedule selected:', value);
  };

  const handleTimeSelect = (time: string) => {
    if (pickerTarget === 'start') {
      void updateSettings({ customScheduleStart: time });
    } else if (pickerTarget === 'end') {
      void updateSettings({ customScheduleEnd: time });
    }
    setPickerTarget(null);
    console.log('[AwayMessageSchedule] Time selected:', time, 'for', pickerTarget);
  };

  const renderRadioOption = (
    option: { value: AwayScheduleType; label: string; description: string }
  ) => {
    const isSelected = settings.schedule === option.value;
    return (
      <TouchableOpacity
        key={option.value}
        style={styles.optionRow}
        onPress={() => handleSelectSchedule(option.value)}
        activeOpacity={0.7}
        testID={`schedule-option-${option.value}`}
      >
        <View style={styles.optionContent}>
          <View style={styles.radioContainer}>
            <View style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
          </View>
          <View style={styles.optionTextGroup}>
            <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
              {option.label}
            </Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Schedule" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>SEND AWAY MESSAGE</Text>
          <View style={styles.card}>
            {SCHEDULE_OPTIONS.map((option, index) => (
              <View key={option.value}>
                {renderRadioOption(option)}
                {index < SCHEDULE_OPTIONS.length - 1 && <View style={styles.divider} />}
              </View>
            ))}
          </View>

          {settings.schedule === 'custom' && (
            <>
              <Text style={styles.sectionLabel}>CUSTOM TIME WINDOW</Text>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.timeRow}
                  onPress={() => setPickerTarget('start')}
                  activeOpacity={0.7}
                  testID="custom-start-time"
                >
                  <Text style={styles.timeLabel}>Start time</Text>
                  <View style={styles.timeValueContainer}>
                    <Text style={styles.timeValue}>
                      {formatTime(settings.customScheduleStart)}
                    </Text>
                    <View style={styles.timeChevron}>
                      <Check size={14} color={Colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.timeRow}
                  onPress={() => setPickerTarget('end')}
                  activeOpacity={0.7}
                  testID="custom-end-time"
                >
                  <Text style={styles.timeLabel}>End time</Text>
                  <View style={styles.timeValueContainer}>
                    <Text style={styles.timeValue}>
                      {formatTime(settings.customScheduleEnd)}
                    </Text>
                    <View style={styles.timeChevron}>
                      <Check size={14} color={Colors.primary} />
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
              <Text style={styles.customNote}>
                Away messages will be sent when a customer contacts you within this time window.
                The window can span overnight (e.g. 10 PM – 8 AM).
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={pickerTarget !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerTarget(null)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setPickerTarget(null)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {pickerTarget === 'start' ? 'Start time' : 'End time'}
                </Text>
                <TouchableOpacity
                  onPress={() => setPickerTarget(null)}
                  style={styles.pickerCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={TIME_OPTIONS}
                keyExtractor={item => item}
                showsVerticalScrollIndicator={false}
                style={styles.timeList}
                getItemLayout={(_, index) => ({ length: 52, offset: 52 * index, index })}
                renderItem={({ item }) => {
                  const isActive =
                    (pickerTarget === 'start' && item === settings.customScheduleStart) ||
                    (pickerTarget === 'end' && item === settings.customScheduleEnd);
                  return (
                    <TouchableOpacity
                      style={[styles.timeOption, isActive && styles.timeOptionActive]}
                      onPress={() => handleTimeSelect(item)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.timeOptionText, isActive && styles.timeOptionTextActive]}>
                        {formatTime(item)}
                      </Text>
                      {isActive && <Check size={18} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerBack: {
    padding: 4,
    marginLeft: -4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionContent: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 14,
  },
  radioContainer: {
    paddingTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.borderDark,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  optionTextGroup: {
    flex: 1,
    gap: 3,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  optionLabelSelected: {
    color: Colors.primary,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  timeValueContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  timeValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  timeChevron: {
    width: 24,
    height: 24,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  customNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  pickerContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    maxHeight: 420,
  },
  pickerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickerCancel: {
    padding: 4,
  },
  pickerCancelText: {
    fontSize: 16,
    color: Colors.primary,
  },
  timeList: {
    paddingHorizontal: 16,
  },
  timeOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    height: 52,
  },
  timeOptionActive: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 2,
  },
  timeOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  timeOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
