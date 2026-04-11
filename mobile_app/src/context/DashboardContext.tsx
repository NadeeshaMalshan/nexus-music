import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useSettings();

  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
  const [volume, setVolumeState] = useState(0.9);

  useEffect(() => {
    // Apply persisted/default mode in future; for now just keep parity.
    void settings.defaultPlayMode;
  }, [settings.defaultPlayMode]);

  // Persistence load
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
        if (songRaw) setCurrentSong(JSON.parse(songRaw) as Song);
        if (queueRaw) setQueueSongs(JSON.parse(queueRaw) as Song[]);
        if (volRaw) setVolumeState(Number(volRaw));
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Persistence save
  useEffect(() => {
    AsyncStorage.setItem(STORAGE.currentSong, JSON.stringify(currentSong)).catch(() => {});
  }, [currentSong]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE.queue, JSON.stringify(queueSongs)).catch(() => {});
  }, [queueSongs]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE.volume, String(volume)).catch(() => {});
  }, [volume]);

  const setVolume = (v: number) => {
    const next = Math.max(0, Math.min(1, v));
    setVolumeState(next);
  };

  // Web fallback: no native audio engine. The UI still renders for fast iteration.
  const onPlayPlaylist = async (songs: Song[], startIndex: number) => {
    setQueueSongs(songs);
    setCurrentSong(songs[startIndex] ?? songs[0] ?? null);
  };
  const onSongClick = async (song: Song, reset?: boolean) => {
    if (reset) return onPlayPlaylist([song], 0);
    setQueueSongs((prev) => (prev.some((s) => s.id === song.id) ? prev : [...prev, song]));
    setCurrentSong(song);
  };
  const onTogglePlay = async () => {};
  const onSeek = async (_t: number) => {};
  const onNext = async () => {};
  const onPrev = async () => {};

  const value = useMemo<DashboardContextValue>(
    () => ({
      currentSong,
      queueSongs,
      isPlaying: false,
      currentTimeSec: 0,
      durationSec: 0,
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
      volume,
    ]
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used within DashboardProvider');
  return ctx;
}

