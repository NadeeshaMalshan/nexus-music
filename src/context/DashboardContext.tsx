"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Song } from "@/components/echoai/types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { useSession } from "next-auth/react";
import { youtubeApiFetchInit } from "@/lib/youtubeClientFetch";
import { readResponseJson } from "@/lib/readResponseJson";
import { useArtworkColors } from "@/lib/useArtworkColors";
import { useSettings } from "./SettingsContext";
import { type LiveMetadata } from "@/lib/live-tracker";
import { useCast } from "./CastContext";

type AudioPayload = {
  audioUrl: string;
  trackName: string;
  artist: string;
  coverArt: string;
  videoId: string;
  musicVideoId?: string;
  directUrl?: string; // Direct YouTube stream URL
};

type LikedLibraryTrackRow = { videoId: string; title: string; artist: string };

/** Collapse case/spacing/diacritics so "Sorry" search rows match YT liked metadata. */
function normLikedTitle(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normLikedArtist(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\s*-\s*topic\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
    writers: string[] | null;
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
  /** Snapshot from /api/youtube/liked for title/artist matching when video ids differ (e.g. search vs LL). */
  likedLibraryTracks: LikedLibraryTrackRow[];
  songIsInLikedLibrary: (song: { id: string; title: string; artist: string; musicVideoId?: string }, audio?: AudioPayload | null) => boolean;
  resolveLikedLibraryRateVideoId: (song: { id: string; title: string; artist: string; musicVideoId?: string }) => string;
  upNextQueue: Song[];
  previousQueue: Song[];
  playedHistory: Song[];
  aiLoading: boolean;
  overrideArtwork: string | null;
  setOverrideArtwork: (url: string | null) => void;
  liveMetadata: LiveMetadata | null;

  // View State (Shared but UI-specific)
  isRightSidebarOpen: boolean;
  rightSidebarMode: "queue" | "jam" | "lyrics";
  isExpandedPlayerOpen: boolean;
  selectedPlaylist: YouTubePlaylist | null;
  palette: { primary: string; secondary: string; accent: string };

  // Actions
  setIsPlaying: (playing: boolean) => void;
  setCurrentTimeSec: (time: number) => void;
  setCurrentSong: (song: Song | null) => void;
  setQueueSongs: (songs: Song[]) => void;
  setUpNextQueue: React.Dispatch<React.SetStateAction<Song[]>>;
  setPreviousQueue: React.Dispatch<React.SetStateAction<Song[]>>;
  setVolume: (volume: number) => void;
  setIsRightSidebarOpen: (open: boolean) => void;
  setRightSidebarMode: (mode: "queue" | "jam" | "lyrics") => void;
  setIsExpandedPlayerOpen: (open: boolean) => void;
  setSelectedPlaylist: (playlist: YouTubePlaylist | null) => void;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onSongClick: (song: Song, reset?: boolean) => void;
  onPlayPlaylist: (songs: Song[], startIndex: number) => void;
  onRateSong: (songId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => Promise<{ pendingSync?: boolean }>;
  onRemoveFromQueue: (index: number) => void;
  onRemoveFromUpNext: (index: number) => void;
  onReorderQueue: (newQueue: Song[]) => void;
  onReorderUpNext: (newQueue: Song[]) => void;
  onClearQueue: () => void;
  onAddToQueue: (song: Song) => void;
  onPlayNext: (song: Song) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  /** Pause hidden audio player only — does not change global isPlaying (needed when expanded video is active). */
  pauseBackgroundPlayer: () => void;
  viewMode: "music" | "video";
  setViewMode: (mode: "music" | "video") => void;
  isJamActive: boolean;
  setIsJamActive: (active: boolean) => void;
  
  // Chromecast state & actions
  isCastApiAvailable: boolean;
  isCasting: boolean;
  requestCastSession: () => Promise<void>;
  endCastSession: () => void;
  
  // Refs
  ytPlayerRef: React.RefObject<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (args: any) => void;
    cueVideoById: (args: any) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
    destroy: () => void;
    getPlayerState: () => number;
  } | null>;
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { settings } = useSettings();
  
  const ytPlayerRef = useRef<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (args: any) => void;
    cueVideoById: (args: any) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
    destroy: () => void;
    getPlayerState: () => number;
  } | null>(null);

  const playerReadyRef = useRef(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const progressIntervalRef = useRef<number | null>(null);
  const lastTimeBucketRef = useRef(-1);
  const onNextRef = useRef<() => void>(() => {});
  const playerElementId = "echoai-youtube-player";

  // State
  const [audioData, setAudioData] = useState<AudioPayload | null>(null);
  const audioCacheRef = useRef<Record<string, AudioPayload>>({});
  const lyricsCacheRef = useRef<Record<string, LyricsPayload>>({});
  const knowCacheRef = useRef<Record<string, string[]>>({});
  const directUrlCacheRef = useRef<Record<string, string>>({});
  const prefetchedIdsRef = useRef<Set<string>>(new Set());
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
  const [isJamActive, setIsJamActive] = useState(false);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [lastSeedFetched, setLastSeedFetched] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [rightSidebarMode, setRightSidebarMode] = useState<"queue" | "jam" | "lyrics">("queue");
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(70);
  const [lyricsData, setLyricsData] = useState<LyricsPayload | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [playedHistory, setPlayedHistory] = useState<Song[]>([]);
  const [overrideArtwork, setOverrideArtwork] = useState<string | null>(null);
  const [upNextQueue, setUpNextQueue] = useState<Song[]>([]);
  const [previousQueue, setPreviousQueue] = useState<Song[]>([]);
  const [knowFacts, setKnowFacts] = useState<string[]>([]);
  const [knowLoading, setKnowLoading] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [likedLibraryTracks, setLikedLibraryTracks] = useState<LikedLibraryTrackRow[]>([]);
  const [liveMetadata, setLiveMetadata] = useState<LiveMetadata | null>(null);
  const likedLibraryRollbackRef = useRef<LikedLibraryTrackRow | null>(null);
  const [viewMode, setViewMode] = useState<"music" | "video">(settings.defaultPlayMode === "video" ? "video" : "music");
  const viewModeRef = useRef<"music" | "video">(settings.defaultPlayMode === "video" ? "video" : "music");
  const prevViewModeRef = useRef<"music" | "video">(settings.defaultPlayMode === "video" ? "video" : "music");
  const userIntentRef = useRef<"playing" | "paused">("paused");

  const [directAudioUrl, setDirectAudioUrl] = useState<string | null>(null);
  const audio1Ref = useRef<HTMLAudioElement | null>(null);
  const audio2Ref = useRef<HTMLAudioElement | null>(null);
  const activePlayerIndex = useRef<1 | 2>(1);

  const getActiveAudio = useCallback(() => activePlayerIndex.current === 1 ? audio1Ref.current : audio2Ref.current, []);
  const getInactiveAudio = useCallback(() => activePlayerIndex.current === 1 ? audio2Ref.current : audio1Ref.current, []);

  // Crossfade state variables
  const crossfadeActiveRef = useRef(false);
  const nextAudioPreloadedUrlRef = useRef<string | null>(null);

  // Volume Ramping Intervals for smooth HTML5 crossfades
  const volumeRamp1Ref = useRef<NodeJS.Timeout | null>(null);
  const volumeRamp2Ref = useRef<NodeJS.Timeout | null>(null);

  const cancelVolumeRamp = useCallback((index: 1 | 2) => {
    if (index === 1 && volumeRamp1Ref.current) {
      clearInterval(volumeRamp1Ref.current);
      volumeRamp1Ref.current = null;
    } else if (index === 2 && volumeRamp2Ref.current) {
      clearInterval(volumeRamp2Ref.current);
      volumeRamp2Ref.current = null;
    }
  }, []);

  const cancelAllVolumeRamps = useCallback(() => {
    cancelVolumeRamp(1);
    cancelVolumeRamp(2);
  }, [cancelVolumeRamp]);

  const rampVolume = useCallback((playerIndex: 1 | 2, targetVol: number, durationMs: number) => {
    cancelVolumeRamp(playerIndex);
    const audio = playerIndex === 1 ? audio1Ref.current : audio2Ref.current;
    if (!audio) return;

    const startVol = audio.volume;
    const steps = Math.max(5, Math.floor(durationMs / 50));
    const diff = targetVol - startVol;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        audio.volume = targetVol;
        if (playerIndex === 1) volumeRamp1Ref.current = null;
        else volumeRamp2Ref.current = null;
        clearInterval(interval);
      } else {
        audio.volume = Math.max(0, Math.min(1, startVol + (diff * (currentStep / steps))));
      }
    }, 50);

    if (playerIndex === 1) volumeRamp1Ref.current = interval;
    else volumeRamp2Ref.current = interval;
  }, [cancelVolumeRamp]);

  const isUsingNativeAudio = useMemo(() => {
    if (currentSong?.isLive) return false;
    return viewMode === "music" && !!directAudioUrl;
  }, [viewMode, directAudioUrl, currentSong?.isLive]);

  const {
    isCastApiAvailable,
    isCasting,
    requestCastSession,
    endCastSession,
    castMedia,
    playCast,
    pauseCast,
    seekCast,
    setCastVolume,
    remotePlayer,
    remotePlayerController,
  } = useCast();

  // Synchronize Google Cast Player states to React States
  useEffect(() => {
    if (!isCasting || !remotePlayerController || !remotePlayer) return;

    const timeListener = () => {
      if (typeof remotePlayer.currentTime === "number" && Number.isFinite(remotePlayer.currentTime)) {
        setCurrentTimeSec(remotePlayer.currentTime);
      }
    };
    const durationListener = () => {
      if (typeof remotePlayer.duration === "number" && remotePlayer.duration > 0) {
        setDurationSec(remotePlayer.duration);
      }
    };
    const playStateListener = () => {
      setIsPlaying(!remotePlayer.isPaused);
    };

    const castFramework = (window as any).cast?.framework;
    if (castFramework) {
      remotePlayerController.addEventListener(castFramework.RemotePlayerEventType.CURRENT_TIME_CHANGED, timeListener);
      remotePlayerController.addEventListener(castFramework.RemotePlayerEventType.DURATION_CHANGED, durationListener);
      remotePlayerController.addEventListener(castFramework.RemotePlayerEventType.IS_PAUSED_CHANGED, playStateListener);
    }

    return () => {
      if (castFramework) {
        remotePlayerController.removeEventListener(castFramework.RemotePlayerEventType.CURRENT_TIME_CHANGED, timeListener);
        remotePlayerController.removeEventListener(castFramework.RemotePlayerEventType.DURATION_CHANGED, durationListener);
        remotePlayerController.removeEventListener(castFramework.RemotePlayerEventType.IS_PAUSED_CHANGED, playStateListener);
      }
    };
  }, [isCasting, remotePlayerController, remotePlayer]);

  // When casting starts or a new directAudioUrl is resolved, stream it to Chromecast
  useEffect(() => {
    if (isCasting && currentSong && directAudioUrl) {
      const targetId = audioData?.videoId || currentSong.id;
      castMedia(currentSong, targetId, directAudioUrl, currentTimeSec, isPlaying);
      // Mute/pause local players
      try {
        audio1Ref.current?.pause();
        audio2Ref.current?.pause();
        ytPlayerRef.current?.pauseVideo();
      } catch {}
    }
  }, [directAudioUrl, isCasting, currentSong, audioData]);

  // Also pause local audio elements if casting becomes active at any point
  useEffect(() => {
    if (isCasting) {
      try {
        audio1Ref.current?.pause();
        audio2Ref.current?.pause();
        ytPlayerRef.current?.pauseVideo();
      } catch {}
    }
  }, [isCasting]);

  // Propagate volume changes to Chromecast
  useEffect(() => {
    if (isCasting) {
      setCastVolume(volume);
    }
  }, [volume, isCasting]);

  // Keep latest state in refs for intervals and events to avoid closure staleness
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  const volumeRef = useRef(volume);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  const upNextQueueRef = useRef(upNextQueue);
  useEffect(() => { upNextQueueRef.current = upNextQueue; }, [upNextQueue]);
  const currentSongRef = useRef(currentSong);
  useEffect(() => { currentSongRef.current = currentSong; }, [currentSong]);

  const isExpandedPlayerOpenRef = useRef(isExpandedPlayerOpen);
  useEffect(() => {
    isExpandedPlayerOpenRef.current = isExpandedPlayerOpen;
  }, [isExpandedPlayerOpen]);

  /**
   * Matches ExpandedPlayer "live / radio" detection. Many streams never set `song.isLive`;
   * once live-tracker returns `liveMetadata`, ExpandedPlayer mounts its own YouTube — the hidden
   * player must not keep playing the same broadcast or audio overlaps when metadata updates.
   */
  const isReallyLivePlayback = useMemo(() => {
    if (!currentSong) return false;
    if (liveMetadata) return true;

    const safeDuration = currentSong.durationObj?.totalSeconds || 0;
    const targetTitle = (currentSong.title || "").toLowerCase();

    return (
      !!currentSong.isLive ||
      currentSong.duration === "LIVE" ||
      safeDuration > 43200 ||
      targetTitle.includes("one world radio") ||
      targetTitle.includes("owr") ||
      targetTitle.includes("daybreak") ||
      targetTitle.includes("anthem") ||
      targetTitle.includes("coachella") ||
      targetTitle.includes("ultra") ||
      targetTitle.includes("umf") ||
      targetTitle.includes("edc") ||
      targetTitle.includes(" 24/7") ||
      (targetTitle.includes("live") &&
        (targetTitle.includes("stream") ||
          targetTitle.includes("festival") ||
          targetTitle.includes("radio"))) ||
      (isPlaying &&
        (safeDuration < 1 || currentSong.duration === "0:00") &&
        (targetTitle.includes("fest") ||
          targetTitle.includes("radio") ||
          targetTitle.includes("live")))
    );
  }, [currentSong, liveMetadata, isPlaying]);

  /** Hidden iframe must not output audio when ExpandedPlayer owns the same YouTube stream. */
  const hiddenYoutubeMustStaySilentRef = useRef(false);
  useEffect(() => {
    hiddenYoutubeMustStaySilentRef.current =
      viewMode === "video" ||
      isUsingNativeAudio ||
      !!currentSong?.isLive ||
      (isReallyLivePlayback && isExpandedPlayerOpen);
  }, [
    viewMode,
    isUsingNativeAudio,
    currentSong?.isLive,
    isReallyLivePlayback,
    isExpandedPlayerOpen,
  ]);

  /**
   * HARD GUARANTEE: ensure only one playback source is audible at a time.
   * - ExpandedPlayer owns playback in video mode.
   * - For live/radio, ExpandedPlayer typically owns playback while open (even if `song.isLive` is false).
   * - Native <audio> owns playback only when `isUsingNativeAudio` is true.
   */
  useEffect(() => {
    // 1) If native audio should NOT be active, force-pause it.
    if (!isUsingNativeAudio) {
      try {
        audio1Ref.current?.pause();
        audio2Ref.current?.pause();
      } catch { /* ignore */ }
    }

    const p = ytPlayerRef.current;
    if (!p || !playerReadyRef.current) return;

    // 2) If the hidden YouTube iframe must stay silent, enforce pause+mute.
    if (hiddenYoutubeMustStaySilentRef.current) {
      try {
        p.pauseVideo();
        p.setVolume(0);
      } catch { /* ignore */ }
      return;
    }

    // 3) Otherwise, in normal music mode (non-native-audio), keep hidden player volume aligned.
    try {
      p.setVolume(volumeRef.current);
    } catch { /* ignore */ }
  }, [isUsingNativeAudio, isExpandedPlayerOpen, isReallyLivePlayback, viewMode]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // When video mode is closed (video → music transition), resume the hidden background player
  // so audio keeps playing even after the expanded player is minimised.
  useEffect(() => {
    const wasVideo = prevViewModeRef.current === "video";
    prevViewModeRef.current = viewMode;

    if (!wasVideo || viewMode !== "music") return;   // only care about video → music
    if (isUsingNativeAudio) return;                   // native audio will resume on its own

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;

    const targetId = audioData?.videoId || currentSong?.id;
    if (!targetId) return;

    if (userIntentRef.current === "playing") {
      try {
        // Force-reload from current position and unmute
        lastProcessedIdRef.current = null;
        const seekTo = Math.max(0, currentTimeSec - 0.3);
        (player as any).loadVideoById({ videoId: targetId, startSeconds: seekTo });
        player.setVolume(volumeRef.current);
        setIsPlaying(true);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  /** Hidden player: in video mode only cue + mute so expanded iframe is the sole audio source. */
  function syncHiddenPlayerForViewMode(
    player: NonNullable<(typeof ytPlayerRef)["current"]>,
    videoId: string
  ) {
    // If we're in video mode or it's a LIVE stream, we do NOT want the hidden player
    // to touch this video at all. The visible ExpandedPlayer will own the playback.
    if (
      viewModeRef.current === "video" ||
      currentSongRef.current?.isLive ||
      hiddenYoutubeMustStaySilentRef.current
    ) {
      // Just ensure it is silent and paused if it was doing something else
      try {
        player.pauseVideo();
        player.setVolume(0);
      } catch {}
      return;
    }

    if (userIntentRef.current === "paused") {
      player.cueVideoById({ videoId, startSeconds: 0 });
      return;
    }

    player.loadVideoById({ videoId, startSeconds: 0 });
  }

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const loadPersistence = () => {
      try {
        const savedSong = localStorage.getItem("nexus_current_song");
        if (savedSong) {
          const parsed = JSON.parse(savedSong);
          setCurrentSong((prev) => prev || parsed);
        }

        const savedQueue = localStorage.getItem("nexus_queue");
        if (savedQueue) {
          const parsed = JSON.parse(savedQueue);
          setQueueSongs((prev) => prev.length > 0 ? prev : parsed);
        }

        const savedVolume = localStorage.getItem("nexus_volume");
        if (savedVolume) setVolume(parseInt(savedVolume, 10));

        const savedHistory = localStorage.getItem("nexus_history");
        if (savedHistory) setPlayedHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error("Failed to load persistence:", err);
      }
    };
    loadPersistence();

    // Check for jam link
    const params = new URLSearchParams(window.location.search);
    if (params.get("jam")) {
      setRightSidebarMode("jam");
      setIsRightSidebarOpen(true);
    }
  }, []);

  // Persistence: Save to localStorage on changes
  useEffect(() => {
    if (currentSong) {
      localStorage.setItem("nexus_current_song", JSON.stringify(currentSong));
    }
  }, [currentSong]);

  useEffect(() => {
    localStorage.setItem("nexus_queue", JSON.stringify(queueSongs));
  }, [queueSongs]);

  useEffect(() => {
    localStorage.setItem("nexus_volume", volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem("nexus_history", JSON.stringify(playedHistory));
  }, [playedHistory]);

  // Sync YouTube artist subscriptions into following list (once per day)
  useEffect(() => {
    if (!session?.accessToken || !session?.user?.email) return;
    fetch("/api/user/subscriptions/sync", { method: "POST" }).catch(() => {});
  }, [session?.accessToken, session?.user?.email]);

  // Fetch user's actual recent plays from DB on login
  useEffect(() => {
    if (!session?.user?.email) return;
    fetch("/api/user/stats")
      .then(res => res.json())
      .then(data => {
        if (data?.recentPlayed && Array.isArray(data.recentPlayed)) {
          setPlayedHistory(prev => {
            const localIds = new Set(prev.map(s => s.id));
            const dbFiltered = data.recentPlayed.filter((s: Song) => !localIds.has(s.id));
            return [...prev, ...dbFiltered].slice(0, 50);
          });
        }
      })
      .catch(err => console.error("Failed to load user recent plays:", err));
  }, [session?.user?.email]);

  // Synchronize playing status to backend on change (event-driven)
  useEffect(() => {
    if (!currentSong || !session?.user?.email) return;

    const controller = new AbortController();
    const updateStatus = async () => {
      try {
        await fetch("/api/user/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            song: currentSong,
            isPlaying: isPlaying,
            deviceId: window.localStorage.getItem('nexus_device_id') || "unknown"
          }),
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to sync live status:", err);
        }
      }
    };

    updateStatus();

    return () => {
      controller.abort();
    };
  }, [currentSong, isPlaying, session?.user?.email]);

  // Clear live status on tab close / reload
  useEffect(() => {
    if (!session?.user?.email) return;

    const handleUnload = () => {
      // keepalive: true ensures the fetch completes even if the page is unloading
      fetch("/api/user/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          action: "clear",
          deviceId: window.localStorage.getItem('nexus_device_id') || "unknown"
        }),
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [session?.user?.email]);

  // Palette handling
  const effectiveArtwork = useMemo(() => overrideArtwork || liveMetadata?.artwork || audioData?.coverArt || currentSong?.artwork || null, [overrideArtwork, liveMetadata, audioData, currentSong]);
  const palette = useArtworkColors(effectiveArtwork);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--art-primary", palette.primary);
    root.style.setProperty("--art-secondary", palette.secondary);
    root.style.setProperty("--art-accent", palette.accent);
  }, [palette]);

  // Dynamic Tab Title and Favicon
  useEffect(() => {
    if (typeof document === "undefined") return;
    
    // 1. Update Document Title
    if (currentSong) {
      const prefix = isPlaying ? "▶ " : "";
      const displayTitle = liveMetadata?.title || currentSong.title;
      const displayArtist = liveMetadata?.artist || currentSong.artist;
      document.title = `${prefix}${displayTitle} — ${displayArtist}`;
    } else {
      document.title = "Nexus | Premium AI Ecosystem";
    }

    // 2. Update Dynamic Favicon
    const defaultIcon = "/icons/icon-192x192.png";
    const faviconUrl = effectiveArtwork || defaultIcon;
    const links = document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']");
    if (links.length > 0) {
      links.forEach((link: any) => {
        link.href = faviconUrl;
      });
    } else {
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [currentSong, isPlaying, liveMetadata, effectiveArtwork]);

  // Fetch liked songs
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/youtube/liked", youtubeApiFetchInit(session?.accessToken))
      .then(async (res) => {
        if (!res.ok) return;
        const tracks = await readResponseJson<unknown[]>(res);
        if (!Array.isArray(tracks)) return;
        const rows: LikedLibraryTrackRow[] = tracks
          .map((t: any) => ({
            videoId: String(t.videoId || "").trim(),
            title: String(t.title ?? ""),
            artist: String(t.artist ?? ""),
          }))
          .filter((r) => r.videoId);
        setLikedSongs(new Set(rows.map((r) => r.videoId)));
        setLikedLibraryTracks(rows);
      })
      .catch((err) => console.error("Error fetching liked songs:", err));
  }, [status, session?.accessToken]);

  const audioQuery = useMemo(() => {
    if (!currentSong) return "";
    return `${currentSong.artist} ${currentSong.title}`.trim();
  }, [currentSong]);

  // Audio loading logic
  useEffect(() => {
    // Explicitly nullify audio data when track changes
    setAudioData(null);

    if (!audioQuery) {
      return;
    }
    const controller = new AbortController();
    async function loadAudioMeta() {
      const hasId = !!currentSong?.id;
      const isVideo = viewMode === "video" || currentSong?.preferVideoPlayback || currentSong?.isLive;
      const cacheKey = hasId ? (`${currentSong.id}_${audioQuery}_${isVideo ? 'v' : 'a'}`) : audioQuery;
      
      if (audioCacheRef.current[cacheKey]) {
        const payload = audioCacheRef.current[cacheKey];
        setAudioData(payload);
        // Also restore prefetched lyrics/know if available
        const lk = `${payload.trackName || currentSong?.title}_${payload.artist || currentSong?.artist}`;
        if (lyricsCacheRef.current[lk] && !lyricsData) setLyricsData(lyricsCacheRef.current[lk]);
        if (knowCacheRef.current[lk]) setKnowFacts(knowCacheRef.current[lk]);
        if (directUrlCacheRef.current[currentSong?.id || '']) setDirectAudioUrl(directUrlCacheRef.current[currentSong?.id || '']);
        return;
      }
      setAudioData(null);
      try {
        const url = hasId
          ? `/api/audio?query=${encodeURIComponent(audioQuery)}&videoId=${currentSong.id}&artist=${encodeURIComponent(currentSong.artist)}&title=${encodeURIComponent(currentSong.title)}${isVideo ? '&isVideo=true' : ''}${currentSong.isLive ? '&isLive=true' : ''}`
          : `/api/audio?query=${encodeURIComponent(audioQuery)}`;
        const response = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          console.warn("[DashboardContext] Audio metadata fetch returned status:", response.status);
          setAudioData(null);
          return;
        }
        const payload = await readResponseJson<AudioPayload>(response);
        if (!payload) {
          setAudioData(null);
          return;
        }
        audioCacheRef.current[cacheKey] = payload;
        setAudioData(payload);

        // If this was a direct link, sync refined metadata (clean artist/title) back to the song object
        if (currentSong?.isDirectLink && payload.videoId === currentSong.id) {
          if (payload.trackName !== currentSong.title || payload.artist !== currentSong.artist) {
            setCurrentSong((prev) => {
              if (prev?.id !== payload.videoId) return prev;
              // Preserve multi-artist strings: if the original has multiple artists
              // (comma, &, feat., ft.) but the API only returns one, keep the original.
              const multiArtistRe = /,\s*|\s+&\s+|\s+feat\.\s+|\s+ft\.\s+/i;
              const prevHasMultiple = multiArtistRe.test(prev.artist);
              const payloadHasMultiple = payload.artist ? multiArtistRe.test(payload.artist) : false;
              const keepOriginalArtist = prevHasMultiple && !payloadHasMultiple && payload.artist;
              return {
                ...prev,
                title: payload.trackName || prev.title,
                artist: keepOriginalArtist ? prev.artist : (payload.artist || prev.artist),
                artwork: payload.coverArt || prev.artwork,
              };
            });
          }
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
  }, [audioQuery, viewMode]);

  // Direct URL Extraction for Music Mode
  useEffect(() => {
    // Explicitly nullify direct audio URL when track changes to prevent old track from persisting
    setDirectAudioUrl(null);
    
    // If we are switching away from native-audio playback (e.g. to LIVE or video mode),
    // ensure the <audio> elements are actually paused. Otherwise the previous track can
    // keep playing underneath a live/video YouTube player, causing overlap.
    try {
      audio1Ref.current?.pause();
      audio2Ref.current?.pause();
    } catch { /* ignore */ }

    if (!currentSong || viewMode !== "music") {
      return;
    }
    if (currentSong.isLive) {
      return;
    }

    // Check prefetch cache first
    if (directUrlCacheRef.current[currentSong.id]) {
      setDirectAudioUrl(directUrlCacheRef.current[currentSong.id]);
      return;
    }

    const controller = new AbortController();
    async function loadDirectUrl() {
      if (!currentSong?.id) {
        console.warn("[DashboardContext] Skipping loadDirectUrl - currentSong.id is missing");
        return;
      }
      console.log(`[DashboardContext] Loading direct URL for: ${currentSong.id}`);
      try {
        const response = await fetch(`/api/get-audio-url?videoId=${currentSong.id}&isLive=${currentSong.isLive || ""}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Failed to fetch direct URL");
        const data = await readResponseJson<{ url?: string }>(response);
        if (data?.url) {
          directUrlCacheRef.current[currentSong.id] = data.url;
          setDirectAudioUrl(data.url);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          console.error("Failed to load direct audio URL:", error);
        }
      }
    }
    void loadDirectUrl();
    return () => controller.abort();
  }, [currentSong, viewMode]);

  // Lyrics loading logic
  useEffect(() => {
    // Reset lyrics immediately when song OR live metadata changes to prevent stale display
    setLyricsData(null);

    if (!currentSong) {
      return;
    }
    const track = (liveMetadata?.title || audioData?.trackName || currentSong.title)?.trim();
    const artist = (liveMetadata?.artist || audioData?.artist || currentSong.artist)?.trim();
    if (!track || !artist) {
      return;
    }

    // Check prefetch cache first
    const lyricsKey = `${track}_${artist}`;
    if (lyricsCacheRef.current[lyricsKey]) {
      setLyricsData(lyricsCacheRef.current[lyricsKey]);
      setLyricsLoading(false);
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
        const payload = await readResponseJson<LyricsPayload>(response);
        if (payload) lyricsCacheRef.current[lyricsKey] = payload;
        setLyricsData(payload ?? null);
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
  }, [currentSong, liveMetadata?.title, liveMetadata?.artist, audioData?.trackName, audioData?.artist]);

  // Track session played history
  useEffect(() => {
    if (currentSong) {
      setPlayedHistory(prev => {
        const filtered = prev.filter(s => s.id !== currentSong.id);
        return [currentSong, ...filtered].slice(0, 20);
      });
    }
  }, [currentSong]);

  // Prefetch next 2 songs in queue for seamless playback
  useEffect(() => {
    if (!currentSong || upNextQueue.length === 0) return;
    const toPrefetch = upNextQueue.slice(0, 2);
    const controller = new AbortController();

    async function prefetchSong(song: Song) {
      if (prefetchedIdsRef.current.has(song.id)) return;
      prefetchedIdsRef.current.add(song.id);
      const query = `${song.artist} ${song.title}`.trim();
      const isVideo = viewMode === "video" || song.preferVideoPlayback || song.isLive;
      const audioCacheKey = `${song.id}_${query}_${isVideo ? 'v' : 'a'}`;

      // 1. Prefetch audio metadata
      if (!audioCacheRef.current[audioCacheKey]) {
        try {
          const url = `/api/audio?query=${encodeURIComponent(query)}&videoId=${song.id}&artist=${encodeURIComponent(song.artist)}&title=${encodeURIComponent(song.title)}${isVideo ? '&isVideo=true' : ''}`;
          const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
          if (res.ok) {
            const payload = await res.json() as AudioPayload;
            if (payload) audioCacheRef.current[audioCacheKey] = payload;
          }
        } catch { /* ignore prefetch errors */ }
      }

      const cached = audioCacheRef.current[audioCacheKey];
      const trackName = cached?.trackName || song.title;
      const artistName = cached?.artist || song.artist;
      const lyricsKey = `${trackName}_${artistName}`;

      // 2. Prefetch direct audio URL (music mode only)
      if (viewMode === "music" && !song.isLive && !directUrlCacheRef.current[song.id]) {
        try {
          const res = await fetch(`/api/get-audio-url?videoId=${song.id}`, { signal: controller.signal, cache: "no-store" });
          if (res.ok) {
            const data = await res.json() as { url?: string };
            if (data?.url) directUrlCacheRef.current[song.id] = data.url;
          }
        } catch { /* ignore */ }
      }

      // 3. Prefetch lyrics
      if (!lyricsCacheRef.current[lyricsKey]) {
        try {
          const res = await fetch(`/api/lyrics?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}`, { signal: controller.signal, cache: "no-store" });
          if (res.ok) {
            const payload = await res.json() as LyricsPayload;
            if (payload) lyricsCacheRef.current[lyricsKey] = payload;
          }
        } catch { /* ignore */ }
      }

      // 4. Prefetch know/story facts
      if (!knowCacheRef.current[lyricsKey]) {
        try {
          const res = await fetch(`/api/know?track=${encodeURIComponent(trackName)}&artist=${encodeURIComponent(artistName)}&videoId=${encodeURIComponent(song.id)}`, { signal: controller.signal, cache: "no-store" });
          if (res.ok) {
            const facts = await res.json();
            if (Array.isArray(facts)) knowCacheRef.current[lyricsKey] = facts;
          }
        } catch { /* ignore */ }
      }

      console.log(`[Prefetch] Cached: "${trackName}" by "${artistName}"`);
    }

    // Stagger prefetch to avoid overwhelming the server
    const timers: NodeJS.Timeout[] = [];
    toPrefetch.forEach((song, i) => {
      timers.push(setTimeout(() => void prefetchSong(song), (i + 1) * 2000));
    });

    return () => {
      controller.abort();
      timers.forEach(clearTimeout);
    };
  }, [currentSong?.id, upNextQueue, viewMode]);

  // AI Queue and Up Next logic
  useEffect(() => {
    if (!currentSong) return;
    const currentSeed = `${currentSong.artist} - ${currentSong.title}`;
    if (currentSeed === lastSeedFetched) return;

    async function fetchAiNextSongs() {
      if (!settings.autoplay) return;
      setAiLoading(true);
      try {
        const recentQueue = queueSongs.slice(-4).map((s) => ({ title: s.title, artist: s.artist }));
        const userHistory = [`${currentSong!.title} by ${currentSong!.artist}`, ...recentQueue.map(s => `${s.title} by ${s.artist}`)];
        const recRes = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recentTrackId: currentSong!.id, userHistory }),
        });
        if (!recRes.ok) {
          const errData = await readResponseJson<{ error?: string; detail?: string }>(recRes).catch(() => null);
          throw new Error(`API error ${recRes.status}: ${errData?.detail || errData?.error || "Unknown Error"}`);
        }
        const recData = await readResponseJson<{ recommendations?: unknown[] }>(recRes);
        if (!recData) return;
        const recs = (recData.recommendations || []).slice(0, 5);
        const resolvedSongs: Song[] = recs.map((rec: any) => ({
          id: rec.youtubeId,
          title: rec.title,
          artist: rec.artist,
          artwork: rec.thumbnail,
          color: palette.accent,
          duration: rec.duration || "0:00",
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
      if (!settings.autoplay) return;
      try {
        const res = await fetch(`/api/queue?videoId=${currentSong!.id}`);
        if (!res.ok) {
          console.warn("[DashboardContext] Up Next API returned status:", res.status);
          setUpNextQueue([]);
          return;
        }
        const data = await readResponseJson<{ queue?: unknown[] }>(res);
        if (!data) {
          setUpNextQueue([]);
          return;
        }
        const tracks: Song[] = (data.queue || []).map((t: any) => ({
          id: t.youtubeId,
          title: t.title,
          artist: t.artist,
          artwork: t.thumbnail,
          duration: t.duration,
          color: palette.accent
        }));
        
        setUpNextQueue(prev => {
           // Retain all tracks currently in the queue (both manual and previous AI items)
           // and only append the new discovery items that are not already present.
           const uniqueNewTracks = tracks.filter(t => !prev.some(p => p.id === t.id));
           return [...prev, ...uniqueNewTracks];
        });
      } catch (err) {
        console.error("Up Next Fetch Error:", err);
      }
    }
    void fetchUpNext();
  }, [currentSong, lastSeedFetched, palette.accent, queueSongs]);

  // Facts logic
  useEffect(() => {
    // Reset facts immediately to prevent stale display during transition
    setKnowFacts([]);

    if (!currentSong) {
      return;
    }
    const track = (liveMetadata?.title || currentSong.title)?.trim();
    const artist = (liveMetadata?.artist || currentSong.artist)?.trim();
    const videoId = currentSong.id;
    if (!track || !artist || !videoId) return;

    // Check prefetch cache first
    const knowKey = `${track}_${artist}`;
    if (knowCacheRef.current[knowKey]) {
      setKnowFacts(knowCacheRef.current[knowKey]);
      setKnowLoading(false);
      return;
    }

    const controller = new AbortController();
    async function loadKnowFacts() {
      setKnowLoading(true);
      try {
        const response = await fetch(
          `/api/know?track=${encodeURIComponent(track)}&artist=${encodeURIComponent(artist)}&videoId=${encodeURIComponent(videoId)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        if (response.ok) {
          const facts = await readResponseJson<unknown>(response);
          const factsArray = Array.isArray(facts) ? facts : [];
          knowCacheRef.current[knowKey] = factsArray;
          setKnowFacts(factsArray);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.error("Failed to load know facts:", err);
      } finally {
        setKnowLoading(false);
      }
    }
    void loadKnowFacts();
    return () => controller.abort();
  }, [currentSong, liveMetadata?.title, liveMetadata?.artist]);

  // Global Live Metadata Polling
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    // Heuristic for live streams (often search results or history don't have isLive=true)
    const safeDuration = currentSong?.durationObj?.totalSeconds || 0;
    const targetTitle = (liveMetadata?.title || currentSong?.title || "").toLowerCase();
    const isReallyLive = 
      currentSong?.isLive || 
      currentSong?.duration === "LIVE" || 
      safeDuration > 43200 || 
      targetTitle.includes("one world radio") ||
      targetTitle.includes("owr") ||
      targetTitle.includes("daybreak") ||
      targetTitle.includes("anthem") ||
      targetTitle.includes("coachella") ||
      targetTitle.includes("ultra") ||
      targetTitle.includes("umf") ||
      targetTitle.includes("edc") ||
      targetTitle.includes(" 24/7") ||
      (targetTitle.includes("live") && (targetTitle.includes("stream") || targetTitle.includes("festival") || targetTitle.includes("radio"))) ||
      (isPlaying && (safeDuration < 1 || currentSong?.duration === "0:00") && 
       (targetTitle.includes("fest") || targetTitle.includes("radio") || targetTitle.includes("live") || !!liveMetadata));

    const fetchLive = async () => {
      if (!isReallyLive || !currentSong) {
        setLiveMetadata(null);
        return;
      }
      try {
        const query = `${currentSong.artist} ${currentSong.title}`;
        const videoId = currentSong.id;
        const url  = `/api/live-tracker?query=${encodeURIComponent(query)}&title=${encodeURIComponent(currentSong.title)}&videoId=${encodeURIComponent(videoId)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await readResponseJson<LiveMetadata>(res);
          if (data?.artist && data?.title) {
            setLiveMetadata(prev => {
              if (prev?.title === data.title && prev?.artist === data.artist) return prev;
              return data;
            });
          } else {
            setLiveMetadata(null);
          }
        }
      } catch (err) {
        console.warn("Global Live Tracking Failed:", err);
      }
    };
    
    if (isReallyLive) {
      void fetchLive();
      interval = setInterval(fetchLive, 10000); 
    } else {
      setLiveMetadata(null);
    }
    
    return () => clearInterval(interval);
  }, [currentSong, isPlaying]);


  // YouTube player: container is created imperatively on document.body so React never strips the iframe on re-renders.
  useEffect(() => {
    let mount = document.getElementById(playerElementId);
    if (!mount) {
      mount = document.createElement("div");
      mount.id = playerElementId;
      mount.className = "fixed top-0 left-0 h-[1px] w-[1px] overflow-hidden opacity-[0.01] pointer-events-none z-[-1]";
      mount.setAttribute("aria-hidden", "true");
      document.body.appendChild(mount);
    }

    const w = window as any;
    const initPlayer = () => {
      if (!w.YT?.Player || ytPlayerRef.current) return;
      ytPlayerRef.current = new w.YT.Player(playerElementId, {
        height: "1",
        width: "1",
        videoId: "", // Empty initially, will be loaded via logic
        playerVars: { 
          controls: 0, 
          modestbranding: 1, 
          rel: 0, 
          playsinline: 1,
          enablejsapi: 1,
          origin: typeof window !== "undefined" ? window.location.origin : undefined
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            setIsPlayerReady(true);
            if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = window.setInterval(() => {
              const player = ytPlayerRef.current;
              if (!player || !playerReadyRef.current) return;
              // Expanded react-youtube owns time + audio in video mode
              if (viewModeRef.current === "video") return;
              if (hiddenYoutubeMustStaySilentRef.current) return;

              const current = player.getCurrentTime();
              const duration = player.getDuration();
              
              if (Number.isFinite(current)) {
                const bucket = Math.floor(current * 5);
                if (bucket !== lastTimeBucketRef.current) {
                  lastTimeBucketRef.current = bucket;
                  setCurrentTimeSec(current);
                }

                // BACKGLOUND WATCHDOG: Overcome background throttling
                // If Gapless is ON, we trigger slightly earlier (1s) to mask the loading delay.
                const bufferTime = settingsRef.current.gaplessPlayback ? 1.0 : 0.5;
                if (duration > 0 && current >= duration - bufferTime && userIntentRef.current === "playing") {
                   onNextRef.current();
                }
              }
              if (Number.isFinite(duration) && duration > 0) setDurationSec(duration);

              // Apply Volume & Quality
              // Crossfade Logic: Ramp down volume if near the end
              const currentSec = player.getCurrentTime() || 0;
              const isSimultaneous = typeof window !== 'undefined' && window.localStorage.getItem('crossDeviceAction') === 'Play simultaneously';
              const crossfadeSec = (isJamActive || isSimultaneous) ? 0 : settingsRef.current.crossfade;
              if (duration > 0 && crossfadeSec > 0 && currentSec >= (duration - crossfadeSec)) {
                  const remaining = duration - currentSec;
                  const ratio = Math.max(0, remaining / crossfadeSec);
                  const targetVolume = Math.floor(volumeRef.current * ratio);
                  player.setVolume(targetVolume);
                } else {
                  player.setVolume(volumeRef.current);
                }
                
                // Suggest audio quality
                const qualityMap: Record<string, string> = {
                  high: "highres",
                  normal: "medium",
                  low: "small"
                };
                try {
                  // For background/hidden player, we ALWAYS want lowest quality to save bandwidth and speed up transitions
                  const targetQuality = (viewModeRef.current === "music") ? "small" : (qualityMap[settingsRef.current.audioQuality] || "auto");
                  (player as any)?.setPlaybackQuality?.(targetQuality);
                } catch (e) {}

                // RESILIENCE: If user intent is playing but player is paused background, try to resume
                // We SKIP this for live streams and video mode because the expanded player owns them.
                if (
                  userIntentRef.current === "playing" && 
                  document.visibilityState === 'hidden' && 
                  viewModeRef.current === "music" &&
                  !isUsingNativeAudio &&
                  !hiddenYoutubeMustStaySilentRef.current
                ) {
                    const state = player.getPlayerState();
                    if (state === 2 || state === 5) {
                        player.playVideo();
                    }

                    // RE-SYNC MEDIA SESSION: Sometimes notification disappears if OS thinks we're idle
                    if ("mediaSession" in navigator) {
                       navigator.mediaSession.playbackState = "playing";
                    }
                }
            }, 500); // Slower interval in background is more likely to be regular than fast one

            // Native Audio progress interval
            const nativeProgressInterval = window.setInterval(() => {
              const activeAudio = getActiveAudio();
              if (!isUsingNativeAudio || !activeAudio) return;
              
              if (!activeAudio.paused && userIntentRef.current === "playing") {
                const current = activeAudio.currentTime;
                const duration = activeAudio.duration;
                
                if (Number.isFinite(current)) {
                  setCurrentTimeSec(current);
                }
                if (Number.isFinite(duration) && duration > 0) {
                  setDurationSec(duration);
                  
                  const isSimultaneous = typeof window !== 'undefined' && window.localStorage.getItem('crossDeviceAction') === 'Play simultaneously';
                  const crossfadeSec = (isJamActive || isSimultaneous) ? 0 : settingsRef.current.crossfade;
                  const gapless = settingsRef.current.gaplessPlayback;

                  // === GAPLESS PRE-BUFFER ===
                  // Preload 2 seconds earlier than the crossfade to allow buffer warming
                  const preloadThreshold = Math.max(crossfadeSec > 0 ? crossfadeSec + 2 : 5, 5);
                  if (current >= duration - preloadThreshold && !nextAudioPreloadedUrlRef.current) {
                    const nextSongs = upNextQueueRef.current;
                    if (nextSongs.length > 0) {
                      const nextSong = nextSongs[0];
                      const cachedUrl = directUrlCacheRef.current[nextSong.id];
                      const inactiveAudio = getInactiveAudio();
                      if (cachedUrl && inactiveAudio) {
                        inactiveAudio.src = cachedUrl;
                        inactiveAudio.preload = "auto";
                        inactiveAudio.load();
                        nextAudioPreloadedUrlRef.current = cachedUrl;
                        console.log(`[Gapless] Pre-buffered next direct CDN: "${nextSong.title}"`);
                      }
                    }
                  }

                  // === CROSSFADE LOGIC ===
                  if (crossfadeSec > 0 && current >= (duration - crossfadeSec)) {
                    if (!crossfadeActiveRef.current) {
                      const nextSongs = upNextQueueRef.current;
                      const inactiveAudio = getInactiveAudio();
                      
                      if (nextSongs.length > 0 && inactiveAudio && nextAudioPreloadedUrlRef.current) {
                        crossfadeActiveRef.current = true;
                        
                        console.log(`[Crossfade] Initiating crossfade. Active player index was: ${activePlayerIndex.current}`);

                        const remaining = Math.max(0, duration - current);
                        const targetVol = volumeRef.current / 100;

                        // Play the next track
                        inactiveAudio.volume = 0;
                        inactiveAudio.play().catch(e => console.warn("[Crossfade] Inactive audio play failed:", e));

                        // Smooth HTML5 volume ramping
                        rampVolume(activePlayerIndex.current, 0, remaining * 1000);
                        rampVolume(activePlayerIndex.current === 1 ? 2 : 1, targetVol, crossfadeSec * 1000);
                      }
                    }
                  } else {
                    // Outside crossfade: Keep active player at full volume and inactive at 0
                    // Only apply if not currently in active volume ramping interval
                    if (!volumeRamp1Ref.current && !volumeRamp2Ref.current) {
                      if (activeAudio) activeAudio.volume = volumeRef.current / 100;
                      const inactiveAudio = getInactiveAudio();
                      if (inactiveAudio) inactiveAudio.volume = 0;
                    }
                  }

                  // Standard trigger next song transition near end
                  const triggerThreshold = crossfadeSec > 0 ? 0.3 : (gapless ? 0.3 : 0.5);
                  if (current >= duration - triggerThreshold) {
                    onNextRef.current();
                  }
                }
              }
            }, 250);  // 250ms progress interval for smooth volume tracking

            return () => {
              window.clearInterval(nativeProgressInterval);
            };
          },
          onStateChange: (event: any) => {
            // Only sync isPlaying if we're NOT in video mode, to let the visible player lead state
            // Also, for LIVE STREAMS in music mode, the ExpandedPlayer handles playback, so we skip sync here.
            if (viewModeRef.current === "music" && !currentSongRef.current?.isLive) {
              if (event.data === 1) {
                setIsPlaying(true);
                userIntentRef.current = "playing";
              }
              else if (event.data === 2) {
                // If it paused but our intent is still playing, don't kill the global isPlaying yet
                // This keeps the MediaSession and Silent Audio alive on lock screen
                if (document.visibilityState === 'visible' || userIntentRef.current === "paused") {
                    setIsPlaying(false);
                }
              }
              // ENDED: only advance from the hidden player in music mode
              if (event.data === 0) {
                // Check if we already moved to next to avoid double trigger
                onNextRef.current();
              }
            }
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

    return () => {
      if (progressIntervalRef.current) {
        window.clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      try {
        ytPlayerRef.current?.destroy?.();
      } catch { /* ignore */ }
      ytPlayerRef.current = null;
      playerReadyRef.current = false;
      const m = document.getElementById(playerElementId);
      if (m) document.body.removeChild(m);
    };
  }, []); // Run only once

  const lastProcessedIdRef = useRef<string | null>(null);

  // Load / cue hidden player when resolved audio id OR currentSong id changes
  useEffect(() => {
    // Sync native audio if in use
    if (isUsingNativeAudio && !isCasting) {
        const activeAudio = getActiveAudio();
        const inactiveAudio = getInactiveAudio();

        // If crossfade is in progress and the next audio was pre-buffered,
        // swap: promote inactiveAudio to active (it's already playing)
        // but let the volume ramps continue so the overlap sounds smooth.
        if (crossfadeActiveRef.current && inactiveAudio && nextAudioPreloadedUrlRef.current) {
          // Promote inactive audio to active (it's already playing via crossfade)
          const oldPlayerIndex = activePlayerIndex.current;
          activePlayerIndex.current = activePlayerIndex.current === 1 ? 2 : 1;

          // DON'T cancel ramps or snap volumes — let the crossfade finish naturally.
          // Schedule cleanup of the old (now demoted) audio after remaining ramp time.
          const oldAudio = oldPlayerIndex === 1 ? audio1Ref.current : audio2Ref.current;
          if (oldAudio) {
            const cleanupDelay = Math.max(300, (settingsRef.current.crossfade || 1) * 1000);
            setTimeout(() => {
              try {
                cancelVolumeRamp(oldPlayerIndex);
                oldAudio.pause();
                oldAudio.src = "";
              } catch {}
            }, cleanupDelay);
          }

          // Reset crossfade state (but ramps keep running)
          crossfadeActiveRef.current = false;
          nextAudioPreloadedUrlRef.current = null;
          return; // Don't re-assign src, it's already playing
        }

        // Normal (non-crossfade) src assignment
        if (directAudioUrl && activeAudio && activeAudio.src !== directAudioUrl && !activeAudio.src.endsWith(directAudioUrl)) {
            // Cancel active ramps
            cancelAllVolumeRamps();

            // Reset crossfade state for clean start
            crossfadeActiveRef.current = false;
            nextAudioPreloadedUrlRef.current = null;

            // Clear inactive audio just in case
            if (inactiveAudio) {
              try {
                inactiveAudio.pause();
                inactiveAudio.src = "";
                inactiveAudio.volume = 0;
              } catch {}
            }

            activeAudio.volume = volumeRef.current / 100;
            activeAudio.src = directAudioUrl;
            if (userIntentRef.current === "playing") {
                activeAudio.play().catch(e => console.warn("Native audio play failed:", e));
                setIsPlaying(true);
            }
        }
        // Silence YT player
        try { ytPlayerRef.current?.pauseVideo(); ytPlayerRef.current?.setVolume(0); } catch {}
    }

    if (!ytPlayerRef.current || !isPlayerReady || isUsingNativeAudio || isCasting) return;
    
    // We prioritize audioData.videoId, but fallback to currentSong.id for instant start
    const targetId = audioData?.videoId || currentSong?.id;
    if (!targetId) {
       // If no song is selected, ensure the player stops and clears
       try {
         ytPlayerRef.current.pauseVideo();
         ytPlayerRef.current.cueVideoById("");
       } catch {}
       lastProcessedIdRef.current = null;
       return;
    }

    if (targetId === lastProcessedIdRef.current) return;
    
    lastProcessedIdRef.current = targetId;
    syncHiddenPlayerForViewMode(ytPlayerRef.current, targetId);
    
    // If we're using currentSong.id (optimistic start) and then audioData comes back later,
    // we don't want to re-load the exact same video if it's already playing.
  }, [audioData?.videoId, currentSong?.id, isPlayerReady, isUsingNativeAudio, directAudioUrl]);

  // Keep player volumes synced with settings
  useEffect(() => {
    const p = ytPlayerRef.current;
    
    // Set native active audio volume directly if not in active crossfade ramping
    if (!volumeRamp1Ref.current && !volumeRamp2Ref.current) {
      const activeAudio = getActiveAudio();
      if (activeAudio) {
          activeAudio.volume = volume / 100;
      }
      const inactiveAudio = getInactiveAudio();
      if (inactiveAudio) {
          inactiveAudio.volume = 0;
      }
    }
    
    if (!p || !playerReadyRef.current) return;
    try {
      const silenceHidden =
        viewMode === "video" ||
        isUsingNativeAudio ||
        !!currentSong?.isLive ||
        (isReallyLivePlayback && isExpandedPlayerOpen);

      if (silenceHidden) {
        p.setVolume(0);
        p.pauseVideo();
      } else {
        p.setVolume(volume);
      }
    } catch {
      /* ignore */
    }
  }, [
    viewMode,
    volume,
    isUsingNativeAudio,
    currentSong?.isLive,
    isReallyLivePlayback,
    isExpandedPlayerOpen,
  ]);

  // Handlers
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize silent audio stream on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Create a real silent audio stream using AudioContext
    // This is much more effective than Data URIs at preventing background suspension
    const audio = new Audio();
    audio.loop = true;
    silentAudioRef.current = audio;

    try {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const ctx = new AudioContextClass();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const dst = ctx.createMediaStreamDestination();
      
      // Use a very low frequency tone (20Hz) at near-zero volume
      // This is "audible content" to the OS/browser but silent to humans.
      // This is much more effective at keeping the session alive than absolute silence.
      // Use a slightly higher frequency (infrasound/low-bass) that's less likely to be filtered
      // and a slightly higher gain so the OS doesn't ignore it as noise floor.
      oscillator.frequency.setValueAtTime(30, ctx.currentTime);
      gainNode.gain.setValueAtTime(0.005, ctx.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(dst);
      oscillator.start();
      
      audio.srcObject = dst.stream;
      audioCtxRef.current = ctx;
    } catch (e) {
      console.warn("AudioContext silent stream failed, falling back to data URI");
      audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAD//w==";
    }

    const handleResume = () => {
      // Resume AudioContext if it was suspended
      try {
        if (audioCtxRef.current?.state === "suspended") {
          audioCtxRef.current.resume();
        }
      } catch (e) {}

      if (userIntentRef.current === "playing") {
        if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(() => {});
        if (ytPlayerRef.current && playerReadyRef.current && viewModeRef.current === "music") {
           // Try to kick the YT player back to life
           try { ytPlayerRef.current.playVideo(); } catch {}
        }
      }
    };
    window.addEventListener("focus", handleResume);
    document.addEventListener("visibilitychange", handleResume);
    return () => {
      window.removeEventListener("focus", handleResume);
      document.removeEventListener("visibilitychange", handleResume);
    };
  }, []);

  // Sync silent audio with playback state
  useEffect(() => {
    if (!silentAudioRef.current) return;
    if (isPlaying) {
      silentAudioRef.current.play().catch(() => {});
    } else {
      silentAudioRef.current.pause();
    }
  }, [isPlaying]);

  const onTogglePlay = useCallback(() => {
    if (isCasting) {
      if (isPlaying) pauseCast();
      else playCast();
      return;
    }

    if (viewMode === "video" || currentSongRef.current?.isLive) {
      setIsPlaying((v) => !v);
      userIntentRef.current = isPlayingRef.current ? "paused" : "playing";
      return;
    }

    if (isUsingNativeAudio) {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            if (activeAudio.paused) {
                userIntentRef.current = "playing";
                try { audioCtxRef.current?.resume(); } catch {}
                activeAudio.play().catch(() => {});
                setIsPlaying(true);
                if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(() => {});
            } else {
                userIntentRef.current = "paused";
                activeAudio.pause();
                setIsPlaying(false);
                if (!silentAudioRef.current?.paused) silentAudioRef.current?.pause();
            }
            return;
        }
    }

    const player = ytPlayerRef.current as any;
    if (!player || !playerReadyRef.current) return;
    
    // Check current actual state if possible to avoid desync
    let actualState = -1;
    try { actualState = player.getPlayerState(); } catch {}
    
    // If not currently playing (state 1), we want to play
    if (actualState !== 1) {
      userIntentRef.current = "playing";
      // Resume context first
      try { audioCtxRef.current?.resume(); } catch {}
      player.playVideo();
      setIsPlaying(true);
      // Ensure silent audio is active
      if (silentAudioRef.current?.paused) {
        silentAudioRef.current.play().catch(() => {});
      }
    } else {
      userIntentRef.current = "paused";
      player.pauseVideo();
      setIsPlaying(false);
      // Stop silent audio
      if (!silentAudioRef.current?.paused) {
        silentAudioRef.current?.pause();
      }
    }
  }, [isPlaying, viewMode, isUsingNativeAudio, isCasting, playCast, pauseCast]);

  const playVideo = useCallback(() => {
    userIntentRef.current = "playing";

    if (isCasting) {
        playCast();
        setIsPlaying(true);
        return;
    }
    
    // In video/live modes, the ExpandedPlayer component owns the YouTube instance and 
    // will react to the isPlaying state changing. We don't want to play the hidden player here.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setIsPlaying(true);
        return;
    }

    if (isUsingNativeAudio) {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            activeAudio.play().catch(() => {});
            setIsPlaying(true);
            return;
        }
    }

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.setVolume(volume);
    player.playVideo();
    setIsPlaying(true);
  }, [volume, isUsingNativeAudio, isCasting, playCast]);

  const pauseVideo = useCallback(() => {
    userIntentRef.current = "paused";

    if (isCasting) {
        pauseCast();
        setIsPlaying(false);
        return;
    }
    
    // For video/live mode, ExpandedPlayer will pause itself when isPlaying === false.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setIsPlaying(false);
        return;
    }

    if (isUsingNativeAudio) {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            activeAudio.pause();
            setIsPlaying(false);
            return;
        }
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
    setIsPlaying(false);
  }, [isUsingNativeAudio, isCasting, pauseCast]);

  const pauseBackgroundPlayer = useCallback(() => {
    if (isUsingNativeAudio) {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            activeAudio.pause();
            return;
        }
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
  }, [isUsingNativeAudio]);

  const onSongClick = useCallback((song: Song, shouldResetQueue: boolean = true) => {
    if (shouldResetQueue) {
      setUpNextQueue([]);
      setPreviousQueue([]);
    } else {
      // If clicked from within the upNextQueue, slice it and update previous queue
      const currentIndex = upNextQueueRef.current.findIndex(s => s.id === song.id);
      if (currentIndex !== -1) {
         setPreviousQueue(prev => {
            const newPrev = [...prev];
            if (currentSongRef.current) newPrev.push(currentSongRef.current);
            // Add any skipped songs from the queue to the previous cache
            const skipped = upNextQueueRef.current.slice(0, currentIndex);
            const combined = [...newPrev, ...skipped];
            return combined.slice(-4); // Keep last 4
         });
         setUpNextQueue(prev => prev.slice(currentIndex + 1));
      }
    }
    const isLive = song.isLive || song.duration === "LIVE";
    if (song.preferVideoPlayback || isLive) {
      setViewMode("video");
      setIsExpandedPlayerOpen(true);
    }
    userIntentRef.current = "playing";
    try { audioCtxRef.current?.resume(); } catch {}
    setCurrentSong({ ...song, isLive });
    setCurrentTimeSec(0);
    lastTimeBucketRef.current = -1;
    setIsPlaying(true);

    // Record statistics log to database
    if (session?.user?.email) {
      fetch("/api/user/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "play", song }),
      }).catch((err) => console.error("Failed to log play event to database:", err));
    }
    
    // Update local history
    setPlayedHistory((prev) => {
      // Filter out if already in history to move to top
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 50); // Keep last 50
    });
  }, [setViewMode, setIsExpandedPlayerOpen, session]);

  const lastNextCallRef = useRef(0);
  const onNext = useCallback(() => {
    // Debounce guard to prevent double-triggering in background
    const now = Date.now();
    if (now - lastNextCallRef.current < 2000) return;
    lastNextCallRef.current = now;

    if (!settings.autoplay && upNextQueue.length === 0) {
      setIsPlaying(false);
      return;
    }

    if (upNextQueue.length > 0) {
      const next = upNextQueue[0];
      setPreviousQueue(prev => {
         const newPrev = currentSong ? [...prev, currentSong] : [...prev];
         return newPrev.slice(-4); // Keep last 4
      });
      setUpNextQueue((prev) => prev.slice(1));
      onSongClick(next, false); // <--- Don't reset when auto-playing
      return;
    }

    // If queue is empty but autoplay is on, maybe we are still fetching?
    // We try to trigger a re-fetch if we're stuck
    if (settings.autoplay && currentSong) {
        setLastSeedFetched(null); // Force AI re-fetch
    }
    
    setIsPlaying(false);
  }, [upNextQueue, onSongClick, settings.autoplay, currentSong]);

  onNextRef.current = onNext;

  const onSeek = useCallback((nextTimeSec: number) => {
    if (!Number.isFinite(nextTimeSec)) return;
    
    if (isCasting) {
      seekCast(nextTimeSec);
      setCurrentTimeSec(nextTimeSec);
      return;
    }

    // In video/live modes, seeking should be handled by the ExpandedPlayer or ignored for live.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setCurrentTimeSec(nextTimeSec);
        return; 
    }

    if (isUsingNativeAudio) {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            activeAudio.currentTime = nextTimeSec;
            setCurrentTimeSec(nextTimeSec);
            return;
        }
    }

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    const safeDuration = durationSec > 0 ? durationSec : (youtubeTimestampToSeconds(currentSong?.duration ?? "") ?? 0);
    const clamped = Math.max(0, Math.min(nextTimeSec, safeDuration || nextTimeSec));
    player.seekTo(clamped, true);
    setCurrentTimeSec(clamped);
  }, [durationSec, currentSong?.duration, isUsingNativeAudio, isCasting, seekCast]);

  const onPrev = useCallback(() => {
    if (currentTimeSec > 5 || previousQueue.length === 0) {
       onSeek(0);
       return;
    }
    
    // Pop the last song from previousQueue
    const prevSong = previousQueue[previousQueue.length - 1];
    setPreviousQueue(prev => prev.slice(0, -1));
    
    // Push the current song back to the top of upNextQueue
    if (currentSongRef.current) {
       setUpNextQueue(prev => [currentSongRef.current!, ...prev]);
    }
    
    // Play the previous song without resetting queue
    onSongClick(prevSong, false);
  }, [onSeek, currentTimeSec, previousQueue, onSongClick]);

  const songIsInLikedLibrary = useCallback(
    (song: { id: string; title: string; artist: string; musicVideoId?: string }, audio?: AudioPayload | null) => {
      if (likedSongs.has(song.id)) return true;
      if (audio?.videoId && likedSongs.has(audio.videoId)) return true;
      if (audio?.musicVideoId && likedSongs.has(audio.musicVideoId)) return true;
      if (song.musicVideoId && likedSongs.has(song.musicVideoId)) return true;
      const nt = normLikedTitle(song.title);
      const na = normLikedArtist(song.artist);
      if (!nt || !na) return false;
      return likedLibraryTracks.some((t) => normLikedTitle(t.title) === nt && normLikedArtist(t.artist) === na);
    },
    [likedSongs, likedLibraryTracks],
  );

  const resolveLikedLibraryRateVideoId = useCallback(
    (song: { id: string; title: string; artist: string; musicVideoId?: string }) => {
      if (likedSongs.has(song.id)) return song.id;
      if (song.musicVideoId && likedSongs.has(song.musicVideoId)) return song.musicVideoId;
      const nt = normLikedTitle(song.title);
      const na = normLikedArtist(song.artist);
      const hit = likedLibraryTracks.find((t) => normLikedTitle(t.title) === nt && normLikedArtist(t.artist) === na);
      return hit?.videoId ?? song.id;
    },
    [likedSongs, likedLibraryTracks],
  );

  const onRateSong = useCallback(async (songId: string, rating: "like" | "none", meta?: { title: string; artist: string }): Promise<{ pendingSync?: boolean }> => {
    if (!session?.user) return {};
    
    let targetId = (songId === currentSong?.id && audioData?.videoId) ? audioData.videoId : songId;
    let finalMeta = meta ?? (rating === "like" && songId === currentSong?.id && currentSong ? { title: currentSong.title, artist: currentSong.artist } : undefined);

    // LIVE STREAM HANDLING: If liking during a live stream with metadata, find the actual song ID
    if (rating === "like" && currentSong?.isLive && liveMetadata) {
      try {
        const query = `${liveMetadata.artist} - ${liveMetadata.title}`;
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (searchRes.ok) {
          const searchData = await readResponseJson<{ items?: { type?: string; videoId?: string }[] }>(searchRes);
          const bestMatch = searchData?.items?.find((item) => item.type === "SONG") || searchData?.items?.[0];
          if (bestMatch?.videoId) {
            targetId = bestMatch.videoId;
            finalMeta = { title: liveMetadata.title, artist: liveMetadata.artist };
          }
        }
      } catch (err) {
        console.warn("Failed to resolve live song ID for liking:", err);
      }
    }

    const idsToTouch = new Set<string>([targetId, songId]);
    if (songId === currentSong?.id && currentSong) {
      if (audioData?.videoId) idsToTouch.add(audioData.videoId);
      if (audioData?.musicVideoId) idsToTouch.add(audioData.musicVideoId);
      if (currentSong.musicVideoId) idsToTouch.add(currentSong.musicVideoId);
    }

    if (rating === "none") {
      setLikedLibraryTracks((prev) => {
        const removed = prev.find((t) => t.videoId === targetId);
        likedLibraryRollbackRef.current = removed ?? null;
        return prev.filter((t) => t.videoId !== targetId);
      });
    } else if (rating === "like" && finalMeta) {
      setLikedLibraryTracks((prev) => [
        ...prev.filter((t) => t.videoId !== targetId),
        { videoId: targetId, title: finalMeta.title, artist: finalMeta.artist },
      ]);
    }

    setLikedSongs((prev) => {
      const next = new Set(prev);
      if (rating === "like") {
        for (const id of idsToTouch) next.add(id);
      } else {
        for (const id of idsToTouch) next.delete(id);
      }
      return next;
    });

    try {
      const res = await fetch(
        "/api/youtube/rate",
        youtubeApiFetchInit(session?.accessToken, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            videoId: targetId, 
            rating,
            track: rating === "like" && finalMeta ? {
              videoId: targetId,
              title: finalMeta.title,
              artist: finalMeta.artist,
              thumbnailUrl: currentSong?.id === songId ? currentSong?.artwork : ""
            } : undefined
          }),
        })
      );
      if (!res.ok) throw new Error("Failed to rate song");
      const json = await res.json().catch(() => ({}));
      return { pendingSync: json?.pendingSync === true };
    } catch (err) {
      setLikedSongs((prev) => {
        const next = new Set(prev);
        if (rating === "like") {
          for (const id of idsToTouch) next.delete(id);
        } else {
          next.add(targetId);
        }
        return next;
      });
      if (rating === "none") {
        const r = likedLibraryRollbackRef.current;
        likedLibraryRollbackRef.current = null;
        if (r) {
          setLikedLibraryTracks((prev) => (prev.some((t) => t.videoId === r.videoId) ? prev : [...prev, r]));
        }
      }
      if (rating === "like" && finalMeta) {
        setLikedLibraryTracks((prev) => prev.filter((t) => t.videoId !== targetId));
      }
      return {};
    }
  }, [session?.user, session?.accessToken, currentSong, audioData, liveMetadata]);

  const sessionHandlersRef = useRef({ onTogglePlay, onNext, onPrev, onSeek });
  useEffect(() => {
    sessionHandlersRef.current = { onTogglePlay, onNext, onPrev, onSeek };
  }, [onTogglePlay, onNext, onPrev, onSeek]);

  // Native Media Session API: Handlers (Persistent - set once)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;

    const handlersMap: Record<string, (details?: any) => void> = {
      play: () => sessionHandlersRef.current.onTogglePlay(),
      pause: () => sessionHandlersRef.current.onTogglePlay(),
      previoustrack: () => sessionHandlersRef.current.onPrev(),
      nexttrack: () => sessionHandlersRef.current.onNext(),
      seekbackward: () => sessionHandlersRef.current.onSeek(currentTimeSec - 10),
      seekforward: () => sessionHandlersRef.current.onSeek(currentTimeSec + 10),
      seekto: (details: any) => {
        if (details.seekTime !== undefined) sessionHandlersRef.current.onSeek(details.seekTime);
      },
    };

    Object.entries(handlersMap).forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action as any, handler);
      } catch (error) {
        console.warn(`Media session action "${action}" not supported.`);
      }
    });

    return () => {
      Object.keys(handlersMap).forEach((action) => {
        try { navigator.mediaSession.setActionHandler(action as any, null); } catch {}
      });
    };
  }, []); // Only register once! Current state accessed via sessionHandlersRef and currentTimeSec (well, currentTimeSec is still in closure, but we want it fresh)

  // Actually, we need currentTimeSec to be fresh for seek.
  // We can use a ref for it too.
  const currentTimeRef = useRef(currentTimeSec);
  useEffect(() => { currentTimeRef.current = currentTimeSec; }, [currentTimeSec]);

  // Revised handlers to use currentTimeRef
  useEffect(() => {
     if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
     navigator.mediaSession.setActionHandler("seekbackward", () => sessionHandlersRef.current.onSeek(currentTimeRef.current - 10));
     navigator.mediaSession.setActionHandler("seekforward", () => sessionHandlersRef.current.onSeek(currentTimeRef.current + 10));
  }, []);

  // Native Media Session API: Metadata (Update on song change)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentSong) return;

    const displayTitle = liveMetadata?.title || currentSong.title;
    const displayArtist = liveMetadata?.artist || currentSong.artist || "Unknown Artist";
    const displayArtwork = liveMetadata?.artwork || currentSong.artwork || "/placeholder.jpg";

    navigator.mediaSession.metadata = new MediaMetadata({
      title: displayTitle,
      artist: displayArtist,
      album: "Nexus Music",
      artwork: [
        { src: displayArtwork, sizes: "96x96", type: "image/jpeg" },
        { src: displayArtwork, sizes: "128x128", type: "image/jpeg" },
        { src: displayArtwork, sizes: "192x192", type: "image/jpeg" },
        { src: displayArtwork, sizes: "256x256", type: "image/jpeg" },
        { src: displayArtwork, sizes: "384x384", type: "image/jpeg" },
        { src: displayArtwork, sizes: "512x512", type: "image/jpeg" },
      ],
    });

    // Ensure playback state is synced for the new metadata
    if ("mediaSession" in navigator) {
       navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
    }
  }, [currentSong, isPlaying, liveMetadata]);

  // Native Media Session API: Position State (Update on time change)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    if (!("setPositionState" in navigator.mediaSession) || !currentSong) return;

    try {
      navigator.mediaSession.setPositionState({
        duration: durationSec || 0,
        playbackRate: 1,
        position: currentTimeSec || 0,
      });
    } catch (err) {
      console.warn("MediaSession setPositionState failed:", err);
    }
  }, [currentTimeSec, durationSec, currentSong]);

  // Sync Playback State to OS
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

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
    likedLibraryTracks,
    songIsInLikedLibrary,
    resolveLikedLibraryRateVideoId,
    upNextQueue,
    playedHistory,
    aiLoading,
    overrideArtwork,
    setOverrideArtwork,
    isRightSidebarOpen,
    isExpandedPlayerOpen,
    selectedPlaylist,
    palette,
    liveMetadata,
    isJamActive,
    setIsJamActive,
    setIsPlaying,
    setCurrentTimeSec,
    setCurrentSong,
    setQueueSongs,
    setVolume,
    setIsRightSidebarOpen,
    setRightSidebarMode,
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
    onClearQueue: () => setUpNextQueue([]),
    onReorderUpNext: (newQueue: Song[]) => setUpNextQueue(newQueue),
    onPlayPlaylist: (songs: Song[], startIndex: number) => {
      onSongClick(songs[startIndex], true);
      setUpNextQueue(songs.slice(startIndex + 1).map(s => ({ ...s, isManual: true })));
    },
    onAddToQueue: (song: Song) => {
      setUpNextQueue(prev => prev.some(s => s.id === song.id) ? prev : [...prev, { ...song, isManual: true }]);
      if (!currentSong) onSongClick(song);
    },
    onPlayNext: (song: Song) => {
      setUpNextQueue(prev => [{ ...song, isManual: true }, ...prev.filter(s => s.id !== song.id)]);
      if (!currentSong) onSongClick(song);
    },
    playVideo,
    pauseVideo,
    pauseBackgroundPlayer,
    viewMode,
    setViewMode,
    ytPlayerRef,
    setUpNextQueue,
    setPreviousQueue,
    previousQueue,
    rightSidebarMode,
    isCastApiAvailable,
    isCasting,
    requestCastSession,
    endCastSession,
  }), [
    audioData, queueSongs, previousQueue, currentSong, isPlaying, currentTimeSec, 
    durationSec, volume, lyricsData, lyricsLoading, knowFacts, 
    knowLoading, likedSongs, likedLibraryTracks, songIsInLikedLibrary, resolveLikedLibraryRateVideoId, upNextQueue, playedHistory, aiLoading, 
    isRightSidebarOpen, isExpandedPlayerOpen, selectedPlaylist, palette,
    onSongClick, onNext, onPrev, onTogglePlay, onSeek, onRateSong, playVideo, pauseVideo, pauseBackgroundPlayer, viewMode, setViewMode,
    setIsPlaying, setQueueSongs, setPreviousQueue, setUpNextQueue, rightSidebarMode, overrideArtwork, setOverrideArtwork, liveMetadata,
    isJamActive, isCastApiAvailable, isCasting, requestCastSession, endCastSession
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
      {/* Dual HTML5 Audio Elements for Web Audio API Crossfade */}
      <audio
        ref={audio1Ref}
        style={{ display: "none" }}
        onPlay={() => {
          if (activePlayerIndex.current === 1) setIsPlaying(true);
        }}
        onPause={() => {
          if (activePlayerIndex.current === 1 && userIntentRef.current === "paused") {
            setIsPlaying(false);
          }
        }}
        onEnded={() => {
          if (activePlayerIndex.current === 1 && !crossfadeActiveRef.current) {
            onNext();
          }
        }}
        onError={(e) => console.warn("Audio player 1 error:", e)}
      />
      <audio
        ref={audio2Ref}
        style={{ display: "none" }}
        preload="auto"
        onPlay={() => {
          if (activePlayerIndex.current === 2) setIsPlaying(true);
        }}
        onPause={() => {
          if (activePlayerIndex.current === 2 && userIntentRef.current === "paused") {
            setIsPlaying(false);
          }
        }}
        onEnded={() => {
          if (activePlayerIndex.current === 2 && !crossfadeActiveRef.current) {
            onNext();
          }
        }}
        onError={(e) => console.warn("Audio player 2 error:", e)}
      />
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
