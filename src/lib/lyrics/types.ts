/**
 * Unified Lyrics Types for Nexus Music
 */

export type LyricsSyncType = "word" | "line" | "unsynced";
export type LyricsFormat = "ttml" | "enhanced_lrc" | "lrc" | "plain";

export interface LyricsWord {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
  isDerivedEnd?: boolean; // true if end was calculated from next word or line end
}

export interface LyricsLine {
  text: string;
  start: number; // in seconds
  end: number;   // in seconds
  words?: LyricsWord[]; // Present only when genuine word timestamps are available
  isInstrumental?: boolean;
}

export interface LyricsMetadata {
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  writers?: string[];
  offsetMs?: number;
}

export interface LyricsResult {
  success: boolean;
  syncType: LyricsSyncType;
  format: LyricsFormat;
  source: string | null;
  lines: LyricsLine[];
  rawContent?: string | null;
  metadata?: LyricsMetadata;
}

export interface LyricsQuery {
  track: string;
  artist: string;
  album?: string;
  durationSeconds?: number | null;
  isrc?: string;
  signal?: AbortSignal;
}

export interface ILyricsProvider {
  readonly name: string;
  search(query: LyricsQuery): Promise<LyricsResult | null>;
}
