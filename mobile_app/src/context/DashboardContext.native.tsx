import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import TrackPlayer, { Event, State, usePlaybackState, useProgress } from 'react-native-track-player';

import { apiGetAudioUrl } from '@/src/api/endpoints';
import { getApiBaseUrl } from '@/src/api/baseUrl';
import { fetchPipedAudioUrl } from '@/src/api/pipedAudio';
import { ensureTrackPlayer, type NexusTrack } from '@/src/player/trackPlayer';
import type { Song } from '@/src/types/echoai';
import { useSettings } from '@/src/context/SettingsContext';

type DashboardContextValue = {
  currentSong: Song | null;
  queueSongs: Song[];
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  setVolume: (v: number) => void;
  onTogglePlay: () => Promise<void>;
  onSeek: (t: number) => Promise<void>;
  onNext: () => Promise<void>;
  onPrev: () => Promise<void>;
  onSongClick: (song: Song, reset?: boolean) => Promise<void>;
  onPlayPlaylist: (songs: Song[], startIndex: number) => Promise<void>;
};

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

const STORAGE = {
  currentSong: 'nexus_current_song',
  queue: 'nexus_queue',
  volume: 'nexus_volume',
} as const;

/** Used when playing direct googlevideo URLs; proxied `/api/audio/stream` does not need YouTube headers. */
const STREAM_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function streamProxyUrl(videoId: string): string {
  const base = getApiBaseUrl().replace(/\/+$/, '');
  return `${base}/api/audio/stream?videoId=${encodeURIComponent(videoId)}`;
}

function toTrack(song: Song, url: string): NexusTrack {
  const proxied = url.includes('/api/audio/stream');
  return {
    id: song.id,
    url,
    title: song.title,
    artist: song.artist,
    artwork: song.artwork,
    videoId: song.id,
    userAgent: STREAM_USER_AGENT,
    // Next.js proxy serves transcoded WebM; hint helps ExoPlayer on some devices.
    ...(proxied ? { contentType: 'audio/webm' as const } : {}),
    // Proxied Next stream: simple UA. Direct CDN (API or Piped on-device): YouTube Referer helps ExoPlayer.
    headers: proxied
      ? {
          Accept: '*/*',
          'User-Agent': STREAM_USER_AGENT,
        }
      : {
          Referer: 'https://www.youtube.com/',
          Origin: 'https://www.youtube.com',
          'User-Agent': STREAM_USER_AGENT,
        },
  };
}

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();
  const playback = usePlaybackState();
  const progress = useProgress(250);

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
  const [volume, setVolumeState] = useState(0.9);
  const queueSongsRef = useRef<Song[]>([]);
  useEffect(() => {
    queueSongsRef.current = queueSongs;
  }, [queueSongs]);

  const isPlaying = playback.state === State.Playing;
  const currentTimeSec = progress.position;
  const durationSec = progress.duration;

  const volumeRef = useRef(volume);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    ensureTrackPlayer().catch((e) => {
      console.warn('[TrackPlayer] setup failed:', e);
    });
  }, []);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackError, (e) => {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message?: string }).message === 'string'
          ? (e as { message: string }).message
          : 'Playback failed. Rebuild a dev client (not Expo Go) if audio never starts.';
      Alert.alert('Playback error', msg);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const sub = TrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, async () => {
      const idx = await TrackPlayer.getActiveTrackIndex();
      if (idx == null || idx < 0) return;
      const next = queueSongsRef.current[idx];
      if (next) setCurrentSong(next);
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    void settings.defaultPlayMode;
  }, [settings.defaultPlayMode]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [songRaw, queueRaw, volRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE.currentSong),
          AsyncStorage.getItem(STORAGE.queue),
          AsyncStorage.getItem(STORAGE.volume),
        ]);

        if (!mounted) return;
        const songs: Song[] = queueRaw ? (JSON.parse(queueRaw) as Song[]) : [];
        if (songRaw) setCurrentSong(JSON.parse(songRaw) as Song);
        if (queueRaw) setQueueSongs(songs);
        if (volRaw) setVolumeState(Number(volRaw));
        // Do not preload Track Player here (Vercel proxy streams often fail or hang in headless
        // init). Restore queue on first play via onTogglePlay / onPlayPlaylist instead.
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE.currentSong, JSON.stringify(currentSong)).catch(() => {});
  }, [currentSong]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE.queue, JSON.stringify(queueSongs)).catch(() => {});
  }, [queueSongs]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE.volume, String(volume)).catch(() => {});
    TrackPlayer.setVolume(volume).catch(() => {});
  }, [volume]);

  const setVolume = useCallback((v: number) => {
    const next = Math.max(0, Math.min(1, v));
    setVolumeState(next);
  }, []);

  /**
   * 1) Piped on the device — often works when the server cannot extract URLs (e.g. Vercel without cookies).
   * 2) Next `/api/get-audio-url` (direct CDN when server extraction works).
   * 3) `/api/audio/stream` on Next (last resort).
   */
  const ensureSongIsPlayable = useCallback(async (song: Song): Promise<{ song: Song; url: string }> => {
    if (!song.id?.trim()) {
      throw new Error('Missing video id for this track.');
    }

    const piped = await fetchPipedAudioUrl(song.id);
    if (piped) {
      return { song, url: piped };
    }

    try {
      const { url } = await apiGetAudioUrl(song.id);
      if (url?.trim()) {
        return { song, url: url.trim() };
      }
    } catch {
      /* fall through to proxy */
    }

    return { song, url: streamProxyUrl(song.id) };
  }, []);

  /** Resolve URLs in order; skip tracks that fail (e.g. bad id) so one failure does not block playback. */
  const buildPlayableQueue = useCallback(async (songs: Song[]) => {
    const out: { song: Song; url: string }[] = [];
    let lastError = '';
    for (const s of songs) {
      try {
        out.push(await ensureSongIsPlayable(s));
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    return { playable: out, lastError };
  }, [ensureSongIsPlayable]);

  const onPlayPlaylist = useCallback(
    async (songs: Song[], startIndex: number) => {
      try {
        await ensureTrackPlayer();
        const { playable, lastError } = await buildPlayableQueue(songs);
        if (playable.length === 0) {
          throw new Error(
            lastError ||
              'Could not build playback URLs. Set EXPO_PUBLIC_API_BASE_URL to your Next app (e.g. Vercel URL or http://YOUR_LAN_IP:3000).'
          );
        }

        const tracks = playable.map((pl) => toTrack(pl.song, pl.url));
        const targetId = songs[Math.min(Math.max(0, startIndex), songs.length - 1)]?.id;
        let si = playable.findIndex((pl) => pl.song.id === targetId);
        if (si < 0) si = 0;

        await TrackPlayer.reset();
        await TrackPlayer.add(tracks);
        await TrackPlayer.skip(si);
        await TrackPlayer.setVolume(volumeRef.current);
        await TrackPlayer.play();

        setQueueSongs(playable.map((pl) => pl.song));
        setCurrentSong(playable[si]?.song ?? playable[0]?.song ?? null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Playback failed';
        Alert.alert('Playback', msg);
      }
    },
    [buildPlayableQueue]
  );

  const onSongClick = useCallback(
    async (song: Song, reset?: boolean) => {
      if (reset) {
        await onPlayPlaylist([song], 0);
        return;
      }

      try {
        await ensureTrackPlayer();
        const idx = queueSongs.findIndex((s) => s.id === song.id);
        if (idx >= 0) {
          await TrackPlayer.skip(idx);
          await TrackPlayer.play();
          setCurrentSong(song);
          return;
        }

        const { url } = await ensureSongIsPlayable(song);
        const nextIdx = queueSongs.length;
        await TrackPlayer.add([toTrack(song, url)]);
        await TrackPlayer.skip(nextIdx);
        await TrackPlayer.play();
        setQueueSongs((prev) => [...prev, song]);
        setCurrentSong(song);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Playback failed';
        Alert.alert('Playback', msg);
      }
    },
    [onPlayPlaylist, queueSongs, ensureSongIsPlayable]
  );

  const onTogglePlay = useCallback(async () => {
    await ensureTrackPlayer();
    const queue = await TrackPlayer.getQueue();
    if (queue.length === 0 && currentSong) {
      await onPlayPlaylist([currentSong], 0);
      return;
    }
    const state = await TrackPlayer.getState();
    if (state === State.Playing) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  }, [currentSong, onPlayPlaylist]);

  const onSeek = useCallback(async (t: number) => {
    await ensureTrackPlayer();
    await TrackPlayer.seekTo(Math.max(0, t));
  }, []);

  const onNext = useCallback(async () => {
    await ensureTrackPlayer();
    try {
      await TrackPlayer.skipToNext();
      await TrackPlayer.play();
    } catch {
      // ignore
    }
  }, []);

  const onPrev = useCallback(async () => {
    await ensureTrackPlayer();
    try {
      await TrackPlayer.skipToPrevious();
      await TrackPlayer.play();
    } catch {
      await TrackPlayer.seekTo(0);
    }
  }, []);

  const value = useMemo<DashboardContextValue>(
    () => ({
      currentSong,
      queueSongs,
      isPlaying,
      currentTimeSec,
      durationSec,
      volume,
      setVolume,
      onTogglePlay,
      onSeek,
      onNext,
      onPrev,
      onSongClick,
      onPlayPlaylist,
    }),
    [
      currentSong,
      queueSongs,
      isPlaying,
      currentTimeSec,
      durationSec,
      volume,
      setVolume,
      onTogglePlay,
      onSeek,
      onNext,
      onPrev,
      onSongClick,
      onPlayPlaylist,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

