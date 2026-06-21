import { useState, useRef, useEffect, useMemo } from "react";
import { X, Play, Sparkles, Trash2, GripVertical, Plus } from "lucide-react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { AudioVisualizer } from "./AudioVisualizer";
import { motion, Reorder } from "motion/react";
import { JamSession } from "./JamSession";
import { MusicArtwork } from "./MusicArtwork";


interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "queue" | "jam" | "lyrics";
  onSongClick: (song: Song, reset?: boolean) => void;
  upNextQueue?: Song[]; // Discovery Radio Queue
  lyricsContent: string | null;
  currentTimeSec: number;
  currentArtist: string;
  lyricsSource: string | null;
  aiInsights: string;
  accentColor: string;
  onSeek?: (time: number) => void;
  currentSongId?: string;
  aiLoading?: boolean;
  onRemoveFromUpNext?: (index: number) => void;
  onClearQueue?: () => void;
  onReorderUpNext?: (newQueue: Song[]) => void;
  onNavigateArtist?: (name: string) => void;
}

export function RightSidebar({
  isOpen,
  onClose,
  mode = "queue",
  onSongClick,
  upNextQueue = [],
  lyricsContent,
  currentTimeSec,
  currentArtist,
  lyricsSource,
  // aiInsights omitted to avoid unused warning
  accentColor,
  onSeek,
  currentSongId,
  aiLoading,
  onRemoveFromUpNext,
  onClearQueue,
  onReorderUpNext,
  onNavigateArtist,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics" | "jam">("queue");

  // Sync internal activeTab with external mode prop when it changes
  useEffect(() => {
    if (mode) {
      setTimeout(() => {
        setActiveTab(mode as "queue" | "jam" | "lyrics");
      }, 0);
    }
  }, [mode]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // (Internal lyrics logic remains same...)
  const plainLines = (lyricsContent || "")
    .replace(/\[\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?\]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  
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
      <motion.div 
        key={accentColor}
        className="fixed right-0 top-0 z-60 hidden h-[100dvh] w-[380px] flex-col border-l border-white/10 shadow-2xl lg:flex"
        animate={{ 
          backgroundColor: accentColor 
            ? `color-mix(in srgb, ${accentColor} 12%, #000000)` 
            : "#000000" 
        }}
        transition={{ duration: 1 }}
      >
          <div className="flex items-center justify-between px-6 py-5 pt-[max(1.5rem,env(safe-area-inset-top))] border-b border-white/5">
            <h2 className="text-[17px] font-black uppercase tracking-[0.2em] text-white/90">
              {activeTab === "queue" ? "Queue" : activeTab === "lyrics" ? "Lyrics" : "Session"}
            </h2>
            <button onClick={onClose} className="rounded-full p-1 text-white/30 hover:bg-white/5 hover:text-white transition-all active:scale-95">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {activeTab === "queue" ? (
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 custom-scrollbar">
                <div>
                  <div className="flex items-center justify-between px-1 mb-4">
                    <div className="flex items-center gap-3">
                      {upNextQueue.length > 0 && (
                        <button 
                          onClick={() => onClearQueue?.()}
                          className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/5 text-[10px] font-black text-white/30 hover:text-red-500 hover:bg-white/10 flex items-center gap-1.5 transition-all"
                          title="Clear Queue"
                        >
                          Clear Queue
                          <Trash2 size={10} />
                        </button>
                      )}
                    </div>
                    {aiLoading && (
                      <div className="flex items-center gap-1 text-[10px] font-black tracking-wider uppercase animate-pulse" style={{ color: 'var(--art-accent, #FA243C)' }}>
                        <Sparkles size={11} />
                        <span>Curating Radio</span>
                      </div>
                    )}
                  </div>

                  <Reorder.Group 
                    axis="y" 
                    values={upNextQueue} 
                    onReorder={onReorderUpNext || (() => {})} 
                    className="space-y-1.5"
                  >
                    {upNextQueue.length > 0 ? (
                      upNextQueue.map((song, index) => {
                        const isActive = song.id === currentSongId;
                        return (
                          <Reorder.Item 
                            key={song.id} 
                            value={song}
                            className="group relative"
                          >
                            <div
                              onClick={() => onSongClick(song, false)}
                              className={`flex w-full cursor-pointer items-center gap-3 rounded-xl p-1.5 transition-all duration-300 ${
                                isActive ? "bg-white/[0.06] border border-white/5" : "border border-transparent hover:bg-white/[0.03] active:bg-white/[0.05]"
                              }`}
                            >
                              <div className="flex items-center">
                                <div className="opacity-0 group-hover:opacity-40 p-1 -ml-1 text-white/30 hover:text-white/60 cursor-grab active:cursor-grabbing transition-opacity duration-300">
                                  <GripVertical size={13} />
                                </div>
                                <div className="relative shrink-0 w-10 h-10 rounded-lg overflow-hidden border border-white/5 bg-white/5 shadow-md">
                                   <MusicArtwork src={song.artwork} alt={song.title} iconSize={16} />
                                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isActive ? "bg-black/60 opacity-100" : "bg-black/40 opacity-0 group-hover:opacity-100"}`}>
                                    {isActive ? (
                                      <AudioVisualizer active={isActive} barCount={4} color="var(--art-accent, #FA243C)" width="16px" />
                                    ) : (
                                      <Play size={14} fill="white" className="text-white ml-0.5" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <p className={`truncate text-[13px] font-bold leading-none ${isActive ? "text-white" : "text-white/80"}`}>{song.title}</p>
                                  {song.isManual && !isActive && (
                                    <div className="shrink-0 flex items-center justify-center p-0.5 rounded-[4px] border" style={{ backgroundColor: 'var(--art-accent, #FA243C)22', borderColor: 'var(--art-accent, #FA243C)33' }} title="Added to Queue">
                                       <Plus size={6} style={{ color: 'var(--art-accent, #FA243C)' }} />
                                    </div>
                                  )}
                                </div>
                                <p 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateArtist?.(song.artist);
                                  }}
                                  className="truncate text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors mt-1"
                                >
                                    {song.artist}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-2 pr-1">
                                {!isActive && onRemoveFromUpNext && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveFromUpNext(index);
                                    }}
                                    className="p-1.5 rounded-full hover:bg-white/10 text-white/10 hover:text-white opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-all duration-300"
                                  >
                                    <Trash2 size={12} strokeWidth={2.5} />
                                  </button>
                                )}
                                <span className="text-[11px] font-bold text-white/20 group-hover:text-white/40 transition-colors">{song.duration}</span>
                              </div>
                            </div>
                          </Reorder.Item>
                        );
                      })
                    ) : (
                      aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                           <div className="w-10 h-10 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center animate-pulse">
                              <Sparkles size={16} className="text-white/20" />
                           </div>
                           <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.22em]">Curating Radio</p>
                        </div>
                      ) : (
                        <div className="px-2 py-8 text-center">
                          <p className="text-[12px] font-bold text-white/20 uppercase tracking-[0.1em]">Queue is empty</p>
                        </div>
                      )
                    )}
                  </Reorder.Group>
                </div>
              </div>
            ) : activeTab === "jam" ? (
              <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar">
                 <JamSession />
              </div>
            ) : (
              <div className="flex h-full w-full flex-col relative">
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto px-6 py-[30%] custom-scrollbar scroll-smooth no-scrollbar"
                  style={{
                    maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                  }}
                >
                  <div className={`max-w-2xl mx-auto ${!hasSynced ? "space-y-6" : "space-y-2 pb-32"}`}>
                    {lines.map((line, index) => {
                      const isActive = hasSynced && index === activeIndex;
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
                          className={`group flex items-center transition-all duration-700 ease-out origin-left transform ${
                            hasSynced ? 'cursor-pointer' : ''
                          } ${
                            isInstrumental 
                                ? (isActive ? "h-[60px] opacity-100" : "h-0 opacity-0 overflow-hidden") 
                                : "min-h-[48px] py-3.5"
                          } ${
                            isActive 
                                ? "opacity-100 scale-100 blur-0 translate-x-1" 
                                : "opacity-25 scale-[0.96] blur-[0.4px] hover:opacity-60 hover:blur-0 hover:translate-x-0.5"
                          }`}
                        >
                          {isInstrumental ? (
                            <div className={`flex gap-2 origin-left transition-all duration-500 ${isActive ? "opacity-100" : "opacity-0"}`}>
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.1 }} />
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.1 }} />
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.1 }} />
                             </div>
                          ) : (
                            <p
                              className={`w-full origin-left whitespace-pre-wrap break-words text-balance transition-all duration-700 font-extrabold tracking-tight ${
                                !hasSynced
                                  ? "text-[18px] leading-[1.4] text-white/80 scale-100 group-hover:text-white"
                                  : "text-[24px] leading-[1.2] text-white"
                              }`}
                            >
                              {line}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-16 border-t border-white/5 pt-6 pb-12 opacity-40">
                    <p 
                      onClick={() => onNavigateArtist?.(currentArtist)}
                      className="text-[10px] font-black uppercase tracking-widest text-white/50 mb-1.5 hover:text-white cursor-pointer transition-colors"
                    >
                      Written by {currentArtist || "Unknown"}
                    </p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/20">Lyrics via {lyricsSource || "Unknown"}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
      </motion.div>
    </>
  );
}
