"use client";

import React, { useMemo, useRef, useEffect } from "react";
import { LyricsWord, LyricsLine } from "@/lib/lyrics/types";
import { getContinuousPlaybackTime, PlaybackSyncMeta } from "@/lib/lyrics/synchronizer/playbackClock";

export interface WordSegment {
  isBracketed: boolean;
  words: LyricsWord[];
}

/**
 * Removes wrapping brackets/parentheses from background vocals while preserving
 * inner letters and trailing punctuation (e.g. "(You" -> "You", "it)" -> "it", "walk," -> "walk,").
 */
export function cleanDisplayWord(text: string, isBracketed: boolean): string {
  if (!text) return "";
  if (!isBracketed) return text;
  return text.replace(/^[(\[{<]+/, "").replace(/[)\]}>]+([.,!?;:]*)$/, "$1").trim();
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
    const startsBracket = /^[(\[{<]/.test(trimmed);
    const endsBracket = /[)\]}>][.,!?;:]*$/.test(trimmed);

    if (!inBracket && startsBracket) {
      inBracket = true;
      if (currentSegment && currentSegment.words.length > 0) {
        segments.push(currentSegment);
      }
      currentSegment = {
        isBracketed: true,
        words: [w],
      };
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
  wordIndex: number;
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
 * 2. Enforces strictly monotonic non-overlapping timings WITHIN each vocal track.
 */
function processLineWords(
  lineText: string,
  rawWords: LyricsWord[] | undefined,
  lineStart: number,
  lineEnd: number
): RenderWord[] {
  const text = (lineText || "").trim();
  if (!text) return [];

  const rawTokens = text.split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return [];

  // Parse bracket state and remove bracket punctuation from display text
  const targetTokens: { rawToken: string; displayText: string; isBracketed: boolean }[] = [];
  let inBracket = false;

  for (const token of rawTokens) {
    if (/^[(\[{<]/.test(token)) inBracket = true;
    const isBracketed = inBracket || /[)\]}>]/.test(token);
    if (/[)\]}>]/.test(token)) inBracket = false;

    const display = cleanDisplayWord(token, isBracketed);
    // Ignore standalone bracket tokens like "(" or ")" that produce empty display text
    if (display.length > 0) {
      targetTokens.push({
        rawToken: token,
        displayText: display,
        isBracketed,
      });
    }
  }

  if (targetTokens.length === 0) return [];

  let resultWords: RenderWord[] = [];

  if (rawWords && rawWords.length > 0) {
    let rawIdx = 0;

    for (let tIdx = 0; tIdx < targetTokens.length; tIdx++) {
      const item = targetTokens[tIdx];
      const targetClean = cleanNorm(item.displayText);

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
          wordIndex: tIdx,
          text: item.displayText,
          start: wStart,
          end: Math.max(wStart + 0.05, wEnd),
          isBracketed: item.isBracketed,
          syllables: matchedSyllables.length > 1 ? matchedSyllables : undefined,
        });
      } else {
        resultWords.push({
          globalIndex: tIdx,
          wordIndex: tIdx,
          text: item.displayText,
          start: lineStart,
          end: lineEnd,
          isBracketed: item.isBracketed,
        });
      }
    }
  }

  // Fallback to character-proportional estimation if no raw words or mapping empty
  if (resultWords.length === 0) {
    const lineDur = Math.max(0.4, lineEnd - lineStart);
    const totalChars = targetTokens.reduce((s, item) => s + item.displayText.length, 0) + Math.max(0, targetTokens.length - 1);
    let curChars = 0;

    resultWords = targetTokens.map((item, idx) => {
      const sRatio = totalChars > 0 ? curChars / totalChars : 0;
      curChars += item.displayText.length;
      const eRatio = totalChars > 0 ? curChars / totalChars : 1;
      curChars += 1;

      return {
        globalIndex: idx,
        wordIndex: idx,
        text: item.displayText,
        start: lineStart + sRatio * lineDur,
        end: lineStart + eRatio * lineDur,
        isBracketed: item.isBracketed,
      };
    });
  }

  // Enforce STRICT monotonic non-overlapping timings WITHIN EACH VOCAL SEGMENT
  // (Main vocal and background vocal overlap in time, so they must be adjusted independently)
  for (let i = 1; i < resultWords.length; i++) {
    const prev = resultWords[i - 1];
    const curr = resultWords[i];

    if (prev.isBracketed === curr.isBracketed) {
      if (prev.end > curr.start) {
        prev.end = curr.start;
      }
      if (curr.start < prev.end) {
        curr.start = prev.end;
      }
      if (curr.end <= curr.start) {
        const nextBound = (i + 1 < resultWords.length && resultWords[i + 1].isBracketed === curr.isBracketed)
          ? resultWords[i + 1].start
          : lineEnd;
        const span = Math.min(0.3, Math.max(0.05, nextBound - curr.start));
        curr.end = curr.start + span;
      }
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

  const hasWordTimestamps = Boolean(words && words.length > 0);

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
        return "text-[28px] md:text-[30px] leading-[1.22] font-bold tracking-tight text-white/80 mt-1.5";
      case "mobile":
        return "text-[24px] leading-[1.2] font-bold tracking-tight text-white/80 mt-1";
      case "sidebar":
      default:
        return "text-[17px] leading-[1.2] font-bold tracking-tight text-white/80 mt-0.5";
    }
  };

  // If no genuine word timestamps from provider, render plain line with clean bracket parsing
  if (!hasWordTimestamps) {
    const rawTokens = text.split(/\s+/).filter(Boolean);
    const segs: { isBracketed: boolean; text: string }[] = [];
    let curSeg: { isBracketed: boolean; words: string[] } | null = null;
    let inB = false;

    for (const token of rawTokens) {
      if (/^[(\[{<]/.test(token)) inB = true;
      const isB = inB || /[)\]}>]/.test(token);
      if (/[)\]}>]/.test(token)) inB = false;

      const clean = cleanDisplayWord(token, isB);
      if (!clean) continue;

      if (!curSeg || curSeg.isBracketed !== isB) {
        if (curSeg && curSeg.words.length > 0) {
          segs.push({ isBracketed: curSeg.isBracketed, text: curSeg.words.join(" ") });
        }
        curSeg = { isBracketed: isB, words: [clean] };
      } else {
        curSeg.words.push(clean);
      }
    }
    if (curSeg && curSeg.words.length > 0) {
      segs.push({ isBracketed: curSeg.isBracketed, text: curSeg.words.join(" ") });
    }

    const hasMain = segs.some((s) => !s.isBracketed);

    return (
      <div className="w-full flex flex-col items-start select-none">
        {segs.map((seg, sIdx) => {
          // Hide background vocal on upcoming lines when main line exists
          if (seg.isBracketed && hasMain && isUpcomingLine) return null;
          const segClasses = seg.isBracketed ? getBracketClasses() : getMainClasses();
          return (
            <p
              key={sIdx}
              className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses} ${
                isActive ? (seg.isBracketed ? "text-white/80" : "text-white") : "text-white/40"
              } ${seg.isBracketed ? "transition-all duration-500 ease-out" : ""}`}
              style={
                seg.isBracketed
                  ? {
                      opacity: isActive ? 0.9 : 0.45,
                      transform: isActive ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, -2px, 0) scale(0.98)",
                    }
                  : undefined
              }
            >
              {seg.text}
            </p>
          );
        })}
      </div>
    );
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

  // Group words into segments for main vs background ad-libs
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

  const hasMainSegment = useMemo(() => segments.some((s) => !s.isBracketed), [segments]);

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

      // Enforce sequential fill within each segment (prevent middle words filling prematurely)
      for (const seg of segments) {
        let prevWordFinished = true;

        for (let j = 0; j < seg.words.length; j++) {
          const w = seg.words[j];
          const el = fillSpanRefs.current.get(w.wordIndex);
          if (!el) continue;

          let fill = 0;
          if (t >= w.end) {
            fill = 100;
          } else if (t <= w.start || !prevWordFinished) {
            fill = 0;
          } else {
            fill = calculateWordFill(w, t);
          }

          if (fill < 100) {
            prevWordFinished = false;
          }

          const clipPct = Math.max(0, 100 - fill).toFixed(2);
          const clipVal = `inset(0 ${clipPct}% 0 0)`;

          if (el.style.clipPath !== clipVal) {
            applyClip(el, clipVal);
          }
        }
      }

      animId = requestAnimationFrame(updateFrame);
    };

    animId = requestAnimationFrame(updateFrame);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isActive, segments]);

  const segWordFills = useMemo(() => {
    const map = new Map<number, number>();
    for (const seg of segments) {
      let prevFinished = true;
      for (const w of seg.words) {
        let fill = 0;
        if (isPastLine) {
          fill = 100;
        } else if (isUpcomingLine) {
          fill = 0;
        } else if (currentTimeSec >= w.end) {
          fill = 100;
        } else if (currentTimeSec <= w.start || !prevFinished) {
          fill = 0;
        } else {
          fill = calculateWordFill(w, currentTimeSec);
        }

        if (fill < 100) {
          prevFinished = false;
        }
        map.set(w.wordIndex, fill);
      }
    }
    return map;
  }, [segments, isPastLine, isUpcomingLine, currentTimeSec]);

  const mainWeight = sizeVariant === "mobile" ? "font-black" : "font-extrabold";
  const bracketWeight = "font-bold";

  return (
    <div className="w-full flex flex-col items-start select-none">
      {segments.map((seg, sIdx) => {
        // Only show background vocal when main lyric part appears (active or past line).
        // Upcoming lines only show the main lyric part.
        if (seg.isBracketed && hasMainSegment && isUpcomingLine) {
          return null;
        }

        const segClasses = seg.isBracketed ? getBracketClasses() : getMainClasses();
        const segWeight = seg.isBracketed ? bracketWeight : mainWeight;

        return (
          <p
            key={sIdx}
            className={`w-full origin-left text-left whitespace-normal break-words text-balance transform-gpu ${segClasses} ${
              seg.isBracketed ? "transition-all duration-500 ease-out" : ""
            }`}
            style={
              seg.isBracketed
                ? {
                    opacity: isActive ? 0.9 : 0.45,
                    transform: isActive ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, -2px, 0) scale(0.98)",
                  }
                : undefined
            }
          >
            {seg.words.map((w) => {
              const initialFill = segWordFills.get(w.wordIndex) ?? 0;
              const initialClip = `inset(0 ${Math.max(0, 100 - initialFill).toFixed(2)}% 0 0)`;

              return (
                <span
                  key={w.wordIndex}
                  className="relative inline-block whitespace-nowrap mr-[0.24em] last:mr-0 align-baseline select-none"
                >
                  {/* Base dimmed word */}
                  <span
                    className={`transition-colors duration-200 ${segWeight} ${
                      isActive ? (seg.isBracketed ? "text-white/40" : "text-white/35") : "text-white/40"
                    }`}
                  >
                    {w.text}
                  </span>

                  {/* Active filled word - pure crisp white with zero layout cost and 60fps/120fps rAF clipping */}
                  <span
                    ref={(el) => {
                      if (el) {
                        fillSpanRefs.current.set(w.wordIndex, el);
                        // Ensure immediate visual state if not active
                        if (!isActive) {
                          applyClip(el, initialClip);
                        }
                      } else {
                        fillSpanRefs.current.delete(w.wordIndex);
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
