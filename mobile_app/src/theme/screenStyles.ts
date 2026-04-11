import { StyleSheet } from 'react-native';

import type { ThemePalette } from '@/src/theme/palette';

const radius = 10;
const radiusLg = 12;

export function createSearchStyles(p: ThemePalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: p.background },
    container: {
      padding: 16,
      paddingBottom: 32,
      backgroundColor: p.background,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 8,
      color: p.foreground,
      letterSpacing: -0.4,
    },
    debug: {
      fontSize: 11,
      color: p.mutedForeground,
      marginBottom: 8,
    },
    input: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      marginBottom: 12,
      backgroundColor: p.inputBackground,
      color: p.foreground,
      letterSpacing: -0.2,
    },
    error: {
      color: p.destructive,
      marginBottom: 12,
      fontSize: 13,
      lineHeight: 18,
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
      flexWrap: 'wrap',
    },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: p.tint,
    },
    chipText: {
      color: '#ffffff',
      fontWeight: '600',
      letterSpacing: -0.2,
    },
    results: {
      gap: 10,
      paddingBottom: 24,
    },
    item: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.card,
    },
    itemTitle: { fontWeight: '600', color: p.cardForeground, letterSpacing: -0.2 },
    itemSubtitle: { color: p.mutedForeground, marginTop: 2 },
    muted: { color: p.mutedForeground },
  });
}

export function createSettingsStyles(p: ThemePalette) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: 'transparent' },
    container: {
      padding: 16,
      paddingBottom: 40,
      backgroundColor: 'transparent',
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 8,
      color: p.foreground,
      letterSpacing: -0.4,
    },
    section: {
      fontSize: 13,
      fontWeight: '700',
      color: p.mutedForeground,
      marginTop: 20,
      marginBottom: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    muted: {
      color: p.mutedForeground,
      marginBottom: 12,
      letterSpacing: -0.1,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: p.border,
      backgroundColor: 'transparent',
    },
    rowLabel: {
      flex: 1,
      fontSize: 16,
      paddingRight: 12,
      color: p.foreground,
      fontWeight: '500',
      letterSpacing: -0.2,
    },
    block: {
      marginBottom: 12,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 8,
    },
    chip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      backgroundColor: p.inputBackground,
    },
    chipActive: {
      backgroundColor: p.tint,
      borderColor: p.tint,
    },
    chipText: { fontSize: 13, color: p.foreground },
    chipTextActive: { color: '#ffffff', fontWeight: '600' },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius,
      backgroundColor: p.tint,
      alignSelf: 'flex-start',
      marginBottom: 8,
    },
    buttonText: { color: '#ffffff', fontWeight: '600', letterSpacing: -0.2 },
    buttonSecondary: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      alignSelf: 'flex-start',
      marginBottom: 8,
      backgroundColor: p.card,
    },
    buttonSecondaryText: { color: p.foreground, fontWeight: '600' },
    crossfadeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    stepper: {
      width: 44,
      height: 44,
      borderRadius: radius,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: p.inputBackground,
    },
    stepperText: { fontSize: 22, fontWeight: '500', color: p.foreground },
    crossfadeValue: {
      fontSize: 18,
      fontWeight: '600',
      minWidth: 28,
      textAlign: 'center',
      color: p.foreground,
    },
  });
}

export function createLibraryScreenStyles(p: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: p.background,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 8,
      color: p.foreground,
      letterSpacing: -0.4,
    },
    muted: { color: p.mutedForeground, letterSpacing: -0.1 },
    results: { flex: 1, gap: 10, marginTop: 12 },
    item: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.card,
    },
    itemTitle: { fontWeight: '600', color: p.cardForeground, letterSpacing: -0.2 },
    itemSubtitle: { color: p.mutedForeground, marginTop: 2 },
  });
}

export function createNowPlayingStyles(p: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
      backgroundColor: p.background,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 8,
      color: p.foreground,
      letterSpacing: -0.4,
    },
    card: {
      width: '100%',
      padding: 14,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.card,
      marginBottom: 16,
    },
    songTitle: {
      fontWeight: '700',
      fontSize: 16,
      marginBottom: 2,
      color: p.cardForeground,
      letterSpacing: -0.2,
    },
    songArtist: { color: p.mutedForeground, marginBottom: 8 },
    muted: {
      color: p.mutedForeground,
      textAlign: 'center',
      letterSpacing: -0.1,
    },
    row: { flexDirection: 'row', gap: 10 },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius,
      backgroundColor: p.tint,
    },
    buttonText: { color: '#ffffff', fontWeight: '600', letterSpacing: -0.2 },
  });
}

export function createSimpleScreenStyles(p: ThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      padding: 16,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: p.background,
    },
    title: {
      fontSize: 22,
      fontWeight: '600',
      marginBottom: 8,
      color: p.foreground,
      letterSpacing: -0.4,
    },
    muted: {
      color: p.mutedForeground,
      textAlign: 'center',
      marginBottom: 16,
      letterSpacing: -0.1,
    },
    button: {
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: radius,
      backgroundColor: p.tint,
      marginBottom: 12,
    },
    buttonText: { color: '#ffffff', fontWeight: '600' },
    card: {
      width: '100%',
      padding: 12,
      borderRadius: radiusLg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: p.glassBorder,
      backgroundColor: p.card,
      marginBottom: 16,
    },
    row: { flexDirection: 'row', gap: 10 },
  });
}
