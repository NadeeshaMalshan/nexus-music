import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRef } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { useDashboard } from '@/src/context/DashboardContext';
import { useSettings } from '@/src/context/SettingsContext';
import { useThemePalette } from '@/src/theme/useThemePalette';
import type { DefaultPlayMode } from '@/src/types/settings';

function formatTime(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function NowPlayingScreen() {
  const p = useThemePalette();
  const { settings, updateSetting } = useSettings();
  const {
    currentSong,
    isPlaying,
    currentTimeSec,
    durationSec,
    volume,
    setVolume,
    onTogglePlay,
    onNext,
    onPrev,
    onSeek,
  } = useDashboard();

  const pct = durationSec > 0 ? Math.min(100, (currentTimeSec / durationSec) * 100) : 0;
  const remaining = Math.max(0, durationSec - currentTimeSec);

  const progressW = useRef(0);
  const volW = useRef(0);

  const onProgressLayout = (e: LayoutChangeEvent) => {
    progressW.current = e.nativeEvent.layout.width;
  };

  const onVolLayout = (e: LayoutChangeEvent) => {
    volW.current = e.nativeEvent.layout.width;
  };

  const onBarPress = (x: number) => {
    const w = progressW.current;
    if (w <= 0 || durationSec <= 0) return;
    void onSeek((x / w) * durationSec);
  };

  const toggleMode = (mode: DefaultPlayMode) => {
    void updateSetting('defaultPlayMode', mode);
  };

  return (
    <ScreenChrome>
      <LinearGradient
        colors={['#3a1c18', '#120a0a', '#080808']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topBar}>
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: p.mutedForeground }]} />
        </View>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={14} style={[styles.iconCircle, { backgroundColor: 'rgba(0,0,0,0.35)' }]}>
            <FontAwesome name="chevron-down" size={20} color="#fff" />
          </Pressable>
          <Pressable hitSlop={14} style={{ padding: 8 }}>
            <FontAwesome name="heart-o" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {currentSong ? (
          <>
            <View style={styles.artWrap}>
              {currentSong.artwork ? (
                <Image source={{ uri: currentSong.artwork }} style={styles.art} />
              ) : (
                <View style={[styles.art, styles.artPh, { backgroundColor: p.muted }]}>
                  <FontAwesome name="music" size={64} color={p.mutedForeground} />
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title} numberOfLines={2}>
                  {currentSong.title}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {currentSong.artist}
                </Text>
              </View>
              <View style={[styles.modePill, { borderColor: 'rgba(255,255,255,0.2)' }]}>
                <Pressable
                  onPress={() => toggleMode('audio')}
                  style={[
                    styles.modeDot,
                    settings.defaultPlayMode === 'audio' ? styles.modeOn : styles.modeOff,
                  ]}>
                  <FontAwesome
                    name="music"
                    size={14}
                    color={settings.defaultPlayMode === 'audio' ? '#111' : '#ccc'}
                  />
                </Pressable>
                <Pressable
                  onPress={() => toggleMode('video')}
                  style={[
                    styles.modeDot,
                    settings.defaultPlayMode === 'video' ? styles.modeOn : styles.modeOff,
                  ]}>
                  <FontAwesome
                    name="video-camera"
                    size={14}
                    color={settings.defaultPlayMode === 'video' ? '#111' : '#ccc'}
                  />
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={(e) => onBarPress(e.nativeEvent.locationX)}
              onLayout={onProgressLayout}
              style={styles.progressHit}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFg, { width: `${pct}%` }]} />
              </View>
            </Pressable>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{formatTime(currentTimeSec)}</Text>
              <Text style={styles.time}>-{formatTime(remaining)}</Text>
            </View>

            <View style={styles.transport}>
              <Pressable onPress={() => void onPrev()} hitSlop={16}>
                <FontAwesome name="step-backward" size={28} color="#fff" />
              </Pressable>
              <Pressable onPress={() => void onTogglePlay()} style={styles.playBig} hitSlop={12}>
                <FontAwesome name={isPlaying ? 'pause' : 'play'} size={36} color="#fff" />
              </Pressable>
              <Pressable onPress={() => void onNext()} hitSlop={16}>
                <FontAwesome name="step-forward" size={28} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.volRow}>
              <FontAwesome name="volume-down" size={16} color="rgba(255,255,255,0.55)" />
              <Pressable
                style={styles.volTrack}
                onLayout={onVolLayout}
                onPress={(e) => {
                  const w = volW.current;
                  if (w <= 0) return;
                  const x = e.nativeEvent.locationX;
                  setVolume(x / w);
                }}>
                <View style={styles.volBg}>
                  <View style={[styles.volFg, { width: `${volume * 100}%` }]} />
                </View>
              </Pressable>
              <FontAwesome name="volume-up" size={16} color="rgba(255,255,255,0.55)" />
            </View>
          </>
        ) : (
          <Text style={styles.empty}>Nothing playing. Pick a track from Search or Library.</Text>
        )}

        <View style={styles.bottomActions}>
          <Pressable style={styles.bottomIcon} hitSlop={12}>
            <FontAwesome name="microphone" size={22} color="rgba(255,255,255,0.45)" />
          </Pressable>
          <Pressable style={styles.bottomIcon} hitSlop={12}>
            <FontAwesome name="list-ol" size={22} color="rgba(255,255,255,0.45)" />
          </Pressable>
          <Pressable style={styles.bottomIcon} hitSlop={12}>
            <FontAwesome name="users" size={22} color="rgba(255,255,255,0.45)" />
          </Pressable>
          <Pressable style={styles.bottomIcon} hitSlop={12}>
            <FontAwesome name="book" size={22} color="rgba(255,255,255,0.45)" />
          </Pressable>
        </View>
      </View>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingTop: 6, paddingHorizontal: 12 },
  handleWrap: { alignItems: 'center', marginBottom: 8 },
  handle: { width: 40, height: 4, borderRadius: 2, opacity: 0.35 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1, paddingHorizontal: 24, paddingBottom: 28 },
  artWrap: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 320,
    aspectRatio: 1,
    borderRadius: 24,
    overflow: 'hidden',
    marginTop: 12,
    marginBottom: 28,
  },
  art: { width: '100%', height: '100%' },
  artPh: { alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  artist: { fontSize: 16, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  modePill: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
  },
  modeDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeOn: { backgroundColor: '#fff' },
  modeOff: { backgroundColor: 'transparent' },
  progressHit: { width: '100%' },
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  progressFg: { height: '100%', borderRadius: 2, backgroundColor: '#fff' },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  time: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  transport: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 48,
    marginTop: 28,
  },
  playBig: { padding: 8 },
  volRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
  },
  volTrack: { flex: 1, height: 28, justifyContent: 'center' },
  volBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  volFg: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  empty: {
    textAlign: 'center',
    marginTop: 80,
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingTop: 24,
  },
  bottomIcon: { padding: 10 },
});
