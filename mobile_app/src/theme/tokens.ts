/**
 * @deprecated Use `palette.ts` + `useThemePalette()` for full parity with web theme.
 * Kept for any imports expecting the old minimal shape.
 */
import { art, darkPalette, lightPalette } from '@/src/theme/palette';

export const tokens = {
  light: {
    background: lightPalette.background,
    foreground: lightPalette.foreground,
    accent: art.accent,
  },
  dark: {
    background: darkPalette.background,
    foreground: darkPalette.foreground,
    accent: art.accent,
  },
} as const;

export { art, darkPalette, lightPalette };
