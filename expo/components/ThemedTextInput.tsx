import React from 'react';
import { TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export const ThemedTextInput = React.forwardRef<TextInput, TextInputProps>(
  (props, ref) => {
    return (
      <TextInput
        ref={ref}
        {...props}
        selectionColor={Colors.primary}
        style={[styles.input, props.style]}
        placeholderTextColor={props.placeholderTextColor || Colors.inputPlaceholder}
      />
    );
  }
);

const styles = StyleSheet.create({
  input: {
    outlineStyle: 'none' as any,
  },
});
