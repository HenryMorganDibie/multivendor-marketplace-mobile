import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { HandCoins, Check } from 'lucide-react-native';

export default function VendorPaymentDisclosureScreen() {
  const router = useRouter();
  const [check1, setCheck1] = useState(false);
  const [check2, setCheck2] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;

  const allChecked = check1 && check2;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, iconScale]);

  const handleContinue = () => {
    if (!allChecked) return;
    router.push('/vendor-protection' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.body}>
            <Animated.View
              style={[styles.iconWrap, { transform: [{ scale: iconScale }] }]}
            >
              <View style={styles.iconInner}>
                <HandCoins size={36} color="#FF8C42" strokeWidth={1.8} />
              </View>
            </Animated.View>

            <Text style={styles.title}>Payments are handled by you</Text>
            <Text style={styles.subtitle}>
              the platform does not process customer payments.{'\n'}Customers pay you
              directly using your preferred payment methods.
            </Text>

            <View style={styles.checklistContainer}>
              <CheckItem
                checked={check1}
                onToggle={() => setCheck1((v) => !v)}
                label="I understand I must confirm payment before processing orders"
                testID="payment-check-1"
              />
              <CheckItem
                checked={check2}
                onToggle={() => setCheck2((v) => !v)}
                label="I understand the platform does not verify payments on my behalf"
                testID="payment-check-2"
              />
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, !allChecked && styles.buttonDisabled]}
              onPress={handleContinue}
              activeOpacity={0.85}
              disabled={!allChecked}
              testID="payment-disclosure-continue"
            >
              <Text
                style={[
                  styles.buttonText,
                  !allChecked && styles.buttonTextDisabled,
                ]}
              >
                I understand
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

interface CheckItemProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  testID?: string;
}

function CheckItem({ checked, onToggle, label, testID }: CheckItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
    onToggle();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.checkRow,
          checked && styles.checkRowActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
        <Text style={[styles.checkLabel, checked && styles.checkLabelActive]}>
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF3EA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'center' as const,
    marginBottom: 32,
  },
  iconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFE8D6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#1A1A2E',
    textAlign: 'center' as const,
    marginBottom: 12,
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center' as const,
    lineHeight: 23,
    marginBottom: 40,
    paddingHorizontal: 8,
  },
  checklistContainer: {
    gap: 14,
  },
  checkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  checkRowActive: {
    borderColor: '#FF8C42',
    backgroundColor: '#FFFBF7',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 14,
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#FF8C42',
    borderColor: '#FF8C42',
  },
  checkLabel: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    fontWeight: '500' as const,
  },
  checkLabelActive: {
    color: '#1A1A2E',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  button: {
    backgroundColor: '#FF8C42',
    borderRadius: 14,
    height: 52,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
});
