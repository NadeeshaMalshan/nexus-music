"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { MusicArtwork } from "./MusicArtwork";

interface LiveLikeToastProps {
  title: string;
  artist: string;
  artwork?: string | null;
  onDismiss: () => void;
}

const DURATION_MS = 5000;

export function LiveLikeToast({ title, artist, artwork, onDismiss }: LiveLikeToastProps) {
  const [progress, setProgress] = useState(100);
  const startTimeRef = useRef<number>(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, 1 - elapsed / DURATION_MS);
      setProgress(remaining * 100);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        onDismiss();
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [onDismiss]);

  return (
    <m.div
      initial={{ opacity: 0, y: 32, scale: 0.92, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, y: 20, scale: 0.95, filter: "blur(4px)" }}
      transition={{ type: "spring", damping: 26, stiffness: 320, mass: 0.8 }}
      onClick={onDismiss}
      className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl cursor-pointer select-none"
      style={{
        background: "rgba(28, 28, 30, 0.75)",
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
        width: "clamp(280px, 90vw, 340px)",
        paddingTop: "14px",
        paddingBottom: "14px",
        paddingLeft: "14px",
        paddingRight: "16px",
      }}
    >
      {/* Artwork with heart overlay */}
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
        <MusicArtwork src={artwork} alt={title} iconSize={18} variant="track" rounded="md" className="h-full w-full" />
        {/* Soft dark scrim */}
        <div className="absolute inset-0 bg-black/30 rounded-xl" />
        {/* Pulsing heart */}
        <m.div
          className="absolute inset-0 flex items-center justify-center"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: [0, 1.3, 1], opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
        >
          <Heart
            size={15}
            fill="var(--art-accent, #FA243C)"
            color="var(--art-accent, #FA243C)"
            style={{ filter: "drop-shadow(0 0 6px var(--art-accent, #FA243C))" }}
          />
        </m.div>
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35 mb-0.5 flex items-center gap-1.5">
          {/* Accent dot */}
          <m.span
            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "var(--art-accent, #FA243C)" }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          Saved to Liked Songs
        </p>
        <p className="truncate text-[14px] font-black text-white leading-snug tracking-tight">{title}</p>
        <p className="truncate text-[11px] font-semibold text-white/45 mt-0.5 leading-snug">{artist}</p>
      </div>

      {/* Progress bar at the bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <m.div
          className="h-full rounded-b-2xl"
          style={{
            width: `${progress}%`,
            background: "var(--art-accent, #FA243C)",
            boxShadow: "0 0 6px 1px var(--art-accent, #FA243C)",
            opacity: 0.7,
          }}
        />
      </div>
    </m.div>
  );
}
