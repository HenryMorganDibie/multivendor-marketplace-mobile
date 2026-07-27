import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ShieldCheck, CircleDollarSign, CalendarCheck, Truck } from 'lucide-react-native';

const TIPS = [
  {
    icon: CircleDollarSign,
    text: 'Request full payment before preparation',
  },
  {
    icon: CalendarCheck,
    text: 'Request a deposit for bookings',
  },
  {
    icon: Truck,
    text: 'Confirm payment before delivery',
  },
];

export default function VendorProtectionScreen() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const iconScale = useRef(new Animated.Value(0.5)).current;
  const tipAnims = useRef(TIPS.map(() => new Animated.Value(0))).current;

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
    ]).start(() => {
      Animated.stagger(
        120,
        tipAnims.map((anim) =>
          Animated.timing(anim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
          })
        )
      ).start();
    });
  }, [fadeAnim, slideAnim, iconScale, tipAnims]);

  const handleContinue = () => {
    router.push('/delivery-responsibility' as any);
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
                <ShieldCheck size={36} color="#FF8C42" strokeWidth={1.8} />
              </View>
            </Animated.View>

            <Text style={styles.title}>Protect your time and money</Text>
            <Text style={styles.subtitle}>
              We recommend requesting payment before confirming orders or bookings.
            </Text>

            <View style={styles.tipsContainer}>
              {TIPS.map((tip, index) => {
                const Icon = tip.icon;
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.tipRow,
                      {
                        opacity: tipAnims[index],
                        transform: [
                          {
                            translateX: tipAnims[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [-16, 0],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.tipIconWrap}>
                      <Icon size={20} color="#FF8C42" strokeWidth={2} />
                    </View>
                    <Text style={styles.tipText}>{tip.text}</Text>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleContinue}
              activeOpacity={0.85}
              testID="vendor-protection-continue"
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
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
  tipsContainer: {
    gap: 14,
  },
  tipRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#F0F0F0',
  },
  tipIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF3EA',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 14,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#2B2B2B',
    lineHeight: 21,
    fontWeight: '500' as const,
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
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});
