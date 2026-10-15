import { Redis } from "@upstash/redis";
import { ILyricsProvider, LyricsQuery, LyricsResult } from "./types";
import { isTitleMatch } from "./matchUtils";
import {
  BetterLyricsProvider,
  BiniLyricsProvider,
  GeniusMetadata,
  GeniusProvider,
  KuGouProvider,
  LrcLibProvider,
  LrcRedProvider,
  LyricsOvhProvider,
  LyricsPlusProvider,
  MegalobizProvider,
  PaxSenixProvider,
  SimpMusicProvider,
  UnisonProvider,
} from "./providers";

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
  track?: string;
  artist?: string;
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
  private isCustomProviders: boolean;
  private geniusProvider: GeniusProvider;
  private inFlightRequests: Map<string, Promise<UnifiedLyricsResponse>>;
  private memoryCache: Map<string, { data: UnifiedLyricsResponse; expiresAt: number }>;

  public constructor(providers?: ILyricsProvider[], geniusProvider?: GeniusProvider) {
    this.isCustomProviders = Boolean(providers);
    this.providers = providers || [
      // 1. Primary Word-Sync Providers (TTML word timing, richsync, syllable karaoke)
      new BetterLyricsProvider(),
      new LrcRedProvider(),
      new BiniLyricsProvider(),
      new LyricsPlusProvider(),
      new PaxSenixProvider(),
      new UnisonProvider(),
      new KuGouProvider(),

      // 2. Line-Sync Providers
      new LrcLibProvider(),
      new MegalobizProvider(),
      new SimpMusicProvider(),

      // 3. Plain Text Fallback
      new LyricsOvhProvider(),
    ];
    this.geniusProvider = geniusProvider || new GeniusProvider();
    this.inFlightRequests = new Map();
    this.memoryCache = new Map();
  }

  public setProviders(providers: ILyricsProvider[]) {
    this.providers = providers;
    this.isCustomProviders = true;
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
      if (mem.data.track && !isTitleMatch(track, mem.data.track)) {
        this.memoryCache.delete(cacheKey);
      } else {
        return mem.data;
      }
    }

    // 2. Check Redis cache
    if (redisClient) {
      try {
        const cached = await redisClient.get<UnifiedLyricsResponse>(cacheKey);
        if (cached) {
          if (cached.track && !isTitleMatch(track, cached.track)) {
            // Invalidate stale mismatched cached item
          } else {
            this.memoryCache.set(cacheKey, { data: cached, expiresAt: Date.now() + 60 * 60_000 });
            return cached;
          }
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

    // Query helper for a single provider
    const queryProvider = async (provider: ILyricsProvider): Promise<LyricsResult | null> => {
      if (signal?.aborted) return null;
      try {
        const timeoutSignal = AbortSignal.timeout(4500);
        const combinedSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
        const res = await provider.search({ ...query, signal: combinedSignal });
        if (res && res.success && res.lines && res.lines.length > 0) {
          // Reject lyrics if the returned title is for a completely different song
          if (res.metadata?.title && !isTitleMatch(query.track, res.metadata.title)) {
            console.warn(
              `[LyricsRepository] Rejecting mismatched lyrics from ${provider.name}: expected "${query.track}", got "${res.metadata.title}"`
            );
            return null;
          }
          return res;
        }
        return null;
      } catch {
        return null;
      }
    };

    let bestResult: LyricsResult | null = null;

    if (this.isCustomProviders) {
      // Custom providers (e.g. in test suites) - evaluate sequentially with word-sync priority
      for (const provider of this.providers) {
        if (signal?.aborted) break;
        const res = await queryProvider(provider);
        if (!res) continue;

        if (res.syncType === "word") {
          bestResult = res;
          break; // Found word-level sync, highest priority, stop early
        }

        if (res.syncType === "line" && (!bestResult || bestResult.syncType === "unsynced")) {
          bestResult = res;
        } else if (!bestResult) {
          bestResult = res;
        }
      }
    } else {
      // Default Multi-Provider Staged Pipeline
      // STAGE 1: Top Word-Sync Candidates (Fastest Richsync/TTML Providers)
      const stage1Providers = [
        this.providers[0], // BetterLyrics
        this.providers[1], // lrc.red
        this.providers[3], // LyricsPlus
      ].filter(Boolean);

      const stage1Results = await Promise.all(stage1Providers.map(queryProvider));

      // Check if any Stage 1 provider gave word sync
      for (const res of stage1Results) {
        if (res && res.syncType === "word") {
          bestResult = res;
          break;
        }
        if (res && res.syncType === "line" && (!bestResult || bestResult.syncType === "unsynced")) {
          bestResult = res;
        }
      }

      // STAGE 2: Secondary Word-Sync Candidates (PaxSenix, Unison, KuGou, BiniLyrics)
      if (!bestResult || bestResult.syncType !== "word") {
        if (!signal?.aborted) {
          const stage2Providers = [
            this.providers[4], // PaxSenix
            this.providers[5], // Unison
            this.providers[6], // KuGou
            this.providers[2], // BiniLyrics
          ].filter(Boolean);

          const stage2Results = await Promise.all(stage2Providers.map(queryProvider));

          for (const res of stage2Results) {
            if (res && res.syncType === "word") {
              bestResult = res; // Word sync wins immediately!
              break;
            }
            if (res && res.syncType === "line" && (!bestResult || bestResult.syncType === "unsynced")) {
              bestResult = res;
            }
          }
        }
      }

      // STAGE 3: Line-Sync Candidates (LRCLIB, Megalobiz, SimpMusic)
      // Only needed if no word-sync was found and we don't yet have high confidence line-sync
      if (!bestResult && !signal?.aborted) {
        const stage3Providers = [
          this.providers[7], // LRCLIB
          this.providers[8], // Megalobiz
          this.providers[9], // SimpMusic
        ].filter(Boolean);

        const stage3Results = await Promise.all(stage3Providers.map(queryProvider));

        for (const res of stage3Results) {
          if (res && (res.syncType === "word" || res.syncType === "line")) {
            bestResult = res;
            break;
          }
        }
      }

      // STAGE 4: Plain Text Fallbacks
      if (!bestResult && !signal?.aborted) {
        const plainProvider = this.providers[10]; // LyricsOvh
        if (plainProvider) {
          bestResult = await queryProvider(plainProvider);
        }
      }
    }

    // Fall back to Genius plain lyrics if providers failed to return anything
    if (!bestResult && !signal?.aborted) {
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
      track: bestResult?.metadata?.title || track,
      artist: bestResult?.metadata?.artist || artist,
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
