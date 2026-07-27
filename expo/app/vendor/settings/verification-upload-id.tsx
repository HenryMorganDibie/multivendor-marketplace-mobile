import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Upload } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useVerification } from '@/contexts/VerificationContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

export default function VerificationUploadIDScreen() {
  const router = useRouter();
  const { uploadIdDocument } = useVerification();
  const [idUploaded, setIdUploaded] = useState<boolean>(false);

  const handleUploadID = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      await uploadIdDocument(uri);
      setIdUploaded(true);
    }
  };

  const handleContinue = () => {
    if (!idUploaded) {
      Alert.alert('Upload Required', 'Please upload your ID to continue.');
      return;
    }
    router.push('/vendor/settings/verification-selfie' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Government ID" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Upload your ID</Text>
            <Text style={styles.description}>
              Upload a clear photo of a valid government-issued ID.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Accepted documents</Text>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Passport</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>National ID</Text>
            </View>
            <View style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>Driver&apos;s license</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.uploadButton, idUploaded && styles.uploadButtonSuccess]}
            onPress={handleUploadID}
            activeOpacity={0.7}
          >
            <Upload size={24} color={idUploaded ? Colors.success : Colors.primary} />
            <Text style={[styles.uploadButtonText, idUploaded && styles.uploadButtonTextSuccess]}>
              {idUploaded ? 'ID Uploaded ✓' : 'Upload ID'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.continueButton, !idUploaded && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.7}
            disabled={!idUploaded}
          >
            <Text style={[styles.continueButtonText, !idUploaded && styles.continueButtonTextDisabled]}>
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginTop: 24,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 24,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginTop: 24,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  bullet: {
    fontSize: 16,
    color: Colors.text,
    marginRight: 8,
    width: 20,
  },
  listText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    flex: 1,
  },
  uploadButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center' as const,
    marginTop: 24,
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
  },
  uploadButtonSuccess: {
    borderColor: Colors.success,
    borderStyle: 'solid' as const,
    backgroundColor: Colors.successLight,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginLeft: 8,
  },
  uploadButtonTextSuccess: {
    color: Colors.success,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  continueButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
