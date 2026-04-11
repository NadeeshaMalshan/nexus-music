import { useMemo } from 'react';

import { useColorScheme } from '@/components/useColorScheme';
import { darkPalette, lightPalette, type ThemePalette } from '@/src/theme/palette';

export function useThemePalette(): ThemePalette {
  const scheme = useColorScheme() ?? 'light';
  return useMemo(() => (scheme === 'dark' ? darkPalette : lightPalette), [scheme]);
}
