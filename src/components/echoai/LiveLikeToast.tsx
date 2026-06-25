"use client";

import { useEffect, useState } from "react";
import { Heart, CheckCircle2 } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";

interface LiveLikeToastProps {
  title: string;
  artist: string;
  artwork?: string | null;
  onDismiss: () => void;
}

export function LiveLikeToast({ title, artist, artwork, onDismiss }: LiveLikeToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <m.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{ type: "spring", damping: 22, stiffness: 300 }}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1c1c1e] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)] max-w-[320px]"
    >
      {/* Artwork */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10">
        <MusicArtwork src={artwork} alt={title} iconSize={18} variant="track" rounded="md" className="h-full w-full" />
        {/* Heart overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <Heart size={14} fill="var(--art-accent, #FA243C)" color="var(--art-accent, #FA243C)" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1">
          <CheckCircle2 size={10} className="text-green-400" />
          Saved to Liked Songs
        </p>
        <p className="truncate text-[13px] font-black text-white leading-tight">{title}</p>
        <p className="truncate text-[11px] text-white/50">{artist}</p>
      </div>
    </m.div>
  );
}
