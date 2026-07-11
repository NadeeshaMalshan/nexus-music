"use client";

import { useEffect, useRef } from "react";
import { Heart, X, Check } from "lucide-react";
import { m } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";

interface LiveLikeToastProps {
  title: string;
  artist: string;
  artwork?: string | null;
  onDismiss: () => void;
}

export function LiveLikeToast({ title, artist, artwork, onDismiss }: LiveLikeToastProps) {
  const onDismissRef = useRef(onDismiss);
  
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const t = setTimeout(() => {
      onDismissRef.current();
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  return (
    <m.div
      initial={{ opacity: 0, y: 40, scale: 0.9, rotate: -1 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
      transition={{ type: "spring", damping: 20, stiffness: 260 }}
      className="relative flex items-center gap-4 rounded-[22px] border border-white/[0.08] bg-black/60 backdrop-blur-3xl px-4.5 py-4 shadow-[0_32px_64px_rgba(0,0,0,0.8)] w-[360px] max-w-[90vw] overflow-hidden select-none pointer-events-auto"
    >
      {/* Glow effect inside */}
      <div className="absolute -top-12 -left-12 w-24 h-24 bg-(--art-accent,#FA243C)/15 rounded-full blur-2xl pointer-events-none" />

      {/* Artwork Section */}
      <div className="relative h-12 w-12 shrink-0 rounded-xl border border-white/10 shadow-lg">
        <MusicArtwork src={artwork} alt={title} iconSize={20} variant="track" rounded="md" className="h-full w-full object-cover" />
        {/* Glowing Heart badge in corner */}
        <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-(--art-accent,#FA243C) text-white shadow-md shadow-red-500/30 animate-pulse">
          <Heart size={10} fill="currentColor" strokeWidth={0} />
        </div>
      </div>

      {/* Text Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/40 mb-1">
          <span className="flex items-center justify-center h-3 w-3 rounded-full bg-emerald-500/20 text-emerald-400">
            <Check size={8} strokeWidth={3} />
          </span>
          <span>Saved to Library</span>
        </div>
        <p className="truncate text-[15px] font-extrabold text-white leading-tight tracking-tight">{title}</p>
        <p className="truncate text-xs font-bold text-white/50 mt-0.5">{artist}</p>
      </div>

      {/* Close Button */}
      <button
        onClick={onDismiss}
        className="rounded-full p-2 text-white/30 hover:bg-white/5 hover:text-white transition-all duration-300 active:scale-90 shrink-0"
      >
        <X size={16} strokeWidth={2.5} />
      </button>

      {/* Modern countdown progress bar */}
      <m.div
        initial={{ width: "100%" }}
        animate={{ width: "0%" }}
        transition={{ duration: 4, ease: "linear" }}
        className="absolute bottom-0 left-0 h-[3px] bg-linear-to-r from-(--art-accent,#FA243C) to-red-500 shadow-[0_0_8px_rgba(250,36,60,0.5)]"
      />
    </m.div>
  );
}
