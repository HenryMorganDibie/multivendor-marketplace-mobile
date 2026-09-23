import { Platform, StyleSheet, TextStyle } from 'react-native';

/**
 * Platform Design Tokens — 2026 Premium Marketplace System
 *
 * Inspired by UberEats, DoorDash, Shopify, Apple HIG.
 * All legacy keys are preserved for backwards compatibility.
 */

export const PlatformColors = {
  // Brand
  primary: '#FF7A28',
  primarySoft: 'rgba(255,122,40,0.10)',
  primarySofter: 'rgba(255,122,40,0.06)',
  primaryDisabled: 'rgba(255,122,40,0.32)',
  primaryDark: '#E8631A',
  primaryDarker: '#C9520F',
  primaryTint: '#FFF4EC',

  // Text — refined hierarchy
  textPrimary: '#0B0C0F',
  textSecondary: '#4F5663',
  textSecondaryOnSurface: '#3A4150',
  textTertiary: '#7A8290',
  textDisabled: '#A8AFBA',
  textInverse: '#FFFFFF',

  // Surfaces — layered for depth
  backgroundMain: '#FFFFFF',
  backgroundCanvas: '#F8F9FB',
  surface: '#F4F5F8',
  surfaceElevated: '#FAFBFC',
  surfaceMuted: '#EFF1F5',
  surfaceTinted: '#FBF7F3',

  // Borders — softer, more refined
  border: '#EEF0F4',
  borderSoft: '#F2F4F7',
  borderStrong: '#D9DDE3',
  borderFocus: '#FF7A28',

  // Semantic
  error: '#E5484D',
  errorLight: '#FEF2F2',
  errorBorder: '#FECACA',
  success: '#10A862',
  successLight: '#ECFDF3',
  successBorder: '#B6F0D0',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',
  info: '#2E7DEC',
  infoLight: '#EFF5FF',

  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  charcoal: '#0B0C0F',

  // Overlays — softer, premium glass
  overlay: 'rgba(11, 12, 15, 0.48)',
  overlayLight: 'rgba(11, 12, 15, 0.18)',
  overlayHeavy: 'rgba(11, 12, 15, 0.64)',
  scrim: 'rgba(11, 12, 15, 0.06)',
} as const;

/**
 * Premium layered shadow system.
 * Soft, diffuse, never harsh. Mimics Apple HIG depth cues.
 */
export const Shadows = {
  xs: Platform.select({
    ios: {
      shadowColor: '#0B0C0F',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
    default: {},
  }) as object,
  sm: Platform.select({
    ios: {
      shadowColor: '#0B0C0F',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
    default: {},
  }) as object,
  md: Platform.select({
    ios: {
      shadowColor: '#0B0C0F',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {},
  }) as object,
  lg: Platform.select({
    ios: {
      shadowColor: '#0B0C0F',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.10,
      shadowRadius: 28,
    },
    android: { elevation: 8 },
    default: {},
  }) as object,
  xl: Platform.select({
    ios: {
      shadowColor: '#0B0C0F',
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.14,
      shadowRadius: 40,
    },
    android: { elevation: 14 },
    default: {},
  }) as object,
  brand: Platform.select({
    ios: {
      shadowColor: '#FF7A28',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 18,
    },
    android: { elevation: 6 },
    default: {},
  }) as object,
} as const;

/**
 * Typography scale — Inter / SF Pro inspired.
 * Tight letter-spacing on display sizes, generous line-height on body.
 */
export const Typography: Record<string, TextStyle> = {
  displayHero: {
    fontSize: 34,
    fontWeight: '800',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  displayTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: PlatformColors.textPrimary,
    lineHeight: 22,
  },
  bodyStrong: {
    fontSize: 15,
    fontWeight: '600',
    color: PlatformColors.textPrimary,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  smallText: {
    fontSize: 13,
    fontWeight: '400',
    color: PlatformColors.textSecondary,
    lineHeight: 18,
  },
  smallStrong: {
    fontSize: 13,
    fontWeight: '600',
    color: PlatformColors.textPrimary,
    lineHeight: 18,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: PlatformColors.textTertiary,
    lineHeight: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: PlatformColors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
};

/**
 * Spacing — 4pt base scale for predictable rhythm.
 */
export const Spacing = {
  xxs: 4,
  xs: 8,
  s: 12,
  sm: 16,
  m: 20,
  md: 24,
  lg: 32,
  xl: 48,
  xxl: 64,
} as const;

/**
 * Radii — premium rounded geometry.
 */
export const Radii = {
  xs: 8,
  sm: 10,
  input: 14,
  button: 16,
  card: 18,
  cardLarge: 22,
  modal: 24,
  sheet: 28,
  pill: 999,
} as const;

/**
 * Hairline divider — sub-pixel on iOS, 1px on Android.
 */
export const Hairline = StyleSheet.hairlineWidth;

export const ButtonStyles = StyleSheet.create({
  primary: {
    backgroundColor: PlatformColors.primary,
    height: 52,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  primaryDisabled: {
    backgroundColor: PlatformColors.primaryDisabled,
  },
  primaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: PlatformColors.white,
    letterSpacing: -0.1,
  },
  secondary: {
    backgroundColor: PlatformColors.white,
    height: 52,
    borderRadius: Radii.button,
    borderWidth: 1,
    borderColor: PlatformColors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: PlatformColors.charcoal,
    letterSpacing: -0.1,
  },
  surface: {
    backgroundColor: PlatformColors.surface,
    height: 46,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  surfaceText: {
    fontSize: 15,
    fontWeight: '600',
    color: PlatformColors.charcoal,
  },
  ghost: {
    backgroundColor: 'transparent',
    height: 46,
    borderRadius: Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ghostText: {
    fontSize: 15,
    fontWeight: '600',
    color: PlatformColors.primary,
  },
});

export const CardStyles = StyleSheet.create({
  base: {
    backgroundColor: PlatformColors.white,
    borderWidth: 1,
    borderColor: PlatformColors.border,
    borderRadius: Radii.card,
    padding: 18,
  },
  surface: {
    backgroundColor: PlatformColors.white,
    borderWidth: 1,
    borderColor: PlatformColors.border,
    borderRadius: Radii.card,
    padding: 18,
  },
  elevated: {
    backgroundColor: PlatformColors.white,
    borderRadius: Radii.cardLarge,
    padding: 18,
    ...(Shadows.sm as object),
  },
});

export const InputStyles = StyleSheet.create({
  base: {
    backgroundColor: PlatformColors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: Radii.input,
    paddingVertical: 15,
    paddingHorizontal: 16,
    fontSize: 16,
    color: PlatformColors.textPrimary,
  },
  focused: {
    borderColor: PlatformColors.primary,
    backgroundColor: PlatformColors.white,
  },
  error: {
    borderColor: PlatformColors.error,
  },
});

/**
 * Pill / chip styles — modern category selectors.
 */
export const PillStyles = StyleSheet.create({
  base: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: Radii.pill,
    backgroundColor: PlatformColors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  active: {
    backgroundColor: PlatformColors.charcoal,
    borderColor: PlatformColors.charcoal,
  },
  baseText: {
    fontSize: 14,
    fontWeight: '600',
    color: PlatformColors.textPrimary,
    letterSpacing: -0.1,
  },
  activeText: {
    color: PlatformColors.white,
  },
});
