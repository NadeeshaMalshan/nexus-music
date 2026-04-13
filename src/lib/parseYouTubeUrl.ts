import { type Song } from "@/components/echoai/types";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id);
}

/**
 * Returns a YouTube watch / shorts / embed video id and whether it's a music link when `input` is a recognized URL, else null.
 */
export function parseYouTubeWatchUrl(raw: string): { videoId: string; isMusic: boolean; isLive?: boolean } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let urlStr = trimmed;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  let u: URL;
  try {
    u = new URL(urlStr);
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./, "");
  const isMusic = host.includes("music.youtube.com");

  if (!host.endsWith("youtube.com") && !host.endsWith("youtube-nocookie.com") && host !== "youtu.be") {
    return null;
  }

  let videoId: string | null = null;
  let isLive = false;

  if (host === "youtu.be") {
    videoId = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
  } else {
    const v = u.searchParams.get("v");
    if (v && isValidVideoId(v)) {
      videoId = v;
    } else {
      const shortsMatch = u.pathname.match(/^\/shorts\/([A-Za-z0-9_-]{11})(?:\/|$)/);
      if (shortsMatch) videoId = shortsMatch[1];
      else {
        const liveMatch = u.pathname.match(/^\/live\/([A-Za-z0-9_-]{11})(?:\/|$)/);
        if (liveMatch) {
          videoId = liveMatch[1];
          isLive = true;
        } else {
          const vPathMatch = u.pathname.match(/^\/v\/([A-Za-z0-9_-]{11})(?:\/|$)/);
          if (vPathMatch) videoId = vPathMatch[1];
          else {
            const embedMatch = u.pathname.match(/^\/embed\/([A-Za-z0-9_-]{11})(?:\/|$)/);
            if (embedMatch) videoId = embedMatch[1];
          }
        }
      }
    }
  }

  if (videoId && isValidVideoId(videoId)) {
    return { videoId, isMusic, isLive };
  }

  return null;
}

type OembedPayload = {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
};

export async function fetchYouTubeOembedMeta(videoId: string): Promise<OembedPayload | null> {
  const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`;
  try {
    const res = await fetch(oembedUrl);
    if (!res.ok) return null;
    return (await res.json()) as OembedPayload;
  } catch {
    return null;
  }
}

export async function songFromYouTubeVideoId(videoId: string, color: string, preferVideo: boolean = false, isLive: boolean = false): Promise<Song> {
  const meta = await fetchYouTubeOembedMeta(videoId);
  const artwork =
    meta?.thumbnail_url?.trim() || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  return {
    id: videoId,
    title: meta?.title?.trim() || "YouTube",
    artist: (meta?.author_name?.trim() || "Unknown").replace(/\s*-\s*Topic\s*$/i, ""),
    artwork,
    duration: "",
    color,
    isDirectLink: true,
    preferVideoPlayback: preferVideo,
    isLive
  };
}
