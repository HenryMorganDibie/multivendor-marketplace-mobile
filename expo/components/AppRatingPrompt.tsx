import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Animated,
  Platform,
  Linking,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star, X, ExternalLink, MessageSquare, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '@/constants/colors';
import { useAppRating } from '@/contexts/AppRatingContext';

const IOS_APP_STORE_URL = 'https://apps.apple.com/app/platform/id0000000000';
const ANDROID_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.platform.app';

type Step = 'rating' | 'positive' | 'negative' | 'feedback_sent';

export default function AppRatingPrompt() {
  const ctx = useAppRating();
  const {
    visible,
    currentUserId,
    currentUserType,
    currentTriggerSource,
    recordPromptShown,
    recordRating,
    recordFeedback,
    recordStoreRedirect,
    dismissPrompt,
  } = ctx ?? {
    visible: false,
    currentUserId: null,
    currentUserType: null,
    currentTriggerSource: null,
    recordPromptShown: async () => {},
    recordRating: async () => {},
    recordFeedback: async () => {},
    recordStoreRedirect: async () => {},
    dismissPrompt: () => {},
  };

  const [step, setStep] = useState<Step>('rating');
  const [selectedStars, setSelectedStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');

  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const starScales = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(1))).current;

  useEffect(() => {
    if (visible) {
      setStep('rating');
      setSelectedStars(0);
      setHoveredStar(0);
      setFeedbackText('');

      if (currentUserId && currentUserType && currentTriggerSource) {
        void recordPromptShown(currentUserId, currentUserType, currentTriggerSource);
      }

      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(cardTranslateY, { toValue: 0, tension: 65, friction: 10, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      cardTranslateY.setValue(60);
    }
  }, [visible]);

  const animateStar = useCallback((index: number) => {
    Animated.sequence([
      Animated.spring(starScales[index], { toValue: 1.35, tension: 200, friction: 6, useNativeDriver: true }),
      Animated.spring(starScales[index], { toValue: 1, tension: 200, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [starScales]);

  const handleStarPress = useCallback(async (star: number) => {
    setSelectedStars(star);
    animateStar(star - 1);

    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (currentUserId && currentUserType) {
      await recordRating(currentUserId, currentUserType, star);
    }

    setTimeout(() => {
      if (star >= 4) {
        setStep('positive');
      } else {
        setStep('negative');
      }
    }, 350);
  }, [animateStar, currentUserId, currentUserType, recordRating]);

  const handleStoreRedirect = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const url = Platform.OS === 'ios' ? IOS_APP_STORE_URL : ANDROID_PLAY_STORE_URL;
    console.log('[AppRatingPrompt] Opening store URL:', url);

    try {
      await Linking.openURL(url);
    } catch (err) {
      console.log('[AppRatingPrompt] Failed to open store URL:', err);
    }

    if (currentUserId && currentUserType) {
      await recordStoreRedirect(currentUserId, currentUserType);
    }
  }, [currentUserId, currentUserType, recordStoreRedirect]);

  const handleSendFeedback = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (currentUserId && currentUserType && feedbackText.trim()) {
      await recordFeedback(currentUserId, currentUserType, feedbackText.trim());
    }
    setStep('feedback_sent');
    setTimeout(() => {
      dismissPrompt();
    }, 1800);
  }, [currentUserId, currentUserType, feedbackText, recordFeedback, dismissPrompt]);

  const handleDismiss = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    dismissPrompt();
  }, [dismissPrompt]);

  if (!visible && (cardOpacity as unknown as { _value: number })._value === 0) return null;

  const displayStar = hoveredStar > 0 ? hoveredStar : selectedStars;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <TouchableOpacity style={styles.backdropTouchable} activeOpacity={1} onPress={handleDismiss} />
        </Animated.View>

        <SafeAreaView style={styles.safeArea} edges={['bottom']}>
          <Animated.View
            style={[
              styles.card,
              {
                opacity: cardOpacity,
                transform: [{ translateY: cardTranslateY }],
              },
            ]}
          >
            <TouchableOpacity style={styles.closeButton} onPress={handleDismiss} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            {step === 'rating' && (
              <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                <View style={styles.iconWrap}>
                  <View style={styles.iconCircle}>
                    <Text style={styles.iconEmoji}>✦</Text>
                  </View>
                </View>

                <Text style={styles.title}>Enjoying Platform?</Text>
                <Text style={styles.subtitle}>
                  Your rating helps us improve and reach more vendors and customers.
                </Text>

                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= displayStar;
                    return (
                      <TouchableOpacity
                        key={star}
                        onPress={() => handleStarPress(star)}
                        activeOpacity={0.7}
                        testID={`app-rating-star-${star}`}
                      >
                        <Animated.View style={{ transform: [{ scale: starScales[star - 1] }] }}>
                          <Star
                            size={40}
                            color={filled ? Colors.star : Colors.border}
                            fill={filled ? Colors.star : 'transparent'}
                            strokeWidth={filled ? 0 : 1.5}
                          />
                        </Animated.View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {displayStar > 0 && (
                  <Text style={styles.starLabel}>
                    {displayStar === 1 ? 'Poor' : displayStar === 2 ? 'Fair' : displayStar === 3 ? 'Good' : displayStar === 4 ? 'Great' : 'Excellent!'}
                  </Text>
                )}

                <TouchableOpacity style={styles.notNowButton} onPress={handleDismiss}>
                  <Text style={styles.notNowText}>Not now</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {step === 'positive' && (
              <View style={styles.stepContent}>
                <View style={[styles.iconWrap]}>
                  <View style={[styles.iconCircle, styles.iconCircleGreen]}>
                    <Heart size={26} color={Colors.white} fill={Colors.white} />
                  </View>
                </View>
                <Text style={styles.title}>Thanks for your feedback.</Text>
                <Text style={styles.subtitle}>
                  Would you like to rate Platform on the {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}?
                </Text>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleStoreRedirect}
                  activeOpacity={0.85}
                  testID="app-rating-store-button"
                >
                  <ExternalLink size={18} color={Colors.white} />
                  <Text style={styles.primaryButtonText}>
                    {Platform.OS === 'ios' ? 'Rate on App Store' : 'Rate on Google Play'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.notNowButton} onPress={handleDismiss}>
                  <Text style={styles.notNowText}>Not now</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'negative' && (
              <View style={styles.stepContent}>
                <View style={styles.iconWrap}>
                  <View style={[styles.iconCircle, styles.iconCircleOrange]}>
                    <MessageSquare size={24} color={Colors.white} />
                  </View>
                </View>
                <Text style={styles.title}>Thanks for your feedback.</Text>
                <Text style={styles.subtitle}>
                  Tell us what we can improve. Your input shapes Platform.
                </Text>

                <TextInput
                  style={styles.feedbackInput}
                  placeholder="What could we do better? (optional)"
                  placeholderTextColor={Colors.inputPlaceholder}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  maxLength={500}
                  testID="app-rating-feedback-input"
                />

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSendFeedback}
                  activeOpacity={0.85}
                  testID="app-rating-send-feedback"
                >
                  <Text style={styles.primaryButtonText}>Send feedback</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.notNowButton} onPress={handleDismiss}>
                  <Text style={styles.notNowText}>Not now</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 'feedback_sent' && (
              <View style={styles.stepContent}>
                <View style={styles.iconWrap}>
                  <View style={[styles.iconCircle, styles.iconCircleGreen]}>
                    <Text style={styles.iconEmoji}>✓</Text>
                  </View>
                </View>
                <Text style={styles.title}>Feedback sent.</Text>
                <Text style={styles.subtitle}>
                  We appreciate your honesty. We are constantly improving Platform.
                </Text>
              </View>
            )}
          </Animated.View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  backdropTouchable: {
    flex: 1,
  },
  safeArea: {
    width: '100%',
  },
  card: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 20,
    minHeight: 300,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: { elevation: 16 },
    }),
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleGreen: {
    backgroundColor: Colors.successLight,
  },
  iconCircleOrange: {
    backgroundColor: Colors.primarySoft,
  },
  iconEmoji: {
    fontSize: 28,
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
    paddingVertical: 4,
  },
  starLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 12,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  notNowButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  notNowText: {
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  feedbackInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 110,
    marginBottom: 16,
  },
  stepContent: {
    alignItems: 'center',
  },
});
