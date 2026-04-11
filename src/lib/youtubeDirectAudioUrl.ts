import { chooseFormat, getInfo } from "@distube/ytdl-core";
import type ytdl from "@distube/ytdl-core";
import play from "play-dl";

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
export async function getYoutubeDirectAudioUrl(videoId: string): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const info = await getYoutubeInfoWithRetry(videoUrl);
    const url = pickFormatUrl(info.formats);
    if (url) return url;
  } catch {
    /* all ytdl strategies failed or unusable */
  }

  try {
    const stream = await play.stream(videoUrl, { quality: 2 });
    const url =
      stream && typeof stream === "object" && stream !== null && "url" in stream
        ? String((stream as unknown as { url: string }).url)
        : "";
    if (url) return url;
  } catch (e) {
    console.warn("[youtubeDirectAudioUrl] play-dl:", e instanceof Error ? e.message : e);
  }

  return null;
}
