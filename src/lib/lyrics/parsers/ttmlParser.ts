import { LyricsLine, LyricsResult, LyricsWord } from "../types";
import { parseTimeToSeconds } from "./timeUtils";

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseTtml(content: string, source: string | null = null): LyricsResult {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return {
      success: false,
      syncType: "unsynced",
      format: "ttml",
      source,
      lines: [],
      rawContent: content,
    };
  }

  const lines: LyricsLine[] = [];

  // Match all <p> or <tt:p> paragraphs
  const pRegex = /<(?:\w+:)?p\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(normalized)) !== null) {
    const attrs = pMatch[1];
    const body = pMatch[2];

    const beginMatch = attrs.match(/\bbegin=["']([^"']+)["']/i);
    const endMatch = attrs.match(/\bend=["']([^"']+)["']/i);
    const durMatch = attrs.match(/\bdur=["']([^"']+)["']/i);

    if (!beginMatch) continue;

    const start = parseTimeToSeconds(beginMatch[1]);
    if (start === null) continue;

    let end = endMatch ? parseTimeToSeconds(endMatch[1]) : null;
    if (end === null && durMatch) {
      const dur = parseTimeToSeconds(durMatch[1]);
      if (dur !== null) end = start + dur;
    }
    if (end === null) {
      end = start + 5.0;
    }

    // Check for inner word/syllable <span begin="..." end="...">
    const spanRegex = /<(?:\w+:)?span\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?span>/gi;
    const words: LyricsWord[] = [];
    let spanMatch: RegExpExecArray | null;

    while ((spanMatch = spanRegex.exec(body)) !== null) {
      const spanAttrs = spanMatch[1];
      const spanText = decodeXmlEntities(spanMatch[2].replace(/<[^>]+>/g, ""));

      const spanBegin = spanAttrs.match(/\bbegin=["']([^"']+)["']/i);
      const spanEnd = spanAttrs.match(/\bend=["']([^"']+)["']/i);

      if (spanBegin && spanText) {
        const wStart = parseTimeToSeconds(spanBegin[1]);
        let wEnd = spanEnd ? parseTimeToSeconds(spanEnd[1]) : null;
        if (wStart !== null) {
          if (wEnd === null) {
            wEnd = wStart + 0.5;
          }
          words.push({
            text: spanText,
            start: wStart,
            end: wEnd,
            isDerivedEnd: !spanEnd,
          });
        }
      }
    }

    // Clean plain text of the line (strip all XML tags)
    const lineText = decodeXmlEntities(body.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).trim();

    if (lineText) {
      lines.push({
        text: lineText,
        start,
        end,
        words: words.length > 0 ? words : undefined,
      });
    }
  }

  if (lines.length === 0) {
    return {
      success: false,
      syncType: "unsynced",
      format: "ttml",
      source,
      lines: [],
      rawContent: content,
    };
  }

  // Sort lines chronologically
  lines.sort((a, b) => a.start - b.start);

  const hasWordTimestamps = lines.some((l) => l.words && l.words.length > 0);

  return {
    success: true,
    syncType: hasWordTimestamps ? "word" : "line",
    format: "ttml",
    source,
    lines,
    rawContent: content,
  };
}
