import { useState, useRef, useEffect, useMemo } from "react";
import { List, FileText, X, Play, Sparkles, Trash2, GripVertical, ListPlus, PlaySquare } from "lucide-react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { AudioVisualizer } from "./AudioVisualizer";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSongClick: (song: Song) => void;
  queueSongs: Song[];
  upNextQueue?: Song[]; // Added for Autoplay/Radio
  lyricsContent: string | null;
  currentTimeSec: number;
  currentArtist: string;
  lyricsSource: string | null;
  aiInsights: string;
  accentColor: string;
  onSeek?: (time: number) => void;
  currentSongId?: string;
  aiLoading?: boolean;
  onRemoveFromQueue?: (index: number) => void;
  onRemoveFromUpNext?: (index: number) => void;
  onReorderQueue?: (newQueue: Song[]) => void;
  onAddToQueue?: (song: Song) => void;
  onPlayNext?: (song: Song) => void;
}

export function RightSidebar({
  isOpen,
  onClose,
  onSongClick,
  queueSongs,
  upNextQueue = [],
  lyricsContent,
  currentTimeSec,
  currentArtist,
  lyricsSource,
  aiInsights,
  accentColor,
  onSeek,
  currentSongId,
  aiLoading,
  onRemoveFromQueue,
  onRemoveFromUpNext,
  onReorderQueue,
  onAddToQueue,
  onPlayNext,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics">("queue");
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // (Internal lyrics logic remains same...)
  const plainLines = (lyricsContent || "").split("\n").map((l) => l.trim()).filter(Boolean);
  
  const syncedLines = useMemo(() => {
    if (!lyricsContent) return [];
    const raw = parseLrcContent(lyricsContent);
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

  const lines = hasSynced ? syncedLines.map((l) => l.text) : plainLines;

  useEffect(() => {
    if (!hasSynced || activeIndex < 0 || !scrollRef.current) return;
    if (activeTab !== "lyrics") return;
    
    requestAnimationFrame(() => {
      const activeEl = elementsRef.current[activeIndex];
      if (activeEl && scrollRef.current) {
        const containerHeight = scrollRef.current.clientHeight;
        const targetScroll = activeEl.offsetTop - (containerHeight * 0.15);
        
        scrollRef.current.scrollTo({
          top: Math.max(0, targetScroll),
          behavior: "smooth"
        });
      }
    });
  }, [activeIndex, hasSynced, activeTab]);

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close queue and lyrics"
        className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={onClose}
      />
      <div className="glass fixed right-0 top-0 z-60 flex h-[100dvh] w-full max-w-full flex-col border-l border-white/[0.08] sm:max-w-md lg:w-[380px] lg:max-w-none">
          <div className="flex items-center justify-between border-b border-white/[0.08] p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:p-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("queue")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-300 ${
                  activeTab === "queue"
                    ? "border bg-white/[0.08] text-white"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white"
                }`}
                style={
                  activeTab === "queue"
                    ? {
                        borderColor: `color-mix(in srgb, var(--art-accent, #a855f7) 33%, transparent)`,
                        boxShadow: `0 0 15px color-mix(in srgb, var(--art-accent, #a855f7) 20%, transparent)`,
                      }
                    : {}
                }
              >
                <List size={16} />
                <span className="text-sm font-medium">Queue</span>
              </button>
              <button
                onClick={() => setActiveTab("lyrics")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-all duration-300 ${
                  activeTab === "lyrics"
                    ? "border bg-white/[0.08] text-white"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white"
                }`}
                style={
                  activeTab === "lyrics"
                    ? {
                        borderColor: `color-mix(in srgb, var(--art-accent, #a855f7) 33%, transparent)`,
                        boxShadow: `0 0 15px color-mix(in srgb, var(--art-accent, #a855f7) 20%, transparent)`,
                      }
                    : {}
                }
              >
                <FileText size={16} />
                <span className="text-sm font-medium">Lyrics</span>
              </button>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/[0.08] hover:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {activeTab === "queue" ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                
                {/* 1. MANUAL QUEUE SECTION */}
                {queueSongs.length > 0 && (
                    <div className="space-y-3">
                      {queueSongs.map((song, index) => {
                        const isActive = song.id === currentSongId;
                        return (
                          <div key={`${song.id}-${index}`} className="relative">
                            <div
                              onClick={() => onSongClick(song)}
                              className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-all ${
                                isActive ? "bg-white/8 shadow-lg border border-white/5" : "hover:bg-white/4 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="text-white/10 group-hover:text-white/30 transition-colors cursor-grab active:cursor-grabbing">
                                  <GripVertical size={16} />
                                </div>
                                <div className="relative">
                                  <img src={song.artwork} alt={song.title} className="h-12 w-12 rounded-lg object-cover" />
                                  <div className={`absolute inset-0 rounded-lg flex items-center justify-center transition-opacity ${isActive ? "bg-black/60 opacity-100" : "bg-black/40 opacity-0 group-hover:opacity-100"}`}>
                                    {isActive ? (
                                      <AudioVisualizer active={isActive} barCount={4} color="var(--art-accent, #a855f7)" width="18px" />
                                    ) : (
                                      <Play size={14} fill="white" className="text-white" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`truncate text-sm font-semibold transition-colors ${isActive ? "text-white" : "text-white/90"}`}>{song.title}</p>
                                <p className="truncate text-xs text-white/40">{song.artist}</p>
                              </div>
                              
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] text-white/30">{song.duration}</span>
                                {!isActive && onRemoveFromQueue && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveFromQueue(index);
                                    }}
                                    className="p-1.5 rounded-md hover:bg-red-500/20 text-white/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                    title="Remove from queue"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                )}

                {/* 2. AUTOPLAY / RADIO SECTION */}
                <div className="space-y-3 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                       <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Autoplay</p>
                       <span className="rounded bg-white/5 px-1.5 py-0.5 text-[8px] font-bold text-white/40 uppercase tracking-widest border border-white/5">Radio</span>
                    </div>
                    {aiLoading && (
                      <div className="flex items-center gap-1 text-[10px] text-purple-400">
                        <Sparkles size={10} className="animate-pulse" />
                        <span>Curating...</span>
                      </div>
                    )}
                  </div>
                  {upNextQueue.length > 0 ? (
                    upNextQueue.map((song, index) => (
                      <button
                        type="button"
                        key={`auto-${song.id}-${index}`}
                        onClick={() => onSongClick(song)}
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-all hover:bg-white/4 border border-transparent"
                      >
                         <div className="relative shrink-0">
                           <img src={song.artwork} alt={song.title} className="h-10 w-10 rounded-lg object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                           <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                             <Play size={12} fill="white" className="text-white" />
                           </div>
                         </div>
                         <div className="min-w-0 flex-1">
                           <p className="truncate text-sm font-medium text-white/70 group-hover:text-white transition-colors">{song.title}</p>
                           <p className="truncate text-[11px] text-white/30">{song.artist}</p>
                         </div>
                         
                         <div className="flex flex-col items-end gap-1">
                           <span className="text-[10px] text-white/20">{song.duration}</span>
                           {onRemoveFromUpNext && (
                             <button
                               onClick={(e) => {
                                 e.stopPropagation();
                                 onRemoveFromUpNext(index);
                               }}
                               className="p-1.5 rounded-md hover:bg-white/10 text-white/10 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                               title="Hide from radio"
                             >
                               <Trash2 size={11} />
                             </button>
                           )}
                         </div>
                      </button>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                       <div className="h-1 w-20 rounded-full bg-white/5 animate-pulse mb-3" />
                       <p className="text-[10px] text-white/20 uppercase tracking-widest">Warming up radio...</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col relative">
                <div 
                  className="pointer-events-none absolute left-0 right-0 top-0 z-10 h-10 bg-gradient-to-b from-black/20 to-transparent" 
                />
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar scroll-smooth"
                >
                  <div className={!hasSynced ? "space-y-4" : "space-y-2 pb-12"}>
                    {lines.map((line, index) => {
                      const isActive = hasSynced && index === activeIndex;
                      const isPast = hasSynced && index < activeIndex;
                      const isInstrumental = hasSynced && syncedLines[index]?.isInstrumental;

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
                        <div 
                          key={`${index}`} 
                          ref={(el) => { elementsRef.current[index] = el; }}
                          onClick={() => { if (hasSynced && onSeek) onSeek(syncedLines[index].at); }}
                          className={`group flex items-center overflow-hidden transition-all duration-700 ease-in-out ${hasSynced ? 'cursor-pointer' : ''} ${isInstrumental ? (isActive ? "h-[100px] opacity-100" : "h-0 opacity-0") : "min-h-[80px] py-4"}`}
                        >
                          {isInstrumental ? (
                            <div className={`flex gap-2.5 origin-left transition-all duration-1000 ${isActive ? "opacity-100" : "opacity-0"}`}>
                                <div className="h-3.5 w-3.5 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot1Op : 0.2 }} />
                                <div className="h-3.5 w-3.5 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot2Op : 0.2 }} />
                                <div className="h-3.5 w-3.5 rounded-full bg-white transition-opacity duration-300 ease-linear" style={{ opacity: isActive ? dot3Op : 0.2 }} />
                             </div>
                          ) : (
                            <p
                              className={`w-full origin-left whitespace-pre-wrap break-words transition-all duration-500 ${
                                isActive
                                  ? "text-[28px] font-bold leading-tight tracking-tight text-white drop-shadow-lg scale-100"
                                  : isPast
                                  ? "text-[20px] font-bold leading-tight tracking-tight text-white/30 blur-[0.5px] scale-95 group-hover:scale-100 group-hover:text-white/60 group-hover:blur-none"
                                  : "text-[20px] font-bold leading-tight tracking-tight text-white/20 blur-[1px] scale-95 group-hover:scale-100 group-hover:text-white/50 group-hover:blur-none"
                              }`}
                            >
                              {line}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="mt-12 pb-12">
                      <p className="text-xs text-white/40">Written by {currentArtist || "Unknown"}</p>
                      <p className="mt-1 text-xs text-white/40">Lyrics provided by {lyricsSource || "Unknown"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    </>
  );
}
