import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';

const PIN_LENGTH = 6;

type Step = 'enter' | 'confirm';

function PinDots({ value, error }: { value: string; error: boolean }) {
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shakeAnim]);

  return (
    <Animated.View style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
      {Array.from({ length: PIN_LENGTH }).map((_, i) => {
        const filled = i < value.length;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              filled && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        );
      })}
    </Animated.View>
  );
}

function NumPad({ onPress, onDelete }: { onPress: (d: string) => void; onDelete: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <View style={styles.numPad}>
      {keys.map((k, i) => {
        if (k === '') return <View key={i} style={styles.numKey} />;
        if (k === 'del') {
          return (
            <TouchableOpacity
              key={i}
              style={styles.numKey}
              onPress={onDelete}
              activeOpacity={0.5}
            >
              <Text style={styles.numKeyDelete}>⌫</Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={i}
            style={styles.numKey}
            onPress={() => onPress(k)}
            activeOpacity={0.5}
          >
            <Text style={styles.numKeyText}>{k}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function SetAppLockPinScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('enter');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentValue = step === 'enter' ? pin : confirmPin;
  const setter = step === 'enter' ? setPin : setConfirmPin;

  const transitionStep = (nextStep: Step) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setStep(nextStep);
    setError(false);
    setErrorMsg('');
  };

  const handlePress = (digit: string) => {
    if (currentValue.length >= PIN_LENGTH) return;
    setError(false);
    setErrorMsg('');
    const next = currentValue + digit;
    setter(next);

    if (next.length === PIN_LENGTH) {
      setTimeout(() => {
        if (step === 'enter') {
          transitionStep('confirm');
          setConfirmPin('');
        } else {
          if (next !== pin) {
            setError(true);
            setErrorMsg('PINs do not match. Please try again.');
            setTimeout(() => {
              setConfirmPin('');
              setError(false);
              setErrorMsg('');
            }, 600);
          } else {
            console.log('App Lock PIN set:', pin);
            setShowSuccess(true);
          }
        }
      }, 80);
    }
  };

  const handleDelete = () => {
    if (currentValue.length === 0) return;
    setter(currentValue.slice(0, -1));
    setError(false);
    setErrorMsg('');
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Set App Lock PIN',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View style={[styles.topSection, { opacity: fadeAnim }]}>
            <Text style={styles.stepLabel}>
              {step === 'enter' ? 'Step 1 of 2' : 'Step 2 of 2'}
            </Text>
            <Text style={styles.title}>
              {step === 'enter' ? 'Create your PIN' : 'Confirm your PIN'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'enter'
                ? 'Choose a 4–6 digit PIN to lock your app.'
                : 'Re-enter your PIN to confirm.'}
            </Text>

            <PinDots value={currentValue} error={error} />

            {errorMsg ? (
              <Text style={styles.errorText}>{errorMsg}</Text>
            ) : (
              <Text style={styles.hintText}>
                {currentValue.length === 0
                  ? `${PIN_LENGTH} digits max`
                  : `${currentValue.length} / ${PIN_LENGTH}`}
              </Text>
            )}
          </Animated.View>

          {step === 'confirm' && (
            <TouchableOpacity
              onPress={() => {
                transitionStep('enter');
                setPin('');
                setConfirmPin('');
              }}
              activeOpacity={0.6}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>← Re-enter PIN</Text>
            </TouchableOpacity>
          )}

          <NumPad onPress={handlePress} onDelete={handleDelete} />
        </View>
      </SafeAreaView>

      <LaektivaModal
        visible={showSuccess}
        title="App Lock Enabled"
        message="Your app is now protected with a PIN. You'll be asked to enter it when you open the app."
        primaryButton={{
          label: 'Done',
          onPress: handleSuccessClose,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    justifyContent: 'space-between' as const,
  },
  topSection: {
    alignItems: 'center' as const,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 36,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row' as const,
    gap: 16,
    marginBottom: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  hintText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 4,
    textAlign: 'center' as const,
  },
  backLink: {
    alignSelf: 'center' as const,
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  numPad: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    marginBottom: 8,
  },
  numKey: {
    width: '33.33%',
    height: 72,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  numKeyText: {
    fontSize: 26,
    fontWeight: '400' as const,
    color: Colors.text,
  },
  numKeyDelete: {
    fontSize: 22,
    color: Colors.textSecondary,
  },
});
