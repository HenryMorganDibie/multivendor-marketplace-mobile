import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Share, ActivityIndicator } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Download, ChevronDown, ChevronLeft, Lock, AlertCircle, BarChart2 } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { File, Paths } from 'expo-file-system';
import { mockOrders, Order } from '@/mocks/ordersData';
import { formatPriceCents, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { Colors } from '@/constants/colors';

type ReportType = 'monthly' | 'yearly';

interface ReportGeneration {
  month: number;
  year: number;
  count: number;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const VENDOR_NAME = 'Spicy Restaurant';
const VENDOR_ID = 'v1';
const MONTHLY_REPORT_LIMIT = 3;
const REPORT_TRACKING_KEY = '@platform_report_generations';

export default function ReportsScreen() {
  const router = useRouter();
  const { plan } = useVendorPlan();

  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showYearlyYearPicker, setShowYearlyYearPicker] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() - 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedYearlyYear, setSelectedYearlyYear] = useState<number>(new Date().getFullYear() - 1);
  const [isGeneratingMonthly, setIsGeneratingMonthly] = useState(false);
  const [isGeneratingYearly, setIsGeneratingYearly] = useState(false);
  const [reportGenerations, setReportGenerations] = useState<ReportGeneration>({ month: new Date().getMonth(), year: new Date().getFullYear(), count: 0 });

  const canAccessReports = plan === 'pro' || plan === 'pro+';
  const canAccessYearly = plan === 'pro+';

  useEffect(() => {
    loadReportGenerations();
  }, []);

  const loadReportGenerations = async () => {
    try {
      const stored = await AsyncStorage.getItem(REPORT_TRACKING_KEY);
      if (stored) {
        const data: ReportGeneration = JSON.parse(stored);
        const now = new Date();
        if (data.month === now.getMonth() && data.year === now.getFullYear()) {
          setReportGenerations(data);
        } else {
          const newData = { month: now.getMonth(), year: now.getFullYear(), count: 0 };
          setReportGenerations(newData);
          await AsyncStorage.setItem(REPORT_TRACKING_KEY, JSON.stringify(newData));
        }
      }
    } catch (error) {
      console.error('Failed to load report generations:', error);
    }
  };

  const incrementReportGeneration = async () => {
    try {
      const updated = { ...reportGenerations, count: reportGenerations.count + 1 };
      setReportGenerations(updated);
      await AsyncStorage.setItem(REPORT_TRACKING_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to update report generations:', error);
    }
  };

  const monthlyLimitReached = reportGenerations.count >= MONTHLY_REPORT_LIMIT;

  const availableMonths = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    return Array.from({ length: 12 }, (_, i) => i).filter(month => {
      if (currentYear === selectedYear) return month < currentMonth;
      return true;
    });
  }, [selectedYear]);

  const availableMonthYears = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const years: number[] = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      years.push(year);
    }
    return years;
  }, []);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let year = currentYear - 1; year >= currentYear - 5; year--) {
      years.push(year);
    }
    return years;
  }, []);

  const getOrdersForPeriod = (type: ReportType, month?: number, year?: number): Order[] => {
    return mockOrders.filter(order => {
      if (order.vendorId !== VENDOR_ID) return false;
      const orderDate = new Date(order.orderDate);
      if (type === 'monthly' && month !== undefined && year !== undefined) {
        return orderDate.getMonth() === month && orderDate.getFullYear() === year;
      } else if (type === 'yearly' && year !== undefined) {
        return orderDate.getFullYear() === year;
      }
      return false;
    });
  };

  const generateHTMLReport = (orders: Order[], period: string): string => {
    const totalOrders = orders.length;
    const completedOrders = orders.filter(o => o.status === 'completed').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    const totalGross = orders.reduce((sum, o) => sum + o.total, 0);

    const orderRows = orders.map(order => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.publicOrderId}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${new Date(order.orderDate).toLocaleDateString()}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.fulfillmentType}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.paymentStatus === 'payment_received' ? 'Paid' : order.paymentStatus === 'partially_received' ? 'Partially Paid' : 'Unpaid'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPriceCents(order.total, (mockVendor.currency as Currency) || 'NGN')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPriceCents(order.discount, (mockVendor.currency as Currency) || 'NGN')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${formatPriceCents(order.tax, (mockVendor.currency as Currency) || 'NGN')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${order.status === 'cancelled' ? 'Yes' : 'No'}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 40px; background: #ffffff; }
            .header { margin-bottom: 40px; }
            .header h1 { margin: 0 0 8px 0; font-size: 28px; color: #111827; }
            .header p { margin: 0; font-size: 16px; color: #6b7280; }
            .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
            .summary-card { background: #f9fafb; padding: 20px; border-radius: 8px; }
            .summary-card h3 { margin: 0 0 8px 0; font-size: 14px; color: #6b7280; font-weight: 600; }
            .summary-card p { margin: 0; font-size: 24px; color: #111827; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 40px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
            th { padding: 12px; background: #f9fafb; text-align: left; font-weight: 600; font-size: 14px; color: #374151; border-bottom: 2px solid #e5e7eb; }
            td { font-size: 14px; color: #111827; }
            .disclaimer { margin-top: 40px; padding: 20px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px; }
            .disclaimer p { margin: 0; font-size: 13px; color: #92400e; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${VENDOR_NAME}</h1>
            <p>Report Period: ${period}</p>
          </div>
          <div class="summary">
            <div class="summary-card"><h3>TOTAL ORDERS</h3><p>${totalOrders}</p></div>
            <div class="summary-card"><h3>COMPLETED</h3><p>${completedOrders}</p></div>
            <div class="summary-card"><h3>CANCELLED</h3><p>${cancelledOrders}</p></div>
            <div class="summary-card"><h3>GROSS TOTAL</h3><p style="font-size: 20px;">${formatPriceCents(totalGross, (mockVendor.currency as Currency) || 'NGN')}</p></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Order ID</th><th>Date</th><th>Fulfillment</th><th>Payment Status</th>
                <th style="text-align: right;">Total</th><th style="text-align: right;">Discount</th>
                <th style="text-align: right;">Tax</th><th>Cancelled</th>
              </tr>
            </thead>
            <tbody>
              ${orderRows || '<tr><td colspan="8" style="padding: 40px; text-align: center; color: #9ca3af;">No orders for this period</td></tr>'}
            </tbody>
          </table>
          <div class="disclaimer">
            <p><strong>Disclaimer:</strong> This report is generated from vendor-entered order data. the platform does not process payments, verify transactions, or guarantee financial accuracy.</p>
          </div>
        </body>
      </html>
    `;
  };

  const handleGenerateMonthlyReport = async () => {
    if (monthlyLimitReached) {
      Alert.alert('Limit Reached', `You can only generate ${MONTHLY_REPORT_LIMIT} monthly reports per calendar month.`);
      return;
    }
    const orders = getOrdersForPeriod('monthly', selectedMonth, selectedYear);
    if (orders.length === 0) {
      Alert.alert('No Data', 'No orders found for the selected period.');
      return;
    }
    setIsGeneratingMonthly(true);
    try {
      const period = `${MONTHS[selectedMonth]} ${selectedYear}`;
      const html = generateHTMLReport(orders, period);
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `${VENDOR_NAME.replace(/\s+/g, '_')}_monthly_${period.replace(/\s+/g, '_')}.pdf`;
      const pdfFile = new File(Paths.cache, fileName);
      const sourceFile = new File(uri);
      sourceFile.move(pdfFile);
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = pdfFile.uri;
        link.download = fileName;
        link.click();
      } else {
        await Share.share({ url: pdfFile.uri, message: `${period} Report` });
      }
      await incrementReportGeneration();
      Alert.alert('Success', 'Monthly report generated successfully.');
    } catch (error) {
      console.error('Failed to generate report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingMonthly(false);
    }
  };

  const handleGenerateYearlyReport = async () => {
    const orders = getOrdersForPeriod('yearly', undefined, selectedYearlyYear);
    if (orders.length === 0) {
      Alert.alert('No Data', 'No orders found for the selected year.');
      return;
    }
    setIsGeneratingYearly(true);
    try {
      const period = `${selectedYearlyYear}`;
      const html = generateHTMLReport(orders, period);
      const { uri } = await Print.printToFileAsync({ html });
      const fileName = `${VENDOR_NAME.replace(/\s+/g, '_')}_yearly_${period}.pdf`;
      const pdfFile = new File(Paths.cache, fileName);
      const sourceFile = new File(uri);
      sourceFile.move(pdfFile);
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = pdfFile.uri;
        link.download = fileName;
        link.click();
      } else {
        await Share.share({ url: pdfFile.uri, message: `${period} Annual Report` });
      }
      Alert.alert('Success', 'Yearly report generated successfully.');
    } catch (error) {
      console.error('Failed to generate report:', error);
      Alert.alert('Error', 'Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingYearly(false);
    }
  };

  const handleUpgrade = () => {
    router.push('/vendor/settings/upgrade-plan' as any);
  };

  // Locked / upgrade gate
  if (!canAccessReports) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
          <View style={styles.lockedHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton} activeOpacity={0.7}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.lockedHeaderTitle}>Reports</Text>
            <View style={styles.placeholder} />
          </View>
        </SafeAreaView>
        <View style={styles.lockedContainer}>
          <View style={styles.lockedIconWrap}>
            <Lock size={28} color={Colors.textMuted} />
          </View>
          <Text style={styles.lockedTitle}>Reports require Pro or Pro+</Text>
          <Text style={styles.lockedDescription}>
            Generate monthly and yearly PDF reports from your order history.
          </Text>
          <TouchableOpacity style={styles.lockedButton} onPress={handleUpgrade} activeOpacity={0.8}>
            <Text style={styles.lockedButtonText}>Upgrade Plan</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Reports" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Intro */}
        <View style={styles.infoCard}>
          <BarChart2 size={16} color={Colors.textMuted} style={styles.infoIcon} />
          <Text style={styles.infoText}>
            Generate PDF reports from your order history — order counts, payment status, and line-item details.
          </Text>
        </View>

        {/* MONTHLY REPORTS */}
        <Text style={styles.sectionTitle}>MONTHLY REPORT</Text>
        <View style={styles.card}>
          {/* Month selector */}
          <View style={styles.selectorRow}>
            <Text style={styles.selectorLabel}>Month</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => { setShowMonthPicker(!showMonthPicker); setShowYearPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorText}>{MONTHS[selectedMonth]}</Text>
              <ChevronDown size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {showMonthPicker && (
              <View style={styles.pickerDropdown}>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {availableMonths.map((month) => (
                    <TouchableOpacity
                      key={month}
                      style={[styles.pickerOption, selectedMonth === month && styles.pickerOptionSelected]}
                      onPress={() => { setSelectedMonth(month); setShowMonthPicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerOptionText, selectedMonth === month && styles.pickerOptionTextSelected]}>
                        {MONTHS[month]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
          <View style={styles.cardDivider} />
          {/* Year selector */}
          <View style={styles.selectorRow}>
            <Text style={styles.selectorLabel}>Year</Text>
            <TouchableOpacity
              style={styles.selector}
              onPress={() => { setShowYearPicker(!showYearPicker); setShowMonthPicker(false); }}
              activeOpacity={0.7}
            >
              <Text style={styles.selectorText}>{selectedYear}</Text>
              <ChevronDown size={16} color={Colors.textMuted} />
            </TouchableOpacity>
            {showYearPicker && (
              <View style={styles.pickerDropdown}>
                <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                  {availableMonthYears.map((year) => (
                    <TouchableOpacity
                      key={year}
                      style={[styles.pickerOption, selectedYear === year && styles.pickerOptionSelected]}
                      onPress={() => { setSelectedYear(year); setShowYearPicker(false); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.pickerOptionText, selectedYear === year && styles.pickerOptionTextSelected]}>
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        </View>

        {monthlyLimitReached && (
          <View style={styles.warningBanner}>
            <AlertCircle size={14} color={Colors.warning} />
            <Text style={styles.warningText}>
              Monthly limit reached ({MONTHLY_REPORT_LIMIT} reports). Resets {new Date(reportGenerations.year, reportGenerations.month + 1, 1).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.generateButton, (monthlyLimitReached || isGeneratingMonthly) && styles.generateButtonDisabled]}
          onPress={handleGenerateMonthlyReport}
          disabled={monthlyLimitReached || isGeneratingMonthly}
          activeOpacity={0.7}
        >
          {isGeneratingMonthly ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Download size={16} color={Colors.white} />
          )}
          <Text style={styles.generateButtonText}>
            {isGeneratingMonthly ? 'Generating...' : 'Generate Report'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.limitText}>
          {reportGenerations.count} of {MONTHLY_REPORT_LIMIT} reports used this month
        </Text>

        {/* YEARLY REPORTS */}
        <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>YEARLY REPORT</Text>

        {canAccessYearly ? (
          <>
            <View style={styles.card}>
              <View style={styles.selectorRow}>
                <Text style={styles.selectorLabel}>Year</Text>
                <TouchableOpacity
                  style={styles.selector}
                  onPress={() => setShowYearlyYearPicker(!showYearlyYearPicker)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.selectorText}>{selectedYearlyYear}</Text>
                  <ChevronDown size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {showYearlyYearPicker && (
                  <View style={styles.pickerDropdown}>
                    <ScrollView style={styles.pickerScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                      {availableYears.map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={[styles.pickerOption, selectedYearlyYear === year && styles.pickerOptionSelected]}
                          onPress={() => { setSelectedYearlyYear(year); setShowYearlyYearPicker(false); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.pickerOptionText, selectedYearlyYear === year && styles.pickerOptionTextSelected]}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.generateButton, isGeneratingYearly && styles.generateButtonDisabled]}
              onPress={handleGenerateYearlyReport}
              disabled={isGeneratingYearly}
              activeOpacity={0.7}
            >
              {isGeneratingYearly ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Download size={16} color={Colors.white} />
              )}
              <Text style={styles.generateButtonText}>
                {isGeneratingYearly ? 'Generating...' : 'Generate Yearly Report'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.upgradeCard}>
            <View style={styles.upgradeIconWrap}>
              <Lock size={18} color={Colors.textMuted} />
            </View>
            <View style={styles.upgradeBody}>
              <Text style={styles.upgradeTitle}>Pro+ required</Text>
              <Text style={styles.upgradeDescription}>Yearly reports are available on the Pro+ plan.</Text>
            </View>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade} activeOpacity={0.8}>
              <Text style={styles.upgradeButtonText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* DISCLAIMER */}
        <View style={styles.disclaimerCard}>
          <Text style={styles.disclaimerTitle}>About these reports</Text>
          <Text style={styles.disclaimerText}>
            Reports are generated from vendor-entered order data. the platform does not process payments, verify transactions, or guarantee financial accuracy. Not suitable for official tax filings without independent verification.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  },
  // Locked state header
  lockedHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  lockedHeaderTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  placeholder: {
    width: 36,
  },
  lockedContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  lockedIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  lockedDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  lockedButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  lockedButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  // Content
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Info card
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 10,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  infoIcon: {
    marginTop: 1,
    flexShrink: 0,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  // Section headers
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },
  // Selector card
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'visible' as const,
  },
  cardDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  selectorRow: {
    paddingVertical: 12,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
  },
  selector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  selectorText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  pickerDropdown: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    marginTop: 8,
    maxHeight: 200,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  pickerScroll: {
    maxHeight: 200,
  },
  pickerOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: Colors.primarySoft,
  },
  pickerOptionText: {
    fontSize: 15,
    color: Colors.text,
  },
  pickerOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  // Warning banner
  warningBanner: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 10,
    padding: 11,
    marginTop: 10,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  // Generate button
  generateButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    marginTop: 12,
  },
  generateButtonDisabled: {
    opacity: 0.45,
  },
  generateButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  limitText: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  // Upgrade card (inline horizontal)
  upgradeCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  upgradeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  upgradeBody: {
    flex: 1,
  },
  upgradeTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  upgradeDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
  },
  upgradeButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9,
    flexShrink: 0,
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  // Disclaimer
  disclaimerCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  disclaimerTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 5,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  disclaimerText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 40,
  },
});
