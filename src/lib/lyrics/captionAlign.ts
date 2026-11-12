/**
 * captionAlign.ts
 * Pure module for aligning lyrics against YouTube video captions (ASR word timestamps).
 * Used exclusively in MUSIC-VIDEO mode to re-time lyrics for videos with intros, skits, or edits.
 */

import { LyricsLine, LyricsWord } from "./types";

export interface CaptionWord {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
}

export interface AlignmentStats {
  mode: "constant" | "per-word";
  matched: number;
  total: number;
  medianOffset: number;
}

export interface AlignmentResult {
  lines: LyricsLine[];
  stats: AlignmentStats;
}

/**
 * Normalizes a word token for linguistic comparison:
 * - Lowercase
 * - Unicode NFKD decomposition + strip diacritics
 * - Strip punctuation and symbols, retaining all Unicode letters & digits (\p{L}\p{N}).
 * - Preserves non-Latin scripts (Sinhala, Japanese, Cyrillic, etc.) without crashing.
 */
export function normalizeToken(raw: string): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}]/gu, "")
    .normalize("NFC");
}

/**
 * Computes Levenshtein distance between two strings.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 1) return 2;
  const m = a.length;
  const n = b.length;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

/**
 * Checks equality between two normalized tokens:
 * Exact match, or Levenshtein distance <= 1 when both tokens have >= 4 chars (ASR errors).
 */
export function tokensMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && levenshteinDistance(a, b) <= 1) {
    return true;
  }
  return false;
}

/**
 * Calculates median of an already sorted array of numbers.
 */
export function calculateMedian(sorted: number[]): number {
  const len = sorted.length;
  if (len === 0) return 0;
  const mid = Math.floor(len / 2);
  if (len % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Expands segment-level (phrase-level) caption entries into individual words
 * spread evenly across [start, end]. Single-word entries are preserved.
 * Pure function: does not mutate inputs.
 */
export function expandCaptionSegments(captions: readonly CaptionWord[]): CaptionWord[] {
  if (!captions || captions.length === 0) return [];
  const expanded: CaptionWord[] = [];
  for (const cap of captions) {
    if (!cap || !cap.text) continue;
    const trimmed = cap.text.trim();
    if (!trimmed) continue;
    const rawTokens = trimmed.split(/\s+/).filter(Boolean);
    if (rawTokens.length <= 1) {
      expanded.push({
        text: rawTokens[0] || trimmed,
        start: cap.start,
        end: cap.end,
      });
      continue;
    }
    const segStart = cap.start;
    const segEnd = Math.max(segStart, cap.end);
    const totalDur = segEnd - segStart;
    const step = totalDur > 0 ? totalDur / rawTokens.length : 0;
    for (let i = 0; i < rawTokens.length; i++) {
      const wStart = segStart + i * step;
      const wEnd = i === rawTokens.length - 1 ? segEnd : segStart + (i + 1) * step;
      expanded.push({
        text: rawTokens[i],
        start: wStart,
        end: wEnd,
      });
    }
  }
  return expanded;
}

interface FlatLyricWord {
  rawText: string;
  normText: string;
  start: number;
  end: number;
  lineIndex: number;
  wordIndex: number;
  hasOriginalWords: boolean;
}

interface FlatCaptionWord {
  text: string;
  normText: string;
  start: number;
  end: number;
}

/**
 * Aligns lyrics against caption words using global sequence DP (LCS).
 * Never mutates inputs. Returns null if alignment quality is insufficient.
 */
export function alignLyricsToCaption(
  lines: readonly LyricsLine[],
  captionWords: readonly CaptionWord[]
): AlignmentResult | null {
  if (!lines || lines.length === 0 || !captionWords || captionWords.length === 0) {
    return null;
  }

  // Support both phrase-level/segment-level and word-level caption data
  const normalizedCaptions = expandCaptionSegments(captionWords);
  if (normalizedCaptions.length === 0) return null;

  // 1. Flatten lyric words
  const flatLyricWords: FlatLyricWord[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.words && line.words.length > 0) {
      for (let j = 0; j < line.words.length; j++) {
        const w = line.words[j];
        flatLyricWords.push({
          rawText: w.text,
          normText: normalizeToken(w.text),
          start: w.start,
          end: w.end,
          lineIndex: i,
          wordIndex: j,
          hasOriginalWords: true,
        });
      }
    } else {
      const tokens = line.text.trim().split(/\s+/).filter(Boolean);
      if (tokens.length > 0) {
        const duration = Math.max(0.1, line.end - line.start);
        const step = duration / tokens.length;
        for (let j = 0; j < tokens.length; j++) {
          flatLyricWords.push({
            rawText: tokens[j],
            normText: normalizeToken(tokens[j]),
            start: line.start + j * step,
            end: line.start + (j + 1) * step,
            lineIndex: i,
            wordIndex: j,
            hasOriginalWords: false,
          });
        }
      }
    }
  }

  const totalLyricWords = flatLyricWords.length;
  if (totalLyricWords === 0) return null;

  // 2. Prepare caption words
  const flatCaptionWords: FlatCaptionWord[] = [];
  for (const c of normalizedCaptions) {
    const norm = normalizeToken(c.text);
    if (norm) {
      flatCaptionWords.push({
        text: c.text,
        normText: norm,
        start: c.start,
        end: c.end,
      });
    }
  }

  if (flatCaptionWords.length === 0) return null;

  const N = flatLyricWords.length;
  const M = flatCaptionWords.length;

  // 3. Global DP Sequence Alignment (LCS)
  // dp[i][j] represents length of longest common sequence
  const stride = M + 1;
  const dp = new Int32Array((N + 1) * stride);

  for (let i = 1; i <= N; i++) {
    const rowOffset = i * stride;
    const prevRowOffset = (i - 1) * stride;
    const lNorm = flatLyricWords[i - 1].normText;

    for (let j = 1; j <= M; j++) {
      const cNorm = flatCaptionWords[j - 1].normText;
      if (lNorm && cNorm && tokensMatch(lNorm, cNorm)) {
        dp[rowOffset + j] = dp[prevRowOffset + (j - 1)] + 1;
      } else {
        const up = dp[prevRowOffset + j];
        const left = dp[rowOffset + (j - 1)];
        dp[rowOffset + j] = up > left ? up : left;
      }
    }
  }

  // Backtrack to extract matched pairs
  interface MatchedPair {
    lIdx: number;
    cIdx: number;
    offset: number; // captionStart - lyricStart
  }

  const matches: MatchedPair[] = [];
  let i = N;
  let j = M;

  while (i > 0 && j > 0) {
    const rowOffset = i * stride;
    const prevRowOffset = (i - 1) * stride;
    const lNorm = flatLyricWords[i - 1].normText;
    const cNorm = flatCaptionWords[j - 1].normText;

    if (
      lNorm &&
      cNorm &&
      tokensMatch(lNorm, cNorm) &&
      dp[rowOffset + j] === dp[prevRowOffset + (j - 1)] + 1
    ) {
      matches.push({
        lIdx: i - 1,
        cIdx: j - 1,
        offset: flatCaptionWords[j - 1].start - flatLyricWords[i - 1].start,
      });
      i--;
      j--;
    } else if (dp[prevRowOffset + j] >= dp[rowOffset + (j - 1)]) {
      i--;
    } else {
      j--;
    }
  }

  matches.reverse(); // Restore chronological order

  // 4. Threshold check: matched < max(8, 25% of lyric words)
  const minRequired = Math.max(8, Math.floor(0.25 * totalLyricWords));
  if (matches.length < minRequired) {
    return null;
  }

  // 5. Calculate median and MAD
  const offsets = matches.map((m) => m.offset).sort((a, b) => a - b);
  const medianOffset = calculateMedian(offsets);
  const absDeviations = offsets.map((o) => Math.abs(o - medianOffset)).sort((a, b) => a - b);
  const mad = calculateMedian(absDeviations);

  const mode: "constant" | "per-word" = mad <= 0.35 ? "constant" : "per-word";

  let alignedLines: LyricsLine[] = [];

  if (mode === "constant") {
    // Mode "constant": shift every line and word by medianOffset
    alignedLines = lines.map((line) => {
      const newStart = Math.max(0, line.start + medianOffset);
      const newEnd = Math.max(newStart, line.end + medianOffset);
      const newWords = line.words
        ? line.words.map((w) => {
            const wStart = Math.max(0, w.start + medianOffset);
            const wEnd = Math.max(wStart, w.end + medianOffset);
            return {
              ...w,
              start: wStart,
              end: wEnd,
            };
          })
        : undefined;

      return {
        ...line,
        start: newStart,
        end: newEnd,
        words: newWords,
      };
    });
  } else {
    // Mode "per-word": matched words take caption start; interpolate unmatched words
    const alignedWordStarts = new Float64Array(N);
    const anchorMap = new Map<number, number>();
    for (const m of matches) {
      anchorMap.set(m.lIdx, flatCaptionWords[m.cIdx].start);
    }

    const firstAnchor = matches[0].lIdx;
    const firstAnchorStart = anchorMap.get(firstAnchor)!;
    const firstOffset = firstAnchorStart - flatLyricWords[firstAnchor].start;

    // Words before first anchor
    for (let k = 0; k < firstAnchor; k++) {
      alignedWordStarts[k] = Math.max(0, flatLyricWords[k].start + firstOffset);
    }

    // Anchors and interpolation between anchors
    for (let m = 0; m < matches.length; m++) {
      const k = matches[m].lIdx;
      alignedWordStarts[k] = anchorMap.get(k)!;

      if (m < matches.length - 1) {
        const nextK = matches[m + 1].lIdx;
        const nextStart = anchorMap.get(nextK)!;
        const origDelta = flatLyricWords[nextK].start - flatLyricWords[k].start;
        const newDelta = nextStart - alignedWordStarts[k];

        for (let p = k + 1; p < nextK; p++) {
          const ratio =
            origDelta > 0
              ? (flatLyricWords[p].start - flatLyricWords[k].start) / origDelta
              : (p - k) / (nextK - k);
          alignedWordStarts[p] = Math.max(0, alignedWordStarts[k] + ratio * newDelta);
        }
      }
    }

    // Words after last anchor
    const lastAnchor = matches[matches.length - 1].lIdx;
    const lastAnchorStart = anchorMap.get(lastAnchor)!;
    const lastOffset = lastAnchorStart - flatLyricWords[lastAnchor].start;

    for (let k = lastAnchor + 1; k < N; k++) {
      alignedWordStarts[k] = Math.max(0, flatLyricWords[k].start + lastOffset);
    }

    // Ensure non-decreasing monotonicity
    for (let k = 0; k < N; k++) {
      alignedWordStarts[k] = Math.max(0, alignedWordStarts[k]);
      if (k > 0 && alignedWordStarts[k] < alignedWordStarts[k - 1]) {
        alignedWordStarts[k] = alignedWordStarts[k - 1] + 0.01;
      }
    }

    // Group words back into lines
    const lineMap = new Map<number, number[]>();
    for (let k = 0; k < N; k++) {
      const lineIdx = flatLyricWords[k].lineIndex;
      if (!lineMap.has(lineIdx)) lineMap.set(lineIdx, []);
      lineMap.get(lineIdx)!.push(k);
    }

    alignedLines = lines.map((origLine, lineIdx) => {
      const wordIndices = lineMap.get(lineIdx) || [];
      if (wordIndices.length === 0) {
        return { ...origLine };
      }

      if (origLine.words && origLine.words.length > 0) {
        const reconstructedWords: LyricsWord[] = [];
        for (let wIdx = 0; wIdx < origLine.words.length; wIdx++) {
          const origWord = origLine.words[wIdx];
          const flatIdx = wordIndices[wIdx];
          const wStart = alignedWordStarts[flatIdx];

          let wEnd: number;
          let isDerivedEnd = origWord.isDerivedEnd;

          if (wIdx < origLine.words.length - 1) {
            const nextFlatIdx = wordIndices[wIdx + 1];
            const nextStart = alignedWordStarts[nextFlatIdx];
            wEnd = Math.max(wStart + 0.05, Math.min(nextStart, wStart + 5.0));
            isDerivedEnd = true;
          } else {
            const origDuration = Math.max(0.1, origWord.end - origWord.start);
            wEnd = wStart + origDuration;
          }

          reconstructedWords.push({
            text: origWord.text,
            start: wStart,
            end: wEnd,
            isDerivedEnd,
          });
        }

        return {
          ...origLine,
          start: reconstructedWords[0].start,
          end: reconstructedWords[reconstructedWords.length - 1].end,
          words: reconstructedWords,
        };
      } else {
        const firstFlatIdx = wordIndices[0];
        const lastFlatIdx = wordIndices[wordIndices.length - 1];
        const lineStart = alignedWordStarts[firstFlatIdx];
        const origDuration = Math.max(0.1, origLine.end - origLine.start);
        const lineEnd = Math.max(lineStart + origDuration, alignedWordStarts[lastFlatIdx] + 0.5);

        return {
          ...origLine,
          start: lineStart,
          end: lineEnd,
          words: undefined,
        };
      }
    });
  }

  // 6. Insert instrumental break lines for gaps >= 4.0s
  const finalLines: LyricsLine[] = [];
  if (alignedLines.length > 0 && alignedLines[0].start >= 4.0) {
    finalLines.push({
      text: "",
      isInstrumental: true,
      start: 0,
      end: alignedLines[0].start,
    });
  }

  for (let idx = 0; idx < alignedLines.length; idx++) {
    finalLines.push(alignedLines[idx]);
    const curr = alignedLines[idx];
    const next = alignedLines[idx + 1];
    if (next && next.start - curr.end >= 4.0) {
      finalLines.push({
        text: "",
        isInstrumental: true,
        start: curr.end,
        end: next.start,
      });
    }
  }

  return {
    lines: finalLines,
    stats: {
      mode,
      matched: matches.length,
      total: totalLyricWords,
      medianOffset,
    },
  };
}
