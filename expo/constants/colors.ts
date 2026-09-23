import { Platform, TextStyle, ViewStyle } from 'react-native';

export const Colors = {
  primary: '#FF7A28',
  primarySoft: 'rgba(255,122,40,0.10)',
  primarySofter: 'rgba(255,122,40,0.06)',
  primaryDisabled: 'rgba(255,122,40,0.32)',
  primaryDark: '#E8631A',
  primaryTint: '#FFF4EC',
  primaryText: '#FFFFFF',

  text: '#0B0C0F',
  textSecondary: '#4F5663',
  textSecondaryOnSurface: '#3A4150',
  textTertiary: '#7A8290',
  textMuted: '#A8AFBA',
  textMutedOnSurface: '#4F5663',

  background: '#FFFFFF',
  backgroundCanvas: '#F8F9FB',
  surface: '#F4F5F8',
  surfaceElevated: '#FAFBFC',
  surfaceMuted: '#EFF1F5',
  surfaceBorder: '#EEF0F4',

  border: '#EEF0F4',
  borderLight: '#F4F6F9',
  borderSoft: '#F2F4F7',
  borderDark: '#D9DDE3',

  white: '#FFFFFF',
  black: '#000000',
  charcoal: '#0B0C0F',

  error: '#E5484D',
  errorLight: '#FEF2F2',
  errorBorder: '#FECACA',

  success: '#10A862',
  successLight: '#ECFDF3',
  successBorder: '#B6F0D0',

  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningBorder: '#FDE68A',

  info: '#FF7A28',
  infoLight: 'rgba(255,122,40,0.08)',

  star: '#FF7A28',

  disabled: '#F5F6F8',
  disabledText: '#9AA1AC',

  badge: '#E5484D',

  overlay: 'rgba(11, 12, 15, 0.48)',
  overlayLight: 'rgba(11, 12, 15, 0.18)',
  overlayHeavy: 'rgba(11, 12, 15, 0.64)',

  tabBarBackground: '#FFFFFF',
  tabBarActivePill: 'transparent',
  tabBarActiveText: '#FF7A28',
  tabBarInactive: '#5C6470',

  cardBackground: '#FFFFFF',
  cardBorder: '#EEF0F4',

  inputBackground: '#F4F5F8',
  inputBorder: '#EEF0F4',
  inputText: '#0B0C0F',
  inputPlaceholder: '#A8AFBA',

  link: '#FF7A28',

  destructive: '#E5484D',
  destructiveLight: '#FEF2F2',
};

export default {
  light: {
    text: Colors.text,
    background: Colors.background,
    tint: Colors.primary,
    tabIconDefault: Colors.tabBarInactive,
    tabIconSelected: Colors.primary,
  },
};

/**
 * Phase 1 foundation tokens — customer UI polish (see the Customer UI Audit).
 *
 * These extend the existing `Colors` foundation above with the spacing,
 * radius, shadow, and typography scales the audit found repeated ad hoc
 * across customer screens (Home, Explore, Settings, Profile). Adding them
 * here does not change any existing screen: nothing below is wired into a
 * screen yet, and no value in `Colors` above was changed.
 *
 * Naming follows constants/theme.ts's existing xxs/xs/s/sm/m/md/lg/xl
 * spacing convention where the values line up; Radii and Shadows use their
 * own sm/md/lg/xl scale since the audit's consolidated radius values
 * (8/12/16/24) don't line up with theme.ts's per-surface radius names
 * (input/button/card/modal, etc.) closely enough to reuse them without
 * misrepresenting a value.
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
} as const;

export const Radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

export const Shadows: Record<'sm' | 'md', ViewStyle> = {
  // The card shadow already used throughout Settings.
  sm: Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 8,
    },
    android: { elevation: 1 },
    default: {},
  }) as ViewStyle,
  md: Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07,
      shadowRadius: 16,
    },
    android: { elevation: 4 },
    default: {},
  }) as ViewStyle,
};

export const Typography: Record<
  'headerTitle' | 'sectionTitle' | 'cardTitle' | 'body' | 'bodySecondary' | 'caption' | 'sectionLabel',
  TextStyle
> = {
  // Screen header titles (e.g. Settings, Favorites, Orders headers).
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.2,
  },
  // Home/Explore section titles ("Trending in Lagos", "Open Now", etc.).
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.2,
    lineHeight: 24,
  },
  // Card/list item titles (vendor name, product name).
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    letterSpacing: -0.1,
    lineHeight: 22,
  },
  // Primary body copy.
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.text,
    lineHeight: 22,
  },
  // Row subtitles and other de-emphasized supporting copy.
  bodySecondary: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  // Timestamps, metadata, helper text.
  caption: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textTertiary,
    lineHeight: 16,
  },
  // Settings-style all-caps group labels ("ACCOUNT", "PREFERENCES").
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1.0,
  },
};
