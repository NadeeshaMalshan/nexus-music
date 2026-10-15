"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video, PlaySquare, Maximize, MoreHorizontal, User, Disc, Info, Link2, X, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { m, AnimatePresence } from "motion/react";
import { MOTION_CONFIG, APPLE_LYRICS_TRANSITION } from "@/lib/animations";
import { type ExpandedPlayerProps } from "./types";
import { parseLyrics, findActiveLineIndex, findActiveWordIndex, type LyricsLine } from "@/lib/lrc";
import { MusicArtwork } from "./MusicArtwork";
import { AnimatedCanvasArtwork } from "./AnimatedCanvasArtwork";
import { useSettings } from "@/context/SettingsContext";
import { useJam } from "@/context/JamContext";

interface YouTubePlayer {
  getPlayerState: () => number;
  playVideo: () => void;
  pauseVideo: () => void;
  setVolume: (volume: number) => void;
  getCurrentTime: () => number;
}

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

import { useDashboard } from "@/context/DashboardContext";
import { FlowingBackground } from "./FlowingBackground";
import { LiveLikeToast } from "./LiveLikeToast";
import { MarqueeText } from "./MarqueeText";
import { KaraokeWordLine } from "./KaraokeWordLine";
import React from "react";

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
        transform: "scale(1.02) translate3d(8px, 0, 0)",
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
      className={`group flex items-center origin-left transform-gpu ${
        hasSynced ? "z-10 cursor-pointer" : "cursor-default"
      } ${
        isInstrumental
          ? (isActive ? "h-[64px]" : "h-[36px]")
          : !line || !line.trim()
            ? "h-[32px]"
            : "py-6"
      } ${!isActive && hasSynced ? "hover:opacity-75 hover:filter-none hover:scale-[0.99]" : ""}`}
    >
      {isInstrumental ? (
        <div className={`flex gap-4 items-center h-full transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-30"}`}>
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
          sizeVariant="desktop"
        />
      ) : (
        <p className={`w-full origin-left whitespace-pre-wrap break-words text-balance font-extrabold tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] text-[44px] leading-[1.15] ${
          isActive ? "text-white" : "text-white/90"
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

export function DesktopExpandedPlayer({
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
  setCurrentTimeSec,
  setIsPlaying,
  viewMode,
  setViewMode,
  onClearQueue,
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
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "ai" | "controls">(viewMode === "video" ? "controls" : "lyrics");
  const [isControlsVisible] = useState(true);
  const [liveLikeToast, setLiveLikeToast] = useState<{ title: string; artist: string; artwork?: string | null } | null>(null);
  const [hasOpened, setHasOpened] = useState(false);

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

  // Auto-switch tab if viewMode changes
  useEffect(() => {
    if (viewMode === "music" && activeTab === "controls") {
      setTimeout(() => setActiveTab("lyrics"), 0);
    }
  }, [viewMode, activeTab]);

  const ytPlayerInstance = useRef<YouTubePlayer | null>(null);
  const videoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref so callbacks always see the latest isPlaying without closure staleness
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  const onNextRef = useRef(onNext);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);

  const safeDuration = durationSec || currentSong.durationObj?.totalSeconds || 0;
  const safeDurationRef = useRef(safeDuration);
  useEffect(() => { safeDurationRef.current = safeDuration; }, [safeDuration]);

  const lastSkippedVideoIdRef = useRef<string | null>(null);

  // Increment key every time we ENTER video mode so the <YouTube> component
  // gets a completely fresh DOM slot — avoids "page couldn't load" errors caused
  // by the old player's cleanup racing with a new player init on the same element.
  const [videoKey, setVideoKey] = useState(0);
  const prevViewModeRef2 = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef2.current !== "video" && viewMode === "video") {
      setTimeout(() => {
        setVideoKey((k) => k + 1);
      }, 0);
      ytPlayerInstance.current = null; // clear stale ref before new player mounts
    }
    prevViewModeRef2.current = viewMode;
  }, [viewMode]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);
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
    // Align active line around 38% from top of container (Apple Music focus position)
    const targetScroll = Math.max(
      0,
      activeEl.offsetTop - (containerHeight * 0.38) + (activeEl.clientHeight / 2)
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
    if (activeTab !== "ai" || knowLoading || !isPlaying) return;

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
          // Resilience: if browser throttled/paused the player while we want it playing
          if (state === 2 && isPlayingRef.current) {
            try { p.playVideo(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }, 500);
    }
    return () => { if (videoSyncIntervalRef.current) clearInterval(videoSyncIntervalRef.current); };
  }, [viewMode, setCurrentTimeSec]);

  // Resume on tab/page becoming visible again (e.g. switching back from another app)
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
      origin: typeof window !== "undefined" ? window.location.origin : undefined,
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



  const renderTabSelector = () => (
    <div className="flex w-max max-w-full items-center gap-1 rounded-full border border-white/5 bg-black/40 p-1 backdrop-blur-3xl shadow-2xl relative">
      {viewMode === "video" && (
        <button
          type="button"
          onClick={() => setActiveTab("controls")}
          className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm z-10 ${activeTab === "controls" ? "text-white" : "text-white/60 hover:text-white"}`}
        >
          {activeTab === "controls" && (
            <m.div layoutId="active-tab-bg" className="absolute inset-0 bg-white/10 border border-white/5 rounded-full -z-10 shadow-sm" />
          )}
          <PlaySquare size={14} className="sm:h-4 sm:w-4" /> <span>Now Playing</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveTab("lyrics")}
        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm z-10 ${activeTab === "lyrics" ? "text-white" : "text-white/60 hover:text-white"}`}
      >
        {activeTab === "lyrics" && (
          <m.div layoutId="active-tab-bg" className="absolute inset-0 bg-white/10 border border-white/5 rounded-full -z-10 shadow-sm" />
        )}
        <Mic2 size={14} className="sm:h-4 sm:w-4" /> <span>Lyrics</span>
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("queue")}
        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm z-10 ${activeTab === "queue" ? "text-white" : "text-white/60 hover:text-white"}`}
      >
        {activeTab === "queue" && (
          <m.div layoutId="active-tab-bg" className="absolute inset-0 bg-white/10 border border-white/5 rounded-full -z-10 shadow-sm" />
        )}
        <ListMusic size={14} className="sm:h-4 sm:w-4" /> <span>Queue</span>
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("ai")}
        className={`relative flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm z-10 ${activeTab === "ai" ? "text-white" : "text-white/60 hover:text-white"}`}
      >
        {activeTab === "ai" && (
          <m.div layoutId="active-tab-bg" className="absolute inset-0 bg-white/10 border border-white/5 rounded-full -z-10 shadow-sm" />
        )}
        <BookOpen size={14} className="sm:h-4 sm:w-4" /> <span>Story</span>
      </button>
    </div>
  );

  const renderControls = (idKey: string, isCompact = false) => (
    <div key={idKey} className={`flex w-full flex-col justify-center ${viewMode === "video" ? "px-8 md:px-16" : ""} ${isCompact ? "gap-4" : ""}`}>
      {!isCompact && (
        <div className="mt-3 flex items-start justify-between">
          <div className="flex-1 pr-6 min-w-0">
            {liveMetadata && (
              <m.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-2 flex items-center gap-1.5"
              >
                <span className="px-2 py-0.5 rounded-[4px] bg-red-500 text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-red-500/20">
                  <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
                  Live Radio
                </span>
                <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] line-clamp-1">{liveMetadata.source}</span>
              </m.div>
            )}
            <MarqueeText
              text={liveMetadata?.title || currentSong.title}
              className="text-[32px] font-black tracking-tighter text-white leading-none mb-1"
            />
            <button
              onClick={() => onArtistClick?.(liveMetadata?.artist || currentSong.artist)}
              className="mt-1 w-full text-left hover:underline underline-offset-4"
            >
              <MarqueeText
                text={liveMetadata?.artist || currentSong.artist}
                className="text-lg font-medium text-white/70 hover:text-white transition-colors"
              />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0 relative">
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
                className="mt-1 rounded-full bg-white/5 p-2 hover:bg-white/10"
              >
                <Heart size={24} style={{ fill: isLiked ? 'var(--art-accent, #FA243C)' : 'none', color: isLiked ? 'var(--art-accent, #FA243C)' : 'rgb(255 255 255 / 0.7)' }} />
              </button>
            )}

            <button
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="mt-1 rounded-full bg-white/5 p-2 hover:bg-white/10 text-white/70 hover:text-white transition-all active:scale-90"
            >
              <MoreHorizontal size={24} />
            </button>

            {/* More Menu Dropdown */}
            {isMoreMenuOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setIsMoreMenuOpen(false)} />
                <div className="absolute right-0 bottom-full mb-2 z-40 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1e] p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] text-left">
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
      )}

      {!isReallyLive && (
        <div className={`${isCompact ? "mt-0" : "mt-3"} space-y-2`}>
          <div onClick={handleSeekClick} className="group relative h-1.5 w-full cursor-pointer rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/90" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-lg group-hover:scale-100" style={{ left: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[13px] font-semibold tracking-wide text-white/40">
            <span>{formatSeconds(currentTimeSec)}</span>
            <span>-{formatSeconds(safeDuration - currentTimeSec)}</span>
          </div>
        </div>
      )}

      <div className={`${isCompact ? "mt-1" : "mt-3"} flex items-center justify-center gap-10`}>
        <button
          onClick={onPrev}
          className="text-white/60 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
        >
          <SkipBack size={isCompact ? 32 : 42} fill="currentColor" strokeWidth={0} />
        </button>
        <button
          onClick={onTogglePlay}
          className={`flex ${isCompact ? "h-16 w-16" : "h-20 w-20"} items-center justify-center rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer shadow-lg`}
        >
          {isPlaying ? (
            <Pause size={isCompact ? 28 : 34} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={isCompact ? 28 : 34} fill="currentColor" strokeWidth={0} className={isCompact ? "ml-1" : "ml-1.5"} />
          )}
        </button>
        <button
          onClick={onNext}
          className="text-white/60 hover:text-white hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
        >
          <SkipForward size={isCompact ? 32 : 42} fill="currentColor" strokeWidth={0} />
        </button>
      </div>

      <div className={`${isCompact ? "mt-4 px-6" : "mt-8 px-4 pb-2"} flex w-full items-center gap-5`}>
        <m.div
          animate={{ scale: volume === 0 ? 0.8 : 1, opacity: volume === 0 ? 0.3 : 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Volume2 size={isCompact ? 16 : 18} className="text-white" />
        </m.div>

        <div className="relative group h-7 flex-1 flex items-center">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={volume}
            onChange={(e) => onVolumeChange(parseInt(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-30"
          />
          <div className="relative h-1.5 w-full rounded-full bg-white/10 z-10 pointer-events-none overflow-hidden">
            <m.div
              className="absolute inset-y-0 left-0 bg-white/90"
              animate={{ width: `${volume}%` }}
              transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.5 }}
            />
          </div>
          <m.div
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-20 pointer-events-none transition-transform"
            animate={{ left: `${volume}%`, scale: volume > 0 ? 1 : 0.8 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, mass: 0.5 }}
            style={{ x: "-50%" }}
          />
        </div>

        <m.div
          animate={{ scale: volume > 80 ? 1.15 : 1, opacity: volume > 0 ? 0.6 : 0.3 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <Volume2 size={isCompact ? 20 : 24} className="text-white" />
        </m.div>
      </div>
    </div>
  );

  const { jamState } = useJam();
  const [jamWarning, setJamWarning] = useState<string | null>(null);
  useEffect(() => {
    if (jamWarning) {
      const t = setTimeout(() => setJamWarning(null), 3000);
      return () => clearTimeout(t);
    }
  }, [jamWarning]);

  return (
    <m.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      onAnimationComplete={() => setHasOpened(true)}
      transition={{ type: "spring", damping: 30, stiffness: 200, mass: 1 }}
      className="fixed inset-0 z-[60] flex max-h-[100dvh] flex-col bg-black overflow-hidden"
    >
      <AnimatePresence>
        {jamWarning && (
          <m.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={MOTION_CONFIG.transition}
            className="absolute top-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-red-500/90 px-6 py-3 text-sm font-black text-white shadow-2xl backdrop-blur-md"
          >
            {jamWarning}
          </m.div>
        )}
      </AnimatePresence>

      <FlowingBackground palette={palette} artwork={liveMetadata?.artwork || currentSong.artwork} animate={hasOpened} />

      <AnimatePresence>
        {isControlsVisible && (
          <m.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            transition={MOTION_CONFIG.transition}
            className="relative z-40 w-full flex items-center px-8 py-4 animate-gpu"
          >
            <button onClick={onClose} className="p-2 rounded-full bg-black/20 hover:bg-black/40 active:scale-90 transition-transform"><ChevronDown size={32} className="text-white" /></button>
            <div className="flex-1" />
          </m.div>
        )}
      </AnimatePresence>

      <div className={`relative z-10 mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 px-8 pb-8 overflow-y-auto lg:overflow-visible custom-scrollbar transition-all duration-700 animate-gpu ${viewMode === 'video' ? 'max-w-[1800px] lg:grid-cols-[1.8fr_1fr]' : 'max-w-[1400px]'}`}>
        <div className={`mx-auto flex w-full flex-col items-center justify-center ${viewMode === 'video' ? 'max-w-full' : 'max-w-[400px]'} animate-gpu`}>
          <m.div className={`group relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl flex items-center justify-center animate-gpu transform-gpu ${viewMode === "music" ? "aspect-square" : "aspect-video"}`}>
            {(viewMode === "video" || isReallyLive) && (
              <div
                ref={videoContainerRef}
                className={`group/vid absolute inset-0 overflow-hidden ${viewMode === "music" ? "opacity-0 pointer-events-none" : "bg-black"}`}
              >
                <YouTube
                  key={`desktop-yt-${currentSong.musicVideoId || currentSong.id}-${videoKey}`}
                  videoId={currentSong.musicVideoId || currentSong.id}
                  opts={youtubeOpts}
                  iframeClassName="w-full h-full"
                  onReady={e => {
                    ytPlayerInstance.current = e.target;
                    e.target.setVolume(volume);
                    // For live streams in music mode, force tiny quality to save data
                    const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                    try { e.target.setPlaybackQuality(vq); } catch { }

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
                    if (e.data === 0) {
                      onNext();
                    } else if (e.data === 1) {
                      setIsPlaying(true);
                      // Force quality again after playback starts to ensure it sticks
                      const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                      try { e.target.setPlaybackQuality(vq); } catch { }
                    } else if (e.data === 2) {
                      if (!isPlayingRef.current) {
                        setIsPlaying(false);
                      } else {
                        setTimeout(() => {
                          try {
                            if (ytPlayerInstance.current?.getPlayerState?.() === 2 && isPlayingRef.current)
                              ytPlayerInstance.current.playVideo();
                          } catch { /* ignore */ }
                        }, 400);
                      }
                    } else if (e.data === 5) {
                      // CUED: If a new song has cued but isPlaying is true, start playing automatically
                      if (isPlayingRef.current) {
                        try {
                          e.target.playVideo();
                        } catch { /* ignore */ }
                      }
                    }
                  }}
                  className="h-full w-full origin-center pointer-events-none select-none"
                />

                {/* Interaction Blocker - Prevents YT internal UI from showing while allowing custom play/pause */}
                <div
                  className="absolute inset-0 z-10 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePlay();
                  }}
                />

                {/* Fullscreen Overlay Button */}
                {viewMode === "video" && (
                  <m.button
                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.2)" }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute bottom-8 right-8 z-[60] p-2.5 rounded-full bg-black/40 backdrop-blur-2xl border border-white/10 text-white/80 opacity-60 hover:opacity-100 transition-all duration-300 pointer-events-auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFullscreen();
                    }}
                    title="Fullscreen"
                  >
                    <Maximize size={18} />
                  </m.button>
                )}
              </div>
            )}
            {viewMode === "music" && (
              <AnimatedCanvasArtwork title={liveMetadata?.title || currentSong.title} artist={currentSong.artist} src={liveMetadata?.artwork || currentSong.artwork} alt={liveMetadata?.title || currentSong.title} iconSize={48} />
            )}
          </m.div>
          <div className="mt-6 flex w-full justify-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md max-w-[200px] relative">
            <button
              onClick={() => setViewMode("music")}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all duration-300 z-10 ${viewMode === "music" ? "text-black" : "text-white/60 hover:text-white"}`}
            >
              {viewMode === "music" && (
                <m.div layoutId="view-mode-bg" className="absolute inset-0 bg-white rounded-full -z-10" />
              )}
              <Music size={14} /> Music
            </button>
            <button
              onClick={() => {
                if (jamState.roomId) {
                  setJamWarning("Can't switch to video mode while jamming");
                  return;
                }
                setViewMode("video");
              }}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all duration-300 z-10 ${viewMode === "video" ? "text-black" : "text-white/60 hover:text-white"}`}
            >
              {viewMode === "video" && (
                <m.div layoutId="view-mode-bg" className="absolute inset-0 bg-white rounded-full -z-10" />
              )}
              <Video size={14} /> Video
            </button>
          </div>
          <div className="mt-6">{renderTabSelector()}</div>
          {viewMode === "music" && renderControls("left-controls")}
        </div>

        <div className="h-full max-w-[800px] w-full flex flex-col justify-center">
          {(viewMode === "video" || (viewMode === "music" && activeTab === "controls")) && activeTab === "controls" ? (
            <div className="flex h-full w-full items-center justify-center">{renderControls("right-controls")}</div>
          ) : (
            <div className="h-[75vh] w-full flex flex-col overflow-hidden">
              <AnimatePresence mode="wait">
                {activeTab === "lyrics" && (
                  <m.div
                    key="lyrics"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={MOTION_CONFIG.transition}
                    className="flex-1 overflow-hidden flex items-center justify-center"
                  >
                    {(!lyricsContent || lyricsContent === "Loading lyrics..." || lyricsContent === "Lyrics not available for this track yet.") ? (
                      <div className="w-full flex items-center justify-start py-6">
                        <p className="w-full origin-left whitespace-pre-wrap break-words text-balance font-extrabold tracking-tight drop-shadow-2xl text-[44px] leading-[1.1] text-white/40">
                          {lyricsContent || "Lyrics not available for this track yet."}
                        </p>
                      </div>
                    ) : (
                      <div
                        ref={scrollRef}
                        className="h-full w-full overflow-y-auto custom-scrollbar px-4 pt-[35vh] pb-[50vh] no-scrollbar will-change-scroll"
                        style={{
                          maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                        }}
                      >
                        <div className="max-w-2xl ml-0 text-left">
                          {lines.map((l, i) => (
                            <LyricLine
                              key={i}
                              line={l}
                              index={i}
                              activeIndex={activeIndex}
                              isActive={i === activeIndex}
                              isInstrumental={displayHasSynced && syncedLines[i]?.isInstrumental}
                              syncedLine={displayHasSynced ? syncedLines[i] : null}
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

                          {/* Lyrics Credits */}
                          {(geniusData?.writers || lyricsSource) && (
                            <div className="mt-24 border-t border-white/10 pt-12 pb-20 space-y-5">
                              {geniusData?.writers && (
                                <div className="space-y-1">
                                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/30">Written By</p>
                                  <p className="text-xl font-bold text-white/60 leading-tight">
                                    {geniusData.writers.join(", ")}
                                  </p>
                                </div>
                              )}
                              {lyricsSource && (
                                <div className="flex items-center gap-2 pt-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/20">Lyrics provided by</p>
                                  <span className="px-2 py-0.5 rounded-sm bg-white/5 text-[9px] font-black text-white/40 tracking-tighter uppercase">{lyricsSource}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </m.div>
                )}
                {activeTab === "queue" && (
                  <m.div
                    key="queue"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={MOTION_CONFIG.transition}
                    className="flex-1 overflow-hidden"
                  >
                    <div className="h-full overflow-y-auto custom-scrollbar px-6 pt-10 pb-32 no-scrollbar">
                      <div className="flex items-end justify-between mb-8 border-b border-white/5 pb-4">
                        <div>
                          <h2 className="text-4xl font-black text-white tracking-tight">Queue</h2>
                          <p className="text-white/40 text-sm font-bold uppercase tracking-widest mt-1">Up Next</p>
                        </div>
                        <button
                          onClick={() => onClearQueue?.()}
                          className="p-3 rounded-full bg-white/5 text-white/30 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                          title="Clear Queue"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>

                      {/* Current Song - Now Playing */}
                      <div className="mb-10">
                        <p className="text-[11px] font-black text-white/30 uppercase tracking-[0.2em] mb-4">Now Playing</p>
                        <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5 shadow-2xl backdrop-blur-3xl">
                          <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden shadow-sm">
                            <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate font-black text-white text-[16px] leading-tight">{currentSong.title}</p>
                            <button
                              onClick={() => onArtistClick?.(currentSong.artist)}
                              className="truncate text-sm font-bold text-white/40 hover:text-white/70 transition-colors mt-0.5 text-left"
                            >
                              {currentSong.artist}
                            </button>
                          </div>
                          <div className="pr-2">
                            <div className="flex gap-0.5 items-end h-3">
                              <div className="w-0.5 h-full bg-(--art-accent,#FA243C) animate-pulse" />
                              <div className="w-0.5 h-[60%] bg-(--art-accent,#FA243C) animate-pulse" />
                              <div className="w-0.5 h-[80%] bg-(--art-accent,#FA243C) animate-pulse" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {upNextQueue.map((s, i) => (
                          <div
                            key={s.id}
                            onClick={() => onSongClick(s, false)}
                            className="flex items-center gap-4 py-2.5 px-3 rounded-xl hover:bg-white/5 group cursor-pointer transition-all active:scale-[0.98]"
                          >
                            <div className="relative h-10 w-10 shrink-0 rounded-md overflow-hidden shadow-xs opacity-80 group-hover:opacity-100 transition-opacity">
                              <MusicArtwork src={s.artwork} alt={s.title} iconSize={14} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-bold text-white text-[15px] leading-tight">{s.title}</p>
                              <p className="truncate text-xs font-bold text-white/30 mt-0.5">{s.artist}</p>
                            </div>
                            <div className="flex items-center">
                              <button
                                onClick={e => { e.stopPropagation(); onRemoveFromUpNext?.(i); }}
                                className="p-2 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-500 transition-all transform translate-x-2 group-hover:translate-x-0"
                              >
                                <Trash2 size={16} />
                              </button>
                              <GripVertical size={16} className="text-white/5 cursor-grab active:cursor-grabbing" />
                            </div>
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
                    className="flex-1 flex flex-col h-full overflow-hidden"
                  >
                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <h2 className="text-4xl font-black text-white tracking-tight">Story</h2>
                          <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.3em] mt-1">By: GENIUS</p>
                        </div>
                      </div>
                      <div className="flex flex-1 gap-1.5 ml-10">
                        {knowFacts.map((_, i) => (
                          <div
                            key={i}
                            onClick={() => handleStoryJump(i)}
                            className="relative h-2 flex-1 rounded-full bg-white/10 overflow-hidden cursor-pointer group/bar"
                          >
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                            <div
                              className="absolute inset-y-0 left-0 bg-white/70 transition-all duration-[100ms] linear pointer-events-none"
                              style={{
                                width: i < storyActiveIndex ? "100%" : i === storyActiveIndex ? `${storyProgress}%` : "0%"
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex-1 relative overflow-hidden px-12 pt-10 pb-24">
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
                        <div className="flex flex-col items-center justify-center h-full gap-8 opacity-60">
                          <div className="relative">
                            <div className="w-20 h-20 border-2 border-white/5 rounded-full" />
                            <div className="absolute top-0 left-0 w-20 h-20 border-2 border-t-white/40 rounded-full animate-spin" />
                          </div>
                          <div className="text-center space-y-2">
                            <p className="text-white/60 uppercase tracking-[0.4em] text-xs font-black">Syncing with the Cosmos</p>
                            <p className="text-white/20 text-[11px] font-bold italic">Curating historical data points...</p>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-x-12 top-12 bottom-20">
                          <AnimatePresence mode="wait">
                            {knowFacts.length > 0 ? (
                              <m.div
                                key={storyActiveIndex}
                                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 1.05, y: -15 }}
                                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                className="absolute inset-0 flex flex-col justify-center p-8 sm:p-16"
                              >
                                <div className="flex-1 flex flex-col justify-center">
                                  <p className={`font-black leading-[1.1] text-white tracking-tighter [text-shadow:0_4px_24px_rgba(0,0,0,0.6)] text-left text-balance py-4 ${knowFacts[storyActiveIndex].length > 200 ? 'text-[36px]' : knowFacts[storyActiveIndex].length > 100 ? 'text-[48px]' : 'text-[64px]'}`}>
                                    {knowFacts[storyActiveIndex]}
                                  </p>
                                </div>
                                <div className="flex justify-center mt-8">
                                  <div className="h-1.5 w-16 bg-white/20 rounded-full" />
                                </div>
                              </m.div>
                            ) : (
                              <m.div
                                key="empty"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="absolute inset-0 flex flex-col items-center justify-center py-40 opacity-20 text-center max-w-lg mx-auto"
                              >
                                <BookOpen size={64} className="mb-8 opacity-20" />
                                <p className="text-2xl font-black italic leading-tight text-balance">This track&apos;s story is waiting for the perfect moment to reveal itself...</p>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Live Like Toast */}
      <AnimatePresence>
        {liveLikeToast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl text-left">
            <button
              onClick={() => setIsInfoModalOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-white/40 hover:bg-white/5 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-black text-white tracking-tight mb-6">Song Info</h3>
            <div className="flex gap-4 mb-6">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <MusicArtwork src={liveMetadata?.artwork || currentSong.artwork} alt={liveMetadata?.title || currentSong.title} iconSize={24} variant="track" rounded="md" className="h-full w-full" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <h4 className="font-bold text-white truncate leading-snug">{liveMetadata?.title || currentSong.title}</h4>
                <p className="text-sm text-white/60 truncate leading-snug">{liveMetadata?.artist || currentSong.artist}</p>
              </div>
            </div>
            <div className="space-y-4 border-t border-white/5 pt-4 text-sm font-medium">
              <div className="flex justify-between">
                <span className="text-white/40">Duration</span>
                <span className="text-white/85">{liveMetadata ? "Live" : (currentSong.duration || currentSong.durationObj?.label || "0:00")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">YouTube Video ID</span>
                <span className="text-white/85 select-all font-mono">{currentSong.id}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-white/40">Song Link</span>
                <div className="flex items-center gap-2 mt-1 rounded-xl bg-white/5 p-2 pr-3">
                  <span className="flex-1 text-xs text-white/60 truncate font-mono select-all">
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
                    {isCopied ? <span className="text-[10px] font-black text-green-400">Copied!</span> : <Copy size={14} />}
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
