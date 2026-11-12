"use client";

import React from "react";

/**
 * Splits an artist string like "Charlie Puth, Selena Gomez" or
 * "The Weeknd & Ariana Grande" into individually clickable names.
 *
 * Delimiters preserved between names: ", ", " & ", " feat. ", " ft. ", " x ", " X "
 */

const SPLIT_RE = /(\s*,\s*|\s+&\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+with\s+|\s+\/\s+|\s+[xX]\s+|\s+vs\.?\s+)/i;

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
  // Normalize parentheticals like "Artist A (feat. Artist B)" into "Artist A feat. Artist B"
  const normalized = (artist || "")
    .replace(/\s*\(\s*(?:feat\.?|ft\.?|with|featuring)\s+/gi, " feat. ")
    .replace(/\s*\)/g, "");

  const parts = normalized.split(SPLIT_RE);
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
        const trimmed = part
          .replace(/^[([{'"]+/, "")
          .replace(/[)\]}'",]+$/, "")
          .trim();
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
