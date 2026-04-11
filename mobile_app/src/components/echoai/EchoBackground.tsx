import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useColorScheme } from '@/components/useColorScheme';
import { art } from '@/src/theme/palette';
import { useThemePalette } from '@/src/theme/useThemePalette';

/**
 * EchoAI-style canvas: vertical wash (web Listen Now / Library) + purple accent glow.
 */
export function EchoBackground({ children }: { children: ReactNode }) {
  const scheme = useColorScheme() ?? 'light';
  const p = useThemePalette();

  if (scheme !== 'dark') {
    return <View style={[styles.fill, { backgroundColor: p.background }]}>{children}</View>;
  }

  return (
    <View style={[styles.fill, { backgroundColor: '#06060c' }]}>
      <LinearGradient
        colors={['#1a0b2e', '#140a22', '#0a0612', '#000000']}
        locations={[0, 0.35, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[`${art.accent}38`, 'transparent', `${art.secondary}aa`]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.12, y: 0 }}
        end={{ x: 0.88, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.2)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
