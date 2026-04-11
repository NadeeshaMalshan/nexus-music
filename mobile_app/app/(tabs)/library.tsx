import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { apiYouTubeHistory, apiYouTubeLiked, apiYouTubePlaylists } from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthContext';
import { useDashboard } from '@/src/context/DashboardContext';
import type { Song } from '@/src/types/echoai';
import { useThemePalette } from '@/src/theme/useThemePalette';

type Tab = 'playlists' | 'history' | 'liked';

type PlRow = { id: string; title: string; thumbnailUrl: string; itemCount: number };
type TrackRow = { videoId: string; title: string; artist: string; thumb: string; duration: string };

function toSong(t: TrackRow): Song {
  return {
    id: t.videoId,
    title: t.title,
    artist: t.artist,
    artwork: t.thumb,
    duration: t.duration,
  };
}

type GridCell = { kind: 'liked'; count: number } | { kind: 'pl'; pl: PlRow };

export default function LibraryScreen() {
  const p = useThemePalette();
  const { width: winW } = useWindowDimensions();
  const { googleAccessToken, signIn } = useAuth();
  const { onSongClick, onPlayPlaylist } = useDashboard();

  const [tab, setTab] = useState<Tab>('playlists');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlists, setPlaylists] = useState<PlRow[]>([]);
  const [liked, setLiked] = useState<TrackRow[]>([]);
  const [history, setHistory] = useState<TrackRow[]>([]);
  const [histMeta, setHistMeta] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!googleAccessToken) return;
    setLoading(true);
    try {
      const [pRes, lRes, hRes] = await Promise.all([
        apiYouTubePlaylists(),
        apiYouTubeLiked(),
        apiYouTubeHistory(),
      ]);

      if (Array.isArray(pRes)) {
        setPlaylists(
          (pRes as any[]).map((x) => ({
            id: String(x.id),
            title: String(x.title ?? ''),
            thumbnailUrl: String(x.thumbnailUrl ?? ''),
            itemCount: Number(x.itemCount ?? 0),
          }))
        );
      }

      if (Array.isArray(lRes)) {
        setLiked(
          (lRes as any[]).map((t) => ({
            videoId: String(t.videoId ?? t.id ?? ''),
            title: String(t.title ?? ''),
            artist: String(t.artist ?? ''),
            thumb: String(t.thumbnailUrl ?? ''),
            duration: String(t.duration ?? ''),
          }))
        );
      }

      const h = hRes as { tracks?: any[]; source?: string };
      if (h && Array.isArray(h.tracks)) {
        setHistory(
          h.tracks.map((t) => ({
            videoId: String(t.videoId ?? ''),
            title: String(t.title ?? ''),
            artist: String(t.artist ?? ''),
            thumb: String(t.thumbnailUrl ?? ''),
            duration: String(t.duration ?? ''),
          }))
        );
        setHistMeta(
          h.source === 'youtube.ytm_browse'
            ? 'YouTube Music history'
            : h.source === 'youtube.mixed'
              ? 'YouTube Music · merged feed'
              : 'Recent music activity'
        );
      } else {
        setHistory([]);
        setHistMeta(null);
      }
    } catch {
      setPlaylists([]);
      setLiked([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [googleAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const f = filter.trim().toLowerCase();

  const plFiltered = useMemo(
    () => playlists.filter((x) => x.title.toLowerCase().includes(f)),
    [playlists, f]
  );
  const likedFiltered = useMemo(
    () =>
      liked.filter(
        (x) => x.title.toLowerCase().includes(f) || x.artist.toLowerCase().includes(f)
      ),
    [liked, f]
  );
  const histFiltered = useMemo(
    () =>
      history.filter(
        (x) => x.title.toLowerCase().includes(f) || x.artist.toLowerCase().includes(f)
      ),
    [history, f]
  );

  const gridGap = 12;
  const hPad = 20;
  const colW = Math.max(140, (winW - hPad * 2 - gridGap) / 2);

  const playlistGridRows = useMemo(() => {
    const cells: GridCell[] = [
      { kind: 'liked', count: liked.length },
      ...plFiltered.filter((x) => x.id !== 'LL').map((pl) => ({ kind: 'pl' as const, pl })),
    ];
    const rows: GridCell[][] = [];
    for (let i = 0; i < cells.length; i += 2) rows.push(cells.slice(i, i + 2));
    return rows;
  }, [plFiltered, liked.length]);

  if (!googleAccessToken) {
    return (
      <ScreenChrome>
        <View style={styles.center}>
          <View style={[styles.bigIcon, { backgroundColor: p.tint }]}>
            <Text style={styles.bigIconText}>♫</Text>
          </View>
          <Text style={[styles.signTitle, { color: p.foreground }]}>Your Music Library</Text>
          <Text style={[styles.signSub, { color: p.mutedForeground }]}>
            Connect Google to access playlists, liked songs, and history.
          </Text>
          <Pressable style={[styles.signBtn, { backgroundColor: p.foreground }]} onPress={() => void signIn()}>
            <Text style={[styles.signBtnText, { color: p.background }]}>Sign in with Google</Text>
          </Pressable>
        </View>
      </ScreenChrome>
    );
  }

  return (
    <ScreenChrome>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.libHeader}>
          <View>
            <Text style={[styles.libTitle, { color: p.foreground }]}>Library</Text>
            <Text style={[styles.libTag, { color: p.mutedForeground }]}>PERSONAL MUSIC ECOSYSTEM</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => Alert.alert('New playlist', 'Coming soon.')}
            style={[styles.actionBtn, { borderColor: p.border, backgroundColor: p.card }]}>
            <FontAwesome name="plus" size={16} color={p.foreground} />
            <Text style={[styles.actionBtnText, { color: p.foreground }]}>New Playlist</Text>
          </Pressable>
          <Pressable
            onPress={() => Alert.alert('AI Build', 'Coming soon.')}
            style={[styles.actionBtn, { borderColor: p.border, backgroundColor: p.card }]}>
            <FontAwesome name="magic" size={16} color={p.foreground} />
            <Text style={[styles.actionBtnText, { color: p.foreground }]}>AI Build</Text>
          </Pressable>
        </View>

        <View style={[styles.tabs, { backgroundColor: p.muted, borderColor: p.border }]}>
          {(['playlists', 'history', 'liked'] as Tab[]).map((t) => {
            const on = tab === t;
            const label = t === 'playlists' ? 'Playlists' : t === 'history' ? 'History' : 'Liked';
            return (
              <Pressable
                key={t}
                onPress={() => setTab(t)}
                style={[
                  styles.tabBtn,
                  on ? { backgroundColor: p.foreground } : { backgroundColor: 'transparent' },
                ]}>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: on ? p.background : p.mutedForeground },
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInner,
              { flex: 1, backgroundColor: p.inputBackground, borderColor: p.border },
            ]}>
            <FontAwesome name="search" size={16} color={p.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              value={filter}
              onChangeText={setFilter}
              placeholder="Search…"
              placeholderTextColor={p.mutedForeground}
              style={[styles.searchInput, { color: p.foreground }]}
            />
          </View>
          <Pressable
            onPress={() => Alert.alert('Filters', 'Coming soon.')}
            style={[styles.filterIconBtn, { backgroundColor: p.card, borderColor: p.border }]}>
            <FontAwesome name="sliders" size={18} color={p.foreground} />
          </Pressable>
        </View>

        {histMeta && tab === 'history' ? (
          <Text style={[styles.metaLine, { color: p.mutedForeground }]}>{histMeta}</Text>
        ) : null}

        {loading ? <ActivityIndicator color={p.tint} style={{ marginVertical: 20 }} /> : null}

        {tab === 'playlists' ? (
          <View style={{ paddingBottom: 120 }}>
            {playlistGridRows.map((pair, ri) => (
              <View key={`row-${ri}`} style={[styles.gridRow, { gap: gridGap, marginBottom: gridGap }]}>
                {pair.map((cell, ci) =>
                  cell.kind === 'liked' ? (
                    <Pressable
                      key={`liked-${ri}-${ci}`}
                      onPress={() => router.push(`/playlists/${encodeURIComponent('LL')}`)}
                      style={{ width: colW }}>
                      <LinearGradient
                        colors={['#a855f7', '#ec4899']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gridArt}>
                        <FontAwesome name="heart" size={40} color="#ffffff" />
                      </LinearGradient>
                      <Text numberOfLines={2} style={[styles.gridTitle, { color: p.foreground }]}>
                        Liked Songs
                      </Text>
                      <Text style={[styles.gridSub, { color: p.mutedForeground }]}>
                        {cell.count} TRACKS
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      key={cell.pl.id}
                      onPress={() => router.push(`/playlists/${encodeURIComponent(cell.pl.id)}`)}
                      style={{ width: colW }}>
                      <View
                        style={[
                          styles.gridArt,
                          {
                            backgroundColor: p.muted,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}>
                        {cell.pl.thumbnailUrl ? (
                          <Image source={{ uri: cell.pl.thumbnailUrl }} style={styles.gridImg} />
                        ) : (
                          <FontAwesome name="music" size={32} color={p.mutedForeground} />
                        )}
                      </View>
                      <Text numberOfLines={2} style={[styles.gridTitle, { color: p.foreground }]}>
                        {cell.pl.title}
                      </Text>
                      <Text style={[styles.gridSub, { color: p.mutedForeground }]}>
                        {cell.pl.itemCount} items
                      </Text>
                    </Pressable>
                  )
                )}
              </View>
            ))}
            {playlistGridRows.length === 0 && !loading ? (
              <Text style={{ color: p.mutedForeground }}>No playlists.</Text>
            ) : null}
          </View>
        ) : null}

        {tab === 'liked' || tab === 'history' ? (
          <View style={{ gap: 8, paddingBottom: 120 }}>
            {(tab === 'liked' ? likedFiltered : histFiltered).map((t) => (
              <Pressable
                key={t.videoId}
                onPress={() => void onSongClick(toSong(t), true)}
                onLongPress={() => {
                  const list = tab === 'liked' ? likedFiltered : histFiltered;
                  const songs = list.map(toSong);
                  const idx = songs.findIndex((s) => s.id === t.videoId);
                  if (idx >= 0) void onPlayPlaylist(songs, idx);
                }}
                style={[styles.trackRow, { backgroundColor: p.card, borderColor: p.glassBorder }]}>
                <View style={[styles.trackThumb, { backgroundColor: p.muted }]}>
                  {t.thumb ? (
                    <Image source={{ uri: t.thumb }} style={styles.trackImg} />
                  ) : (
                    <Text style={{ alignSelf: 'center', marginTop: 14, color: p.mutedForeground }}>♪</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={2} style={[styles.trackTitle, { color: p.cardForeground }]}>
                    {t.title}
                  </Text>
                  <Text numberOfLines={1} style={[styles.trackSub, { color: p.mutedForeground }]}>
                    {t.artist} · {t.duration}
                  </Text>
                </View>
              </Pressable>
            ))}
            {(tab === 'liked' ? likedFiltered : histFiltered).length === 0 && !loading ? (
              <Text style={{ color: p.mutedForeground }}>Nothing here yet.</Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  bigIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  bigIconText: { fontSize: 40, color: '#fff', fontWeight: '800' },
  signTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.6, textAlign: 'center' },
  signSub: { marginTop: 12, textAlign: 'center', maxWidth: 280, fontSize: 14, fontWeight: '500' },
  signBtn: { marginTop: 28, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  signBtnText: { fontWeight: '800', fontSize: 15 },
  libHeader: { marginBottom: 16 },
  libTitle: { fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  libTag: { marginTop: 8, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtnText: { fontSize: 14, fontWeight: '800' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 4 },
  filterIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 12,
    gap: 4,
  },
  gridRow: { flexDirection: 'row' },
  gridArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridImg: { width: '100%', height: '100%' },
  gridTitle: { marginTop: 10, fontSize: 15, fontWeight: '800', letterSpacing: -0.2, minHeight: 38 },
  gridSub: { marginTop: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  metaLine: { fontSize: 12, fontWeight: '600', marginBottom: 10 },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trackThumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden' },
  trackImg: { width: '100%', height: '100%' },
  trackTitle: { fontSize: 15, fontWeight: '700' },
  trackSub: { marginTop: 3, fontSize: 12, fontWeight: '500' },
});
