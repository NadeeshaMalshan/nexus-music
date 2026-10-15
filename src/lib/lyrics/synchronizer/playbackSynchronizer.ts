import { LyricsLine, LyricsWord } from "../types";

/**
 * Fast binary search to find the active line index given currentTimeSec.
 * Returns -1 if no line is currently active.
 */
export function findActiveLineIndex(lines: LyricsLine[], currentTimeSec: number): number {
  if (!lines || lines.length === 0 || currentTimeSec < 0 || Number.isNaN(currentTimeSec)) {
    return -1;
  }

  // If before the first line
  if (currentTimeSec < lines[0].start) {
    return -1;
  }

  let low = 0;
  let high = lines.length - 1;
  let bestMatch = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = lines[mid];

    if (currentTimeSec >= line.start) {
      bestMatch = mid;
      low = mid + 1; // Look for a later line that also qualifies
    } else {
      high = mid - 1;
    }
  }

  // Ensure currentTimeSec is within the matched line's end boundary (if defined)
  if (bestMatch >= 0) {
    const matched = lines[bestMatch];
    const next = lines[bestMatch + 1];
    const upperLimit = next ? next.start : (matched.end > matched.start ? matched.end : matched.start + 8);
    if (currentTimeSec < upperLimit) {
      return bestMatch;
    }
  }

  return bestMatch;
}

/**
 * Fast binary search to find the active word index within a line's words.
 * Returns -1 if no word is active or if words is undefined/empty.
 */
export function findActiveWordIndex(words: LyricsWord[] | undefined, currentTimeSec: number): number {
  if (!words || words.length === 0 || currentTimeSec < 0 || Number.isNaN(currentTimeSec)) {
    return -1;
  }

  // If before first word
  if (currentTimeSec < words[0].start) {
    return -1;
  }

  // If past last word
  const last = words[words.length - 1];
  if (currentTimeSec >= last.end) {
    return words.length - 1; // Keep last word active until line transition
  }

  let low = 0;
  let high = words.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const word = words[mid];

    if (currentTimeSec >= word.start && currentTimeSec < word.end) {
      return mid;
    }

    if (currentTimeSec < word.start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // In between words: find the latest word that started
  for (let i = words.length - 1; i >= 0; i--) {
    if (currentTimeSec >= words[i].start) {
      return i;
    }
  }

  return -1;
}

/**
 * Calculates progress ratio [0, 1] through the active word or active line
 */
export function calculatePlaybackProgress(start: number, end: number, currentTimeSec: number): number {
  if (end <= start || currentTimeSec <= start) return 0;
  if (currentTimeSec >= end) return 1;
  return (currentTimeSec - start) / (end - start);
}
