"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Song } from "@/components/echoai/types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { useSession } from "next-auth/react";
import { useArtworkColors } from "@/lib/useArtworkColors";

type AudioPayload = {
  audioUrl: string;
  trackName: string;
  artist: string;
  coverArt: string;
  videoId: string;
};

type LyricsPayload = {
  success: boolean;
  lyrics: {
    isSynced: boolean;
    content: string | null;
    source: "LRCLIB" | "Lyrics.ovh" | null;
  };
  geniusData: {
    found: boolean;
    songId: number | null;
    url: string | null;
    thumbnail: string | null;
  };
};

type DashboardContextType = {
  // Player State
  audioData: AudioPayload | null;
  queueSongs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  currentTimeSec: number;
  durationSec: number;
  volume: number;
  lyricsData: LyricsPayload | null;
  lyricsLoading: boolean;
  knowFacts: string[];
  knowLoading: boolean;
  likedSongs: Set<string>;
  upNextQueue: Song[];
  playedHistory: string[];
  aiLoading: boolean;

  // View State (Shared but UI-specific)
  isRightSidebarOpen: boolean;
  isExpandedPlayerOpen: boolean;
  selectedPlaylist: YouTubePlaylist | null;
  palette: { primary: string; secondary: string; accent: string };

  // Actions
  setIsPlaying: (playing: boolean) => void;
  setCurrentTimeSec: (time: number) => void;
  setCurrentSong: (song: Song | null) => void;
  setQueueSongs: (songs: Song[]) => void;
  setVolume: (volume: number) => void;
  setIsRightSidebarOpen: (open: boolean) => void;
  setIsExpandedPlayerOpen: (open: boolean) => void;
  setSelectedPlaylist: (playlist: YouTubePlaylist | null) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSongClick: (song: Song) => void;
  onRateSong: (songId: string, rating: "like" | "none") => Promise<void>;
  onRemoveFromQueue: (index: number) => void;
  onRemoveFromUpNext: (index: number) => void;
  onReorderQueue: (newQueue: Song[]) => void;
  onAddToQueue: (song: Song) => void;
  onPlayNext: (song: Song) => void;
  
  // Refs
  ytPlayerRef: React.RefObject<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
  } | null>;
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  const ytPlayerRef = useRef<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
  } | null>(null);
  
  const playerReadyRef = useRef(false);
  const progressIntervalRef = useRef<number | null>(null);
  const lastTimeBucketRef = useRef(-1);
  const playerElementId = "echoai-youtube-player";

  // State
  const [audioData, setAudioData] = useState<AudioPayload | null>(null);
  const audioCacheRef = useRef<Record<string, AudioPayload>>({});
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [lastSeedFetched, setLastSeedFetched] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(70);
  const [lyricsData, setLyricsData] = useState<LyricsPayload | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [playedHistory, setPlayedHistory] = useState<string[]>([]);
  const [upNextQueue, setUpNextQueue] = useState<Song[]>([]);
  const [knowFacts, setKnowFacts] = useState<string[]>([]);
  const [knowLoading, setKnowLoading] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());

  // Palette handling
  const effectiveArtwork = useMemo(() => audioData?.coverArt || currentSong?.artwork || null, [audioData, currentSong]);
  const palette = useArtworkColors(effectiveArtwork);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--art-primary", palette.primary);
    root.style.setProperty("--art-secondary", palette.secondary);
    root.style.setProperty("--art-accent", palette.accent);
  }, [palette]);

  // Fetch liked songs
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/youtube/liked")
        .then((res) => res.json())
        .then((tracks) => {
          if (Array.isArray(tracks)) {
            const ids = new Set(tracks.map((t: any) => t.videoId));
            setLikedSongs(ids);
          }
        })
        .catch((err) => console.error("Error fetching liked songs:", err));
    }
  }, [status]);

  const audioQuery = useMemo(() => {
    if (!currentSong) return "";
    return `${currentSong.artist} ${currentSong.title}`.trim();
  }, [currentSong]);

  // Audio loading logic
  useEffect(() => {
    if (!audioQuery) {
      setAudioData(null);
      return;
    }
    const controller = new AbortController();
    async function loadAudioMeta() {
      if (audioCacheRef.current[audioQuery]) {
        const payload = audioCacheRef.current[audioQuery];
        setAudioData(payload);
        if (ytPlayerRef.current && playerReadyRef.current) {
          ytPlayerRef.current.loadVideoById(payload.videoId);
        }
        return;
      }
      setAudioData(null);
      try {
        const response = await fetch(`/api/audio?query=${encodeURIComponent(audioQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to fetch audio metadata");
        const payload = (await response.json()) as AudioPayload;
        audioCacheRef.current[audioQuery] = payload;
        setAudioData(payload);
        if (ytPlayerRef.current && playerReadyRef.current) {
          ytPlayerRef.current.loadVideoById(payload.videoId);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load unified audio payload:", error);
          setAudioData(null);
        }
      }
    }
    loadAudioMeta();
    return () => controller.abort();
  }, [audioQuery]);

  // Lyrics loading logic
  useEffect(() => {
    if (!currentSong) {
      setLyricsData(null);
      return;
    }
    const track = currentSong.title?.trim();
    const artist = currentSong.artist?.trim();
    if (!track || !artist) {
      setLyricsData(null);
      return;
    }
    const duration = youtubeTimestampToSeconds(currentSong.duration);
    const durationQuery = duration != null ? `&duration=${encodeURIComponent(String(Math.round(duration)))}` : "";

    const controller = new AbortController();
    async function loadLyrics() {
      setLyricsLoading(true);
      try {
        const response = await fetch(
          `/api/lyrics?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}${durationQuery}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (!response.ok) throw new Error("Failed to fetch lyrics");
        const payload = (await response.json()) as LyricsPayload;
        setLyricsData(payload);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load lyrics payload:", error);
          setLyricsData(null);
        }
      } finally {
        setLyricsLoading(false);
      }
    }
    void loadLyrics();
    return () => controller.abort();
  }, [currentSong]);

  // Track session played history
  useEffect(() => {
    if (currentSong) {
      const track = `${currentSong.title} by ${currentSong.artist}`;
      setPlayedHistory(prev => {
        if (prev.includes(track)) return prev;
        return [track, ...prev].slice(0, 5);
      });
    }
  }, [currentSong]);

  // AI Queue and Up Next logic
  useEffect(() => {
    if (!currentSong) return;
    const currentSeed = `${currentSong.artist} - ${currentSong.title}`;
    if (currentSeed === lastSeedFetched) return;

    async function fetchAiNextSongs() {
      setAiLoading(true);
      try {
        const recentQueue = queueSongs.slice(-4).map((s) => ({ title: s.title, artist: s.artist }));
        const userHistory = [`${currentSong!.title} by ${currentSong!.artist}`, ...recentQueue.map(s => `${s.title} by ${s.artist}`)];
        const recRes = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentTrackId: currentSong!.id, userHistory }),
        });
        if (!recRes.ok) throw new Error(`API error ${recRes.status}`);
        const recData = await recRes.json();
        const recs = (recData.recommendations || []).slice(0, 5);
        const resolvedSongs: Song[] = recs.map((rec: any) => ({
          id: rec.youtubeId,
          title: rec.title,
          artist: rec.artist,
          artwork: rec.thumbnail,
          color: palette.accent,
        }));
        if (resolvedSongs.length > 0) {
          setQueueSongs((prev) => {
            const existingIds = new Set(prev.map((s) => s.id));
            const newSongs = resolvedSongs.filter((s) => !existingIds.has(s.id));
            return [...prev, ...newSongs];
          });
        }
        setLastSeedFetched(currentSeed);
      } catch (err) {
        console.error("AI Queue Error:", err);
      } finally {
        setAiLoading(false);
      }
    }
    void fetchAiNextSongs();

    async function fetchUpNext() {
      try {
        const res = await fetch(`/api/queue?videoId=${currentSong!.id}`);
        if (!res.ok) throw new Error("Queue API failed");
        const data = await res.json();
        const tracks: Song[] = (data.queue || []).map((t: any) => ({
          id: t.youtubeId,
          title: t.title,
          artist: t.artist,
          artwork: t.thumbnail,
          duration: t.duration,
          color: palette.accent
        }));
        setUpNextQueue(tracks);
      } catch (err) {
        console.error("Up Next Fetch Error:", err);
      }
    }
    void fetchUpNext();
  }, [currentSong, lastSeedFetched, palette.accent, queueSongs]);

  // Facts logic
  useEffect(() => {
    if (!currentSong) {
      setKnowFacts([]);
      return;
    }
    const track = currentSong.title?.trim();
    const artist = currentSong.artist?.trim();
    const videoId = currentSong.id;
    if (!track || !artist || !videoId) return;

    const controller = new AbortController();
    async function loadKnowFacts() {
      setKnowLoading(true);
      try {
        const response = await fetch(
          `/api/know?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}&videoId=${encodeURIComponent(videoId)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (response.ok) {
          const facts = await response.json();
          setKnowFacts(Array.isArray(facts) ? facts : []);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("Failed to load know facts:", err);
      } finally {
        setKnowLoading(false);
      }
    }
    void loadKnowFacts();
    return () => controller.abort();
  }, [currentSong]);

  // YouTube Script & Player initialization - Only run once on mount
  useEffect(() => {
    const w = window as any;
    const initPlayer = () => {
      if (!w.YT?.Player || ytPlayerRef.current) return;
      ytPlayerRef.current = new w.YT.Player(playerElementId, {
        height: "0",
        width: "0",
        videoId: "", // Empty initially, will be loaded via logic
        playerVars: { controls: 0, modestbranding: 1, rel: 0 },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = window.setInterval(() => {
              const player = ytPlayerRef.current;
              if (!player || !playerReadyRef.current) return;
              const current = player.getCurrentTime();
              const duration = player.getDuration();
              if (Number.isFinite(current)) {
                const bucket = Math.floor(current * 5);
                if (bucket !== lastTimeBucketRef.current) {
                  lastTimeBucketRef.current = bucket;
                  setCurrentTimeSec(current);
                }
              }
              if (Number.isFinite(duration) && duration > 0) setDurationSec(duration);
            }, 250);
            ytPlayerRef.current?.setVolume(volume);
          },
          onStateChange: (event: any) => {
            if (event.data === 1) setIsPlaying(true);
            else if (event.data === 2) setIsPlaying(false);
            else if (event.data === 0) onNext();
          },
        },
      });
    };

    if (w.YT?.Player) initPlayer();
    else {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.body.appendChild(script);
      w.onYouTubeIframeAPIReady = initPlayer;
    }
    return () => { if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current); };
  }, []); // Run only once

  // Separate effect to load video when videoId changes
  useEffect(() => {
    if (ytPlayerRef.current && playerReadyRef.current && audioData?.videoId) {
      ytPlayerRef.current.loadVideoById(audioData.videoId);
    }
  }, [audioData?.videoId]);

  // Handlers
  const onTogglePlay = useCallback(() => {
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (!isPlaying) {
      player.playVideo();
      setIsPlaying(true);
    } else {
      player.pauseVideo();
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const onNext = useCallback(() => {
    let nextSong: Song | null = null;
    if (queueSongs.length > 0) {
      if (currentSong && queueSongs[0].id === currentSong.id) {
        if (queueSongs.length > 1) {
          nextSong = queueSongs[1];
          setQueueSongs((prev) => prev.slice(1));
        }
      } else {
        nextSong = queueSongs[0];
      }
    }
    if (nextSong) {
      onSongClick(nextSong);
      return;
    }
    if (upNextQueue.length > 0) {
      const next = upNextQueue[0];
      setUpNextQueue((prev) => prev.slice(1));
      onSongClick(next);
      return;
    }
    setIsPlaying(false);
  }, [currentSong, queueSongs, upNextQueue]);

  const onPrev = useCallback(() => {
    if (queueSongs.length === 0) return;
    let idx = -1;
    if (currentSong) idx = queueSongs.findIndex((s) => s.id === currentSong.id);
    if (idx <= 0) {
      onSeek(0);
      return;
    }
    onSongClick(queueSongs[idx - 1]);
  }, [currentSong, queueSongs]);

  const onSongClick = useCallback((song: Song) => {
    setCurrentSong(song);
    setCurrentTimeSec(0);
    setIsPlaying(true);
    setQueueSongs((prev) => {
      if (prev.some((q) => q.id === song.id)) return prev;
      return [song];
    });
  }, []);

  const onSeek = useCallback((nextTimeSec: number) => {
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current || !Number.isFinite(nextTimeSec)) return;
    const safeDuration = durationSec > 0 ? durationSec : (youtubeTimestampToSeconds(currentSong?.duration ?? "") ?? 0);
    const clamped = Math.max(0, Math.min(nextTimeSec, safeDuration || nextTimeSec));
    player.seekTo(clamped, true);
    setCurrentTimeSec(clamped);
  }, [durationSec, currentSong?.duration]);

  const onRateSong = useCallback(async (songId: string, rating: "like" | "none") => {
    if (!session?.user) return;
    const targetId = (songId === currentSong?.id && audioData?.videoId) ? audioData.videoId : songId;
    setLikedSongs((prev) => {
      const next = new Set(prev);
      if (rating === "like") next.add(targetId); else next.delete(targetId);
      return next;
    });
    try {
      const res = await fetch("/api/youtube/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: targetId, rating }),
      });
      if (!res.ok) throw new Error("Failed to rate song");
    } catch (err) {
      setLikedSongs((prev) => {
        const next = new Set(prev);
        if (rating === "like") next.delete(targetId); else next.add(targetId);
        return next;
      });
    }
  }, [session?.user, currentSong?.id, audioData?.videoId]);

  const value = useMemo(() => ({
    audioData,
    queueSongs,
    currentSong,
    isPlaying,
    currentTimeSec,
    durationSec,
    volume,
    lyricsData,
    lyricsLoading,
    knowFacts,
    knowLoading,
    likedSongs,
    upNextQueue,
    playedHistory,
    aiLoading,
    isRightSidebarOpen,
    isExpandedPlayerOpen,
    selectedPlaylist,
    palette,
    setIsPlaying,
    setCurrentTimeSec,
    setCurrentSong,
    setQueueSongs,
    setVolume,
    setIsRightSidebarOpen,
    setIsExpandedPlayerOpen,
    setSelectedPlaylist,
    onTogglePlay,
    onNext,
    onPrev,
    onSeek,
    onSongClick,
    onRateSong,
    onRemoveFromQueue: (index: number) => setQueueSongs(prev => prev.filter((_, i) => i !== index)),
    onRemoveFromUpNext: (index: number) => setUpNextQueue(prev => prev.filter((_, i) => i !== index)),
    onReorderQueue: setQueueSongs,
    onAddToQueue: (song: Song) => {
      setQueueSongs(prev => prev.some(s => s.id === song.id) ? prev : [...prev, song]);
      if (!currentSong) onSongClick(song);
    },
    onPlayNext: (song: Song) => {
      setQueueSongs(prev => [song, ...prev.filter(s => s.id !== song.id)]);
      if (!currentSong) onSongClick(song);
    },
    ytPlayerRef,
  }), [
    audioData, queueSongs, currentSong, isPlaying, currentTimeSec, 
    durationSec, volume, lyricsData, lyricsLoading, knowFacts, 
    knowLoading, likedSongs, upNextQueue, playedHistory, aiLoading, 
    isRightSidebarOpen, isExpandedPlayerOpen, selectedPlaylist, palette,
    onSongClick, onNext, onPrev, onTogglePlay, onSeek, onRateSong 
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
      <div id={playerElementId} className="sr-only" />
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
