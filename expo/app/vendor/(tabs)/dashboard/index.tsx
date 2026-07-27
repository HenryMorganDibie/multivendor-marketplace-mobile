import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Bell,
  Filter,
  TrendingUp,
  X,
  DollarSign,
  Calendar,
  AlertCircle,
  ArrowUpRight,
  StickyNote,
  Lock,
  Zap,
  ChevronRight,
  Clock,
  RefreshCw,
} from 'lucide-react-native';

import { useVendorNotifications } from '@/contexts/VendorNotificationContext';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { getBottomOverlayPadding } from '@/lib/constants/layout';
import { useVendor } from '@/contexts/VendorContext';
import { useVerification, type VerificationStatus } from '@/contexts/VerificationContext';
import { formatCompactCurrency, formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { useTodaysNote } from '@/contexts/TodaysNoteContext';
import { mockOrders } from '@/mocks/ordersData';
import TodaysNoteModal from '@/components/TodaysNoteModal';
import VendorSetupChecklist from '@/components/VendorSetupChecklist';
import { getMockInsights, ICON_MAP, type InsightData } from '@/mocks/insightsData';
import { useInvoices } from '@/contexts/InvoiceContext';
import {
  getInvoiceRevenueForDay,
  getInvoiceRevenueForRange,
} from '@/utils/invoiceRevenue';
import { formatInvoiceCustomerName } from '@/utils/internalCustomerName';

type TimeRange = 'today' | 'week' | 'month' | 'year';



const ORDERS_SPARKLINE_DATA = [3, 5, 2, 7, 4, 6, 3];
const REVENUE_7DAY = [12400, 18600, 9800, 24500, 15200, 21800, 18300];
const REVENUE_PREV_PERIOD = 16300;
const SPARKLINE_WIDTH = 80;
const SPARKLINE_HEIGHT = 28;
const REVENUE_SPARKLINE_WIDTH = 72;
const REVENUE_SPARKLINE_HEIGHT = 32;

function MiniSparkline({ data = ORDERS_SPARKLINE_DATA, width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT, color = Colors.primary }: { data?: number[]; width?: number; height?: number; color?: string }) {
  const animProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animProgress, {
      toValue: 1,
      duration: 800,
      delay: 400,
      useNativeDriver: true,
    }).start();
  }, [animProgress]);

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((val, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((val - min) / range) * (height - 4) - 2,
  }));

  return (
    <Animated.View style={{ opacity: animProgress, width, height }}>
      <View style={[sparkStyles.container, { width, height }]}>
        {points.map((point, i) => {
          if (i === 0) return null;
          const prev = points[i - 1];
          const dx = point.x - prev.x;
          const dy = point.y - prev.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);
          return (
            <View
              key={i}
              style={{
                position: 'absolute' as const,
                left: prev.x,
                top: prev.y,
                width: length,
                height: 1.5,
                backgroundColor: color,
                borderRadius: 1,
                transform: [{ rotate: `${angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          );
        })}
        {points.map((point, i) => (
          <View
            key={`dot-${i}`}
            style={{
              position: 'absolute' as const,
              left: point.x - 2.5,
              top: point.y - 2.5,
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: i === points.length - 1 ? color : `${color}80`,
              borderWidth: i === points.length - 1 ? 1.5 : 0,
              borderColor: '#fff',
            }}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const sparkStyles = StyleSheet.create({
  container: {
    position: 'relative' as const,
  },
});

function RevenueChangeRow({ current, previous, timeRange }: { current: number; previous: number; timeRange: TimeRange }) {
  const timeRangeCompareLabel: Record<TimeRange, string> = {
    today: 'vs yesterday',
    week: 'vs last week',
    month: 'vs last month',
    year: 'vs last year',
  };
  if (previous === 0) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  const isUp = pct >= 0;
  return (
    <View style={rcStyles.row}>
      {isUp ? (
        <TrendingUp size={11} color="#16A34A" strokeWidth={2.5} />
      ) : (
        <TrendingUp size={11} color="#DC2626" strokeWidth={2.5} style={{ transform: [{ scaleY: -1 }] }} />
      )}
      <Text style={[rcStyles.pct, { color: isUp ? '#16A34A' : '#DC2626' }]}>
        {isUp ? '+' : ''}{pct}%
      </Text>
      <Text style={rcStyles.label}>{timeRangeCompareLabel[timeRange]}</Text>
    </View>
  );
}

const rcStyles = StyleSheet.create({
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    marginTop: 3,
  },
  pct: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '400' as const,
  },
});

function InsightsSection({ plan, bestSellerName, bestSellerCount, pendingPaymentCount }: {
  plan: string;
  bestSellerName: string | null;
  bestSellerCount: number;
  pendingPaymentCount: number;
}) {
  const router = useRouter();
  const isPro = plan === 'pro' || plan === 'pro+';
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const insights: InsightData[] = useMemo(() => {
    return getMockInsights({
      pendingPaymentCount,
      bestSellerName,
      bestSellerCount,
      newCustomersThisWeek: 3,
      lowStockCount: 2,
      avgResponseMinutes: 8,
    });
  }, [pendingPaymentCount, bestSellerName, bestSellerCount]);

  const cycleInsight = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setCurrentIndex(prev => (prev + 1) % insights.length);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [fadeAnim, insights.length]);

  const insight = insights[currentIndex] ?? insights[0];
  const IconComp = insight ? ICON_MAP[insight.iconName] : null;

  return (
    <View style={insightStyles.section}>
      <View style={insightStyles.headerRow}>
        <Text style={insightStyles.sectionTitle}>INSIGHTS</Text>
        {isPro && insights.length > 1 && (
          <TouchableOpacity onPress={cycleInsight} activeOpacity={0.7} style={insightStyles.nextBtn}>
            <Text style={insightStyles.nextBtnText}>Next</Text>
            <ChevronRight size={13} color={Colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      {!isPro ? (
        <TouchableOpacity
          style={insightStyles.lockedCard}
          onPress={() => router.push('/vendor/growth-insights')}
          activeOpacity={0.8}
        >
          <View style={insightStyles.lockedIconWrap}>
            <Lock size={22} color="#9CA3AF" strokeWidth={2} />
          </View>
          <View style={insightStyles.lockedTextWrap}>
            <Text style={insightStyles.lockedTitle}>Business Insights</Text>
            <Text style={insightStyles.lockedMessage}>
              Upgrade to Pro to unlock sales, customer & order source insights.
            </Text>
          </View>
          <TouchableOpacity
            style={insightStyles.upgradeBtn}
            onPress={() => router.push('/vendor/settings/subscription' as any)}
            activeOpacity={0.8}
          >
            <Zap size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={insightStyles.upgradeBtnText}>Upgrade</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : (
        <>
          <Animated.View style={[insightStyles.insightCard, { opacity: fadeAnim }]}>
            {IconComp && (
              <View style={[insightStyles.insightIconWrap, { backgroundColor: insight.iconBg }]}>
                <IconComp size={20} color={insight.iconColor} strokeWidth={2} />
              </View>
            )}
            <View style={insightStyles.insightTextWrap}>
              <Text style={insightStyles.insightMessage}>{insight.message}</Text>
              {insight.actionLabel && insight.actionRoute && (
                <TouchableOpacity
                  style={insightStyles.actionBtn}
                  onPress={() => router.push(insight.actionRoute as any)}
                  activeOpacity={0.7}
                >
                  <Text style={insightStyles.actionBtnText}>{insight.actionLabel}</Text>
                  <ArrowUpRight size={13} color={Colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
            {insights.length > 1 && (
              <View style={insightStyles.dotsRow}>
                {insights.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      insightStyles.dot,
                      i === currentIndex && insightStyles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </Animated.View>

          <TouchableOpacity
            style={insightStyles.growthInsightsCard}
onPress={() => {
console.log('Trying RELATIVE navigation to ../growth-insights');
  router.push({
      pathname: '/vendor/growth-insights',
    });
  }}
            activeOpacity={0.75}
          >
            <View style={insightStyles.growthInsightsLeft}>
              <View style={insightStyles.growthIconWrap}>
                <TrendingUp size={18} color={Colors.primary} strokeWidth={2} />
              </View>
              <View style={insightStyles.growthTextWrap}>
                <Text style={insightStyles.growthTitle}>Business Insights</Text>
                <Text style={insightStyles.growthSubtitle}>Sales, customers, order sources & trends</Text>
              </View>
            </View>
            <ChevronRight size={16} color={Colors.primary} strokeWidth={2} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function getUpcomingDateLabel(scheduledDate?: string): string {
  if (!scheduledDate) return 'Upcoming';
  const date = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

interface VerificationBannerConfig {
  containerStyle: object;
  iconWrapStyle: object;
  icon: React.ReactNode;
  title: string;
  body: string;
  bodyMuted?: string;
  ctaLabel?: string;
  ctaIcon?: React.ReactNode;
  ctaStyle: object;
  ctaTextStyle: object;
  dismissColor: string;
  showLearnMore: boolean;
  isDisabled?: boolean;
  submittedAt?: string;
  rejectionReason?: string;
}

function getVerificationBannerConfig(status: VerificationStatus, submittedAt?: string, rejectionReason?: string): VerificationBannerConfig | null {
  switch (status) {
    case 'not_started':
      return {
        containerStyle: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
        iconWrapStyle: { backgroundColor: 'rgba(194,65,12,0.1)' },
        icon: <AlertCircle size={18} color="#C2410C" strokeWidth={2} />,
        title: 'Complete verification to go live',
        body: 'Complete verification to appear in Home, Explore, and Search. You can still share your storefront link.',
        ctaLabel: 'Verify now',
        ctaIcon: <Lock size={13} color="#FFFFFF" strokeWidth={2.5} />,
        ctaStyle: { backgroundColor: '#C2410C' },
        ctaTextStyle: { color: '#FFFFFF' },
        dismissColor: '#9A3412',
        showLearnMore: true,
      };
    case 'pending_review':
      return {
        containerStyle: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
        iconWrapStyle: { backgroundColor: 'rgba(217,119,6,0.1)' },
        icon: <Clock size={18} color="#D97706" strokeWidth={2} />,
        title: 'Verification under review',
        body: 'Verification under review. You can still share your storefront link.',
        bodyMuted: submittedAt ? `Submitted ${new Date(submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : undefined,
        ctaLabel: undefined,
        ctaIcon: undefined,
        ctaStyle: {},
        ctaTextStyle: {},
        dismissColor: '#92400E',
        showLearnMore: false,
        isDisabled: true,
        submittedAt,
      };
    case 'retry_required':
      return {
        containerStyle: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
        iconWrapStyle: { backgroundColor: 'rgba(220,38,38,0.1)' },
        icon: <AlertCircle size={18} color="#DC2626" strokeWidth={2} />,
        title: 'Verification needs attention',
        body: 'Verification needs attention. Please resubmit.',
        ctaLabel: 'Resubmit',
        ctaIcon: <RefreshCw size={13} color="#FFFFFF" strokeWidth={2.5} />,
        ctaStyle: { backgroundColor: '#DC2626' },
        ctaTextStyle: { color: '#FFFFFF' },
        dismissColor: '#991B1B',
        showLearnMore: false,
        rejectionReason,
      };
    case 'rejected':
      return {
        containerStyle: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
        iconWrapStyle: { backgroundColor: 'rgba(220,38,38,0.1)' },
        icon: <AlertCircle size={18} color="#DC2626" strokeWidth={2} />,
        title: 'Verification unsuccessful',
        body: 'Verification unsuccessful. Contact support or resubmit if eligible.',
        ctaLabel: 'Fix & resubmit',
        ctaIcon: <RefreshCw size={13} color="#FFFFFF" strokeWidth={2.5} />,
        ctaStyle: { backgroundColor: '#DC2626' },
        ctaTextStyle: { color: '#FFFFFF' },
        dismissColor: '#991B1B',
        showLearnMore: false,
        rejectionReason,
      };
    case 'suspended':
      return {
        containerStyle: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
        iconWrapStyle: { backgroundColor: 'rgba(220,38,38,0.1)' },
        icon: <AlertCircle size={18} color="#DC2626" strokeWidth={2} />,
        title: 'Account suspended',
        body: 'Your account is suspended. Your storefront is unavailable.',
        bodyMuted: rejectionReason ? `Reason: ${rejectionReason}` : undefined,
        ctaLabel: 'Contact Support',
        ctaIcon: undefined,
        ctaStyle: { backgroundColor: '#DC2626' },
        ctaTextStyle: { color: '#FFFFFF' },
        dismissColor: '#991B1B',
        showLearnMore: false,
        isDisabled: true,
      };
    case 'deactivated':
      return {
        containerStyle: { backgroundColor: '#F3F4F6', borderColor: '#D1D5DB' },
        iconWrapStyle: { backgroundColor: 'rgba(107,114,128,0.15)' },
        icon: <AlertCircle size={18} color="#6B7280" strokeWidth={2} />,
        title: 'Account deactivated',
        body: 'Your account has been deactivated.',
        ctaLabel: 'Contact Support',
        ctaIcon: undefined,
        ctaStyle: { backgroundColor: '#6B7280' },
        ctaTextStyle: { color: '#FFFFFF' },
        dismissColor: '#4B5563',
        showLearnMore: false,
        isDisabled: true,
      };
    case 'approved':
      return null;
    default:
      return null;
  }
}

function VerificationBanner({ onDismiss, verificationStatus, submittedAt, rejectionReason }: { onDismiss: () => void; verificationStatus: VerificationStatus; submittedAt?: string; rejectionReason?: string }) {
  const router = useRouter();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const config = getVerificationBannerConfig(verificationStatus, submittedAt, rejectionReason);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
    }).start();
  }, [slideAnim]);

  if (!config) return null;

  const isPending = verificationStatus === 'pending_review';
  const isAccountBlocked = verificationStatus === 'suspended' || verificationStatus === 'deactivated';

  return (
    <Animated.View
      style={[
        bannerStyles.container,
        config.containerStyle,
        {
          opacity: slideAnim,
          transform: [{
            translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-12, 0],
            }),
          }],
        },
      ]}
    >
      <View style={bannerStyles.topRow}>
        <View style={bannerStyles.iconTitleRow}>
          <View style={[bannerStyles.iconWrap, config.iconWrapStyle]}>
            {config.icon}
          </View>
          <Text style={[bannerStyles.title, { color: isPending ? '#92400E' : (verificationStatus === 'rejected' || verificationStatus === 'retry_required') ? '#991B1B' : isAccountBlocked ? '#991B1B' : '#9A3412' }]}>{config.title}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <X size={16} color={config.dismissColor} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <Text style={[bannerStyles.body, { color: isPending ? '#B45309' : (verificationStatus === 'rejected' || verificationStatus === 'retry_required') ? '#DC2626' : isAccountBlocked ? '#DC2626' : '#C2410C' }]}>
        {config.body}
        {config.bodyMuted ? (
          <Text style={[bannerStyles.bodyMuted, { color: isPending ? '#D97706' : isAccountBlocked ? '#991B1B' : '#EA580C' }]}>{' '}{config.bodyMuted}</Text>
        ) : null}
      </Text>

      {isPending && (
        <View style={bannerStyles.pendingChip}>
          <Clock size={12} color="#D97706" strokeWidth={2.5} />
          <Text style={bannerStyles.pendingChipText}>Verification in progress</Text>
        </View>
      )}

      <View style={bannerStyles.actionsRow}>
        {config.ctaLabel && (
          <TouchableOpacity
            style={[bannerStyles.ctaButton, config.ctaStyle]}
            onPress={() => router.push('/vendor/settings/verification' as any)}
            activeOpacity={0.8}
          >
            {config.ctaIcon}
            <Text style={[bannerStyles.ctaText, config.ctaTextStyle]}>{config.ctaLabel}</Text>
          </TouchableOpacity>
        )}
        {config.showLearnMore && (
          <TouchableOpacity
            onPress={() => router.push('/vendor/settings/help-article/verification-trust' as any)}
            activeOpacity={0.7}
          >
            <Text style={bannerStyles.learnMore}>Learn more</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  topRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 8,
  },
  iconTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: 'rgba(194,65,12,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  title: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#9A3412',
    flex: 1,
    lineHeight: 19,
  },
  body: {
    fontSize: 13,
    color: '#C2410C',
    lineHeight: 18,
    marginBottom: 12,
  },
  bodyMuted: {
    color: '#EA580C',
    fontWeight: '400' as const,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 14,
  },
  ctaButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: '#C2410C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  learnMore: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#C2410C',
    textDecorationLine: 'underline' as const,
  },
  pendingChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: 'rgba(217,119,6,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start' as const,
    marginBottom: 4,
  },
  pendingChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#D97706',
  },
});

export default function VendorDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [verificationBannerDismissed, setVerificationBannerDismissed] = useState(false);
  const { plan, usernameSelectionPending } = useVendorPlan();
  const { unreadHighPriorityCount, hasUnreadMediumPriority } = useVendorNotifications();
  const { vendor: _vendor, updateVendor: _updateVendor } = useVendor();
  const { note: todaysNote } = useTodaysNote();
  const { verificationData } = useVerification();

  const verificationStatus = verificationData.status;
  const showVerificationBanner = verificationStatus !== 'approved' && !verificationBannerDismissed;

  React.useEffect(() => {
    if (usernameSelectionPending) {
      console.log('[DASHBOARD] Username selection pending, redirecting to select-username');
      router.replace('/vendor/settings/select-username');
    }
  }, [usernameSelectionPending, router]);

  const getDefaultTimeRange = (): TimeRange => {
    if (plan === 'pro+') return 'year';
    if (plan === 'pro') return 'month';
    if (plan === 'standard') return 'week';
    return 'today';
  };

  const [timeRange, setTimeRange] = useState<TimeRange>(getDefaultTimeRange());

  const canAccessTimeRange = (range: TimeRange): boolean => {
    if (range === 'today') return true;
    if (range === 'week') return plan !== 'basic';
    if (range === 'month') return plan === 'pro' || plan === 'pro+';
    if (range === 'year') return plan === 'pro+';
    return false;
  };

  const getUpgradeMessage = (range: TimeRange): string => {
    if (range === 'week') return 'Upgrade to Standard or higher to view weekly analytics';
    if (range === 'month') return 'Upgrade to Pro to view monthly analytics';
    if (range === 'year') return 'Upgrade to Pro+ to view yearly analytics';
    return '';
  };

  const getRequiredPlan = (range: TimeRange): string => {
    if (range === 'week') return 'Standard';
    if (range === 'month') return 'Pro';
    if (range === 'year') return 'Pro+';
    return '';
  };


  const pendingOrders = mockOrders.filter(o => o.status === 'requested');
  const pendingPaymentOrders = mockOrders.filter(o => o.paymentStatus === 'payment_pending');

  const todayOrders = mockOrders.filter(o => {
    const orderDate = new Date(o.orderDate);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  });

  const completedOrders = mockOrders.filter(o => o.status === 'completed');

  // Revenue = money the vendor has CONFIRMED receiving. Orders contribute
  // their total when completed; standalone invoices contribute their
  // recorded payments (keyed off payment date, not issue date). Invoices
  // linked to an order are skipped here so the same payment is never counted
  // once via the order and again via the invoice — see
  // BACKEND_INTEGRATION_GUIDE.md "Invoice payment double-counting".
  const { invoices } = useInvoices();
  const linkedOrderIds = useMemo(
    () => new Set(mockOrders.map((o) => o.id)),
    [],
  );
  const todayStr = new Date().toDateString();
  const invoiceRevenueToday = useMemo(
    () => getInvoiceRevenueForDay(invoices, todayStr, linkedOrderIds),
    [invoices, todayStr, linkedOrderIds],
  );

  // Total revenue: completed orders + standalone invoice payments (all-time).
  // Uses the range helper with a wide window so every recorded payment is
  // captured regardless of when it was received.
  const invoiceRevenueAll = useMemo(
    () => getInvoiceRevenueForRange(invoices, new Date(0), new Date(), linkedOrderIds),
    [invoices, linkedOrderIds],
  );

  const orderRevenueTotal = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const totalRevenue = orderRevenueTotal + invoiceRevenueAll;

  const _totalOrders = mockOrders.length;

  const todayRevenue =
    todayOrders
      .filter(o => o.status === 'completed')
      .reduce((sum, o) => sum + o.total, 0) + invoiceRevenueToday;

  const todayOrdersCount = todayOrders.length;

  const storefrontVisitsToday = useMemo(() => {
    return todayOrdersCount * 12 + 47;
  }, [todayOrdersCount]);

  const bestSeller = useMemo(() => {
    const itemCounts: Record<string, { name: string; count: number }> = {};
    completedOrders.forEach(o => {
      o.items.forEach(item => {
        if (!itemCounts[item.id]) {
          itemCounts[item.id] = { name: item.name, count: 0 };
        }
        itemCounts[item.id].count += item.quantity;
      });
    });
    const sorted = Object.values(itemCounts).sort((a, b) => b.count - a.count);
    return sorted[0] || null;
  }, [completedOrders]);

  const todayScheduleOrders = useMemo(() => {
    const terminalStatuses = ['completed', 'cancelled', 'rejected', 'expired'];
    const today = new Date();
    const todayStr = today.toDateString();
    return mockOrders
      .filter(o => {
        if (terminalStatuses.includes(o.status)) return false;
        const scheduled = o.scheduledDate ? new Date(o.scheduledDate) : new Date(o.orderDate);
        return scheduled.toDateString() === todayStr;
      })
      .sort((a, b) => {
        const timeA = a.scheduledTime || '12:00 PM';
        const timeB = b.scheduledTime || '12:00 PM';
        return parseTimeToMinutes(timeA) - parseTimeToMinutes(timeB);
      })
      .slice(0, 3);
  }, []);

  const nextOrderId = useMemo(() => {
    if (todayScheduleOrders.length === 0) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const upcoming = todayScheduleOrders.find(o => {
      const time = o.scheduledTime || '12:00 PM';
      return parseTimeToMinutes(time) >= currentMinutes;
    });
    return upcoming ? upcoming.id : todayScheduleOrders[0].id;
  }, [todayScheduleOrders]);

  const upcomingOrders = useMemo(() => {
    const terminalStatuses = ['completed', 'cancelled', 'rejected', 'expired'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return mockOrders
      .filter(o => {
        if (terminalStatuses.includes(o.status)) return false;
        const scheduled = o.scheduledDate ? new Date(o.scheduledDate) : new Date(o.orderDate);
        scheduled.setHours(0, 0, 0, 0);
        return scheduled >= tomorrow;
      })
      .sort((a, b) => {
        const dateA = new Date(a.scheduledDate || a.orderDate);
        const dateB = new Date(b.scheduledDate || b.orderDate);
        if (dateA.toDateString() === dateB.toDateString()) {
          return parseTimeToMinutes(a.scheduledTime || '12:00 PM') - parseTimeToMinutes(b.scheduledTime || '12:00 PM');
        }
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 3);
  }, []);

  const navigateToOrder = useCallback((order: typeof mockOrders[0]) => {
    if (order.orderSource === 'external') {
      router.push({
        pathname: '/vendor/orders/external/[orderId]' as any,
        params: { orderId: order.id },
      });
    } else {
      router.push({
        pathname: '/vendor/orders/[orderId]' as any,
        params: { orderId: order.id },
      });
    }
  }, [router]);

  const applyFilter = (range: TimeRange) => {
    if (!canAccessTimeRange(range)) {
      return;
    }
    setTimeRange(range);
    setFilterModalVisible(false);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={() => router.push('/vendor/notifications' as any)}
            >
              <Bell size={22} color={Colors.text} strokeWidth={2} />
              {unreadHighPriorityCount > 0 && (
                <View style={styles.redBadge}>
                  <Text style={styles.redBadgeText}>{unreadHighPriorityCount}</Text>
                </View>
              )}
              {unreadHighPriorityCount === 0 && hasUnreadMediumPriority && (
                <View style={styles.dotBadge} />
              )}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.headerIconButton}
              activeOpacity={0.7}
              onPress={() => setFilterModalVisible(true)}
            >
              <Filter size={22} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {showVerificationBanner && (
          <VerificationBanner
            onDismiss={() => setVerificationBannerDismissed(true)}
            verificationStatus={verificationStatus}
            submittedAt={verificationData.submittedAt}
            rejectionReason={verificationData.rejectionReason}
          />
        )}

        {/* Sits above the KPI cards deliberately: for a vendor who hasn't
            finished setup, the KPIs are all zeroes and the next action
            matters more than the numbers. Hides itself once setup is done. */}
        <VendorSetupChecklist />

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(255,140,66,0.15)' }]}>
              <Calendar size={18} color="#C2410C" />
            </View>
            <Text style={styles.kpiLabel}>Orders Today</Text>
            <Text style={styles.kpiValue}>{todayOrders.length}</Text>
            <MiniSparkline data={ORDERS_SPARKLINE_DATA} />
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#FFFBEB' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
              <AlertCircle size={18} color="#B45309" />
            </View>
            <Text style={styles.kpiLabel}>Pending</Text>
            <Text style={styles.kpiValue}>{pendingOrders.length}</Text>
            <Text style={styles.kpiSub}>{pendingOrders.length} needs action</Text>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { backgroundColor: '#F0FDF4' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(22,163,74,0.12)' }]}>
              <TrendingUp size={18} color="#16A34A" />
            </View>
            <Text style={styles.kpiLabel}>Best Seller</Text>
            {bestSeller ? (
              <>
                <Text style={styles.kpiValueSmall} numberOfLines={1}>{bestSeller.name}</Text>
                <Text style={styles.kpiSub}>{bestSeller.count} sold</Text>
              </>
            ) : (
              <Text style={styles.kpiSub}>No data</Text>
            )}
          </View>

          <View style={[styles.kpiCard, { backgroundColor: '#EFF6FF' }]}>
            <View style={[styles.kpiIconWrap, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
              <DollarSign size={18} color="#2563EB" />
            </View>
            <Text style={styles.kpiLabel}>Revenue</Text>
            <Text style={styles.kpiValue}>{formatCompactCurrency(totalRevenue, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
            <RevenueChangeRow current={totalRevenue} previous={REVENUE_PREV_PERIOD} timeRange={timeRange} />
            <View style={{ marginTop: 8 }}>
              <MiniSparkline
                data={REVENUE_7DAY}
                width={REVENUE_SPARKLINE_WIDTH}
                height={REVENUE_SPARKLINE_HEIGHT}
                color="#2563EB"
              />
            </View>
          </View>
        </View>

        <InsightsSection
          plan={plan}
          bestSellerName={bestSeller?.name ?? null}
          bestSellerCount={bestSeller?.count ?? 0}
          pendingPaymentCount={pendingPaymentOrders.length}
        />

        <View style={styles.perfRow}>
          <View style={styles.perfCard}>
            <View style={styles.perfLabelWrap}>
              <Text style={styles.perfLabel} numberOfLines={2}>{"Today's\nRevenue"}</Text>
            </View>
            <Text style={styles.perfValue}>{formatCompactCurrency(todayRevenue, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfCard}>
            <View style={styles.perfLabelWrap}>
              <Text style={styles.perfLabel} numberOfLines={2}>{"Total\nOrders"}</Text>
            </View>
            <Text style={styles.perfValue}>{todayOrdersCount}</Text>
          </View>
          <View style={styles.perfDivider} />
          <View style={styles.perfCard}>
            <View style={styles.perfLabelWrap}>
              <Text style={styles.perfLabel} numberOfLines={2}>{"Store\nViews"}</Text>
            </View>
            <Text style={styles.perfValue}>{storefrontVisitsToday}</Text>
          </View>
        </View>

 <TouchableOpacity
          style={styles.noteCard}
          onPress={() => setNoteModalVisible(true)}
          activeOpacity={0.7}
          testID="todays-note-button"
        >
          <View style={styles.noteCardLeft}>
            <View style={styles.noteIconWrap}>
              <StickyNote size={20} color={Colors.primary} />
            </View>
            <View style={styles.noteCardTextWrap}>
              <Text style={styles.noteCardTitle}>{"Today's Note"}</Text>
              <Text style={styles.noteCardPreview} numberOfLines={2}>
                {todaysNote.trim() ? todaysNote.trim().slice(0, 80) + (todaysNote.trim().length > 80 ? '...' : '') : 'Add today\u0027s note...'}
              </Text>
            </View>
          </View>
          <ChevronIcon />
        </TouchableOpacity>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Today's Schedule"}</Text>
            <TouchableOpacity
              onPress={() => router.push('/vendor/orders' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          {todayScheduleOrders.length > 0 ? (
            <View style={styles.listContainer}>
              {todayScheduleOrders.map((order, index) => {
                const isNext = order.id === nextOrderId;
                const isLast = index === todayScheduleOrders.length - 1;
                return (
                  <View key={order.id}>
                    <TouchableOpacity
                      style={[styles.listRow, isNext && styles.listRowNextOrder]}
                      onPress={() => navigateToOrder(order)}
                      activeOpacity={0.6}
                    >
                      {isNext && <View style={styles.nextOrderAccent} />}
                      <View style={styles.listRowLeft}>
                        <Text style={styles.listRowType}>
                          {order.fulfillmentType} • {order.scheduledTime || '12:00 PM'}
                        </Text>
                        <Text style={styles.listRowCustomer}>{formatInvoiceCustomerName(order.customerName, 'the platform')}</Text>
                      </View>
                      <View style={styles.listRowRight}>
                        <Text style={styles.listRowMeta}>
                          {order.items.reduce((sum, i) => sum + i.quantity, 0)} items • {formatCompactCurrency(order.total, (mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode))}
                        </Text>
                        <ChevronIcon />
                      </View>
                    </TouchableOpacity>
                    {!isLast && <View style={styles.listDivider} />}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.scheduleCardEmpty}>
              <Text style={styles.scheduleEmptyText}>Nothing scheduled for today.</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{"Upcoming Orders & Bookings"}</Text>
            <TouchableOpacity
              onPress={() => router.push('/vendor/orders' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          {upcomingOrders.length > 0 ? (
            <View style={styles.listContainer}>
              {upcomingOrders.map((order, index) => {
                const dateLabel = getUpcomingDateLabel(order.scheduledDate);
                const isLast = index === upcomingOrders.length - 1;
                return (
                  <View key={order.id}>
                    <TouchableOpacity
                      style={styles.listRow}
                      onPress={() => navigateToOrder(order)}
                      activeOpacity={0.6}
                    >
                      <View style={styles.listRowLeft}>
                        <Text style={styles.listRowType}>
                          {dateLabel} • {order.scheduledTime || '12:00 PM'}
                        </Text>
                        <Text style={styles.listRowCustomer}>{formatInvoiceCustomerName(order.customerName, 'the platform')}</Text>
                      </View>
                      <View style={styles.listRowRight}>
                        <Text style={styles.listRowMeta}>
                          {order.items.reduce((sum, i) => sum + i.quantity, 0)} items
                        </Text>
                        <ChevronIcon />
                      </View>
                    </TouchableOpacity>
                    {!isLast && <View style={styles.listDivider} />}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.scheduleCardEmpty}>
              <Text style={styles.scheduleEmptyText}>No upcoming orders.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Dashboard</Text>
              <TouchableOpacity
                onPress={() => setFilterModalVisible(false)}
                activeOpacity={0.7}
              >
                <X size={24} color={Colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.filterLabel}>Select time range</Text>
              
              <TouchableOpacity
                style={[styles.filterOption, timeRange === 'today' && styles.filterOptionActive]}
                onPress={() => applyFilter('today')}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterOptionText, timeRange === 'today' && styles.filterOptionTextActive]}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  timeRange === 'week' && styles.filterOptionActive,
                  !canAccessTimeRange('week') && styles.filterOptionDisabled
                ]}
                onPress={() => {
                  if (!canAccessTimeRange('week')) {
                    alert(getUpgradeMessage('week'));
                  } else {
                    applyFilter('week');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterOptionText,
                  timeRange === 'week' && styles.filterOptionTextActive,
                  !canAccessTimeRange('week') && styles.filterOptionTextDisabled
                ]}>This week</Text>
                {!canAccessTimeRange('week') && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{getRequiredPlan('week')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  timeRange === 'month' && styles.filterOptionActive,
                  !canAccessTimeRange('month') && styles.filterOptionDisabled
                ]}
                onPress={() => {
                  if (!canAccessTimeRange('month')) {
                    alert(getUpgradeMessage('month'));
                  } else {
                    applyFilter('month');
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.filterOptionText,
                  timeRange === 'month' && styles.filterOptionTextActive,
                  !canAccessTimeRange('month') && styles.filterOptionTextDisabled
                ]}>This month</Text>
                {!canAccessTimeRange('month') && (
                  <View style={styles.planBadge}>
                    <Text style={styles.planBadgeText}>{getRequiredPlan('month')}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.filterOption,
                  timeRange === 'year' && styles.filterOptionActive,
                  !canAccessTimeRange('year') && styles.filterOptionDisabled
                ]}
                onPress={() => {
                  if (!canAccessTimeRange('year')) {
                    alert(getUpgradeMessage('year'));
                  } else {
                    applyFilter('year');
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.filterOptionContent}>
                  <View>
                    <Text style={[
                      styles.filterOptionText,
                      timeRange === 'year' && styles.filterOptionTextActive,
                      !canAccessTimeRange('year') && styles.filterOptionTextDisabled
                    ]}>This Year</Text>
                    <Text style={styles.filterOptionSubtext}>Year-to-date performance</Text>
                  </View>
                  {!canAccessTimeRange('year') && (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{getRequiredPlan('year')}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setFilterModalVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TodaysNoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
      />
    </View>
  );
}

const insightStyles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  nextBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 2,
  },
  nextBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  lockedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  lockedIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  lockedTextWrap: {
    flex: 1,
  },
  lockedTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    marginBottom: 2,
  },
  lockedMessage: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
  },
  upgradeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  upgradeBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  insightIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  insightTextWrap: {
    flex: 1,
  },
  insightMessage: {
    fontSize: 14,
    color: '#2B2B2B',
    lineHeight: 20,
    fontWeight: '500' as const,
  },
  actionBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    marginTop: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  dotsRow: {
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 4,
    justifyContent: 'center' as const,
    paddingTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
  },
  dotActive: {
    backgroundColor: Colors.primary,
  },
  growthInsightsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  growthInsightsLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  growthIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  growthTextWrap: {
    flex: 1,
  },
  growthTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    marginBottom: 2,
  },
  growthSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

function ChevronIcon() {
  return (
    <View style={{ width: 20, alignItems: 'center' as const }}>
      <View style={{ width: 8, height: 8, borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#D1D5DB', transform: [{ rotate: '-45deg' }] }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: '#111111',
  },
  headerActions: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    position: 'relative' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  noteCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  noteCardLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 13,
  },
  noteIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.primarySofter,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  noteCardTextWrap: {
    flex: 1,
  },
  noteCardTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 3,
    letterSpacing: -0.1,
  },
  noteCardPreview: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  kpiRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 10,
  },
  kpiCard: {
    flex: 1,
    borderRadius: 18,
    padding: 16,
    minHeight: 124,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  kpiIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  kpiLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600' as const,
    letterSpacing: 0.3,
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#1A1A1A',
    letterSpacing: -0.6,
  },
  kpiValueSmall: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  kpiSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
    lineHeight: 15,
  },
  perfRow: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.white,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    alignItems: 'center' as const,
  },
  perfCard: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  perfLabelWrap: {
    height: 30,
    justifyContent: 'flex-end' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  perfDivider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.borderSoft,
    opacity: 0.6,
  },
  perfLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
    lineHeight: 14,
  },
  perfValue: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.4,
    lineHeight: 22,
    textAlign: 'center' as const,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: 'uppercase' as const,
  },
  scheduleCardEmpty: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  scheduleEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  listContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  listRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  listRowLeft: {
    flex: 1,
  },
  listRowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  listRowType: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.2,
    marginBottom: 3,
    textTransform: 'capitalize' as const,
  },
  listRowCustomer: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
  },
  listRowMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  listDivider: {
    height: 1,
    backgroundColor: Colors.borderSoft,
    marginLeft: 16,
  },

  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  modalBody: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
  },
  filterOption: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  filterOptionDisabled: {
    opacity: 0.5,
  },
  filterOptionActive: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  filterOptionTextDisabled: {
    color: Colors.textSecondary,
  },
  filterOptionTextActive: {
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  filterOptionContent: {
    flex: 1,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  filterOptionSubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  applyButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  redBadge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 5,
  },
  redBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  dotBadge: {
    position: 'absolute' as const,
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  listRowNextOrder: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  nextOrderAccent: {
    position: 'absolute' as const,
    left: 0,
    top: 0,
    bottom: 0,
    width: 3.5,
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },

});
