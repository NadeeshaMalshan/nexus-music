import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { useDashboard } from '@/src/context/DashboardContext';
import { useThemePalette } from '@/src/theme/useThemePalette';

export function MiniPlayerBar() {
  const { currentSong, isPlaying, onTogglePlay, onNext, onPrev } = useDashboard();
  const p = useThemePalette();

  const glow =
    Platform.OS === 'ios'
      ? {
          shadowColor: p.tint,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 16,
        }
      : Platform.OS === 'android'
        ? { elevation: 14 }
        : { shadowColor: p.tint, shadowOpacity: 0.4, shadowRadius: 20 };

  return (
    <View style={styles.wrap}>
      <View
        style={[
          styles.pill,
          {
            backgroundColor: p.miniPlayerSurface,
            borderColor: p.miniPlayerBorder,
            ...glow,
          },
        ]}>
        <View style={styles.transport}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous track"
            hitSlop={10}
            onPress={() => void onPrev()}
            style={styles.tBtn}>
            <FontAwesome name="step-backward" size={16} color={p.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
            hitSlop={10}
            onPress={() => void onTogglePlay()}
            style={styles.tBtn}>
            <FontAwesome
              name={isPlaying ? 'pause' : 'play'}
              size={22}
              color={currentSong ? p.playAccent : p.mutedForeground}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next track"
            hitSlop={10}
            onPress={() => void onNext()}
            style={styles.tBtn}>
            <FontAwesome name="step-forward" size={16} color={p.mutedForeground} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.push('/nowplaying')}
          style={[styles.infoPill, { borderColor: p.glassBorder }]}
          hitSlop={4}>
          {currentSong?.artwork ? (
            <Image source={{ uri: currentSong.artwork }} style={styles.art} />
          ) : (
            <View style={[styles.artPh, { backgroundColor: p.muted }]}>
              <FontAwesome name="music" size={14} color={p.mutedForeground} />
            </View>
          )}
          <View style={styles.meta}>
            <Text numberOfLines={1} style={[styles.title, { color: p.foreground }]}>
              {currentSong?.title ?? 'Nexus Music'}
            </Text>
            <Text numberOfLines={1} style={[styles.sub, { color: p.mutedForeground }]}>
              {currentSong ? currentSong.artist.toUpperCase() : 'READY TO STREAM'}
            </Text>
          </View>
        </Pressable>

        {currentSong ? (
          <Pressable accessibilityLabel="Like" hitSlop={10} style={styles.heart}>
            <FontAwesome name="heart-o" size={18} color={p.mutedForeground} />
          </Pressable>
        ) : (
          <View style={{ width: 8 }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  art: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(128,128,128,0.2)' },
  artPh: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 9, fontWeight: '700', letterSpacing: 0.8, marginTop: 2 },
  heart: { paddingLeft: 2 },
});
