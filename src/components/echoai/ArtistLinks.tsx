"use client";

import React from "react";

/**
 * Splits an artist string like "Charlie Puth, Selena Gomez" or
 * "The Weeknd & Ariana Grande" into individually clickable names.
 *
 * Delimiters preserved between names: ", ", " & ", " feat. ", " ft. ", " x ", " X "
 */

const SPLIT_RE = /(\s*,\s*|\s+&\s+|\s+feat\.\s+|\s+ft\.\s+|\s+[xX]\s+)/i;

interface ArtistLinksProps {
  artist: string;
  onArtistClick?: (name: string) => void;
  className?: string;
  separatorClassName?: string;
}

export function ArtistLinks({
  artist,
  onArtistClick,
  className = "",
  separatorClassName,
}: ArtistLinksProps) {
  const parts = artist.split(SPLIT_RE);
  const sepClass = separatorClassName ?? className;

  return (
    <span className="inline">
      {parts.map((part, i) => {
        // Even indices are artist names, odd indices are delimiters
        if (i % 2 === 1) {
          return (
            <span key={i} className={sepClass}>
              {part}
            </span>
          );
        }
        const trimmed = part.trim();
        if (!trimmed) return null;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onArtistClick?.(trimmed);
            }}
            className={`${className} hover:text-white active:text-white transition-colors`}
          >
            {trimmed}
          </button>
        );
      })}
    </span>
  );
}
