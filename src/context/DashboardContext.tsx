"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Song } from "@/components/echoai/types";
import { type YouTubePlaylist } from "@/lib/youtubeData";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { useSession } from "next-auth/react";
import { useArtworkColors } from "@/lib/useArtworkColors";
import { useSettings } from "./SettingsContext";
import { type LiveMetadata } from "@/lib/live-tracker";

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
  onRateSong: (songId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => Promise<void>;
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
  const [queueSongs, setQueueSongs] = useState<Song[]>([]);
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
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const isUsingNativeAudio = useMemo(() => {
    if (currentSong?.isLive) return false;
    return viewMode === "music" && !!directAudioUrl;
  }, [viewMode, directAudioUrl, currentSong?.isLive]);

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
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
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

  // Dynamic Tab Title
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (currentSong) {
      const prefix = isPlaying ? "▶ " : "";
      const displayTitle = liveMetadata?.title || currentSong.title;
      const displayArtist = liveMetadata?.artist || currentSong.artist;
      document.title = `${prefix}${displayTitle} — ${displayArtist}`;
    } else {
      document.title = "Nexus | Premium AI Ecosystem";
    }
  }, [currentSong, isPlaying, liveMetadata]);

  // Fetch liked songs
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/youtube/liked")
        .then((res) => res.json())
        .then((tracks) => {
          if (Array.isArray(tracks)) {
            const rows: LikedLibraryTrackRow[] = tracks
              .map((t: any) => ({
                videoId: String(t.videoId || "").trim(),
                title: String(t.title ?? ""),
                artist: String(t.artist ?? ""),
              }))
              .filter((r) => r.videoId);
            setLikedSongs(new Set(rows.map((r) => r.videoId)));
            setLikedLibraryTracks(rows);
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
    // Explicitly nullify audio data when track changes
    setAudioData(null);

    if (!audioQuery) {
      return;
    }
    const controller = new AbortController();
    async function loadAudioMeta() {
      const hasId = !!currentSong?.id;
      const isVideo = currentSong?.preferVideoPlayback || currentSong?.isLive;
      const cacheKey = hasId ? (`${currentSong.id}_${audioQuery}_${isVideo ? 'v' : 'a'}`) : audioQuery;
      
      if (audioCacheRef.current[cacheKey]) {
        const payload = audioCacheRef.current[cacheKey];
        setAudioData(payload);
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
        const payload = (await response.json()) as AudioPayload;
        audioCacheRef.current[cacheKey] = payload;
        setAudioData(payload);

        // If this was a direct link, sync refined metadata (clean artist/title) back to the song object
        if (currentSong?.isDirectLink && payload.videoId === currentSong.id) {
          if (payload.trackName !== currentSong.title || payload.artist !== currentSong.artist) {
            setCurrentSong((prev) =>
              prev?.id === payload.videoId
                ? {
                    ...prev,
                    title: payload.trackName || prev.title,
                    artist: payload.artist || prev.artist,
                    artwork: payload.coverArt || prev.artwork,
                  }
                : prev
            );
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
  }, [audioQuery]);

  // Direct URL Extraction for Music Mode
  useEffect(() => {
    // Explicitly nullify direct audio URL when track changes to prevent old track from persisting
    setDirectAudioUrl(null);

    if (!currentSong || viewMode !== "music") {
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
        const data = await response.json();
        if (data.url) {
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
    if (!currentSong) {
      setLyricsData(null);
      return;
    }
    const track = (liveMetadata?.title || currentSong.title)?.trim();
    const artist = (liveMetadata?.artist || currentSong.artist)?.trim();
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
  }, [currentSong, liveMetadata?.title, liveMetadata?.artist]);

  // Track session played history
  useEffect(() => {
    if (currentSong) {
      setPlayedHistory(prev => {
        const filtered = prev.filter(s => s.id !== currentSong.id);
        return [currentSong, ...filtered].slice(0, 20);
      });
    }
  }, [currentSong]);

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
      if (!settings.autoplay) return;
      try {
        const res = await fetch(`/api/queue?videoId=${currentSong!.id}`);
        if (!res.ok) {
          console.warn("[DashboardContext] Up Next API returned status:", res.status);
          setUpNextQueue([]);
          return;
        }
        const data = await res.json();
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
    if (!currentSong) {
      setKnowFacts([]);
      return;
    }
    const track = (liveMetadata?.title || currentSong.title)?.trim();
    const artist = (liveMetadata?.artist || currentSong.artist)?.trim();
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
      targetTitle.includes(" 24/7") ||
      (targetTitle.includes("live") && (targetTitle.includes("stream") || targetTitle.includes("festival") || targetTitle.includes("radio"))) ||
      (isPlaying && (safeDuration < 1 || currentSong?.duration === "0:00"));

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
          const data = await res.json();
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
    const mount = document.createElement("div");
    mount.id = playerElementId;
    mount.className =
      "fixed top-0 left-0 h-[1px] w-[1px] overflow-hidden opacity-[0.01] pointer-events-none z-[-1]";
    mount.setAttribute("aria-hidden", "true");
    document.body.appendChild(mount);

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
              if (duration > 0 && settingsRef.current.crossfade > 0 && currentSec >= (duration - settingsRef.current.crossfade)) {
                  const remaining = duration - currentSec;
                  const ratio = Math.max(0, remaining / settingsRef.current.crossfade);
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
                // We SKIP this for live streams because the expanded player owns them.
                if (userIntentRef.current === "playing" && document.visibilityState === 'hidden' && !currentSongRef.current?.isLive) {
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
              if (!isUsingNativeAudio || !nativeAudioRef.current) return;
              const audio = nativeAudioRef.current;
              
              if (!audio.paused && userIntentRef.current === "playing") {
                const current = audio.currentTime;
                const duration = audio.duration;
                
                if (Number.isFinite(current)) {
                  setCurrentTimeSec(current);
                }
                if (Number.isFinite(duration) && duration > 0) {
                  setDurationSec(duration);
                  
                  // Handle next track
                  const bufferTime = settingsRef.current.gaplessPlayback ? 1.0 : 0.5;
                  if (current >= duration - bufferTime) {
                    onNextRef.current();
                  }
                }

                // Apply Volume & Crossfade
                if (duration > 0 && settingsRef.current.crossfade > 0 && current >= (duration - settingsRef.current.crossfade)) {
                  const remaining = duration - current;
                  const ratio = Math.max(0, remaining / settingsRef.current.crossfade);
                  audio.volume = (volumeRef.current / 100) * ratio;
                } else {
                  audio.volume = volumeRef.current / 100;
                }
              }
            }, 500);

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
      mount.remove();
    };
  }, []); // Run only once

  const lastProcessedIdRef = useRef<string | null>(null);

  // Load / cue hidden player when resolved audio id OR currentSong id changes
  useEffect(() => {
    // Sync native audio if in use
    if (isUsingNativeAudio && nativeAudioRef.current) {
        const audio = nativeAudioRef.current;
        if (directAudioUrl && audio.src !== directAudioUrl) {
            audio.src = directAudioUrl;
            if (userIntentRef.current === "playing") {
                audio.play().catch(e => console.warn("Native audio play failed:", e));
                setIsPlaying(true);
            }
        }
        // Silence YT player
        try { ytPlayerRef.current?.pauseVideo(); ytPlayerRef.current?.setVolume(0); } catch {}
    }

    if (!ytPlayerRef.current || !isPlayerReady || isUsingNativeAudio) return;
    
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

  // Keep hidden player silent whenever expanded video mode is active (covers toggle without track change).
  useEffect(() => {
    const p = ytPlayerRef.current;
    if (nativeAudioRef.current) {
        nativeAudioRef.current.volume = volume / 100;
    }
    
    if (!p || !playerReadyRef.current) return;
    try {
      if (viewMode === "video" || currentSong?.isLive || isUsingNativeAudio) {
        p.setVolume(0);
        p.pauseVideo();
      } else {
        p.setVolume(volume);
      }
    } catch {
      /* ignore */
    }
  }, [viewMode, volume, isUsingNativeAudio, currentSong?.isLive]);

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
    if (viewMode === "video" || currentSongRef.current?.isLive) {
      setIsPlaying((v) => !v);
      userIntentRef.current = isPlayingRef.current ? "paused" : "playing";
      return;
    }

    if (isUsingNativeAudio && nativeAudioRef.current) {
        const audio = nativeAudioRef.current;
        if (audio.paused) {
            userIntentRef.current = "playing";
            try { audioCtxRef.current?.resume(); } catch {}
            audio.play().catch(() => {});
            setIsPlaying(true);
            if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(() => {});
        } else {
            userIntentRef.current = "paused";
            audio.pause();
            setIsPlaying(false);
            if (!silentAudioRef.current?.paused) silentAudioRef.current?.pause();
        }
        return;
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
  }, [isPlaying, viewMode, isUsingNativeAudio]);

  const playVideo = useCallback(() => {
    userIntentRef.current = "playing";
    
    // In video/live modes, the ExpandedPlayer component owns the YouTube instance and 
    // will react to the isPlaying state changing. We don't want to play the hidden player here.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setIsPlaying(true);
        return;
    }

    if (isUsingNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.play().catch(() => {});
        setIsPlaying(true);
        return;
    }

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.setVolume(volume);
    player.playVideo();
    setIsPlaying(true);
  }, [volume, isUsingNativeAudio]);

  const pauseVideo = useCallback(() => {
    userIntentRef.current = "paused";
    
    // For video/live mode, ExpandedPlayer will pause itself when isPlaying === false.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setIsPlaying(false);
        return;
    }

    if (isUsingNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.pause();
        setIsPlaying(false);
        return;
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
    setIsPlaying(false);
  }, [isUsingNativeAudio]);

  const pauseBackgroundPlayer = useCallback(() => {
    if (isUsingNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.pause();
        return;
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
  }, [isUsingNativeAudio]);

  const onSongClick = useCallback((song: Song, shouldResetQueue: boolean = true) => {
    if (shouldResetQueue) {
      setUpNextQueue([]);
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
    
    // Update local history
    setPlayedHistory((prev) => {
      // Filter out if already in history to move to top
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 50); // Keep last 50
    });
  }, [setViewMode, setIsExpandedPlayerOpen]);

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
    
    // In video/live modes, seeking should be handled by the ExpandedPlayer or ignored for live.
    if (viewModeRef.current === "video" || currentSongRef.current?.isLive) {
        setCurrentTimeSec(nextTimeSec);
        return; 
    }

    if (isUsingNativeAudio && nativeAudioRef.current) {
        nativeAudioRef.current.currentTime = nextTimeSec;
        setCurrentTimeSec(nextTimeSec);
        return;
    }

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    const safeDuration = durationSec > 0 ? durationSec : (youtubeTimestampToSeconds(currentSong?.duration ?? "") ?? 0);
    const clamped = Math.max(0, Math.min(nextTimeSec, safeDuration || nextTimeSec));
    player.seekTo(clamped, true);
    setCurrentTimeSec(clamped);
  }, [durationSec, currentSong?.duration, isUsingNativeAudio]);

  const onPrev = useCallback(() => {
    // With AI queue, 'Prev' usually just restarts the song
    onSeek(0);
  }, [onSeek]);

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

  const onRateSong = useCallback(async (songId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => {
    if (!session?.user) return;
    
    let targetId = (songId === currentSong?.id && audioData?.videoId) ? audioData.videoId : songId;
    let finalMeta = meta ?? (rating === "like" && songId === currentSong?.id && currentSong ? { title: currentSong.title, artist: currentSong.artist } : undefined);

    // LIVE STREAM HANDLING: If liking during a live stream with metadata, find the actual song ID
    if (rating === "like" && currentSong?.isLive && liveMetadata) {
      try {
        const query = `${liveMetadata.artist} - ${liveMetadata.title}`;
        const searchRes = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          const bestMatch = searchData.items?.find((item: any) => item.type === "SONG") || searchData.items?.[0];
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
      const res = await fetch("/api/youtube/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: targetId, rating }),
      });
      if (!res.ok) throw new Error("Failed to rate song");
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
    }
  }, [session?.user, currentSong, audioData, liveMetadata]);

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
    rightSidebarMode,
  }), [
    audioData, queueSongs, currentSong, isPlaying, currentTimeSec, 
    durationSec, volume, lyricsData, lyricsLoading, knowFacts, 
    knowLoading, likedSongs, likedLibraryTracks, songIsInLikedLibrary, resolveLikedLibraryRateVideoId, upNextQueue, playedHistory, aiLoading, 
    isRightSidebarOpen, isExpandedPlayerOpen, selectedPlaylist, palette,
    onSongClick, onNext, onPrev, onTogglePlay, onSeek, onRateSong, playVideo, pauseVideo, pauseBackgroundPlayer, viewMode, setViewMode,
    setIsPlaying, setUpNextQueue, rightSidebarMode, overrideArtwork, setOverrideArtwork, liveMetadata
  ]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
      {/* Hidden Native Audio Player for Direct URL Extraction */}
      <audio
        ref={nativeAudioRef}
        style={{ display: "none" }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
            if (userIntentRef.current === "paused") setIsPlaying(false);
        }}
        onEnded={() => onNext()}
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
