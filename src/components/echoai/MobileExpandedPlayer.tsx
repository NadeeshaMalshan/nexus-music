"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video, Sparkles, Plus, PlaySquare, Users } from "lucide-react";
import { m, AnimatePresence, Reorder, useDragControls } from "motion/react";
import { APPLE_EASE, SLIDE_UP_VARIANTS, EXPO_OUT, MOTION_CONFIG, APPLE_LYRICS_TRANSITION } from "@/lib/animations";
import { type Song, type ExpandedPlayerProps } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { JamSession } from "./JamSession";
import { MusicArtwork } from "./MusicArtwork";
import { useSettings } from "@/context/SettingsContext";
import { useJam } from "@/context/JamContext";

import { useDashboard } from "@/context/DashboardContext";
import { FlowingBackground } from "./FlowingBackground";

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
  const { jamState } = useJam();
  const [jamWarning, setJamWarning] = useState<string | null>(null);

  useEffect(() => {
    if (jamWarning) {
      const t = setTimeout(() => setJamWarning(null), 3000);
      return () => clearTimeout(t);
    }
  }, [jamWarning]);
  const [activeTab, setActiveTab] = useState<"lyrics" | "queue" | "ai" | "controls" | "jam">(viewMode === "video" ? "controls" : "lyrics");
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
  const storylineRef = useRef<HTMLDivElement>(null);
  const storylineIndexRef = useRef(0);
  const capturedTimeRef = useRef<number>(0);
  const videoInitSeekRef = useRef<boolean>(false);

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
    
    const activeEl = elementsRef.current[activeIndex];
    if (activeEl && scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight;
        const targetScroll = activeEl.offsetTop - (containerHeight * 0.25);
        
        scrollRef.current.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: "smooth"
        });
    }
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
    if (viewMode === "video" && ytPlayerInstance.current) {
      if (isPlaying) ytPlayerInstance.current.playVideo();
      else ytPlayerInstance.current.pauseVideo();
    }
  }, [isPlaying, viewMode]);

  useEffect(() => {
    if (viewMode === "video" && ytPlayerInstance.current) {
      try { ytPlayerInstance.current.setVolume(volume); } catch { /* ignore */ }
    }
  }, [volume, viewMode]);

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
        onClick={() => setActiveTab(activeTab === "jam" ? "controls" : "jam")}
        className={`p-3 rounded-xl transition-all ${activeTab === "jam" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`}
      >
        <Users size={24} />
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
    <div className="flex w-full flex-col justify-center px-6">
      {/* Progress */}
      {!currentSong.isLive && (
        <div className="space-y-4">
          <div onClick={handleSeekClick} className="group relative h-1 w-full cursor-pointer rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/60" style={{ width: `${progress}%` }} />
            <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/90 shadow-md" style={{ left: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-[11px] font-bold tracking-tight text-white/30">
            <span>{formatSeconds(currentTimeSec)}</span>
            <span>-{formatSeconds(safeDuration - currentTimeSec)}</span>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="mt-4 flex items-center justify-between px-8 py-4">
        <button onClick={onPrev} className="text-white active:scale-90 transition-transform">
          <SkipBack size={44} fill="currentColor" />
        </button>
        <button 
          onClick={onTogglePlay}
          className="flex h-20 w-20 items-center justify-center text-white active:scale-95 transition-transform"
        >
          {isPlaying ? <Pause size={56} fill="white" /> : <Play size={56} fill="white" className="ml-1" />}
        </button>
        <button onClick={onNext} className="text-white active:scale-90 transition-transform">
          <SkipForward size={44} fill="currentColor" />
        </button>
      </div>

      {/* Volume */}
      <div className="mt-4 flex items-center gap-4 px-2">
        <Volume2 size={14} className="text-white/30" />
        <div onClick={handleVolumeClick} className="relative h-1 flex-1 rounded-full bg-white/10">
          <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${volume}%` }} />
          <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white border border-white/10 shadow-sm" style={{ left: `${volume}%` }} />
        </div>
        <Volume2 size={20} className="text-white/30" />
      </div>
    </div>
  );

  return (
    <m.div 
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
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
      <FlowingBackground palette={palette} />

      {/* Top Grabber */}
      <div 
        className="relative z-50 flex justify-center pt-[max(0.75rem,env(safe-area-inset-top))] pb-1 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="h-1.5 w-12 rounded-full bg-white/20" onClick={onClose} />
      </div>

      {/* Mobile Top Bar */}
      <AnimatePresence mode="wait">
        {isControlsVisible && (
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
                    {isLoggedIn && (
                        <button
                            onClick={() => {
                              if (isLiked) void onRateSong(resolveLikedLibraryRateVideoId(currentSong), "none");
                              else void onRateSong(currentSong.id, "like", { title: currentSong.title, artist: currentSong.artist });
                            }}
                            className="p-2 rounded-full bg-white/5 backdrop-blur-md"
                        >
                            <Heart size={24} style={{ fill: isLiked ? 'var(--art-accent, #FA243C)' : 'none', color: isLiked ? 'var(--art-accent, #FA243C)' : 'rgb(255 255 255 / 0.7)' }} />
                        </button>
                    )}
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
                       <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={16} />
                    </m.div>
                    <div className="flex-1 min-w-0">
                        <h2 className="truncate text-base font-black text-white">{currentSong.title}</h2>
                        <button 
                          onClick={() => onArtistClick?.(currentSong.artist)}
                          className="truncate text-xs font-bold text-white/50 active:text-white transition-colors text-left"
                        >
                          {currentSong.artist}
                        </button>
                    </div>
                </div>
            )}
          </m.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === "controls" ? (
            <m.div 
                key="controls"
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.6, ease: EXPO_OUT }}
                className="flex flex-1 flex-col items-center justify-between py-8 animate-gpu"
            >
              <div className="w-full flex flex-1 items-center justify-center px-10">
                <m.div 
                    layoutId="compact-art"
                    className={`w-full max-w-[340px] shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-[20px] overflow-hidden animate-gpu ${viewMode === 'video' ? 'aspect-video' : 'aspect-square'}`}
                >
                    {viewMode === "video" ? (
                        <YouTube 
                            key={`mobile-yt-${videoKey}`}
                            videoId={currentSong.musicVideoId || currentSong.id} 
                            opts={youtubeOpts} 
                            onReady={e => { 
                                ytPlayerInstance.current = e.target; 
                                e.target.setVolume(volume); 
                                const vq = settings.videoQuality === "auto" ? "default" : settings.videoQuality;
                                try { e.target.setPlaybackQuality(vq); } catch(err) {}
                                if(isPlaying) e.target.playVideo(); 
                            }}
                            onStateChange={e => {
                                if (e.data === 0) {
                                    // Ended → advance queue
                                    onNext();
                                } else if (e.data === 1) {
                                    setIsPlaying(true);
                                } else if (e.data === 2) {
                                    if (!isPlayingRef.current) {
                                        setIsPlaying(false);
                                    } else {
                                        // Browser throttled — retry
                                        setTimeout(() => {
                                            try {
                                                if (ytPlayerInstance.current?.getPlayerState?.() === 2 && isPlayingRef.current)
                                                    ytPlayerInstance.current.playVideo();
                                            } catch { /* ignore */ }
                                        }, 400);
                                    }
                                }
                            }}
                            className="h-full w-full" 
                        />
                    ) : (
                        <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={64} />
                    )}
                </m.div>
              </div>
              
              <div className="w-full flex items-center justify-between px-10 mb-6">
                  <div className="flex-1 min-w-0 pr-4">
                      <h1 className="text-2xl font-black text-white line-clamp-1">{currentSong.title}</h1>
                      <button 
                        onClick={() => onArtistClick?.(currentSong.artist)}
                        className="text-lg font-bold text-white/40 active:text-white/70 transition-colors mt-0.5 text-left"
                      >
                        {currentSong.artist}
                      </button>
                  </div>
              <div className="flex bg-white/5 rounded-full p-1 border border-white/5 backdrop-blur-xl">
                  <button 
                    onClick={() => setViewMode("music")} 
                    className={`p-2 rounded-full transition-all ${viewMode === "music" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                  >
                    <Music size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      if (jamState.roomId) {
                        setJamWarning("Can't switch to video mode while jamming");
                        return;
                      }
                      setViewMode("video");
                    }} 
                    className={`p-2 rounded-full transition-all ${viewMode === "video" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                  >
                    <Video size={16} />
                  </button>
              </div>
              </div>

              <div className="w-full mb-8">
                  {renderControls()}
              </div>

            </m.div>
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
                    <div ref={scrollRef} className="h-full overflow-y-auto px-10 pt-10 pb-[40dvh] custom-scrollbar no-scrollbar swipe-up">
                      <div className="max-w-2xl mx-auto">
                        {lines.map((line, index) => {
                          const isInstrumental = hasSynced && syncedLines[index]?.isInstrumental;
                          const isActive = index === activeIndex;

                          let instProgress = 0;
                          if (isInstrumental && isActive) {
                            const start = syncedLines[index].at;
                            const next = syncedLines[index + 1];
                            const end = next ? next.at : start + 5;
                            const dur = end > start ? end - start : 5;
                            instProgress = Math.max(0, Math.min(1, (currentTimeSec - start) / dur));
                          }

                          const dot1Op = 0.2 + 0.8 * Math.max(0, Math.min(1, instProgress / 0.33));
                          const dot2Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.33) / 0.33));
                          const dot3Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.66) / 0.34));

                          return (
                            <m.div 
                              key={index} 
                              ref={el => { elementsRef.current[index] = el; }}
                              onClick={() => hasSynced && onSeek(syncedLines[index].at)}
                              animate={{
                                opacity: isActive ? 1 : 0.25,
                                scale: isActive ? 1.05 : 0.9,
                                filter: isActive ? "blur(0px)" : "blur(4px)",
                                x: isActive ? 10 : 0,
                              }}
                              transition={APPLE_LYRICS_TRANSITION}
                              className={`group flex items-center origin-left cursor-pointer transform ${
                                isInstrumental 
                                    ? (isActive ? "h-20" : "h-0 overflow-hidden") 
                                    : "py-6"
                              }`}
                            >
                              {isInstrumental ? (
                                <div className={`flex gap-3 items-center h-full transition-all duration-500 ${isActive ? "opacity-100" : "opacity-0"}`}>
                                  <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.1 }} />
                                  <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.1 }} />
                                  <div className="h-3 w-3 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.1 }} />
                                </div>
                              ) : (
                                <m.p className={`w-full origin-left whitespace-pre-wrap break-words text-balance font-black tracking-tight drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)] text-[40px] leading-[1.05] ${
                                    isActive ? "text-white" : "text-white/50"
                                  }`}>
                                  {line}
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
                    <div ref={storylineRef} className="h-full overflow-y-auto px-10 pt-10 pb-[40dvh] custom-scrollbar no-scrollbar">
                        {knowLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <div className="w-12 h-12 border-4 border-white/10 border-t-white/40 rounded-full animate-spin" />
                                <p className="text-white/40 uppercase tracking-[0.2em] text-xs font-black">Decrypting Story</p>
                            </div>
                        ) : (
                             <div className="space-y-40">
                                 {knowFacts.map((fact, i) => (
                                     <div key={i} className="story-fact text-[32px] font-black text-white/90 leading-[1.3] tracking-tight drop-shadow-2xl transition-all duration-700">{fact}</div>
                                 ))}
                             </div>
                        )}
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {activeTab === "jam" && (
                 <div className="flex-1 overflow-y-auto px-8 pt-6 pb-[40dvh] custom-scrollbar swipe-up">
                     <div className="mb-8 space-y-1">
                        <h2 className="text-[28px] font-black text-white tracking-tight">Echo AI</h2>
                        <p className="text-[13px] font-bold text-white/30 uppercase tracking-[0.2em]">Shared Listening</p>
                     </div>
                     <JamSession />
                     <m.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-10 rounded-[28px] border border-white/5 bg-white/3 p-8 shadow-2xl backdrop-blur-xl animate-gpu"
                      >
                         <p className="text-[15px] font-medium leading-[1.6] text-white/60">
                             Echo AI lets you listen to music simultaneously with friends. 
                             <span className="block mt-2 font-bold text-white/80">Control is shared—anyone can play, pause, or skip tracks in real-time.</span>
                         </p>
                     </m.div>
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
    </m.div>
  );
}
