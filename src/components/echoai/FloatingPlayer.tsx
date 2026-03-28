import { Play, Pause, SkipBack, SkipForward, Maximize2, Heart } from "lucide-react";
import { type Song } from "./types";
import { motion } from "motion/react";
import { youtubeTimestampToSeconds } from "@/lib/duration";

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
}: FloatingPlayerProps) {
  const c = currentSong.color;
  const fallbackDuration = youtubeTimestampToSeconds(currentSong.duration) ?? 0;
  const safeDuration = durationSec > 0 ? durationSec : fallbackDuration;
  const progress = safeDuration > 0 ? Math.min(100, (Math.max(0, currentTimeSec) / safeDuration) * 100) : 0;

  return (
    <div className="fixed bottom-24 lg:bottom-8 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 lg:left-1/2 lg:right-auto lg:w-auto lg:-translate-x-1/2 lg:gap-4 lg:px-0 pointer-events-none">
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="group relative w-full sm:w-[400px] lg:w-auto pointer-events-auto">
        <div
          className="absolute inset-0 rounded-full blur-2xl opacity-60 transition-all duration-1000 group-hover:opacity-100"
          style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--art-accent, #a855f7) 25%, transparent), color-mix(in srgb, var(--art-accent, #a855f7) 12%, transparent), color-mix(in srgb, var(--art-accent, #a855f7) 25%, transparent))` }}
        />

          <div className="glass relative flex items-center gap-4 rounded-full px-6 py-4 shadow-2xl">
          <button
            className="relative h-14 w-14 cursor-pointer overflow-hidden rounded-full transition-transform hover:scale-105"
            onClick={onExpand}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentSong.artwork} alt={currentSong.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity hover:opacity-100">
              <Maximize2 size={20} className="text-white" />
            </div>
          </button>

          <div className="flex items-center gap-4">
            <button onClick={onPrev} className="p-2 text-white/70 transition-transform hover:scale-110 hover:text-white">
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              onClick={onTogglePlay}
              className="h-12 w-12 rounded-full transition-all duration-1000 hover:scale-105"
              style={{ background: `linear-gradient(135deg, var(--art-accent, #a855f7), color-mix(in srgb, var(--art-accent, #a855f7) 87%, black))`, boxShadow: `0 10px 20px -10px var(--art-accent, #a855f7)` }}
            >
              {isPlaying ? (
                <Pause size={20} fill="white" className="mx-auto text-white" />
              ) : (
                <Play size={20} fill="white" className="mx-auto ml-[15px] text-white" />
              )}
            </button>
            <button onClick={onNext} className="p-2 text-white/70 transition-transform hover:scale-110 hover:text-white">
              <SkipForward size={20} fill="currentColor" />
            </button>
            {isLoggedIn && (
              <button
                onClick={() => onRateSong(currentSong.id, isLiked ? "none" : "like")}
                className="p-2 transition-all hover:scale-125 active:scale-95"
                title={isLiked ? "Unlike" : "Like"}
              >
                <Heart
                  size={20}
                  className="transition-all duration-300"
                  fill={isLiked ? "#FA243C" : "none"}
                  stroke={isLiked ? "#FA243C" : "currentColor"}
                  style={{ color: isLiked ? "#FA243C" : "rgba(255,255,255,0.7)" }}
                />
              </button>
            )}
          </div>

          <div className="min-w-[200px]">
            <p className="text-sm font-semibold text-white">{currentSong.title}</p>
            <p className="text-xs text-white/50">{currentSong.artist}</p>
            <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%`, background: `linear-gradient(to right, color-mix(in srgb, var(--art-accent, #a855f7) 50%, transparent), var(--art-accent, #a855f7))` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

    </div>
  );
}
