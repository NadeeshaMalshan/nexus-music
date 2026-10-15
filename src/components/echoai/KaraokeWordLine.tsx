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

/**
 * Estimates word-level timing for line-synced lyrics based on character count.
 * This guarantees that even when line-synced lyrics wrap across multiple visual lines,
 * Line 2 stays dim until Line 1 has finished filling.
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
    accumulatedChars += 1; // account for space between words

    return {
      text: wordStr,
      start: lineStart + startRatio * lineDuration,
      end: lineStart + endRatio * lineDuration,
    };
  });
}

interface KaraokeWordItemProps {
  word: LyricsWord;
  nextWord?: LyricsWord;
  isPastLine: boolean;
  isUpcomingLine: boolean;
  isActive: boolean;
  currentTimeSec: number;
  weightClass: string;
}

const KaraokeWordItem = React.memo(function KaraokeWordItem({
  word,
  nextWord,
  isPastLine,
  isUpcomingLine,
  isActive,
  currentTimeSec,
  weightClass,
}: KaraokeWordItemProps) {
  const wText = (word.text || "").trim();
  if (!wText) return null;

  const wStart = word.start;
  const wEnd = word.end !== undefined && word.end > wStart
    ? word.end
    : nextWord && nextWord.start > wStart
    ? nextWord.start
    : wStart + 0.45;
  const wDuration = Math.max(0.04, wEnd - wStart);

  let wordFillPercent = 0;
  let isWordFilling = false;

  if (isPastLine) {
    wordFillPercent = 100;
  } else if (isUpcomingLine) {
    wordFillPercent = 0;
  } else if (isActive) {
    if (currentTimeSec >= wEnd) {
      wordFillPercent = 100;
    } else if (currentTimeSec < wStart) {
      wordFillPercent = 0;
    } else {
      isWordFilling = true;
      const progress = (currentTimeSec - wStart) / wDuration;
      wordFillPercent = Math.max(0, Math.min(100, progress * 100));
    }
  }

  return (
    <span className="relative inline-block whitespace-nowrap mr-[0.24em] last:mr-0 align-baseline select-none">
      {/* Base unplayed word (dimmed white) */}
      <span className={`transition-colors duration-200 ${weightClass} ${
        isActive ? "text-white/35" : "text-white/40"
      }`}>
        {wText}
      </span>

      {/* Active filled word (pure bright white with glow), smoothly wiped left-to-right */}
      {wordFillPercent > 0 && (
        <span
          className="absolute top-0 left-0 w-full h-full pointer-events-none select-none overflow-hidden"
          style={{
            clipPath: `inset(0 ${Math.max(0, 100 - wordFillPercent)}% 0 0)`,
            WebkitClipPath: `inset(0 ${Math.max(0, 100 - wordFillPercent)}% 0 0)`,
            transition: isWordFilling
              ? "clip-path 0.08s linear, -webkit-clip-path 0.08s linear"
              : wordFillPercent === 100
              ? "clip-path 0.15s ease-out, -webkit-clip-path 0.15s ease-out"
              : "none",
            willChange: "clip-path",
          }}
          aria-hidden="true"
        >
          <span className={`text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.45)] whitespace-nowrap ${weightClass}`}>
            {wText}
          </span>
        </span>
      )}
    </span>
  );
});
KaraokeWordItem.displayName = "KaraokeWordItem";

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

  const mainWeight = sizeVariant === "mobile" ? "font-black" : "font-extrabold";
  const bracketWeight = "font-bold";

  // 1. WORD-SYNC LYRICS: Render word-by-word with bracket ad-libs on a new line
  if (hasWordSync && segments.length > 0) {
    return (
      <div className="w-full flex flex-col items-start select-none">
        {segments.map((segment, segIdx) => {
          const segClasses = segment.isBracketed ? getBracketClasses() : getMainClasses();
          const segWeight = segment.isBracketed ? bracketWeight : mainWeight;
          const segWords = segment.words;

          return (
            <p
              key={segIdx}
              className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses}`}
            >
              {segWords.map((w, wIdx) => (
                <KaraokeWordItem
                  key={wIdx}
                  word={w}
                  nextWord={segWords[wIdx + 1]}
                  isPastLine={isPastLine}
                  isUpcomingLine={isUpcomingLine}
                  isActive={isActive}
                  currentTimeSec={currentTimeSec}
                  weightClass={segWeight}
                />
              ))}
            </p>
          );
        })}
      </div>
    );
  }

  // 2. LINE-SYNC LYRICS: Estimate word timings so wrapped lines fill sequentially word-by-word
  const text = (lineText || syncedLine?.text || "").trim();
  if (!text) {
    return <div className="w-full h-4" />;
  }

  const lineStart = syncedLine?.start ?? 0;
  const lineEnd = syncedLine?.end ?? (lineStart + 4.0);
  const estimatedWords = estimateWordsForLine(text, lineStart, lineEnd);
  const segClasses = getMainClasses();

  return (
    <p className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses}`}>
      {estimatedWords.map((w, wIdx) => (
        <KaraokeWordItem
          key={wIdx}
          word={w}
          nextWord={estimatedWords[wIdx + 1]}
          isPastLine={isPastLine}
          isUpcomingLine={isUpcomingLine}
          isActive={isActive}
          currentTimeSec={currentTimeSec}
          weightClass={mainWeight}
        />
      ))}
    </p>
  );
});

KaraokeWordLine.displayName = "KaraokeWordLine";
