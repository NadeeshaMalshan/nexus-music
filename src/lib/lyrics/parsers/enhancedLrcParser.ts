import { LyricsLine, LyricsResult, LyricsWord } from "../types";
import { parseTimeToSeconds } from "./timeUtils";

// Matches line timestamp tag: [mm:ss.xx]
const LINE_TAG_REGEX = /^\[(\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?)\]/;
// Matches inline word timestamp tag: <mm:ss.xx> or (mm:ss.xx)
const WORD_TAG_REGEX = /[<(](\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?)[>)]/g;

export function parseEnhancedLrc(content: string, source: string | null = null): LyricsResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");

  const lines: LyricsLine[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const lineMatch = trimmed.match(LINE_TAG_REGEX);
    if (!lineMatch) continue;

    const lineStart = parseTimeToSeconds(lineMatch[1]);
    if (lineStart === null) continue;

    // Remaining text after [line_timestamp]
    const lineBody = trimmed.slice(lineMatch[0].length).trim();
    if (!lineBody) continue;

    // Check if line contains inline word timestamps
    WORD_TAG_REGEX.lastIndex = 0;
    if (!WORD_TAG_REGEX.test(lineBody)) {
      // Standard line without inline tags
      lines.push({
        text: lineBody,
        start: lineStart,
        end: lineStart + 4.0, // Temporary until sorted
        words: undefined,
      });
      continue;
    }

    // Parse inline words with timestamps
    WORD_TAG_REGEX.lastIndex = 0;
    interface RawWordToken {
      time: number;
      text: string;
    }
    const tokens: RawWordToken[] = [];

    // Split text by word timestamp tags while preserving tokens
    const parts = lineBody.split(/[<(]\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?[>)]/);
    const tagMatches = [...lineBody.matchAll(/[<(](\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?)[>)]/g)];

    // If there is text before the first tag, assign lineStart
    if (parts[0] && parts[0].trim()) {
      tokens.push({
        time: lineStart,
        text: parts[0],
      });
    }

    for (let i = 0; i < tagMatches.length; i++) {
      const tagTime = parseTimeToSeconds(tagMatches[i][1]);
      const wordText = parts[i + 1] ?? "";

      if (tagTime !== null && wordText) {
        tokens.push({
          time: tagTime,
          text: wordText,
        });
      }
    }

    // Build LyricsWord array
    const words: LyricsWord[] = [];

    for (let i = 0; i < tokens.length; i++) {
      const cur = tokens[i];
      const next = tokens[i + 1];

      // Derived end time: next word start, or cur.time + estimated word duration (0.4s to 3s)
      const end = next && next.time > cur.time ? next.time : cur.time + 0.6;
      const cleanWord = cur.text.trim();
      if (!cleanWord) continue;

      words.push({
        text: cleanWord,
        start: cur.time,
        end,
        isDerivedEnd: true,
      });
    }

    const lineEnd = words.length > 0 ? words[words.length - 1].end : lineStart + 4.0;
    const fullLineText = words.length > 0
      ? words.map((w) => w.text).join(" ")
      : lineBody.replace(WORD_TAG_REGEX, " ").replace(/\s+/g, " ").trim();

    lines.push({
      text: fullLineText,
      start: lineStart,
      end: lineEnd,
      words: words.length > 0 ? words : undefined,
    });
  }

  if (lines.length === 0) {
    return {
      success: false,
      syncType: "unsynced",
      format: "enhanced_lrc",
      source,
      lines: [],
      rawContent: content,
    };
  }

  // Sort lines chronologically
  lines.sort((a, b) => a.start - b.start);

  // Harmonize end times between consecutive lines
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i];
    const next = lines[i + 1];
    if (next) {
      if (cur.end > next.start) {
        cur.end = next.start;
      }
      // If words exist, clamp last word's end to line.end
      if (cur.words && cur.words.length > 0) {
        const lastWord = cur.words[cur.words.length - 1];
        if (lastWord.end > cur.end) {
          lastWord.end = cur.end;
        }
      }
    }
  }

  const hasWordTimestamps = lines.some((l) => l.words && l.words.length > 0);

  return {
    success: true,
    syncType: hasWordTimestamps ? "word" : "line",
    format: "enhanced_lrc",
    source,
    lines,
    rawContent: content,
  };
}
