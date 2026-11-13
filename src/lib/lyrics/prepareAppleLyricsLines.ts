import { LyricsLine } from "./types";

/**
 * Enhances synced lyrics lines with authentic Apple Music instrumental sections:
 * 1. Intro countdown: If the first vocal line starts after 3.0s, prepends an instrumental
 *    intro segment (0s -> first vocal entry) for the 3-dot countdown animation.
 * 2. Instrumental breaks: For inter-line gaps >= 5.0s, inserts an instrumental segment.
 */
export function prepareAppleLyricsLines(rawLines: LyricsLine[]): LyricsLine[] {
  if (!rawLines || rawLines.length === 0) return [];

  const result: LyricsLine[] = [];

  // Prepend intro instrumental if song has a >= 3.0s instrumental intro
  if (rawLines[0].start >= 3.0 && !rawLines[0].isInstrumental) {
    result.push({
      text: "♪",
      start: 0,
      end: rawLines[0].start,
      words: undefined,
      isInstrumental: true,
    });
  }

  for (let i = 0; i < rawLines.length; i++) {
    const cur = rawLines[i];
    const next = rawLines[i + 1];
    result.push(cur);

    if (next) {
      const curEnd = cur.end > cur.start ? cur.end : cur.start + 3.0;
      const gap = next.start - curEnd;
      if (gap >= 4.5 && !cur.isInstrumental && !next.isInstrumental) {
        result.push({
          text: "♪",
          start: curEnd,
          end: next.start,
          words: undefined,
          isInstrumental: true,
        });
      }
    }
  }

  return result.sort((a, b) => a.start - b.start);
}
