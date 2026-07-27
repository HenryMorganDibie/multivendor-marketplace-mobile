import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { Camera, Image, Trash2 } from 'lucide-react-native';

interface PhotoActionSheetProps {
  visible: boolean;
  onTakePhoto: () => void;
  onChoosePhoto: () => void;
  onRemovePhoto: () => void;
  onCancel: () => void;
}

export default function PhotoActionSheet({
  visible,
  onTakePhoto,
  onChoosePhoto,
  onRemovePhoto,
  onCancel,
}: PhotoActionSheetProps) {
  const translateY = useRef(new Animated.Value(320)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 30,
          stiffness: 280,
          mass: 0.75,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 320,
          duration: 230,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, translateY, overlayOpacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onCancel}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>

        {/* ── Main Actions Group ── */}
        <View style={styles.group}>
          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.titleText}>Profile Photo</Text>
          </View>
          <View style={styles.hairline} />

          {/* Take Photo */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={onTakePhoto}
            activeOpacity={0.55}
          >
            <View style={styles.optionIconWrap}>
              <Camera size={18} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.optionLabel}>Take Photo</Text>
          </TouchableOpacity>
          <View style={styles.hairline} />

          {/* Choose from Library */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={onChoosePhoto}
            activeOpacity={0.55}
          >
            <View style={styles.optionIconWrap}>
              <Image size={18} color={Colors.primary} strokeWidth={2} />
            </View>
            <Text style={styles.optionLabel}>Choose from Library</Text>
          </TouchableOpacity>
          <View style={styles.hairline} />

          {/* Remove Photo — destructive */}
          <TouchableOpacity
            style={styles.optionRow}
            onPress={onRemovePhoto}
            activeOpacity={0.55}
          >
            <View style={[styles.optionIconWrap, styles.optionIconDestructive]}>
              <Trash2 size={17} color={Colors.error} strokeWidth={2} />
            </View>
            <Text style={[styles.optionLabel, styles.destructiveLabel]}>Remove Photo</Text>
          </TouchableOpacity>
        </View>

        {/* ── Cancel ── */}
        <TouchableOpacity
          style={styles.cancelGroup}
          onPress={onCancel}
          activeOpacity={0.55}
        >
          <Text style={styles.cancelLabel}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11,12,15,0.36)',
  },
  sheet: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 10,
  },
  group: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: 'hidden' as const,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.09,
        shadowRadius: 24,
      },
      android: { elevation: 8 },
    }),
  },
  titleRow: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
  },
  optionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 14,
  },
  optionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  optionIconDestructive: {
    backgroundColor: Colors.errorLight,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '400' as const,
    color: Colors.text,
    letterSpacing: -0.1,
    flex: 1,
  },
  destructiveLabel: {
    color: Colors.error,
  },
  cancelGroup: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  cancelLabel: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
});
