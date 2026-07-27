import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Camera, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import LaektivaModal from '@/components/LaektivaModal';

export default function ProfilePhotoScreen() {
  const router = useRouter();
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const handleBackPress = () => {
    router.back();
  };

  const handleChangePhoto = () => {
    console.log('Change photo pressed');
  };

  const handleRemovePhoto = () => {
    console.log('Photo removed');
    setShowRemoveModal(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Photo</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.photoSection}>
          <View style={styles.initialsContainer}>
            <Text style={styles.initialsText}>SK</Text>
          </View>
          <Text style={styles.helperText}>
            This photo is shown to vendors when you message or place an order.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleChangePhoto}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Camera size={20} color={Colors.border} />
                <Text style={styles.rowLabel}>Change Photo</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setShowRemoveModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Trash2 size={20} color={Colors.error} />
                <Text style={[styles.rowLabel, styles.deleteText]}>Remove Photo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <LaektivaModal
        visible={showRemoveModal}
        title="Remove Photo"
        message="Your profile will show your initials instead. You can add a new photo anytime."
        primaryButton={{
          label: 'Remove',
          onPress: handleRemovePhoto,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowRemoveModal(false),
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  photoSection: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  initialsContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.white,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  initialsText: {
    fontSize: 48,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  rowLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 48,
  },
  deleteText: {
    color: Colors.error,
  },
  bottomSpacer: {
    height: 40,
  },
});
