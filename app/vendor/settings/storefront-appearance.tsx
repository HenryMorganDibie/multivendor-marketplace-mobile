import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Upload, X, AlertCircle, Info, CheckCircle2, ChevronRight, Sparkles, Eye } from 'lucide-react-native';
import Toast from '@/components/Toast';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { useRouter } from 'expo-router';

function SuccessCompletionBanner({ onDismiss, onEdit: _onEdit }: { onDismiss: () => void; onEdit: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss());
    }, 4000);

    return () => clearTimeout(timer);
  }, [fadeAnim, onDismiss]);

  return (
    <Animated.View style={[completionStyles.successBanner, { opacity: fadeAnim }]}>
      <View style={completionStyles.successLeft}>
        <Sparkles size={16} color={Colors.success} />
        <Text style={completionStyles.successText}>Profile complete. Your storefront is ready.</Text>
      </View>
      <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={16} color={Colors.success} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function ProfileCompletionBar({ percent, hasLogo, hasBanner, hasDescription }: { percent: number; hasLogo: boolean; hasBanner: boolean; hasDescription: boolean }) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: percent,
      duration: 700,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [percent, animValue]);

  const label =
    percent >= 70
      ? 'Almost there'
      : percent >= 40
      ? 'Keep going'
      : 'Get started';

  const barColor = percent >= 60 ? Colors.primary : '#F59E0B';

  const animatedWidth = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [0, barWidth],
  });

  return (
    <View style={completionStyles.container}>
      <View style={completionStyles.topRow}>
        <Text style={completionStyles.label}>{label}</Text>
        <Text style={[completionStyles.percent, { color: barColor }]}>{percent}%</Text>
      </View>
      <View
        style={completionStyles.track}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            completionStyles.fill,
            { width: animatedWidth, backgroundColor: barColor },
          ]}
        />
      </View>
      <View style={completionStyles.pills}>
        <CompletionPill label="Name" done />
        <CompletionPill label="Logo" done={hasLogo} highlight={!hasLogo} />
        <CompletionPill label="Banner" done={hasBanner} />
        <CompletionPill label="Description" done={hasDescription} />
      </View>
    </View>
  );
}

function CompletionPill({
  label,
  done,
  highlight,
}: {
  label: string;
  done: boolean;
  highlight?: boolean;
}) {
  return (
    <View
      style={[
        completionPillStyles.pill,
        done ? completionPillStyles.pillDone : completionPillStyles.pillTodo,
        highlight && !done && completionPillStyles.pillHighlight,
      ]}
    >
      {done ? (
        <CheckCircle2 size={10} color={Colors.success} />
      ) : (
        <View style={completionPillStyles.dot} />
      )}
      <Text
        style={[
          completionPillStyles.text,
          done
            ? completionPillStyles.textDone
            : highlight
            ? completionPillStyles.textHighlight
            : completionPillStyles.textTodo,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const completionStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 4,
  },
  topRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  percent: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  track: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden' as const,
    marginBottom: 12,
  },
  fill: {
    height: 6,
    borderRadius: 3,
  },
  pills: {
    flexDirection: 'row' as const,
    gap: 6,
    flexWrap: 'wrap' as const,
  },
  successBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.successLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 4,
  },
  successLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  successText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.success,
    flex: 1,
    lineHeight: 18,
  },
});

const completionPillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pillDone: {
    backgroundColor: Colors.successLight,
  },
  pillTodo: {
    backgroundColor: Colors.border,
  },
  pillHighlight: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
  },
  text: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  textDone: {
    color: Colors.success,
  },
  textTodo: {
    color: Colors.textSecondary,
  },
  textHighlight: {
    color: Colors.error,
  },
});

export default function StorefrontAppearanceScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();

  const [storeLogo, setStoreLogo] = useState<string | null>(vendor.logoImage ?? null);
  const [storeBanner, setStoreBanner] = useState<string | null>(vendor.bannerImage ?? null);
  const [storeDescription, setStoreDescription] = useState(vendor.description ?? '');
  const [website, setWebsite] = useState(vendor.contactLinks?.website ?? '');
  const [instagram, setInstagram] = useState(vendor.contactLinks?.instagram ?? '');
  const [tiktok, setTiktok] = useState(vendor.contactLinks?.tiktok ?? '');
  const [showToast, setShowToast] = useState(false);
  const [completionDismissed, setCompletionDismissed] = useState(false);
  const prevCompleteRef = useRef(false);

  const unsavedChanges = useUnsavedChanges(
    { storeDescription, website, instagram, tiktok, storeLogo, storeBanner },
    false
  );

  const completionPercent = useMemo(() => {
    let pct = 20;
    if (storeLogo) pct += 30;
    if (storeBanner) pct += 20;
    if (storeDescription.trim().length > 0) pct += 15;
    if (vendor.primaryPaymentMethod) pct += 15;
    return pct;
  }, [storeLogo, storeBanner, storeDescription, vendor.primaryPaymentMethod]);

  const isComplete = completionPercent === 100;

  useEffect(() => {
    if (isComplete && !prevCompleteRef.current) {
      setCompletionDismissed(false);
    }
    if (!isComplete) {
      setCompletionDismissed(false);
    }
    prevCompleteRef.current = isComplete;
  }, [isComplete]);

  const handleCompletionDismiss = useCallback(() => {
    setCompletionDismissed(true);
  }, []);

  const handleEditStorefront = useCallback(() => {
    router.push('/vendor/(tabs)/storefront' as never);
  }, [router]);

  const handleBackPress = () => {
    if (!unsavedChanges.handleExitAttempt()) {
      return;
    }
    router.back();
  };

  const handleSave = () => {
    console.log('[StorefrontAppearance] Saving:', {
      storeLogo,
      storeBanner,
      storeDescription,
      website,
      instagram,
      tiktok,
    });
    updateVendor({
      logoImage: storeLogo ?? undefined,
      bannerImage: storeBanner ?? undefined,
      description: storeDescription,
      contactLinks: {
        ...vendor.contactLinks,
        website: website.trim() || undefined,
        instagram: instagram.trim() || undefined,
        tiktok: tiktok.trim() || undefined,
      },
    });
    setShowToast(true);
  };

  const handleUploadLogo = () => {
    console.log('[StorefrontAppearance] Upload logo tapped');
    setStoreLogo('https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200&h=200&fit=crop');
  };

  const handleUploadBanner = () => {
    console.log('[StorefrontAppearance] Upload banner tapped');
    setStoreBanner('https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=300&fit=crop');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Storefront Appearance',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!unsavedChanges.hasUnsavedChanges}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  headerStyles.saveText,
                  !unsavedChanges.hasUnsavedChanges && headerStyles.saveTextDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={handleBackPress} activeOpacity={0.7}>
              <Text style={headerStyles.backText}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => router.push('/vendor/storefront-preview' as never)}
            activeOpacity={0.8}
            testID="preview-storefront-btn"
          >
            <Eye size={18} color={Colors.text} />
            <Text style={styles.previewButtonText}>Preview Storefront</Text>
            <ChevronRight size={16} color={Colors.textSecondary} />
          </TouchableOpacity>

          {isComplete ? (
            completionDismissed ? (
              <TouchableOpacity
                style={styles.editStorefrontRow}
                onPress={handleEditStorefront}
                activeOpacity={0.7}
              >
                <Text style={styles.editStorefrontText}>Edit Storefront</Text>
                <ChevronRight size={16} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.completionSection}>
                <Text style={styles.completionHeading}>PROFILE COMPLETION</Text>
                <SuccessCompletionBanner
                  onDismiss={handleCompletionDismiss}
                  onEdit={handleEditStorefront}
                />
              </View>
            )
          ) : (
            <View style={styles.completionSection}>
              <Text style={styles.completionHeading}>PROFILE COMPLETION</Text>
              <ProfileCompletionBar
                percent={completionPercent}
                hasLogo={!!storeLogo}
                hasBanner={!!storeBanner}
                hasDescription={storeDescription.trim().length > 0}
              />
            </View>
          )}

          <Text style={styles.sectionTitle}>STORE LOGO</Text>
          <View
            style={[
              styles.card,
              !storeLogo && styles.cardError,
            ]}
          >
            {storeLogo ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: storeLogo }} style={styles.logoImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setStoreLogo(null)}
                  activeOpacity={0.7}
                >
                  <X size={16} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUploadLogo}
                activeOpacity={0.7}
              >
                <View style={styles.uploadIconWrap}>
                  <Upload size={22} color={Colors.error} />
                </View>
                <View style={styles.uploadTextContainer}>
                  <Text style={styles.uploadTextPrimary}>Upload Logo</Text>
                  <Text style={styles.uploadTextSub}>Required to go live</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          {!storeLogo && (
            <View style={styles.errorBanner}>
              <AlertCircle size={14} color={Colors.error} />
              <Text style={styles.errorBannerText}>
                Upload a logo to go live. Customers trust stores with a logo.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>STORE BANNER</Text>
          <View style={styles.card}>
            {storeBanner ? (
              <View style={styles.imagePreview}>
                <Image source={{ uri: storeBanner }} style={styles.bannerImage} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => setStoreBanner(null)}
                  activeOpacity={0.7}
                >
                  <X size={16} color={Colors.white} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={handleUploadBanner}
                activeOpacity={0.7}
              >
                <View style={[styles.uploadIconWrap, styles.uploadIconWrapAmber]}>
                  <Upload size={22} color={Colors.warning} />
                </View>
                <View style={styles.uploadTextContainer}>
                  <Text style={styles.uploadTextPrimary}>Upload Banner</Text>
                  <Text style={styles.uploadTextSub}>Optional</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          {!storeBanner && (
            <View style={styles.warningBanner}>
              <Info size={14} color={Colors.warning} />
              <Text style={styles.warningBannerText}>
                Stores with banners perform better and attract more customers.
              </Text>
            </View>
          )}

          <Text style={styles.sectionTitle}>STORE DESCRIPTION</Text>
          <View style={styles.card}>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={storeDescription}
              onChangeText={setStoreDescription}
              placeholder="Tell customers about your business (max 300 characters)"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={300}
            />
            <Text style={styles.characterCount}>{storeDescription.length} / 300</Text>
          </View>

          <Text style={styles.sectionTitle}>SOCIAL & WEBSITE LINKS</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Website</Text>
              <TextInput
                style={styles.linkInput}
                value={website}
                onChangeText={setWebsite}
                placeholder="https://yourwebsite.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Instagram</Text>
              <TextInput
                style={styles.linkInput}
                value={instagram}
                onChangeText={setInstagram}
                placeholder="@username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>TikTok</Text>
              <TextInput
                style={styles.linkInput}
                value={tiktok}
                onChangeText={setTiktok}
                placeholder="@username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Toast
        visible={showToast}
        message="Saved"
        onDismiss={() => setShowToast(false)}
      />

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
      />
    </View>
  );
}

const headerStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.5,
  },
  backText: {
    fontSize: 17,
    color: Colors.primary,
  },
});

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
    paddingHorizontal: 16,
  },
  completionSection: {
    marginTop: 20,
    marginBottom: 4,
  },
  completionHeading: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  previewButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 16,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  editStorefrontRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    marginTop: 16,
    marginBottom: 4,
    gap: 4,
  },
  editStorefrontText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden' as const,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardError: {
    borderColor: '#FECACA',
    backgroundColor: '#FFF5F5',
  },
  uploadButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    gap: 14,
  },
  uploadIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.errorLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  uploadIconWrapAmber: {
    backgroundColor: Colors.warningLight,
  },
  uploadTextContainer: {
    flex: 1,
  },
  uploadTextPrimary: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  uploadTextSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 7,
    marginTop: 8,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  imagePreview: {
    position: 'relative' as const,
  },
  logoImage: {
    width: '100%',
    height: 150,
    borderRadius: 10,
    resizeMode: 'cover' as const,
  },
  bannerImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    resizeMode: 'cover' as const,
  },
  removeButton: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    minHeight: 44,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  characterCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  inputGroup: {
    paddingVertical: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500' as const,
  },
  linkInput: {
    fontSize: 16,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  bottomSpacer: {
    height: 40,
  },
});
