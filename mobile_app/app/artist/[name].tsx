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
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { apiArtist } from '@/src/api/endpoints';
import { useDashboard } from '@/src/context/DashboardContext';
import type { Song } from '@/src/types/echoai';
import { useThemePalette } from '@/src/theme/useThemePalette';

type TopTrack = {
  videoId: string;
  name: string;
  thumbnail: string;
  duration: string;
};

type AlbumRef = { id: string; name: string; image: string; year?: number };

export default function ArtistScreen() {
  const p = useThemePalette();
  const { name: rawName } = useLocalSearchParams<{ name: string }>();
  const artistName = rawName ? decodeURIComponent(String(rawName)) : '';
  const { onSongClick, onPlayPlaylist } = useDashboard();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState('');
  const [followers, setFollowers] = useState('');
  const [tracks, setTracks] = useState<TopTrack[]>([]);
  const [albums, setAlbums] = useState<AlbumRef[]>([]);

  const load = useCallback(async () => {
    if (!artistName) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await apiArtist(artistName)) as any;
      if (data?.error) {
        setError(String(data.error));
        return;
      }
      setImage(String(data?.image ?? ''));
      setFollowers(String(data?.followers ?? ''));
      const top = Array.isArray(data?.topTracks) ? data.topTracks : [];
      setTracks(
        top.map((t: any) => ({
          videoId: String(t.videoId ?? ''),
          name: String(t.name ?? ''),
          thumbnail: String(t.thumbnail ?? t.albumArt ?? ''),
          duration: String(t.duration ?? ''),
        }))
      );
      const al = Array.isArray(data?.albums) ? data.albums : [];
      setAlbums(
        al.map((a: any) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          image: String(a.image ?? ''),
          year: a.year,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [artistName]);

  useEffect(() => {
    void load();
  }, [load]);

  const toSong = (t: TopTrack): Song => ({
    id: t.videoId,
    title: t.name,
    artist: artistName,
    artwork: t.thumbnail,
    duration: t.duration,
  });

  const playAll = () => {
    const songs = tracks.filter((x) => x.videoId).map(toSong);
    if (songs.length) void onPlayPlaylist(songs, 0);
  };

  const shuffleAll = () => {
    const songs = tracks.filter((x) => x.videoId).map(toSong);
    for (let i = songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [songs[i], songs[j]] = [songs[j], songs[i]];
    }
    if (songs.length) void onPlayPlaylist(songs, 0);
  };

  return (
    <ScreenChrome>
      {loading ? (
        <ActivityIndicator color={p.tint} style={{ marginTop: 40 }} />
      ) : error ? (
        <Text style={{ color: p.destructive, padding: 20 }}>{error}</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            {image ? (
              <Image source={{ uri: image }} style={styles.heroImg} />
            ) : (
              <View style={[styles.heroImg, { backgroundColor: p.muted, alignItems: 'center', justifyContent: 'center' }]}>
                <FontAwesome name="user" size={56} color={p.mutedForeground} />
              </View>
            )}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.92)']}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              onPress={() => router.back()}
              hitSlop={14}
              style={[styles.backFab, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
              <FontAwesome name="chevron-left" size={18} color="#fff" />
            </Pressable>
            <View style={styles.heroText}>
              <Text style={styles.heroName} numberOfLines={2}>
                {artistName.toUpperCase()}
              </Text>
              {followers ? <Text style={styles.heroMeta}>{followers}</Text> : null}
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              onPress={playAll}
              disabled={tracks.length === 0}
              style={[
                styles.playPill,
                { backgroundColor: p.playAccent, opacity: tracks.length ? 1 : 0.45 },
              ]}>
              <FontAwesome name="play" size={16} color="#111" style={{ marginRight: 8 }} />
              <Text style={styles.playPillText}>Play</Text>
            </Pressable>
            <Pressable
              onPress={shuffleAll}
              disabled={tracks.length === 0}
              style={[
                styles.shufflePill,
                { borderColor: p.glassBorder, opacity: tracks.length ? 1 : 0.45 },
              ]}>
              <FontAwesome name="random" size={15} color={p.foreground} style={{ marginRight: 8 }} />
              <Text style={[styles.shufflePillText, { color: p.foreground }]}>Shuffle</Text>
            </Pressable>
          </View>

          {albums.length > 0 ? (
            <>
              <Text style={[styles.section, { color: p.foreground }]}>Albums</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hShelf}>
                {albums.map((a) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/album/${encodeURIComponent(a.id)}`)}
                    style={styles.albumCard}>
                    <View style={[styles.albumArt, { backgroundColor: p.muted }]}>
                      {a.image ? (
                        <Image source={{ uri: a.image }} style={styles.albumImg} />
                      ) : null}
                    </View>
                    <Text numberOfLines={2} style={[styles.albumName, { color: p.foreground }]}>
                      {a.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={[styles.section, { color: p.foreground }]}>Top songs</Text>
          <View style={{ gap: 8, paddingBottom: 120 }}>
            {tracks.map((t, index) => (
              <Pressable
                key={t.videoId || String(index)}
                onPress={() => {
                  const songs = tracks.filter((x) => x.videoId).map(toSong);
                  const i = songs.findIndex((s) => s.id === t.videoId);
                  if (i >= 0) void onPlayPlaylist(songs, i);
                  else void onSongClick(toSong(t), true);
                }}
                style={[styles.row, { backgroundColor: p.card, borderColor: p.glassBorder }]}>
                <Text style={[styles.rank, { color: p.mutedForeground }]}>{index + 1}</Text>
                <View style={[styles.tthumb, { backgroundColor: p.muted }]}>
                  {t.thumbnail ? <Image source={{ uri: t.thumbnail }} style={styles.timg} /> : null}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[styles.ttitle, { color: p.cardForeground }]}>
                    {t.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.tsub, { color: p.mutedForeground }]}>
                    {artistName}
                  </Text>
                </View>
                <Text style={[styles.tdur, { color: p.mutedForeground }]}>{t.duration}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 32 },
  hero: {
    height: 300,
    width: '100%',
    position: 'relative',
    marginBottom: 20,
  },
  heroImg: { width: '100%', height: '100%' },
  backFab: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { position: 'absolute', left: 20, right: 20, bottom: 22 },
  heroName: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  heroMeta: { marginTop: 8, fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.75)' },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  playPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
  },
  playPillText: { fontSize: 16, fontWeight: '800', color: '#111' },
  shufflePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  shufflePillText: { fontSize: 16, fontWeight: '800' },
  section: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 24,
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  hShelf: { gap: 14, paddingRight: 8, paddingHorizontal: 20 },
  albumCard: { width: 120 },
  albumArt: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  albumImg: { width: '100%', height: '100%' },
  albumName: { fontSize: 13, fontWeight: '700' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 20,
  },
  rank: { width: 24, textAlign: 'center', fontWeight: '800' },
  tthumb: { width: 48, height: 48, borderRadius: 8, overflow: 'hidden' },
  timg: { width: '100%', height: '100%' },
  ttitle: { fontSize: 15, fontWeight: '700' },
  tsub: { fontSize: 12, marginTop: 3 },
  tdur: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
});
