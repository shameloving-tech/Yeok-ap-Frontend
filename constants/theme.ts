import { Platform } from 'react-native';

// ─── Color Palette ───────────────────────────────────────────────────────────
export const APP_COLORS = {
  // Brand
  primary: '#2E6D4D',
  primaryLight: '#E8F4EE',
  primaryDim: '#548C71',

  // Backgrounds
  background: '#F5F5F7',
  cardBg: '#FFFFFF',
  surfaceSecondary: '#F0F0F5',

  // Text
  textMain: '#1C1C1E',
  textSub: '#6C6C70',
  textTertiary: '#AEAEB2',
  textInverse: '#FFFFFF',

  // Borders & Dividers
  border: '#E5E5EA',
  divider: '#F2F2F7',

  // Semantic
  accent: '#FF9F43',
  danger: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',

  // Congestion
  congestionFree: '#34C759',
  congestionNormal: '#FFCC00',
  congestionBusy: '#FF9500',
  congestionCrazy: '#FF3B30',

  // Misc
  searchBg: '#EBEBF0',
  overlay: 'rgba(0,0,0,0.45)',
  shadow: '#000000',
};

// ─── Typography ──────────────────────────────────────────────────────────────
export const TYPE = {
  // Display
  display: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.5 },

  // Headings
  h1: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: '600' as const, letterSpacing: -0.1 },

  // Body
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  bodySemiBold: { fontSize: 14, fontWeight: '600' as const, lineHeight: 20 },

  // Label / Caption
  label: { fontSize: 13, fontWeight: '500' as const, lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  captionBold: { fontSize: 12, fontWeight: '600' as const, lineHeight: 16 },
  tiny: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14 },
};

// ─── Spacing (8pt grid) ──────────────────────────────────────────────────────
export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

// ─── Border Radius ───────────────────────────────────────────────────────────
export const RADIUS = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  full: 999,
};

// ─── Shadows ─────────────────────────────────────────────────────────────────
export const SHADOW = {
  none: {},
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
};

// ─── Legacy (backward compat) ────────────────────────────────────────────────
const tintColorLight = APP_COLORS.primary;
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: APP_COLORS.textMain,
    background: APP_COLORS.background,
    tint: tintColorLight,
    icon: APP_COLORS.textSub,
    tabIconDefault: APP_COLORS.textSub,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
