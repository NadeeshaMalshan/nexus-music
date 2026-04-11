/**
 * Default screen chrome uses the same semantic colors as the web app
 * (`theme.css` + `index.css` art palette via `palette.ts`).
 */
import { Text as DefaultText, View as DefaultView } from 'react-native';

import { darkPalette, lightPalette } from '@/src/theme/palette';

import { useColorScheme } from './useColorScheme';

type ThemeProps = {
  lightColor?: string;
  darkColor?: string;
};

export type TextProps = ThemeProps & DefaultText['props'];
export type ViewProps = ThemeProps & DefaultView['props'];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: 'text' | 'background'
) {
  const theme = useColorScheme() ?? 'light';
  const p = theme === 'dark' ? darkPalette : lightPalette;
  const colorFromProps = theme === 'light' ? props.light : props.dark;
  if (colorFromProps) return colorFromProps;
  return colorName === 'background' ? p.background : p.foreground;
}

export function Text(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return <DefaultText style={[{ color, letterSpacing: -0.3 }, style]} {...otherProps} />;
}

export function View(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props;
  const backgroundColor = useThemeColor({ light: lightColor, dark: darkColor }, 'background');

  return <DefaultView style={[{ backgroundColor }, style]} {...otherProps} />;
}
