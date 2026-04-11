import { useCallback, useEffect, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { apiYoutubePlaylistItems, apiYtPlaylist } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthContext';
import { useDashboard } from '@/src/context/DashboardContext';
import type { Song } from '@/src/types/echoai';
import { useThemePalette } from '@/src/theme/useThemePalette';

type Track = {
  videoId: string;
  title: string;
  artist: string;
  artwork: string;
  duration: string;
};

export default function PlaylistScreen() {
  const p = useThemePalette();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const id = rawId ? decodeURIComponent(String(rawId)) : '';
  const { googleAccessToken } = useAuth();
  const { onPlayPlaylist } = useDashboard();

  const [title, setTitle] = useState('Playlist');
  const [thumb, setThumb] = useState('');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);

  const mapYtmSong = (s: any): Track => ({
    videoId: String(s.videoId ?? s.id ?? ''),
    title: String(s.title ?? s.name ?? ''),
    artist: String(s.artist ?? ''),
    artwork: String(s.artwork ?? s.thumbnailUrl ?? ''),
    duration: String(s.duration ?? '0:00'),
  });

  const mapYtItem = (t: any): Track => ({
    videoId: String(t.videoId ?? ''),
    title: String(t.title ?? ''),
    artist: String(t.artist ?? ''),
    artwork: String(t.thumbnailUrl ?? ''),
    duration: String(t.duration ?? '0:00'),
  });

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = (await apiYtPlaylist(id)) as any;
      if (data?.error) throw new Error(String(data.error));

      setTitle(String(data?.name ?? data?.title ?? 'Playlist'));
      const thumbs = data?.thumbnails;
      const lastThumb = Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1]?.url : '';
      setThumb(String(lastThumb ?? ''));

      const songs = Array.isArray(data?.songs)
        ? data.songs.map(mapYtmSong).filter((x: Track) => x.videoId)
        : [];

      if (songs.length > 0) {
        setTracks(songs);
        return;
      }

      if (googleAccessToken) {
        try {
          const items = await apiYoutubePlaylistItems(id);
          if (Array.isArray(items) && items.length > 0) {
            setTracks(items.map(mapYtItem).filter((x: Track) => x.videoId));
          }
        } catch {
          /* keep empty */
        }
      }
    } catch {
      setTracks([]);
    } finally {
      setLoading(false);
    }
  }, [id, googleAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const toSong = (t: Track): Song => ({
    id: t.videoId,
    title: t.title,
    artist: t.artist,
    artwork: t.artwork,
    duration: t.duration,
  });

  const playAll = () => {
    if (tracks.length === 0) return;
    const songs = tracks.map(toSong);
    void onPlayPlaylist(songs, 0);
  };

  const shufflePlay = () => {
    if (tracks.length === 0) return;
    const songs = tracks.map(toSong);
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
    void onPlayPlaylist(songs, 0);
  };

  return (
    <ScreenChrome>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
          <Text style={[styles.back, { color: p.tint }]}>‹ Back</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={p.tint} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.heroArt, { backgroundColor: p.muted }]}>
            {thumb ? (
              <Image source={{ uri: thumb }} style={styles.heroImg} />
            ) : (
              <Text style={{ fontSize: 56, color: p.mutedForeground, alignSelf: 'center', marginTop: 60 }}>♫</Text>
            )}
          </View>
          <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={styles.badgeText}>PLAYLIST</Text>
          </View>
          <Text style={[styles.plTitle, { color: p.foreground }]}>{title}</Text>
          <Text style={[styles.plMeta, { color: p.mutedForeground }]}>
            A curated experience, automatically synchronized to your Nexus library.
          </Text>

          <Pressable
            onPress={playAll}
            disabled={tracks.length === 0}
            style={[styles.playAll, { opacity: tracks.length ? 1 : 0.4 }]}>
            <FontAwesome name="play" size={18} color="#111" style={{ marginRight: 10 }} />
            <Text style={styles.playAllText}>Play All</Text>
          </Pressable>

          <Pressable
            onPress={shufflePlay}
            disabled={tracks.length === 0}
            style={[
              styles.shuffleBtn,
              { borderColor: p.glassBorder, opacity: tracks.length ? 1 : 0.4 },
            ]}>
            <FontAwesome name="random" size={16} color={p.foreground} style={{ marginRight: 10 }} />
            <Text style={[styles.shuffleText, { color: p.foreground }]}>Shuffle</Text>
          </Pressable>

          <View style={{ gap: 8, marginTop: 20, paddingBottom: 120 }}>
            {tracks.map((t, index) => (
              <Pressable
                key={t.videoId}
                onPress={() => {
                  const songs = tracks.map(toSong);
                  void onPlayPlaylist(songs, index);
                }}
                style={[styles.row, { backgroundColor: p.card, borderColor: p.glassBorder }]}>
                <Text style={[styles.idx, { color: p.mutedForeground }]}>{index + 1}</Text>
                <View style={[styles.mini, { backgroundColor: p.muted }]}>
                  {t.artwork ? (
                    <Image source={{ uri: t.artwork }} style={styles.miniImg} />
                  ) : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[styles.tTitle, { color: p.cardForeground }]}>
                    {t.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.tSub, { color: p.mutedForeground }]}>
                    {t.artist}
                  </Text>
                </View>
                <Text style={[styles.dur, { color: p.mutedForeground }]}>{t.duration}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 8, paddingBottom: 8 },
  backHit: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12 },
  back: { fontSize: 17, fontWeight: '700' },
  body: { paddingHorizontal: 20, paddingBottom: 32 },
  heroArt: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroImg: { width: '100%', height: '100%' },
  badge: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 12,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  plTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center', marginTop: 16 },
  plMeta: { textAlign: 'center', marginTop: 10, fontWeight: '500', fontSize: 14, lineHeight: 20, paddingHorizontal: 8 },
  playAll: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  playAllText: { color: '#111111', fontWeight: '800', fontSize: 17 },
  shuffleBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  shuffleText: { fontWeight: '800', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  idx: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '700' },
  mini: { width: 44, height: 44, borderRadius: 8, overflow: 'hidden' },
  miniImg: { width: '100%', height: '100%' },
  tTitle: { fontSize: 15, fontWeight: '700' },
  tSub: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  dur: { fontSize: 13, fontWeight: '600', marginLeft: 8 },
});
