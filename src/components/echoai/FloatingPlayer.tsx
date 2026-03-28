import { Play, Pause, SkipBack, SkipForward, Search, Maximize2 } from "lucide-react";
import { type Song } from "./types";
import { motion } from "motion/react";
import { youtubeTimestampToSeconds } from "@/lib/duration";

interface FloatingPlayerProps {
  onExpand: () => void;
  onSearchClick: () => void;
  currentSong: Song;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTimeSec: number;
  durationSec: number;
}

export function FloatingPlayer({
  onExpand,
  onSearchClick,
  currentSong,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTimeSec,
  durationSec,
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
          style={{ background: `linear-gradient(to right, ${c}40, ${c}20, ${c}40)` }}
        />

        <div className="glass relative flex items-center gap-6 rounded-full px-6 py-4 shadow-2xl">
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
              style={{ background: `linear-gradient(135deg, ${c}, ${c}dd)`, boxShadow: `0 10px 20px -10px ${c}` }}
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
          </div>

          <div className="min-w-[200px]">
            <p className="text-sm font-semibold text-white">{currentSong.title}</p>
            <p className="text-xs text-white/50">{currentSong.artist}</p>
            <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out"
                style={{ width: `${progress}%`, background: `linear-gradient(to right, ${c}80, ${c})` }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <button
        onClick={onSearchClick}
        className="glass flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] transition-all hover:scale-105 hover:bg-black/60"
      >
        <Search size={20} className="text-white/70 transition-colors hover:text-white" />
      </button>
    </div>
  );
}
