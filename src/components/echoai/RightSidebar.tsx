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
        className="fixed inset-0 z-[55] bg-black/5 lg:hidden"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 z-60 flex h-[100dvh] w-full max-w-full flex-col bg-transparent backdrop-blur-3xl sm:max-w-md lg:w-[380px] lg:max-w-none border-l border-white/5 shadow-2xl">
          <div className="flex items-center justify-between p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
            <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
              <button
                onClick={() => setActiveTab("queue")}
                className={`flex items-center gap-2 rounded-xl px-4 py-1.5 transition-all duration-400 ${
                  activeTab === "queue"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                <List size={14} strokeWidth={2.5} />
                <span className="text-[13px] font-bold tracking-tight">Queue</span>
              </button>
              <button
                onClick={() => setActiveTab("lyrics")}
                className={`flex items-center gap-2 rounded-xl px-4 py-1.5 transition-all duration-400 ${
                  activeTab === "lyrics"
                    ? "bg-white/10 text-white shadow-sm"
                    : "text-white/40 hover:text-white/60"
                }`}
              >
                <FileText size={14} strokeWidth={2.5} />
                <span className="text-[13px] font-bold tracking-tight">Lyrics</span>
              </button>
            </div>
            <button onClick={onClose} className="rounded-full p-2 text-white/20 transition-all hover:bg-white/5 hover:text-white">
              <X size={22} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {activeTab === "queue" ? (
              <div className="flex-1 overflow-y-auto px-6 py-2 space-y-10 custom-scrollbar">
                
                {/* 1. MANUAL QUEUE SECTION */}
                <div>
                  <h2 className="text-[20px] font-black text-white px-2 mb-6">Up Next</h2>
                  {queueSongs.length > 0 ? (
                      <div className="space-y-1">
                        {queueSongs.map((song, index) => {
                          const isActive = song.id === currentSongId;
                          return (
                            <div key={`${song.id}-${index}`} className="group relative">
                              <div
                                onClick={() => onSongClick(song)}
                                className={`flex w-full cursor-pointer items-center gap-4 rounded-2xl p-2 transition-all duration-300 ${
                                  isActive ? "bg-white/10" : "hover:bg-white/5 active:bg-white/10"
                                }`}
                              >
                                <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden shadow-lg border border-white/5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={song.artwork} alt="" className="h-full w-full object-cover" />
                                  <div className={`absolute inset-0 flex items-center justify-center transition-opacity ${isActive ? "bg-black/60 opacity-100" : "bg-black/40 opacity-0 group-hover:opacity-100"}`}>
                                    {isActive ? (
                                      <AudioVisualizer active={isActive} barCount={4} color="var(--art-accent, #FA243C)" width="18px" />
                                    ) : (
                                      <Play size={16} fill="white" className="text-white ml-0.5" />
                                    )}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className={`truncate text-[15px] font-bold leading-tight mb-0.5 transition-colors ${isActive ? "text-white" : "text-white/80"}`}>{song.title}</p>
                                  <p className="truncate text-[13px] font-medium text-white/40">{song.artist}</p>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                  {!isActive && onRemoveFromQueue && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveFromQueue(index);
                                      }}
                                      className="p-2 rounded-full hover:bg-white/10 text-white/10 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                    >
                                      <Trash2 size={14} strokeWidth={2.5} />
                                    </button>
                                  )}
                                  <span className="text-[12px] font-bold text-white/20 group-hover:text-white/40 transition-colors">{song.duration}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                  ) : (
                    <div className="px-2 py-4">
                       <p className="text-[14px] font-medium text-white/20">Queue is empty</p>
                    </div>
                  )}
                </div>

                {/* 2. AUTOPLAY / RADIO SECTION */}
                <div>
                  <div className="flex items-center justify-between px-2 mb-6">
                     <h2 className="text-[17px] font-black text-white/40 uppercase tracking-widest">Discovery Radio</h2>
                     {aiLoading && (
                       <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#FA243C] animate-pulse">
                         <Sparkles size={14} />
                         <span>Curating</span>
                       </div>
                     )}
                  </div>
                  
                  {upNextQueue.length > 0 ? (
                    <div className="space-y-1">
                      {upNextQueue.map((song, index) => (
                        <div key={`auto-${song.id}-${index}`} className="group relative">
                          <button
                            type="button"
                            onClick={() => onSongClick(song)}
                            className="flex w-full cursor-pointer items-center gap-4 rounded-2xl p-2 transition-all hover:bg-white/5 active:bg-white/10"
                          >
                             <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/5">
                               {/* eslint-disable-next-line @next/next/no-img-element */}
                               <img src={song.artwork} alt="" className="h-full w-full object-cover opacity-60 group-hover:opacity-100 transition-all duration-500" />
                               <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <Play size={12} fill="white" className="text-white ml-0.5" />
                               </div>
                             </div>
                             <div className="min-w-0 flex-1 text-left">
                               <p className="truncate text-[14px] font-bold text-white/60 group-hover:text-white transition-colors leading-tight mb-0.5">{song.title}</p>
                               <p className="truncate text-[12px] font-medium text-white/30">{song.artist}</p>
                             </div>
                             
                             <div className="flex items-center gap-3">
                               {onRemoveFromUpNext && (
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     onRemoveFromUpNext(index);
                                   }}
                                   className="p-2 rounded-full hover:bg-white/10 text-white/10 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                                 >
                                   <Trash2 size={13} strokeWidth={2.5} />
                                 </button>
                               )}
                               <span className="text-[11px] font-bold text-white/10 group-hover:text-white/30">{song.duration}</span>
                             </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                       <div className="w-12 h-12 rounded-full bg-white/4 border border-white/5 flex items-center justify-center animate-pulse">
                          <Sparkles size={20} className="text-white/10" />
                       </div>
                       <p className="text-[13px] font-bold text-white/10 uppercase tracking-[0.2em]">Warming up AI Radio</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full w-full flex-col relative">
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto px-8 py-10 custom-scrollbar scroll-smooth no-scrollbar"
                >
                  <div className={!hasSynced ? "space-y-4" : "space-y-1 pb-24"}>
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
                          className={`group flex items-center transition-all duration-1000 ease-out ${hasSynced ? 'cursor-pointer' : ''} ${isInstrumental ? (isActive ? "h-[100px] opacity-100" : "h-0 opacity-0 overflow-hidden") : "min-h-[70px] py-4"}`}
                        >
                          {isInstrumental ? (
                            <div className={`flex gap-3 origin-left transition-all duration-1000 ${isActive ? "opacity-100" : "opacity-0"}`}>
                                <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.1 }} />
                                <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.1 }} />
                                <div className="h-4 w-4 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.1 }} />
                             </div>
                          ) : (
                            <p
                              className={`w-full origin-left whitespace-pre-wrap break-words transition-all duration-700 font-black tracking-tight ${
                                isActive
                                  ? "text-[32px] leading-[1.1] text-white drop-shadow-2xl scale-100"
                                  : isPast
                                  ? "text-[22px] leading-[1.2] text-white/30 blur-[0.4px] scale-98 group-hover:text-white/60 group-hover:blur-0"
                                  : "text-[22px] leading-[1.2] text-white/10 blur-[0.8px] scale-98 group-hover:text-white/40 group-hover:blur-0"
                              }`}
                            >
                              {line}
                            </p>
                          )}
                        </div>
                      );
                    })}
                    <div className="mt-20 border-t border-white/5 pt-8 pb-12 opacity-30">
                      <p className="text-[13px] font-bold text-white mb-1">Written by {currentArtist || "Unknown"}</p>
                      <p className="text-[11px] font-medium text-white/60 uppercase tracking-widest">Lyrics via {lyricsSource || "Unknown"}</p>
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
