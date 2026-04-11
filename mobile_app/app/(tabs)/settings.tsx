import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { useAuth } from '@/src/auth/AuthContext';
import { useSettings } from '@/src/context/SettingsContext';
import { useThemePalette } from '@/src/theme/useThemePalette';
import type { AudioQuality, DefaultPlayMode, VideoQuality } from '@/src/types/settings';

export default function SettingsScreen() {
  const p = useThemePalette();
  const { googleAccessToken, isLoading: authLoading, signIn, signOut } = useAuth();
  const { settings, updateSetting, isLoading: settingsLoading } = useSettings();

  const videoOptions: VideoQuality[] = ['auto', '1080p', '720p', '480p', '360p'];
  const audioOptions: AudioQuality[] = ['high', 'normal', 'low'];
  const playModes: DefaultPlayMode[] = ['audio', 'video'];

  const chipRow = useMemo(
    () => ({
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      marginTop: 8,
    }),
    []
  );

  function SettingBlock({ children }: { children: ReactNode }) {
    return (
      <View
        style={[
          styles.block,
          { backgroundColor: p.card, borderColor: p.glassBorder },
        ]}>
        {children}
      </View>
    );
  }

  function ChipGroup<T extends string>({
    value,
    options,
    onChange,
  }: {
    value: T;
    options: T[];
    onChange: (v: T) => void;
  }) {
    return (
      <View style={chipRow}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            style={[
              styles.chip,
              { borderColor: p.border, backgroundColor: p.muted },
              value === opt && { backgroundColor: p.tint, borderColor: p.tint },
            ]}
            onPress={() => onChange(opt)}>
            <Text
              style={[
                styles.chipText,
                { color: value === opt ? '#fff' : p.mutedForeground },
              ]}>
              {opt}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <ScreenChrome>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: p.foreground }]}>Settings</Text>
        <Text style={[styles.subtitle, { color: p.mutedForeground }]}>
          Manage your music experience.
        </Text>

        {authLoading || settingsLoading ? (
          <Text style={[styles.mutedLine, { color: p.mutedForeground }]}>Loading…</Text>
        ) : null}

        {!googleAccessToken ? (
          <LinearGradient
            colors={['#9333ea', '#db2777', '#ea580c']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.syncBanner}>
            <Text style={styles.syncTitle}>Sync your Music</Text>
            <Text style={styles.syncBody}>
              Sign in to access your library, playlists, and AI history across any device.
            </Text>
            <Pressable style={styles.syncBtn} onPress={signIn}>
              <FontAwesome name="sign-in" size={16} color="#111" style={{ marginRight: 8 }} />
              <Text style={styles.syncBtnText}>Sign in with Google</Text>
            </Pressable>
          </LinearGradient>
        ) : (
          <Pressable
            style={[styles.signedPill, { borderColor: p.border, backgroundColor: p.card }]}
            onPress={signOut}>
            <Text style={[styles.signedText, { color: p.foreground }]}>Sign out</Text>
          </Pressable>
        )}

        <View style={styles.sectionHead}>
          <FontAwesome name="music" size={14} color={p.mutedForeground} />
          <Text style={[styles.sectionLabel, { color: p.mutedForeground }]}>
            PLAYBACK EXPERIENCE
          </Text>
        </View>

        <SettingBlock>
          <View style={[styles.itemRow, { borderBottomColor: p.border }]}>
            <View style={[styles.itemIcon, { backgroundColor: p.muted }]}>
              <FontAwesome name="repeat" size={16} color={p.foreground} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemTitle, { color: p.cardForeground }]}>Gapless Playback</Text>
              <Text style={[styles.itemDesc, { color: p.mutedForeground }]}>
                Eliminate time gaps between consecutive audio tracks.
              </Text>
            </View>
            <Switch
              value={settings.gaplessPlayback}
              onValueChange={(v) => updateSetting('gaplessPlayback', v)}
              trackColor={{ false: p.border, true: p.tint }}
            />
          </View>

          <View style={[styles.itemRow, { borderBottomColor: p.border }]}>
            <View style={[styles.itemIcon, { backgroundColor: p.muted }]}>
              <FontAwesome name="arrows-h" size={16} color={p.foreground} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemTitle, { color: p.cardForeground }]}>Crossfade Songs</Text>
              <Text style={[styles.itemDesc, { color: p.mutedForeground }]}>
                {settings.crossfade} seconds
              </Text>
            </View>
            <View style={styles.stepperGroup}>
              <Pressable
                style={[styles.stepper, { borderColor: p.border }]}
                onPress={() => updateSetting('crossfade', Math.max(0, settings.crossfade - 1))}>
                <Text style={[styles.stepperTxt, { color: p.foreground }]}>−</Text>
              </Pressable>
              <Pressable
                style={[styles.stepper, { borderColor: p.border }]}
                onPress={() => updateSetting('crossfade', Math.min(12, settings.crossfade + 1))}>
                <Text style={[styles.stepperTxt, { color: p.foreground }]}>+</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.itemRowLast}>
            <View style={[styles.itemIcon, { backgroundColor: p.muted }]}>
              <FontAwesome name="refresh" size={16} color={p.foreground} />
            </View>
            <View style={styles.itemText}>
              <Text style={[styles.itemTitle, { color: p.cardForeground }]}>Autoplay</Text>
              <Text style={[styles.itemDesc, { color: p.mutedForeground }]}>
                Keep playing similar music when your queue ends.
              </Text>
            </View>
            <Switch
              value={settings.autoplay}
              onValueChange={(v) => updateSetting('autoplay', v)}
              trackColor={{ false: p.border, true: p.tint }}
            />
          </View>
        </SettingBlock>

        <Text style={[styles.sectionTitle, { color: p.mutedForeground }]}>DEFAULT PLAY MODE</Text>
        <View style={[styles.blockLoose, { backgroundColor: 'transparent' }]}>
          <ChipGroup<DefaultPlayMode>
            value={settings.defaultPlayMode}
            options={playModes}
            onChange={(v) => updateSetting('defaultPlayMode', v)}
          />
        </View>

        <Text style={[styles.sectionTitle, { color: p.mutedForeground }]}>QUALITY</Text>
        <SettingBlock>
          <View style={styles.qualityInner}>
            <Text style={[styles.innerLabel, { color: p.mutedForeground }]}>Video</Text>
            <ChipGroup<VideoQuality>
              value={settings.videoQuality}
              options={videoOptions}
              onChange={(v) => updateSetting('videoQuality', v)}
            />
            <Text style={[styles.innerLabel, { color: p.mutedForeground, marginTop: 16 }]}>Audio</Text>
            <ChipGroup<AudioQuality>
              value={settings.audioQuality}
              options={audioOptions}
              onChange={(v) => updateSetting('audioQuality', v)}
            />
          </View>
        </SettingBlock>

        <Text style={[styles.sectionTitle, { color: p.mutedForeground }]}>INTERFACE</Text>
        <SettingBlock>
          <View style={styles.itemRowLast}>
            <Text style={[styles.itemTitle, { color: p.cardForeground, flex: 1 }]}>Reduce animations</Text>
            <Switch
              value={settings.reduceAnimations}
              onValueChange={(v) => updateSetting('reduceAnimations', v)}
              trackColor={{ false: p.border, true: p.tint }}
            />
          </View>
        </SettingBlock>

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  container: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  title: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 15, fontWeight: '500', marginTop: 8, marginBottom: 20 },
  mutedLine: { marginBottom: 12, fontSize: 14 },
  syncBanner: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
  },
  syncTitle: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  syncBody: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
    textAlign: 'center',
    lineHeight: 22,
  },
  syncBtn: {
    marginTop: 20,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
  },
  syncBtnText: { fontSize: 15, fontWeight: '800', color: '#111' },
  signedPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 24,
  },
  signedText: { fontWeight: '800', fontSize: 15 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 10,
  },
  block: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  blockLoose: { marginBottom: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  itemRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 16, fontWeight: '700' },
  itemDesc: { fontSize: 13, fontWeight: '500', marginTop: 4, lineHeight: 18 },
  stepperGroup: { flexDirection: 'row', gap: 8 },
  stepper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperTxt: { fontSize: 20, fontWeight: '700' },
  qualityInner: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14 },
  innerLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4, paddingTop: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
});
