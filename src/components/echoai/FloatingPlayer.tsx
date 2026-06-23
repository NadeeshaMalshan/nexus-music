"use client";

import { Play, Pause, SkipBack, SkipForward, Maximize2, Heart, ListMusic, Volume2, Users, Mic2 } from "lucide-react";
import { type Song } from "./types";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { m, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";
import { APPLE_EASE, SLIDE_UP_VARIANTS } from "@/lib/animations";
import { useDashboard } from "@/context/DashboardContext";
import { MarqueeText } from "./MarqueeText";

interface FloatingPlayerProps {
  onExpand: () => void;
  currentSong?: Song | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTimeSec: number;
  durationSec: number;
  onRateSong: (videoId: string, rating: "like" | "none", meta?: { title: string; artist: string }) => void | Promise<void>;
  isLiked?: boolean;
  isLoggedIn?: boolean;
  onToggleRightSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  rightSidebarMode?: "queue" | "jam" | "lyrics";
  onSetRightSidebarMode?: (mode: "queue" | "jam" | "lyrics") => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  onArtistClick?: (artistName: string) => void;
  onSeek?: (time: number) => void;
}

export function FloatingPlayer({
  onExpand,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTimeSec,
  durationSec,
  onRateSong,
  isLiked = false,
  isLoggedIn,
  onToggleRightSidebar,
  isRightSidebarOpen,
  rightSidebarMode,
  onSetRightSidebarMode,
  volume,
  onVolumeChange,
  onArtistClick,
  onSeek,
}: FloatingPlayerProps) {
  const { resolveLikedLibraryRateVideoId, liveMetadata } = useDashboard();
  const isIdle = !currentSong;
  
  const rawTitle = liveMetadata?.title || currentSong?.title || "Nexus Music";
  const featMatch = rawTitle.match(/\b(?:feat\.|ft\.|featuring)\s+([^)\]]+)/i);
  const featured = featMatch ? featMatch[1].trim() : "";
  const cleanTitle = rawTitle.replace(/\s*[([].*?[)\]]\s*/g, '').trim();
  const baseArtist = liveMetadata?.artist || currentSong?.artist || "Ready to stream";
  const fullArtist = featured && !baseArtist.toLowerCase().includes(featured.toLowerCase()) 
    ? `${baseArtist} & ${featured}` 
    : baseArtist;

  const displaySong = {
    id: currentSong?.id || "idle",
    title: cleanTitle,
    artist: fullArtist,
    artwork: liveMetadata?.artwork || currentSong?.artwork || null,
    duration: currentSong?.duration || "0:00",
    color: currentSong?.color || "#FA243C",
  };

  const fallbackDuration = youtubeTimestampToSeconds(displaySong.duration) ?? 0;
  const safeDuration = durationSec > 0 ? durationSec : fallbackDuration;
  const isReallyLive = currentSong?.isLive || displaySong.duration === "LIVE" || !!liveMetadata || safeDuration > 43200 || (!isIdle && isPlaying && safeDuration === 0);
  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;
  return (
    <m.div 
      className="group relative flex h-[76px] w-full max-w-[800px] items-center justify-between gap-6 border border-white/10 px-6 shadow-[0_30px_60px_rgba(0,0,0,0.8)] rounded-2xl overflow-hidden mx-auto mb-24 md:mb-10 lg:mb-12 pointer-events-auto bg-[#0a0a0a]/90 backdrop-blur-2xl"
    >
        
        {/* Left Section: Playback Controls */}
        <div className={`flex items-center gap-3 md:gap-5 shrink-0 ${isIdle ? 'opacity-40 grayscale' : ''}`}>
          <button 
            onClick={onPrev} 
            disabled={isIdle}
            className="text-white/40 hover:text-white disabled:cursor-not-allowed"
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
          </button>
          
          <button
            onClick={onTogglePlay}
            disabled={isIdle}
            className="text-white hover:scale-105 active:scale-95 transition-transform disabled:cursor-not-allowed"
            style={{ color: isIdle ? 'white' : 'var(--art-accent, white)' }}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" fill="currentColor" strokeWidth={0} />
            ) : (
              <Play className="w-8 h-8" fill="currentColor" strokeWidth={0} />
            )}
          </button>
          
          <button 
            onClick={onNext} 
            disabled={isIdle}
            className="text-white/40 hover:text-white disabled:cursor-not-allowed"
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
          </button>
        </div>

        {/* Center Section: Compact Dynamic Track Component */}
        <m.div 
          layout
          className="flex-1 min-w-0 max-w-[400px]"
        >
          <div 
            onClick={!isIdle ? onExpand : undefined}
            className={`relative flex items-center gap-4 bg-white/5 rounded-xl p-1.5 pr-6 border border-transparent overflow-hidden ${
              !isIdle 
                ? "cursor-pointer group/card hover:bg-white/10 hover:border-white/10 transition-all duration-300" 
                : "cursor-default opacity-80"
            }`}
          >
            {/* Artwork Wrapper */}
            <div className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-lg shadow-md border border-white/5 ${!isIdle ? 'group-hover/card:scale-[1.02] transition-transform' : ''}`}>
               <MusicArtwork src={displaySong.artwork} alt={displaySong.title} iconSize={20} rounded="none" className="w-full h-full" />
               {!isIdle && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <Maximize2 size={16} className="text-white" />
                 </div>
               )}
               {isIdle && (
                 <m.div 
                   animate={{ opacity: [0.1, 0.2, 0.1] }}
                   transition={{ duration: 3, repeat: Infinity, ease: APPLE_EASE }}
                   className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent"
                 />
               )}
            </div>

            {/* Scrolling Song Info */}
            <div className="min-w-[120px] flex-1 overflow-hidden">
               <div className="flex flex-col justify-center h-full">
                  <MarqueeText 
                    text={displaySong.title} 
                    className="text-[16px] font-black text-white tracking-tighter leading-none mb-1" 
                  />
                  <div 
                    className="w-full text-left overflow-x-auto no-scrollbar custom-scrollbar"
                    style={{
                      maskImage: 'linear-gradient(to right, black 85%, transparent)',
                      WebkitMaskImage: 'linear-gradient(to right, black 85%, transparent)'
                    }}
                  >
                    <div className="text-[11px] font-black uppercase tracking-widest text-white/40 leading-none whitespace-nowrap min-w-max pb-1">
                      {displaySong.artist.split(/(,\s*|\s*&\s*|\s+feat\.\s+|\s+featuring\s+)/i).map((part, i) => {
                         if (part.match(/^(,\s*|\s*&\s*|\s+feat\.\s+|\s+featuring\s+)$/i)) {
                            return <span key={i} className="whitespace-pre">{part}</span>;
                         }
                         return (
                            <span 
                              key={i} 
                              className={(!isIdle && onArtistClick) ? "hover:text-white cursor-pointer transition-colors" : ""}
                              onClick={(e) => {
                                if (!isIdle && onArtistClick) {
                                  e.stopPropagation();
                                  onArtistClick(part.trim());
                                }
                              }}
                            >
                              {part}
                            </span>
                         );
                      })}
                    </div>
                  </div>
               </div>
            </div>

          </div>
        </m.div>

        {/* Right Section: Interactive Controls */}
        <div className="flex items-center gap-3 md:gap-6 shrink-0">
          {isLoggedIn && !isIdle && (
            <button
              onClick={() => {
                if (isLiked) void onRateSong(resolveLikedLibraryRateVideoId(displaySong as Song), "none");
                else void onRateSong(displaySong.id, "like", { title: displaySong.title, artist: displaySong.artist });
              }}
              className=""
            >
              <Heart
                size={20}
                fill={isLiked ? "var(--art-accent, #FA243C)" : "none"}
                stroke={isLiked ? "var(--art-accent, #FA243C)" : "currentColor"}
                className={isLiked ? "" : "text-white/30 hover:text-white"}
              />
            </button>
          )}
          {/* Functional Volume Slider */}
          <div className="hidden items-center gap-2 lg:flex group/vol relative">
            <div className="w-0 overflow-hidden group-hover/vol:w-24 group-hover/vol:mr-3">
               <input 
                 type="range"
                 min="0"
                 max="100"
                 step="1"
                 value={volume}
                 onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                 className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer accent-white"
                 style={{ accentColor: 'var(--art-accent, white)' }}
               />
            </div>
            <Volume2 size={20} className="text-white/30 group-hover/vol:text-white" />

            
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

          <button 
            onClick={() => {
              if (rightSidebarMode === "lyrics" && isRightSidebarOpen) {
                 onToggleRightSidebar?.();
              } else {
                 onSetRightSidebarMode?.("lyrics");
                 if (!isRightSidebarOpen) onToggleRightSidebar?.();
              }
            }}
            className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
            style={{ color: (isRightSidebarOpen && rightSidebarMode === "lyrics") ? 'var(--art-accent, #FA243C)' : undefined }}
          >
             <Mic2 size={20} className={(!isRightSidebarOpen || rightSidebarMode !== "lyrics") ? "text-white/40 hover:text-white" : ""} />
          </button>

          <button 
            onClick={() => {
              if (rightSidebarMode === "jam" && isRightSidebarOpen) {
                 onToggleRightSidebar?.();
              } else {
                 onSetRightSidebarMode?.("jam");
                 if (!isRightSidebarOpen) onToggleRightSidebar?.();
              }
            }}
            className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
            style={{ color: (isRightSidebarOpen && rightSidebarMode === "jam") ? 'var(--art-accent, #FA243C)' : undefined }}
          >
             <Users size={22} strokeWidth={2.5} className={(!isRightSidebarOpen || rightSidebarMode !== "jam") ? "text-white/40 hover:text-white" : ""} />
          </button>

          <button 
            onClick={() => {
              if (rightSidebarMode === "queue" && isRightSidebarOpen) {
                 onToggleRightSidebar?.();
              } else {
                 onSetRightSidebarMode?.("queue");
                 if (!isRightSidebarOpen) onToggleRightSidebar?.();
              }
            }}
            className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
            style={{ color: (isRightSidebarOpen && rightSidebarMode === "queue") ? 'var(--art-accent, #FA243C)' : undefined }}
          >
             <ListMusic size={24} strokeWidth={2.5} className={(!isRightSidebarOpen || rightSidebarMode !== "queue") ? "text-white/40 hover:text-white" : ""} />
          </button>
          
          
          
        </div>

        {/* Interactive Linear Progress Indicator (Outer Bottom Edge) */}
        {!isReallyLive && (
          <div className="absolute bottom-0 left-0 right-0 h-3 group/seek flex items-end overflow-hidden z-20">
            <input
              type="range"
              min={0}
              max={safeDuration || 100}
              value={currentTimeSec || 0}
              onChange={(e) => {
                if (onSeek) onSeek(parseFloat(e.target.value));
              }}
              className="w-full h-[3px] appearance-none bg-white/5 cursor-pointer hover:h-[5px] transition-[height] m-0 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0"
              style={{
                background: `linear-gradient(to right, var(--art-accent, #FA243C) ${progress}%, transparent ${progress}%)`,
              }}
            />
          </div>
        )}
    </m.div>
  );
}
