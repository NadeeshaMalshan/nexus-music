import { useCallback, useEffect, useState } from 'react';
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
import { apiAlbum } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import type { Song } from '@/src/types/echoai';
import { useThemePalette } from '@/src/theme/useThemePalette';

type AlbumSong = {
  videoId: string;
  title: string;
  artist: string;
  artwork: string;
  duration: string;
};

export default function AlbumScreen() {
  const p = useThemePalette();
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const albumId = rawId ? decodeURIComponent(String(rawId)) : '';
  const { onPlayPlaylist } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [albumTitle, setAlbumTitle] = useState('');
  const [artistName, setArtistName] = useState('');
  const [cover, setCover] = useState('');
  const [songs, setSongs] = useState<AlbumSong[]>([]);

  const load = useCallback(async () => {
    if (!albumId) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiAlbum(albumId)) as any;
      if (data?.error) {
        setError(String(data.error));
        return;
      }
      setAlbumTitle(String(data?.name ?? data?.title ?? 'Album'));
      const artist = data?.artist?.name ?? data?.artist ?? '';
      setArtistName(String(artist));
      const thumbs = data?.thumbnails;
      const u =
        Array.isArray(thumbs) && thumbs.length ? thumbs[thumbs.length - 1]?.url : '';
      setCover(String(u ?? ''));
      const list = Array.isArray(data?.songs) ? data.songs : [];
      setSongs(
        list.map((s: any) => ({
          videoId: String(s.videoId ?? s.id ?? ''),
          title: String(s.title ?? s.name ?? ''),
          artist: String(s.artist ?? artist ?? ''),
          artwork: String(s.artwork ?? ''),
          duration: String(s.duration ?? ''),
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [albumId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toSong = (s: AlbumSong): Song => ({
    id: s.videoId,
    title: s.title,
    artist: s.artist,
    artwork: s.artwork || cover,
    duration: s.duration,
  });

  const playAll = () => {
    if (songs.length === 0) return;
    void onPlayPlaylist(songs.map(toSong), 0);
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
      ) : error ? (
        <Text style={{ color: p.destructive, padding: 20 }}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.coverWrap, { backgroundColor: p.muted }]}>
            {cover ? (
              <Image source={{ uri: cover }} style={styles.coverImg} />
            ) : (
              <Text style={{ fontSize: 56, color: p.mutedForeground, alignSelf: 'center', marginTop: 60 }}>♫</Text>
            )}
          </View>
          <Text style={[styles.alTitle, { color: p.foreground }]}>{albumTitle}</Text>
          <Pressable onPress={() => artistName && router.push(`/artist/${encodeURIComponent(artistName)}`)}>
            <Text style={[styles.alArtist, { color: p.mutedForeground }]}>{artistName}</Text>
          </Pressable>
          <Text style={[styles.count, { color: p.mutedForeground }]}>{songs.length} songs</Text>

          <Pressable
            onPress={playAll}
            disabled={songs.length === 0}
            style={[styles.playAll, { backgroundColor: p.tint, opacity: songs.length ? 1 : 0.4 }]}>
            <Text style={styles.playAllText}>Play all</Text>
          </Pressable>

          <View style={{ gap: 8, marginTop: 20, paddingBottom: 120 }}>
            {songs.map((s, index) => (
              <Pressable
                key={s.videoId || String(index)}
                onPress={() => void onPlayPlaylist(songs.map(toSong), index)}
                style={[styles.row, { backgroundColor: p.card, borderColor: p.glassBorder }]}>
                <Text style={[styles.idx, { color: p.mutedForeground }]}>{index + 1}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[styles.sTitle, { color: p.cardForeground }]}>
                    {s.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.sSub, { color: p.mutedForeground }]}>
                    {s.duration}
                  </Text>
                </View>
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
  coverWrap: {
    alignSelf: 'center',
    width: 220,
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
  },
  coverImg: { width: '100%', height: '100%' },
  alTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5, textAlign: 'center' },
  alArtist: { textAlign: 'center', marginTop: 10, fontSize: 16, fontWeight: '600' },
  count: { textAlign: 'center', marginTop: 6, fontSize: 14, fontWeight: '500' },
  playAll: {
    marginTop: 20,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 999,
  },
  playAllText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  idx: { width: 22, textAlign: 'center', fontWeight: '700', fontSize: 13 },
  sTitle: { fontSize: 15, fontWeight: '700' },
  sSub: { fontSize: 12, marginTop: 3 },
});
