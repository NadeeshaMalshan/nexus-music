"use client";

import React, { useMemo } from "react";
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

/**
 * Estimates word-level timing for line-synced lyrics based on character count.
 */
export function estimateWordsForLine(text: string, lineStart: number, lineEnd: number): LyricsWord[] {
  if (!text || !text.trim()) return [];
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  const lineDuration = Math.max(0.4, lineEnd - lineStart);
  const totalChars = rawWords.reduce((acc, w) => acc + w.length, 0) + Math.max(0, rawWords.length - 1);
  let accumulatedChars = 0;

  return rawWords.map((wordStr) => {
    const startRatio = totalChars > 0 ? accumulatedChars / totalChars : 0;
    accumulatedChars += wordStr.length;
    const endRatio = totalChars > 0 ? accumulatedChars / totalChars : 1;
    accumulatedChars += 1;

    return {
      text: wordStr,
      start: lineStart + startRatio * lineDuration,
      end: lineStart + endRatio * lineDuration,
    };
  });
}

export interface KaraokeWordLineProps {
  words?: LyricsWord[];
  lineText?: string;
  syncedLine?: LyricsLine | null;
  nextLine?: LyricsLine | null;
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
  nextLine,
  currentTimeSec,
  isActive,
  isPastLine,
  isUpcomingLine,
  sizeVariant,
}: KaraokeWordLineProps) {
  const text = (lineText || syncedLine?.text || "").trim();
  if (!text) {
    return <div className="w-full h-4" />;
  }

  const lineStart = syncedLine?.start ?? 0;
  const lineEnd = nextLine?.start && nextLine.start > lineStart
    ? nextLine.start
    : (syncedLine?.end && syncedLine.end > lineStart ? syncedLine.end : lineStart + 4.5);
  const lineDuration = Math.max(0.4, lineEnd - lineStart);

  // Smooth line progression from 0% to 100% across the line duration
  let lineProgress = 0;
  if (isPastLine) {
    lineProgress = 100;
  } else if (isUpcomingLine) {
    lineProgress = 0;
  } else if (isActive) {
    const progressRatio = (currentTimeSec - lineStart) / lineDuration;
    lineProgress = Math.max(0, Math.min(100, progressRatio * 100));
  }

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

  const mainWeight = sizeVariant === "mobile" ? "font-black" : "font-extrabold";
  const bracketWeight = "font-bold";

  // Build clean sequential words with strict monotonic line boundaries
  const wordsWithProgression = useMemo(() => {
    const rawWords = text.split(/\s+/).filter(Boolean);
    if (rawWords.length === 0) return [];

    const totalChars = rawWords.reduce((sum, w) => sum + w.length, 0) + Math.max(0, rawWords.length - 1);
    let currentChars = 0;
    let inBracket = false;

    return rawWords.map((word) => {
      const startRatio = totalChars > 0 ? currentChars / totalChars : 0;
      currentChars += word.length;
      const endRatio = totalChars > 0 ? currentChars / totalChars : 1;
      currentChars += 1; // space between words

      const startPct = startRatio * 100;
      const endPct = endRatio * 100;

      if (/^[(\[]/.test(word)) inBracket = true;
      const isBracketed = inBracket || /[)\]]/.test(word);
      if (/[)\]]/.test(word)) inBracket = false;

      return {
        text: word,
        startPct,
        endPct,
        isBracketed,
      };
    });
  }, [text]);

  const segClasses = getMainClasses();

  return (
    <p className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses}`}>
      {wordsWithProgression.map((w, idx) => {
        let wordFill = 0;
        if (isPastLine || lineProgress >= w.endPct) {
          wordFill = 100;
        } else if (isUpcomingLine || lineProgress <= w.startPct) {
          wordFill = 0;
        } else {
          const span = Math.max(0.01, w.endPct - w.startPct);
          wordFill = Math.max(0, Math.min(100, ((lineProgress - w.startPct) / span) * 100));
        }

        const currentWeight = w.isBracketed ? bracketWeight : mainWeight;

        return (
          <span
            key={idx}
            className="relative inline-block whitespace-nowrap mr-[0.24em] last:mr-0 align-baseline select-none"
          >
            {/* Base dimmed word */}
            <span className={`transition-colors duration-200 ${currentWeight} ${
              isActive ? "text-white/35" : "text-white/40"
            }`}>
              {w.text}
            </span>

            {/* Active filled word - pure crisp white with NO drop shadow and NO background overlay */}
            {wordFill > 0 && (
              <span
                className="absolute top-0 left-0 w-full h-full pointer-events-none select-none overflow-hidden"
                style={{
                  clipPath: `inset(0 ${Math.max(0, 100 - wordFill).toFixed(2)}% 0 0)`,
                  WebkitClipPath: `inset(0 ${Math.max(0, 100 - wordFill).toFixed(2)}% 0 0)`,
                  transition: isActive && wordFill > 0 && wordFill < 100
                    ? "clip-path 0.08s linear, -webkit-clip-path 0.08s linear"
                    : "none",
                }}
                aria-hidden="true"
              >
                <span className={`text-white whitespace-nowrap ${currentWeight}`}>
                  {w.text}
                </span>
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
});

KaraokeWordLine.displayName = "KaraokeWordLine";
