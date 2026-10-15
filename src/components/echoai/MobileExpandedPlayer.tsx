"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Star, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video, Sparkles, Plus, PlaySquare, Maximize, MoreHorizontal, User, Disc, Info, Link2, X, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence, Reorder, useDragControls } from "motion/react";
import { APPLE_EASE, SLIDE_UP_VARIANTS, EXPO_OUT, MOTION_CONFIG, APPLE_LYRICS_TRANSITION } from "@/lib/animations";
import { type Song, type ExpandedPlayerProps } from "./types";
import { parseLyrics, findActiveLineIndex, findActiveWordIndex, type LyricsLine } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { SessionFriendsPanel } from "./SessionFriendsPanel";
import { MusicArtwork } from "./MusicArtwork";
import { AnimatedCanvasArtwork } from "./AnimatedCanvasArtwork";
import { useSettings } from "@/context/SettingsContext";
import { useJam } from "@/context/JamContext";

import { useDashboard } from "@/context/DashboardContext";
import { FlowingBackground } from "./FlowingBackground";
import { LiveLikeToast } from "./LiveLikeToast";
import { MarqueeText } from "./MarqueeText";
import { ArtistLinks } from "./ArtistLinks";
import { KaraokeWordLine } from "./KaraokeWordLine";
import React from "react";

interface LyricLineProps {
  line: string;
  index: number;
  activeIndex: number;
  isActive: boolean;
  isInstrumental?: boolean;
  syncedLine: LyricsLine | null;
  currentTimeSec: number;
  onSeek: (time: number) => void;
  syncedLines: LyricsLine[];
  hasSynced: boolean;
  elementsRef: React.RefObject<(HTMLDivElement | null)[]>;
}

const LyricLine = React.memo(({
  line,
  index,
  activeIndex,
  isActive,
  isInstrumental,
  syncedLine,
  currentTimeSec,
  onSeek,
  syncedLines,
  hasSynced,
  elementsRef
}: LyricLineProps) => {
  let instProgress = 0;
  if (isInstrumental && isActive && syncedLine) {
    const start = syncedLine.start;
    const next = syncedLines[index + 1];
    const end = next ? next.start : start + 5;
    const dur = end > start ? end - start : 5;
    instProgress = Math.max(0, Math.min(1, (currentTimeSec - start) / dur));
  }

  const dot1Op = 0.2 + 0.8 * Math.max(0, Math.min(1, instProgress / 0.33));
  const dot2Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.33) / 0.33));
  const dot3Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.66) / 0.34));

  const words = syncedLine?.words;
  const hasWordSync = Boolean(hasSynced && words && words.length > 0);

  // Compute 4 Apple Music lyric effects:
  // 1. Active lyric line: Bright white, bold text that stands out clearly
  // 2. Upcoming lyrics: Dimmed text with a subtle blur effect
  // 3. Previous lyrics: Move upward smoothly while gradually fading out and becoming more blurred
  const lineStyle: React.CSSProperties = React.useMemo(() => {
    if (!hasSynced || activeIndex < 0) {
      return {
        opacity: 0.8,
        filter: "blur(0px)",
        transform: "scale(1) translate3d(0, 0, 0)",
        transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
        willChange: "transform, opacity, filter",
      };
    }

    if (isActive) {
      return {
        opacity: 1,
        filter: "blur(0px)",
        transform: "scale(1.02) translate3d(6px, 0, 0)",
        transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
        willChange: "transform, opacity, filter",
      };
    }

    if (index > activeIndex) {
      // Upcoming lyrics: Dimmed text with a subtle blur effect
      return {
        opacity: 0.35,
        filter: "blur(1.5px)",
        transform: "scale(0.98) translate3d(0, 0, 0)",
        transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
        willChange: "transform, opacity, filter",
      };
    }

    // Previous lyrics: Move upward smoothly while gradually fading out and becoming more blurred
    const diff = activeIndex - index;
    let op = 0.02;
    let blurPx = 6.5;
    let scaleVal = 0.91;
    let yOffset = -8;

    if (diff === 1) {
      op = 0.28;
      blurPx = 2;
      scaleVal = 0.97;
      yOffset = -2;
    } else if (diff === 2) {
      op = 0.16;
      blurPx = 3.5;
      scaleVal = 0.95;
      yOffset = -4;
    } else if (diff === 3) {
      op = 0.08;
      blurPx = 5;
      scaleVal = 0.93;
      yOffset = -6;
    }

    return {
      opacity: op,
      filter: `blur(${blurPx}px)`,
      transform: `scale(${scaleVal}) translate3d(0, ${yOffset}px, 0)`,
      transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
      willChange: "transform, opacity, filter",
    };
  }, [hasSynced, activeIndex, index, isActive]);

  return (
    <div
      ref={el => { if (elementsRef.current) elementsRef.current[index] = el; }}
      onClick={() => hasSynced && syncedLine && onSeek(syncedLine.start)}
      style={lineStyle}
      className={`group flex items-center origin-left transform-gpu ${hasSynced ? "cursor-pointer" : "cursor-default"
        } ${isInstrumental
          ? (isActive ? "h-16" : "h-9")
          : !line || !line.trim()
            ? "h-8"
            : "py-5"
        } ${!isActive && hasSynced ? "hover:opacity-75 hover:filter-none hover:scale-[0.99]" : ""}`}
    >
      {isInstrumental ? (
        <div className={`flex gap-3 items-center h-full transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-30"}`}>
          <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.25 }} />
          <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.25 }} />
          <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.25 }} />
        </div>
      ) : hasSynced ? (
        <KaraokeWordLine
          words={words}
          lineText={line}
          syncedLine={syncedLine}
          currentTimeSec={currentTimeSec}
          isActive={isActive}
          isPastLine={hasSynced && activeIndex >= 0 && index < activeIndex}
          isUpcomingLine={hasSynced && activeIndex >= 0 && index > activeIndex}
          sizeVariant="mobile"
        />
      ) : (
        <p className={`w-full origin-left whitespace-pre-wrap break-words text-balance font-black tracking-tight drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] text-[38px] leading-[1.08] ${isActive ? "text-white" : "text-white/90"
          }`}>
          {line}
        </p>
      )}
    </div>
  );
}, (prev, next) => {
  if (prev.isActive !== next.isActive) return false;
  if (prev.activeIndex !== next.activeIndex) return false;
  if (prev.line !== next.line) return false;
  if (prev.index !== next.index) return false;
  if (prev.isInstrumental !== next.isInstrumental) return false;
  if (prev.syncedLine !== next.syncedLine) return false;
  if (next.isActive && next.hasSynced) {
    return prev.currentTimeSec === next.currentTimeSec;
  }
  return true;
});
LyricLine.displayName = "LyricLine";

export function MobileExpandedPlayer({
  onClose,
  currentSong,
  onSongClick,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  upNextQueue = [],
  onRemoveFromUpNext,
  lyricsContent,
  lyricsSource,
  lyricsLines,
  lyricsSyncType,
  currentTimeSec,
  durationSec,
  onSeek,
  volume,
  onVolumeChange,
  geniusData,
  knowFacts = [],
  knowLoading = false,
  onRateSong,
  isLiked = false,
  isLoggedIn,
  playVideo,
  pauseVideo,
  pauseBackgroundPlayer,
  setCurrentTimeSec,
  setIsPlaying,
  viewMode,
  setViewMode,
  onClearQueue,
  onReorderUpNext,
  onArtistClick,
  isOpen,
  setDurationSec,
}: ExpandedPlayerProps) {
  const { palette, resolveLikedLibraryRateVideoId, liveMetadata } = useDashboard();
  const { settings } = useSettings();
  const router = useRouter();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { jamState } = useJam();
  const [jamWarning, setJamWarning] = useState<string | null>(null);
  const [liveLikeToast, setLiveLikeToast] = useState<{ title: string; artist: string; artwork?: string | null } | null>(null);
  const [hasOpened, setHasOpened] = useState(false);
  const [hasAnimatedCover, setHasAnimatedCover] = useState(false);

  useEffect(() => {
    setHasAnimatedCover(false);
  }, [currentSong.id]);

  const handleToggleLike = () => {
    if (isLiked) {
      void onRateSong(resolveLikedLibraryRateVideoId(currentSong), "none");
    } else {
      const liveTitle = liveMetadata?.title;
      const liveArtist = liveMetadata?.artist;
      void (async () => {
        await onRateSong(
          currentSong.id,
          "like",
          liveTitle && liveArtist
            ? { title: liveTitle, artist: liveArtist }
            : { title: currentSong.title, artist: currentSong.artist }
        );
        setLiveLikeToast({
          title: liveTitle && liveArtist ? liveTitle : currentSong.title,
          artist: liveTitle && liveArtist ? liveArtist : currentSong.artist,
          artwork: liveMetadata?.artwork ?? currentSong.artwork,
        });
      })();
    }
  };

  const isMountedRef = useRef(false);
  useEffect(() => {
    if (isOpen) {
      if (isMountedRef.current) {
        setTimeout(() => setHasOpened(true), 0);
      }
    } else {
      setTimeout(() => setHasOpened(false), 0);
    }
    isMountedRef.current = true;
  }, [isOpen]);

  const videoContainerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!videoContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoContainerRef.current.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
  };

  useEffect(() => {
    if (jamWarning) {
      const t = setTimeout(() => setJamWarning(null), 3000);
      return () => clearTimeout(t);
    }
  }, [jamWarning]);
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "ai" | "controls" | "jam">("controls");
  const isAnimatedFullView = Boolean(hasAnimatedCover && activeTab === "controls" && viewMode === "music");
  const [imageError, setImageError] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const dragControls = useDragControls();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile specific: Immersive means when we are NOT in the "controls" tab
  const isImmersive = useMemo(() => activeTab !== "controls", [activeTab]);

  useEffect(() => {
    const resetTimer = () => {
      setIsControlsVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);

      // Auto-hide controls in immersive mode (Lyrics/Queue/AI)
      if (activeTab !== "controls") {
        timerRef.current = setTimeout(() => {
          setIsControlsVisible(false);
        }, 5000);
      }
    };

    const events = ["touchstart", "mousemove", "scroll", "click"];
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeTab]);


  const ytPlayerInstance = useRef<any>(null);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  const safeDuration = durationSec || currentSong.durationObj?.totalSeconds || 0;
  const safeDurationRef = useRef(safeDuration);
  useEffect(() => { safeDurationRef.current = safeDuration; }, [safeDuration]);

  const lastSkippedVideoIdRef = useRef<string | null>(null);

  // Fresh player key every time we enter video mode — prevents "page couldn't load"
  // caused by old player cleanup racing with new player init on the same DOM element.
  const [videoKey, setVideoKey] = useState(0);
  const prevViewModeRef2 = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef2.current !== "video" && viewMode === "video") {
      setVideoKey((k) => k + 1);
      ytPlayerInstance.current = null;
    }
    prevViewModeRef2.current = viewMode;
  }, [viewMode]);
  const videoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

  const storylineIndexRef = useRef(0);
  const capturedTimeRef = useRef<number>(0);
  const videoInitSeekRef = useRef<boolean>(false);

  const syncedLines = useMemo(() => {
    if (lyricsLines && lyricsLines.length > 0) {
      return lyricsLines;
    }
    const parsed = parseLyrics(lyricsContent || "");
    return parsed.lines;
  }, [lyricsLines, lyricsContent]);

  const plainLines = useMemo(() => {
    if (syncedLines.length > 0) {
      return syncedLines.map((l) => l.text);
    }
    return (lyricsContent || "")
      .replace(/\[\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?\]/g, "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [syncedLines, lyricsContent]);

  const hasSynced = syncedLines.length > 0 && lyricsSyncType !== "unsynced";

  const isReallyLive = useMemo(() => {
    const fallbackDuration = currentSong.duration ? (currentSong.duration.includes(":") ? currentSong.duration.split(":").reduce((acc, time) => (60 * acc) + parseInt(time), 0) : parseInt(currentSong.duration)) : 0;
    const safeDur = durationSec > 0 ? durationSec : (currentSong.durationObj?.totalSeconds || fallbackDuration || 0);
    const targetTitle = (liveMetadata?.title || currentSong.title || "").toLowerCase();
    return (
      currentSong.isLive ||
      currentSong.duration === "LIVE" ||
      !!liveMetadata ||
      safeDur > 43200 ||
      (safeDur === 0 &&
        isPlaying &&
        (targetTitle.includes("fest") ||
          targetTitle.includes("radio") ||
          targetTitle.includes("live")))
    );
  }, [currentSong, liveMetadata, isPlaying, durationSec]);

  const isDurationEqual = useMemo(() => {
    const parseDurationToSeconds = (durationStr: string): number => {
      if (!durationStr || durationStr === "LIVE") return 0;
      const parts = durationStr.split(":").map(Number);
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return parseFloat(durationStr) || 0;
    };
    const musicDuration = parseDurationToSeconds(currentSong.duration);
    return musicDuration > 0 && durationSec > 0 && Math.abs(musicDuration - durationSec) <= 2;
  }, [currentSong.duration, durationSec]);

  const displayHasSynced = hasSynced && !isReallyLive && (viewMode === "music" || isDurationEqual);
  const lines = displayHasSynced ? syncedLines.map(l => l.text) : plainLines;

  const activeIndex = displayHasSynced ? findActiveLineIndex(syncedLines, currentTimeSec) : -1;

  const scrollAnimRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth vertical scrolling when active lyric changes (Effect 4)
  useEffect(() => {
    if (!displayHasSynced || activeIndex < 0 || !scrollRef.current) return;
    if (activeTab !== "lyrics") return;
    if (isUserScrollingRef.current) return;

    const container = scrollRef.current;
    const activeEl = elementsRef.current[activeIndex];
    if (!activeEl) return;

    const containerHeight = container.clientHeight;
    // Align active line around 36% from top of container for mobile viewport
    const targetScroll = Math.max(
      0,
      activeEl.offsetTop - (containerHeight * 0.36) + (activeEl.clientHeight / 2)
    );

    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    const startScroll = container.scrollTop;
    const diff = targetScroll - startScroll;
    if (Math.abs(diff) < 2) return;

    const duration = 650; // ms
    const startTime = performance.now();
    // Quartic ease out curve (Apple-smooth fluid motion)
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      container.scrollTop = startScroll + diff * easeOut(progress);

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };

    scrollAnimRef.current = requestAnimationFrame(step);

    return () => {
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };
  }, [activeIndex, displayHasSynced, activeTab]);

  // Pause auto-scroll briefly when user manually scrolls
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onUserInteraction = () => {
      isUserScrollingRef.current = true;
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      userScrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 3500);
    };

    container.addEventListener("wheel", onUserInteraction, { passive: true });
    container.addEventListener("touchmove", onUserInteraction, { passive: true });

    return () => {
      container.removeEventListener("wheel", onUserInteraction);
      container.removeEventListener("touchmove", onUserInteraction);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [activeTab]);

  const [storyActiveIndex, setStoryActiveIndex] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);

  const handleStoryJump = (index: number) => {
    setStoryActiveIndex(index);
    setStoryProgress(0);
  };

  useEffect(() => {
    if (activeTab !== "ai" || knowLoading || !isPlaying) {
      // Don't reset everything, just stop the progress
      return;
    }

    const tick = 100; // ms
    const totalDuration = 10000; // 10s per fact

    const interval = setInterval(() => {
      setStoryProgress(prev => {
        if (prev >= 100) {
          if (knowFacts.length > 0) {
            setStoryActiveIndex((storyActiveIndex + 1) % knowFacts.length);
          }
          return 0;
        }
        return prev + (tick / totalDuration) * 100;
      });
    }, tick);

    return () => clearInterval(interval);
  }, [activeTab, knowLoading, isPlaying, storyActiveIndex, knowFacts.length]);

  useEffect(() => {
    if (viewMode === "video") {
      videoSyncIntervalRef.current = setInterval(() => {
        try {
          const p = ytPlayerInstance.current as any;
          if (!p) return;
          const state = p.getPlayerState?.();
          if (state === 1) {
            const time = p.getCurrentTime();
            const duration = p.getDuration ? p.getDuration() : 0;
            if (duration > 0 && Number.isFinite(duration)) {
              setDurationSec?.(duration);
            }
            if (time > 0 && Number.isFinite(time)) {
              setCurrentTimeSec(time);

              // Watchdog for background/minimized autoplay in video mode
              const dur = safeDurationRef.current;
              if (dur > 0 && time >= dur - 1.5 && isPlayingRef.current && lastSkippedVideoIdRef.current !== currentSong.id) {
                lastSkippedVideoIdRef.current = currentSong.id;
                onNextRef.current();
              }
            }
          }
          // Resilience: browser throttled the player while we want it playing
          if (state === 2 && isPlayingRef.current) {
            try { p.playVideo(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }, 500);
    }
    return () => { if (videoSyncIntervalRef.current) clearInterval(videoSyncIntervalRef.current); };
  }, [viewMode]);

  // Resume on page becoming visible again (returning from background/lock screen)
  useEffect(() => {
    if (viewMode !== "video") return;
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const p = ytPlayerInstance.current;
      if (!p) return;
      try {
        if (p.getPlayerState?.() === 2 && isPlayingRef.current) p.playVideo();
      } catch { /* ignore */ }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [viewMode]);

  useEffect(() => {
    const p = ytPlayerInstance.current;
    if ((viewMode === "video" || isReallyLive) && p) {
      const state = p.getPlayerState?.();
      if (isPlaying) {
        if (state !== 1 && state !== 3) p.playVideo();
      } else {
        if (state !== 2 && state !== 5) p.pauseVideo();
      }
    }
  }, [isPlaying, viewMode, isReallyLive, isOpen, currentSong.id]);



  useEffect(() => {
    if ((viewMode === "video" || currentSong.isLive) && ytPlayerInstance.current) {
      try { ytPlayerInstance.current.setVolume(volume); } catch { /* ignore */ }
    }
  }, [volume, viewMode, currentSong.isLive]);

  const youtubeOpts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      playsinline: 1,
      enablejsapi: 1,
      origin: typeof window !== "undefined" ? window.location.origin : undefined
    },
  };

  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;
  const formatSeconds = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeekClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  };

  const handleVolumeClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onVolumeChange(ratio * 100);
  };

  const renderTabSelector = () => (
    <div className="flex w-full items-center justify-around px-4">
      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "lyrics" ? "controls" : "lyrics")}
        className={`p-3 rounded-xl transition-all ${activeTab === "lyrics" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
      >
        <Mic2 size={24} />
      </button>
      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "queue" ? "controls" : "queue")}
        className={`p-3 rounded-xl transition-all ${activeTab === "queue" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
      >
        <ListMusic size={24} />
      </button>
      <button
        type="button"
        onClick={() => setActiveTab(activeTab === "ai" ? "controls" : "ai")}
        className={`p-3 rounded-xl transition-all ${activeTab === "ai" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
      >
        <BookOpen size={24} />
      </button>
    </div>
  );

  const renderControls = () => (
    <div className="flex w-full flex-col px-10">
      {/* Progress */}
      {!isReallyLive && (
        <div className="space-y-4 mb-2">
          <div onClick={handleSeekClick} className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/10 overflow-hidden">
            <m.div
              className="absolute inset-y-0 left-0 bg-white/60"
              animate={{ width: `${progress}%` }}
              transition={{ type: "tween", duration: 0.5 }}
            />
          </div>
          <div className="flex justify-between text-[13px] font-black tracking-tight text-white/20">
            <span>{formatSeconds(currentTimeSec)}</span>
            <span>-{formatSeconds(safeDuration - currentTimeSec)}</span>
          </div>
        </div>
      )}

      {/* Main Controls - Apple Style Spacing */}
      <div className="flex items-center justify-around py-4">
        <m.button
          whileTap={{ scale: 0.8 }}
          onClick={onPrev}
          className="text-white active:scale-90 transition-transform p-4"
        >
          <SkipBack size={48} fill="currentColor" />
        </m.button>
        <m.button
          whileTap={{ scale: 0.9 }}
          onClick={onTogglePlay}
          className="flex h-24 w-24 items-center justify-center text-white active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause size={72} fill="white" strokeWidth={0} /> : <Play size={72} fill="white" strokeWidth={0} className="ml-2" />}
        </m.button>
        <m.button
          whileTap={{ scale: 0.8 }}
          onClick={onNext}
          className="text-white active:scale-90 transition-transform p-4"
        >
          <SkipForward size={48} fill="currentColor" />
        </m.button>
      </div>

      {/* Volume - Apple Tactical Slider */}
      <div className="mt-6 flex items-center gap-6">
        <m.div
          animate={{ scale: volume === 0 ? 0.7 : 1, opacity: volume === 0 ? 0.3 : 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Volume2 size={16} className="text-white" />
        </m.div>

        <div className="relative h-2 flex-1 flex items-center group">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
          {/* Tactical Track */}
          <div className="relative h-2.5 w-full rounded-full bg-white/10 z-10 pointer-events-none overflow-hidden backdrop-blur-md border border-white/5">
            <m.div
              className="absolute inset-y-0 left-0 bg-white/70"
              animate={{ width: `${volume}%` }}
              transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.5 }}
            />
          </div>
          {/* Tactical Knob */}
          <m.div
            className="absolute top-1/2 h-7 w-7 -translate-y-1/2 rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-20 pointer-events-none border border-black/5"
            animate={{ left: `${volume}%`, scale: volume > 0 ? 1 : 0.85 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.5 }}
            style={{ x: "-50%" }}
          >
            <div className="absolute inset-0 rounded-full bg-linear-to-b from-white to-white/95" />
          </m.div>
        </div>

        <m.div
          animate={{
            scale: volume > 80 ? 1.2 : 1,
            opacity: volume > 80 ? 0.9 : 0.6
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Volume2 size={24} className="text-white" />
        </m.div>
      </div>
    </div>
  );

  return (
    <m.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      onAnimationComplete={() => setHasOpened(true)}
      transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
      drag="y"
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0 }}
      dragElastic={0.15}
      onDragEnd={(_, info) => {
        if (info.offset.y > 100 || info.velocity.y > 500) {
          onClose();
        }
      }}
      className="fixed inset-0 z-[60] flex flex-col bg-black overflow-hidden"
      style={{ backgroundColor: isAnimatedFullView ? (palette?.primary || "#18181b") : "#000000" }}
    >
      <AnimatePresence>
        {jamWarning && (
          <m.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            transition={MOTION_CONFIG.transition}
            className="absolute top-20 left-1/2 z-50 rounded-full bg-red-500/90 px-6 py-3 text-xs font-black text-white shadow-2xl backdrop-blur-md whitespace-nowrap"
          >
            {jamWarning}
          </m.div>
        )}
      </AnimatePresence>

      {/* Background */}
      {!isAnimatedFullView && (
        <FlowingBackground palette={palette} artwork={liveMetadata?.artwork || currentSong.artwork} animate={hasOpened} />
      )}

      {/* Top Grabber */}
      {!isAnimatedFullView && (
        <div
          className="relative z-50 flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 cursor-grab active:cursor-grabbing"
          onPointerDown={(e) => dragControls.start(e)}
        >
          <div className="h-1.5 w-12 rounded-full bg-white/20" onClick={onClose} />
        </div>
      )}

      {/* Mobile Top Bar */}
      <AnimatePresence mode="wait">
        {!isAnimatedFullView && isControlsVisible && (
          <m.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={MOTION_CONFIG.transition}
            className="relative z-40 flex items-center justify-between px-6 pt-4 pb-4 cursor-grab active:cursor-grabbing animate-gpu"
            onPointerDown={(e) => dragControls.start(e)}
          >
            {activeTab === "controls" ? (
              <div className="w-full flex items-center justify-between">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/5 backdrop-blur-md"
                >
                  <ChevronDown size={28} className="text-white/70" />
                </button>
                <div className="flex items-center gap-2 relative">
                  {isLoggedIn && (
                    <button
                      onClick={() => {
                        if (isLiked) {
                          void onRateSong(resolveLikedLibraryRateVideoId(currentSong), "none");
                        } else {
                          const liveTitle = liveMetadata?.title;
                          const liveArtist = liveMetadata?.artist;
                          void (async () => {
                            const result = await onRateSong(
                              currentSong.id,
                              "like",
                              liveTitle && liveArtist
                                ? { title: liveTitle, artist: liveArtist }
                                : { title: currentSong.title, artist: currentSong.artist }
                            );
                            // Always show success toast, never pending state
                            setLiveLikeToast({
                              title: liveTitle && liveArtist ? liveTitle : currentSong.title,
                              artist: liveTitle && liveArtist ? liveArtist : currentSong.artist,
                              artwork: liveMetadata?.artwork ?? currentSong.artwork,
                            });
                          })();
                        }
                      }}
                      className="p-2 rounded-full bg-white/5 backdrop-blur-md"
                    >
                      <Heart size={24} style={{ fill: isLiked ? 'var(--art-accent, #FA243C)' : 'none', color: isLiked ? 'var(--art-accent, #FA243C)' : 'rgb(255 255 255 / 0.7)' }} />
                    </button>
                  )}

                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className="p-2 rounded-full bg-white/5 backdrop-blur-md text-white/70 active:scale-90 transition-all"
                  >
                    <MoreHorizontal size={24} />
                  </button>

                  {/* More Menu Dropdown */}
                  {isMoreMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setIsMoreMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-left">
                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            onClose();
                            onArtistClick?.(liveMetadata?.artist || currentSong.artist);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <User size={18} className="text-white/40" />
                          <span>Go to Artist</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            onClose();
                            router.push(`/search?q=${encodeURIComponent(liveMetadata?.artist || currentSong.artist)} ${encodeURIComponent(liveMetadata?.title || currentSong.title)}`);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <Disc size={18} className="text-white/40" />
                          <span>Go to Album / Search</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsMoreMenuOpen(false);
                            setIsInfoModalOpen(true);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <Info size={18} className="text-white/40" />
                          <span>Song Info</span>
                        </button>

                        <button
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/?watch=${currentSong.id}`;
                            navigator.clipboard.writeText(shareUrl);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                            setIsMoreMenuOpen(false);
                          }}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                        >
                          <Link2 size={18} className="text-white/40" />
                          <span>Copy Song Link</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/5 backdrop-blur-md"
                >
                  <ChevronDown size={24} className="text-white/70" />
                </button>
                <m.div layoutId="compact-art" className="h-10 w-10 shrink-0 rounded-lg overflow-hidden shadow-lg animate-gpu">
                  <MusicArtwork src={liveMetadata?.artwork || currentSong.artwork} alt={liveMetadata?.title || currentSong.title} iconSize={16} />
                </m.div>
                <div className="flex-1 min-w-0">
                  <h2 className="truncate text-base font-black text-white">{liveMetadata?.title || currentSong.title}</h2>
                  <div className="truncate text-left">
                    <ArtistLinks
                      artist={liveMetadata?.artist || currentSong.artist}
                      onArtistClick={onArtistClick}
                      className="text-xs font-bold text-white/50"
                    />
                  </div>
                </div>
              </div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* 
           PERSISTENT PLAYER CONTAINER (Mobile)
           We keep the YouTube component mounted here so audio doesn't stop when switching tabs.
           When activeTab === 'controls', this container is positioned/sized based on viewMode.
           When activeTab !== 'controls', we hide it but keep it playing (z-index 0, opacity 0).
        */}
        {(viewMode === "video" || isReallyLive) && (
          <div
            className={`absolute transition-all duration-700 pointer-events-none ${activeTab === "controls"
              ? (viewMode === "video"
                ? "top-[16dvh] left-1/2 -translate-x-1/2 w-[90vw] max-w-[360px] aspect-video rounded-[16px] overflow-hidden opacity-100 z-20 scale-100 shadow-2xl"
                : "top-[13dvh] left-1/2 -translate-x-1/2 w-[70vw] aspect-square rounded-[20px] overflow-hidden opacity-0 z-0 scale-50")
              : "inset-0 opacity-0 z-0 pointer-events-none scale-0"
              }`}
          >
            <div ref={videoContainerRef} className="absolute inset-0 bg-black flex items-center justify-center">
              {currentSong.isLive && activeTab === "controls" && viewMode === "video" && (
                <div className="absolute top-4 left-4 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600/90 backdrop-blur-md shadow-lg pointer-events-none">
                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live</span>
                </div>
              )}
              <YouTube
                key={`mobile-yt-${currentSong.musicVideoId || currentSong.id}-${videoKey}`}
                videoId={currentSong.musicVideoId || currentSong.id}
                opts={youtubeOpts}
                iframeClassName="h-full w-full"
                onReady={e => {
                  ytPlayerInstance.current = e.target;
                  e.target.setVolume(volume);
                  const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                  try { e.target.setPlaybackQuality(vq); } catch (err) { }

                  // Seek check on mount (transition from music to video mode)
                  const parseDurationToSeconds = (durationStr: string): number => {
                    if (!durationStr || durationStr === "LIVE") return 0;
                    const parts = durationStr.split(":").map(Number);
                    if (parts.length === 2) {
                      return parts[0] * 60 + parts[1];
                    }
                    if (parts.length === 3) {
                      return parts[0] * 3600 + parts[1] * 60 + parts[2];
                    }
                    return parseFloat(durationStr) || 0;
                  };

                  const musicDuration = parseDurationToSeconds(currentSong.duration);
                  const videoDuration = e.target.getDuration();
                  const isDurationEqual = musicDuration > 0 && videoDuration > 0 && Math.abs(musicDuration - videoDuration) <= 2;

                  if (isDurationEqual && currentTimeSec > 0) {
                    e.target.seekTo(currentTimeSec, true);
                  } else if (!isDurationEqual) {
                    e.target.seekTo(0, true);
                  }

                  if (isPlaying) e.target.playVideo();
                }}
                onStateChange={e => {
                  if (e.data === 0) onNext();
                  else if (e.data === 1) {
                    setIsPlaying(true);
                    const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                    try { e.target.setPlaybackQuality(vq); } catch (err) { }
                  }
                  else if (e.data === 2) {
                    if (!isPlayingRef.current) setIsPlaying(false);
                    else {
                      setTimeout(() => {
                        try {
                          if (ytPlayerInstance.current?.getPlayerState?.() === 2 && isPlayingRef.current)
                            ytPlayerInstance.current.playVideo();
                        } catch { /* ignore */ }
                      }, 400);
                    }
                  }
                  else if (e.data === 5) {
                    // CUED: If a new song has cued but isPlaying is true, start playing automatically
                    if (isPlayingRef.current) {
                      try {
                        e.target.playVideo();
                      } catch { /* ignore */ }
                    }
                  }
                }}
                className="h-full w-full pointer-events-none select-none transition-transform duration-700"
              />
              {/* Interaction Blocker & Controls (Only active in controls + video mode) */}
              {activeTab === "controls" && viewMode === "video" && (
                <>
                  <div
                    className="absolute inset-0 z-30 pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePlay();
                    }}
                  />
                  <button
                    className="absolute bottom-6 right-6 z-50 p-3 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 text-white opacity-60 active:scale-90 transition-all shadow-2xl pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    title="Fullscreen"
                  >
                    <Maximize size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "controls" ? (
            isAnimatedFullView ? (
              <m.div
                key="animated-full-controls"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: EXPO_OUT }}
                className="flex flex-1 flex-col overflow-hidden animate-gpu"
                style={{ backgroundColor: palette?.primary || "#18181b" }}
              >
                {/* UPPER SECTION: Full Bleed Animated Motion Cover */}
                <div className="relative w-full h-[60dvh] overflow-hidden shrink-0 select-none">
                  <AnimatedCanvasArtwork
                    title={liveMetadata?.title || currentSong.title}
                    artist={currentSong.artist}
                    src={liveMetadata?.artwork || currentSong.artwork}
                    alt={liveMetadata?.title || currentSong.title}
                    iconSize={64}
                    onHasCanvasChange={setHasAnimatedCover}
                    className="h-full w-full object-cover"
                  />

                  {/* Soft bottom gradient fade into matching bottom cover color */}
                  <div
                    className="absolute inset-x-0 bottom-0 h-32 pointer-events-none z-10"
                    style={{
                      background: `linear-gradient(to bottom, transparent 0%, transparent 50%, ${palette?.primary || "#18181b"} 100%)`,
                    }}
                  />

                  {/* Top Overlay: Drag Handle + Audio/Video Toggle */}
                  <div className="absolute inset-x-0 top-0 z-30 flex flex-col items-center pt-[max(0.75rem,env(safe-area-inset-top))] px-6 pointer-events-auto">
                    <div
                      className="h-1.5 w-10 rounded-full bg-white/40 mb-3 cursor-grab active:cursor-grabbing hover:bg-white/60 transition-colors"
                      onClick={onClose}
                      onPointerDown={(e) => dragControls.start(e)}
                    />

                    {/* Audio / Video Toggle Pill */}
                    <div className="bg-black/35 backdrop-blur-xl border border-white/15 p-1 rounded-full inline-flex items-center gap-1 shadow-lg">
                      <button
                        type="button"
                        onClick={() => setViewMode("music")}
                        className="px-5 py-1.5 rounded-full text-xs font-bold transition-all bg-white text-black shadow-md scale-100"
                      >
                        Audio
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (jamState.roomId) {
                            setJamWarning("Video mode disabled in Jam");
                            return;
                          }
                          setViewMode("video");
                        }}
                        className="px-5 py-1.5 rounded-full text-xs font-bold transition-all text-white/80 hover:text-white"
                      >
                        Video
                      </button>
                    </div>
                  </div>
                </div>

                {/* LOWER SECTION: Track info, actions & controls with cover-matching color */}
                <div
                  className="relative z-20 flex flex-1 flex-col justify-between px-7 pb-3 pt-1"
                  style={{ backgroundColor: palette?.primary || "#18181b" }}
                >
                  {/* Track Info & Action Buttons */}
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-[25px] sm:text-[27px] font-bold text-white tracking-tight leading-tight truncate">
                          {liveMetadata?.title || currentSong.title}
                        </h2>
                        {/explicit/i.test(currentSong.title) && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded-[4px] bg-white/20 text-[10px] font-bold text-white/90">
                            E
                          </span>
                        )}
                      </div>
                      <div className="w-full text-left mt-0.5 truncate">
                        <ArtistLinks
                          artist={liveMetadata?.artist || currentSong.artist}
                          onArtistClick={onArtistClick}
                          className="text-[17px] font-medium text-white/60 tracking-normal hover:text-white/90 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Action buttons (Favorite & More) */}
                    <div className="flex items-center gap-2.5 shrink-0 relative">
                      <button
                        type="button"
                        onClick={handleToggleLike}
                        aria-label={isLiked ? "Unlike" : "Favorite"}
                        className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all shadow-sm"
                      >
                        <Star size={20} className={isLiked ? "fill-white text-white" : "text-white/80"} />
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                          aria-label="More options"
                          className="h-11 w-11 rounded-full bg-white/10 hover:bg-white/15 active:scale-90 backdrop-blur-md border border-white/10 flex items-center justify-center text-white transition-all shadow-sm"
                        >
                          <MoreHorizontal size={22} className="text-white/80" />
                        </button>

                        {/* More Menu Dropdown */}
                        {isMoreMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                            <div className="absolute right-0 bottom-full mb-3 z-50 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.7)] text-left">
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  onClose();
                                  onArtistClick?.(liveMetadata?.artist || currentSong.artist);
                                }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <User size={18} className="text-white/40" />
                                <span>Go to Artist</span>
                              </button>
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  onClose();
                                  router.push(`/search?q=${encodeURIComponent(liveMetadata?.artist || currentSong.artist)} ${encodeURIComponent(liveMetadata?.title || currentSong.title)}`);
                                }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <Disc size={18} className="text-white/40" />
                                <span>Go to Album / Search</span>
                              </button>
                              <button
                                onClick={() => {
                                  setIsMoreMenuOpen(false);
                                  setIsInfoModalOpen(true);
                                }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <Info size={18} className="text-white/40" />
                                <span>Song Info</span>
                              </button>
                              <button
                                onClick={() => {
                                  const shareUrl = `${window.location.origin}/?watch=${currentSong.id}`;
                                  navigator.clipboard.writeText(shareUrl);
                                  setIsCopied(true);
                                  setTimeout(() => setIsCopied(false), 2000);
                                  setIsMoreMenuOpen(false);
                                }}
                                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-white/80 transition-all hover:bg-white/10 hover:text-white"
                              >
                                <Link2 size={18} className="text-white/40" />
                                <span>Copy Song Link</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar & Timestamps with Lossless Badge */}
                  <div className="space-y-2 mt-3">
                    <div onClick={handleSeekClick} className="group relative h-1 w-full cursor-pointer rounded-full bg-white/20 overflow-hidden">
                      <m.div
                        className="absolute inset-y-0 left-0 bg-white/70 rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "tween", duration: 0.2 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-white/50 tracking-tight">
                      <span className="w-12 text-left tabular-nums">{formatSeconds(currentTimeSec)}</span>

                      <span className="w-12 text-right tabular-nums">-{formatSeconds(safeDuration - currentTimeSec)}</span>
                    </div>
                  </div>

                  {/* Playback Controls */}
                  <div className="flex items-center justify-center gap-14 py-2">
                    <m.button
                      whileTap={{ scale: 0.85 }}
                      onClick={onPrev}
                      className="text-white active:scale-90 transition-transform p-3"
                      aria-label="Previous track"
                    >
                      <SkipBack size={38} fill="white" strokeWidth={0} />
                    </m.button>
                    <m.button
                      whileTap={{ scale: 0.92 }}
                      onClick={onTogglePlay}
                      className="flex h-20 w-20 items-center justify-center text-white active:scale-95 transition-transform"
                      aria-label={isPlaying ? "Pause" : "Play"}
                    >
                      {isPlaying ? (
                        <Pause size={56} fill="white" strokeWidth={0} />
                      ) : (
                        <Play size={56} fill="white" strokeWidth={0} className="ml-1" />
                      )}
                    </m.button>
                    <m.button
                      whileTap={{ scale: 0.85 }}
                      onClick={onNext}
                      className="text-white active:scale-90 transition-transform p-3"
                      aria-label="Next track"
                    >
                      <SkipForward size={38} fill="white" strokeWidth={0} />
                    </m.button>
                  </div>

                  {/* Volume Tactical Bar */}
                  <div className="flex items-center gap-4 px-2 mt-1">
                    <Volume2 size={16} className="text-white/40 shrink-0" />
                    <div className="relative h-1.5 flex-1 flex items-center group cursor-pointer" onClick={handleVolumeClick}>
                      <div className="relative h-1.5 w-full rounded-full bg-white/15 overflow-hidden backdrop-blur-sm">
                        <div className="absolute inset-y-0 left-0 bg-white/70 rounded-full" style={{ width: `${volume}%` }} />
                      </div>
                    </div>
                    <Volume2 size={20} className="text-white/60 shrink-0" />
                  </div>
                </div>
              </m.div>
            ) : (
              <m.div
                key="controls"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.92 }}
                transition={{ duration: 0.7, ease: EXPO_OUT }}
                className="flex flex-1 flex-col items-center justify-between pb-12 animate-gpu"
              >
                {/* Artwork Section */}
                <div className="w-full flex-[1.4] flex items-center justify-center px-10">
                  <m.div
                    className={`relative w-full overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.6)] animate-gpu transform-gpu transition-all duration-500 ${viewMode === 'video' ? 'aspect-video max-w-[360px] rounded-[16px] border border-white/5' : 'aspect-square max-w-[340px] rounded-[20px] border border-white/10'}`}
                  >
                    {viewMode === "music" && (
                      <AnimatedCanvasArtwork
                        title={liveMetadata?.title || currentSong.title}
                        artist={currentSong.artist}
                        src={liveMetadata?.artwork || currentSong.artwork}
                        alt={liveMetadata?.title || currentSong.title}
                        iconSize={64}
                        onHasCanvasChange={setHasAnimatedCover}
                      />
                    )}
                  </m.div>
                </div>

                {/* Info & Switches Section */}
                <div className="w-full flex flex-col px-10 mt-2 mb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {liveMetadata && (
                        <m.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mb-2 flex items-center gap-1.5"
                        >
                          <span className="px-2 py-0.5 rounded-[4px] bg-red-600 text-[9px] font-black text-white uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-red-500/20">
                            <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                            Live Radio
                          </span>
                          <span className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] line-clamp-1">{liveMetadata.source}</span>
                        </m.div>
                      )}
                      <MarqueeText
                        text={liveMetadata?.title || currentSong.title}
                        className="text-[28px] leading-none font-black text-white tracking-tight mb-1"
                      />
                      <div className="w-full text-left mt-1.5">
                        <ArtistLinks
                          artist={liveMetadata?.artist || currentSong.artist}
                          onArtistClick={onArtistClick}
                          className="text-[19px] font-bold text-white/40"
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-2xl">
                      <button
                        onClick={() => setViewMode("music")}
                        className={`p-2 rounded-full transition-all ${viewMode === "music" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                      >
                        <Music size={15} />
                      </button>
                      <button
                        onClick={() => {
                          if (jamState.roomId) {
                            setJamWarning("Video mode disabled in Jam");
                            return;
                          }
                          setViewMode("video");
                        }}
                        className={`p-2 rounded-full transition-all ${viewMode === "video" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                      >
                        <Video size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Controls Section */}
                <div className="w-full">
                  {renderControls()}
                </div>

              </m.div>
            )
          ) : (
            <m.div
              key="immersive"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={MOTION_CONFIG.transition}
              className="flex flex-1 flex-col overflow-hidden animate-gpu"
            >
              <AnimatePresence mode="wait">
                {activeTab === "lyrics" && (
                  <m.div
                    key="lyrics"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={MOTION_CONFIG.transition}
                    className="flex-1 overflow-hidden"
                  >
                    <div
                      ref={scrollRef}
                      className="h-full overflow-y-auto px-8 pt-[35vh] pb-[50vh] custom-scrollbar no-scrollbar swipe-up will-change-scroll"
                      style={{
                        maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                        WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                      }}
                    >
                      <div className="max-w-2xl mx-auto">
                        {lines.map((line, index) => (
                          <LyricLine
                            key={index}
                            line={line}
                            index={index}
                            activeIndex={activeIndex}
                            isActive={index === activeIndex}
                            isInstrumental={displayHasSynced && syncedLines[index]?.isInstrumental}
                            syncedLine={displayHasSynced ? syncedLines[index] : null}
                            currentTimeSec={currentTimeSec}
                            onSeek={(t) => {
                              isUserScrollingRef.current = false;
                              onSeek(t);
                            }}
                            syncedLines={syncedLines}
                            hasSynced={displayHasSynced}
                            elementsRef={elementsRef}
                          />
                        ))}

                        {/* Mobile Lyrics Credits */}
                        {(geniusData?.writers || lyricsSource) && (
                          <div className="mt-20 border-t border-white/10 pt-12 pb-24 space-y-6 px-1">
                            {geniusData?.writers && (
                              <div className="space-y-1.5">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">Written By</p>
                                <p className="text-lg font-bold text-white/60 leading-tight">
                                  {geniusData.writers.join(", ")}
                                </p>
                              </div>
                            )}
                            {lyricsSource && (
                              <div className="flex items-center gap-2.5 pt-1">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-white/20">Lyrics via</p>
                                <span className="px-1.5 py-0.5 rounded-[2px] bg-white/5 text-[8px] font-black text-white/40 uppercase">{lyricsSource}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </m.div>
                )}

                {activeTab === "queue" && (
                  <m.div
                    key="queue"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={MOTION_CONFIG.transition}
                    className="flex-1 overflow-hidden"
                  >
                    <div className="h-full overflow-y-auto px-6 pt-6 pb-[40dvh] custom-scrollbar no-scrollbar">
                      <div className="flex items-end justify-between mb-8 border-b border-white/5 pb-4">
                        <div>
                          <h2 className="text-3xl font-black text-white tracking-tight">Queue</h2>
                          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Up Next</p>
                        </div>
                        <button
                          onClick={() => onClearQueue?.()}
                          className="px-4 py-1.5 rounded-full bg-white/5 text-white/40 text-[12px] font-black uppercase transition-all active:scale-95"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Current Song - Now Playing */}
                      <div className="mb-10">
                        <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] mb-3">Now Playing</p>
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-xl">
                          <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden shadow-sm">
                            <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-black text-white text-[15px] leading-tight">{currentSong.title}</p>
                            <button
                              onClick={() => onArtistClick?.(currentSong.artist)}
                              className="truncate text-xs font-bold text-white/40 active:text-white/70 transition-colors mt-0.5 text-left"
                            >
                              {currentSong.artist}
                            </button>
                          </div>
                          <div className="pr-1">
                            <div className="flex gap-0.5 items-end h-3">
                              <div className="w-0.5 h-full bg-(--art-accent,#FA243C) animate-pulse" />
                              <div className="w-0.5 h-[60%] bg-(--art-accent,#FA243C) animate-pulse" />
                              <div className="w-0.5 h-[80%] bg-(--art-accent,#FA243C) animate-pulse" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {upNextQueue.map((song, i) => (
                          <div
                            key={song.id}
                            onClick={() => onSongClick(song, false)}
                            className="flex items-center gap-4 py-2.5 px-2 rounded-xl active:bg-white/5 transition-all"
                          >
                            <div className="h-11 w-11 shrink-0 rounded-lg overflow-hidden shadow-sm opacity-90">
                              <MusicArtwork src={song.artwork} alt={song.title} iconSize={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-bold text-white text-[14px] leading-tight">{song.title}</p>
                              <button
                                onClick={(e) => { e.stopPropagation(); onArtistClick?.(song.artist); }}
                                className="truncate text-[11px] font-bold text-white/30 active:text-white/60 transition-colors mt-0.5 text-left"
                              >
                                {song.artist}
                              </button>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); onRemoveFromUpNext?.(i); }}
                              className="p-2 text-white/10 active:text-red-500 transition-colors"
                            >
                              <GripVertical size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </m.div>
                )}

                {activeTab === "ai" && (
                  <m.div
                    key="story"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={MOTION_CONFIG.transition}
                    className="flex-1 overflow-hidden"
                  >
                    <div className="flex flex-col h-full bg-linear-to-b from-black/20 to-transparent">
                      <div className="px-10 pt-8 pb-4 flex items-center justify-between border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-white/40">By: GENIUS</h3>
                        </div>
                        <div className="flex flex-1 gap-1.5 ml-6">
                          {knowFacts.map((_, i) => (
                            <div
                              key={i}
                              onClick={() => handleStoryJump(i)}
                              className="relative h-2 flex-1 rounded-full bg-white/10 overflow-hidden cursor-pointer group/bar"
                            >
                              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                              <div
                                className="absolute inset-y-0 left-0 bg-white/60 transition-all duration-[100ms] linear pointer-events-none"
                                style={{
                                  width: i < storyActiveIndex ? "100%" : i === storyActiveIndex ? `${storyProgress}%` : "0%"
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex-1 relative overflow-hidden px-6 pt-6 pb-24">
                        {/* Tap Navigation Zones */}
                        <div className="absolute inset-y-0 left-0 w-1/3 z-20" onClick={() => {
                          setStoryActiveIndex(prev => prev === 0 ? knowFacts.length - 1 : prev - 1);
                          setStoryProgress(0);
                        }} />
                        <div className="absolute inset-y-0 right-0 w-2/3 z-20" onClick={() => {
                          setStoryActiveIndex(prev => (prev + 1) % knowFacts.length);
                          setStoryProgress(0);
                        }} />

                        {knowLoading ? (
                          <div className="flex flex-col items-center justify-center h-full gap-6">
                            <div className="relative">
                              <div className="w-16 h-16 border-[3px] border-white/5 rounded-full" />
                              <div className="absolute top-0 left-0 w-16 h-16 border-[3px] border-t-white/40 rounded-full animate-spin" />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Sparkles size={20} className="text-white/20 animate-pulse" />
                              </div>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <p className="text-white/60 text-xs font-black uppercase tracking-[0.3em]">Echo AI</p>
                              <p className="text-white/30 text-[10px] font-bold">Unlocking track secrets...</p>
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-x-6 top-6 bottom-24">
                            <AnimatePresence mode="wait">
                              {knowFacts.length > 0 ? (
                                <m.div
                                  key={storyActiveIndex}
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 1.05, y: -10 }}
                                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                  className="absolute inset-0 flex flex-col justify-center p-8"
                                >
                                  <div className="flex-1 flex flex-col justify-center">
                                    <p className={`font-black text-white leading-[1.1] tracking-tighter [text-shadow:0_4px_24px_rgba(0,0,0,0.6)] text-left text-balance py-4 ${knowFacts[storyActiveIndex].length > 150 ? 'text-[28px]' : knowFacts[storyActiveIndex].length > 80 ? 'text-[36px]' : 'text-[46px]'}`}>
                                      {knowFacts[storyActiveIndex]}
                                    </p>
                                  </div>
                                  <div className="flex justify-center mt-6">
                                    <div className="h-1 w-12 bg-white/20 rounded-full" />
                                  </div>
                                </m.div>
                              ) : (
                                <m.div
                                  key="empty"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  className="absolute inset-0 flex flex-col items-center justify-center opacity-20 text-center px-4"
                                >
                                  <BookOpen size={48} className="mb-6 opacity-30" />
                                  <p className="text-lg font-bold italic leading-relaxed">The story of this track is still being written by the universe...</p>
                                </m.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {activeTab === "jam" && (
                <div className="flex-1 overflow-hidden px-4 pt-8 pb-56 swipe-up">
                  <SessionFriendsPanel className="h-full" />
                </div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Interface */}
      <AnimatePresence>
        {isControlsVisible && (
          <m.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={MOTION_CONFIG.transition}
            className={`relative z-50 flex flex-col gap-6 pt-4 pb-10 animate-gpu ${activeTab !== 'controls' ? 'bg-linear-to-t from-black/60 to-transparent' : ''}`}
          >
            {activeTab !== "controls" && (
              <div className="w-full">
                {renderControls()}
              </div>
            )}
            <div className="w-full">
              {renderTabSelector()}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Live Like Toast */}
      <AnimatePresence>
        {liveLikeToast && (
          <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[200] pointer-events-none px-4 w-full flex justify-center">
            <LiveLikeToast
              title={liveLikeToast.title}
              artist={liveLikeToast.artist}
              artwork={liveLikeToast.artwork}
              onDismiss={() => setLiveLikeToast(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Song Info Modal */}
      {isInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md px-6">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl text-left">
            <button
              onClick={() => setIsInfoModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-lg font-black text-white tracking-tight mb-5">Song Info</h3>
            <div className="flex gap-4 mb-5">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <MusicArtwork src={liveMetadata?.artwork || currentSong.artwork} alt={liveMetadata?.title || currentSong.title} iconSize={20} variant="track" rounded="md" className="h-full w-full" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-white truncate text-sm leading-snug">{liveMetadata?.title || currentSong.title}</h4>
                <p className="text-xs text-white/60 truncate leading-snug">{liveMetadata?.artist || currentSong.artist}</p>
              </div>
            </div>
            <div className="space-y-3.5 border-t border-white/5 pt-4 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-white/40">Duration</span>
                <span className="text-white/80">{liveMetadata ? "Live" : (currentSong.duration || currentSong.durationObj?.label || "0:00")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">YouTube Video ID</span>
                <span className="text-white/80 select-all font-mono">{currentSong.id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white/40">Song Link</span>
                <div className="flex items-center gap-2 mt-1 rounded-xl bg-white/5 p-2 pr-3">
                  <span className="flex-1 text-[10px] text-white/60 truncate font-mono select-all">
                    {typeof window !== "undefined" ? `${window.location.origin}/?watch=${currentSong.id}` : `/?watch=${currentSong.id}`}
                  </span>
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/?watch=${currentSong.id}`;
                      navigator.clipboard.writeText(shareUrl);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors shrink-0"
                  >
                    {isCopied ? <span className="text-[10px] font-black text-green-400">Copied!</span> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </m.div>
  );
}
