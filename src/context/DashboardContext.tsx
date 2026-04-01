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
  musicVideoId?: string;
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
  playedHistory: Song[];
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
  onSongClick: (song: Song, reset?: boolean) => void;
  onPlayPlaylist: (songs: Song[], startIndex: number) => void;
  onRateSong: (songId: string, rating: "like" | "none") => Promise<void>;
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
    loadVideoById: (videoId: string) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
    destroy: () => void;
  } | null>;
};

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  
  const ytPlayerRef = useRef<{
    playVideo: () => void;
    pauseVideo: () => void;
    loadVideoById: (videoId: string) => void;
    cueVideoById: (videoId: string, startSeconds?: number) => void;
    getCurrentTime: () => number;
    getDuration: () => number;
    seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
    setVolume: (volume: number) => void;
    destroy: () => void;
  } | null>(null);

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const isDirectAudioRef = useRef(false);
  
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
  const [isExpandedPlayerOpen, setIsExpandedPlayerOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(70);
  const [lyricsData, setLyricsData] = useState<LyricsPayload | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<YouTubePlaylist | null>(null);
  const [playedHistory, setPlayedHistory] = useState<Song[]>([]);
  const [upNextQueue, setUpNextQueue] = useState<Song[]>([]);
  const [knowFacts, setKnowFacts] = useState<string[]>([]);
  const [knowLoading, setKnowLoading] = useState(false);
  const [likedSongs, setLikedSongs] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"music" | "video">("music");
  const viewModeRef = useRef<"music" | "video">("music");

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  /** Hidden player: in video mode only cue + mute so expanded iframe is the sole audio source. */
  function syncHiddenPlayerForViewMode(
    player: NonNullable<(typeof ytPlayerRef)["current"]>,
    videoId: string,
    audioUrl?: string
  ) {
    // Check if we have a direct stream URL (starts with http or our proxy path but not youtube.com/watch)
    const isDirect = !!audioUrl && (audioUrl.startsWith("http") || audioUrl.startsWith("/api/audio/stream")) && !audioUrl.includes("youtube.com/watch");
    isDirectAudioRef.current = isDirect;

    if (viewModeRef.current === "video") {
      player.cueVideoById(videoId);
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
      queueMicrotask(() => {
        try {
          player.pauseVideo();
          player.setVolume(0);
        } catch {
          /* ignore */
        }
      });
    } else {
      if (isDirect && audioPlayerRef.current) {
        // Use native audio for background playback
        audioPlayerRef.current.src = audioUrl!;
        audioPlayerRef.current.volume = volume / 100;
        player.cueVideoById(videoId);
        player.pauseVideo();
        player.setVolume(0);
        if (isPlaying) audioPlayerRef.current.play().catch(e => console.warn("Auto-play blocked:", e));
      } else {
        // Fallback to YouTube iframe
        if (audioPlayerRef.current) {
            audioPlayerRef.current.pause();
            audioPlayerRef.current.src = "";
        }
        player.loadVideoById(videoId);
      }
    }
  }

  // Persistence: Load from localStorage on mount
  useEffect(() => {
    const loadPersistence = () => {
      try {
        const savedSong = localStorage.getItem("nexus_current_song");
        if (savedSong) {
          const parsed = JSON.parse(savedSong);
          // Only set if we don't have a current song (e.g. from an active session)
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
        return;
      }
      setAudioData(null);
      try {
        const response = await fetch(`/api/audio?query=${encodeURIComponent(audioQuery)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          console.warn("[DashboardContext] Audio metadata fetch returned status:", response.status);
          setAudioData(null);
          return;
        }
        const payload = (await response.json()) as AudioPayload;
        audioCacheRef.current[audioQuery] = payload;
        setAudioData(payload);
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


  // YouTube player: container is created imperatively on document.body so React never strips the iframe on re-renders.
  useEffect(() => {
    const mount = document.createElement("div");
    mount.id = playerElementId;
    mount.className =
      "fixed -bottom-full -left-full h-[1px] w-[1px] overflow-hidden opacity-0 pointer-events-none";
    mount.setAttribute("aria-hidden", "true");
    document.body.appendChild(mount);

    const audio = mount.appendChild(document.createElement("audio"));
    audio.id = "echoai-audio-player";
    audio.setAttribute("playsinline", "true");
    audio.preload = "auto";
    audioPlayerRef.current = audio;

    // Handle end of track for audio element
    audio.onended = () => {
        if (viewModeRef.current === "music" && isDirectAudioRef.current) {
            onNextRef.current();
        }
    };

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
            setIsPlayerReady(true);
            if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = window.setInterval(() => {
              const player = ytPlayerRef.current;
              const audio = audioPlayerRef.current;
              
              if (isDirectAudioRef.current && audio) {
                if (viewModeRef.current === "video") return;
                const current = audio.currentTime;
                const duration = audio.duration;
                if (Number.isFinite(current)) {
                    const bucket = Math.floor(current * 5);
                    if (bucket !== lastTimeBucketRef.current) {
                        lastTimeBucketRef.current = bucket;
                        setCurrentTimeSec(current);
                    }
                }
                if (Number.isFinite(duration) && duration > 0) setDurationSec(duration);
                return;
              }

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
              }
              if (Number.isFinite(duration) && duration > 0) setDurationSec(duration);
            }, 250);
            if (viewModeRef.current === "video") {
              ytPlayerRef.current?.setVolume(0);
              ytPlayerRef.current?.pauseVideo();
            } else {
              if (isDirectAudioRef.current && audioPlayerRef.current) {
                  ytPlayerRef.current?.setVolume(0);
                  ytPlayerRef.current?.pauseVideo();
              } else {
                  ytPlayerRef.current?.setVolume(volume);
              }
            }
          },
          onStateChange: (event: any) => {
            // Only sync isPlaying if we're NOT in video mode, to let the visible player lead state
            if (viewModeRef.current === "music") {
              if (event.data === 1) setIsPlaying(true);
              else if (event.data === 2) setIsPlaying(false);
              // ENDED: only advance from the hidden player in music mode (expanded video has its own player)
              if (event.data === 0) onNextRef.current();
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
      } catch {
        /* YT may already be torn down */
      }
      ytPlayerRef.current = null;
      playerReadyRef.current = false;
      if (audioPlayerRef.current) {
          audioPlayerRef.current.pause();
          audioPlayerRef.current.src = "";
      }
      mount.remove();
    };
  }, []); // Run only once

  // Load / cue hidden player when resolved audio id changes or player becomes ready
  useEffect(() => {
    if (!ytPlayerRef.current || !isPlayerReady || !audioData?.videoId) return;
    syncHiddenPlayerForViewMode(ytPlayerRef.current, audioData.videoId, audioData.audioUrl);
  }, [audioData?.videoId, audioData?.audioUrl, isPlayerReady]);

  // Keep hidden player silent whenever expanded video mode is active (covers toggle without track change).
  useEffect(() => {
    const p = ytPlayerRef.current;
    const a = audioPlayerRef.current;
    if (!p || !playerReadyRef.current) return;
    try {
      if (viewMode === "video") {
        p.setVolume(0);
        p.pauseVideo();
        if (a) a.pause();
      } else {
        if (isDirectAudioRef.current && a) {
            p.setVolume(0);
            p.pauseVideo();
            a.volume = volume / 100;
        } else {
            p.setVolume(volume);
            if (a) a.pause();
        }
      }
    } catch {
      /* ignore */
    }
  }, [viewMode, volume]);

  // Handlers
  const onTogglePlay = useCallback(() => {
    if (viewMode === "video") {
      // Expanded iframe is the only player; hidden must stay silent
      setIsPlaying((v) => !v);
      return;
    }
    
    if (isDirectAudioRef.current && audioPlayerRef.current) {
        if (audioPlayerRef.current.paused) {
            audioPlayerRef.current.play().catch(e => console.warn("Play failed:", e));
            setIsPlaying(true);
        } else {
            audioPlayerRef.current.pause();
            setIsPlaying(false);
        }
        return;
    }

    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    if (!isPlaying) {
      player.playVideo();
      setIsPlaying(true);
    } else {
      player.pauseVideo();
      setIsPlaying(false);
    }
  }, [isPlaying, viewMode]);

  const playVideo = useCallback(() => {
    if (isDirectAudioRef.current && audioPlayerRef.current) {
        audioPlayerRef.current.play().catch(e => console.warn("Play failed:", e));
        setIsPlaying(true);
        return;
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.setVolume(volume);
    player.playVideo();
    setIsPlaying(true);
  }, [volume]);

  const pauseVideo = useCallback(() => {
    if (isDirectAudioRef.current && audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        setIsPlaying(false);
        return;
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
    setIsPlaying(false);
  }, []);

  const pauseBackgroundPlayer = useCallback(() => {
    if (audioPlayerRef.current) audioPlayerRef.current.pause();
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current) return;
    player.pauseVideo();
  }, []);

  const onSongClick = useCallback((song: Song, shouldResetQueue: boolean = true) => {
    if (shouldResetQueue) {
      setUpNextQueue([]);
    }
    setCurrentSong(song);
    setCurrentTimeSec(0);
    setIsPlaying(true);
    
    // Update local history
    setPlayedHistory((prev) => {
      // Filter out if already in history to move to top
      const filtered = prev.filter((s) => s.id !== song.id);
      return [song, ...filtered].slice(0, 50); // Keep last 50
    });
  }, []);

  const onNext = useCallback(() => {
    if (upNextQueue.length > 0) {
      const next = upNextQueue[0];
      setUpNextQueue((prev) => prev.slice(1));
      onSongClick(next, false); // <--- Don't reset when auto-playing
      return;
    }
    setIsPlaying(false);
  }, [upNextQueue, onSongClick]);

  onNextRef.current = onNext;

  const onSeek = useCallback((nextTimeSec: number) => {
    if (isDirectAudioRef.current && audioPlayerRef.current) {
        if (Number.isFinite(nextTimeSec)) {
            audioPlayerRef.current.currentTime = nextTimeSec;
            setCurrentTimeSec(nextTimeSec);
        }
        return;
    }
    const player = ytPlayerRef.current;
    if (!player || !playerReadyRef.current || !Number.isFinite(nextTimeSec)) return;
    const safeDuration = durationSec > 0 ? durationSec : (youtubeTimestampToSeconds(currentSong?.duration ?? "") ?? 0);
    const clamped = Math.max(0, Math.min(nextTimeSec, safeDuration || nextTimeSec));
    player.seekTo(clamped, true);
    setCurrentTimeSec(clamped);
  }, [durationSec, currentSong?.duration]);

  const onPrev = useCallback(() => {
    // With AI queue, 'Prev' usually just restarts the song
    onSeek(0);
  }, [onSeek]);

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

  // Native Media Session API (Lock Screen Controls)
  useEffect(() => {
    if (typeof window === "undefined" || !("mediaSession" in navigator) || !currentSong) return;

    // Update Metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentSong.title,
      artist: currentSong.artist || "Unknown Artist",
      album: "EchoAI Music",
      artwork: [
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "96x96", type: "image/jpeg" },
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "128x128", type: "image/jpeg" },
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "192x192", type: "image/jpeg" },
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "256x256", type: "image/jpeg" },
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "384x384", type: "image/jpeg" },
        { src: currentSong.artwork || "/placeholder.jpg", sizes: "512x512", type: "image/jpeg" },
      ],
    });

    // Interaction Handlers
    const handlers = [
      ["play", onTogglePlay],
      ["pause", onTogglePlay],
      ["previoustrack", onPrev],
      ["nexttrack", onNext],
      ["seekto", (details: any) => {
        if (details.seekTime !== undefined) onSeek(details.seekTime);
      }],
    ] as const;

    handlers.forEach(([action, handler]) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler as any);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported yet.`);
      }
    });

    return () => {
      handlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch { /* ignore */ }
      });
    };
  }, [currentSong, onTogglePlay, onNext, onPrev, onSeek]);

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
  }), [
    audioData, queueSongs, currentSong, isPlaying, currentTimeSec, 
    durationSec, volume, lyricsData, lyricsLoading, knowFacts, 
    knowLoading, likedSongs, upNextQueue, playedHistory, aiLoading, 
    isRightSidebarOpen, isExpandedPlayerOpen, selectedPlaylist, palette,
    onSongClick, onNext, onPrev, onTogglePlay, onSeek, onRateSong, playVideo, pauseVideo, pauseBackgroundPlayer, viewMode, setViewMode
  ]);

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
