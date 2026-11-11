export interface AnimatedCover {
  url: string;
  fallbackUrl?: string;
  width: number;
  height: number;
  durationMs: number | null;
  format: "hls" | "mp4" | "unknown";
  source: "apple-music" | "curated" | "community" | string;
  matchedTitle?: string;
  matchedArtist?: string;
  album?: string;
  bgColor?: string;
}

export interface CanvasResponse {
  hasCanvas: boolean;
  animatedCover: AnimatedCover | null;
  fallbackRequired: boolean;
  source: string | null;
}

export interface CanvasQuery {
  title: string;
  artist: string;
  album?: string;
}

export interface MatchScoreResult {
  isMatch: boolean;
  score: number; // 0 to 100
  titleScore: number;
  artistScore: number;
  albumScore: number;
  reason?: string;
}

export interface ICanvasProvider {
  readonly name: string;
  getCanvas(query: CanvasQuery): Promise<CanvasResponse | null>;
}

