import { LyricsLine, LyricsResult } from "../types";

export function parsePlainTextLyrics(content: string, source: string | null = null): LyricsResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return {
      success: false,
      syncType: "unsynced",
      format: "plain",
      source,
      lines: [],
      rawContent: content,
    };
  }

  const rawLines = normalized.split("\n");
  const lines: LyricsLine[] = [];

  for (const rawLine of rawLines) {
    const text = rawLine.trim();
    if (!text) continue;
    // For plain text, we set start and end to 0, words undefined
    lines.push({
      text,
      start: 0,
      end: 0,
      words: undefined,
    });
  }

  return {
    success: lines.length > 0,
    syncType: "unsynced",
    format: "plain",
    source,
    lines,
    rawContent: content,
  };
}

export { parsePlainTextLyrics as parsePlainText };

