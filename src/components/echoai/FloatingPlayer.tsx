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
}: FloatingPlayerProps) {
  const { resolveLikedLibraryRateVideoId, liveMetadata } = useDashboard();
  const isIdle = !currentSong;
  
  const displaySong = {
    id: currentSong?.id || "idle",
    title: liveMetadata?.title || currentSong?.title || "Nexus Music",
    artist: liveMetadata?.artist || currentSong?.artist || "Ready to stream",
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
      className="group relative flex h-20 w-full max-w-[780px] items-center gap-4 border border-white/10 px-4 shadow-[0_32px_80px_rgba(0,0,0,0.6)] rounded-[24px] overflow-hidden transition-colors duration-1000 mx-auto mb-24 md:mb-10 lg:mb-12 pointer-events-auto"
      style={{ backgroundColor: 'color-mix(in srgb, var(--art-accent, #1c1c1e) 15%, #080808)' }}
    >
      <div className="absolute inset-0 bg-[#080808] -z-10" />
        
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
            className="text-white rounded-full p-1 md:p-1.5 hover:bg-white/10 disabled:cursor-not-allowed"
            style={{ color: isIdle ? 'white' : 'var(--art-accent, white)' }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 md:w-7 md:h-7" fill="currentColor" strokeWidth={1} />
            ) : (
              <Play className="w-6 h-6 md:w-7 md:h-7 pl-0.5" fill="currentColor" strokeWidth={1} />
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
            className={`relative flex items-center gap-2 md:gap-3 bg-black/30 rounded-[20px] p-1.5 md:p-2 pr-3 md:pr-4 border border-white/5 overflow-hidden ${
              !isIdle 
                ? "cursor-pointer group/card hover:bg-black/40" 
                : "cursor-default opacity-80"
            }`}
          >
            {/* Artwork Wrapper */}
            <div className={`relative h-9 w-9 md:h-11 md:w-11 shrink-0 overflow-hidden rounded-xl shadow-lg border border-white/10 ${!isIdle ? 'group-hover/card:scale-105' : ''}`}>
               <MusicArtwork src={displaySong.artwork} alt={displaySong.title} iconSize={20} />
               {!isIdle && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <Maximize2 size={14} className="text-white" />
                 </div>
               )}
               {isIdle && (
                 <m.div 
                   animate={{ opacity: [0.2, 0.4, 0.2] }}
                   transition={{ duration: 3, repeat: Infinity, ease: APPLE_EASE }}
                   className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent"
                 />
               )}
            </div>

            {/* Scrolling Song Info */}
            <div className="min-w-0 flex-1 overflow-hidden">
               <div className="flex flex-col">
                  <MarqueeText 
                    text={displaySong.title} 
                    className="text-xs md:text-sm font-black text-white tracking-tight leading-tight" 
                  />
                  <button
                    onClick={(e) => {
                      if (!isIdle && onArtistClick) {
                        e.stopPropagation();
                        onArtistClick(displaySong.artist);
                      }
                    }}
                    className={`w-full text-left mt-0.5 ${
                      !isIdle && onArtistClick
                        ? "cursor-pointer"
                        : "cursor-default"
                    }`}
                  >
                    <MarqueeText 
                      text={displaySong.artist} 
                      className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-white/30 hover:text-white/70 transition-colors"
                    />
                  </button>
               </div>
            </div>

            {/* Linear Progress Indicator */}
            {!isReallyLive && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
                <div
                  className="h-full shadow-[0_0_8px_var(--art-accent,rgba(255,255,255,0.4))]"
                  style={{ 
                    width: `${progress}%`, 
                    backgroundColor: `var(--art-accent, white)`,
                    transition: 'none'
                  }}
                />
              </div>
            )}
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
                className={isLiked ? "drop-shadow-[0_0_8px_var(--art-accent,rgba(250,36,60,0.4))]" : "text-white/30 hover:text-white"}
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
    </m.div>
  );
}
