"use client";

import React from "react";
import { LyricsWord, LyricsLine } from "@/lib/lyrics/types";

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
  words?: LyricsWord[];
  lineText?: string;
  syncedLine?: LyricsLine | null;
  currentTimeSec: number;
  isActive: boolean;
  isPastLine: boolean;
  isUpcomingLine: boolean;
  sizeVariant: "desktop" | "mobile" | "sidebar";
}

export const KaraokeWordLine = React.memo(function KaraokeWordLine({
  words,
  lineText = "",
  syncedLine,
  currentTimeSec,
  isActive,
  isPastLine,
  isUpcomingLine,
  sizeVariant,
}: KaraokeWordLineProps) {
  const hasWordSync = Boolean(words && words.length > 0);
  const segments = React.useMemo(() => (hasWordSync && words ? groupWordsByBracket(words) : []), [hasWordSync, words]);

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

  // 1. WORD-SYNC LYRICS: Left-to-right smooth fill across the line/segment
  if (hasWordSync && segments.length > 0) {
    return (
      <div className="w-full flex flex-col items-start select-none">
        {segments.map((segment, segIdx) => {
          const segClasses = segment.isBracketed ? getBracketClasses() : getMainClasses();
          const segWords = segment.words;
          const segmentText = segWords.map((w) => w.text).join(" ");
          const segStart = segWords[0]?.start ?? 0;
          const segEnd = segWords[segWords.length - 1]?.end ?? (segStart + 3.0);

          let segFillPercent = 0;
          let isFilling = false;

          if (isPastLine) {
            segFillPercent = 100;
          } else if (isUpcomingLine) {
            segFillPercent = 0;
          } else if (isActive) {
            if (currentTimeSec >= segEnd) {
              segFillPercent = 100;
            } else if (currentTimeSec < segStart) {
              segFillPercent = 0;
            } else {
              isFilling = true;
              // Character-weighted vocal sweep across the line
              let charOffset = 0;
              const totalChars = Math.max(1, segmentText.length);

              for (let i = 0; i < segWords.length; i++) {
                const w = segWords[i];
                const wStart = w.start;
                const wEnd = w.end !== undefined && w.end > wStart ? w.end : wStart + 0.45;
                const wLen = w.text.length;

                if (currentTimeSec >= wEnd) {
                  charOffset += wLen + 1; // word + space
                } else if (currentTimeSec >= wStart && currentTimeSec < wEnd) {
                  const wProg = (currentTimeSec - wStart) / Math.max(0.04, wEnd - wStart);
                  charOffset += wLen * Math.min(1, Math.max(0, wProg));
                  break;
                } else {
                  break;
                }
              }

              segFillPercent = Math.max(0, Math.min(100, (charOffset / totalChars) * 100));
            }
          }

          return (
            <div
              key={segIdx}
              className={`w-full origin-left whitespace-pre-wrap break-words text-balance transform-gpu ${segClasses}`}
            >
              <div className="relative inline-block text-left origin-left">
                {/* Layer 1: Base unplayed line (dimmed white) */}
                <p className={`select-none ${isActive ? "text-white/35" : "text-white/40"}`}>
                  {segmentText}
                </p>

                {/* Layer 2: Filled active line (pure bright white), smoothly wiped from left to right */}
                <div
                  className="absolute top-0 left-0 w-full h-full pointer-events-none select-none overflow-hidden"
                  style={{
                    clipPath: `inset(0 ${Math.max(0, 100 - segFillPercent)}% 0 0)`,
                    WebkitClipPath: `inset(0 ${Math.max(0, 100 - segFillPercent)}% 0 0)`,
                    transition: isFilling
                      ? "clip-path 0.12s linear, -webkit-clip-path 0.12s linear"
                      : segFillPercent === 100 || segFillPercent === 0
                      ? "clip-path 0.2s ease-out, -webkit-clip-path 0.2s ease-out"
                      : "none",
                    willChange: "clip-path",
                  }}
                  aria-hidden="true"
                >
                  <p className="text-white font-black drop-shadow-[0_0_16px_rgba(255,255,255,0.45)] whitespace-pre-wrap">
                    {segmentText}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // 2. LINE-SYNC LYRICS: Left-to-right smooth fill across the entire line
  const text = lineText || syncedLine?.text || "";
  const lineStart = syncedLine?.start ?? 0;
  const lineEnd = syncedLine?.end ?? (lineStart + 4.0);
  const lineDuration = Math.max(0.3, lineEnd - lineStart);

  let fillPercent = 0;
  let isFilling = false;

  if (isPastLine) {
    fillPercent = 100;
  } else if (isUpcomingLine) {
    fillPercent = 0;
  } else if (isActive) {
    if (currentTimeSec >= lineEnd) {
      fillPercent = 100;
    } else if (currentTimeSec < lineStart) {
      fillPercent = 0;
    } else {
      isFilling = true;
      fillPercent = Math.max(0, Math.min(100, ((currentTimeSec - lineStart) / lineDuration) * 100));
    }
  }

  return (
    <div className={`w-full origin-left whitespace-pre-wrap break-words text-balance transform-gpu ${getMainClasses()}`}>
      <div className="relative inline-block text-left origin-left">
        {/* Layer 1: Base unplayed line (dimmed white) */}
        <p className={`select-none ${isActive ? "text-white/35" : "text-white/40"}`}>
          {text}
        </p>

        {/* Layer 2: Filled active line (pure bright white), smoothly wiped from left to right */}
        <div
          className="absolute top-0 left-0 w-full h-full pointer-events-none select-none overflow-hidden"
          style={{
            clipPath: `inset(0 ${Math.max(0, 100 - fillPercent)}% 0 0)`,
            WebkitClipPath: `inset(0 ${Math.max(0, 100 - fillPercent)}% 0 0)`,
            transition: isFilling
              ? "clip-path 0.12s linear, -webkit-clip-path 0.12s linear"
              : fillPercent === 100 || fillPercent === 0
              ? "clip-path 0.2s ease-out, -webkit-clip-path 0.2s ease-out"
              : "none",
            willChange: "clip-path",
          }}
          aria-hidden="true"
        >
          <p className="text-white font-black drop-shadow-[0_0_16px_rgba(255,255,255,0.45)] whitespace-pre-wrap">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
});

KaraokeWordLine.displayName = "KaraokeWordLine";
