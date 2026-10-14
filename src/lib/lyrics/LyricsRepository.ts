import { Redis } from "@upstash/redis";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "./types";
import { LrcLibProvider } from "./providers/LrcLibProvider";
import { LyricsOvhProvider } from "./providers/LyricsOvhProvider";
import { GeniusMetadata, GeniusProvider } from "./providers/GeniusProvider";

let redisClient: Redis | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisClient = Redis.fromEnv();
  }
} catch {
  redisClient = null;
}

export interface UnifiedLyricsResponse {
  success: boolean;
  lyrics: {
    isSynced: boolean;
    isWordSynced: boolean;
    syncType: "word" | "line" | "unsynced";
    content: string | null;
    format: "ttml" | "enhanced_lrc" | "lrc" | "plain";
    source: string | null;
    lines: LyricsResult["lines"];
  };
  geniusData: GeniusMetadata;
}

export class LyricsRepository {
  private static instance: LyricsRepository;
  private providers: ILyricsProvider[];
  private geniusProvider: GeniusProvider;
  private inFlightRequests: Map<string, Promise<UnifiedLyricsResponse>>;
  private memoryCache: Map<string, { data: UnifiedLyricsResponse; expiresAt: number }>;

  public constructor(providers?: ILyricsProvider[], geniusProvider?: GeniusProvider) {
    this.providers = providers || [
      new LrcLibProvider(),
      new LyricsOvhProvider(),
    ];
    this.geniusProvider = geniusProvider || new GeniusProvider();
    this.inFlightRequests = new Map();
    this.memoryCache = new Map();
  }

  public setProviders(providers: ILyricsProvider[]) {
    this.providers = providers;
  }

  public static getInstance(): LyricsRepository {
    if (!LyricsRepository.instance) {
      LyricsRepository.instance = new LyricsRepository();
    }
    return LyricsRepository.instance;
  }

  /** Clean up artist and track title for matching */
  public cleanQuery(track: string, artist: string): { track: string; artist: string } {
    let cleanArtist = artist
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/\s*VEVO$/i, "")
      .trim();

    let cleanTrack = track
      .replace(
        /\s*[\(\[][^)]*?(official|music|video|audio|lyric|visualizer|remaster|edit|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|mv|m\/v)[^)]*?[\)\]]/gi,
        ""
      )
      .replace(/\s{2,}/g, " ")
      .trim();

    const normalizedTrack = cleanTrack.replace(/[\u2013\u2014]/g, "-");
    const hyphenIndex = normalizedTrack.indexOf(" - ");
    if (hyphenIndex !== -1) {
      const part1 = cleanTrack.substring(0, hyphenIndex).trim();
      const part2 = cleanTrack.substring(hyphenIndex + 3).trim();
      const p1Lower = part1.toLowerCase();
      const aLower = cleanArtist.toLowerCase();

      if (p1Lower.includes(aLower) || aLower.includes(p1Lower)) {
        cleanTrack = part2;
      } else if (aLower === "unknown artist" || aLower === "unknown") {
        cleanTrack = part2;
        cleanArtist = part1;
      } else {
        cleanTrack = part2;
      }
    }

    cleanTrack = cleanTrack.replace(/\s+(feat|ft|with)\.?\s+.*$/gi, "").trim();
    return { track: cleanTrack, artist: cleanArtist };
  }

  public async getLyrics(
    rawTrack: string,
    rawArtist: string,
    album?: string,
    durationSeconds?: number | null,
    signal?: AbortSignal
  ): Promise<UnifiedLyricsResponse> {
    const { track, artist } = this.cleanQuery(rawTrack, rawArtist);
    const cacheKey = `lyrics:${artist.toLowerCase()}:${track.toLowerCase()}`;

    // 1. Check in-memory cache
    const mem = this.memoryCache.get(cacheKey);
    if (mem && mem.expiresAt > Date.now()) {
      return mem.data;
    }

    // 2. Check Redis cache
    if (redisClient) {
      try {
        const cached = await redisClient.get<UnifiedLyricsResponse>(cacheKey);
        if (cached) {
          this.memoryCache.set(cacheKey, { data: cached, expiresAt: Date.now() + 60 * 60_000 });
          return cached;
        }
      } catch {
        // Continue to fetch if Redis fails
      }
    }

    // 3. Request deduplication (reuse in-flight promise for the same song)
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey)!;
    }

    const fetchPromise = this.executeFetch(track, artist, album, durationSeconds, signal, cacheKey);
    this.inFlightRequests.set(cacheKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.inFlightRequests.delete(cacheKey);
    }
  }

  private async executeFetch(
    track: string,
    artist: string,
    album: string | undefined,
    durationSeconds: number | null | undefined,
    signal: AbortSignal | undefined,
    cacheKey: string
  ): Promise<UnifiedLyricsResponse> {
    const query: LyricsQuery = {
      track,
      artist,
      album,
      durationSeconds,
      signal,
    };

    // Concurrently fetch Genius details (for credits, descriptions, writers)
    const geniusPromise = this.geniusProvider.fetchGeniusDetails(track, artist, signal);

    // Query providers in priority order:
    // First candidate that provides "word" sync wins immediately.
    // If only "line" sync is found, we retain it as the best candidate.
    // If only "unsynced" is found, we retain it as fallback.
    let bestResult: LyricsResult | null = null;

    for (const provider of this.providers) {
      if (signal?.aborted) break;
      try {
        const res = await provider.search(query);
        if (!res || !res.success || res.lines.length === 0) continue;

        if (res.syncType === "word") {
          bestResult = res;
          break; // Found word-level sync, stop early
        }

        if (res.syncType === "line" && (!bestResult || bestResult.syncType === "unsynced")) {
          bestResult = res;
        } else if (!bestResult) {
          bestResult = res;
        }
      } catch {
        // Continue with next provider
      }
    }

    // Fall back to Genius plain lyrics if providers failed to return anything
    if (!bestResult) {
      try {
        const geniusLyrics = await this.geniusProvider.search(query);
        if (geniusLyrics && geniusLyrics.lines.length > 0) {
          bestResult = geniusLyrics;
        }
      } catch {
        // Ignore
      }
    }

    const geniusData = await geniusPromise;

    const isSynced = bestResult ? bestResult.syncType === "line" || bestResult.syncType === "word" : false;
    const isWordSynced = bestResult ? bestResult.syncType === "word" : false;

    const response: UnifiedLyricsResponse = {
      success: true,
      lyrics: {
        isSynced,
        isWordSynced,
        syncType: bestResult ? bestResult.syncType : "unsynced",
        content: bestResult?.rawContent ?? null,
        format: bestResult?.format ?? "plain",
        source: bestResult?.source ?? null,
        lines: bestResult?.lines ?? [],
      },
      geniusData,
    };

    // Cache successful results (30 days for synced lyrics, 1 day for unfound)
    const ttlSeconds = isSynced ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    this.memoryCache.set(cacheKey, { data: response, expiresAt: Date.now() + 60 * 60_000 });

    if (redisClient) {
      try {
        await redisClient.set(cacheKey, response, { ex: ttlSeconds });
      } catch {
        // Ignore cache write errors
      }
    }

    return response;
  }
}
