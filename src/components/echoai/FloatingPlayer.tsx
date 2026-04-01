"use client";

import { Play, Pause, SkipBack, SkipForward, Maximize2, Heart, ListMusic, Volume2 } from "lucide-react";
import { type Song } from "./types";
import { youtubeTimestampToSeconds } from "@/lib/duration";
import { motion, AnimatePresence } from "motion/react";

interface FloatingPlayerProps {
  onExpand: () => void;
  currentSong: Song;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTimeSec: number;
  durationSec: number;
  onRateSong: (videoId: string, rating: "like" | "none") => void;
  isLiked?: boolean;
  isLoggedIn?: boolean;
  onToggleRightSidebar?: () => void;
  isRightSidebarOpen?: boolean;
  volume: number;
  onVolumeChange: (v: number) => void;
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
  volume,
  onVolumeChange,
}: FloatingPlayerProps) {
  const fallbackDuration = youtubeTimestampToSeconds(currentSong.duration) ?? 0;
  const safeDuration = durationSec > 0 ? durationSec : fallbackDuration;
  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;

  return (
    <div className="pointer-events-none fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] left-0 right-0 z-50 flex items-center justify-center px-4 md:bottom-10 lg:bottom-12">
      <motion.div 
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="group relative flex w-auto max-w-[calc(100vw-2rem)] items-center gap-3 md:gap-6 rounded-full bg-linear-to-br from-white/10 to-white/5 p-1.5 pl-4 md:pl-6 pr-5 md:pr-8 backdrop-blur-3xl border border-white/10 shadow-2xl pointer-events-auto transition-all duration-500 hover:bg-white/12"
        style={{
          boxShadow: `0 20px 40px -15px rgba(0,0,0,0.5), 0 0 20px -5px var(--art-accent, rgba(255,255,255,0.1))`
        }}
      >
        
        {/* Left Section: Playback Controls */}
        <div className="flex items-center gap-3 md:gap-5 shrink-0">
          <button 
            onClick={onPrev} 
            className="text-white/40 hover:text-white transition-all transform hover:scale-110 active:scale-90"
          >
            <SkipBack className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
          </button>
          
          <button
            onClick={onTogglePlay}
            className="text-white transition-all transform hover:scale-110 active:scale-95 rounded-full p-1 md:p-1.5 hover:bg-white/10"
            style={{ color: 'var(--art-accent, white)' }}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 md:w-7 md:h-7" fill="currentColor" strokeWidth={1} />
            ) : (
              <Play className="w-6 h-6 md:w-7 md:h-7 pl-0.5" fill="currentColor" strokeWidth={1} />
            )}
          </button>
          
          <button 
            onClick={onNext} 
            className="text-white/40 hover:text-white transition-all transform hover:scale-110 active:scale-90"
          >
            <SkipForward className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" strokeWidth={0} />
          </button>
        </div>

        {/* Center Section: Compact Dynamic Track Component */}
        <motion.div 
          layout
          className="flex-1 min-w-0 max-w-[400px]"
        >
          <div 
            onClick={onExpand}
            className="relative flex items-center gap-2 md:gap-3 bg-black/30 rounded-[20px] p-1.5 md:p-2 pr-3 md:pr-4 transition-all cursor-pointer group/card hover:bg-black/40 border border-white/5 overflow-hidden"
          >
            {/* Artwork Wrapper */}
            <div className="relative h-9 w-9 md:h-11 md:w-11 shrink-0 overflow-hidden rounded-xl shadow-lg border border-white/10 group-hover/card:scale-105 transition-transform duration-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {currentSong.artwork ? (
                <img src={currentSong.artwork} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-white/5 flex items-center justify-center">
                  <Maximize2 size={16} className="text-white/20" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                 <Maximize2 size={14} className="text-white" />
              </div>
            </div>

            {/* Scrolling Song Info */}
            <div className="min-w-0 flex-1 overflow-hidden">
               <div className="flex flex-col">
                  <span className="truncate text-xs md:text-sm font-black text-white tracking-tight leading-tight">{currentSong.title}</span>
                  <span className="truncate text-[10px] md:text-[11px] font-bold text-white/30 uppercase tracking-wider">{currentSong.artist}</span>
               </div>
            </div>

            {/* Linear Progress Indicator */}
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
              <div
                className="h-full transition-[width] duration-300 ease-out shadow-[0_0_8px_var(--art-accent,rgba(255,255,255,0.4))]"
                style={{ width: `${progress}%`, backgroundColor: `var(--art-accent, white)` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Right Section: Interactive Controls */}
        <div className="flex items-center gap-3 md:gap-6 shrink-0">
          {/* Functional Volume Slider */}
          <div className="hidden items-center gap-2 lg:flex group/vol relative">
            <div className="w-0 overflow-hidden group-hover/vol:w-24 group-hover/vol:mr-3 transition-all duration-500">
               <input 
                 type="range"
                 min="0"
                 max="100"
                 value={volume}
                 onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                 className="w-full h-1 appearance-none bg-white/10 rounded-full outline-none cursor-pointer accent-white"
                 style={{ accentColor: 'var(--art-accent, white)' }}
               />
            </div>
            <Volume2 size={20} className="text-white/30 group-hover/vol:text-white transition-colors" />
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden md:block" />

          <button 
            onClick={onToggleRightSidebar}
            className="hidden md:block transition-all transform hover:scale-110 active:scale-90"
            style={{ color: isRightSidebarOpen ? 'var(--art-accent, #FA243C)' : undefined }}
          >
             <ListMusic size={24} strokeWidth={2.5} className={!isRightSidebarOpen ? "text-white/40 hover:text-white" : ""} />
          </button>
          
          {isLoggedIn && (
            <button
              onClick={() => onRateSong(currentSong.id, isLiked ? "none" : "like")}
              className="transition-all transform hover:scale-110 active:scale-95"
            >
              <Heart
                size={20}
                fill={isLiked ? "var(--art-accent, #FA243C)" : "none"}
                stroke={isLiked ? "var(--art-accent, #FA243C)" : "currentColor"}
                className={isLiked ? "drop-shadow-[0_0_8px_var(--art-accent,rgba(250,36,60,0.4))]" : "text-white/30 hover:text-white"}
              />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
