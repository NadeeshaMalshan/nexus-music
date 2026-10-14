import { LyricsFormat, LyricsResult } from "../types";
import { parseEnhancedLrc } from "./enhancedLrcParser";
import { parsePlainTextLyrics } from "./plainTextParser";
import { parseStandardLrc } from "./standardLrcParser";
import { parseTtml } from "./ttmlParser";

export function detectLyricsFormat(content: string): LyricsFormat {
  if (!content || typeof content !== "string") return "plain";
  const trimmed = content.trim();

  // TTML / XML check
  if (/<tt\b|<xml\b|<\?xml/i.test(trimmed) && /<p\b/i.test(trimmed)) {
    return "ttml";
  }

  // Enhanced LRC check (contains line timestamp AND inline word timestamps)
  const hasLineTimestamp = /\[\d{1,3}:\d{2}/.test(trimmed);
  const hasWordTimestamp = /[<(]\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?[>)]/.test(trimmed);
  if (hasLineTimestamp && hasWordTimestamp) {
    return "enhanced_lrc";
  }

  // Standard LRC check
  if (hasLineTimestamp) {
    return "lrc";
  }

  return "plain";
}

export function parseLyrics(
  content: string,
  hintFormat?: LyricsFormat,
  source: string | null = null
): LyricsResult {
  const format = hintFormat ?? detectLyricsFormat(content);

  switch (format) {
    case "ttml":
      return parseTtml(content, source);
    case "enhanced_lrc":
      return parseEnhancedLrc(content, source);
    case "lrc":
      return parseStandardLrc(content, source);
    case "plain":
    default:
      return parsePlainTextLyrics(content, source);
  }
}

export { parseEnhancedLrc, parsePlainTextLyrics, parseStandardLrc, parseTtml };
