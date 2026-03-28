import { useState, useRef, useEffect, useMemo } from "react";
import { List, FileText, X } from "lucide-react";
import { type Song } from "./types";
import { motion, AnimatePresence } from "motion/react";
import { parseLrcContent } from "@/lib/lrc";

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSongClick: (song: Song) => void;
  queueSongs: Song[];
  lyricsContent: string | null;
  currentTimeSec: number;
  currentArtist: string;
  lyricsSource: string | null;
  aiInsights: string;
  accentColor: string;
  onSeek?: (time: number) => void;
}

export function RightSidebar({
  isOpen,
  onClose,
  onSongClick,
  queueSongs,
  lyricsContent,
  currentTimeSec,
  currentArtist,
  lyricsSource,
  aiInsights,
  accentColor,
  onSeek,
}: RightSidebarProps) {
  const [activeTab, setActiveTab] = useState<"queue" | "lyrics">("queue");
  const scrollRef = useRef<HTMLDivElement>(null);
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);

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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: 400, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 400, opacity: 0 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="glass flex h-full w-[380px] flex-col border-l border-white/[0.08]"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] p-6">
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
                        borderColor: `${accentColor}55`,
                        boxShadow: `0 0 15px ${accentColor}33`,
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
                        borderColor: `${accentColor}55`,
                        boxShadow: `0 0 15px ${accentColor}33`,
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
              <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar">
                <p className="mb-4 text-xs uppercase tracking-wider text-white/40">Up Next • {queueSongs.length} tracks</p>
                {queueSongs.map((song, index) => (
                  <motion.button
                    key={song.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onSongClick(song)}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-xl p-3 text-left transition-colors hover:bg-white/[0.04]"
                  >
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={song.artwork} alt={song.title} className="h-14 w-14 rounded-lg object-cover" />
                      <div className="absolute inset-0 rounded-lg bg-black/40 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white transition-colors group-hover:text-white">{song.title}</p>
                      <p className="truncate text-xs text-white/50">{song.artist}</p>
                    </div>
                    <span className="text-xs text-white/40">{song.duration}</span>
                  </motion.button>
                ))}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
