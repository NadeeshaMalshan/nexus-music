import { Pause, Play, SkipBack, SkipForward, Search, Volume2, Maximize2 } from "lucide-react";

type PlayerDockProps = {
  trackName: string;
  artist: string;
  coverArt: string;
  isLoading?: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  progressPercent: number;
  volume: number;
  onVolumeChange: (value: number) => void;
  onSeek: (value: number) => void;
};

export function PlayerDock({
  trackName,
  artist,
  coverArt,
  isLoading = false,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  progressPercent,
  volume,
  onVolumeChange,
  onSeek,
}: PlayerDockProps) {
  return (
    <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4">
      <div className="group relative">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500/30 via-pink-500/20 to-purple-500/30 blur-2xl transition-all duration-1000 group-hover:opacity-100" />
        <div className="glass relative flex items-center gap-5 rounded-full px-6 py-4 shadow-2xl">
          <button
            type="button"
            className="relative h-14 w-14 overflow-hidden rounded-full transition-transform hover:scale-105"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverArt} alt={`${trackName} cover`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity hover:opacity-100">
              <Maximize2 size={18} className="text-white" />
            </div>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onPrev}
              className="p-2 text-white/70 transition-transform hover:scale-110 hover:text-white"
            >
              <SkipBack size={20} fill="currentColor" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              className="neon-pulse h-12 w-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white shadow-[0_10px_20px_-10px_rgba(217,70,239,0.8)]"
            >
              {isPlaying ? (
                <Pause size={20} fill="white" className="mx-auto text-white" />
              ) : (
                <Play size={20} fill="white" className="mx-auto ml-[15px] text-white" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="p-2 text-white/70 transition-transform hover:scale-110 hover:text-white"
            >
              <SkipForward size={20} fill="currentColor" />
            </button>
          </div>

          <div className="min-w-[200px]">
            <p className="truncate text-sm font-semibold text-white">{isLoading ? "Loading track..." : trackName}</p>
            <p className="truncate text-xs text-white/50">{artist}</p>
            <input
              type="range"
              min={0}
              max={100}
              value={progressPercent}
              onChange={(event) => onSeek(Number(event.target.value))}
              className="mt-2 h-1 w-full cursor-pointer accent-pink-500"
              aria-label="Seek progress"
            />
          </div>

          <div className="hidden items-center gap-2 text-xs text-white/40 md:flex">
            <Volume2 size={16} />
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              className="h-1.5 w-20 cursor-pointer accent-pink-500"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
      <button
        type="button"
        className="glass flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] text-white/70 transition-all hover:scale-105 hover:bg-black/60 hover:text-white"
        aria-label="Search and identify music"
      >
        <Search size={20} />
      </button>
    </div>
  );
}
