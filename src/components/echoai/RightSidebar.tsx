import { useState, useRef, useEffect, useMemo } from "react";
import { X, Play, Sparkles, Trash2, GripVertical, Plus, Loader2 } from "lucide-react";
import { type Song } from "./types";
import { parseLrcContent } from "@/lib/lrc";
import { type LyricsLine, type LyricsSyncType, type LyricsWord } from "@/lib/lyrics/types";
import { findActiveLineIndex } from "@/lib/lyrics/synchronizer/playbackSynchronizer";
import { AudioVisualizer } from "./AudioVisualizer";
import { motion, Reorder, AnimatePresence } from "motion/react";
import { SessionFriendsPanel } from "./SessionFriendsPanel";
import { MusicArtwork } from "./MusicArtwork";
import { KaraokeWordLine } from "./KaraokeWordLine";


interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: "queue" | "jam" | "lyrics";
  onSongClick: (song: Song, reset?: boolean) => void;
  upNextQueue?: Song[]; // Discovery Radio Queue
  lyricsContent: string | null;
  lyricsLines?: LyricsLine[];
  lyricsSyncType?: LyricsSyncType;
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
  lyricsLines,
  lyricsSyncType,
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

  interface SidebarLine {
    at: number;
    text: string;
    isInstrumental: boolean;
    words?: LyricsWord[];
  }

  // Use structured lyricsLines if available, otherwise fall back to syncedLines
  const effectiveLines: SidebarLine[] = useMemo(() => {
    if (lyricsLines && lyricsLines.length > 0) {
      return lyricsLines.map((l) => ({
        at: l.start,
        text: l.text,
        isInstrumental: l.isInstrumental || false,
        words: l.words,
      }));
    }
    return syncedLines.map((l) => ({ ...l, words: undefined }));
  }, [lyricsLines, syncedLines]);

  const hasSynced = effectiveLines.length > 0;
  const activeIndex = hasSynced
    ? (lyricsLines && lyricsLines.length > 0
        ? findActiveLineIndex(lyricsLines, currentTimeSec)
        : effectiveLines.findIndex((line, index) => {
            const next = effectiveLines[index + 1];
            return currentTimeSec >= line.at && (!next || currentTimeSec < next.at);
          }))
    : -1;

  const lines = hasSynced ? effectiveLines.map((l) => l.text) : plainLines;

  const scrollAnimRef = useRef<number | null>(null);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smooth vertical scrolling when active lyric changes (Effect 4)
  useEffect(() => {
    if (!hasSynced || activeIndex < 0 || !scrollRef.current) return;
    if (activeTab !== "lyrics") return;
    if (isUserScrollingRef.current) return;

    const container = scrollRef.current;
    const activeEl = elementsRef.current[activeIndex];
    if (!activeEl) return;

    const containerHeight = container.clientHeight;
    // Align active line around 35% from top of sidebar container (Apple Music focal point)
    const targetScroll = Math.max(
      0,
      activeEl.offsetTop - (containerHeight * 0.35) + (activeEl.clientHeight / 2)
    );

    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }

    const startScroll = container.scrollTop;
    const diff = targetScroll - startScroll;
    if (Math.abs(diff) < 2) return;

    const duration = 650; // ms
    const startTime = performance.now();
    // Quartic ease out curve (Apple-smooth fluid motion)
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      container.scrollTop = startScroll + diff * easeOut(progress);

      if (progress < 1) {
        scrollAnimRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimRef.current = null;
      }
    };

    scrollAnimRef.current = requestAnimationFrame(step);

    return () => {
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
    };
  }, [activeIndex, hasSynced, activeTab]);

  // Pause auto-scroll briefly when user manually scrolls
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onUserInteraction = () => {
      isUserScrollingRef.current = true;
      if (scrollAnimRef.current) {
        cancelAnimationFrame(scrollAnimRef.current);
        scrollAnimRef.current = null;
      }
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      userScrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 3500);
    };

    container.addEventListener("wheel", onUserInteraction, { passive: true });
    container.addEventListener("touchmove", onUserInteraction, { passive: true });

    return () => {
      container.removeEventListener("wheel", onUserInteraction);
      container.removeEventListener("touchmove", onUserInteraction);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, [activeTab]);

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
                  className="flex-1 overflow-y-auto px-6 pt-[32vh] pb-[48vh] custom-scrollbar no-scrollbar select-none"
                  style={{
                    maskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)",
                  }}
                >
                  <div className={`max-w-2xl mx-auto ${!hasSynced ? "space-y-6" : "space-y-2 pb-24"}`}>
                    {lines.map((line, index) => {
                      const isActive = hasSynced && index === activeIndex;
                      const lineItem = effectiveLines[index];
                      const isInstrumental = hasSynced && lineItem?.isInstrumental;

                      let instProgress = 0;
                      if (isInstrumental && isActive && lineItem) {
                        const start = lineItem.at;
                        const next = effectiveLines[index + 1];
                        const end = next ? next.at : start + 5;
                        const dur = end > start ? end - start : 5;
                        instProgress = Math.max(0, Math.min(1, (currentTimeSec - start) / dur));
                      }

                      const dot1Op = 0.2 + 0.8 * Math.max(0, Math.min(1, instProgress / 0.33));
                      const dot2Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.33) / 0.33));
                      const dot3Op = 0.2 + 0.8 * Math.max(0, Math.min(1, (instProgress - 0.66) / 0.34));

                      // 4 Apple Music animation effects:
                      // 1. Active lyric line: Bright white, bold text that stands out clearly
                      // 2. Upcoming lyrics: Dimmed text with a subtle blur effect
                      // 3. Previous lyrics: Move upward smoothly while gradually fading out and becoming more blurred
                      let lineStyle: React.CSSProperties = {
                        opacity: 0.8,
                        filter: "blur(0px)",
                        transform: "scale(1) translate3d(0, 0, 0)",
                        transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
                        willChange: "transform, opacity, filter",
                      };

                      if (hasSynced && activeIndex >= 0) {
                        if (isActive) {
                          lineStyle = {
                            opacity: 1,
                            filter: "blur(0px)",
                            transform: "scale(1.02) translate3d(4px, 0, 0)",
                            transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
                            willChange: "transform, opacity, filter",
                          };
                        } else if (index > activeIndex) {
                          lineStyle = {
                            opacity: 0.35,
                            filter: "blur(1.5px)",
                            transform: "scale(0.98) translate3d(0, 0, 0)",
                            transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
                            willChange: "transform, opacity, filter",
                          };
                        } else {
                          const diff = activeIndex - index;
                          let op = 0.02;
                          let blurPx = 6.5;
                          let scaleVal = 0.92;
                          let yOffset = -6;

                          if (diff === 1) {
                            op = 0.28;
                            blurPx = 2;
                            scaleVal = 0.97;
                            yOffset = -2;
                          } else if (diff === 2) {
                            op = 0.16;
                            blurPx = 3.5;
                            scaleVal = 0.95;
                            yOffset = -3;
                          } else if (diff === 3) {
                            op = 0.08;
                            blurPx = 5;
                            scaleVal = 0.93;
                            yOffset = -5;
                          }

                          lineStyle = {
                            opacity: op,
                            filter: `blur(${blurPx}px)`,
                            transform: `scale(${scaleVal}) translate3d(0, ${yOffset}px, 0)`,
                            transition: "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.65s cubic-bezier(0.25, 1, 0.5, 1), filter 0.65s cubic-bezier(0.25, 1, 0.5, 1)",
                            willChange: "transform, opacity, filter",
                          };
                        }
                      }

                      return (
                        <div 
                          key={`${index}`} 
                          ref={(el) => { elementsRef.current[index] = el; }}
                          onClick={() => { if (hasSynced && onSeek && lineItem) onSeek(lineItem.at); }}
                          style={lineStyle}
                          className={`group flex items-center origin-left transform-gpu ${
                            hasSynced ? 'cursor-pointer' : 'cursor-default'
                          } ${
                            isInstrumental 
                                ? (isActive ? "h-[54px]" : "h-[32px]") 
                                : !line || !line.trim()
                                  ? "h-[28px]"
                                  : "min-h-[44px] py-3"
                          } ${!isActive && hasSynced ? "hover:opacity-75 hover:filter-none hover:scale-[0.99]" : ""}`}
                        >
                          {isInstrumental ? (
                            <div className={`flex gap-2 origin-left transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-30"}`}>
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot1Op : 0.2 }} />
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot2Op : 0.2 }} />
                                <div className="h-2.5 w-2.5 rounded-full bg-white shadow-xl transition-opacity duration-300" style={{ opacity: isActive ? dot3Op : 0.2 }} />
                             </div>
                          ) : hasSynced ? (
                            <KaraokeWordLine
                              words={lineItem?.words}
                              lineText={line}
                              syncedLine={lineItem ? { text: line, start: lineItem.at, end: lineItem.at + 4, words: lineItem.words } : null}
                              currentTimeSec={currentTimeSec}
                              isActive={isActive}
                              isPastLine={hasSynced && activeIndex >= 0 && index < activeIndex}
                              isUpcomingLine={hasSynced && activeIndex >= 0 && index > activeIndex}
                              sizeVariant="sidebar"
                            />
                          ) : (
                            <p
                              className={`w-full origin-left whitespace-pre-wrap break-words text-balance tracking-tight ${
                                !hasSynced
                                  ? (line.includes("not available") || line.includes("Loading")
                                      ? "text-[24px] leading-[1.2] text-white/40 font-medium"
                                      : "text-[24px] leading-[1.2] text-white/80 font-extrabold")
                                  : isActive
                                    ? "text-[24px] leading-[1.2] text-white font-extrabold drop-shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                                    : "text-[24px] leading-[1.2] text-white font-extrabold"
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
