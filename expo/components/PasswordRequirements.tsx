import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X, Circle } from 'lucide-react-native';
import type { PasswordRequirement } from '@/constants/passwordPolicy';

/**
 * The live password checklist.
 *
 * Sits under the field and updates as the person types, so the rule is visible
 * while it can still be acted on. Previously the policy existed only as
 * placeholder text and was enforced on submit, which meant discovering it by
 * being refused.
 *
 * Three states rather than two. Grey before anything is typed, because five red
 * crosses in front of someone who has not started reads as failure rather than
 * guidance. Green when satisfied, red only once there is something to be wrong
 * about.
 *
 * Each row carries an icon as well as a colour: colour alone is not a signal
 * everyone can see, and this is the only place the rule is stated.
 */
export default function PasswordRequirements({
  requirements,
}: {
  requirements: PasswordRequirement[];
}) {
  return (
    <View style={styles.wrap} accessibilityLabel="Password requirements">
      {requirements.map((r) => {
        const color =
          r.state === 'met' ? '#15803D' : r.state === 'unmet' ? '#B3261E' : '#9CA3AF';

        return (
          <View key={r.id} style={styles.row}>
            {r.state === 'met' ? (
              <Check size={14} color={color} strokeWidth={2.5} />
            ) : r.state === 'unmet' ? (
              <X size={14} color={color} strokeWidth={2.5} />
            ) : (
              <Circle size={14} color={color} strokeWidth={2} />
            )}
            <Text
              style={[styles.label, { color }]}
              // Read out as a state rather than just the text, so the checklist
              // is usable without seeing the icon or colour.
              accessibilityLabel={`${r.label}: ${
                r.state === 'met' ? 'met' : r.state === 'unmet' ? 'not met' : 'not checked yet'
              }`}
            >
              {r.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, lineHeight: 18 },
});
