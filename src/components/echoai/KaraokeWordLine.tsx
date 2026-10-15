"use client";

import React from "react";
import { LyricsWord } from "@/lib/lyrics/types";

export interface WordSegment {
  isBracketed: boolean;
  words: LyricsWord[];
}

/**
 * Groups words into unbracketed and bracketed segments.
 * Bracketed words (e.g. ad-libs, backing vocals) will be rendered on a new line with a smaller font size.
 */
export function groupWordsByBracket(words: LyricsWord[]): WordSegment[] {
  if (!words || words.length === 0) return [];
  const segments: WordSegment[] = [];
  let currentSegment: WordSegment | null = null;
  let inBracket = false;

  for (const w of words) {
    const rawText = w.text || "";
    const trimmed = rawText.trim();
    const startsBracket = /^[(\[]/.test(trimmed);
    const endsBracket = /[)\]][.,!?;:]*$/.test(trimmed);

    if (!inBracket && startsBracket) {
      inBracket = true;
      if (currentSegment && currentSegment.words.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = { isBracketed: true, words: [w] };
      if (endsBracket) {
        inBracket = false;
      }
    } else if (inBracket) {
      if (!currentSegment) {
        currentSegment = { isBracketed: true, words: [w] };
      } else {
        currentSegment.words.push(w);
      }
      if (endsBracket) {
        inBracket = false;
      }
    } else {
      if (!currentSegment || currentSegment.isBracketed) {
        if (currentSegment && currentSegment.words.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = { isBracketed: false, words: [w] };
      } else {
        currentSegment.words.push(w);
      }
    }
  }

  if (currentSegment && currentSegment.words.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

interface KaraokeWordLineProps {
  words: LyricsWord[];
  currentTimeSec: number;
  isActive: boolean;
  isPastLine: boolean;
  isUpcomingLine: boolean;
  sizeVariant: "desktop" | "mobile" | "sidebar";
}

export const KaraokeWordLine = React.memo(function KaraokeWordLine({
  words,
  currentTimeSec,
  isActive,
  isPastLine,
  isUpcomingLine,
  sizeVariant,
}: KaraokeWordLineProps) {
  const segments = React.useMemo(() => groupWordsByBracket(words), [words]);

  const getMainClasses = () => {
    switch (sizeVariant) {
      case "desktop":
        return "text-[44px] leading-[1.18] font-extrabold tracking-tight";
      case "mobile":
        return "text-[38px] leading-[1.15] font-black tracking-tight";
      case "sidebar":
      default:
        return "text-[24px] leading-[1.25] font-extrabold tracking-tight";
    }
  };

  const getBracketClasses = () => {
    switch (sizeVariant) {
      case "desktop":
        return "text-[28px] md:text-[30px] leading-[1.22] font-bold tracking-tight text-white/80 mt-1";
      case "mobile":
        return "text-[24px] leading-[1.2] font-bold tracking-tight text-white/80 mt-1";
      case "sidebar":
      default:
        return "text-[17px] leading-[1.2] font-bold tracking-tight text-white/80 mt-0.5";
    }
  };

  return (
    <div className="w-full flex flex-col items-start select-none">
      {segments.map((segment, segIdx) => {
        const segClasses = segment.isBracketed ? getBracketClasses() : getMainClasses();

        return (
          <div
            key={segIdx}
            className={`w-full origin-left whitespace-pre-wrap break-words text-balance transform-gpu ${segClasses}`}
          >
            {segment.words.map((w, wIndex) => {
              const start = w.start;
              const end = w.end !== undefined && w.end > start ? w.end : start + 0.45;
              const dur = Math.max(0.06, end - start);

              let fillPercent = 0;
              let isCurrentlyFilling = false;

              if (isPastLine) {
                fillPercent = 100;
              } else if (isUpcomingLine) {
                fillPercent = 0;
              } else if (isActive) {
                if (currentTimeSec >= end) {
                  fillPercent = 100;
                } else if (currentTimeSec < start) {
                  fillPercent = 0;
                } else {
                  isCurrentlyFilling = true;
                  fillPercent = Math.max(0, Math.min(100, ((currentTimeSec - start) / dur) * 100));
                }
              }

              return (
                <span
                  key={wIndex}
                  className="relative inline-block mr-[0.28em] select-none align-baseline transform-gpu"
                >
                  {/* Layer 1: Base unplayed text (dimmed white) */}
                  <span className={isActive ? "text-white/35" : "text-white/40"}>
                    {w.text}
                  </span>

                  {/* Layer 2: Filled active text (bright white) smoothly sweeping left-to-right */}
                  <span
                    className="absolute top-0 left-0 h-full overflow-hidden whitespace-nowrap text-white font-extrabold pointer-events-none drop-shadow-[0_0_14px_rgba(255,255,255,0.45)]"
                    style={{
                      width: `${fillPercent}%`,
                      transition: isCurrentlyFilling
                        ? "width 0.12s linear"
                        : fillPercent === 100 || fillPercent === 0
                        ? "width 0.18s ease-out"
                        : "none",
                      willChange: "width",
                    }}
                    aria-hidden="true"
                  >
                    {w.text}
                  </span>
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
});

KaraokeWordLine.displayName = "KaraokeWordLine";
