import { chooseFormat, getInfo } from "@distube/ytdl-core";
import type ytdl from "@distube/ytdl-core";
import play from "play-dl";
import redis from "./redis";
import { searchSongsRobust } from "./ytmSearchService";
import { isTitleMatch, isArtistMatch } from "./lyrics/matchUtils";

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

type PlayerClients = NonNullable<Parameters<typeof getInfo>[1]>["playerClients"];

/** Optional Netscape-format cookie string from env (helps with bot checks on serverless IPs). */
function cookieHeader(): Record<string, string> {
  const raw = process.env.YOUTUBE_COOKIE?.trim();
  if (!raw) return {};
  return { Cookie: raw };
}

function baseRequestOptions() {
  return {
    headers: {
      "User-Agent": CHROME_UA,
      "Accept-Language": "en-US,en;q=0.9",
      ...cookieHeader(),
    },
  };
}

/**
 * Options passed to `getInfo` / `downloadFromInfo` so extraction behaves the same on
 * `/api/get-audio-url`, `/api/audio/stream`, and any future callers.
 */
export function getYtdlSharedOptions(playerClients?: PlayerClients) {
  const opts: Parameters<typeof getInfo>[1] = {
    requestOptions: baseRequestOptions(),
  };
  if (playerClients?.length) opts.playerClients = playerClients;
  return opts;
}

function pickFormatUrl(formats: ytdl.videoFormat[]): string | null {
  if (!formats?.length) return null;

  const tryChoose = (opts: ytdl.chooseFormatOptions) => {
    try {
      const f = chooseFormat(formats, opts);
      if (f?.url) return f.url;
    } catch {
      /* next */
    }
    return null;
  };

  return (
    tryChoose({ quality: "highestaudio", filter: "audioonly" }) ||
    tryChoose({ quality: "highestaudio", filter: "audio" }) ||
    (() => {
      const sorted = [...formats].filter((f) => f?.url && f.hasAudio);
      sorted.sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));
      return sorted[0]?.url ?? null;
    })()
  );
}

const CLIENT_STRATEGIES: (PlayerClients | undefined)[] = [
  undefined,
  ["ANDROID", "IOS", "WEB", "WEB_EMBEDDED", "TV"],
  ["IOS", "ANDROID", "TV"],
  ["WEB", "ANDROID", "IOS"],
];

/**
 * Same multi-client retries as {@link getYoutubeDirectAudioUrl}, for routes that need full
 * `videoInfo` (e.g. `downloadFromInfo`).
 */
export async function getYoutubeInfoWithRetry(videoUrl: string) {
  let last: unknown;
  for (const clients of CLIENT_STRATEGIES) {
    try {
      const getInfoPromise = getInfo(videoUrl, getYtdlSharedOptions(clients));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ytdl getInfo timeout")), 4000)
      );
      return await Promise.race([getInfoPromise, timeoutPromise]);
    } catch (e) {
      last = e;
    }
  }
  console.warn("[youtubeDirectAudioUrl] getInfo (all clients):", last instanceof Error ? last.message : last);
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * Result of resolving an audio stream or URL, possibly using an alternative video ID
 * if the requested one was unavailable or geo-blocked.
 */
export interface AudioResolutionResult {
  url: string;
  resolvedVideoId: string;
  isAlternative: boolean;
}

/**
 * Searches for a working alternative YouTube video ID for a song when the original ID
 * is deleted, unavailable, or geo-blocked.
 */
export async function findAlternativeVideoId(
  title: string,
  artist?: string,
  brokenVideoId?: string
): Promise<string | null> {
  const cleanTitle = (title || "").trim();
  const cleanArtist = (artist || "").replace(/\s*-\s*Topic\s*$/i, "").trim();
  if (!cleanTitle) return null;

  // 1. Check Redis for previously resolved verified mapping (v3 namespace to avoid poisoned legacy cache)
  if (brokenVideoId && redis) {
    try {
      const cached = await redis.get<string>(`resolved_videoid_v3:${brokenVideoId}`);
      if (cached && cached !== brokenVideoId) {
        console.log(`[youtubeDirectAudioUrl] Serving cached alternative ID for ${brokenVideoId}: ${cached}`);
        return cached;
      }
    } catch (e) {
      console.warn("[youtubeDirectAudioUrl] Redis read error for resolved_videoid_v3:", e);
    }
  }

  // 2. Search YouTube Music for the track
  try {
    const query = cleanArtist ? `${cleanArtist} ${cleanTitle}` : cleanTitle;
    const results = await searchSongsRobust(query);
    if (results && results.length > 0) {
      for (const item of results) {
        const id = item.youtubeId?.trim();
        if (!id || id === brokenVideoId) continue;

        const itemTitle = item.title || "";
        // Strict title match required - never do loose substring matches
        if (!isTitleMatch(cleanTitle, itemTitle)) continue;

        // If artist is known, candidate must match the artist
        if (cleanArtist) {
          const itemArtist =
            item.artist ||
            item.artists?.map((a: any) => a.name).filter(Boolean).join(", ") ||
            "";
          if (itemArtist && !isArtistMatch(cleanArtist, itemArtist)) {
            continue;
          }
        }

        console.log(
          `[youtubeDirectAudioUrl] Resolved verified alternative ID for "${cleanTitle}" by "${cleanArtist}" (${brokenVideoId}) -> ${id} ("${itemTitle}")`
        );
        if (brokenVideoId && redis) {
          try {
            await redis.set(`resolved_videoid_v3:${brokenVideoId}`, id, { ex: 604800 });
          } catch (err) {
            console.warn("[youtubeDirectAudioUrl] Redis write error for resolved_videoid_v3:", err);
          }
        }
        return id;
      }
    }
  } catch (err) {
    console.warn("[youtubeDirectAudioUrl] findAlternativeVideoId error:", err);
  }

  return null;
}

/**
 * Best-effort direct googlevideo URL for a YouTube video. Tries @distube/ytdl-core with
 * several player-client orders, then play-dl (often succeeds when ytdl fails on serverless).
 * If title is provided and video extraction fails, attempts fallback resolution.
 */
export async function getYoutubeDirectAudioUrl(
  videoId: string,
  isLive: boolean = false
): Promise<string | null> {
  const cleanId = (videoId || "").trim();
  if (!cleanId || !/^[a-zA-Z0-9_-]{11}$/.test(cleanId)) {
    return null;
  }

  const cacheKey = `audiourl:${cleanId}:${isLive}`;

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        console.log(`[youtubeDirectAudioUrl] Serving cached URL for ${cleanId} from Redis`);
        return cached;
      }
    } catch (err) {
      console.error("[youtubeDirectAudioUrl] Redis read error:", err);
    }
  }

  const videoUrl = `https://www.youtube.com/watch?v=${cleanId}`;
  let resolvedUrl: string | null = null;

  try {
    const info = await getYoutubeInfoWithRetry(videoUrl);
    // If live, we might want to be more careful with format selection, but ytdl-core's highestaudio
    // for live often points to an HLS stream which is fine.
    const url = pickFormatUrl(info.formats);
    if (url) resolvedUrl = url;
  } catch {
    /* all ytdl strategies failed or unusable */
  }

  if (!resolvedUrl) {
    try {
      // For live streams in music mode, we use lowest quality to save data
      const playPromise = play.stream(videoUrl, { quality: isLive ? 0 : 2 });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
      const stream = await Promise.race([playPromise, timeoutPromise]);
      const url =
        stream && typeof stream === "object" && stream !== null && "url" in stream
          ? String((stream as unknown as { url: string }).url)
          : "";
      if (url) resolvedUrl = url;
    } catch (e) {
      console.warn("[youtubeDirectAudioUrl] play-dl:", e instanceof Error ? e.message : e);
    }
  }

  if (!resolvedUrl) {
    const piped = await getPipedAudioUrl(cleanId);
    if (piped) resolvedUrl = piped;
  }

  if (resolvedUrl && redis) {
    try {
      // Cache for 2 hours (7200 seconds)
      await redis.set(cacheKey, resolvedUrl, { ex: 7200 });
      console.log(`[youtubeDirectAudioUrl] Saved URL for ${cleanId} to Redis cache`);
    } catch (err) {
      console.error("[youtubeDirectAudioUrl] Redis write error:", err);
    }
  }

  return resolvedUrl;
}

/**
 * Resolves an audio URL with full metadata about the resolved video ID.
 * When allowFallback is true (e.g. YouTube player reported a playback error), searches for
 * an alternative working video ID with strict title + artist verification.
 */
export async function resolveAudioUrlWithFallback(
  videoId: string,
  isLive: boolean = false,
  title?: string,
  artist?: string,
  allowFallback: boolean = false
): Promise<AudioResolutionResult | null> {
  // 1. Attempt extraction of the exact target videoId first
  const directUrl = await getYoutubeDirectAudioUrl(videoId, isLive);
  if (directUrl) {
    return {
      url: directUrl,
      resolvedVideoId: videoId,
      isAlternative: false,
    };
  }

  // 2. Only if explicit fallback is allowed (e.g. client reported player error),
  // search for a verified alternative video ID.
  if (allowFallback && title) {
    console.log(
      `[youtubeDirectAudioUrl] Direct extraction failed for ${videoId}. Searching verified alternative for "${title}" (${artist || 'unknown'})...`
    );
    const alternativeId = await findAlternativeVideoId(title, artist, videoId);
    if (alternativeId && alternativeId !== videoId) {
      const altUrl = await getYoutubeDirectAudioUrl(alternativeId, isLive);
      return {
        url: altUrl || "",
        resolvedVideoId: alternativeId,
        isAlternative: true,
      };
    }
  }

  return null;
}

type PipedStreamsResponse = { audioStreams?: Array<{ url?: string; bitrate?: number; mimeType?: string }> };

/**
 * Last-resort public metadata API (returns direct audio URLs). Works when ytdl/play-dl fail on
 * serverless IPs. Set `PIPED_API_BASE_URL` to a Piped instance (default below), or `off` to skip.
 *
 * @see https://github.com/TeamPiped/Piped/wiki/Instances
 */
export async function getPipedAudioUrl(videoId: string): Promise<string | null> {
  const raw = process.env.PIPED_API_BASE_URL?.trim();
  if (raw?.toLowerCase() === "off" || raw === "0" || !raw) return null;

  const base = raw.replace(/\/+$/, "");

  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3_000);
    const r = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
      signal: ac.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": CHROME_UA,
      },
    });
    clearTimeout(t);

    if (!r.ok) {
      console.warn("[youtubeDirectAudioUrl] Piped HTTP", r.status);
      return null;
    }

    const data = (await r.json()) as PipedStreamsResponse;
    const streams = data.audioStreams;
    if (!Array.isArray(streams) || streams.length === 0) return null;

    const withUrl = streams.filter((s): s is typeof s & { url: string } => typeof s.url === "string" && s.url.length > 0);
    if (withUrl.length === 0) return null;

    withUrl.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
    return withUrl[0].url;
  } catch (e) {
    console.warn("[youtubeDirectAudioUrl] Piped:", e instanceof Error ? e.message : e);
    return null;
  }
}
