import { useMemo, useState, useRef, useEffect, type MouseEvent } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, Volume2, ListMusic, Mic2, Sparkles, ChevronDown } from "lucide-react";
import { type Song } from "./types";
import { motion, AnimatePresence } from "motion/react";
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
  aiInsights: string;
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
  aiInsights,
}: ExpandedPlayerProps) {
  const [activeTab, setActiveTab] = useState<"lyrics" | "up-next" | "ai">("lyrics");
  const [isLiked, setIsLiked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

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

  return (
    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }} className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Animated blurred background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={currentSong.artwork} alt="" className="absolute inset-0 h-full w-full scale-150 object-cover opacity-60 blur-[120px] saturate-200" />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Top bar */}
      <div className="relative z-20 flex w-full items-center justify-between px-8 py-8">
        <button onClick={onClose} className="group rounded-full bg-black/20 p-2 backdrop-blur-md transition-colors hover:bg-black/40">
          <ChevronDown size={32} className="text-white/80 transition-colors group-hover:text-white" />
        </button>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-full border border-white/5 bg-black/20 p-1 backdrop-blur-md">
          <button onClick={() => setActiveTab("lyrics")} className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all ${activeTab === 'lyrics' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}>
            <Mic2 size={16} /> Lyrics
          </button>
          <button onClick={() => setActiveTab("up-next")} className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all ${activeTab === 'up-next' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}>
            <ListMusic size={16} /> Up Next
          </button>
          <button onClick={() => setActiveTab("ai")} className={`flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold transition-all ${activeTab === 'ai' ? 'bg-white/20 text-white shadow-sm' : 'text-white/60 hover:text-white'}`}>
            <Sparkles size={16} /> AI Insights
          </button>
        </div>
        
        <div className="w-12" /> {/* Spacer for centering tabs conceptually */}
      </div>

      {/* Main Content */}
      <div className="relative z-10 mx-auto w-full max-w-[1400px] flex-1 grid grid-cols-1 lg:grid-cols-2 items-center gap-16 px-8 pb-16 lg:px-12">
        {/* Left side: Player */}
        <div className="mx-auto flex w-full max-w-[480px] flex-col justify-center place-self-center">
          {/* Artwork */}
          <div className="group relative aspect-square w-full shrink-0 overflow-hidden rounded-[16px] border border-white/10 shadow-[0_40px_80px_rgba(0,0,0,0.6)] transition-transform duration-500 hover:scale-[1.02] xl:rounded-[32px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentSong.artwork} alt={currentSong.title} className="absolute inset-0 h-full w-full object-cover" />
          </div>

          {/* Info */}
          <div className="mt-10 flex items-start justify-between">
            <div className="flex-1 pr-6">
              <h1 className="truncate text-[28px] font-bold tracking-tight text-white">{currentSong.title}</h1>
              <p className="mt-1 truncate text-xl font-medium text-white/70">{currentSong.artist}</p>
            </div>
            <button onClick={() => setIsLiked(!isLiked)} className="mt-1 rounded-full bg-white/5 p-2 transition-colors hover:bg-white/10">
              <Heart size={26} className={isLiked ? "fill-[#FA243C] text-[#FA243C]" : "text-white/70"} />
            </button>
          </div>

          {/* Progress */}
          <div className="mt-10 space-y-2.5">
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
          <div className="mt-6 flex items-center justify-center gap-12">
            <button onClick={onPrev} className="text-white/90 transition-all hover:scale-110 hover:text-white active:scale-95">
              <SkipBack size={42} fill="currentColor" />
            </button>
            <button 
              onClick={onTogglePlay} 
              className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/20 backdrop-blur-xl transition-all hover:scale-105 hover:bg-white/30 active:scale-95"
            >
              {isPlaying ? (
                <Pause size={38} fill="white" className="text-white" />
              ) : (
                <Play size={38} fill="white" className="ml-2 text-white" />
              )}
            </button>
            <button onClick={onNext} className="text-white/90 transition-all hover:scale-110 hover:text-white active:scale-95">
              <SkipForward size={42} fill="currentColor" />
            </button>
          </div>

          {/* Volume */}
          <div className="mt-10 flex w-full items-center gap-4 px-2">
            <Volume2 size={20} className="text-white/60" />
            <div onClick={handleVolumeClick} className="group relative h-1.5 flex-1 cursor-pointer rounded-full bg-white/20 backdrop-blur-sm">
              <div className="absolute inset-y-0 left-0 rounded-full bg-white/90 transition-all duration-150 ease-out" style={{ width: `${volume}%` }} />
              <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white shadow-lg transition-transform group-hover:scale-100" style={{ left: `${volume}%` }} />
            </div>
          </div>
        </div>

        {/* Right side: Tabs Content */}
        <div className="relative mx-auto flex h-[75vh] w-full max-w-[600px] flex-col justify-center place-self-center lg:ml-8" style={{ maskImage: activeTab === 'lyrics' ? 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' : 'none' }}>
          <AnimatePresence mode="wait">
            {activeTab === "lyrics" && (
              <motion.div key="lyrics" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className={`relative h-full w-full overflow-y-auto custom-scrollbar scroll-smooth`} ref={scrollRef}>
                <div
                  className={hasSynced ? "pt-[15vh] pb-[60vh]" : "py-[30vh] space-y-4"}
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
                            className={`w-full origin-left whitespace-pre-wrap break-words transition-all duration-500 ${
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
              </motion.div>
            )}

            {activeTab === "up-next" && (
              <motion.div key="up-next" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="custom-scrollbar h-full overflow-y-auto px-4 py-[10vh]">
                <h2 className="mb-8 text-3xl font-bold tracking-tight text-white">Up Next</h2>
                <div className="space-y-3">
                  {queueSongs.map((song, idx) => (
                    <button
                      key={`${song.id}-${idx}`}
                      onClick={() => onSongClick(song)}
                      className="group flex w-full items-center gap-4 rounded-xl p-3 text-left transition-colors hover:bg-white/10"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={song.artwork} alt={song.title} className="h-14 w-14 rounded-lg object-cover shadow-sm transition-transform group-hover:scale-105" />
                      <div className="flex-1 truncate">
                        <p className="truncate text-base font-medium text-white">{song.title}</p>
                        <p className="mt-0.5 truncate text-sm text-white/60">{song.artist}</p>
                      </div>
                      <span className="text-sm font-medium text-white/40">{song.duration}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "ai" && (
              <motion.div key="ai" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="h-full overflow-y-auto px-6 py-[15vh]">
                 <div className="prose prose-invert prose-lg max-w-none">
                  <div className="mb-8 flex items-center gap-3">
                    <Sparkles size={32} className="text-[#FA243C]" />
                    <span className="text-3xl font-bold tracking-tight text-white">
                      AI Analysis
                    </span>
                    <span className="ml-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wider text-white">Llama 3</span>
                  </div>
                  <p className="whitespace-pre-line text-[19px] font-medium leading-relaxed text-white/80">{aiInsights}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
