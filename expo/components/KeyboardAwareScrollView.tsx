import React, { useRef } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';

interface KeyboardAwareScrollViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  extraPadding?: number;
  keyboardVerticalOffset?: number;
  dismissKeyboardOnTap?: boolean;
}

export default function KeyboardAwareScrollView({
  children,
  style,
  contentContainerStyle,
  extraPadding = 80,
  keyboardVerticalOffset,
  dismissKeyboardOnTap = true,
}: KeyboardAwareScrollViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const defaultOffset = Platform.OS === 'ios' ? 0 : 0;

  const content = (
    <ScrollView
      ref={scrollViewRef}
      style={styles.flex}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: extraPadding },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
    >
      {children}
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset ?? defaultOffset}
    >
      {dismissKeyboardOnTap ? (
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          {content}
        </TouchableWithoutFeedback>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
