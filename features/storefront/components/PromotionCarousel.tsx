import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Percent, Gift, Truck, Tag, Zap, X, Info, Calendar, ShoppingBag, Clock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { VendorPromotion } from '@/mocks/promotionsData';

interface PromotionCarouselProps {
  promotions: VendorPromotion[];
}

const ICON_MAP: Record<string, typeof Percent> = {
  percent: Percent,
  gift: Gift,
  truck: Truck,
  tag: Tag,
  zap: Zap,
};

const ACCENT = '#FF8C42';
const ACCENT_BG = 'rgba(255,140,66,0.08)';
const ACCENT_BG_STRONG = 'rgba(255,140,66,0.14)';

function getPromoSubtext(promo: VendorPromotion): string {
  if (promo.type === 'percentage' && promo.maxDiscount) {
    return `Save up to ₦${promo.maxDiscount.toLocaleString()}`;
  }
  if (promo.type === 'free_item' && promo.freeItemName) {
    return `Free ${promo.freeItemName} included`;
  }
  if (promo.type === 'bogo' && promo.bogoItemName) {
    return `On ${promo.bogoItemName}`;
  }
  if (promo.type === 'free_delivery') {
    return 'No delivery fee';
  }
  if (promo.type === 'flat') {
    return `₦${promo.discountValue.toLocaleString()} off your order`;
  }
  return promo.shortDescription;
}

function getTypeLabel(type: string): string {
  switch (type) {
    case 'percentage': return 'Percentage Discount';
    case 'flat': return 'Flat Discount';
    case 'bogo': return 'Buy One Get One';
    case 'free_item': return 'Free Item';
    case 'free_delivery': return 'Free Delivery';
    default: return 'Promotion';
  }
}

function getEligibilityLabel(eligibility?: string): string {
  switch (eligibility) {
    case 'pickup': return 'Pickup only';
    case 'delivery': return 'Delivery only';
    default: return 'Pickup & Delivery';
  }
}

function formatPromoDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PromotionCarousel({ promotions }: PromotionCarouselProps) {
  const [selectedPromo, setSelectedPromo] = useState<VendorPromotion | null>(null);

  if (!promotions || promotions.length === 0) return null;

  const visiblePromotions = promotions.slice(0, 3);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Zap size={13} color={ACCENT} fill={ACCENT} />
          <Text style={styles.headerText}>Promotions</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {visiblePromotions.map((promo) => {
            const IconComponent = ICON_MAP[promo.icon] || Zap;

            return (
              <TouchableOpacity
                key={promo.id}
                style={styles.card}
                onPress={() => setSelectedPromo(promo)}
                activeOpacity={0.7}
                testID={`promo-card-${promo.id}`}
              >
                <View style={styles.cardIconWrap}>
                  <IconComponent size={16} color={ACCENT} />
                </View>
                <View style={styles.cardTextWrap}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{promo.title}</Text>
                  <Text style={styles.cardSubtext} numberOfLines={1}>{getPromoSubtext(promo)}</Text>
                </View>
                <View style={styles.cardInfoBtn}>
                  <Info size={14} color={Colors.textMuted} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Modal
        visible={selectedPromo !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedPromo(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedPromo(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalSheet}>
            {selectedPromo && (() => {
              const IconComponent = ICON_MAP[selectedPromo.icon] || Zap;

              return (
                <>
                  <View style={styles.modalHandle} />

                  <View style={styles.modalTopRow}>
                    <View style={styles.modalIconBadge}>
                      <IconComponent size={20} color="#FFF" />
                    </View>
                    <View style={styles.modalTopText}>
                      <Text style={styles.modalTitle}>{selectedPromo.title}</Text>
                      <Text style={styles.modalTypeLabel}>{getTypeLabel(selectedPromo.type)}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setSelectedPromo(null)}
                      style={styles.modalCloseBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <X size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.modalDivider} />

                  <View style={styles.modalDetailsGrid}>
                    {selectedPromo.minimumOrder > 0 && (
                      <View style={styles.modalDetailItem}>
                        <View style={styles.modalDetailIconWrap}>
                          <ShoppingBag size={14} color={ACCENT} />
                        </View>
                        <View>
                          <Text style={styles.modalDetailLabel}>Minimum order</Text>
                          <Text style={styles.modalDetailValue}>₦{selectedPromo.minimumOrder.toLocaleString()}</Text>
                        </View>
                      </View>
                    )}

                    {selectedPromo.type === 'percentage' && selectedPromo.maxDiscount && (
                      <View style={styles.modalDetailItem}>
                        <View style={styles.modalDetailIconWrap}>
                          <Percent size={14} color={ACCENT} />
                        </View>
                        <View>
                          <Text style={styles.modalDetailLabel}>Max discount</Text>
                          <Text style={styles.modalDetailValue}>₦{selectedPromo.maxDiscount.toLocaleString()}</Text>
                        </View>
                      </View>
                    )}

                    <View style={styles.modalDetailItem}>
                      <View style={styles.modalDetailIconWrap}>
                        <Calendar size={14} color={ACCENT} />
                      </View>
                      <View>
                        <Text style={styles.modalDetailLabel}>Valid period</Text>
                        <Text style={styles.modalDetailValue}>
                          {formatPromoDate(selectedPromo.startDate)} – {formatPromoDate(selectedPromo.endDate)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.modalDetailItem}>
                      <View style={styles.modalDetailIconWrap}>
                        <Truck size={14} color={ACCENT} />
                      </View>
                      <View>
                        <Text style={styles.modalDetailLabel}>Eligibility</Text>
                        <Text style={styles.modalDetailValue}>{getEligibilityLabel(selectedPromo.eligibility)}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.modalAutoRow}>
                    <Clock size={13} color={ACCENT} />
                    <Text style={styles.modalAutoText}>Applied automatically at checkout</Text>
                  </View>

                  {selectedPromo.vendorTerms ? (
                    <View style={styles.vendorTermsWrap}>
                      <Text style={styles.vendorTermsHeader}>Vendor Note</Text>
                      <Text style={styles.vendorTermsText}>{selectedPromo.vendorTerms}</Text>
                    </View>
                  ) : null}


                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  card: {
    width: 220,
    maxHeight: 80,
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 10,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ACCENT_BG_STRONG,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  cardTextWrap: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 18,
  },
  cardSubtext: {
    fontSize: 11,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },
  cardInfoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 28,
    maxHeight: '75%' as any,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 16,
  },
  modalTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    gap: 12,
  },
  modalIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalTopText: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 22,
  },
  modalTypeLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.cardBorder,
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
  },
  modalDetailsGrid: {
    paddingHorizontal: 20,
  },
  modalDetailItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  modalDetailIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ACCENT_BG,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalDetailLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  modalDetailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    lineHeight: 19,
  },
  modalAutoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: ACCENT_BG,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  modalAutoText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '500' as const,
    flex: 1,
  },
  vendorTermsWrap: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 14,
  },
  vendorTermsHeader: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  vendorTermsText: {
    fontSize: 13,
    color: Colors.textSecondaryOnSurface,
    lineHeight: 19,
  },

});
