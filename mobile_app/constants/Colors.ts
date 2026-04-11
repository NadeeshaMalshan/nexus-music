import { darkPalette, lightPalette, type ThemePalette } from '@/src/theme/palette';

function navSlice(p: ThemePalette) {
  return {
    text: p.foreground,
    background: p.background,
    tint: p.tint,
    tabIconDefault: p.mutedForeground,
    tabIconSelected: p.tint,
  };
}

export default {
  light: navSlice(lightPalette),
  dark: navSlice(darkPalette),
};
