import React from "react";

export interface ExplicitBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}

/**
 * Checks whether a track/song entity is marked as explicit via explicit flag,
 * API badge indicators, or standard explicit keywords in the title.
 */
export function isSongExplicit(
  song?: {
    title?: string;
    name?: string;
    isExplicit?: boolean;
    explicit?: boolean;
    badges?: unknown[];
  } | null
): boolean {
  if (!song) return false;
  if (song.isExplicit === true || song.explicit === true) return true;

  const rawTitle = song.title || song.name || "";
  if (/\b(explicit|dirty|advisory)\b/i.test(rawTitle)) return true;

  if (Array.isArray(song.badges)) {
    const hasBadge = song.badges.some((b: any) => {
      if (!b) return false;
      if (typeof b === "string" && /explicit/i.test(b)) return true;
      if (b.iconType === "MUSIC_EXPLICIT_BADGE") return true;
      if (b.metadataBadgeRenderer?.icon?.iconType === "MUSIC_EXPLICIT_BADGE") return true;
      if (b.metadataBadgeRenderer?.style === "BADGE_STYLE_TYPE_EXPLICIT") return true;
      return false;
    });
    if (hasBadge) return true;
  }

  return false;
}

/**
 * Apple Music authentic [E] badge for explicit tracks and albums.
 * Sleek, high-contrast, rounded translucent rectangle with clean uppercase 'E'.
 */
export function ExplicitBadge({ className = "", size = "sm" }: ExplicitBadgeProps) {
  const sizeClasses =
    size === "lg"
      ? "w-4 h-4 text-[10px] rounded-[3.5px]"
      : size === "md"
      ? "w-3.5 h-3.5 text-[9px] rounded-[3px]"
      : size === "xs"
      ? "w-3 h-3 text-[8px] rounded-[2.5px]"
      : "w-3.5 h-3.5 text-[9px] rounded-[3px]";

  return (
    <span
      className={`inline-flex items-center justify-center font-bold font-mono bg-white/20 text-white/90 select-none shrink-0 leading-none tracking-tighter align-middle ${sizeClasses} ${className}`}
      title="Explicit"
      aria-label="Explicit"
    >
      E
    </span>
  );
}

