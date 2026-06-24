"use client";

import { Music, UserRound } from "lucide-react";
import { useState } from "react";

export type MusicArtworkVariant = "track" | "artist";

interface MusicArtworkProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconSize?: number;
  /** track: note only; artist: user silhouette + note (for avatars) */
  variant?: MusicArtworkVariant;
  /** Applied to both the loaded image and the placeholder panel */
  rounded?: "none" | "md" | "xl" | "2xl" | "3xl" | "full";
  priority?: boolean;
}

const ROUNDED: Record<NonNullable<MusicArtworkProps["rounded"]>, string> = {
  none: "",
  md: "rounded-md",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
  full: "rounded-full",
};

function normalizeSrc(src?: string | null): string | null {
  if (src == null) return null;
  const t = String(src).trim();
  return t.length ? t : null;
}

export function MusicArtwork({
  src,
  alt = "",
  className = "",
  iconSize = 24,
  variant = "track",
  rounded = "none",
  priority = false,
}: MusicArtworkProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);
  const r = ROUNDED[rounded];

  if (src !== prevSrc) {
    setPrevSrc(src);
    setHasError(false);
  }

  const effectiveSrc = normalizeSrc(src);

  if (effectiveSrc && !hasError) {
    return (
      <img
        src={effectiveSrc}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        onError={() => setHasError(true)}
        className={`h-full w-full object-cover transition-transform duration-500 animate-gpu ${r} ${className}`.trim()}
      />
    );
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-linear-to-br from-[#3D2918] via-[#1E1335] to-[#2A1B4D] ${r} ring-1 ring-white/10 ${className}`.trim()}
      role="img"
      aria-label={alt ? `${alt} (placeholder)` : "Music artwork placeholder"}
    >
      <div className="pointer-events-none absolute inset-0 z-10 bg-linear-to-tr from-white/10 to-transparent opacity-35" />
      {variant === "artist" ? (
        <div className="relative z-20 flex flex-col items-center justify-center">
          <UserRound size={Math.max(22, Math.round(iconSize * 1.12))} className="text-white/40" strokeWidth={1.75} />
        </div>
      ) : (
        <div className="relative z-20 flex items-center justify-center drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          <Music size={iconSize} className="text-white/38" strokeWidth={2.5} />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-white/15" />
    </div>
  );
}
