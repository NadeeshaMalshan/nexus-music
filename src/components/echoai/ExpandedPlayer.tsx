import { useMemo, useState, useRef, useEffect, type MouseEvent, useCallback } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";

interface ExpandedPlayerProps {
  onClose: () => void;
  currentSong: Song;
  onSongClick: (song: Song) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  queueSongs: Song[];
  lyricsContent: string | null;
  lyricsSource: string | null;
  currentTimeSec: number;
  durationSec: number;
  onSeek: (nextTimeSec: number) => void;
  volume: number;
  onVolumeChange: (nextVolume: number) => void;
  geniusData?: {
    found: boolean;
    songId: number | null;
    url: string | null;
    thumbnail: string | null;
    description?: string | null;
  };
  knowFacts?: string[];
  knowLoading?: boolean;
  onRateSong: (videoId: string, rating: "like" | "none") => void;
  onRemoveFromQueue?: (index: number) => void;
  onReorderQueue?: (newQueue: Song[]) => void;
  isLiked?: boolean;
  isLoggedIn?: boolean;
  playVideo: () => void;
  pauseVideo: () => void;
  pauseBackgroundPlayer: () => void;
  setCurrentTimeSec: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  viewMode: "music" | "video";
  setViewMode: (mode: "music" | "video") => void;
}

export function ExpandedPlayer({
  onClose,
  currentSong,
  onSongClick,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  queueSongs,
  lyricsContent,
  lyricsSource,
  currentTimeSec,
  durationSec,
  onSeek,
  volume,
  onVolumeChange,
  geniusData,
  knowFacts = [],
  knowLoading = false,
  onRateSong,
  onRemoveFromQueue,
  isLiked = false,
  isLoggedIn,
  playVideo,
  pauseVideo,
  pauseBackgroundPlayer,
  setCurrentTimeSec,
  setIsPlaying,
  viewMode,
  setViewMode,
}: ExpandedPlayerProps) {
  const [activeTab, setActiveTab] = useState<"lyrics" | "up-next" | "ai" | "controls">("controls");
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  
  const ytPlayerInstance = useRef<any>(null);
  const videoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const storylineRef = useRef<HTMLDivElement>(null);
  const storylineIndexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isImmersive = useMemo(() => isMobile && activeTab !== "controls", [isMobile, activeTab]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener("resize", handleResize);

    const resetTimer = () => {
      setIsControlsVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      
      // Only auto-hide if in immersive mode (Lyrics/Queue/AI) on mobile
      if (isMobile && activeTab !== "controls") {
        timerRef.current = setTimeout(() => {
          setIsControlsVisible(false);
        }, 4000); 
      }
    };

    const events = ["mousemove", "mousedown", "touchstart", "keydown", "scroll"];
    const cleanup = events.map(ev => {
      window.addEventListener(ev, resetTimer, { passive: true });
      return () => window.removeEventListener(ev, resetTimer);
    });

    resetTimer();

    return () => {
      window.removeEventListener("resize", handleResize);
      cleanup.forEach(fn => fn());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const plainLines = (lyricsContent || "").split("\n").map((l) => l.trim()).filter(Boolean);
  
  const syncedLines = useMemo(() => {
    const raw = parseLrcContent(lyricsContent || "");
    const cleaned = raw.reduce<{ at: number; text: string; isInstrumental: boolean }[]>((acc, line) => {
      const prev = acc[acc.length - 1];
      if (prev && Math.abs(prev.at - line.at) < 0.0001) {
        prev.text = `${prev.text}  /  ${line.text}`;
        prev.isInstrumental = false;
        return acc;
      }
      const isInst = !line.text.replace(/\[.*?\]/g, "").trim() || line.text.includes("♪") || line.text.toLowerCase().includes("instrumental");
      acc.push({ ...line, isInstrumental: isInst });
      return acc;
    }, []);

    // Detect if there's a long intro without lyrics and inject an Instrumental block
    if (cleaned.length > 0 && cleaned[0].at > 5) {
      cleaned.unshift({ at: 0, text: "", isInstrumental: true });
    }

    // Inject instrumental breaks for massive silences (>20 seconds) in the middle of a song
    const finalLines = [];
    for (let i = 0; i < cleaned.length; i++) {
      finalLines.push(cleaned[i]);
      if (i < cleaned.length - 1) {
        const gap = cleaned[i + 1].at - cleaned[i].at;
        if (gap > 20 && !cleaned[i].isInstrumental && !cleaned[i + 1].isInstrumental) {
          // Put the instrumental node right after the first line finishes reading
          finalLines.push({ at: cleaned[i].at + (gap * 0.3), text: "", isInstrumental: true });
        }
      }
    }
    return finalLines;
  }, [lyricsContent]);

  const hasSynced = syncedLines.length > 0;
  const activeIndex = hasSynced ? syncedLines.findIndex((line, index) => {
    const next = syncedLines[index + 1];
    return currentTimeSec >= line.at && (!next || currentTimeSec < next.at);
  }) : -1;

  const lines = hasSynced ? syncedLines.map(l => l.text) : plainLines;
  
  const fallbackDuration = youtubeTimestampToSeconds(currentSong.duration) ?? 0;
  const safeDuration = durationSec > 0 ? durationSec : fallbackDuration;

  useEffect(() => {
    if (!hasSynced || activeIndex < 0 || !scrollRef.current) return;
    if (activeTab !== "lyrics") return;
    
    // Delay slightly to allow DOM height transitions (e.g. h-0 to h-[140px]) to start before reading offsetTop
    requestAnimationFrame(() => {
      const activeEl = elementsRef.current[activeIndex];
      if (activeEl && scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight;
        const targetScroll = activeEl.offsetTop - (containerHeight * 0.20);
        
        scrollRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      }
    });
  }, [activeIndex, hasSynced, activeTab]);

  useEffect(() => {
    if (activeTab !== "ai" || knowLoading || !isPlaying) return;

    const interval = setInterval(() => {
      const el = storylineRef.current;
      if (!el) return;

      const items = el.querySelectorAll(".story-fact");
      if (items.length === 0) return;

      storylineIndexRef.current = (storylineIndexRef.current + 1) % (items.length + 1);

      if (storylineIndexRef.current === 0) {
        el.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const nextItem = items[storylineIndexRef.current - 1] as HTMLElement;
        el.scrollTo({ top: nextItem.offsetTop - 150, behavior: "smooth" });
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, knowLoading]);
  
  // Sync video time to global state
  useEffect(() => {
    if (viewMode === "video") {
      videoSyncIntervalRef.current = setInterval(() => {
        try {
          const p = ytPlayerInstance.current;
          if (!p) return;
          const time = p.getCurrentTime();
          if (time !== undefined && time !== null && Number.isFinite(time)) {
            setCurrentTimeSec(time);
          }
        } catch {
          /* iframe/player destroyed during track change */
        }
      }, 500);
    } else {
      if (videoSyncIntervalRef.current) {
        clearInterval(videoSyncIntervalRef.current);
        videoSyncIntervalRef.current = null;
      }
    }
    return () => {
      if (videoSyncIntervalRef.current) clearInterval(videoSyncIntervalRef.current);
    };
  }, [viewMode]);

  // Sync global isPlaying to video player (only when expanded video iframe is mounted)
  useEffect(() => {
    if (viewMode !== "video" || !ytPlayerInstance.current) return;
    if (isPlaying) ytPlayerInstance.current.playVideo();
    else ytPlayerInstance.current.pauseVideo();
  }, [isPlaying, viewMode]);

  useEffect(() => {
    if (viewMode !== "video") ytPlayerInstance.current = null;
  }, [viewMode]);

  useEffect(() => {
    ytPlayerInstance.current = null;
  }, [currentSong.id]);

  // Handle new song selection while in video mode
  useEffect(() => {
    if (viewMode === "video") {
      // Pause hidden audio only — do NOT set isPlaying false (would fight onSongClick / break next track)
      pauseBackgroundPlayer();
      setVideoStartTime(0);
    }
  }, [currentSong.id, viewMode, pauseBackgroundPlayer]);

  const youtubeOpts = useMemo(() => ({
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
    },
  }), []);

  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;

  const formatSeconds = useMemo(
    () => (seconds: number) => {
      const safe = Math.max(0, Math.floor(seconds || 0));
      const mins = Math.floor(safe / 60);
      const secs = safe % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
    []
  );

  function handleSeekClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(ratio * safeDuration);
  }

  function handleVolumeClick(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onVolumeChange(ratio * 100);
  }

  const renderControls = (idKey: string, isCompact = false) => (
    <div
      key={idKey}
      className={`flex w-full flex-col justify-center ${viewMode === "video" ? "px-8 md:px-16" : ""} ${isCompact ? "gap-4" : ""}`}
    >
      {/* Info - Hidden in compact mode as it's in the header */}
      {!isCompact && (
        <div className="mt-10 flex items-start justify-between">
          <div className="flex-1 pr-6 min-w-0">
            <h1 className="line-clamp-2 text-[28px] font-bold tracking-tight text-white leading-tight">
              {currentSong.title}
            </h1>
            <p className="mt-1 text-xl font-medium text-white/70 line-clamp-1">
              {currentSong.artist}
            </p>
          </div>
          {isLoggedIn && (
            <button 
              onClick={() => {
                onRateSong(currentSong.id, isLiked ? "none" : "like");
              }} 
              className="mt-1 rounded-full bg-white/5 p-2 transition-colors hover:bg-white/10"
            >
              <Heart size={26} className={isLiked ? "fill-[#FA243C] text-[#FA243C]" : "text-white/70"} fill={isLiked ? "#FA243C" : "none"} />
            </button>
          )}
        </div>
      )}

      {/* Progress */}
      <div className={`${isCompact ? "mt-0" : "mt-6"} space-y-2.5`}>
        <div
          onClick={handleSeekClick}
          className="group relative h-1.5 w-full cursor-pointer overflow-hidden rounded-full bg-white/20 backdrop-blur-sm md:overflow-visible"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-all duration-150 ease-out" style={{ width: `${progress}%` }} />
          <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-lg transition-transform group-hover:scale-100" style={{ left: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[13px] font-semibold tracking-wide text-white/50">
          <span>{formatSeconds(currentTimeSec)}</span>
          <span>-{formatSeconds(safeDuration - currentTimeSec)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className={`${isCompact ? "mt-2" : "mt-6"} flex items-center justify-center gap-12`}>
        <button onClick={onPrev} className="text-white/90 transition-all hover:scale-110 hover:text-white active:scale-95">
          <SkipBack size={isCompact ? 32 : 42} fill="currentColor" />
        </button>
        <button 
          onClick={() => {
            if (viewMode === "video" && ytPlayerInstance.current) {
              if (isPlaying) {
                ytPlayerInstance.current.pauseVideo();
                setIsPlaying(false);
              } else {
                ytPlayerInstance.current.playVideo();
                setIsPlaying(true);
              }
            } else {
              onTogglePlay();
            }
          }} 
          className={`flex ${isCompact ? "h-16 w-16" : "h-20 w-20"} items-center justify-center rounded-full border border-white/10 bg-white/20 backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/30 active:scale-95`}
        >
          {isPlaying ? (
            <Pause size={isCompact ? 32 : 38} fill="white" className="text-white" />
          ) : (
            <Play size={isCompact ? 32 : 38} fill="white" className="ml-2 text-white" />
          )}
        </button>
        <button onClick={onNext} className="text-white/90 transition-all hover:scale-110 hover:text-white active:scale-95">
          <SkipForward size={isCompact ? 32 : 42} fill="currentColor" />
        </button>
      </div>

      {/* Volume - Hidden in compact mode */}
      {!isCompact && (
        <div className="mt-6 flex w-full items-center gap-4 px-2 pb-1">
          <Volume2 size={20} className="text-white/60" />
          <div onClick={handleVolumeClick} className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20 backdrop-blur-sm">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-all duration-150 ease-out" style={{ width: `${volume}%` }} />
            <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-lg transition-transform group-hover:scale-100" style={{ left: `${volume}%` }} />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex max-h-[100dvh] flex-col bg-black">
      {/* Animated blurred background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageError ? "/images/default-artwork.png" : currentSong.artwork} 
          alt="" 
          className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-[120px] saturate-200" 
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Top bar / Compact Header */}
      <AnimatePresence>
        {isControlsVisible && (
          <motion.div 
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="relative z-40 flex w-full shrink-0 flex-col gap-4 border-b border-white/5 bg-black/20 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-4 backdrop-blur-3xl sm:border-0 sm:bg-transparent sm:px-8 sm:py-8 sm:backdrop-blur-0"
          >
            <div className="flex w-full items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="group shrink-0 rounded-full bg-black/20 p-2 backdrop-blur-md transition-colors hover:bg-black/40"
              >
                <ChevronDown className="h-7 w-7 text-white/80 transition-colors group-hover:text-white sm:h-8 sm:w-8" />
              </button>

              {isImmersive ? (
                <div className="flex flex-1 items-center gap-3 overflow-hidden px-2">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-white/10 shadow-lg">
                    <img src={currentSong.artwork} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black text-white">{currentSong.title}</h2>
                    <p className="truncate text-[11px] font-bold text-white/50">{currentSong.artist}</p>
                  </div>
                </div>
              ) : (
                 <div className="min-w-0 flex-1" aria-hidden />
              )}

              <div className="hidden w-12 shrink-0 sm:block" aria-hidden />
            </div>

            {/* Tab Selector - State 1 to State 2 Navigation */}
            <div className="flex w-full justify-center overflow-x-auto no-scrollbar">
              <div className="flex w-max max-w-full items-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => setActiveTab("controls")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
                >
                  <Music size={14} className="sm:h-4 sm:w-4" /> <span>Now Playing</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("lyrics")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "lyrics" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
                >
                  <Mic2 size={14} className="sm:h-4 sm:w-4" /> Lyrics
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("up-next")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "up-next" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
                >
                  <ListMusic size={14} className="sm:h-4 sm:w-4" /> <span className="sm:hidden">Next</span>
                  <span className="hidden sm:inline">Up Next</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ai")}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "ai" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
                >
                  <BookOpen size={14} className="sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Behind the Lyrics</span>
                  <span className="sm:hidden">Story</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Dynamic Layout Shift */}
      <div className={`relative z-10 mx-auto w-full ${viewMode === 'video' ? 'max-w-[1800px] lg:grid-cols-[1.5fr_1fr] xl:grid-cols-[1.8fr_1fr]' : 'max-w-[1400px] lg:grid-cols-2'} flex-1 grid grid-cols-1 lg:items-center gap-8 lg:gap-16 px-6 pb-24 lg:px-12 overflow-y-auto lg:overflow-visible custom-scrollbar transition-all duration-700`}>
        {/* Left side: Player (State 1: Standard View) */}
        <div className={`mx-auto flex w-full ${viewMode === 'video' ? 'max-w-[1000px]' : 'max-w-[min(100%,460px)] sm:max-w-[min(100%,380px)]'} flex-col items-center justify-center place-self-center transition-all duration-700 ${isImmersive ? "hidden lg:flex" : "flex"}`}>
          {/* Artwork / Video Player Swap */}
          <motion.div 
            layout
            className={`group relative w-full shrink-0 overflow-hidden rounded-[24px] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.6)] transition-all duration-700 ease-in-out xl:rounded-[32px] bg-black flex items-center justify-center ${viewMode === "music" ? "aspect-square" : "aspect-video"}`}
          >
            {/* Mount YouTube only in video mode so react-youtube's DOM never fights with Framer/layout while hidden */}
            {viewMode === "video" && (
              <div className="absolute inset-0 z-10 h-full w-full">
                <YouTube
                  key={currentSong.musicVideoId || currentSong.id}
                  videoId={currentSong.musicVideoId || currentSong.id}
                  opts={youtubeOpts}
                  onReady={(event) => {
                    const p = event.target;
                    ytPlayerInstance.current = p;
                    try {
                      p.seekTo(currentTimeSec, true);
                    } catch {
                      /* player API */
                    }
                    if (isPlaying) p.playVideo();
                    else p.pauseVideo();
                  }}
                  onStateChange={(event) => {
                    if (event.data === YouTube.PlayerState.ENDED) {
                      onNext();
                    }
                  }}
                  className="h-full w-full"
                  iframeClassName="h-full w-full"
                />
              </div>
            )}

            {viewMode === "music" && (
              <div className="absolute inset-0 z-20 h-full w-full bg-black">
                {imageError ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <ListMusic size={80} className="text-white/20" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentSong.artwork}
                    alt={currentSong.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                    onError={() => setImageError(true)}
                  />
                )}
              </div>
            )}
          </motion.div>

          {/* Music / Video — centered directly under artwork (matches full-player layout) */}
          <div className={`mt-4 flex w-full shrink-0 justify-center ${viewMode === "music" ? "max-w-[min(100%,380px)]" : ""}`}>
            <div className="flex items-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md">
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "video") {
                    const time = ytPlayerInstance.current?.getCurrentTime() || currentTimeSec;
                    setViewMode("music");
                    setActiveTab((prev) => (prev === "controls" ? "lyrics" : prev));
                    // After viewMode commits, resume hidden player only (avoid overlap with expanded iframe)
                    window.setTimeout(() => {
                      onSeek(time);
                      playVideo();
                    }, 0);
                  }
                }}
                className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === "music" ? "scale-105 bg-white text-black shadow-lg" : "text-white/60 hover:text-white"}`}
              >
                <Music size={14} /> Music
              </button>
              <button
                type="button"
                onClick={() => {
                  if (viewMode === "music") {
                    pauseVideo();
                    setViewMode("video");
                    if (ytPlayerInstance.current) {
                      ytPlayerInstance.current.seekTo(currentTimeSec, true);
                      if (isPlaying) ytPlayerInstance.current.playVideo();
                    }
                  }
                }}
                className={`flex items-center gap-2 rounded-full px-5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === "video" ? "scale-105 bg-white text-black shadow-lg" : "text-white/60 hover:text-white"}`}
              >
                <Video size={14} /> Video
              </button>
            </div>
          </div>

          {viewMode === "music" && renderControls("left-controls")}
        </div>

        {/* Right side: Tabs Content (State 2: Immersive View) */}
        <div className={`relative mx-auto flex w-full flex-col justify-center place-self-center transition-all duration-700 ${isImmersive ? "h-full max-w-full" : "hidden lg:flex h-[75vh] max-w-[800px]"}`} style={{ maskImage: activeTab === 'lyrics' ? 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' : 'none' }}>
          {viewMode === "video" && activeTab === "controls" && (
            <div key="video-controls" className="flex h-full w-full items-center justify-center">
              {renderControls("right-controls")}
            </div>
          )}
          {activeTab === "lyrics" && (
            <div key="lyrics" className="relative h-full w-full overflow-y-auto custom-scrollbar scroll-smooth" ref={scrollRef}>
                <div
                  className={hasSynced ? `pt-[15vh] ${isImmersive ? "pb-[40vh]" : "pb-[60vh]"}` : "py-[30vh] space-y-4"}
                >
                  {lines.map((line, index) => {
                    const isActive = hasSynced && index === activeIndex;
                    const isPast = hasSynced && index < activeIndex;
                    const isInstrumental = hasSynced && syncedLines[index].isInstrumental;
                    
                    let instProgress = 0;
                    if (isInstrumental && isActive) {
                      const start = syncedLines[index].at;
                      const next = syncedLines[index + 1];
                      const end = next ? next.at : Math.max(start + 5, safeDuration);
                      const dur = end > start ? end - start : 5;
                      instProgress = Math.max(0, Math.min(1, (currentTimeSec - start) / dur));
                    }

                    const dot1Op = 0.2 + 0.8 * Math.max(0, Math.min(1, instProgress / 0.33));
                    const dot2Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.33) / 0.33));
                    const dot3Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.66) / 0.34));

                    return (
                      <div 
                        key={`${index}`} 
                        ref={(el) => { elementsRef.current[index] = el; }}
                        onClick={() => { if (hasSynced) onSeek(syncedLines[index].at); }}
                        className={`group flex items-center overflow-hidden transition-all duration-700 ease-in-out ${hasSynced ? 'cursor-pointer' : ''} ${isInstrumental ? (isActive ? "h-[140px] opacity-100" : "h-0 opacity-0") : "min-h-[120px] py-4"}`}
                      >
                        {isInstrumental ? (
                          <div className={`flex gap-[14px] origin-left transition-all duration-1000 ${isActive ? "opacity-100" : "opacity-0"}`}>
                              <div className="h-4 w-4 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot1Op : 0.2 }} />
                              <div className="h-4 w-4 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot2Op : 0.2 }} />
                              <div className="h-4 w-4 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot3Op : 0.2 }} />
                           </div>
                        ) : (
                          <p
                            className={`w-full origin-left whitespace-pre-wrap break-words transition-all duration-500 pb-1 ${
                              isActive
                                ? "scale-100 text-[40px] font-bold leading-tight tracking-tight text-white drop-shadow-2xl"
                                : isPast
                                ? "scale-95 text-[32px] font-bold leading-tight tracking-tight text-white/30 blur-[0.5px] group-hover:scale-100 group-hover:text-white/60 group-hover:blur-none"
                                : "scale-95 text-[32px] font-bold leading-tight tracking-tight text-white/20 blur-[1px] group-hover:scale-100 group-hover:text-white/50 group-hover:blur-none"
                            }`}
                          >
                            {line}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className={`pt-12`}>
                    <p className="text-base font-medium text-white/40">Written by {currentSong.artist || "Unknown"}</p>
                    <p className="mt-1 text-base font-medium text-white/40">Lyrics provided by {lyricsSource || "Unknown"}</p>
                </div>
            </div>
          </div>
          )}

          {activeTab === "up-next" && (
            <div key="up-next" className={`custom-scrollbar h-full overflow-y-auto px-4 ${isImmersive ? "pb-[30vh] pt-[5vh]" : "py-[10vh]"}`}>
                <h2 className="mb-8 text-3xl font-bold tracking-tight text-white">Up Next</h2>
                <div className="space-y-3">
                  {queueSongs.map((song, idx) => (
                    <div key={`${song.id}-${idx}`}>
                      <div
                        className="group flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-white/10"
                      >
                        <div className="text-white/10 group-hover:text-white/30 transition-colors">
                          <GripVertical size={20} />
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          onClick={() => onSongClick(song)}
                          src={song.artwork} 
                          alt={song.title} 
                          className="h-14 w-14 cursor-pointer rounded-lg object-cover shadow-sm transition-transform group-hover:scale-105" 
                        />
                        <div 
                          onClick={() => onSongClick(song)}
                          className="flex-1 truncate cursor-pointer"
                        >
                          <p className="truncate text-base font-medium text-white">{song.title}</p>
                          <p className="mt-0.5 truncate text-sm text-white/60">{song.artist}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-medium text-white/40">{song.duration}</span>
                          {onRemoveFromQueue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromQueue(idx);
                              }}
                              className="p-2 rounded-full hover:bg-white/10 text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove from queue"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div
                key="ai"
                ref={storylineRef}
                className={`h-full overflow-y-auto px-6 custom-scrollbar scroll-smooth ${isImmersive ? "pb-[30vh] pt-[5vh]" : "py-[15vh]"}`}
              >
                <div className="w-full space-y-32 pb-64">
                  {geniusData?.found ? (
                    <>
                      <div className="space-y-6 px-2">
                         <p
                           className="text-[14px] font-bold uppercase tracking-[0.4em] opacity-80 mb-4 animate-pulse"
                           style={{ color: "var(--art-accent, #FA243C)" }}
                         >
                           Discovery Storyline
                         </p>
                         <h2 className="text-[56px] font-black leading-none tracking-tighter text-white drop-shadow-2xl max-w-xl">
                           The Story of <br/> "{currentSong.title}"
                         </h2>
                      </div>

                      <div className="space-y-[40vh]">
                        {knowLoading ? (
                           <div className="flex h-[40vh] items-center justify-start anim-pulse">
                              <p className="text-[42px] font-bold text-white/20 italic tracking-tighter">
                                Decoding mysterious facts...
                              </p>
                           </div>
                        ) : (knowFacts?.length || 0) > 0 ? (
                          knowFacts.map((fact, i) => (
                             <div
                               key={i}
                               className="px-2 story-fact"
                             >
                                <div className="flex flex-col gap-4">
                                  <div className="flex items-center gap-4">
                                    <span className="text-lg font-black tracking-[0.3em]" style={{ color: "var(--art-accent)" }}>TRIVIA {i + 1}</span>
                                    <div className="h-px flex-1" style={{ background: `color-mix(in srgb, var(--art-accent) 10%, transparent)` }} />
                                  </div>
                                  <p className="text-[42px] font-bold leading-[1.1] tracking-tight text-white drop-shadow-2xl">
                                    {fact.trim()}
                                  </p>
                                </div>
                             </div>
                          ))
                        ) : (
                          (geniusData?.description || "")
                            .split(/[.!?]\s+|\n\n+/)
                            .filter(s => s.trim().length > 10 && !s.toLowerCase().includes("no description available"))
                            .map((sentence, i) => (
                               <div
                                 key={i}
                                 className="px-2 story-fact"
                               >
                                  <div className="flex flex-col gap-4">
                                    <div className="flex items-center gap-4">
                                      <span
                                        className="text-lg font-black tracking-[0.3em]"
                                        style={{ color: "var(--art-accent, #FA243C)" }}
                                      >
                                        FACT {i + 1}
                                      </span>
                                      <div
                                        className="h-px flex-1"
                                        style={{ background: `color-mix(in srgb, var(--art-accent, #ffffff) 10%, transparent)` }}
                                      />
                                    </div>
                                    <p className="text-[42px] font-bold leading-[1.1] tracking-tight text-white drop-shadow-2xl">
                                      {sentence.trim()}
                                    </p>
                                  </div>
                               </div>
                            ))
                        )}
                      </div>

                      <div className="space-y-16">
                        {geniusData.thumbnail && (
                          <div
                            className="relative aspect-video w-full rounded-[40px] overflow-hidden shadow-[0_50px_100px_rgba(0,0,0,0.6)] transition-all duration-1000"
                            style={{
                              border: `1px solid color-mix(in srgb, var(--art-accent, #FA243C) 30%, rgba(255,255,255,0.1))`,
                              boxShadow: `0 50px 100px rgba(0,0,0,0.6), 0 0 40px color-mix(in srgb, var(--art-accent, #FA243C) 10%, transparent)`,
                            }}
                          >
                            <img src={geniusData.thumbnail} alt="Genius Art" className="w-full h-full object-cover opacity-60 transition-transform duration-1000 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-linear-to-t from-black/90 via-transparent to-transparent" />
                            <div className="absolute bottom-10 left-12 flex items-center gap-4">
                              <Heart size={20} fill="#FA243C" className="text-[#FA243C]" />
                              <p className="text-[17px] font-black uppercase tracking-[0.3em] text-white">Behind the Scenes</p>
                            </div>
                          </div>
                        )}

                        <div className="pt-24 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity">
                          <p className="text-sm font-bold uppercase tracking-widest text-white/60">Source Attribution</p>
                          <div className="mt-4 flex flex-col gap-1">
                             <span className="text-xl font-bold text-white">Genius Editorial Team</span>
                           <a 
                               href={geniusData.url || "#"} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-lg font-bold hover:underline transition-colors"
                               style={{ color: "var(--art-accent, #FA243C)" }}
                             >
                                Read full annotations on Genius.com
                             </a>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-[60vh] flex-col items-start justify-center text-left">
                       <p className="text-[56px] font-black text-white/5 tracking-tighter leading-none mb-4 uppercase">
                         Decoding <br/> Storyline...
                       </p>
                       <p className="text-xl font-bold text-white/20">We haven't found a verified story for this track yet.</p>
                    </div>
                  )}
                </div>
              </div>
          )}
        </div>
      </div>

      {/* Floating Immersive Controls - Mobile Only */}
      <AnimatePresence>
        {isImmersive && isControlsVisible && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-6 right-6 z-50 rounded-[32px] border border-white/10 bg-black/40 px-8 py-6 backdrop-blur-3xl lg:hidden"
          >
            {renderControls("floating-controls", true)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
