import { useState, useRef, useEffect, useMemo } from "react";
import { X, Play, Sparkles, Trash2, GripVertical, Plus, Loader2 } from "lucide-react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { AudioVisualizer } from "./AudioVisualizer";
import { motion, Reorder, AnimatePresence } from "motion/react";
import { SessionFriendsPanel } from "./SessionFriendsPanel";
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
  currentSong?: Song | null;
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
  currentSong,
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          key="right-sidebar"
          initial={{ x: "100%", opacity: 0 }}
          animate={{ 
            x: 0, 
            opacity: 1,
            backgroundColor: "rgba(13, 13, 13, 0.82)" 
          }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed right-0 top-0 z-60 hidden h-[100dvh] w-[380px] flex-col border-l border-white/10 shadow-2xl lg:flex"
          style={{
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)"
          }}
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
                  <div className="flex items-end justify-between px-2 mb-8">
                    <div className="flex items-center gap-3">
                      {upNextQueue.length > 0 && (
                        <button 
                          onClick={() => onClearQueue?.()}
                          className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 hover:text-white flex items-center gap-2 transition-colors"
                          title="Clear Queue"
                        >
                          Clear Queue
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                    {/* Removed small curating indicator */}
                  </div>

                  {currentSong && (
                    <div className="mb-6">
                      <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-3 px-2">Now Playing</p>
                      <div className="flex w-full cursor-pointer items-center gap-4 p-2 rounded-2xl transition-all duration-300 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
                        <div className="flex items-center">
                          <div className="relative shrink-0 w-12 h-12 bg-black/20 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                            <MusicArtwork src={currentSong.artwork} alt={currentSong.title} iconSize={20} />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-100 backdrop-blur-[2px]">
                              <AudioVisualizer active={true} barCount={4} color="var(--art-accent, #FA243C)" width="16px" />
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="line-clamp-1 text-[15px] font-black tracking-tight leading-tight text-black">{currentSong.title}</p>
                          </div>
                          <p 
                            onClick={(e) => {
                              e.stopPropagation();
                              onNavigateArtist?.(currentSong.artist);
                            }}
                            className="truncate text-[11px] font-bold text-black/60 hover:text-black transition-colors mt-1"
                          >
                            {currentSong.artist}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 pr-2">
                          <p className="text-[10px] font-black tracking-widest text-black/70">
                            {currentSong.duration}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {upNextQueue.length > 0 && (
                    <p className="text-[10px] font-bold text-white/50 uppercase tracking-[0.2em] mb-3 px-2">Up Next</p>
                  )}
                  <Reorder.Group 
                    axis="y" 
                    values={upNextQueue} 
                    onReorder={onReorderUpNext || (() => {})} 
                    className="flex flex-col gap-2"
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
                              className={`flex w-full cursor-pointer items-center gap-4 p-2 rounded-2xl transition-all duration-300 ${
                                isActive ? "bg-white/[0.06] border border-white/10 backdrop-blur-md" : "border border-transparent hover:bg-white/[0.04]"
                              }`}
                            >
                              <div className="flex items-center">
                                <div className={`opacity-0 group-hover:opacity-100 p-2 -ml-2 cursor-grab active:cursor-grabbing transition-opacity ${isActive ? "text-white/60 hover:text-white" : "text-white/30 hover:text-white"}`}>
                                  <GripVertical size={14} />
                                </div>
                                <div className="relative shrink-0 w-12 h-12 bg-black/20 rounded-xl overflow-hidden border border-white/10 shadow-lg">
                                   <MusicArtwork src={song.artwork} alt={song.title} iconSize={20} />
                                  <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${isActive ? "bg-black/50 opacity-100 backdrop-blur-[2px]" : "bg-black/60 opacity-0 group-hover:opacity-100"}`}>
                                    {isActive ? (
                                      <AudioVisualizer active={isActive} barCount={4} color="var(--art-accent, #FA243C)" width="16px" />
                                    ) : (
                                      <Play size={16} fill="white" className="text-white ml-0.5" />
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="flex items-center gap-2">
                                  <p className={`line-clamp-1 text-[15px] font-bold tracking-tight leading-tight transition-colors ${isActive ? "text-white" : "text-white/90 group-hover:text-white"}`}>{song.title}</p>
                                  {song.isManual && !isActive && (
                                    <div className="shrink-0 flex items-center justify-center p-0.5 rounded-[4px] border border-white/20" style={isActive ? { backgroundColor: 'var(--art-accent, #FA243C)22', borderColor: 'var(--art-accent, #FA243C)33' } : {}} title="Added to Queue">
                                       <Plus size={8} className="text-white/50" />
                                    </div>
                                  )}
                                </div>
                                <p 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onNavigateArtist?.(song.artist);
                                  }}
                                  className={`truncate text-[11px] font-medium transition-colors mt-1 ${isActive ? "text-white/60 hover:text-white" : "text-white/40 hover:text-white/80"}`}
                                >
                                    {song.artist}
                                </p>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <p className={`text-[10px] font-black tracking-widest ${isActive ? "text-white/70" : "text-white/30"}`}>
                                    {song.duration}
                                </p>
                                {!isActive && onRemoveFromUpNext && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRemoveFromUpNext(index);
                                    }}
                                    className="p-1.5 text-white/20 hover:bg-white/10 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </Reorder.Item>
                        );
                      })
                    ) : (
                      aiLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                           <Loader2 size={24} className="text-white/30 animate-spin" />
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
              <div className="flex flex-1 flex-col overflow-hidden px-6 py-6">
                 <SessionFriendsPanel accentColor={accentColor} className="h-full" />
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
      )}
    </AnimatePresence>
  );
}
