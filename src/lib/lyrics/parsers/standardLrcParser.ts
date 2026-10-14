import { LyricsLine, LyricsMetadata, LyricsResult } from "../types";
import { parseTimeToSeconds } from "./timeUtils";

const TAG_REGEX = /\[(\d{1,3}:\d{2}(?::\d{2})?(?:\.\d{1,4})?)\]/g;
const METADATA_TAG_REGEX = /^\[([a-zA-Z]+):(.*)\]$/;

export function parseStandardLrc(content: string, source: string | null = null): LyricsResult {
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");

  const metadata: LyricsMetadata = {};
  interface TimedEntry {
    start: number;
    text: string;
  }
  const timedEntries: TimedEntry[] = [];

  let offsetSec = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check metadata tags e.g. [offset:500], [ti:Title], [ar:Artist], [al:Album]
    const metaMatch = line.match(METADATA_TAG_REGEX);
    if (metaMatch && !TAG_REGEX.test(line)) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === "offset") {
        const parsedOffset = parseFloat(val);
        if (!Number.isNaN(parsedOffset)) {
          offsetSec = parsedOffset / 1000;
          metadata.offsetMs = parsedOffset;
        }
      } else if (key === "ti") {
        metadata.title = val;
      } else if (key === "ar") {
        metadata.artist = val;
      } else if (key === "al") {
        metadata.album = val;
      }
      continue;
    }

    // Extract all timestamps in the line (supports multiple e.g. [00:12.34][00:24.56]Chorus)
    TAG_REGEX.lastIndex = 0;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;

    while ((match = TAG_REGEX.exec(line)) !== null) {
      const sec = parseTimeToSeconds(match[1]);
      if (sec !== null) {
        timestamps.push(sec);
      }
    }

    if (timestamps.length === 0) continue;

    // Clean text by stripping all timestamps
    TAG_REGEX.lastIndex = 0;
    const text = line.replace(TAG_REGEX, "").trim();

    for (const time of timestamps) {
      const adjustedTime = Math.max(0, time + offsetSec);
      timedEntries.push({
        start: adjustedTime,
        text,
      });
    }
  }

  if (timedEntries.length === 0) {
    return {
      success: false,
      syncType: "unsynced",
      format: "lrc",
      source,
      lines: [],
      rawContent: content,
      metadata,
    };
  }

  // Sort chronologically
  timedEntries.sort((a, b) => a.start - b.start);

  // Group duplicate consecutive timestamps (e.g., dual vocals on the same second)
  const deduped: TimedEntry[] = [];
  for (const entry of timedEntries) {
    const prev = deduped[deduped.length - 1];
    if (prev && Math.abs(prev.start - entry.start) < 0.05) {
      prev.text = entry.text ? `${prev.text} / ${entry.text}` : prev.text;
    } else {
      deduped.push({ ...entry });
    }
  }

  // Build final lines with calculated start and end
  const lines: LyricsLine[] = [];
  for (let i = 0; i < deduped.length; i++) {
    const current = deduped[i];
    const next = deduped[i + 1];

    // Compute line end time
    const end = next ? next.start : current.start + 5.0;
    const isInst = !current.text || current.text.includes("♪") || /^instrumental$/i.test(current.text);

    lines.push({
      text: current.text,
      start: current.start,
      end,
      words: undefined, // Standard LRC does NOT have word timestamps
      isInstrumental: isInst,
    });

    // Detect significant instrumental gaps between lines (> 15 seconds)
    if (next && next.start - current.start > 15 && !isInst) {
      lines.push({
        text: "♪",
        start: current.start + (next.start - current.start) * 0.25,
        end: next.start,
        words: undefined,
        isInstrumental: true,
      });
    }
  }

  return {
    success: lines.length > 0,
    syncType: "line",
    format: "lrc",
    source,
    lines,
    rawContent: content,
    metadata,
  };
}
