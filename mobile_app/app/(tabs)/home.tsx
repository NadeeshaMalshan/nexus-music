import { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import {
  apiRecommendations,
  apiYouTubePlaylists,
} from '@/src/api/endpoints';
import { useAuth } from '@/src/auth/AuthContext';
import { useDashboard } from '@/src/context/DashboardContext';
import type { Song } from '@/src/types/echoai';
import { useThemePalette } from '@/src/theme/useThemePalette';

type ForYouRec = {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  reason?: string;
};

type PlaylistRow = {
  id: string;
  title: string;
  thumbnailUrl: string;
  itemCount: number;
};

function shelfTitleColor(p: ReturnType<typeof useThemePalette>) {
  return p.foreground;
}

export default function HomeScreen() {
  const p = useThemePalette();
  const { googleAccessToken } = useAuth();
  const { currentSong, queueSongs, onSongClick } = useDashboard();

  const [forYou, setForYou] = useState<ForYouRec[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [plLoading, setPlLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchForYou = useCallback(async () => {
    setForYouLoading(true);
    try {
      const historyStrings =
        queueSongs.length > 0
          ? queueSongs.slice(0, 10).map((s) => `${s.title} by ${s.artist}`)
          : ['Top Hits 2024'];
      const res = (await apiRecommendations({
        recentTrackId: currentSong?.id ?? null,
        userHistory: historyStrings,
      })) as { recommendations?: ForYouRec[] };
      const list = Array.isArray(res.recommendations) ? res.recommendations : [];
      setForYou(list.filter((x) => x.youtubeId && x.title));
    } catch {
      setForYou([]);
    } finally {
      setForYouLoading(false);
    }
  }, [currentSong?.id, queueSongs]);

  const fetchPlaylists = useCallback(async () => {
    if (!googleAccessToken) {
      setPlaylists([]);
      return;
    }
    setPlLoading(true);
    try {
      const raw = await apiYouTubePlaylists();
      const arr = Array.isArray(raw) ? (raw as any[]) : [];
      setPlaylists(
        arr.slice(0, 14).map((x) => ({
          id: String(x.id),
          title: String(x.title ?? 'Playlist'),
          thumbnailUrl: String(x.thumbnailUrl ?? ''),
          itemCount: Number(x.itemCount ?? 0),
        }))
      );
    } catch {
      setPlaylists([]);
    } finally {
      setPlLoading(false);
    }
  }, [googleAccessToken]);

  useEffect(() => {
    void fetchForYou();
  }, [fetchForYou]);

  useEffect(() => {
    void fetchPlaylists();
  }, [fetchPlaylists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchForYou(), fetchPlaylists()]);
    setRefreshing(false);
  }, [fetchForYou, fetchPlaylists]);

  const toSong = (t: ForYouRec): Song => ({
    id: t.youtubeId,
    title: t.title,
    artist: t.artist,
    artwork: t.thumbnail,
    duration: t.duration,
  });

  const playForYou = (t: ForYouRec) => void onSongClick(toSong(t), true);

  const cardW = 168;

  const headerSubtitle = useMemo(
    () => ({ color: p.mutedForeground, fontWeight: '600' as const }),
    [p.mutedForeground]
  );

  return (
    <ScreenChrome>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.tint} />}
        showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={[styles.heroTitle, { color: shelfTitleColor(p) }]}>Listen Now</Text>
          <Text style={[styles.heroSub, headerSubtitle]}>Personalized for you</Text>
        </View>

        <View style={styles.shelfHead}>
          <Text style={[styles.shelfTitle, { color: shelfTitleColor(p) }]}>For You</Text>
          <Pressable onPress={() => void fetchForYou()} hitSlop={12} accessibilityLabel="Refresh recommendations">
            <FontAwesome name="refresh" size={20} color={p.mutedForeground} />
          </Pressable>
        </View>

        {forYouLoading ? (
          <ActivityIndicator color={p.tint} style={{ marginVertical: 24 }} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.hRow}>
            {forYou.map((item, i) => (
              <Pressable key={`${item.youtubeId}-${i}`} style={[styles.card, { width: cardW }]} onPress={() => playForYou(item)}>
                <View style={[styles.cardArtWrap, { backgroundColor: p.muted }]}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.cardArt} />
                  ) : (
                    <View style={[styles.cardArt, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: p.mutedForeground }}>♪</Text>
                    </View>
                  )}
                  {i === 0 ? (
                    <View style={styles.playOverlay} pointerEvents="none">
                      <View style={[styles.playFab, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                        <FontAwesome name="play" size={26} color="#fff" style={{ marginLeft: 4 }} />
                      </View>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={[styles.cardTitle, { color: p.foreground }]}>
                  {item.title}
                </Text>
                <Text numberOfLines={1} style={[styles.cardArtist, { color: p.mutedForeground }]}>
                  {item.artist}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {googleAccessToken ? (
          <>
            <View style={[styles.shelfHead, { marginTop: 28 }]}>
              <Text style={[styles.shelfTitle, { color: shelfTitleColor(p) }]}>Your Playlists</Text>
              {plLoading ? (
                <ActivityIndicator color={p.tint} />
              ) : (
                <Pressable onPress={() => void fetchPlaylists()} hitSlop={12} accessibilityLabel="Refresh playlists">
                  <FontAwesome name="refresh" size={20} color={p.mutedForeground} />
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {playlists.length === 0 && !plLoading ? (
                <Text style={{ color: p.mutedForeground, paddingHorizontal: 4 }}>No playlists yet.</Text>
              ) : (
                playlists.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.card, { width: cardW }]}
                    onPress={() => router.push(`/playlists/${encodeURIComponent(item.id)}`)}>
                    <View style={[styles.cardArtWrap, { backgroundColor: p.muted }]}>
                      {item.thumbnailUrl ? (
                        <Image source={{ uri: item.thumbnailUrl }} style={styles.cardArt} />
                      ) : (
                        <View style={[styles.cardArt, { alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: p.mutedForeground, fontSize: 28 }}>♫</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={2} style={[styles.cardTitle, { color: p.foreground }]}>
                      {item.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.cardArtist, { color: p.mutedForeground }]}>
                      {item.itemCount} tracks · YouTube Library
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24, paddingHorizontal: 20 },
  hero: { marginBottom: 28, marginTop: 8 },
  heroTitle: { fontSize: 40, fontWeight: '900', letterSpacing: -1.2, lineHeight: 44 },
  heroSub: { fontSize: 18, marginTop: 10, letterSpacing: -0.3 },
  shelfHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  shelfTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  hRow: { gap: 16, paddingBottom: 8, paddingRight: 8 },
  card: { marginRight: 4 },
  cardArtWrap: {
    borderRadius: 22,
    overflow: 'hidden',
    aspectRatio: 1,
    width: '100%',
    position: 'relative',
  },
  cardArt: { width: '100%', height: '100%' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { marginTop: 12, fontSize: 16, fontWeight: '700', letterSpacing: -0.3, minHeight: 40 },
  cardArtist: { marginTop: 4, fontSize: 13, fontWeight: '500' },
});
