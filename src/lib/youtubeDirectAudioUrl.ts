import { chooseFormat, getInfo } from "@distube/ytdl-core";
import type ytdl from "@distube/ytdl-core";
import play from "play-dl";
import redis from "./redis";

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
      return await getInfo(videoUrl, getYtdlSharedOptions(clients));
    } catch (e) {
      last = e;
    }
  }
  console.warn("[youtubeDirectAudioUrl] getInfo (all clients):", last instanceof Error ? last.message : last);
  throw last instanceof Error ? last : new Error(String(last));
}

/**
 * Best-effort direct googlevideo URL for a YouTube video. Tries @distube/ytdl-core with
 * several player-client orders, then play-dl (often succeeds when ytdl fails on serverless).
 */
export async function getYoutubeDirectAudioUrl(videoId: string, isLive: boolean = false): Promise<string | null> {
  const cacheKey = `audiourl:${videoId}:${isLive}`;

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached) {
        console.log(`[youtubeDirectAudioUrl] Serving cached URL for ${videoId} from Redis`);
        return cached;
      }
    } catch (err) {
      console.error("[youtubeDirectAudioUrl] Redis read error:", err);
    }
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
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
      const stream = await play.stream(videoUrl, { quality: isLive ? 0 : 2 });
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
    const piped = await getPipedAudioUrl(videoId);
    if (piped) resolvedUrl = piped;
  }

  if (resolvedUrl && redis) {
    try {
      // Cache for 2 hours (7200 seconds)
      await redis.set(cacheKey, resolvedUrl, { ex: 7200 });
      console.log(`[youtubeDirectAudioUrl] Saved URL for ${videoId} to Redis cache`);
    } catch (err) {
      console.error("[youtubeDirectAudioUrl] Redis write error:", err);
    }
  }

  return resolvedUrl;
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
  if (raw?.toLowerCase() === "off" || raw === "0") return null;

  const bases = raw
    ? [raw.replace(/\/+$/, "")]
    : [
        "https://api.piped.private.coffee",
        "https://pipedapi.adminforge.de",
        "https://pipedapi.leptons.xyz",
        "https://piped-api.privacy.com.de",
        "https://pipedapi.nosebs.ru",
        "https://pipedapi.kavin.rocks",
        "https://pipedapi-libre.kavin.rocks",
        "https://api.piped.yt"
      ];

  for (const base of bases) {
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 3500); // 3.5s timeout per instance
      const r = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        signal: ac.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": CHROME_UA,
        },
      });
      clearTimeout(t);

      if (!r.ok) {
        console.warn("[youtubeDirectAudioUrl] Piped HTTP instance failed:", base, r.status);
        continue;
      }

      const data = (await r.json()) as any;
      // Fallback to videoStreams if audioStreams is empty (expo-av can play audio from combined video streams)
      const streams = (Array.isArray(data.audioStreams) && data.audioStreams.length > 0)
        ? data.audioStreams
        : (data.videoStreams || []);
      if (!Array.isArray(streams) || streams.length === 0) continue;

      const withUrl = streams.filter((s: any): s is { url: string; bitrate?: number } => typeof s.url === "string" && s.url.length > 0);
      if (withUrl.length === 0) continue;

      withUrl.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));
      return withUrl[0].url;
    } catch (e) {
      console.warn("[youtubeDirectAudioUrl] Piped instance failed/timed out:", base, e instanceof Error ? e.message : e);
    }
  }
  return null;
}
