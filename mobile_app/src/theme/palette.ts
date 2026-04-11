/**
 * Mirrors the main web app visual tokens from:
 * - `src/css/theme.css` (light / dark semantic colors)
 * - `src/css/index.css` (art-primary / art-secondary / art-accent for EchoAI chrome)
 *
 * oklch() values from theme.css are approximated to hex for React Native.
 */
export const art = {
  primary: '#0d0b14',
  secondary: '#1a1528',
  accent: '#a855f7',
  /** Play / active transport — matches web coral CTA */
  play: '#f97357',
} as const;

/** Light mode — matches `theme.css` :root */
export const lightPalette = {
  background: '#ffffff',
  foreground: '#252525',
  card: '#ffffff',
  cardForeground: '#252525',
  primary: '#030213',
  primaryForeground: '#ffffff',
  secondary: '#f4f4f7',
  secondaryForeground: '#030213',
  muted: '#ececf0',
  mutedForeground: '#717182',
  accent: '#e9ebef',
  accentForeground: '#030213',
  destructive: '#d4183d',
  destructiveForeground: '#ffffff',
  border: 'rgba(0,0,0,0.1)',
  inputBackground: '#f3f3f5',
  ring: '#b0b0b0',
  /** Active tab / primary actions — EchoAI purple */
  tint: art.accent,
  tabBar: '#ffffff',
  tabBarBorder: 'rgba(0,0,0,0.08)',
  /** Optional subtle art wash on headers */
  headerBackground: '#ffffff',
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.08)',
  playAccent: art.play,
  miniPlayerSurface: 'rgba(255,255,255,0.92)',
  miniPlayerBorder: 'rgba(168,85,247,0.35)',
} as const;

/** Dark mode — theme.css `.dark` + index.css art surfaces */
export const darkPalette = {
  background: art.primary,
  foreground: '#fafafa',
  card: art.secondary,
  cardForeground: '#fafafa',
  primary: '#fafafa',
  primaryForeground: '#333333',
  secondary: '#404040',
  secondaryForeground: '#fafafa',
  muted: '#2a2438',
  mutedForeground: '#b0b0b0',
  accent: '#2d2640',
  accentForeground: '#fafafa',
  destructive: '#ef4444',
  destructiveForeground: '#ffffff',
  border: 'rgba(255,255,255,0.08)',
  inputBackground: 'rgba(255,255,255,0.06)',
  ring: '#6b6b6b',
  tint: art.accent,
  tabBar: '#0a0a0f',
  tabBarBorder: 'rgba(255,255,255,0.06)',
  headerBackground: art.secondary,
  glass: 'rgba(255,255,255,0.03)',
  glassBorder: 'rgba(255,255,255,0.08)',
  playAccent: art.play,
  miniPlayerSurface: 'rgba(14,11,22,0.94)',
  miniPlayerBorder: 'rgba(168,85,247,0.45)',
} as const;

export type ThemePalette = typeof lightPalette | typeof darkPalette;
