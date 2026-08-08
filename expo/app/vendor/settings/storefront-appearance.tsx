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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Upload, X, AlertCircle, Info, CheckCircle2, ChevronRight, Eye, Globe, Instagram } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import Toast from '@/components/Toast';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { uploadStorefrontImage } from '@/lib/storefront/uploadStorefrontImage';
import { callable } from '@/lib/firebase';
import { Alert } from '@/utils/alert';

// ─── Completion bar ───────────────────────────────────────────────────────────

function ProfileCompletionCard({
  percent,
  hasLogo,
  hasBanner,
  hasDescription,
}: {
  percent: number;
  hasLogo: boolean;
  hasBanner: boolean;
  hasDescription: boolean;
}) {
  const animValue = useRef(new Animated.Value(0)).current;
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: percent,
      duration: 650,
      delay: 180,
      useNativeDriver: false,
    }).start();
  }, [percent, animValue]);

  const barColor = percent >= 80 ? Colors.success : percent >= 40 ? Colors.primary : Colors.warning;

  const animatedWidth = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: [0, barWidth],
  });

  const items = [
    { label: 'Name', done: true },
    { label: 'Logo', done: hasLogo },
    { label: 'Banner', done: hasBanner },
    { label: 'Description', done: hasDescription },
  ];

  return (
    <View style={completionStyles.card}>
      <View style={completionStyles.topRow}>
        <Text style={completionStyles.title}>Profile Completion</Text>
        <Text style={[completionStyles.percent, { color: barColor }]}>{percent}%</Text>
      </View>

      <View
        style={completionStyles.track}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View
          style={[completionStyles.fill, { width: animatedWidth, backgroundColor: barColor }]}
        />
      </View>

      <View style={completionStyles.items}>
        {items.map((item) => (
          <View key={item.label} style={completionStyles.item}>
            {item.done ? (
              <CheckCircle2 size={14} color={Colors.success} />
            ) : (
              <View style={completionStyles.itemDot} />
            )}
            <Text style={[completionStyles.itemLabel, item.done && completionStyles.itemLabelDone]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const completionStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  percent: {
    fontSize: 20,
    fontWeight: '700' as const,
    letterSpacing: -0.5,
  },
  track: {
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden' as const,
    marginBottom: 14,
  },
  fill: {
    height: 4,
    borderRadius: 2,
  },
  items: {
    flexDirection: 'row' as const,
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  item: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
  },
  itemDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
  },
  itemLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  itemLabelDone: {
    color: Colors.success,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StorefrontAppearanceScreen() {
  const router = useRouter();
  const { vendor, updateVendor, isRealVendor } = useVendor();

  const [storeLogo, setStoreLogo] = useState<string | null>(null);
  const [storeBanner, setStoreBanner] = useState<string | null>(null);
  const [storeDescription, setStoreDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [tiktok, setTiktok] = useState('');

  /**
   * Seeded only once the vendor's real record arrives.
   *
   * Seeding straight from `vendor` meant these fields started out holding
   * mockVendor's data — its Unsplash banner counted toward the completion
   * meter (a fresh vendor was shown "70% complete") and a Save would then try
   * to persist that external stock URL as the vendor's own logo, which
   * updateVendorStorefront rejects outright.
   */
  useEffect(() => {
    if (!isRealVendor) return;
    setStoreLogo(vendor.logoImage ?? null);
    setStoreBanner(vendor.bannerImage ?? null);
    setStoreDescription(vendor.description ?? '');
    setWebsite(vendor.contactLinks?.website ?? '');
    setInstagram(vendor.contactLinks?.instagram ?? '');
    setTiktok(vendor.contactLinks?.tiktok ?? '');
  }, [
    isRealVendor,
    vendor.logoImage,
    vendor.bannerImage,
    vendor.description,
    vendor.contactLinks?.website,
    vendor.contactLinks?.instagram,
    vendor.contactLinks?.tiktok,
  ]);
  const [showToast, setShowToast] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const handleBackPress = () => {
    if (!unsavedChanges.handleExitAttempt()) return;
    router.back();
  };

  /**
   * This wrote everything through VendorContext.updateVendor, which only
   * touches AsyncStorage — so the logo, banner, description and links never
   * reached vendors/{vendorId} and were wiped by the next snapshot from the
   * live listener. Customers never saw any of it. updateVendorStorefront is
   * the real write path; local state is still updated so the screen reflects
   * the save immediately rather than waiting on the listener round trip.
   */
  const handleSave = useCallback(async () => {
    if (uploadingLogo || uploadingBanner) {
      Alert.alert('Still uploading', 'Wait for the image upload to finish before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const update = callable<
        {
          logoUrl: string | null;
          coverImageUrl: string | null;
          description: string;
          contactLinks: { website: string | null; instagram: string | null; tiktok: string | null };
        },
        { success: true }
      >('updateVendorStorefront');
      await update({
        logoUrl: storeLogo ?? null,
        coverImageUrl: storeBanner ?? null,
        description: storeDescription.trim(),
        contactLinks: {
          website: website.trim() || null,
          instagram: instagram.trim() || null,
          tiktok: tiktok.trim() || null,
        },
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
      unsavedChanges.resetChanges();
      setShowToast(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your storefront.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSaving(false);
    }
  }, [storeLogo, storeBanner, storeDescription, website, instagram, tiktok, vendor.contactLinks, updateVendor, uploadingLogo, uploadingBanner, unsavedChanges]);

  /**
   * These two used to assign a hardcoded Unsplash stock photo — no picker
   * ever opened, so tapping "Upload Logo" simply put someone else's
   * photograph on the vendor's storefront and gave them no way to choose
   * their own image. Now it picks from the library and uploads to the
   * vendorMedia path the Storage rules allow.
   */
  const pickAndUpload = async (kind: 'logo' | 'banner') => {
    const setLocal = kind === 'logo' ? setStoreLogo : setStoreBanner;
    const setUploading = kind === 'logo' ? setUploadingLogo : setUploadingBanner;
    const previous = kind === 'logo' ? storeLogo : storeBanner;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo access needed',
          `Allow photo library access in Settings to upload a ${kind}.`,
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // A logo is shown in a circle/square; a banner is a wide header.
        aspect: kind === 'logo' ? [1, 1] : [16, 6],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.length) return;

      // Shown from the local uri first so the preview is immediate, then
      // replaced with the uploaded URL — a file:// uri means nothing to a
      // customer's device and the backend rejects it.
      const localUri = result.assets[0].uri;
      setLocal(localUri);
      try {
        setUploading(true);
        const url = await uploadStorefrontImage(localUri, kind);
        setLocal(url);
      } catch (error) {
        setLocal(previous);
        const message = error instanceof Error ? error.message : 'Please try again.';
        Alert.alert(`${kind === 'logo' ? 'Logo' : 'Banner'} upload failed`, message);
      } finally {
        setUploading(false);
      }
    } catch (e) {
      console.error(`[StorefrontAppearance] ${kind} upload failed`, e);
      Alert.alert('Upload failed', 'Could not pick that image. Please try again.');
    }
  };

  const handleUploadLogo = () => { void pickAndUpload('logo'); };
  const handleUploadBanner = () => { void pickAndUpload('banner'); };

  const charCount = storeDescription.length;
  const charOver = charCount > 260;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Storefront Appearance"
          onBack={handleBackPress}
          onSave={handleSave}
          saveEnabled={unsavedChanges.hasUnsavedChanges && !isSaving && !uploadingLogo && !uploadingBanner}
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview CTA */}
          <TouchableOpacity
            style={styles.previewRow}
            onPress={() => router.push('/vendor/storefront-preview' as never)}
            activeOpacity={0.75}
            testID="preview-storefront-btn"
          >
            <View style={styles.previewRowLeft}>
              <View style={styles.previewIconWrap}>
                <Eye size={16} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.previewRowText}>Preview Storefront</Text>
            </View>
            <ChevronRight size={16} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Completion card */}
          {completionPercent < 100 && (
            <View style={styles.section}>
              <ProfileCompletionCard
                percent={completionPercent}
                hasLogo={!!storeLogo}
                hasBanner={!!storeBanner}
                hasDescription={storeDescription.trim().length > 0}
              />
            </View>
          )}

          {/* ── Store Logo ── */}
          <Text style={styles.sectionLabel}>STORE LOGO</Text>
          <View style={[styles.card, !storeLogo && styles.cardRequired]}>
            {storeLogo ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: storeLogo }} style={styles.logoImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => setStoreLogo(null)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={handleUploadLogo}
                activeOpacity={0.7}
                disabled={uploadingLogo}
              >
                <View style={[styles.uploadIconBox, styles.uploadIconBoxRed]}>
                  {uploadingLogo ? (
                    <ActivityIndicator size="small" color={Colors.error} />
                  ) : (
                    <Upload size={20} color={Colors.error} strokeWidth={1.8} />
                  )}
                </View>
                <View style={styles.uploadText}>
                  <Text style={styles.uploadPrimary}>{uploadingLogo ? 'Uploading…' : 'Upload Logo'}</Text>
                  <Text style={styles.uploadSub}>Square image · Required to go live</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          {!storeLogo && (
            <View style={styles.hintRow}>
              <AlertCircle size={13} color={Colors.error} />
              <Text style={styles.hintError}>Upload a logo so customers can recognise your store.</Text>
            </View>
          )}

          {/* ── Store Banner ── */}
          <Text style={styles.sectionLabel}>STORE BANNER</Text>
          <View style={styles.card}>
            {storeBanner ? (
              <View style={styles.imageContainer}>
                <Image source={{ uri: storeBanner }} style={styles.bannerImage} resizeMode="cover" />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => setStoreBanner(null)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                >
                  <X size={12} color="#FFFFFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.uploadArea}
                onPress={handleUploadBanner}
                activeOpacity={0.7}
                disabled={uploadingBanner}
              >
                <View style={[styles.uploadIconBox, styles.uploadIconBoxAmber]}>
                  {uploadingBanner ? (
                    <ActivityIndicator size="small" color={Colors.warning} />
                  ) : (
                    <Upload size={20} color={Colors.warning} strokeWidth={1.8} />
                  )}
                </View>
                <View style={styles.uploadText}>
                  <Text style={styles.uploadPrimary}>{uploadingBanner ? 'Uploading…' : 'Upload Banner'}</Text>
                  <Text style={styles.uploadSub}>Wide image · Optional</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
          {!storeBanner && (
            <View style={styles.hintRow}>
              <Info size={13} color={Colors.warning} />
              <Text style={styles.hintWarning}>Stores with banners attract more customers.</Text>
            </View>
          )}

          {/* ── Description ── */}
          <Text style={styles.sectionLabel}>STORE DESCRIPTION</Text>
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              value={storeDescription}
              onChangeText={setStoreDescription}
              placeholder="Tell customers about your business…"
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <View style={styles.charCountRow}>
              <Text style={[styles.charCount, charOver && styles.charCountOver]}>
                {charCount} / 300
              </Text>
            </View>
          </View>

          {/* ── Social Links ── */}
          <Text style={styles.sectionLabel}>SOCIAL & WEBSITE</Text>
          <View style={styles.card}>
            <View style={styles.linkRow}>
              <View style={styles.linkIconWrap}>
                <Globe size={16} color={Colors.textSecondary} strokeWidth={1.8} />
              </View>
              <TextInput
                style={styles.linkInput}
                value={website}
                onChangeText={setWebsite}
                placeholder="yourwebsite.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="url"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.linkRow}>
              <View style={styles.linkIconWrap}>
                <Instagram size={16} color={Colors.textSecondary} strokeWidth={1.8} />
              </View>
              <TextInput
                style={styles.linkInput}
                value={instagram}
                onChangeText={setInstagram}
                placeholder="@instagram"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.linkRow}>
              <View style={styles.linkIconWrap}>
                <Text style={styles.tiktokIcon}>TT</Text>
              </View>
              <TextInput
                style={styles.linkInput}
                value={tiktok}
                onChangeText={setTiktok}
                placeholder="@tiktok"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Toast visible={showToast} message="Saved" onDismiss={() => setShowToast(false)} />

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Preview row
  previewRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewRowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  previewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  previewRowText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },

  section: {
    marginBottom: 20,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 2,
  },

  // Card
  card: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  cardRequired: {
    borderColor: Colors.errorBorder,
  },

  // Upload
  uploadArea: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: 16,
    gap: 14,
  },
  uploadIconBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  uploadIconBoxRed: {
    backgroundColor: Colors.errorLight,
  },
  uploadIconBoxAmber: {
    backgroundColor: Colors.warningLight,
  },
  uploadText: {
    flex: 1,
  },
  uploadPrimary: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  uploadSub: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  // Image preview
  imageContainer: {
    position: 'relative' as const,
  },
  logoImage: {
    width: '100%' as const,
    height: 160,
  },
  bannerImage: {
    width: '100%' as const,
    height: 180,
  },
  removeBtn: {
    position: 'absolute' as const,
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Hints
  hintRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    marginTop: 2,
    marginBottom: 18,
    paddingHorizontal: 2,
  },
  hintError: {
    flex: 1,
    fontSize: 12,
    color: Colors.error,
    lineHeight: 17,
  },
  hintWarning: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
    lineHeight: 17,
  },

  // Description
  textArea: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 110,
    padding: 16,
    lineHeight: 22,
  },
  charCountRow: {
    alignItems: 'flex-end' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  charCountOver: {
    color: Colors.error,
  },

  // Links
  linkRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  linkIconWrap: {
    width: 24,
    alignItems: 'center' as const,
  },
  tiktokIcon: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: Colors.textSecondary,
    letterSpacing: -0.5,
  },
  linkInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 52,
  },

  bottomSpacer: {
    height: 48,
  },
});
