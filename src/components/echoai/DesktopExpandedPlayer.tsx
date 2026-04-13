"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video, Sparkles, Plus, PlaySquare, Maximize } from "lucide-react";
import { m, AnimatePresence, Reorder } from "motion/react";
import { APPLE_EASE, EXPO_OUT, MOTION_CONFIG, APPLE_LYRICS_TRANSITION } from "@/lib/animations";
import { type ExpandedPlayerProps } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { MusicArtwork } from "./MusicArtwork";
import { useSettings } from "@/context/SettingsContext";
import { useJam } from "@/context/JamContext";

import { useDashboard } from "@/context/DashboardContext";
import { FlowingBackground } from "./FlowingBackground";

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
}: ExpandedPlayerProps) {
  const { palette, resolveLikedLibraryRateVideoId } = useDashboard();
  const { settings } = useSettings();
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "ai" | "controls">(viewMode === "video" ? "controls" : "lyrics");
  const [imageError, setImageError] = useState(false);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // Auto-switch tab if viewMode changes
  useEffect(() => {
    if (viewMode === "music" && activeTab === "controls") {
      setActiveTab("lyrics");
    }
  }, [viewMode, activeTab]);
  
  const ytPlayerInstance = useRef<any>(null);
  const videoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // Ref so callbacks always see the latest isPlaying without closure staleness
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Increment key every time we ENTER video mode so the <YouTube> component
  // gets a completely fresh DOM slot — avoids "page couldn't load" errors caused
  // by the old player's cleanup racing with a new player init on the same element.
  const [videoKey, setVideoKey] = useState(0);
  const prevViewModeRef2 = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef2.current !== "video" && viewMode === "video") {
      setVideoKey((k) => k + 1);
      ytPlayerInstance.current = null; // clear stale ref before new player mounts
    }
    prevViewModeRef2.current = viewMode;
  }, [viewMode]);
  const storylineRef = useRef<HTMLDivElement>(null);
  const storylineIndexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const videoInitSeekRef = useRef<boolean>(false);
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

  const capturedTimeRef = useRef<number>(0);

  const plainLines = useMemo(() => (lyricsContent || "")
    .replace(/\[\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?\]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean), [lyricsContent]);
  
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

    if (cleaned.length > 0 && cleaned[0].at > 5) {
      cleaned.unshift({ at: 0, text: "", isInstrumental: true });
    }

    const finalLines = [];
    for (let i = 0; i < cleaned.length; i++) {
        finalLines.push(cleaned[i]);
        if (i < cleaned.length - 1) {
            const gap = cleaned[i + 1].at - cleaned[i].at;
            if (gap > 20 && !cleaned[i].isInstrumental && !cleaned[i + 1].isInstrumental) {
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
    
    requestAnimationFrame(() => {
      const activeEl = elementsRef.current[activeIndex];
      if (activeEl && scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight;
        const targetScroll = activeEl.offsetTop - (containerHeight * 0.20);
        scrollRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
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
  }, [activeTab, knowLoading, isPlaying]);
  
  useEffect(() => {
    if (viewMode === "video") {
      videoSyncIntervalRef.current = setInterval(() => {
        try {
          const p = ytPlayerInstance.current;
          if (!p) return;
          const state = p.getPlayerState?.();
          if (state === 1) {
            const time = p.getCurrentTime();
            if (time > 0 && Number.isFinite(time)) setCurrentTimeSec(time);
          }
          // Resilience: if browser throttled/paused the player while we want it playing
          if (state === 2 && isPlayingRef.current) {
            try { p.playVideo(); } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }, 500);
    }
    return () => { if (videoSyncIntervalRef.current) clearInterval(videoSyncIntervalRef.current); };
  }, [viewMode]);

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
    if ((viewMode === "video" || currentSong.isLive) && ytPlayerInstance.current) {
      if (isPlaying) ytPlayerInstance.current.playVideo();
      else ytPlayerInstance.current.pauseVideo();
    }
  }, [isPlaying, viewMode, currentSong.isLive]);

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

  const handleVolumeClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onVolumeChange(ratio * 100);
  };

  const renderTabSelector = () => (
    <div className="flex w-max max-w-full items-center gap-1 rounded-full border border-white/5 bg-black/40 p-1 backdrop-blur-3xl shadow-2xl">
      {viewMode === "video" && (
        <button
          type="button"
          onClick={() => setActiveTab("controls")}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "controls" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
        >
          <PlaySquare size={14} className="sm:h-4 sm:w-4" /> <span>Now Playing</span>
        </button>
      )}
      {!currentSong.isLive && (
        <button
          type="button"
          onClick={() => setActiveTab("lyrics")}
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "lyrics" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
        >
          <Mic2 size={14} className="sm:h-4 sm:w-4" /> <span>Lyrics</span>
        </button>
      )}
      <button
        type="button"
        onClick={() => setActiveTab("queue")}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "queue" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
      >
        <ListMusic size={14} className="sm:h-4 sm:w-4" /> <span>Queue</span>
      </button>
      <button
        type="button"
        onClick={() => setActiveTab("ai")}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "ai" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
      >
        <BookOpen size={14} className="sm:h-4 sm:w-4" /> <span>Story</span>
      </button>
    </div>
  );

  const renderControls = (idKey: string, isCompact = false) => (
    <div key={idKey} className={`flex w-full flex-col justify-center ${viewMode === "video" ? "px-8 md:px-16" : ""} ${isCompact ? "gap-4" : ""}`}>
      {!isCompact && (
        <div className="mt-3 flex items-start justify-between">
          <div className="flex-1 pr-6 min-w-0">
            <h1 className="line-clamp-2 text-[26px] font-bold tracking-tight text-white leading-tight">{currentSong.title}</h1>
            <button
              onClick={() => onArtistClick?.(currentSong.artist)}
              className="mt-1 text-lg font-medium text-white/70 hover:text-white transition-colors line-clamp-1 text-left hover:underline underline-offset-4"
            >
              {currentSong.artist}
            </button>
          </div>
          {isLoggedIn && (
            <button
              onClick={() => {
                if (isLiked) void onRateSong(resolveLikedLibraryRateVideoId(currentSong), "none");
                else void onRateSong(currentSong.id, "like", { title: currentSong.title, artist: currentSong.artist });
              }}
              className="mt-1 rounded-full bg-white/5 p-2 hover:bg-white/10"
            >
              <Heart size={24} style={{ fill: isLiked ? 'var(--art-accent, #FA243C)' : 'none', color: isLiked ? 'var(--art-accent, #FA243C)' : 'rgb(255 255 255 / 0.7)' }} />
            </button>
          )}
        </div>
      )}

      {!currentSong.isLive && (
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
        <button onClick={onPrev} className="text-white/80 active:scale-95 transition-transform"><SkipBack size={isCompact ? 32 : 42} fill="currentColor" /></button>
        <button 
          onClick={onTogglePlay}
          className={`flex ${isCompact ? "h-16 w-16" : "h-20 w-20"} items-center justify-center rounded-full bg-white/20 backdrop-blur-xl border border-white/10 active:scale-95 transition-transform`}
        >
          {isPlaying ? <Pause size={isCompact ? 32 : 38} fill="white" /> : <Play size={isCompact ? 32 : 38} fill="white" className="ml-2" />}
        </button>
        <button onClick={onNext} className="text-white/80 active:scale-95 transition-transform"><SkipForward size={isCompact ? 32 : 42} fill="currentColor" /></button>
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

      {viewMode === "music" && !isCompact && <div className="mt-6 flex w-full justify-start items-center gap-2 overflow-x-auto no-scrollbar">{renderTabSelector()}</div>}
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

      <FlowingBackground palette={palette} />

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
          <m.div layout className={`group relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl flex items-center justify-center animate-gpu ${viewMode === "music" ? "aspect-square" : "aspect-video"}`}>
            {(viewMode === "video" || currentSong.isLive) && (
              <div 
                ref={videoContainerRef}
                className={`group/vid relative overflow-hidden ${viewMode === "music" ? "absolute inset-0 opacity-0 pointer-events-none" : "h-full w-full bg-black"}`}
              >
                <YouTube 
                  key={`desktop-yt-${videoKey}`}
                  videoId={currentSong.musicVideoId || currentSong.id} 
                  opts={youtubeOpts} 
                  onReady={e => { 
                    ytPlayerInstance.current = e.target; 
                    e.target.setVolume(volume); 
                    // For live streams in music mode, force tiny quality to save data
                    const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                    try { e.target.setPlaybackQuality(vq); } catch(err) {}
                    if(isPlaying) e.target.playVideo(); 
                  }}
                  onStateChange={e => {
                    if (e.data === 0) {
                      onNext();
                    } else if (e.data === 1) {
                      setIsPlaying(true);
                      // Force quality again after playback starts to ensure it sticks
                      const vq = (viewMode === "music" && currentSong.isLive) ? "tiny" : (settings.videoQuality === "auto" ? "default" : settings.videoQuality);
                      try { e.target.setPlaybackQuality(vq); } catch(err) {}
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
                    }
                  }}
                  className="h-full w-full scale-[1.15] translate-y-[2%] origin-center pointer-events-none select-none" 
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
              <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={48} />
            )}
          </m.div>
          <div className="mt-6 flex w-full justify-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md max-w-[200px]">
            <button 
              onClick={() => setViewMode("music")} 
              className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all ${viewMode === "music" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
            >
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
              className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all ${viewMode === "video" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
            >
              <Video size={14} /> Video
            </button>
          </div>
          {viewMode === "video" && <div className="mt-6">{renderTabSelector()}</div>}
          {viewMode === "music" && renderControls("left-controls")}
        </div>

        <div className="h-full max-w-[800px] w-full flex flex-col justify-center">
          {viewMode === "video" && activeTab === "controls" ? (
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
                     className="flex-1 overflow-hidden"
                   >
                     <div ref={scrollRef} className="h-full overflow-y-auto custom-scrollbar px-4 pt-[10vh] pb-[40vh] no-scrollbar">
                        <div className="max-w-2xl mx-auto">
                          {lines.map((l, i) => {
                            const isInstrumental = hasSynced && syncedLines[i]?.isInstrumental;
                            const isActive = i === activeIndex;
                            const isPast = i < activeIndex;
                            const isFuture = i > activeIndex;

                            let instProgress = 0;
                            if (isInstrumental && isActive) {
                              const start = syncedLines[i].at;
                              const next = syncedLines[i + 1];
                              const end = next ? next.at : start + 5;
                              const dur = end > start ? end - start : 5;
                              instProgress = Math.max(0, Math.min(1, (currentTimeSec - start) / dur));
                            }

                            const dot1Op = 0.2 + 0.8 * Math.max(0, Math.min(1, instProgress / 0.33));
                            const dot2Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.33) / 0.33));
                            const dot3Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.66) / 0.34));

                            return (
                              <m.div 
                                key={i} 
                                ref={el => { elementsRef.current[i] = el; }} 
                                onClick={() => hasSynced && onSeek(syncedLines[i].at)}
                                animate={{
                                  opacity: isActive ? 1 : 0.25,
                                  scale: isActive ? 1.05 : 0.9,
                                  filter: isActive ? "blur(0px)" : "blur(4px)",
                                  x: isActive ? 10 : 0,
                                }}
                                transition={APPLE_LYRICS_TRANSITION}
                                className={`group flex items-center origin-left cursor-pointer transform ${
                                  isInstrumental 
                                      ? (isActive ? "h-[100px]" : "h-0 overflow-hidden") 
                                      : "py-6"
                                } hover:opacity-70`}
                              >
                                {isInstrumental ? (
                                  <div className={`flex gap-4 items-center h-full transition-all duration-500 ${isActive ? "opacity-100" : "opacity-0"}`}>
                                    <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.1 }} />
                                    <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.1 }} />
                                    <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.1 }} />
                                  </div>
                                ) : (
                                  <m.p 
                                    className={`w-full origin-left whitespace-pre-wrap break-words text-balance font-black tracking-tight drop-shadow-[0_12px_24px_rgba(0,0,0,0.4)] text-[48px] leading-[1.05] ${
                                      isActive ? "text-white" : "text-white/50"
                                    }`}
                                  >
                                    {l}
                                  </m.p>
                                )}
                              </m.div>
                            );
                          })}
                        </div>
                     </div>
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
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     transition={MOTION_CONFIG.transition}
                     className="flex-1 flex flex-col h-full overflow-hidden"
                   >
                     <div className="mb-8 border-b border-white/5 pb-4">
                         <h2 className="text-4xl font-black text-white tracking-tight">Story</h2>
                         <p className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em] mt-1">Beyond the Lyrics</p>
                     </div>
                     <div ref={storylineRef} className="flex-1 overflow-y-auto custom-scrollbar px-2 pt-4 pb-[50vh] no-scrollbar">
                         {knowLoading ? (
                              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                                 <div className="w-10 h-10 border-2 border-white/10 border-t-white/40 rounded-full animate-spin" />
                                 <p className="text-white/40 uppercase tracking-[0.2em] text-[10px] font-black">Collecting Intel</p>
                              </div>
                         ) : (
                             <div className="space-y-40">
                                 {knowFacts.length > 0 ? (
                                     knowFacts.map((fact, i) => (
                                         <div key={i} className="story-fact text-[44px] font-black leading-[1.2] text-white/90 drop-shadow-2xl transition-all duration-700 hover:text-white tracking-tight">
                                             {fact}
                                         </div>
                                     ))
                                 ) : (
                                     <div className="flex flex-col items-center justify-center py-20 opacity-30 italic">
                                         The story behind this track is currently being compiled...
                                     </div>
                                 )}
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
    </m.div>
  );
}
