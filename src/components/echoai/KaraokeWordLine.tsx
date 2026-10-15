"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { LyricsWord, LyricsLine } from "@/lib/lyrics/types";
import { getContinuousPlaybackTime, PlaybackSyncMeta } from "@/lib/lyrics/synchronizer/playbackClock";

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

export interface SyllableProgress {
  text: string;
  start: number;
  end: number;
  charLen: number;
}

export interface RenderWord {
  globalIndex: number;
  text: string;
  start: number;
  end: number;
  isBracketed: boolean;
  syllables?: SyllableProgress[];
}

function cleanNorm(str: string): string {
  return str.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * Normalizes words with genuine provider timestamps:
 * 1. Merges syllables into full target words matching lineText.
 * 2. Enforces strictly monotonic non-overlapping timings so transitions have no visible flicker, gaps, or sudden jumps.
 */
function processLineWords(
  lineText: string,
  rawWords: LyricsWord[] | undefined,
  lineStart: number,
  lineEnd: number
): RenderWord[] {
  const text = (lineText || "").trim();
  if (!text) return [];

  const targetTokens = text.split(/\s+/).filter(Boolean);
  if (targetTokens.length === 0) return [];

  let resultWords: RenderWord[] = [];

  if (rawWords && rawWords.length > 0) {
    let rawIdx = 0;
    let inBracket = false;

    for (let tIdx = 0; tIdx < targetTokens.length; tIdx++) {
      const targetToken = targetTokens[tIdx];
      const targetClean = cleanNorm(targetToken);

      if (/^[(\[]/.test(targetToken)) inBracket = true;
      const isBracketed = inBracket || /[)\]]/.test(targetToken);
      if (/[)\]]/.test(targetToken)) inBracket = false;

      const matchedSyllables: SyllableProgress[] = [];
      let accumulatedClean = "";

      while (rawIdx < rawWords.length) {
        const rw = rawWords[rawIdx];
        const rwClean = cleanNorm(rw.text);
        if (!rwClean && rw.text.trim()) {
          rawIdx++;
          continue;
        }

        matchedSyllables.push({
          text: rw.text,
          start: rw.start,
          end: rw.end,
          charLen: rw.text.length,
        });
        accumulatedClean += rwClean;
        rawIdx++;

        if (accumulatedClean.length >= targetClean.length || accumulatedClean === targetClean) {
          break;
        }
      }

      if (matchedSyllables.length > 0) {
        const wStart = matchedSyllables[0].start;
        const wEnd = matchedSyllables[matchedSyllables.length - 1].end;
        resultWords.push({
          globalIndex: tIdx,
          text: targetToken,
          start: wStart,
          end: Math.max(wStart + 0.05, wEnd),
          isBracketed,
          syllables: matchedSyllables.length > 1 ? matchedSyllables : undefined,
        });
      } else {
        resultWords.push({
          globalIndex: tIdx,
          text: targetToken,
          start: lineStart,
          end: lineEnd,
          isBracketed,
        });
      }
    }
  }

  // Fallback to character-proportional estimation if no raw words or mapping empty
  if (resultWords.length === 0) {
    const lineDur = Math.max(0.4, lineEnd - lineStart);
    const totalChars = targetTokens.reduce((s, w) => s + w.length, 0) + Math.max(0, targetTokens.length - 1);
    let curChars = 0;
    let inBracket = false;

    resultWords = targetTokens.map((w, idx) => {
      const sRatio = totalChars > 0 ? curChars / totalChars : 0;
      curChars += w.length;
      const eRatio = totalChars > 0 ? curChars / totalChars : 1;
      curChars += 1;

      if (/^[(\[]/.test(w)) inBracket = true;
      const isBracketed = inBracket || /[)\]]/.test(w);
      if (/[)\]]/.test(w)) inBracket = false;

      return {
        globalIndex: idx,
        text: w,
        start: lineStart + sRatio * lineDur,
        end: lineStart + eRatio * lineDur,
        isBracketed,
      };
    });
  }

  // Enforce STRICT monotonic non-overlapping timings
  for (let i = 0; i < resultWords.length; i++) {
    if (i > 0) {
      if (resultWords[i - 1].end > resultWords[i].start) {
        resultWords[i - 1].end = resultWords[i].start;
      }
      if (resultWords[i].start < resultWords[i - 1].end) {
        resultWords[i].start = resultWords[i - 1].end;
      }
    }
    if (resultWords[i].end <= resultWords[i].start) {
      const nextBound = i + 1 < resultWords.length ? resultWords[i + 1].start : lineEnd;
      const span = Math.min(0.3, Math.max(0.05, nextBound - resultWords[i].start));
      resultWords[i].end = resultWords[i].start + span;
    }
  }

  return resultWords;
}

function calculateWordFill(word: RenderWord, currentTimeSec: number): number {
  if (currentTimeSec >= word.end) return 100;
  if (currentTimeSec <= word.start) return 0;

  if (word.syllables && word.syllables.length > 1) {
    const totalChars = word.text.length;
    let accumulatedChars = 0;

    for (const syl of word.syllables) {
      const sylStartRatio = accumulatedChars / totalChars;
      accumulatedChars += syl.charLen;
      const sylEndRatio = accumulatedChars / totalChars;

      if (currentTimeSec < syl.start) {
        return sylStartRatio * 100;
      }
      if (currentTimeSec <= syl.end) {
        const sylDur = Math.max(0.01, syl.end - syl.start);
        const subProg = Math.max(0, Math.min(1, (currentTimeSec - syl.start) / sylDur));
        const totalProg = sylStartRatio + subProg * (sylEndRatio - sylStartRatio);
        return Math.max(0, Math.min(100, totalProg * 100));
      }
    }
    return 100;
  }

  const dur = Math.max(0.01, word.end - word.start);
  return Math.max(0, Math.min(100, ((currentTimeSec - word.start) / dur) * 100));
}

function applyClip(el: HTMLElement, clipVal: string) {
  el.style.clipPath = clipVal;
  (el.style as any).webkitClipPath = clipVal;
}

export interface KaraokeWordLineProps {
  words?: LyricsWord[];
  lineText?: string;
  syncedLine?: LyricsLine | null;
  nextLine?: LyricsLine | null;
  currentTimeSec: number;
  isPlaying?: boolean;
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
  isPlaying = true,
  isActive,
  isPastLine,
  isUpcomingLine,
  sizeVariant,
}: KaraokeWordLineProps) {
  const text = (lineText || syncedLine?.text || "").trim();
  if (!text) {
    return <div className="w-full h-4" />;
  }

  const lineStart = words && words.length > 0 && words[0].start != null
    ? words[0].start
    : (syncedLine?.start ?? 0);

  const lastWordEnd = words && words.length > 0 ? words[words.length - 1]?.end : null;
  const lineEnd = nextLine?.start && nextLine.start > lineStart
    ? (lastWordEnd && lastWordEnd > lineStart ? Math.min(nextLine.start, Math.max(lastWordEnd, nextLine.start - 0.2)) : nextLine.start)
    : (lastWordEnd && lastWordEnd > lineStart
        ? lastWordEnd
        : (syncedLine?.end && syncedLine.end > lineStart ? syncedLine.end : lineStart + 4.5));

  const effectiveWords = useMemo(
    () => processLineWords(text, words, lineStart, lineEnd),
    [text, words, lineStart, lineEnd]
  );

  // Group words into segments for bracket ad-libs
  const segments = useMemo(() => {
    const segs: { isBracketed: boolean; words: RenderWord[] }[] = [];
    let curSeg: { isBracketed: boolean; words: RenderWord[] } | null = null;

    for (const w of effectiveWords) {
      if (!curSeg || curSeg.isBracketed !== w.isBracketed) {
        if (curSeg && curSeg.words.length > 0) segs.push(curSeg);
        curSeg = { isBracketed: w.isBracketed, words: [w] };
      } else {
        curSeg.words.push(w);
      }
    }
    if (curSeg && curSeg.words.length > 0) segs.push(curSeg);
    return segs;
  }, [effectiveWords]);

  // DOM refs to filled overlay spans for 60fps/120fps rAF animation outside React state
  const fillSpanRefs = useRef<Map<number, HTMLElement>>(new Map());

  // High-precision clock sync state
  const currentTimeRef = useRef(currentTimeSec);
  const isPlayingRef = useRef(isPlaying);
  const syncMetaRef = useRef<PlaybackSyncMeta>({
    lastSyncTime: currentTimeSec,
    lastSyncPerf: typeof performance !== "undefined" ? performance.now() : 0,
  });

  useEffect(() => {
    currentTimeRef.current = currentTimeSec;
    syncMetaRef.current.lastSyncTime = currentTimeSec;
    syncMetaRef.current.lastSyncPerf = performance.now();
  }, [currentTimeSec]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Continuous 60fps/120fps highlight animation loop for active line
  useEffect(() => {
    if (!isActive) return;

    let animId: number;

    const updateFrame = () => {
      const t = getContinuousPlaybackTime(
        currentTimeRef.current,
        isPlayingRef.current,
        syncMetaRef.current
      );

      for (let i = 0; i < effectiveWords.length; i++) {
        const el = fillSpanRefs.current.get(i);
        if (!el) continue;

        const w = effectiveWords[i];
        let fill = 0;
        if (t >= w.end) {
          fill = 100;
        } else if (t <= w.start) {
          fill = 0;
        } else {
          fill = calculateWordFill(w, t);
        }

        const clipPct = Math.max(0, 100 - fill).toFixed(2);
        const clipVal = `inset(0 ${clipPct}% 0 0)`;

        if (el.style.clipPath !== clipVal) {
          applyClip(el, clipVal);
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive, effectiveWords]);

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

  return (
    <div className="w-full flex flex-col items-start select-none">
      {segments.map((seg, sIdx) => {
        const segClasses = seg.isBracketed ? getBracketClasses() : getMainClasses();
        const segWeight = seg.isBracketed ? bracketWeight : mainWeight;

        return (
          <p
            key={sIdx}
            className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses}`}
          >
            {seg.words.map((w) => {
              const initialFill = isPastLine
                ? 100
                : isUpcomingLine
                ? 0
                : calculateWordFill(w, currentTimeSec);
              const initialClip = `inset(0 ${Math.max(0, 100 - initialFill).toFixed(2)}% 0 0)`;

              return (
                <span
                  key={w.globalIndex}
                  className="relative inline-block whitespace-nowrap mr-[0.24em] last:mr-0 align-baseline select-none"
                >
                  {/* Base dimmed word */}
                  <span
                    className={`transition-colors duration-200 ${segWeight} ${
                      isActive ? "text-white/35" : "text-white/40"
                    }`}
                  >
                    {w.text}
                  </span>

                  {/* Active filled word - pure crisp white with zero layout cost and 60fps/120fps rAF clipping */}
                  <span
                    ref={(el) => {
                      if (el) {
                        fillSpanRefs.current.set(w.globalIndex, el);
                        // Ensure immediate visual state if not active
                        if (!isActive) {
                          applyClip(el, initialClip);
                        }
                      } else {
                        fillSpanRefs.current.delete(w.globalIndex);
                      }
                    }}
                    className="absolute top-0 left-0 w-full h-full pointer-events-none select-none"
                    style={{
                      clipPath: initialClip,
                      WebkitClipPath: initialClip,
                      willChange: isActive ? "clip-path" : "auto",
                    }}
                    aria-hidden="true"
                  >
                    <span className={`text-white whitespace-nowrap ${segWeight}`}>
                      {w.text}
                    </span>
                  </span>
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
});

KaraokeWordLine.displayName = "KaraokeWordLine";
