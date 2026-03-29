"use client";

import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import Image from "next/image";
import YouTube from "react-youtube";
import { 
  Play, Pause, SkipBack, SkipForward, Heart, Volume2, 
  ListMusic, Mic2, ChevronDown, Trash2, GripVertical, 
  BookOpen, Music, Video, Share2, MoreHorizontal, 
  Airplay, ListChecks
} from "lucide-react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { motion, AnimatePresence } from "motion/react";

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

type TabType = "lyrics" | "up-next" | "ai" | "none";

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
  const [activeTab, setActiveTab] = useState<TabType>("none");
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const [imageError, setImageError] = useState(false);
  const ytPlayerInstance = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Controls Inactivity Timer
  useEffect(() => {
    const resetTimer = () => {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (activeTab !== "none") {
        controlsTimeoutRef.current = setTimeout(() => {
          setControlsVisible(false);
        }, 5000);
      }
    };

    if (activeTab === "none") {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      resetTimer();
    }

    const events = ["mousedown", "mousemove", "keypress", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [activeTab]);

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
    return cleaned;
  }, [lyricsContent]);

  const hasSynced = syncedLines.length > 0;
  const activeIndex = hasSynced ? syncedLines.findIndex((line, index) => {
    const next = syncedLines[index + 1];
    return currentTimeSec >= line.at && (!next || currentTimeSec < next.at);
  }) : -1;

  const lines = hasSynced ? syncedLines.map(l => l.text) : (lyricsContent || "").split("\n").filter(Boolean);
  const safeDuration = durationSec > 0 ? durationSec : (youtubeTimestampToSeconds(currentSong.duration) ?? 0);
  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;

  const formatSeconds = (seconds: number) => {
    const safe = Math.max(0, Math.floor(seconds || 0));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!hasSynced || activeIndex < 0 || !scrollRef.current || activeTab !== "lyrics") return;
    const activeEl = elementsRef.current[activeIndex];
    if (activeEl) {
      const targetScroll = activeEl.offsetTop - (scrollRef.current.clientHeight * 0.25);
      scrollRef.current.scrollTo({ top: Math.max(0, targetScroll), behavior: "smooth" });
    }
  }, [activeIndex, hasSynced, activeTab]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black overflow-hidden font-inter select-none">
      {/* Background Blur Artwork */}
      <div className="absolute inset-0 z-0">
        <Image 
          src={currentSong.artwork} alt="" fill 
          className="object-cover scale-150 blur-[100px] opacity-60 saturate-150 brightness-50 transition-all duration-1000" 
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* ── HEADER AREA ────────────────────────────────────────────────── */}
      <header className="relative z-20 flex items-center justify-between px-6 pt-safe-offset-4 pb-4">
        <button onClick={onClose} className="p-2 -ml-2 text-white/40 hover:text-white transition-all">
          <ChevronDown size={28} />
        </button>

        {activeTab !== "none" && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
             className="flex flex-col items-center text-center animate-in fade-in zoom-in"
           >
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-0.5">Playing From Playlist</p>
              <p className="text-sm font-bold text-white truncate max-w-[180px]">Your Library Mix</p>
           </motion.div>
        )}

        <button className="p-2 -mr-2 text-white/40 hover:text-white transition-all">
           <MoreHorizontal size={24} />
        </button>
      </header>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col min-h-0">
        <AnimatePresence mode="wait">
          {activeTab === "none" ? (
            /* Layout 1: Centered Focus (Artwork) */
            <motion.div 
              key="artwork-focus"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
              className="flex-1 flex flex-col items-center justify-center px-8 sm:px-20"
            >
              <div className="relative aspect-square w-full max-w-[420px] rounded-[32px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] border border-white/5 transition-all duration-700 group">
                <Image src={currentSong.artwork} alt="" fill className="object-cover group-hover:scale-105 transition-transform duration-[2s]" />
              </div>

              <div className="mt-12 w-full max-w-[420px] flex items-end justify-between gap-6">
                 <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight tracking-tight mb-1">{currentSong.title}</h1>
                    <p className="text-lg sm:text-xl font-bold text-white/40">{currentSong.artist}</p>
                 </div>
                 <button 
                  onClick={() => onRateSong(currentSong.id, isLiked ? "none" : "like")}
                  className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                 >
                    <Heart size={24} fill={isLiked ? "#FA233B" : "none"} className={isLiked ? "text-[#FA233B]" : "text-white/40"} />
                 </button>
              </div>
            </motion.div>
          ) : (
            /* Layout 2: Content View (Lyrics/Queue/AI) */
            <motion.div 
              key="content-focus"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0"
            >
              {/* Compact Track Summary at Top */}
              <div className="px-8 flex items-center gap-4 py-2">
                 <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-2xl border border-white/10 shrink-0">
                    <Image src={currentSong.artwork} alt="" fill className="object-cover" />
                 </div>
                 <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-white truncate leading-none mb-1">{currentSong.title}</h3>
                    <p className="text-sm font-bold text-white/40 truncate">{currentSong.artist}</p>
                 </div>
                 <div className="flex items-center gap-2">
                    <button className="p-2 rounded-full bg-white/5 text-white/40"><Share2 size={18} /></button>
                 </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 min-h-0 mt-4 h-full relative" style={{ maskImage: activeTab === 'lyrics' ? 'linear-gradient(to bottom, transparent, black 5%, black 85%, transparent)' : 'none' }}>
                 {activeTab === "lyrics" && (
                    <div ref={scrollRef} className="h-full overflow-y-auto custom-scrollbar no-scrollbar scroll-smooth px-8 py-[10vh]">
                       <div className="space-y-6">
                         {lines.map((line, idx) => {
                            const isActive = hasSynced && idx === activeIndex;
                            return (
                              <p 
                                key={idx} 
                                ref={(el) => { elementsRef.current[idx] = el; }}
                                onClick={() => hasSynced && onSeek(syncedLines[idx].at)}
                                className={`text-3xl font-black transition-all duration-500 cursor-pointer ${
                                  isActive ? "text-white scale-100 opacity-100 filter-none" : "text-white/20 scale-95 opacity-80 blur-[0.5px] hover:text-white/60"
                                }`}
                              >
                                {line}
                              </p>
                            );
                         })}
                       </div>
                    </div>
                 )}

                 {activeTab === "up-next" && (
                    <div className="h-full overflow-y-auto custom-scrollbar px-8 py-4">
                       <h4 className="text-xs font-black uppercase tracking-[0.2em] text-white/20 mb-6">Up Next</h4>
                       <div className="space-y-2">
                          {queueSongs.map((song, idx) => (
                             <div key={idx} onClick={() => onSongClick(song)} className="flex items-center gap-4 p-2 rounded-2xl hover:bg-white/5 group active:scale-95 transition-all cursor-pointer">
                                <Image src={song.artwork} alt="" width={48} height={48} className="rounded-xl shadow-lg border border-white/5" />
                                <div className="flex-1 min-w-0">
                                   <p className="text-sm font-bold text-white truncate">{song.title}</p>
                                   <p className="text-xs font-medium text-white/40 truncate">{song.artist}</p>
                                </div>
                                <GripVertical size={16} className="text-white/10 group-hover:text-white/30" />
                             </div>
                          ))}
                       </div>
                    </div>
                 )}

                 {activeTab === "ai" && (
                    <div className="h-full overflow-y-auto custom-scrollbar px-8 py-4 space-y-12">
                       <div className="space-y-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40">Nexus Storyline</p>
                          <h2 className="text-4xl font-black text-white tracking-tighter">Behind the Scenes</h2>
                       </div>
                       {knowFacts.length > 0 ? (
                          <div className="space-y-12">
                             {knowFacts.map((fact, i) => (
                                <div key={i} className="space-y-4">
                                   <div className="flex items-center gap-2">
                                      <div className="w-6 h-[2px] bg-white/20" />
                                      <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Fact {i + 1}</span>
                                   </div>
                                   <p className="text-xl font-bold text-white/80 leading-relaxed">{fact}</p>
                                </div>
                             ))}
                          </div>
                       ) : (
                          <div className="py-20 text-center opacity-20">
                             <BookOpen size={48} className="mx-auto mb-4" />
                             <p className="font-bold">Decoding facts with AI...</p>
                          </div>
                       )}
                    </div>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── PLAYER CONTROLS AREA ─────────────────────────────────────── */}
      <footer className="relative z-20 px-8 pb-[max(2rem,env(safe-area-inset-bottom,0px))] flex flex-col items-center">
        <AnimatePresence>
          {controlsVisible && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
              className="w-full flex flex-col items-center"
            >
              {/* Progress Bar */}
              <div className="w-full space-y-2 mb-8">
                 <div 
                   onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSeek(((e.clientX - rect.left) / rect.width) * safeDuration);
                   }}
                   className="h-1.5 w-full bg-white/10 rounded-full cursor-pointer relative overflow-hidden"
                 >
                    <div 
                      className="absolute inset-y-0 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.4)]"
                      style={{ width: `${progress}%` }}
                    />
                 </div>
                 <div className="flex justify-between text-[11px] font-bold text-white/30 tracking-wider">
                    <span>{formatSeconds(currentTimeSec)}</span>
                    <span>-{formatSeconds(safeDuration - currentTimeSec)}</span>
                 </div>
              </div>

              {/* Main Playback Controls */}
              <div className="flex items-center justify-between w-full max-w-[320px] mb-8">
                 <button onClick={onPrev} className="text-white hover:text-white/80 active:scale-90 transition-all">
                    <SkipBack size={38} fill="currentColor" strokeWidth={0} />
                 </button>
                 <button 
                  onClick={onTogglePlay}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-black shadow-2xl active:scale-95 transition-all"
                 >
                    {isPlaying ? <Pause size={36} fill="black" /> : <Play size={36} fill="black" className="pl-1" />}
                 </button>
                 <button onClick={onNext} className="text-white hover:text-white/80 active:scale-90 transition-all">
                    <SkipForward size={38} fill="currentColor" strokeWidth={0} />
                 </button>
              </div>

              {/* Volume Slider (Compact like iOS) */}
              <div className="w-full flex items-center gap-3 opacity-40 hover:opacity-100 transition-opacity mb-8">
                 <Volume2 size={16} />
                 <div 
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    onVolumeChange(((e.clientX - rect.left) / rect.width) * 100);
                  }}
                  className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden cursor-pointer"
                 >
                    <div className="absolute inset-y-0 bg-white/60 rounded-full" style={{ width: `${volume}%` }} />
                 </div>
                 <Volume2 size={16} className="rotate-180" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Bottom Tab Bar (Lyrics / Apple Connect / Queue) */}
        <div className="w-full flex items-center justify-around py-2 border-t border-white/5">
           <button 
             onClick={() => setActiveTab(prev => prev === "lyrics" ? "none" : "lyrics")}
             className={`p-3 rounded-xl transition-all ${activeTab === "lyrics" ? "bg-white/10 text-white" : "text-white/30 hover:text-white"}`}
           >
              <Mic2 size={22} />
           </button>
           <button className="p-3 text-white/30 hover:text-white transition-all">
              <Airplay size={22} />
           </button>
           <button 
             onClick={() => setActiveTab(prev => prev === "up-next" ? "none" : "up-next")}
             className={`p-3 rounded-xl transition-all ${activeTab === "up-next" ? "bg-white/10 text-white" : "text-white/30 hover:text-white"}`}
           >
              <ListMusic size={22} />
           </button>
        </div>
      </footer>
    </div>
  );
}
