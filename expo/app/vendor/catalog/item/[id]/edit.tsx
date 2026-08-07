import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { Alert } from '@/utils/alert';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  Plus,
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Clock,
  Star,
  ImagePlus,
  Trash2,
} from 'lucide-react-native';
import { useCatalog, AddOnGroup, Category } from '@/contexts/CatalogContext';
import type { HighlightLabel } from '@/utils/itemTagging';
import { HIGHLIGHT_LABEL_OPTIONS } from '@/utils/itemTagging';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import LaektivaModal from '@/components/LaektivaModal';
import { getCurrencySymbol, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { DraggablePhoto } from '@/components/DraggablePhoto';
import { Colors } from '@/constants/colors';

export default function EditItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getItemById, updateItem, deleteItem, categories, addCategory } = useCatalog();
  const { plan } = useVendorPlan();

  const item = getItemById(id as string);

  const [name, setName] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('uncategorized');
  const [isAvailable, setIsAvailable] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [addOnGroups, setAddOnGroups] = useState<AddOnGroup[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [editingPhotoIndex, setEditingPhotoIndex] = useState<number | null>(null);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [trackInventory, setTrackInventory] = useState(false);
  const [inventoryQuantity, setInventoryQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [highlightLabel, setHighlightLabel] = useState<HighlightLabel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [pendingCategoryName, setPendingCategoryName] = useState<string | null>(null);

  const originalData = useRef<{
    name: string; basePrice: string; salePrice: string; description: string;
    selectedCategoryId: string; isAvailable: boolean; isHidden: boolean;
    isTaxExempt: boolean; isOutOfStock: boolean; addOnGroups: AddOnGroup[];
    photos: string[]; trackInventory: boolean; inventoryQuantity: string;
    lowStockThreshold: string; highlightLabel: HighlightLabel | null;
  } | null>(null);

  const getMaxPhotos = () => {
    if (plan === 'basic') return 1;
    if (plan === 'standard') return 3;
    if (plan === 'pro') return 5;
    return 8;
  };
  const MAX_PHOTOS = getMaxPhotos();

  useEffect(() => {
    if (item) {
      const inv = item.trackInventory ?? false;
      const invQty = item.inventoryQuantity?.toString() ?? '';
      const invThreshold = item.lowStockThreshold?.toString() ?? '5';
      const orig = {
        name: item.name,
        basePrice: item.basePrice.toString(),
        salePrice: item.salePrice?.toString() || '',
        description: item.description || '',
        selectedCategoryId: item.categoryId,
        isAvailable: item.isAvailable,
        isHidden: item.isHidden,
        isTaxExempt: item.isTaxExempt,
        isOutOfStock: item.isOutOfStock,
        addOnGroups: item.addOnGroups,
        photos: item.photos,
        trackInventory: inv,
        inventoryQuantity: invQty,
        lowStockThreshold: invThreshold,
        highlightLabel: item.highlightLabel ?? null,
      };
      originalData.current = orig;
      setName(item.name);
      setBasePrice(item.basePrice.toString());
      setSalePrice(item.salePrice?.toString() || '');
      setDescription(item.description || '');
      setSelectedCategoryId(item.categoryId);
      setIsAvailable(item.isAvailable);
      setIsHidden(item.isHidden);
      setIsFeatured(item.isFeatured);
      setIsTaxExempt(item.isTaxExempt);
      setIsOutOfStock(item.isOutOfStock);
      setAddOnGroups(item.addOnGroups);
      setPhotos(item.photos);
      setTrackInventory(inv);
      setInventoryQuantity(invQty);
      setLowStockThreshold(invThreshold);
      setHighlightLabel(item.highlightLabel ?? null);
    }
  }, [item]);

  useEffect(() => {
    if (!originalData.current) return;
    const o = originalData.current;
    setHasChanges(
      name !== o.name || basePrice !== o.basePrice || salePrice !== o.salePrice ||
      description !== o.description || selectedCategoryId !== o.selectedCategoryId ||
      isAvailable !== o.isAvailable || isHidden !== o.isHidden ||
      isTaxExempt !== o.isTaxExempt || isOutOfStock !== o.isOutOfStock ||
      trackInventory !== o.trackInventory || inventoryQuantity !== o.inventoryQuantity ||
      lowStockThreshold !== o.lowStockThreshold || highlightLabel !== o.highlightLabel ||
      JSON.stringify(addOnGroups) !== JSON.stringify(o.addOnGroups) ||
      JSON.stringify(photos) !== JSON.stringify(o.photos)
    );
  }, [name, basePrice, salePrice, description, selectedCategoryId, isAvailable,
      isHidden, isTaxExempt, isOutOfStock, trackInventory, inventoryQuantity,
      lowStockThreshold, highlightLabel, addOnGroups, photos]);

  useEffect(() => {
    if (!pendingCategoryName) return;
    const created = categories.find((c: Category) => c.name === pendingCategoryName);
    if (created) {
      setSelectedCategoryId(created.id);
      setPendingCategoryName(null);
    }
  }, [categories, pendingCategoryName]);

  if (!item) return null;

  const handleAddNewCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    setIsAddingCategory(true);
    try {
      await addCategory(trimmed);
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setPendingCategoryName(trimmed);
    } catch (error) {
      const message = (error as { message?: string })?.message
        ?? 'Could not create this category. Please try again.';
      Alert.alert('Could not add category', message);
    } finally {
      setIsAddingCategory(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !basePrice) {
      Alert.alert('Error', 'Please fill in item name and base price');
      return;
    }
    const basePriceNum = parseFloat(basePrice);
    const salePriceNum = salePrice ? parseFloat(salePrice) : undefined;
    if (isNaN(basePriceNum) || basePriceNum <= 0) {
      Alert.alert('Error', 'Base price must be a valid positive number');
      return;
    }
    if (salePriceNum !== undefined && (isNaN(salePriceNum) || salePriceNum <= 0)) {
      Alert.alert('Error', 'Sale price must be a valid positive number');
      return;
    }
    // updateItem calls the real backend and can genuinely fail — this used to
    // fire it and navigate back immediately regardless of the result, so a
    // failure (e.g. an invalid category) was invisible: the screen closed as
    // if the edit had saved when it never actually did.
    setIsSaving(true);
    try {
      await updateItem(item.id, {
        name: name.trim(), basePrice: basePriceNum, salePrice: salePriceNum,
        description: description.trim() || undefined, photos, isAvailable,
        isTaxExempt, isHidden, isOutOfStock, isFeatured,
        categoryId: selectedCategoryId, addOnGroups, trackInventory,
        inventoryQuantity: trackInventory && inventoryQuantity ? parseInt(inventoryQuantity, 10) : undefined,
        lowStockThreshold: trackInventory && lowStockThreshold ? parseInt(lowStockThreshold, 10) : undefined,
        highlightLabel: highlightLabel ?? undefined,
        createdAt: item.createdAt, orderCount: item.orderCount,
        recentOrderCount: item.recentOrderCount,
      });
      router.back();
    } catch (error) {
      const message = (error as { message?: string })?.message
        ?? 'Could not save these changes. Please try again.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Item', `Delete "${item.name}"?\n\nThis action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteItem(item.id); router.back(); router.back(); } },
    ]);
  };

  const handleCancel = () => {
    if (hasChanges) { setShowDiscardModal(true); } else { router.back(); }
  };

  const handlePickImages = async () => {
    if (photos.length >= MAX_PHOTOS) {
      Alert.alert('Upgrade Required', `Your ${plan} plan supports up to ${MAX_PHOTOS} image${MAX_PHOTOS === 1 ? '' : 's'} per item.`);
      return;
    }
    const remaining = MAX_PHOTOS - photos.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: remaining > 1,
      quality: 0.8,
      selectionLimit: remaining,
    });
    if (!result.canceled && result.assets) {
      setPhotos([...photos, ...result.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
    }
  };

  const handleAddAddOnGroup = () => {
    setAddOnGroups([...addOnGroups, {
      id: `ag_${Date.now()}`, heading: 'Add-ons',
      selectionType: 'checkbox', isRequired: false, options: [],
    }]);
  };

  const handleReplacePhotoWithCamera = async () => {
    const idx = editingPhotoIndex;
    setEditingPhotoIndex(null);
    if (idx === null) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const newPhotos = [...photos];
      newPhotos[idx] = result.assets[0].uri;
      setPhotos(newPhotos);
    }
  };

  const handleReplacePhotoFromLibrary = async () => {
    const idx = editingPhotoIndex;
    setEditingPhotoIndex(null);
    if (idx === null) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const newPhotos = [...photos];
      newPhotos[idx] = result.assets[0].uri;
      setPhotos(newPhotos);
    }
  };

  const handleDeleteEditingPhoto = () => {
    const idx = editingPhotoIndex;
    setEditingPhotoIndex(null);
    if (idx === null) return;
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleDeleteAddOnGroup = (groupId: string) =>
    setAddOnGroups(addOnGroups.filter((g) => g.id !== groupId));

  const handleUpdateAddOnGroup = (groupId: string, updates: Partial<AddOnGroup>) =>
    setAddOnGroups(addOnGroups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)));

  const handleAddOption = (groupId: string) =>
    setAddOnGroups(addOnGroups.map((g) =>
      g.id === groupId
        ? { ...g, options: [...g.options, { id: `opt_${Date.now()}`, name: '', isAvailable: true }] }
        : g
    ));

  const handleUpdateOption = (groupId: string, optionId: string, field: 'name' | 'price', value: string) =>
    setAddOnGroups(addOnGroups.map((g) =>
      g.id === groupId
        ? { ...g, options: g.options.map((opt) =>
            opt.id === optionId
              ? { ...opt, [field]: field === 'price' ? (value ? parseFloat(value) : undefined) : value }
              : opt
          )}
        : g
    ));

  const handleDeleteOption = (groupId: string, optionId: string) =>
    setAddOnGroups(addOnGroups.map((g) =>
      g.id === groupId
        ? { ...g, options: g.options.filter((opt) => opt.id !== optionId) }
        : g
    ));

  const getSelectedCategory = () => categories.find((cat: Category) => cat.id === selectedCategoryId);
  const isValid = name.trim().length > 0 && basePrice.length > 0;
  const currencySymbol = getCurrencySymbol((mockVendor.currency as Currency) || 'NGN');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Edit Item',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerLeft: () => (
            <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
              <ChevronLeft size={28} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={handleSave} disabled={!isValid || isSaving}>
              <Text style={[styles.saveText, (!isValid || isSaving) && styles.saveTextDisabled]}>
                {isSaving ? 'Saving…' : 'Save'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {item.moderationStatus === 'pending_review' && (
          <View style={styles.pendingBanner}>
            <View style={styles.pendingIconContainer}>
              <Clock size={20} color={Colors.primary} strokeWidth={2.5} />
            </View>
            <Text style={styles.pendingText}>
              This item is being reviewed. Once approved, customers will see it on your profile.
            </Text>
          </View>
        )}

        {/* MEDIA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEDIA</Text>
          {photos.length === 0 ? (
            <TouchableOpacity style={styles.mediaPlaceholder} onPress={handlePickImages} activeOpacity={0.7}>
              <View style={styles.mediaPlaceholderContent}>
                <View style={styles.cameraIconContainer}>
                  <Camera size={32} color={Colors.textSecondary} strokeWidth={1.5} />
                </View>
                <Text style={styles.mediaPlaceholderTitle}>Upload photos</Text>
                <Text style={styles.mediaPlaceholderSubtext}>Photos help customers decide</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.photosScrollContent}
                style={styles.photosScroll}
              >
                {photos.map((uri, index) => (
                  <DraggablePhoto
                    key={`${uri}-${index}`}
                    uri={uri}
                    index={index}
                    onTap={() => setEditingPhotoIndex(index)}
                    onRemove={() => setPhotos(photos.filter((_, i) => i !== index))}
                    onReorder={(from, to) => {
                      const arr = [...photos];
                      const [moved] = arr.splice(from, 1);
                      arr.splice(to, 0, moved);
                      setPhotos(arr);
                    }}
                    isAvailable={!isHidden}
                    isFirst={index === 0}
                  />
                ))}
                {photos.length < MAX_PHOTOS && (
                  <TouchableOpacity style={styles.addPhotoCard} onPress={handlePickImages}>
                    <Plus size={24} color={Colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </ScrollView>
              {isHidden && photos.length > 0 && (
                <View style={styles.hiddenIndicator}>
                  <EyeOff size={14} color={Colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.hiddenText}>Hidden from storefront</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* BASIC INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BASIC INFORMATION</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="e.g. Meat Pie" placeholderTextColor={Colors.textSecondary} />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Price ({currencySymbol}) *</Text>
            <TextInput style={styles.input} value={basePrice} onChangeText={setBasePrice}
              placeholder="e.g. 500" placeholderTextColor={Colors.textSecondary} keyboardType="numeric" />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Sale Price ({currencySymbol})</Text>
            <TextInput style={styles.input} value={salePrice} onChangeText={setSalePrice}
              placeholder="Optional" placeholderTextColor={Colors.textSecondary} keyboardType="numeric" />
            <Text style={styles.helperText}>Leave empty if not on sale</Text>
          </View>
          <TouchableOpacity style={styles.field} onPress={() => setShowCategoryModal(true)} activeOpacity={0.7}>
            <Text style={styles.label}>Category</Text>
            <View style={styles.categoryRow}>
              <Text style={styles.categoryValue}>{getSelectedCategory()?.name || 'Uncategorized'}</Text>
              <ChevronRight size={20} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* DESCRIPTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DESCRIPTION</Text>
          <View style={styles.field}>
            <TextInput style={[styles.input, styles.textArea]} value={description}
              onChangeText={setDescription} placeholder="Optional"
              placeholderTextColor={Colors.textSecondary} multiline numberOfLines={3} />
          </View>
        </View>

        {/* INVENTORY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INVENTORY</Text>
          <View style={styles.settingsCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleLabel}>Track quantity for this item?</Text>
                <Text style={styles.toggleSubtext}>
                  Use inventory tracking only for items with a fixed quantity. Turn this on if
                  the platform should reduce the available quantity as orders are accepted.
                </Text>
              </View>
              <Switch value={trackInventory} onValueChange={setTrackInventory}
                trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
            </View>
            {trackInventory && (
              <>
                <View style={styles.toggleDivider} />
                <View style={styles.inventoryFields}>
                  <View style={styles.inventoryField}>
                    <Text style={styles.label}>Quantity in stock</Text>
                    <TextInput style={styles.input} value={inventoryQuantity}
                      onChangeText={setInventoryQuantity} placeholder="e.g. 20"
                      placeholderTextColor={Colors.textSecondary} keyboardType="numeric" />
                  </View>
                  <View style={styles.inventoryField}>
                    <Text style={styles.label}>Low stock alert at</Text>
                    <TextInput style={styles.input} value={lowStockThreshold}
                      onChangeText={setLowStockThreshold} placeholder="e.g. 5"
                      placeholderTextColor={Colors.textSecondary} keyboardType="numeric" />
                    <Text style={styles.helperText}>Show "Only X left" when stock reaches this number</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>

        {/* VISIBILITY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VISIBILITY</Text>
          <View style={styles.settingsCard}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleLabel}>Available</Text>
                <Text style={styles.toggleSubtext}>Customers can order this item</Text>
              </View>
              <Switch value={isAvailable} onValueChange={setIsAvailable}
                trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleLabel}>Hide Item</Text>
                <Text style={styles.toggleSubtext}>Customers will not see this item</Text>
              </View>
              <Switch value={isHidden} onValueChange={setIsHidden}
                trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
            </View>
            <View style={styles.toggleDivider} />
            <View style={styles.toggleRow}>
              <View style={styles.toggleLeft}>
                <View style={styles.featuredLabelRow}>
                  <Text style={styles.toggleLabel}>Featured</Text>
                  <Star size={14} color={Colors.primary} fill={Colors.primary} />
                </View>
                <Text style={styles.toggleSubtext}>Show at top of category</Text>
              </View>
              <Switch value={isFeatured} onValueChange={setIsFeatured}
                trackColor={{ false: Colors.border, true: Colors.primary }} thumbColor={Colors.white} />
            </View>
          </View>
        </View>

        {/* HIGHLIGHT LABEL */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>HIGHLIGHT LABEL</Text>
          <Text style={styles.sectionHelper}>Optional</Text>
          <View style={styles.highlightGrid}>
            {HIGHLIGHT_LABEL_OPTIONS.map((opt) => {
              const isSelected = highlightLabel === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.highlightOption, isSelected && styles.highlightOptionSelected]}
                  onPress={() => setHighlightLabel(isSelected ? null : opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.highlightEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.highlightLabelText, isSelected && styles.highlightLabelSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ADD-ONS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ADD-ONS</Text>
            <TouchableOpacity onPress={handleAddAddOnGroup} style={styles.addButton}>
              <Plus size={20} color={Colors.primary} />
              <Text style={styles.addButtonText}>Add Group</Text>
            </TouchableOpacity>
          </View>
          {addOnGroups.map((group) => (
            <View key={group.id} style={styles.addOnGroupCard}>
              <View style={styles.addOnGroupHeader}>
                <View style={styles.groupHeaderInputs}>
                  <View style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>Group name</Text>
                    <TextInput
                      style={styles.groupHeadingInput}
                      value={group.heading}
                      onChangeText={(text) => handleUpdateAddOnGroup(group.id, { heading: text })}
                      placeholder="Choose a protein"
                    />
                  </View>
                  <View style={styles.fieldWrapper}>
                    <Text style={styles.fieldLabel}>Subheading (optional)</Text>
                    <TextInput
                      style={styles.groupSubheadingInput}
                      value={group.subheading || ''}
                      onChangeText={(text) => handleUpdateAddOnGroup(group.id, { subheading: text })}
                      placeholder="Choose up to 5"
                    />
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteAddOnGroup(group.id)} style={styles.deleteGroupButton}>
                  <X size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
              <View style={styles.groupSettings}>
                <View style={styles.segmentControl}>
                  <TouchableOpacity
                    style={[styles.segmentButton, group.selectionType === 'radio' && styles.segmentButtonActive]}
                    onPress={() => handleUpdateAddOnGroup(group.id, { selectionType: 'radio' })}
                  >
                    <Text style={[styles.segmentButtonText, group.selectionType === 'radio' && styles.segmentButtonTextActive]}>
                      Single Choice
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentButton, group.selectionType === 'checkbox' && styles.segmentButtonActive]}
                    onPress={() => handleUpdateAddOnGroup(group.id, { selectionType: 'checkbox' })}
                  >
                    <Text style={[styles.segmentButtonText, group.selectionType === 'checkbox' && styles.segmentButtonTextActive]}>
                      Multiple Choice
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.requiredRow}>
                  <Text style={styles.requiredLabel}>Required</Text>
                  <Switch
                    value={group.isRequired}
                    onValueChange={(value) => handleUpdateAddOnGroup(group.id, { isRequired: value })}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                  />
                </View>
              </View>
              <View style={styles.optionsList}>
                {group.options.map((option) => (
                  <View key={option.id} style={styles.optionRow}>
                    <TextInput
                      style={styles.optionNameInput}
                      value={option.name}
                      onChangeText={(text) => handleUpdateOption(group.id, option.id, 'name', text)}
                      placeholder="Option name"
                    />
                    <TextInput
                      style={styles.optionPriceInput}
                      value={option.price?.toString() || ''}
                      onChangeText={(text) => handleUpdateOption(group.id, option.id, 'price', text)}
                      placeholder={`${currencySymbol}0`}
                      keyboardType="numeric"
                    />
                    <TouchableOpacity onPress={() => handleDeleteOption(group.id, option.id)}>
                      <X size={18} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addOptionButton} onPress={() => handleAddOption(group.id)}>
                  <Plus size={16} color={Colors.primary} />
                  <Text style={styles.addOptionText}>Add Option</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* DELETE */}
        <View style={styles.section}>
          <TouchableOpacity onPress={handleDelete} activeOpacity={0.7} style={styles.deleteButton}>
            <Text style={styles.deleteButtonText}>Delete Item</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Edit Sheet */}
      <Modal
        visible={editingPhotoIndex !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setEditingPhotoIndex(null)}
      >
        <Pressable style={styles.photoSheetOverlay} onPress={() => setEditingPhotoIndex(null)} />
        <View style={styles.photoSheet}>
          <View style={styles.photoSheetHandle} />
          <Text style={styles.photoSheetTitle}>Edit photo</Text>

          <TouchableOpacity style={styles.photoSheetRow} onPress={handleReplacePhotoWithCamera} activeOpacity={0.7}>
            <View style={styles.photoSheetIcon}>
              <Camera size={18} color={Colors.text} strokeWidth={1.8} />
            </View>
            <Text style={styles.photoSheetLabel}>Take photo</Text>
          </TouchableOpacity>

          <View style={styles.photoSheetDivider} />

          <TouchableOpacity style={styles.photoSheetRow} onPress={handleReplacePhotoFromLibrary} activeOpacity={0.7}>
            <View style={styles.photoSheetIcon}>
              <ImagePlus size={18} color={Colors.text} strokeWidth={1.8} />
            </View>
            <Text style={styles.photoSheetLabel}>Choose photo</Text>
          </TouchableOpacity>

          <View style={styles.photoSheetDivider} />

          <TouchableOpacity style={styles.photoSheetRow} onPress={handleDeleteEditingPhoto} activeOpacity={0.7}>
            <View style={[styles.photoSheetIcon, styles.photoSheetIconDanger]}>
              <Trash2 size={18} color={Colors.error} strokeWidth={1.8} />
            </View>
            <Text style={[styles.photoSheetLabel, styles.photoSheetLabelDanger]}>Delete photo</Text>
          </TouchableOpacity>

          <View style={{ height: 28 }} />
        </View>
      </Modal>

      <LaektivaModal
        visible={showDiscardModal}
        title="Discard Changes"
        message="Are you sure you want to discard your changes?"
        primaryButton={{ label: 'Discard', onPress: () => { setShowDiscardModal(false); router.back(); } }}
        secondaryButton={{ label: 'Keep Editing', onPress: () => setShowDiscardModal(false) }}
      />

      <Modal
        visible={showCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <Pressable style={styles.catOverlay} onPress={() => setShowCategoryModal(false)} />
        <View style={styles.catSheet}>
          <View style={styles.catHandle} />
          <View style={styles.catHeader}>
            <Text style={styles.catTitle}>Category</Text>
            <TouchableOpacity onPress={() => setShowCategoryModal(false)}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}>
              <Text style={styles.catDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView bounces={false} style={styles.catList} showsVerticalScrollIndicator={false}>
            {categories.map((cat: Category, index: number) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catRow,
                  selectedCategoryId === cat.id && styles.catRowSelected,
                  index === categories.length - 1 && styles.catRowLast,
                ]}
                onPress={() => { setSelectedCategoryId(cat.id); setShowCategoryModal(false); }}
                activeOpacity={0.55}
              >
                <Text style={[styles.catRowText, selectedCategoryId === cat.id && styles.catRowTextSelected]}>
                  {cat.name}
                </Text>
                {selectedCategoryId === cat.id && (
                  <View style={styles.catCheckCircle}>
                    <Text style={styles.catCheckMark}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          {showNewCategoryInput ? (
            <View style={styles.newCatRow}>
              <TextInput
                style={styles.newCatInput}
                placeholder="Category name"
                placeholderTextColor={Colors.textMuted}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoFocus
                editable={!isAddingCategory}
                onSubmitEditing={handleAddNewCategory}
              />
              <TouchableOpacity
                onPress={handleAddNewCategory}
                disabled={!newCategoryName.trim() || isAddingCategory}
                style={styles.newCatAddButton}
              >
                <Text style={[
                  styles.newCatAddButtonText,
                  (!newCategoryName.trim() || isAddingCategory) && styles.saveTextDisabled,
                ]}>
                  {isAddingCategory ? 'Adding…' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addNewCatRow}
              onPress={() => setShowNewCategoryInput(true)}
              activeOpacity={0.7}
            >
              <Plus size={18} color={Colors.primary} />
              <Text style={styles.addNewCatText}>Add new category</Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 28 }} />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.backgroundCanvas },
  scrollContent: { paddingVertical: 20, paddingHorizontal: 16 },
  section: { marginBottom: 22 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', color: Colors.textMuted,
    letterSpacing: 0.6, marginBottom: 10, textTransform: 'uppercase',
  },
  sectionHelper: {
    fontSize: 13, color: Colors.textMuted, marginTop: -6,
    marginBottom: 10, lineHeight: 18,
  },
  field: { marginBottom: 10 },
  label: {
    fontSize: 13, fontWeight: '500', color: Colors.textSecondary, marginBottom: 5,
  },
  input: {
    backgroundColor: Colors.background, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 15, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border,
  },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  helperText: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.background, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1, borderColor: Colors.border,
  },
  categoryValue: { fontSize: 15, color: Colors.text },
  settingsCard: {
    backgroundColor: Colors.background, borderRadius: 12,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 11, paddingHorizontal: 14,
  },
  toggleLeft: { flex: 1, marginRight: 12 },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: Colors.text, marginBottom: 1 },
  toggleSubtext: { fontSize: 12, color: Colors.textMuted },
  toggleDivider: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginHorizontal: 14,
  },
  featuredLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  inventoryFields: { paddingHorizontal: 14, paddingVertical: 10, gap: 10 },
  inventoryField: { gap: 4 },
  highlightGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  highlightOption: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.background,
  },
  highlightOptionSelected: {
    borderColor: Colors.primary, backgroundColor: 'rgba(255,122,40,0.06)',
  },
  highlightEmoji: { fontSize: 16 },
  highlightLabelText: { fontSize: 13, fontWeight: '500', color: Colors.text },
  highlightLabelSelected: { color: Colors.primary, fontWeight: '600' },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addButtonText: { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  addOnGroupCard: {
    backgroundColor: Colors.background, borderRadius: 12,
    padding: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  addOnGroupHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 12,
  },
  groupHeaderInputs: { flex: 1, gap: 8 },
  fieldWrapper: { gap: 4 },
  fieldLabel: {
    fontSize: 11, fontWeight: '500', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.3,
  },
  groupHeadingInput: {
    fontSize: 15, fontWeight: '500', color: Colors.text,
    paddingHorizontal: 10, paddingVertical: 9,
    backgroundColor: Colors.backgroundCanvas, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  groupSubheadingInput: {
    fontSize: 14, color: Colors.text, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: Colors.backgroundCanvas, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  deleteGroupButton: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#FEF0EB',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginTop: 2,
  },
  groupSettings: { marginBottom: 12 },
  segmentControl: {
    flexDirection: 'row', backgroundColor: '#EBEBED',
    borderRadius: 9, padding: 2, marginBottom: 10,
  },
  segmentButton: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 7 },
  segmentButtonActive: {
    backgroundColor: Colors.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2, elevation: 1,
  },
  segmentButtonText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '400' },
  segmentButtonTextActive: { color: Colors.text, fontWeight: '600' },
  requiredRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: 2,
  },
  requiredLabel: { fontSize: 14, color: Colors.textSecondary },
  optionsList: { gap: 6, paddingTop: 2 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionNameInput: {
    flex: 1, backgroundColor: Colors.backgroundCanvas, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 14, color: Colors.text,
  },
  optionPriceInput: {
    width: 76, backgroundColor: Colors.backgroundCanvas, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 10, paddingVertical: 9, fontSize: 14,
    color: Colors.text, textAlign: 'right',
  },
  addOptionButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 6, marginTop: 2,
  },
  addOptionText: { fontSize: 13, color: Colors.primary },
  deleteButton: {
    alignItems: 'center', paddingVertical: 13,
    borderWidth: 1, borderColor: Colors.errorBorder,
    borderRadius: 12, backgroundColor: Colors.errorLight,
  },
  deleteButtonText: { fontSize: 15, fontWeight: '500', color: Colors.error },
  backButton: { padding: 4, marginLeft: -4 },
  saveText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  saveTextDisabled: { opacity: 0.35 },
  mediaPlaceholder: {
    backgroundColor: Colors.background, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  mediaPlaceholderContent: {
    paddingVertical: 28, alignItems: 'center', justifyContent: 'center',
  },
  cameraIconContainer: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  mediaPlaceholderTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 3 },
  mediaPlaceholderSubtext: { fontSize: 13, color: Colors.textMuted },
  photosScroll: {
    backgroundColor: Colors.background, borderRadius: 12,
    paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  photosScrollContent: { paddingHorizontal: 12, gap: 12 },
  addPhotoCard: {
    width: 120, height: 120, borderRadius: 12, backgroundColor: Colors.white,
    borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  hiddenIndicator: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, marginTop: 8, paddingVertical: 8,
  },
  hiddenText: { fontSize: 13, color: Colors.textSecondary },
  photoSheetOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  photoSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 14,
  },
  photoSheetHandle: {
    width: 36, height: 3, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 14,
  },
  photoSheetTitle: {
    fontSize: 15, fontWeight: '600', color: Colors.text,
    textAlign: 'center', marginBottom: 16,
  },
  photoSheetRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 14,
  },
  photoSheetIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.backgroundCanvas,
    alignItems: 'center', justifyContent: 'center',
  },
  photoSheetIconDanger: { backgroundColor: '#FEF0EB' },
  photoSheetLabel: { fontSize: 15, color: Colors.text, fontWeight: '400' },
  photoSheetLabelDanger: { color: Colors.error },
  photoSheetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border, marginLeft: 50,
  },
  pendingBanner: {
    flexDirection: 'row', backgroundColor: Colors.warningLight, borderRadius: 12,
    padding: 14, marginBottom: 16, gap: 10,
    borderWidth: 1, borderColor: Colors.warningBorder,
  },
  pendingIconContainer: { paddingTop: 2 },
  pendingText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },
  catOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
  },
  catSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.background, borderTopLeftRadius: 20,
    borderTopRightRadius: 20, maxHeight: '62%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.07, shadowRadius: 10, elevation: 12,
  },
  catHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB',
    alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  catHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
  },
  catTitle: { fontSize: 16, fontWeight: '600', color: Colors.text },
  catDoneText: { fontSize: 16, fontWeight: '600', color: Colors.primary },
  catList: { flexShrink: 1 },
  catRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  catRowSelected: { backgroundColor: Colors.primaryTint },
  catRowLast: { borderBottomWidth: 0 },
  catRowText: { fontSize: 16, color: Colors.text },
  catRowTextSelected: { fontWeight: '600', color: Colors.primary },
  catCheckCircle: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  catCheckMark: { fontSize: 12, color: Colors.white, fontWeight: '700' },
  addNewCatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  addNewCatText: { fontSize: 16, color: Colors.primary, fontWeight: '600' },
  newCatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  newCatInput: {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: Colors.text,
  },
  newCatAddButton: { paddingHorizontal: 8, paddingVertical: 10 },
  newCatAddButtonText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
});
