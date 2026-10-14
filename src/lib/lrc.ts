/**
 * Backward-compatible LRC parser entry point that connects to the new unified lyrics parser engine.
 */
import { parseLyrics } from "./lyrics/parsers";
import { LyricsLine, LyricsWord } from "./lyrics/types";

export type LrcEntry = {
  at: number;
  text: string;
  start?: number;
  end?: number;
  words?: LyricsWord[];
  isInstrumental?: boolean;
};

export function parseLrcContent(raw: string): LrcEntry[] {
  if (!raw || typeof raw !== "string") return [];
  const parsed = parseLyrics(raw);

  return parsed.lines.map((line: LyricsLine) => ({
    at: line.start,
    start: line.start,
    end: line.end,
    text: line.text,
    words: line.words,
    isInstrumental: line.isInstrumental,
  }));
}

export * from "./lyrics/types";
export * from "./lyrics/parsers";
export * from "./lyrics/synchronizer/playbackSynchronizer";
