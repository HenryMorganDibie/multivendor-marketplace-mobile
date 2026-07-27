import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal } from 'react-native';
import { Calendar, CheckCircle, ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { SchedulingPicker } from '@/hooks/useSchedulingPicker';

interface SchedulingSheetProps {
  vm: SchedulingPicker;
  /** Title shown in the sheet header. */
  title?: string;
  /** Optional helper text shown above the calendar (checkout shows the
   *  vendor's availability disclaimer; invoices omit it). */
  helperText?: string;
}

/**
 * Shared bottom-sheet date/time picker — identical UI and behaviour to the
 * customer checkout scheduling flow: month calendar + time wheel (hour /
 * 15-min / AM-PM), "Remove preference" action, Cancel / Done header.
 *
 * Reused by Create Invoice so vendors see one consistent picker across the
 * app instead of a second date/time system.
 */
export default function SchedulingSheet({
  vm,
  title = 'Schedule Time',
  helperText,
}: SchedulingSheetProps) {
  return (
    <Modal
      visible={vm.isDateTimeModalVisible}
      animationType="slide"
      transparent
      onRequestClose={vm.handleCancelDateTime}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity onPress={vm.handleCancelDateTime} style={styles.actionButton}>
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={vm.handleConfirmDateTime} style={styles.actionButton}>
              <Text style={[styles.actionText, styles.actionTextPrimary]}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}

            <View style={styles.calendarContainer}>
              <View style={styles.monthHeader}>
                <TouchableOpacity
                  onPress={() => {
                    const newMonth = new Date(vm.selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() - 1);
                    vm.setSelectedMonth(newMonth);
                  }}
                  style={styles.monthButton}
                >
                  <Text style={styles.monthButtonText}>{'<'}</Text>
                </TouchableOpacity>
                <Text style={styles.monthTitle}>
                  {vm.selectedMonth.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newMonth = new Date(vm.selectedMonth);
                    newMonth.setMonth(newMonth.getMonth() + 1);
                    vm.setSelectedMonth(newMonth);
                  }}
                  style={styles.monthButton}
                >
                  <Text style={styles.monthButtonText}>{'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.weekDaysHeader}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                  <Text key={index} style={styles.weekDayText}>
                    {day}
                  </Text>
                ))}
              </View>

              <View style={styles.calendarGrid}>
                {(() => {
                  const year = vm.selectedMonth.getFullYear();
                  const month = vm.selectedMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days: React.ReactElement[] = [];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  for (let i = 0; i < firstDay; i++) {
                    days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
                  }

                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    date.setHours(0, 0, 0, 0);
                    const isSelected =
                      vm.preferredDate &&
                      date.toDateString() === vm.preferredDate.toDateString();
                    const isPast = date < today;
                    const dayNum = day;

                    days.push(
                      <TouchableOpacity
                        key={day}
                        style={[styles.calendarDay, !isPast && styles.calendarDayActive]}
                        onPress={() => {
                          if (!isPast) {
                            vm.setPreferredDate(new Date(year, month, dayNum));
                          }
                        }}
                        activeOpacity={isPast ? 1 : 0.7}
                        disabled={isPast}
                      >
                        <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                          <Text
                            style={[
                              styles.dayText,
                              isSelected && styles.dayTextSelected,
                              isPast && styles.dayTextDisabled,
                            ]}
                          >
                            {dayNum}
                          </Text>
                        </View>
                      </TouchableOpacity>,
                    );
                  }

                  return days;
                })()}
              </View>
            </View>

            {vm.preferredDate &&
              (() => {
                const now = new Date();
                const isToday = vm.preferredDate.toDateString() === now.toDateString();
                const currentHour24 = now.getHours();
                const currentMinute = now.getMinutes();
                const bufferMinutes = 15;

                const isTimeDisabled = (
                  hour: number,
                  minute: number,
                  period: 'AM' | 'PM',
                ) => {
                  if (!isToday) return false;
                  let hour24 = hour;
                  if (period === 'PM' && hour !== 12) {
                    hour24 = hour + 12;
                  } else if (period === 'AM' && hour === 12) {
                    hour24 = 0;
                  }
                  const selectedTimeInMinutes = hour24 * 60 + minute;
                  const currentTimeInMinutes = currentHour24 * 60 + currentMinute + bufferMinutes;
                  return selectedTimeInMinutes < currentTimeInMinutes;
                };

                return (
                  <View style={styles.timePickerSection}>
                    <Text style={styles.timePickerSectionTitle}>Time</Text>
                    <View style={styles.timePickerColumns}>
                      <ScrollView
                        style={styles.timePickerColumn}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.timePickerColumnContent}
                      >
                        {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => {
                          const isDisabled =
                            vm.selectedPeriod === 'AM'
                              ? isTimeDisabled(hour, vm.selectedMinute, 'AM')
                              : isTimeDisabled(hour, vm.selectedMinute, 'PM');
                          return (
                            <TouchableOpacity
                              key={hour}
                              style={styles.timePickerItem}
                              onPress={() => !isDisabled && vm.setSelectedHour(hour)}
                              activeOpacity={isDisabled ? 1 : 0.7}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  styles.timePickerItemText,
                                  vm.selectedHour === hour && styles.timePickerItemTextSelected,
                                  isDisabled && styles.timePickerItemTextDisabled,
                                ]}
                              >
                                {hour}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <ScrollView
                        style={styles.timePickerColumn}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.timePickerColumnContent}
                      >
                        {[0, 15, 30, 45].map((minute) => {
                          const isDisabled = isTimeDisabled(
                            vm.selectedHour,
                            minute,
                            vm.selectedPeriod,
                          );
                          return (
                            <TouchableOpacity
                              key={minute}
                              style={styles.timePickerItem}
                              onPress={() => !isDisabled && vm.setSelectedMinute(minute)}
                              activeOpacity={isDisabled ? 1 : 0.7}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  styles.timePickerItemText,
                                  vm.selectedMinute === minute &&
                                    styles.timePickerItemTextSelected,
                                  isDisabled && styles.timePickerItemTextDisabled,
                                ]}
                              >
                                {minute.toString().padStart(2, '0')}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>

                      <ScrollView
                        style={styles.timePickerColumn}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.timePickerColumnContent}
                      >
                        {(['AM', 'PM'] as const).map((period) => {
                          const isDisabled = isTimeDisabled(
                            vm.selectedHour,
                            vm.selectedMinute,
                            period,
                          );
                          return (
                            <TouchableOpacity
                              key={period}
                              style={styles.timePickerItem}
                              onPress={() => !isDisabled && vm.setSelectedPeriod(period)}
                              activeOpacity={isDisabled ? 1 : 0.7}
                              disabled={isDisabled}
                            >
                              <Text
                                style={[
                                  styles.timePickerItemText,
                                  vm.selectedPeriod === period &&
                                    styles.timePickerItemTextSelected,
                                  isDisabled && styles.timePickerItemTextDisabled,
                                ]}
                              >
                                {period}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  </View>
                );
              })()}

            {vm.preferredDate && (
              <TouchableOpacity
                style={styles.removePreferenceButton}
                onPress={vm.handleRemoveDateTime}
                activeOpacity={0.7}
              >
                <Text style={styles.removePreferenceText}>Remove preference</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Compact "Date & time" trigger row that opens the shared scheduling sheet.
 * Matches the checkout styling: calendar icon on the left, summary or
 * placeholder in the middle, status icon on the right.
 */
export function SchedulingTriggerRow({
  label,
  placeholder,
  summary,
  hasValue,
  onOpen,
}: {
  label: string;
  placeholder: string;
  summary: string | null;
  hasValue: boolean;
  onOpen: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.schedulePickerRow, hasValue && styles.schedulePickerRowFilled]}
      onPress={onOpen}
      activeOpacity={0.7}
    >
      <Calendar size={17} color={hasValue ? Colors.primary : Colors.textMuted} />
      <Text style={[styles.schedulePickerText, hasValue && styles.schedulePickerTextFilled]}>
        {summary ?? placeholder}
      </Text>
      {hasValue ? (
        <CheckCircle size={16} color={Colors.primary} />
      ) : (
        <ChevronRight size={16} color={Colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '78%' as unknown as undefined,
    overflow: 'hidden',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  title: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    flex: 1,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 16,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  actionTextPrimary: {
    color: Colors.text,
    fontWeight: '600' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  helper: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  calendarContainer: {
    paddingBottom: 32,
  },
  monthHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 20,
  },
  monthButton: {
    padding: 10,
    minWidth: 40,
    alignItems: 'center' as const,
  },
  monthButtonText: {
    fontSize: 18,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  weekDaysHeader: {
    flexDirection: 'row' as const,
    marginBottom: 10,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center' as const,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  calendarDay: {
    width: '14.28%' as unknown as undefined,
    aspectRatio: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  calendarDayActive: {
    padding: 4,
  },
  dayCircle: {
    width: '100%' as unknown as undefined,
    height: '100%' as unknown as undefined,
    borderRadius: 100,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dayCircleSelected: {
    backgroundColor: Colors.primary,
  },
  dayText: {
    fontSize: 15,
    color: Colors.text,
  },
  dayTextSelected: {
    color: Colors.white,
    fontWeight: '600' as const,
  },
  dayTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.4,
  },
  timePickerSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  timePickerSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  timePickerColumns: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'flex-start' as const,
    gap: 16,
  },
  timePickerColumn: {
    flex: 1,
    maxHeight: 200,
  },
  timePickerColumnContent: {
    paddingVertical: 80,
  },
  timePickerItem: {
    paddingVertical: 14,
    alignItems: 'center' as const,
  },
  timePickerItemText: {
    fontSize: 20,
    color: Colors.textMuted,
  },
  timePickerItemTextSelected: {
    fontSize: 26,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  timePickerItemTextDisabled: {
    color: Colors.textSecondary,
    opacity: 0.4,
  },
  removePreferenceButton: {
    marginTop: 28,
    marginBottom: 20,
    paddingVertical: 14,
    alignItems: 'center' as const,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  removePreferenceText: {
    fontSize: 15,
    color: Colors.error,
    fontWeight: '600' as const,
  },
  // Trigger row
  schedulePickerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
    marginVertical: 8,
  },
  schedulePickerRowFilled: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF8F4',
  },
  schedulePickerText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  schedulePickerTextFilled: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
});
