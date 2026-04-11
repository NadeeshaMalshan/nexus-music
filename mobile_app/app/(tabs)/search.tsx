import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { ScreenChrome } from '@/src/components/echoai/ScreenChrome';
import { getApiBaseUrl } from '@/src/api/baseUrl';
import { apiSearch, type SearchType } from '@/src/api/endpoints';
import { ApiError } from '@/src/api/http';
import { useDashboard } from '@/src/context/DashboardContext';
import { useThemePalette } from '@/src/theme/useThemePalette';
import type { Song } from '@/src/types/echoai';

const CATEGORIES = ['Top', 'Songs', 'Artists', 'Albums', 'Playlists', 'Remixes'] as const;
type Category = (typeof CATEGORIES)[number];

type RawItem = {
  videoId?: string;
  title?: string;
  author?: string;
  duration?: string;
  thumbnail?: string;
  type?: string;
  id?: string;
  name?: string;
};

function categoryToType(cat: Category): SearchType {
  if (cat === 'Artists') return 'artists';
  if (cat === 'Playlists') return 'playlists';
  return 'songs';
}

function buildQuery(q: string, cat: Category): string {
  if (cat === 'Remixes') return `${q.trim()} remix`;
  return q.trim();
}

export default function SearchScreen() {
  const p = useThemePalette();
  const { onSongClick } = useDashboard();
  const [q, setQ] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('Top');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<RawItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    async (query: string, cat: Category) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setItems([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      const type = categoryToType(cat);
      const finalQ = buildQuery(trimmed, cat);
      try {
        const res = await apiSearch(finalQ, type);
        const list = Array.isArray((res as { items?: unknown }).items)
          ? ((res as { items: RawItem[] }).items ?? [])
          : [];
        setItems(list);
      } catch (e) {
        setItems([]);
        if (e instanceof ApiError) {
          setError(`${e.message} (${e.status})`);
        } else if (e instanceof TypeError && String(e.message).includes('fetch')) {
          setError(`Network error — API: ${getApiBaseUrl()}`);
        } else {
          setError(e instanceof Error ? e.message : 'Search failed');
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(q, activeCategory);
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, activeCategory, runSearch]);

  const mappedRows = useMemo(() => {
    return items.map((item, idx) => {
      if (item.type === 'ARTIST') {
        return {
          key: String(item.id ?? `a-${idx}`),
          kind: 'artist' as const,
          title: String(item.name ?? 'Artist'),
          subtitle: 'Artist',
          thumb: item.thumbnail ?? '',
          song: null as Song | null,
          browseId: String(item.id ?? ''),
        };
      }
      if (item.type === 'PLAYLIST') {
        return {
          key: String(item.id ?? `p-${idx}`),
          kind: 'playlist' as const,
          title: String(item.title ?? 'Playlist'),
          subtitle: `Playlist · ${item.author ?? ''}`,
          thumb: item.thumbnail ?? '',
          song: null as Song | null,
          playlistId: String(item.id ?? ''),
        };
      }
      const id = String(item.videoId ?? '');
      return {
        key: id || `s-${idx}`,
        kind: 'song' as const,
        title: String(item.title ?? 'Unknown'),
        subtitle: String(item.author ?? ''),
        thumb: String(item.thumbnail ?? ''),
        song: {
          id,
          title: String(item.title ?? ''),
          artist: String(item.author ?? ''),
          artwork: String(item.thumbnail ?? ''),
          duration: typeof item.duration === 'string' ? item.duration : undefined,
        } satisfies Song,
        duration: String(item.duration ?? ''),
      };
    });
  }, [items]);

  const onRowPress = (row: (typeof mappedRows)[number]) => {
    if (row.kind === 'song' && row.song?.id) void onSongClick(row.song, true);
    if (row.kind === 'artist' && 'browseId' in row && row.browseId)
      router.push(`/artist/${encodeURIComponent(row.title)}`);
    if (row.kind === 'playlist' && 'playlistId' in row && row.playlistId)
      router.push(`/playlists/${encodeURIComponent(row.playlistId)}`);
  };

  return (
    <ScreenChrome>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: p.foreground }]}>Search</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/home')}
            style={[styles.doneBtn, { backgroundColor: p.muted, borderColor: p.border }]}>
            <Text style={[styles.doneText, { color: p.tint }]}>Done</Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.searchBox,
            { backgroundColor: p.inputBackground, borderColor: p.border },
          ]}>
          <Text style={[styles.searchGlyph, { color: p.mutedForeground }]}>⌕</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Artists, Songs, Lyrics…"
            placeholderTextColor={p.mutedForeground}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => void runSearch(q, activeCategory)}
            style={[styles.input, { color: p.foreground }]}
          />
          <Pressable accessibilityLabel="Voice search" hitSlop={8} style={{ paddingHorizontal: 4 }}>
            <FontAwesome name="microphone" size={18} color={p.mutedForeground} />
          </Pressable>
          {q.length > 0 ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Text style={{ color: p.mutedForeground, fontSize: 18, paddingHorizontal: 6 }}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.map((cat) => {
            const on = activeCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => {
                  setActiveCategory(cat);
                  if (q.trim()) void runSearch(q, cat);
                }}
                style={[
                  styles.chip,
                  on
                    ? { backgroundColor: p.foreground, borderColor: p.foreground }
                    : { backgroundColor: p.muted, borderColor: p.border },
                ]}>
                <Text
                  style={[
                    styles.chipText,
                    { color: on ? p.background : p.mutedForeground },
                  ]}>
                  {cat.toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {__DEV__ ? (
          <Text style={[styles.debug, { color: p.mutedForeground }]} numberOfLines={1}>
            {getApiBaseUrl()}
          </Text>
        ) : null}

        {error ? (
          <Text selectable style={[styles.error, { color: p.destructive }]}>
            {error}
          </Text>
        ) : null}

        {loading ? <ActivityIndicator color={p.tint} style={{ marginVertical: 20 }} /> : null}

        {!q.trim() && !loading ? (
          <View style={[styles.curationCard, { borderColor: p.glassBorder, backgroundColor: p.card }]}>
            <View style={[styles.curationIcon, { backgroundColor: p.muted }]}>
              <FontAwesome name="magic" size={20} color={p.tint} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.curationTitle, { color: p.cardForeground }]}>Curation Studio</Text>
              <Text style={[styles.curationBody, { color: p.mutedForeground }]}>
                Browse millions of tracks or use Nexus Intelligence to discover the perfect setlist for your vibe.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ gap: 8, paddingBottom: 120 }}>
          {mappedRows.map((row) => (
            <Pressable
              key={row.key}
              onPress={() => onRowPress(row)}
              style={[styles.row, { backgroundColor: p.card, borderColor: p.glassBorder }]}>
              <View style={[styles.thumbWrap, { backgroundColor: p.muted }]}>
                {row.thumb ? (
                  <Image source={{ uri: row.thumb }} style={styles.thumb} />
                ) : (
                  <Text style={{ color: p.mutedForeground, alignSelf: 'center', marginTop: 18 }}>♪</Text>
                )}
              </View>
              <View style={styles.rowText}>
                <Text numberOfLines={2} style={[styles.rowTitle, { color: p.cardForeground }]}>
                  {row.title}
                </Text>
                <Text numberOfLines={1} style={[styles.rowSub, { color: p.mutedForeground }]}>
                  {row.subtitle}
                  {row.kind === 'song' && row.duration ? ` · ${row.duration}` : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pageTitle: { fontSize: 44, fontWeight: '900', letterSpacing: -1.4, flex: 1 },
  doneBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  doneText: { fontSize: 14, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 20,
  },
  searchGlyph: { fontSize: 20, marginRight: 10, fontWeight: '600' },
  input: { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: -0.3, paddingVertical: 4 },
  chips: { flexDirection: 'row', gap: 10, paddingBottom: 16, paddingRight: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  debug: { fontSize: 10, marginBottom: 8 },
  error: { marginBottom: 12, fontSize: 13 },
  curationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    marginBottom: 16,
  },
  curationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  curationTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  curationBody: { fontSize: 14, fontWeight: '500', marginTop: 6, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbWrap: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
  rowSub: { fontSize: 13, marginTop: 4, fontWeight: '500' },
});
