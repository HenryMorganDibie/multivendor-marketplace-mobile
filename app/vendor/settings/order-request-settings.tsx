import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

export default function OrderRequestSettingsScreen() {
  const router = useRouter();

  const renderRow = (label: string, onPress: () => void, isLast: boolean = false, subtitle?: string, disabled?: boolean) => (
    <>
      <TouchableOpacity
        style={[styles.row, disabled && styles.rowDisabled]}
        onPress={onPress}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <View style={styles.rowContent}>
          <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{label}</Text>
          {subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
        </View>
        <ChevronRight size={20} color={disabled ? "#444" : "#999"} />
      </TouchableOpacity>
      {!isLast && <View style={styles.rowDivider} />}
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Order Request Settings',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {renderRow('Order Questionnaire', () => router.push('/vendor/settings/order-questionnaire' as any), false)}
            {renderRow('Allow external orders', () => router.push('/vendor/settings/allow-external-orders' as any), true)}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
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
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 16,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '400' as const,
  },
  rowLabelDisabled: {
    color: '#666',
  },
  rowSubtitle: {
    fontSize: 17,
    color: '#666',
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 16,
  },
  bottomSpacer: {
    height: 40,
  },
});
