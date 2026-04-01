"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import YouTube from "react-youtube";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, ChevronDown, Trash2, GripVertical, BookOpen, Music, Video, Sparkles, Plus, PlaySquare } from "lucide-react";
import { motion, AnimatePresence, Reorder } from "motion/react";
import { type ExpandedPlayerProps } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";

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
}: ExpandedPlayerProps) {
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
  const storylineRef = useRef<HTMLDivElement>(null);
  const storylineIndexRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const videoInitSeekRef = useRef<boolean>(false);
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
          if (p?.getPlayerState?.() === 1) {
            const time = p.getCurrentTime();
            if (time > 0 && Number.isFinite(time)) setCurrentTimeSec(time);
          }
        } catch { /* ignore */ }
      }, 500);
    }
    return () => { if (videoSyncIntervalRef.current) clearInterval(videoSyncIntervalRef.current); };
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
    playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, iv_load_policy: 3 },
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
      <button
        type="button"
        onClick={() => setActiveTab("lyrics")}
        className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-all sm:gap-2 sm:px-6 sm:text-sm ${activeTab === "lyrics" ? "bg-white/20 text-white shadow-sm" : "text-white/60 hover:text-white"}`}
      >
        <Mic2 size={14} className="sm:h-4 sm:w-4" /> <span>Lyrics</span>
      </button>
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
            <p className="mt-1 text-lg font-medium text-white/70 line-clamp-1">{currentSong.artist}</p>
          </div>
          {isLoggedIn && (
            <button onClick={() => onRateSong(currentSong.id, isLiked ? "none" : "like")} className="mt-1 rounded-full bg-white/5 p-2 hover:bg-white/10">
              <Heart size={24} className={isLiked ? "fill-[#FA243C] text-[#FA243C]" : "text-white/70"} />
            </button>
          )}
        </div>
      )}

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

      <div className={`${isCompact ? "mt-1 px-6" : "mt-3 px-3 pb-1"} flex w-full items-center gap-4`}>
        <Volume2 size={isCompact ? 18 : 20} className="text-white/60" />
        <div onClick={handleVolumeClick} className="group relative h-4 flex-1 cursor-pointer flex items-center">
          <div className="relative h-1.5 w-full rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 rounded-full bg-white/90" style={{ width: `${volume}%` }} />
            <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 scale-0 group-hover:scale-100 rounded-full bg-white transition-transform" style={{ left: `${volume}%` }} />
          </div>
        </div>
      </div>

      {viewMode === "music" && !isCompact && <div className="mt-6 flex w-full justify-start items-center gap-2 overflow-x-auto no-scrollbar">{renderTabSelector()}</div>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex max-h-[100dvh] flex-col bg-black overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img src={imageError ? "/images/default-artwork.png" : currentSong.artwork} alt="" className="h-full w-full scale-150 object-cover opacity-60 blur-[120px]" onError={() => setImageError(true)} />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <AnimatePresence>
        {isControlsVisible && (
          <motion.div initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }} className="relative z-40 w-full flex items-center px-8 py-4">
            <button onClick={onClose} className="p-2 rounded-full bg-black/20 hover:bg-black/40"><ChevronDown size={32} className="text-white" /></button>
            <div className="flex-1" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`relative z-10 mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-2 items-center gap-12 px-8 pb-8 overflow-y-auto lg:overflow-visible custom-scrollbar transition-all duration-700 ${viewMode === 'video' ? 'max-w-[1800px] lg:grid-cols-[1.8fr_1fr]' : 'max-w-[1400px]'}`}>
        <div className={`mx-auto flex w-full flex-col items-center justify-center ${viewMode === 'video' ? 'max-w-full' : 'max-w-[400px]'}`}>
          <motion.div layout className={`group relative w-full overflow-hidden rounded-[32px] border border-white/10 bg-black shadow-2xl flex items-center justify-center ${viewMode === "music" ? "aspect-square" : "aspect-video"}`}>
            {viewMode === "video" ? (
              <YouTube videoId={currentSong.musicVideoId || currentSong.id} opts={youtubeOpts} onReady={e => { ytPlayerInstance.current = e.target; e.target.setVolume(volume); if(isPlaying) e.target.playVideo(); }} className="h-full w-full overflow-hidden" />
            ) : (
              <img src={currentSong.artwork} alt="" className="h-full w-full object-cover" />
            )}
          </motion.div>
          <div className="mt-6 flex w-full justify-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md max-w-[200px]">
            <button onClick={() => setViewMode("music")} className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all ${viewMode === "music" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}><Music size={14} /> Music</button>
            <button onClick={() => setViewMode("video")} className={`flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-xs font-bold transition-all ${viewMode === "video" ? "bg-white text-black" : "text-white/60 hover:text-white"}`}><Video size={14} /> Video</button>
          </div>
          {viewMode === "video" && <div className="mt-6">{renderTabSelector()}</div>}
          {viewMode === "music" && renderControls("left-controls")}
        </div>

        <div className="h-full max-w-[800px] w-full flex flex-col justify-center">
          {viewMode === "video" && activeTab === "controls" ? (
             <div className="flex h-full w-full items-center justify-center">{renderControls("right-controls")}</div>
          ) : (
            <div className="h-[75vh] w-full flex flex-col overflow-hidden">
               {activeTab === "lyrics" && (
                 <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 pt-[10vh] pb-[40vh]">
                    {lines.map((l, i) => (
                        <div key={i} ref={el => { elementsRef.current[i] = el; }} className={`py-4 transition-all duration-500 ${i === activeIndex ? "text-white text-[40px] font-bold" : "text-white/20 text-[32px] font-bold"}`}>{l}</div>
                    ))}
                 </div>
               )}
               {activeTab === "queue" && (
                 <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-8">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-4xl font-black text-white">Queue</h2>
                        <button onClick={onClearQueue} className="text-white/40 hover:text-white"><Trash2 size={24} /></button>
                    </div>
                    {upNextQueue.map((s, i) => (
                        <div key={s.id} onClick={() => onSongClick(s, false)} className="flex items-center gap-4 py-3 hover:bg-white/5 rounded-xl px-2 cursor-pointer transition-colors">
                            <img src={s.artwork} alt="" className="h-16 w-16 rounded-lg object-cover" />
                            <div className="flex-1 min-w-0">
                                <p className="truncate font-bold text-white">{s.title}</p>
                                <p className="truncate text-sm text-white/40">{s.artist}</p>
                            </div>
                            <Trash2 size={18} className="text-white/10 hover:text-red-500" onClick={e => { e.stopPropagation(); onRemoveFromUpNext?.(i); }} />
                        </div>
                    ))}
                 </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
