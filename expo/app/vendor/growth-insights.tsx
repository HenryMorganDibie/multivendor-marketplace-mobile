import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  ShoppingBag,
  Globe,
  Lock,
  Zap,
  BarChart2,
  ArrowUpRight,
  Store,
  MessageCircle,
  Phone,
  Camera,
  Monitor,
  MapPin,
  HelpCircle,
  Crown,
  LineChart,
  Info,
  Users,
  MousePointerClick,
  Lightbulb,
  AlertTriangle,
  Star,
} from 'lucide-react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText, Circle } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { useExternalOrders, type ExternalOrder } from '@/contexts/ExternalOrdersContext';
import { useOrders } from '@/contexts/OrdersContext';
import { useVendor } from '@/contexts/VendorContext';
import { useVerification } from '@/contexts/VerificationContext';
import { formatCompactCurrency, formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { formatInvoiceCustomerName } from '@/utils/internalCustomerName';
import { useInvoices } from '@/contexts/InvoiceContext';
import { getInvoiceRevenueForRange } from '@/utils/invoiceRevenue';
import { useBusinessAnalytics, isPending } from '@/lib/analytics/useBusinessAnalytics';

type TimeRange = '1D' | '1W' | '1M' | '3M' | '6M';

interface SourceData {
  source: string;
  orders: number;
  revenue: number;
  customers: Set<string>;
  color: string;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

interface TrendPoint {
  label: string;
  value: number;
}

// Static illustrative preview shown only in the locked (non-entitled) state
// of the Revenue Trend chart — never real vendor data, matching the same
// hardcoded-preview pattern already used for the locked Top Customers and
// Customer Source Breakdown sections on this screen.
const REVENUE_TREND_PREVIEW: TrendPoint[] = [
  { label: 'Mon', value: 18500 },
  { label: 'Tue', value: 24200 },
  { label: 'Wed', value: 19800 },
  { label: 'Thu', value: 31000 },
  { label: 'Fri', value: 27600 },
  { label: 'Sat', value: 39200 },
  { label: 'Sun', value: 22400 },
];

const SOURCE_CONFIG: Record<string, { color: string; IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }> }> = {
  'WhatsApp':           { color: '#25D366', IconComponent: MessageCircle },
  'Instagram':          { color: '#E1306C', IconComponent: Camera },
  'TikTok':             { color: '#010101', IconComponent: BarChart2 },
  'Phone':              { color: '#2563EB', IconComponent: Phone },
  'Walk-in':            { color: '#7C3AED', IconComponent: MapPin },
  'Website':            { color: '#0EA5E9', IconComponent: Monitor },
  'Other':              { color: '#9CA3AF', IconComponent: HelpCircle },
  'the platform Marketplace':{ color: Colors.primary, IconComponent: Store },
};

const ALL_EXTERNAL_SOURCES = ['WhatsApp', 'Instagram', 'TikTok', 'Phone', 'Walk-in', 'Website', 'Other'];

function getDateThreshold(range: TimeRange): Date {
  const now = new Date();
  const days = range === '1D' ? 1 : range === '1W' ? 7 : range === '1M' ? 30 : range === '3M' ? 90 : 180;
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

function filterByRange(orders: ExternalOrder[], range: TimeRange): ExternalOrder[] {
  const threshold = getDateThreshold(range);
  return orders.filter(o => new Date(o.orderDate) >= threshold);
}

function getSmoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const dx = (curr.x - prev.x) * 0.45;
    d += ` C ${(prev.x + dx).toFixed(1)} ${prev.y.toFixed(1)}, ${(curr.x - dx).toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
}

function buildAreaPath(pts: Array<{ x: number; y: number }>, bottomY: number): string {
  if (pts.length < 2) return '';
  return `${getSmoothPath(pts)} L ${pts[pts.length - 1].x.toFixed(1)} ${bottomY.toFixed(1)} L ${pts[0].x.toFixed(1)} ${bottomY.toFixed(1)} Z`;
}

function formatAxisVal(val: number): string {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return String(Math.round(val));
}

function getRevenueTrendData(
  the platform: Array<{ orderDate: string; total: number }>,
  external: Array<{ orderDate: string; total: number }>,
  range: TimeRange
): TrendPoint[] {
  const all = [...the platform, ...external];
  const now = new Date();

  if (range === '1D') {
    return Array.from({ length: 8 }, (_, i) => {
      const endD = new Date(now);
      endD.setHours(Math.floor((i + 1) * (24 / 8)), 0, 0, 0);
      const startD = new Date(endD);
      startD.setHours(startD.getHours() - 3);
      const value = all
        .filter(o => { const d = new Date(o.orderDate); return d >= startD && d <= endD; })
        .reduce((s, o) => s + o.total, 0);
      const h = endD.getHours();
      const label = h === 0 ? '12am' : h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;
      return { label, value };
    });
  }

  if (range === '1W') {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toISOString().split('T')[0];
      const value = all
        .filter(o => new Date(o.orderDate).toISOString().split('T')[0] === dayStr)
        .reduce((s, o) => s + o.total, 0);
      return { label: d.toLocaleDateString('en', { weekday: 'short' }), value };
    });
  }

  if (range === '1M') {
    return Array.from({ length: 10 }, (_, i) => {
      const endD = new Date(now);
      endD.setDate(endD.getDate() - (9 - i) * 3);
      const startD = new Date(endD);
      startD.setDate(startD.getDate() - 2);
      const value = all
        .filter(o => { const d = new Date(o.orderDate); return d >= startD && d <= endD; })
        .reduce((s, o) => s + o.total, 0);
      return { label: endD.toLocaleDateString('en', { month: 'short', day: 'numeric' }), value };
    });
  }

  if (range === '3M') {
    return Array.from({ length: 13 }, (_, i) => {
      const endD = new Date(now);
      endD.setDate(endD.getDate() - (12 - i) * 7);
      const startD = new Date(endD);
      startD.setDate(startD.getDate() - 6);
      const value = all
        .filter(o => { const d = new Date(o.orderDate); return d >= startD && d <= endD; })
        .reduce((s, o) => s + o.total, 0);
      return { label: endD.toLocaleDateString('en', { month: 'short', day: 'numeric' }), value };
    });
  }

  // 6M — 12 × 2-week buckets
  return Array.from({ length: 12 }, (_, i) => {
    const endD = new Date(now);
    endD.setDate(endD.getDate() - (11 - i) * 14);
    const startD = new Date(endD);
    startD.setDate(startD.getDate() - 13);
    const value = all
      .filter(o => { const d = new Date(o.orderDate); return d >= startD && d <= endD; })
      .reduce((s, o) => s + o.total, 0);
    return { label: endD.toLocaleDateString('en', { month: 'short', day: 'numeric' }), value };
  });
}

function AnimatedBar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const width = useRef(new Animated.Value(0)).current;
  const pct = max > 0 ? Math.max(value / max, 0.02) : 0;

  useEffect(() => {
    Animated.timing(width, {
      toValue: pct,
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [pct, delay, width]);

  return (
    <View style={barStyles.track}>
      <Animated.View
        style={[
          barStyles.fill,
          {
            backgroundColor: color,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

const barStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 7,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden' as const,
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});

function RevenueTrendChart({
  data,
  isEmpty,
}: {
  data: TrendPoint[];
  isEmpty: boolean;
}) {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      delay: 80,
      useNativeDriver: true,
    }).start();
  }, [data, fadeAnim]);

  const CHART_H = 160;
  const PAD_TOP = 12;
  const PAD_BOTTOM = 30;
  const PAD_LEFT = 48;
  const PAD_RIGHT = 12;
  const innerW = Math.max(containerWidth - PAD_LEFT - PAD_RIGHT, 10);
  const innerH = CHART_H - PAD_TOP - PAD_BOTTOM;

  const maxVal = Math.max(...data.map(d => d.value), 1);
  const hasData = !isEmpty && data.some(d => d.value > 0);

  const points = data.map((d, i) => ({
    x: PAD_LEFT + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: PAD_TOP + (1 - d.value / maxVal) * innerH,
  }));

  const bottomY = PAD_TOP + innerH;
  const linePath = getSmoothPath(points);
  const areaPath = buildAreaPath(points, bottomY);

  const yLabels = [0, 0.5, 1].map(pct => ({
    text: formatAxisVal(pct * maxVal),
    y: PAD_TOP + (1 - pct) * innerH,
  }));

  const maxXLabels = 5;
  const xStep = Math.max(1, Math.ceil(data.length / maxXLabels));
  const xLabelData = data
    .map((d, i) => ({ label: d.label, x: points[i]?.x ?? 0 }))
    .filter((_, i) => i % xStep === 0 || i === data.length - 1);

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <View
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        style={trendChartStyles.svgWrap}
      >
        <Svg width={containerWidth} height={CHART_H}>
          <Defs>
            <LinearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF8C42" stopOpacity="0.22" />
              <Stop offset="1" stopColor="#FF8C42" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {yLabels.map((yl, i) => (
            <Line
              key={i}
              x1={PAD_LEFT}
              y1={yl.y}
              x2={PAD_LEFT + innerW}
              y2={yl.y}
              stroke="#F3F4F6"
              strokeWidth={1}
            />
          ))}

          {hasData && <Path d={areaPath} fill="url(#revGrad)" />}
          {hasData && (
            <Path
              d={linePath}
              fill="none"
              stroke="#FF8C42"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {yLabels.map((yl, i) => (
            <SvgText
              key={i}
              x={PAD_LEFT - 6}
              y={yl.y + 4}
              textAnchor="end"
              fontSize={10}
              fill="#C5C9D4"
            >
              {yl.text}
            </SvgText>
          ))}

          {xLabelData.map((xl, i) => (
            <SvgText
              key={i}
              x={xl.x}
              y={CHART_H - 5}
              textAnchor="middle"
              fontSize={10}
              fill="#C5C9D4"
            >
              {xl.label}
            </SvgText>
          ))}

          {hasData && points.length > 0 && (
            <Circle
              cx={points[points.length - 1].x}
              cy={points[points.length - 1].y}
              r={4}
              fill="#FF8C42"
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          )}
        </Svg>
      </View>
    </Animated.View>
  );
}

const trendChartStyles = StyleSheet.create({
  svgWrap: {
    marginHorizontal: -4,
    marginTop: 4,
  },
});

function ConversionFunnel({
  visits,
  ordersPlaced,
  conversionRate,
}: {
  /** Null when storefront visits are not tracked, which they are not yet. */
  visits: number | null;
  ordersPlaced: number;
  conversionRate: number | null;
}) {
  const visitBarAnim = useRef(new Animated.Value(0)).current;
  const orderBarAnim = useRef(new Animated.Value(0)).current;
  const convBarAnim = useRef(new Animated.Value(0)).current;

  const hasVisitData = visits !== null && conversionRate !== null;
  const safeVisits = visits ?? 0;
  const orderRatio = safeVisits > 0 ? ordersPlaced / safeVisits : 0;
  const convRatio = Math.min((conversionRate ?? 0) / 100, 1);
  const dropOff1 = safeVisits - ordersPlaced;
  const dropOff1Pct = safeVisits > 0 ? Math.round(((safeVisits - ordersPlaced) / safeVisits) * 100) : 0;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(visitBarAnim, { toValue: 1, duration: 700, delay: 0, useNativeDriver: false }),
      Animated.timing(orderBarAnim, { toValue: orderRatio, duration: 700, delay: 0, useNativeDriver: false }),
      Animated.timing(convBarAnim, { toValue: convRatio, duration: 700, delay: 0, useNativeDriver: false }),
    ]).start();
  }, [visits, ordersPlaced, conversionRate, orderRatio, convRatio, visitBarAnim, orderBarAnim, convBarAnim]);

  // Nothing records a storefront being opened without an order, so a funnel
  // drawn here would be arithmetic on a number nobody measured. Saying so is
  // more useful than a chart of zeros, and far more useful than the invented
  // figure this replaced.
  if (!hasVisitData) {
    return (
      <View style={[styles.storefrontCard, { padding: 16 }]}>
        <Text style={styles.storefrontLabel}>Storefront visits</Text>
        <Text style={{ fontSize: 13, color: '#6B7280', lineHeight: 19, marginTop: 6 }}>
          Visits are not tracked yet, so a conversion rate cannot be shown. You have{' '}
          {ordersPlaced} order{ordersPlaced === 1 ? '' : 's'} in this period.
        </Text>
      </View>
    );
  }

  const steps = [
    {
      step: 1,
      label: 'Storefront Visits',
      value: String(visits),
      anim: visitBarAnim,
      color: '#2563EB',
      bg: '#EFF6FF',
      IconComponent: Globe,
    },
    {
      step: 2,
      label: 'Orders Placed',
      value: String(ordersPlaced),
      anim: orderBarAnim,
      color: Colors.primary,
      bg: 'rgba(255,140,66,0.1)',
      IconComponent: ShoppingBag,
    },
    {
      step: 3,
      label: 'Conversion Rate',
      value: `${conversionRate}%`,
      anim: convBarAnim,
      color: '#16A34A',
      bg: '#F0FDF4',
      IconComponent: MousePointerClick,
    },
  ] as const;

  return (
    <View style={funnelStyles.card}>
      {steps.map((s, idx) => (
        <View key={s.step}>
          <View style={funnelStyles.stepRow}>
            <View style={[funnelStyles.stepIconWrap, { backgroundColor: s.bg }]}>
              <s.IconComponent size={15} color={s.color} strokeWidth={2} />
            </View>
            <View style={funnelStyles.stepMeta}>
              <View style={funnelStyles.stepLabelRow}>
                <View style={[funnelStyles.stepBadge, { backgroundColor: s.bg }]}>
                  <Text style={[funnelStyles.stepNum, { color: s.color }]}>{s.step}</Text>
                </View>
                <Text style={funnelStyles.stepLabel}>{s.label}</Text>
                <Text style={[funnelStyles.stepValue, { color: s.color }]}>{s.value}</Text>
              </View>
              <View style={funnelStyles.barTrack}>
                <Animated.View
                  style={[
                    funnelStyles.barFill,
                    {
                      backgroundColor: s.color,
                      width: s.anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    },
                  ]}
                />
              </View>
            </View>
          </View>

          {idx < steps.length - 1 && (
            <View style={funnelStyles.dropRow}>
              <View style={funnelStyles.dropLine} />
              <View style={funnelStyles.dropArrow}>
                <ChevronDown size={12} color="#9CA3AF" strokeWidth={2.5} />
              </View>
              {idx === 0 && dropOff1 > 0 && (
                <View style={funnelStyles.dropBadge}>
                  <Users size={10} color="#EF4444" strokeWidth={2.5} />
                  <Text style={funnelStyles.dropText}>
                    {dropOff1.toLocaleString()} left ({dropOff1Pct}% drop-off)
                  </Text>
                </View>
              )}
              {idx === 1 && (
                <View style={[funnelStyles.dropBadge, { backgroundColor: '#F0FDF4' }]}>
                  <ArrowUpRight size={10} color="#16A34A" strokeWidth={2.5} />
                  <Text style={[funnelStyles.dropText, { color: '#16A34A' }]}>
                    {conversionRate}% converted
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const funnelStyles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  stepRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  stepMeta: {
    flex: 1,
  },
  stepLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    marginBottom: 7,
  },
  stepBadge: {
    width: 18,
    height: 18,
    borderRadius: 6,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepNum: {
    fontSize: 10,
    fontWeight: '800' as const,
  },
  stepLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
  },
  stepValue: {
    fontSize: 16,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  barTrack: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  barFill: {
    height: '100%' as const,
    borderRadius: 3,
  },
  dropRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingLeft: 16,
    marginVertical: 8,
    gap: 6,
  },
  dropLine: {
    width: 1,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 2,
  },
  dropArrow: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  dropBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dropText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#EF4444',
    letterSpacing: -0.1,
  },
});

function PrimaryMetricCard({ label, value, sub, iconBg, IconComponent, iconColor }: {
  label: string;
  value: string;
  sub?: string;
  iconBg: string;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
  iconColor: string;
}) {
  return (
    <View style={metricStyles.primaryCard}>
      <View style={[metricStyles.primaryIconWrap, { backgroundColor: iconBg }]}>
        <IconComponent size={20} color={iconColor} strokeWidth={2} />
      </View>
      <Text style={metricStyles.primaryLabel}>{label}</Text>
      <Text style={metricStyles.primaryValue}>{value}</Text>
      {sub && <Text style={metricStyles.primarySub}>{sub}</Text>}
    </View>
  );
}

const metricStyles = StyleSheet.create({
  primaryCard: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 18,
    minHeight: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  primaryLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  primaryValue: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  primarySub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },
  secondaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    minHeight: 114,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  secondaryIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  secondaryLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#9CA3AF',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  secondaryValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#2B2B2B',
    letterSpacing: -0.4,
  },
  secondarySub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={sectionHeaderStyles.wrap}>
      <Text style={sectionHeaderStyles.title}>{title}</Text>
      {subtitle && <Text style={sectionHeaderStyles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const sectionHeaderStyles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
});

type InsightType = 'positive' | 'warning' | 'info';

type InsightPriority = 'critical' | 'warning' | 'opportunity';

const _PRIORITY_ORDER: Record<InsightPriority, number> = {
  critical: 0,
  warning: 1,
  opportunity: 2,
};

const PRIORITY_THEME: Record<InsightPriority, { badge: string; badgeBg: string; label: string }> = {
  critical: { badge: '#DC2626', badgeBg: 'rgba(220,38,38,0.1)', label: 'Critical' },
  warning: { badge: '#CA8A04', badgeBg: 'rgba(202,138,4,0.1)', label: 'Warning' },
  opportunity: { badge: '#2563EB', badgeBg: 'rgba(37,99,235,0.1)', label: 'Opportunity' },
};

type ActionType =
  | 'NAVIGATE_VERIFICATION'
  | 'NAVIGATE_CATALOG'
  | 'NAVIGATE_STORE_SETTINGS'
  | 'NAVIGATE_PROMOTIONS'
  | 'NAVIGATE_ORDERS';

interface AIInsight {
  id: string;
  title: string;
  explanation: string;
  action?: string;
  actionLabel?: string;
  actionType?: ActionType;
  type: InsightType;
  priority: InsightPriority;
  impact: number;
  urgency: number;
  confidence: number;
  score: number;
  insightType?: string;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

interface SmartInsight {
  id: string;
  message: string;
  type: InsightType;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
}

const INSIGHT_THEME: Record<InsightType, { bg: string; iconBg: string; iconColor: string; border: string }> = {
  positive: { bg: '#F0FDF4', iconBg: '#DCFCE7', iconColor: '#16A34A', border: '#BBF7D0' },
  warning:  { bg: '#FFFBEB', iconBg: '#FEF9C3', iconColor: '#CA8A04', border: '#FDE68A' },
  info:     { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', border: '#BFDBFE' },
};

function generateSmartInsights(params: {
  conversionRate: number;
  repeatRate: number;
  topSource: { name: string; orders: number } | null;
  totalOrders: number;
  hasData: boolean;
}): SmartInsight[] {
  const { conversionRate, repeatRate, topSource, totalOrders, hasData } = params;
  if (!hasData) return [];

  const insights: SmartInsight[] = [];

  if (conversionRate >= 5) {
    insights.push({
      id: 'conv-strong',
      message: `Your conversion rate is strong at ${conversionRate}% — visitors are actively buying`,
      type: 'positive',
      IconComponent: TrendingUp,
    });
  } else if (conversionRate > 0) {
    insights.push({
      id: 'conv-low',
      message: `Your conversion rate is ${conversionRate}% — improve storefront photos and descriptions to convert more visitors`,
      type: 'warning',
      IconComponent: AlertTriangle,
    });
  }

  if (topSource && topSource.orders > 0) {
    insights.push({
      id: 'top-source',
      message: `Most customers come from ${topSource.name} with ${topSource.orders} order${topSource.orders !== 1 ? 's' : ''} this period`,
      type: 'info',
      IconComponent: Store,
    });
  }

  if (totalOrders > 2 && repeatRate < 20) {
    insights.push({
      id: 'repeat-low',
      message: `You have low repeat customers at ${repeatRate}% — consider running promotions to boost loyalty`,
      type: 'warning',
      IconComponent: Users,
    });
  } else if (repeatRate >= 30) {
    insights.push({
      id: 'repeat-high',
      message: `${repeatRate}% of your customers are returning — your customer loyalty is excellent`,
      type: 'positive',
      IconComponent: Star,
    });
  }

  return insights.slice(0, 3);
}

const AI_INSIGHT_THEME: Record<InsightType, { bg: string; iconBg: string; iconColor: string; accent: string }> = {
  positive: { bg: '#FFFFFF', iconBg: '#DCFCE7', iconColor: '#16A34A', accent: '#16A34A' },
  warning:  { bg: '#FFFFFF', iconBg: '#FEF9C3', iconColor: '#CA8A04', accent: '#CA8A04' },
  info:     { bg: '#FFFFFF', iconBg: '#DBEAFE', iconColor: '#2563EB', accent: '#2563EB' },
};

const AI_PRIMARY_THEME: Record<InsightPriority, { bg: string; border: string; accent: string; iconBg: string; iconColor: string }> = {
  critical: { bg: '#FEF2F2', border: '#FECACA', accent: '#DC2626', iconBg: '#FEE2E2', iconColor: '#DC2626' },
  warning:  { bg: '#FFFBEB', border: '#FDE68A', accent: '#CA8A04', iconBg: '#FEF9C3', iconColor: '#CA8A04' },
  opportunity: { bg: '#EFF6FF', border: '#BFDBFE', accent: '#2563EB', iconBg: '#DBEAFE', iconColor: '#2563EB' },
};

const ACTION_ROUTE_MAP: Record<ActionType, string> = {
  NAVIGATE_VERIFICATION: '/vendor/settings/verification',
  NAVIGATE_CATALOG: '/vendor/catalog',
  NAVIGATE_STORE_SETTINGS: '/vendor/catalog',
  NAVIGATE_PROMOTIONS: '/vendor/settings/promotions',
  NAVIGATE_ORDERS: '/vendor/orders',
};

function resolveInsightAction(router: ReturnType<typeof useRouter>, actionType: ActionType) {
  const route = ACTION_ROUTE_MAP[actionType];
  if (route) {
    router.push(route as any);
  }
}

function computeScore(impact: number, urgency: number, confidence: number): number {
  return impact * urgency * confidence;
}

function derivePriority(score: number): InsightPriority {
  if (score >= 100) return 'critical';
  if (score >= 50) return 'warning';
  return 'opportunity';
}

function deriveInsightType(priority: InsightPriority): InsightType {
  if (priority === 'critical') return 'warning';
  if (priority === 'warning') return 'warning';
  return 'info';
}

function buildScoredInsight(
  base: Omit<AIInsight, 'score' | 'priority' | 'type'> & { impact: number; urgency: number; confidence: number; insightType?: string; overrideType?: InsightType },
): AIInsight {
  const score = computeScore(base.impact, base.urgency, base.confidence);
  const priority = derivePriority(score);
  const type = base.overrideType ?? deriveInsightType(priority);
  const { overrideType: _ot, ...rest } = base;
  return { ...rest, score, priority, type };
}

function generateAIInsights(params: {
  conversionRate: number;
  repeatRate: number;
  topSource: { name: string; orders: number } | null;
  totalOrders: number;
  totalRevenue: number;
  the platformOrders: number;
  externalOrders: number;
  hasData: boolean;
}): AIInsight[] {
  const { conversionRate, repeatRate, topSource, totalOrders, totalRevenue, the platformOrders, externalOrders, hasData } = params;
  if (!hasData) return [];

  const insights: AIInsight[] = [];

  if (totalRevenue > 0 && totalOrders > 3) {
    insights.push(buildScoredInsight({
      id: 'rev-growing',
      title: 'Revenue is growing',
      explanation: `You have earned revenue across ${totalOrders} order${totalOrders !== 1 ? 's' : ''} this period. Keep up the momentum.`,
      action: 'Review your top-selling items and keep them well-stocked.',
      actionLabel: 'View orders',
      actionType: 'NAVIGATE_ORDERS',
      overrideType: 'positive',
      impact: 3,
      urgency: 2,
      confidence: 4,
      insightType: 'revenue',
      IconComponent: TrendingUp,
    }));
  }

  if (conversionRate < 5 && conversionRate > 0) {
    insights.push(buildScoredInsight({
      id: 'low-conv',
      title: 'Low conversion rate',
      explanation: `Your storefront gets visits but only ${conversionRate}% of visitors place an order.`,
      action: 'Improve your item photos, descriptions, and pricing to convert more visitors.',
      actionLabel: 'Edit storefront',
      actionType: 'NAVIGATE_CATALOG',
      impact: 5,
      urgency: 5,
      confidence: 4,
      insightType: 'conversion',
      IconComponent: AlertTriangle,
    }));
  } else if (conversionRate >= 5) {
    insights.push(buildScoredInsight({
      id: 'strong-conv',
      title: 'Strong conversion rate',
      explanation: `${conversionRate}% of storefront visitors are placing orders — that's above average.`,
      action: 'Drive more traffic by sharing your storefront link on social media.',
      actionLabel: 'Edit storefront',
      actionType: 'NAVIGATE_CATALOG',
      overrideType: 'positive',
      impact: 2,
      urgency: 2,
      confidence: 4,
      insightType: 'conversion',
      IconComponent: MousePointerClick,
    }));
  }

  if (repeatRate < 15 && totalOrders > 2) {
    insights.push(buildScoredInsight({
      id: 'low-repeat',
      title: 'Low repeat customer rate',
      explanation: `Only ${repeatRate}% of your customers have returned to order again.`,
      action: 'Consider a loyalty discount or promo for returning customers.',
      actionLabel: 'Create promotion',
      actionType: 'NAVIGATE_PROMOTIONS',
      impact: 4,
      urgency: 4,
      confidence: 4,
      insightType: 'retention',
      IconComponent: Users,
    }));
  } else if (repeatRate >= 30) {
    insights.push(buildScoredInsight({
      id: 'high-repeat',
      title: 'Excellent customer loyalty',
      explanation: `${repeatRate}% of your customers are returning — your retention is strong.`,
      action: 'Reward your loyal customers with an exclusive offer.',
      actionLabel: 'Create promotion',
      actionType: 'NAVIGATE_PROMOTIONS',
      overrideType: 'positive',
      impact: 2,
      urgency: 1,
      confidence: 5,
      insightType: 'retention',
      IconComponent: Star,
    }));
  }

  const the platformShare = totalOrders > 0 ? Math.round((the platformOrders / totalOrders) * 100) : 0;
  if (the platformShare >= 80 && externalOrders === 0) {
    insights.push(buildScoredInsight({
      id: 'ext-growth',
      title: 'External growth opportunity',
      explanation: `All your orders come from the platform Marketplace. You're missing potential direct customers.`,
      action: 'Share your storefront link on WhatsApp, Instagram, or TikTok to attract direct orders.',
      actionLabel: 'View catalog',
      actionType: 'NAVIGATE_CATALOG',
      impact: 4,
      urgency: 3,
      confidence: 4,
      insightType: 'growth',
      IconComponent: Globe,
    }));
  } else if (topSource) {
    insights.push(buildScoredInsight({
      id: 'top-source',
      title: `${topSource.name} is your top channel`,
      explanation: `Most of your orders (${topSource.orders}) came from ${topSource.name} this period.`,
      action: 'Double down on this channel. It\'s working for you.',
      actionLabel: 'View orders',
      actionType: 'NAVIGATE_ORDERS',
      overrideType: 'info',
      impact: 2,
      urgency: 2,
      confidence: 5,
      insightType: 'channel',
      IconComponent: Store,
    }));
  }

  insights.sort((a, b) => b.score - a.score);
  return insights;
}

type VerificationStatusType = 'not_started' | 'pending_review' | 'approved' | 'rejected' | 'retry_required';

function the platformAIInsightsSection({
  insights,
  plan,
  hasData,
  onUpgrade,
  isVerified,
  verificationStatus,
  onVerify: _onVerify,
  onInsightAction,
}: {
  insights: AIInsight[];
  plan: string;
  hasData: boolean;
  onUpgrade: () => void;
  isVerified: boolean;
  verificationStatus: VerificationStatusType;
  onVerify: () => void;
  onInsightAction: (actionType: ActionType) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);
  const collapseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 100,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  useEffect(() => {
    Animated.timing(collapseAnim, {
      toValue: isCollapsed ? 0 : 1,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isCollapsed, collapseAnim]);

  const isLocked = plan === 'basic';

  const allInsights = useMemo(() => {
    const combined: AIInsight[] = [];
    if (verificationStatus === 'not_started') {
      combined.push({
        id: 'not-verified',
        title: "You're not visible to new customers",
        explanation: 'Complete verification to appear in Home, Explore, and Search and reach more customers.',
        action: 'Verify now',
        actionLabel: 'Verify now',
        actionType: 'NAVIGATE_VERIFICATION',
        type: 'warning',
        priority: 'critical',
        impact: 5,
        urgency: 5,
        confidence: 5,
        score: 125,
        insightType: 'verification',
        IconComponent: Lock,
      });
    } else if (verificationStatus === 'rejected' || verificationStatus === 'retry_required') {
      combined.push({
        id: 'verification-rejected',
        title: 'Verification failed',
        explanation: 'Your verification was not approved. Please fix the issues and resubmit to become visible to customers.',
        action: 'Fix & resubmit',
        actionLabel: 'Fix & resubmit',
        actionType: 'NAVIGATE_VERIFICATION',
        type: 'warning',
        priority: 'critical',
        impact: 5,
        urgency: 5,
        confidence: 5,
        score: 125,
        insightType: 'verification',
        IconComponent: AlertTriangle,
      });
    }
    // 1 / 3 / 10 / 25 by plan, which is what the backend enforces. This read
    // standard→1, pro→2, pro+→3, so Pro and Pro+ vendors were shown a fraction
    // of the insights they pay for. Flagged as item 4 in the gating audit.
    const planLimit = isLocked
      ? 0
      : plan === 'standard' ? 1
        : plan === 'pro' ? 10
          : plan === 'pro+' ? 25
            : 0;
    combined.push(...insights.slice(0, planLimit));
    combined.sort((a, b) => b.score - a.score);
    return combined;
  }, [verificationStatus, isLocked, plan, insights]);

  const DEFAULT_VISIBLE = 2;
  const displayInsights = showAll ? allInsights : allInsights.slice(0, DEFAULT_VISIBLE);
  const hasMore = allInsights.length > DEFAULT_VISIBLE;

  const mockInsights: AIInsight[] = [
    {
      id: 'mock1',
      title: 'Low conversion rate',
      explanation: 'Your storefront gets visits but only 2% of visitors place an order.',
      action: 'Improve your item photos, descriptions, and pricing.',
      type: 'warning',
      priority: 'critical',
      impact: 5,
      urgency: 5,
      confidence: 4,
      score: 100,
      insightType: 'conversion',
      IconComponent: AlertTriangle,
    },
    {
      id: 'mock2',
      title: 'Low repeat customer rate',
      explanation: 'Only 10% of your customers returned. Consider a promo for returning customers.',
      action: 'Add a loyalty discount for repeat orders.',
      type: 'warning',
      priority: 'warning',
      impact: 4,
      urgency: 4,
      confidence: 4,
      score: 64,
      insightType: 'retention',
      IconComponent: Users,
    },
    {
      id: 'mock3',
      title: 'External growth opportunity',
      explanation: 'Most of your orders come from the platform Marketplace. Share your storefront link to attract direct customers.',
      action: 'Share your link on WhatsApp and Instagram.',
      type: 'info',
      priority: 'opportunity',
      impact: 2,
      urgency: 2,
      confidence: 4,
      score: 16,
      insightType: 'growth',
      IconComponent: Globe,
    },
  ];

  return (
    <View style={aiStyles.section}>
      <TouchableOpacity
        style={aiStyles.headerRow}
        onPress={() => setIsCollapsed(prev => !prev)}
        activeOpacity={0.7}
      >
        <View style={aiStyles.headerBadge}>
          <Zap size={12} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={aiStyles.headerBadgeText}>AI</Text>
        </View>
        <View style={aiStyles.headerTextWrap}>
          <Text style={aiStyles.headerTitle}>the platform AI Insights</Text>
          <Text style={aiStyles.headerSubtitle}>Smart recommendations to help grow your business</Text>
        </View>
        <View style={aiStyles.collapseBtn}>
          {isCollapsed ? (
            <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
          ) : (
            <ChevronUp size={18} color="#9CA3AF" strokeWidth={2} />
          )}
        </View>
      </TouchableOpacity>

      {!isCollapsed && (
        <>
          {isLocked ? (
            <LockedSection onUpgrade={onUpgrade}>
              <View style={aiStyles.cardStack}>
                {mockInsights.map((insight, idx) => (
                  <AIInsightCard key={insight.id} insight={insight} isLast={idx === mockInsights.length - 1} isPrimary={false} onInsightAction={onInsightAction} />
                ))}
              </View>
            </LockedSection>
          ) : !hasData && isVerified ? (
            <View style={aiStyles.emptyCard}>
              <View style={aiStyles.emptyIconWrap}>
                <Zap size={26} color="#D1D5DB" strokeWidth={1.5} />
              </View>
              <Text style={aiStyles.emptyTitle}>Not enough data yet</Text>
              <Text style={aiStyles.emptyBody}>
                As customers visit your storefront and place orders, the platform AI will start showing growth recommendations.
              </Text>
            </View>
          ) : (
            <Animated.View style={{ opacity: fadeAnim }}>
              <View style={aiStyles.cardStack}>
                {displayInsights.map((insight, idx) => (
                  <AIInsightCard
                    key={insight.id}
                    insight={insight}
                    isLast={idx === displayInsights.length - 1}
                    isPrimary={idx === 0}
                    onInsightAction={onInsightAction}
                  />
                ))}
              </View>
              {hasMore && !showAll && (
                <TouchableOpacity
                  style={aiStyles.viewAllBtn}
                  onPress={() => setShowAll(true)}
                  activeOpacity={0.7}
                >
                  <Text style={aiStyles.viewAllBtnText}>
                    View all insights ({allInsights.length - DEFAULT_VISIBLE} more)
                  </Text>
                  <ChevronDown size={14} color={Colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
              {showAll && hasMore && (
                <TouchableOpacity
                  style={aiStyles.viewAllBtn}
                  onPress={() => setShowAll(false)}
                  activeOpacity={0.7}
                >
                  <Text style={aiStyles.viewAllBtnText}>Show less</Text>
                  <ChevronUp size={14} color={Colors.primary} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
              {plan === 'standard' && insights.length > 1 && (
                <TouchableOpacity style={aiStyles.upgradeTeaser} onPress={onUpgrade} activeOpacity={0.8}>
                  <Lock size={12} color={Colors.primary} strokeWidth={2.5} />
                  <Text style={aiStyles.upgradeTeaserText}>
                    {insights.length - 1} more insight{insights.length - 1 !== 1 ? 's' : ''} available on Pro
                  </Text>
                  <Text style={aiStyles.upgradeTeaserCta}>Upgrade →</Text>
                </TouchableOpacity>
              )}
              {plan === 'pro' && insights.length > 2 && (
                <TouchableOpacity style={aiStyles.upgradeTeaser} onPress={onUpgrade} activeOpacity={0.8}>
                  <Lock size={12} color={Colors.primary} strokeWidth={2.5} />
                  <Text style={aiStyles.upgradeTeaserText}>Full AI insights available on Pro+</Text>
                  <Text style={aiStyles.upgradeTeaserCta}>Upgrade →</Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
        </>
      )}
    </View>
  );
}

function AIInsightCard({ insight, isLast, isPrimary, onInsightAction }: { insight: AIInsight; isLast: boolean; isPrimary: boolean; onInsightAction?: (actionType: ActionType) => void }) {
  const theme = AI_INSIGHT_THEME[insight.type];
  const primaryTheme = AI_PRIMARY_THEME[insight.priority];
  const priorityMeta = PRIORITY_THEME[insight.priority];
  const hasActionBtn = !!insight.actionType && !!insight.actionLabel;
  const scoreLabel = insight.score >= 100 ? 'Critical' : insight.score >= 50 ? 'Warning' : 'Opportunity';

  if (isPrimary) {
    return (
      <View style={[aiStyles.primaryCard, { backgroundColor: primaryTheme.bg, borderColor: primaryTheme.border }, !isLast && aiStyles.cardGap]}>
        <View style={[aiStyles.primaryAccent, { backgroundColor: primaryTheme.accent }]} />
        <View style={aiStyles.primaryContent}>
          <View style={aiStyles.primaryTopRow}>
            <View style={[aiStyles.primaryIconWrap, { backgroundColor: primaryTheme.iconBg }]}>
              <insight.IconComponent size={18} color={primaryTheme.iconColor} strokeWidth={2.5} />
            </View>
            <View style={[aiStyles.priorityBadge, { backgroundColor: priorityMeta.badgeBg }]}>
              <Text style={[aiStyles.priorityBadgeText, { color: priorityMeta.badge }]}>{scoreLabel}</Text>
            </View>
          </View>
          <Text style={aiStyles.primaryTitle}>{insight.title}</Text>
          <Text style={aiStyles.primaryExplanation}>{insight.explanation}</Text>
          {hasActionBtn && onInsightAction ? (
            <TouchableOpacity
              style={[aiStyles.primaryActionBtn, { backgroundColor: primaryTheme.accent }]}
              onPress={() => onInsightAction(insight.actionType!)}
              activeOpacity={0.8}
            >
              <Text style={aiStyles.primaryActionBtnText}>{insight.actionLabel}</Text>
            </TouchableOpacity>
          ) : insight.action ? (
            <View style={aiStyles.cardActionWrap}>
              <Text style={aiStyles.cardActionDot}>›</Text>
              <Text style={aiStyles.cardAction}>{insight.action}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View style={[aiStyles.card, !isLast && aiStyles.cardGap]}>
      <View style={[aiStyles.cardAccent, { backgroundColor: theme.accent }]} />
      <View style={aiStyles.cardContent}>
        <View style={aiStyles.cardHeader}>
          <View style={[aiStyles.cardIconWrap, { backgroundColor: theme.iconBg }]}>
            <insight.IconComponent size={14} color={theme.iconColor} strokeWidth={2.5} />
          </View>
          <Text style={aiStyles.cardTitle}>{insight.title}</Text>
          <View style={aiStyles.scoreBadgeRow}>
            <View style={[aiStyles.priorityDot, { backgroundColor: priorityMeta.badge }]} />
            <Text style={aiStyles.scoreBadgeText}>{insight.score}</Text>
          </View>
        </View>
        <Text style={aiStyles.cardExplanation}>{insight.explanation}</Text>
        {hasActionBtn && onInsightAction ? (
          <TouchableOpacity
            style={aiStyles.cardActionBtn}
            onPress={() => onInsightAction(insight.actionType!)}
            activeOpacity={0.8}
          >
            <Text style={aiStyles.cardActionBtnText}>{insight.actionLabel}</Text>
          </TouchableOpacity>
        ) : insight.action ? (
          <View style={aiStyles.cardActionWrap}>
            <Text style={aiStyles.cardActionDot}>›</Text>
            <Text style={aiStyles.cardAction}>{insight.action}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const aiStyles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 14,
  },
  collapseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
    backgroundColor: '#1A1A2E',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 2,
  },
  headerBadgeText: {
    fontSize: 10,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '400' as const,
  },
  cardStack: {
    gap: 0,
  },
  card: {
    flexDirection: 'row' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardGap: {
    marginBottom: 10,
  },
  cardAccent: {
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  cardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  cardExplanation: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 19,
    fontWeight: '400' as const,
    marginBottom: 8,
  },
  cardActionWrap: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cardActionDot: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '700' as const,
    lineHeight: 18,
  },
  cardAction: {
    flex: 1,
    fontSize: 12,
    color: '#374151',
    fontWeight: '500' as const,
    lineHeight: 17,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.2,
    textAlign: 'center' as const,
  },
  emptyBody: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 19,
    fontWeight: '400' as const,
  },
  upgradeTeaser: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255,140,66,0.07)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  upgradeTeaserText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  upgradeTeaserCta: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  cardActionBtn: {
    alignSelf: 'flex-start' as const,
    backgroundColor: '#1A1A2E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  cardActionBtnText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  primaryCard: {
    flexDirection: 'row' as const,
    borderRadius: 18,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
  },
  primaryAccent: {
    width: 5,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  primaryContent: {
    flex: 1,
    padding: 18,
  },
  primaryTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  primaryIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  primaryExplanation: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 21,
    fontWeight: '400' as const,
    marginBottom: 14,
  },
  primaryActionBtn: {
    alignSelf: 'flex-start' as const,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  priorityBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
    textTransform: 'uppercase' as const,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  viewAllBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,140,66,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.12)',
  },
  viewAllBtnText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  scoreBadgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  scoreBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#9CA3AF',
    letterSpacing: 0.2,
  },
});

function SmartInsightsSection({
  insights,
  isPro,
  onUpgrade,
}: {
  insights: SmartInsight[];
  isPro: boolean;
  onUpgrade: () => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      delay: 120,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const mockInsights: SmartInsight[] = [
    { id: 'm1', message: 'Your conversion rate is strong at 6%, visitors are actively buying', type: 'positive', IconComponent: TrendingUp },
    { id: 'm2', message: 'Most customers come from the platform Marketplace with 5 orders this period', type: 'info', IconComponent: Store },
    { id: 'm3', message: 'You have low repeat customers at 15%, consider running promotions to boost loyalty', type: 'warning', IconComponent: Users },
  ];

  return (
    <View style={smartStyles.section}>
      <View style={smartStyles.headerRow}>
        <View style={smartStyles.headerLeft}>
          <View style={smartStyles.headerIconWrap}>
            <Lightbulb size={14} color="#FF8C42" strokeWidth={2.5} />
          </View>
          <Text style={smartStyles.headerTitle}>Insights</Text>
        </View>
      </View>

      {isPro ? (
        <Animated.View style={{ opacity: fadeAnim }}>
          {insights.length > 0 ? (
            insights.map((insight, idx) => {
              const theme = INSIGHT_THEME[insight.type];
              return (
                <View
                  key={insight.id}
                  style={[
                    smartStyles.insightCard,
                    { backgroundColor: theme.bg, borderColor: theme.border },
                    idx < insights.length - 1 && smartStyles.insightCardGap,
                  ]}
                >
                  <View style={[smartStyles.insightIconWrap, { backgroundColor: theme.iconBg }]}>
                    <insight.IconComponent size={15} color={theme.iconColor} strokeWidth={2.5} />
                  </View>
                  <Text style={smartStyles.insightText}>{insight.message}</Text>
                </View>
              );
            })
          ) : (
            <View style={smartStyles.noDataCard}>
              <Lightbulb size={22} color="#D1D5DB" strokeWidth={1.5} />
              <Text style={smartStyles.noDataText}>Insights will appear once you have more order data</Text>
            </View>
          )}
        </Animated.View>
      ) : (
        <LockedSection onUpgrade={onUpgrade}>
          {mockInsights.map((insight, idx) => {
            const theme = INSIGHT_THEME[insight.type];
            return (
              <View
                key={insight.id}
                style={[
                  smartStyles.insightCard,
                  { backgroundColor: theme.bg, borderColor: theme.border },
                  idx < mockInsights.length - 1 && smartStyles.insightCardGap,
                ]}
              >
                <View style={[smartStyles.insightIconWrap, { backgroundColor: theme.iconBg }]}>
                  <insight.IconComponent size={15} color={theme.iconColor} strokeWidth={2.5} />
                </View>
                <Text style={smartStyles.insightText}>{insight.message}</Text>
              </View>
            );
          })}
        </LockedSection>
      )}
    </View>
  );
}

const smartStyles = StyleSheet.create({
  section: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  headerIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(255,140,66,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  insightCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  insightCardGap: {
    marginBottom: 8,
  },
  insightIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 1,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 19,
    fontWeight: '500' as const,
  },
  noDataCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  noDataText: {
    flex: 1,
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
});

function SectionEmptyState({ onDashboard }: { onDashboard: () => void }) {
  return (
    <View style={emptyStyles.container}>
      <View style={emptyStyles.iconWrap}>
        <LineChart size={36} color="#D1D5DB" strokeWidth={1.5} />
      </View>
      <Text style={emptyStyles.title}>No data yet</Text>
      <Text style={emptyStyles.body}>
        Start sharing your storefront link and receiving orders to see insights here.
      </Text>
      <TouchableOpacity style={emptyStyles.btn} onPress={onDashboard} activeOpacity={0.8}>
        <Text style={emptyStyles.btnText}>Go to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 40,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#F9FAFB',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  title: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 8,
    letterSpacing: -0.3,
    textAlign: 'center' as const,
  },
  body: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 24,
    fontWeight: '400' as const,
  },
  btn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
});

function LockedSection({ children, onUpgrade }: { children: React.ReactNode; onUpgrade: () => void }) {
  return (
    <View style={lockedStyles.wrapper}>
      <View style={lockedStyles.contentBlurred} pointerEvents="none">
        {children}
      </View>
      <View style={lockedStyles.backdrop} pointerEvents="none" />
      <View style={lockedStyles.overlay}>
        <View style={lockedStyles.lockCard}>
          <View style={lockedStyles.lockIconWrap}>
            <Lock size={20} color={Colors.primary} strokeWidth={2} />
          </View>
          <Text style={lockedStyles.lockTitle}>Upgrade to unlock this feature</Text>
          <TouchableOpacity
            style={lockedStyles.upgradeBtn}
            onPress={onUpgrade}
            activeOpacity={0.85}
          >
            <Zap size={13} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={lockedStyles.upgradeBtnText}>Upgrade Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const lockedStyles = StyleSheet.create({
  wrapper: {
    position: 'relative' as const,
    minHeight: 160,
  },
  contentBlurred: {
    opacity: 0.22,
  },
  backdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(248,249,250,0.55)',
    borderRadius: 16,
  },
  overlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 16,
  },
  lockCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#EFEFEF',
    width: '100%',
  },
  lockIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,140,66,0.1)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.15)',
  },
  lockTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    textAlign: 'center' as const,
    marginBottom: 16,
    letterSpacing: -0.1,
    lineHeight: 20,
  },
  upgradeBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 11,
  },
  upgradeBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  verifyWarningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  verifyWarningLeft: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    flex: 1,
  },
  verifyWarningIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
  },
  verifyWarningText: {
    flex: 1,
  },
  verifyWarningTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 3,
  },
  verifyWarningBody: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  verifyWarningBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center' as const,
  },
  verifyWarningBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});

export default function GrowthInsightsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { plan, planLimits } = useVendorPlan();
  const { vendor } = useVendor();
  const { verificationData } = useVerification();
  const { externalOrders } = useExternalOrders();
  const { orders } = useOrders();

  const verificationStatus = verificationData.status;
  const isVerified = verificationStatus === 'approved';
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [showVisitsTooltip, setShowVisitsTooltip] = useState<boolean>(false);

  const isPro = plan === 'pro' || plan === 'pro+';
  const currency = (vendor.currency as Currency) || 'NGN';

  const handleUpgrade = () => {
    router.push('/vendor/settings/subscription' as any);
  };

  const handleGoToDashboard = () => {
    router.replace('/vendor/(tabs)' as any);
  };

  const the platformOrders = useMemo(
    () => orders.filter(o => o.orderSource !== 'external'),
    [orders]
  );

  const { invoices } = useInvoices();

  const filteredExternal = useMemo(
    () => filterByRange(externalOrders, timeRange),
    [externalOrders, timeRange]
  );

  const filteredthe platform = useMemo(() => {
    const threshold = getDateThreshold(timeRange);
    return the platformOrders.filter(o => new Date(o.orderDate) >= threshold);
  }, [the platformOrders, timeRange]); // threshold is always a Date for the new 5-range set

  const sourceMap = useMemo(() => {
    const map: Record<string, SourceData> = {};

    const the platformCfg = SOURCE_CONFIG['the platform Marketplace'];
    map['the platform Marketplace'] = {
      source: 'the platform Marketplace',
      orders: filteredthe platform.length,
      revenue: filteredthe platform.reduce((s, o) => s + o.total, 0),
      customers: new Set(filteredthe platform.map(o => formatInvoiceCustomerName(o.customerName ?? 'unknown', 'the platform'))),
      color: the platformCfg.color,
      IconComponent: the platformCfg.IconComponent,
    };

    ALL_EXTERNAL_SOURCES.forEach(src => {
      const cfg = SOURCE_CONFIG[src] ?? SOURCE_CONFIG['Other'];
      const srcOrders = filteredExternal.filter(o => o.externalReference === src);
      map[src] = {
        source: src,
        orders: srcOrders.length,
        revenue: srcOrders.reduce((s, o) => s + o.total, 0),
        customers: new Set(srcOrders.map(o => formatInvoiceCustomerName(o.customerName || 'Walk-in', o.orderSource === 'external' ? 'external' : 'the platform'))),
        color: cfg.color,
        IconComponent: cfg.IconComponent,
      };
    });

    return map;
  }, [filteredExternal, filteredthe platform]);

  const allSources = useMemo(() => {
    return Object.values(sourceMap).sort((a, b) => b.orders - a.orders);
  }, [sourceMap]);

  const maxOrders = useMemo(() => Math.max(...allSources.map(s => s.orders), 1), [allSources]);
  const platformMetrics = useMemo(() => {
    const the platformRevenue = filteredthe platform.reduce((s, o) => s + o.total, 0);
    const externalRevenue = filteredExternal.reduce((s, o) => s + o.total, 0);
    // Add standalone-invoice payment revenue for the selected period. Invoices
    // linked to an order are skipped so the same payment is not double-counted
    // (see BACKEND_INTEGRATION_GUIDE.md "Invoice payment double-counting").
    // Revenue is keyed off the payment date, so a payment recorded during the
    // selected range counts even if the invoice was issued earlier.
    const threshold = getDateThreshold(timeRange);
    const linkedOrderIds = new Set(orders.map((o) => o.id));
    const invoiceRevenue = getInvoiceRevenueForRange(invoices, threshold, new Date(), linkedOrderIds);
    return {
      the platformOrders: filteredthe platform.length,
      externalOrders: filteredExternal.length,
      the platformRevenue,
      externalRevenue,
      totalOrders: filteredthe platform.length + filteredExternal.length,
      totalRevenue: the platformRevenue + externalRevenue + invoiceRevenue,
    };
  }, [filteredthe platform, filteredExternal, timeRange, invoices, orders]);

  const hasAnyData = platformMetrics.totalOrders > 0;

  /**
   * Repeat-customer figures come from the backend when it has them.
   *
   * Computing this here counts only the orders the device happens to be
   * holding, so a vendor with more history than one page sees a repeat rate
   * that is wrong in a way nobody would notice. The server sees every order.
   *
   * getBusinessAnalytics has been deployed since Phase 5 and nothing called it.
   * That is also how this screen came to invent storefront visits: a client
   * with no visit data is always one step away from making one up.
   *
   * The local calculation stays as the fallback — for the demo logins, and for
   * the moment before the call returns, so the panel does not flash empty.
   */
  // Explicit rather than relying on the backend's implicit default for an
  // omitted filterRange — this screen's own local 1D/1W/1M/3M/6M tab
  // selector does not map cleanly onto the backend's today/week/month/year
  // range, so it intentionally does not drive this call; the vendor's own
  // plan-clamped range (server-authoritative either way) does.
  const { data: serverAnalytics } = useBusinessAnalytics(planLimits?.dashboardFilterRange);

  const customerMetrics = useMemo(() => {
    const server = serverAnalytics?.repeatCustomerAnalytics;
    if (server && !isPending(server)) {
      return {
        newCustomers: server.distinctCustomers - server.repeatCustomers,
        repeatCustomers: server.repeatCustomers,
        repeatRate: server.repeatRatePercent,
        total: server.distinctCustomers,
      };
    }

    const allCustomers = new Map<string, number>();
    [...filteredthe platform, ...filteredExternal].forEach(o => {
      const name = ('customerName' in o ? o.customerName : null) || 'Walk-in';
      const source = 'orderSource' in o && o.orderSource === 'external' ? 'external' : 'the platform';
      allCustomers.set(formatInvoiceCustomerName(name, source), (allCustomers.get(formatInvoiceCustomerName(name, source)) ?? 0) + 1);
    });
    const newCustomers = [...allCustomers.values()].filter(c => c === 1).length;
    const repeatCustomers = [...allCustomers.values()].filter(c => c > 1).length;
    const total = allCustomers.size;
    const repeatRate = total > 0 ? Math.round((repeatCustomers / total) * 100) : 0;
    return { newCustomers, repeatCustomers, repeatRate, total };
  }, [serverAnalytics, filteredthe platform, filteredExternal]);

  /**
   * Storefront visits are not tracked, so they are not reported.
   *
   * This used to compute them as `orders * 12 + 47` and derive a conversion
   * rate from that. A vendor with 4 orders was shown 95 visits and a 4%
   * conversion rate, all of it arithmetic on a number nobody measured, and a
   * conversion rate is exactly the sort of figure somebody changes their prices
   * or photos over.
   *
   * Nothing records a storefront being opened without an order, so the honest
   * answer is that this is unavailable rather than a number. The backend says
   * the same thing: getBusinessAnalytics returns conversionFunnel and
   * storefrontPerformance as dataPending for this reason.
   *
   * Orders placed is real and stays.
   */
  const storefrontMetrics = useMemo(() => ({
    visits: null,
    ordersPlaced: filteredthe platform.length,
    conversionRate: null,
  }), [filteredthe platform]);

  const topSource = useMemo(() => {
    const sorted = allSources.filter(s => s.orders > 0).sort((a, b) => b.orders - a.orders);
    if (sorted.length === 0) return null;
    return { name: sorted[0].source, orders: sorted[0].orders };
  }, [allSources]);

  const aiInsights = useMemo(() => generateAIInsights({
    // Null, so any insight built on a conversion rate is skipped rather than
    // stated. See storefrontMetrics.
    // 0 rather than undefined: the generator's signature requires a number, and
    // its conversion insights are guarded on the value being above zero, so 0
    // means "do not raise one" without a signature change reaching every caller.
    conversionRate: storefrontMetrics.conversionRate ?? 0,
    repeatRate: customerMetrics.repeatRate,
    topSource,
    totalOrders: platformMetrics.totalOrders,
    totalRevenue: platformMetrics.totalRevenue,
    the platformOrders: platformMetrics.the platformOrders,
    externalOrders: platformMetrics.externalOrders,
    hasData: hasAnyData,
  }), [storefrontMetrics.conversionRate, customerMetrics.repeatRate, topSource, platformMetrics.totalOrders, platformMetrics.totalRevenue, platformMetrics.the platformOrders, platformMetrics.externalOrders, hasAnyData]);

  const smartInsights = useMemo(() => generateSmartInsights({
    // Same as above: 0 means no conversion insight rather than a fabricated one.
    conversionRate: storefrontMetrics.conversionRate ?? 0,
    repeatRate: customerMetrics.repeatRate,
    topSource,
    totalOrders: platformMetrics.totalOrders,
    hasData: hasAnyData,
  }), [storefrontMetrics.conversionRate, customerMetrics.repeatRate, topSource, platformMetrics.totalOrders, hasAnyData]);

  // Revenue Trend / Top Customers / Customer Source Breakdown are Pro+-gated
  // advanced analytics (Phase 4 spec, canViewAdvancedAnalytics). They used to
  // be computed locally from whatever orders the device had already loaded,
  // with no entitlement check at all — a Basic/Standard vendor got the exact
  // same numbers a Pro vendor paid for. They now come exclusively from
  // getBusinessAnalytics (serverAnalytics, above), which is the one place
  // canViewAdvancedAnalytics is actually enforced. `data` is null unless the
  // call succeeded, which only happens on an entitled plan — so
  // hasAdvancedAnalytics IS the gate, never a re-derived plan-string check.
  //
  // The backend's revenueTrend/topCustomers are windowed by the vendor's
  // plan-clamped dashboardFilterRange (today/week/month/year), not this
  // screen's local 1D/1W/1M/3M/6M tab — the two don't map onto each other,
  // so these three sections intentionally ignore `timeRange`.
  const hasAdvancedAnalytics = Boolean(serverAnalytics);

  const revenueTrendData = useMemo<TrendPoint[]>(() => {
    if (!serverAnalytics) return [];
    return serverAnalytics.revenueTrend.map(p => ({ label: p.date, value: p.total }));
  }, [serverAnalytics]);

  const customerSourceBreakdownPending = !serverAnalytics || isPending(serverAnalytics.customerSourceBreakdown);

  const topCustomers = useMemo(() => {
    if (!serverAnalytics) return [];
    // The backend has no customer-name lookup on this endpoint — only the
    // raw uid and lifetime spend in the window. Labelling it honestly as a
    // short id rather than inventing a display name.
    return serverAnalytics.topCustomers.map(c => ({
      name: `Customer ${c.customerId.slice(-6)}`,
      orders: undefined as number | undefined,
      total: c.total,
    }));
  }, [serverAnalytics]);

  const TIME_TABS: { key: TimeRange; label: string }[] = [
    { key: '1D', label: '1D' },
    { key: '1W', label: '1W' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: '6M', label: '6M' },
  ];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              try {
                router.back();
              } catch {
                router.replace('/vendor/(tabs)' as any);
              }
            }}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <ChevronLeft size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Business Insights</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.timeTabsRow}>
          {TIME_TABS.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.timeTab, timeRange === tab.key && styles.timeTabActive]}
              onPress={() => setTimeRange(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeTabText, timeRange === tab.key && styles.timeTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* REVENUE TREND — Pro+ advanced analytics, gated by hasAdvancedAnalytics */}
        <View style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <View>
              <Text style={styles.trendTitle}>Revenue Trend</Text>
              <Text style={styles.trendSubtitle}>Your revenue over the selected period</Text>
            </View>
          </View>
          {hasAdvancedAnalytics ? (
            <RevenueTrendChart data={revenueTrendData} isEmpty={revenueTrendData.length === 0} />
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              <RevenueTrendChart data={REVENUE_TREND_PREVIEW} isEmpty={false} />
            </LockedSection>
          )}
        </View>

        {/* VERIFICATION WARNING — only for actionable states (not_started, rejected). Pending is passive and handled by Dashboard only. */}
        {verificationStatus === 'not_started' && (
          <View style={styles.verifyWarningCard}>
            <View style={styles.verifyWarningLeft}>
              <View style={styles.verifyWarningIconWrap}>
                <AlertTriangle size={18} color="#D97706" strokeWidth={2} />
              </View>
              <View style={styles.verifyWarningText}>
                <Text style={styles.verifyWarningTitle}>Your growth is limited</Text>
                <Text style={styles.verifyWarningBody}>
                  Your storefront is not visible in Home, Explore, or Search yet. Complete verification to reach more customers.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.verifyWarningBtn}
              onPress={() => router.push('/vendor/settings/verification' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.verifyWarningBtnText}>Verify now</Text>
            </TouchableOpacity>
          </View>
        )}
        {(verificationStatus === 'rejected' || verificationStatus === 'retry_required') && (
          <View style={[styles.verifyWarningCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <View style={styles.verifyWarningLeft}>
              <View style={[styles.verifyWarningIconWrap, { backgroundColor: '#FEE2E2' }]}>
                <AlertTriangle size={18} color="#DC2626" strokeWidth={2} />
              </View>
              <View style={styles.verifyWarningText}>
                <Text style={[styles.verifyWarningTitle, { color: '#991B1B' }]}>Verification failed</Text>
                <Text style={[styles.verifyWarningBody, { color: '#DC2626' }]}>
                  {verificationData.rejectionReason || 'We could not verify your identity. Please fix and resubmit.'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.verifyWarningBtn, { backgroundColor: '#DC2626' }]}
              onPress={() => router.push('/vendor/settings/verification' as any)}
              activeOpacity={0.8}
            >
              <Text style={styles.verifyWarningBtnText}>Fix & resubmit</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* OVERVIEW METRICS — always visible */}
        {hasAnyData ? (
          <View style={styles.metricsRow}>
            <PrimaryMetricCard
              label="Total Revenue"
              value={formatCompactCurrency(platformMetrics.totalRevenue, currency)}
              sub="all channels"
              iconBg="rgba(255,255,255,0.15)"
              IconComponent={TrendingUp}
              iconColor="#FFFFFF"
            />
            <View style={{ width: 10 }} />
            <PrimaryMetricCard
              label="Total Orders"
              value={String(platformMetrics.totalOrders)}
              sub="all channels"
              iconBg="rgba(255,255,255,0.15)"
              IconComponent={ShoppingBag}
              iconColor="#FFFFFF"
            />
          </View>
        ) : (
          <SectionEmptyState onDashboard={handleGoToDashboard} />
        )}

        {/* SMART INSIGHTS */}
        <SmartInsightsSection
          insights={smartInsights}
          isPro={isPro}
          onUpgrade={handleUpgrade}
        />

        {/* THE PLATFORM AI INSIGHTS */}
        <the platformAIInsightsSection
          insights={aiInsights}
          plan={plan}
          hasData={hasAnyData}
          onUpgrade={handleUpgrade}
          isVerified={isVerified}
          verificationStatus={(verificationStatus === 'deactivated' || verificationStatus === 'suspended') ? 'not_started' : verificationStatus}
          onVerify={() => router.push('/vendor/settings/verification' as any)}
          onInsightAction={(actionType) => resolveInsightAction(router, actionType)}
        />

        {/* CONVERSION FUNNEL */}
        <View style={styles.section}>
          <SectionHeader
            title="Conversion Funnel"
            subtitle="Where you lose customers along the journey"
          />
          <ConversionFunnel
            visits={storefrontMetrics.visits}
            ordersPlaced={storefrontMetrics.ordersPlaced}
            conversionRate={storefrontMetrics.conversionRate}
          />
        </View>

        {/* SECTION 1 — ORDERS BY SOURCE */}
        <View style={styles.section}>
          <SectionHeader
            title="Orders by Source"
            subtitle="Where your orders are coming from"
          />
          {isPro ? (
            <>
              {allSources.filter(s => s.orders > 0 || s.source === 'the platform Marketplace').map((src, i) => (
                <View key={src.source} style={styles.sourceRow}>
                  <View style={[styles.sourceIconDot, { backgroundColor: `${src.color}20` }]}>
                    <src.IconComponent size={14} color={src.color} strokeWidth={2} />
                  </View>
                  <View style={styles.sourceInfo}>
                    <View style={styles.sourceNameRow}>
                      <Text style={styles.sourceName} numberOfLines={1}>{src.source}</Text>
                      <Text style={styles.sourceOrders}>{src.orders}</Text>
                    </View>
                    <AnimatedBar value={src.orders} max={maxOrders} color={src.color} delay={i * 60} />
                    <Text style={styles.sourceRevenue}>
                      {formatCompactCurrency(src.revenue, currency)} revenue
                    </Text>
                  </View>
                </View>
              ))}
              {allSources.every(s => s.orders === 0) && (
                <View style={styles.emptySection}>
                  <Text style={styles.emptySectionText}>No orders in this period</Text>
                </View>
              )}
            </>
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              {[
                { source: 'the platform Marketplace', orders: 5, revenue: 24500, color: Colors.primary, IconComponent: Store },
                { source: 'WhatsApp', orders: 3, revenue: 12000, color: '#25D366', IconComponent: MessageCircle },
                { source: 'Instagram', orders: 2, revenue: 8700, color: '#E1306C', IconComponent: Camera },
              ].map((src, i) => (
                <View key={src.source} style={styles.sourceRow}>
                  <View style={[styles.sourceIconDot, { backgroundColor: `${src.color}20` }]}>
                    <src.IconComponent size={14} color={src.color} strokeWidth={2} />
                  </View>
                  <View style={styles.sourceInfo}>
                    <View style={styles.sourceNameRow}>
                      <Text style={styles.sourceName}>{src.source}</Text>
                      <Text style={styles.sourceOrders}>{src.orders}</Text>
                    </View>
                    <AnimatedBar value={src.orders} max={5} color={src.color} delay={i * 60} />
                    <Text style={styles.sourceRevenue}>
                      {formatCompactCurrency(src.revenue, currency)} revenue
                    </Text>
                  </View>
                </View>
              ))}
            </LockedSection>
          )}
        </View>

        {/* SECTION 2 — PLATFORM VS EXTERNAL */}
        <View style={styles.section}>
          <SectionHeader
            title="Platform vs External"
            subtitle="the platform marketplace vs manually recorded orders"
          />
          {isPro ? (
            <View style={styles.compareCard}>
              <View style={styles.compareRow}>
                <View style={[styles.compareIconWrap, { backgroundColor: 'rgba(255,140,66,0.1)' }]}>
                  <Store size={18} color={Colors.primary} strokeWidth={2} />
                </View>
                <View style={styles.compareInfo}>
                  <Text style={styles.compareLabel}>the platform Marketplace</Text>
                  <View style={styles.compareBarRow}>
                    <AnimatedBar
                      value={platformMetrics.the platformOrders}
                      max={platformMetrics.totalOrders || 1}
                      color={Colors.primary}
                      delay={0}
                    />
                    <Text style={styles.compareCount}>{platformMetrics.the platformOrders}</Text>
                  </View>
                  <Text style={styles.compareRevenue}>
                    {formatCompactCurrency(platformMetrics.the platformRevenue, currency)}
                  </Text>
                </View>
              </View>

              <View style={styles.compareDivider} />

              <View style={styles.compareRow}>
                <View style={[styles.compareIconWrap, { backgroundColor: '#F3F4F6' }]}>
                  <Globe size={18} color="#6B7280" strokeWidth={2} />
                </View>
                <View style={styles.compareInfo}>
                  <Text style={styles.compareLabel}>External Orders</Text>
                  <View style={styles.compareBarRow}>
                    <AnimatedBar
                      value={platformMetrics.externalOrders}
                      max={platformMetrics.totalOrders || 1}
                      color="#6B7280"
                      delay={100}
                    />
                    <Text style={styles.compareCount}>{platformMetrics.externalOrders}</Text>
                  </View>
                  <Text style={styles.compareRevenue}>
                    {formatCompactCurrency(platformMetrics.externalRevenue, currency)}
                  </Text>
                </View>
              </View>

              {platformMetrics.totalOrders > 0 && (
                <View style={styles.compareSplit}>
                  <View style={styles.splitRow}>
                    <View style={[styles.splitDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.splitLabel}>
                      {Math.round((platformMetrics.the platformOrders / platformMetrics.totalOrders) * 100)}% the platform
                    </Text>
                    <View style={[styles.splitDot, { backgroundColor: '#9CA3AF', marginLeft: 12 }]} />
                    <Text style={styles.splitLabel}>
                      {Math.round((platformMetrics.externalOrders / platformMetrics.totalOrders) * 100)}% External
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              <View style={styles.compareCard}>
                <View style={styles.compareRow}>
                  <View style={[styles.compareIconWrap, { backgroundColor: 'rgba(255,140,66,0.1)' }]}>
                    <Store size={18} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <View style={styles.compareInfo}>
                    <Text style={styles.compareLabel}>the platform Marketplace</Text>
                    <View style={styles.compareBarRow}>
                      <AnimatedBar value={7} max={10} color={Colors.primary} delay={0} />
                      <Text style={styles.compareCount}>7</Text>
                    </View>
                    <Text style={styles.compareRevenue}>₦35,000.00</Text>
                  </View>
                </View>
                <View style={styles.compareDivider} />
                <View style={styles.compareRow}>
                  <View style={[styles.compareIconWrap, { backgroundColor: '#F3F4F6' }]}>
                    <Globe size={18} color="#6B7280" strokeWidth={2} />
                  </View>
                  <View style={styles.compareInfo}>
                    <Text style={styles.compareLabel}>External Orders</Text>
                    <View style={styles.compareBarRow}>
                      <AnimatedBar value={3} max={10} color="#6B7280" delay={100} />
                      <Text style={styles.compareCount}>3</Text>
                    </View>
                    <Text style={styles.compareRevenue}>₦15,000.00</Text>
                  </View>
                </View>
              </View>
            </LockedSection>
          )}
        </View>

        {/* SECTION 3 — CUSTOMER GROWTH */}
        <View style={styles.section}>
          <SectionHeader
            title="Customer Growth"
            subtitle={timeRange === '1D' ? 'Today' : timeRange === '1W' ? 'Last 7 days' : timeRange === '1M' ? 'Last 30 days' : timeRange === '3M' ? 'Last 90 days' : 'Last 180 days'}
          />
          {isPro ? (
            <>
              {customerMetrics.total > 0 ? (
                <View style={styles.customerGridRow}>
                  <View style={[styles.customerCard, { backgroundColor: '#F0FDF4' }]}>
                    <Text style={styles.customerCardValue}>{customerMetrics.newCustomers}</Text>
                    <Text style={styles.customerCardLabel}>New Customers</Text>
                  </View>
                  <View style={[styles.customerCard, { backgroundColor: '#EFF6FF' }]}>
                    <Text style={styles.customerCardValue}>{customerMetrics.repeatCustomers}</Text>
                    <Text style={styles.customerCardLabel}>Repeat Customers</Text>
                  </View>
                  <View style={[styles.customerCard, { backgroundColor: '#FFFBEB' }]}>
                    <Text style={styles.customerCardValue}>{customerMetrics.repeatRate}%</Text>
                    <Text style={styles.customerCardLabel}>Repeat Rate</Text>
                  </View>
                </View>
              ) : (
                <SectionEmptyState onDashboard={handleGoToDashboard} />
              )}
            </>
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              <View style={styles.customerGridRow}>
                <View style={[styles.customerCard, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.customerCardValue}>12</Text>
                  <Text style={styles.customerCardLabel}>New Customers</Text>
                </View>
                <View style={[styles.customerCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.customerCardValue}>4</Text>
                  <Text style={styles.customerCardLabel}>Repeat Customers</Text>
                </View>
                <View style={[styles.customerCard, { backgroundColor: '#FFFBEB' }]}>
                  <Text style={styles.customerCardValue}>33%</Text>
                  <Text style={styles.customerCardLabel}>Repeat Rate</Text>
                </View>
              </View>
            </LockedSection>
          )}
        </View>

        {/* SECTION 4 — STOREFRONT PERFORMANCE */}
        <View style={styles.section}>
          <SectionHeader
            title="Storefront Performance"
            subtitle="Visits, orders placed, and conversion from your storefront"
          />
          {isPro ? (
            <View style={styles.storefrontCard}>
              <View style={styles.storefrontRow}>
                <View style={styles.storefrontIconWrap}>
                  <Globe size={16} color="#2563EB" strokeWidth={2} />
                </View>
                <View style={styles.storefrontInfo}>
                  <Text style={styles.storefrontLabel}>Storefront Visits</Text>
                  <Text style={styles.storefrontValue}>{storefrontMetrics.visits}</Text>
                </View>
                <TouchableOpacity
                  style={styles.storefrontInfoBtn}
                  onPress={() => setShowVisitsTooltip(v => !v)}
                  activeOpacity={0.7}
                >
                  <Info size={14} color="#9CA3AF" strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {showVisitsTooltip && (
                <View style={styles.storefrontTooltip}>
                  <Text style={styles.storefrontTooltipText}>Based on tracked storefront activity</Text>
                </View>
              )}
              <View style={styles.storefrontDivider} />
              <View style={styles.storefrontRow}>
                <View style={[styles.storefrontIconWrap, { backgroundColor: '#FFF7ED' }]}>
                  <ShoppingBag size={16} color="#C2410C" strokeWidth={2} />
                </View>
                <View style={styles.storefrontInfo}>
                  <Text style={styles.storefrontLabel}>Orders Placed</Text>
                  <Text style={styles.storefrontValue}>{storefrontMetrics.ordersPlaced}</Text>
                </View>
              </View>
              <View style={styles.storefrontDivider} />
              <View style={styles.storefrontRow}>
                <View style={[styles.storefrontIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <ArrowUpRight size={16} color="#16A34A" strokeWidth={2} />
                </View>
                <View style={styles.storefrontInfo}>
                  <Text style={styles.storefrontLabel}>Conversion Rate</Text>
                  <Text style={[styles.storefrontValue, { color: '#16A34A' }]}>
                    {storefrontMetrics.conversionRate}%
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              <View style={styles.storefrontCard}>
                <View style={styles.storefrontRow}>
                  <View style={styles.storefrontIconWrap}>
                    <Globe size={16} color="#2563EB" strokeWidth={2} />
                  </View>
                  <View style={styles.storefrontInfo}>
                    <Text style={styles.storefrontLabel}>Storefront Visits</Text>
                    <Text style={styles.storefrontValue}>247</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.storefrontInfoBtn}
                    onPress={() => setShowVisitsTooltip(v => !v)}
                    activeOpacity={0.7}
                  >
                    <Info size={14} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontRow}>
                  <View style={[styles.storefrontIconWrap, { backgroundColor: '#FFF7ED' }]}>
                    <ShoppingBag size={16} color="#C2410C" strokeWidth={2} />
                  </View>
                  <View style={styles.storefrontInfo}>
                    <Text style={styles.storefrontLabel}>Orders Placed</Text>
                    <Text style={styles.storefrontValue}>18</Text>
                  </View>
                </View>
                <View style={styles.storefrontDivider} />
                <View style={styles.storefrontRow}>
                  <View style={[styles.storefrontIconWrap, { backgroundColor: '#F0FDF4' }]}>
                    <ArrowUpRight size={16} color="#16A34A" strokeWidth={2} />
                  </View>
                  <View style={styles.storefrontInfo}>
                    <Text style={styles.storefrontLabel}>Conversion Rate</Text>
                    <Text style={[styles.storefrontValue, { color: '#16A34A' }]}>7%</Text>
                  </View>
                </View>
              </View>
            </LockedSection>
          )}
        </View>

        {/* SECTION 5 — TOP CUSTOMERS */}
        <View style={styles.section}>
          <SectionHeader
            title="Top Customers"
            subtitle="Ranked by total revenue generated"
          />
          {hasAdvancedAnalytics ? (
            topCustomers.length > 0 ? (
              <View style={styles.topCustomersCard}>
                {topCustomers.map((customer, index) => (
                  <View key={customer.name}>
                    {index > 0 && <View style={styles.topCustomerDivider} />}
                    <View style={styles.topCustomerRow}>
                      <View style={[
                        styles.topCustomerRankWrap,
                        index === 0 && styles.topCustomerRankGold,
                        index === 1 && styles.topCustomerRankSilver,
                        index === 2 && styles.topCustomerRankBronze,
                      ]}>
                        {index === 0 ? (
                          <Crown size={13} color="#B45309" strokeWidth={2.5} />
                        ) : (
                          <Text style={[
                            styles.topCustomerRankText,
                            index === 1 && { color: '#6B7280' },
                            index === 2 && { color: '#92400E' },
                          ]}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={styles.topCustomerInfo}>
                        <Text style={styles.topCustomerName} numberOfLines={1}>{customer.name}</Text>
                        {customer.orders !== undefined && (
                          <Text style={styles.topCustomerOrders}>
                            {customer.orders} {customer.orders === 1 ? 'order' : 'orders'}
                          </Text>
                        )}
                      </View>
                      <Text style={styles.topCustomerTotal}>
                        {formatCompactCurrency(customer.total, currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <SectionEmptyState onDashboard={handleGoToDashboard} />
            )
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              <View style={styles.topCustomersCard}>
                {[
                  { name: 'Amaka Johnson', orders: 5, total: 24500 },
                  { name: 'Chidi Okonkwo', orders: 3, total: 16200 },
                  { name: 'Fatima Aliyu', orders: 2, total: 9800 },
                ].map((customer, index) => (
                  <View key={customer.name}>
                    {index > 0 && <View style={styles.topCustomerDivider} />}
                    <View style={styles.topCustomerRow}>
                      <View style={[
                        styles.topCustomerRankWrap,
                        index === 0 && styles.topCustomerRankGold,
                        index === 1 && styles.topCustomerRankSilver,
                        index === 2 && styles.topCustomerRankBronze,
                      ]}>
                        {index === 0 ? (
                          <Crown size={13} color="#B45309" strokeWidth={2.5} />
                        ) : (
                          <Text style={styles.topCustomerRankText}>{index + 1}</Text>
                        )}
                      </View>
                      <View style={styles.topCustomerInfo}>
                        <Text style={styles.topCustomerName}>{customer.name}</Text>
                        <Text style={styles.topCustomerOrders}>{customer.orders} orders</Text>
                      </View>
                      <Text style={styles.topCustomerTotal}>
                        {formatCompactCurrency(customer.total, currency)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </LockedSection>
          )}
        </View>

        {/* SECTION 6 — CUSTOMER SOURCE BREAKDOWN */}
        <View style={styles.section}>
          <SectionHeader
            title="Customer Source Breakdown"
            subtitle="Unique customers acquired per channel"
          />
          {hasAdvancedAnalytics ? (
            // The backend genuinely does not compute this yet on any plan —
            // getBusinessAnalytics always returns customerSourceBreakdown as
            // { dataPending: true } (it has no acquisition-channel tracking,
            // e.g. no record of "this customer came from WhatsApp"). Showing
            // an honest pending state here, for an entitled vendor, instead
            // of the fabricated internal/external-only numbers this screen
            // used to invent locally.
            customerSourceBreakdownPending ? (
              <View style={styles.emptySection}>
                <Text style={styles.emptySectionText}>Channel breakdown is coming soon</Text>
              </View>
            ) : null
          ) : (
            <LockedSection onUpgrade={handleUpgrade}>
              {[
                { source: 'the platform Marketplace', customers: 8, revenue: 39200, color: Colors.primary, IconComponent: Store },
                { source: 'WhatsApp', customers: 5, revenue: 22400, color: '#25D366', IconComponent: MessageCircle },
                { source: 'Instagram', customers: 3, revenue: 13700, color: '#E1306C', IconComponent: Camera },
              ].map((src, i) => (
                <View key={src.source} style={styles.sourceRow}>
                  <View style={[styles.sourceIconDot, { backgroundColor: `${src.color}20` }]}>
                    <src.IconComponent size={14} color={src.color} strokeWidth={2} />
                  </View>
                  <View style={styles.sourceInfo}>
                    <View style={styles.sourceNameRow}>
                      <Text style={styles.sourceName}>{src.source}</Text>
                      <Text style={styles.sourceOrders}>{src.customers}</Text>
                    </View>
                    <AnimatedBar value={src.customers} max={8} color={src.color} delay={i * 60} />
                    <Text style={styles.sourceRevenue}>
                      {formatCompactCurrency(src.revenue, currency)} revenue
                    </Text>
                  </View>
                </View>
              ))}
            </LockedSection>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  safeTop: {
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  timeTabsRow: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 8,
    backgroundColor: Colors.background,
  },
  timeTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
  },
  timeTabActive: {
    backgroundColor: '#1A1A1A',
  },
  timeTabText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6B7280',
  },
  timeTabTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  metricsRow: {
    flexDirection: 'row' as const,
  },
  section: {
    marginTop: 24,
  },
  sourceRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 14,
  },
  sourceIconDot: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 2,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  sourceName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    flex: 1,
  },
  sourceOrders: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginLeft: 8,
  },
  sourceRevenue: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  compareCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  compareRow: {
    flexDirection: 'row' as const,
    gap: 12,
    alignItems: 'flex-start' as const,
  },
  compareIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 2,
  },
  compareInfo: {
    flex: 1,
  },
  compareLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#2B2B2B',
    marginBottom: 6,
  },
  compareBarRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  compareCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    width: 28,
    textAlign: 'right' as const,
  },
  compareRevenue: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 5,
  },
  compareDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 14,
  },
  compareSplit: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  splitRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  splitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  splitLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
  },
  customerGridRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  customerCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center' as const,
  },
  customerCardValue: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  customerCardLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  storefrontCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  storefrontRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  storefrontIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  storefrontInfo: {
    flex: 1,
  },
  storefrontLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500' as const,
    marginBottom: 2,
  },
  storefrontValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1A1A1A',
  },
  storefrontDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  storefrontInfoBtn: {
    padding: 4,
  },
  storefrontTooltip: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: -4,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  storefrontTooltipText: {
    fontSize: 12,
    color: '#F9FAFB',
    lineHeight: 16,
  },
  topCustomersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  topCustomerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  topCustomerDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  topCustomerRankWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  topCustomerRankGold: {
    backgroundColor: '#FEF3C7',
  },
  topCustomerRankSilver: {
    backgroundColor: '#F1F5F9',
  },
  topCustomerRankBronze: {
    backgroundColor: '#FEF3C7',
    opacity: 0.7,
  },
  topCustomerRankText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#6B7280',
  },
  topCustomerInfo: {
    flex: 1,
  },
  topCustomerName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  topCustomerOrders: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500' as const,
  },
  topCustomerTotal: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  emptySection: {
    paddingVertical: 24,
    alignItems: 'center' as const,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  emptySectionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  trendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  trendHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 4,
  },
  trendTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    letterSpacing: -0.3,
  },
  trendSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
    fontWeight: '400' as const,
  },
  verifyWarningCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  verifyWarningLeft: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    flex: 1,
  },
  verifyWarningIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
  },
  verifyWarningText: {
    flex: 1,
  },
  verifyWarningTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#92400E',
    marginBottom: 3,
  },
  verifyWarningBody: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 17,
  },
  verifyWarningBtn: {
    backgroundColor: '#D97706',
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center' as const,
  },
  verifyWarningBtnText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
