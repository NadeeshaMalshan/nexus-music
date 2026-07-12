import { NextRequest, NextResponse } from "next/server";
import { getPipedAudioUrl } from "@/lib/youtubeDirectAudioUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/**
 * Mobile-optimised audio URL resolver.
 *
 * Strategy order:
 * 1. Invidious API → returns URLs proxied through the Invidious server (IP-agnostic)
 * 2. Piped API     → already in getPipedAudioUrl
 *
 * Returns: { url: string } — the audio stream URL the mobile client should load directly.
 */

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://invidious.tiekoetter.com",
  "https://yt.chocolatemoo53.com",
  "https://inv.zoomerville.com",
  "https://invidious.f5.si",
];

async function getInvidiousAudioUrl(videoId: string): Promise<string | null> {
  for (const base of INVIDIOUS_INSTANCES) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 8000);
    try {
      const r = await fetch(
        `${base}/api/v1/videos/${encodeURIComponent(videoId)}?fields=adaptiveFormats,formatStreams`,
        {
          signal: ac.signal,
          headers: { Accept: "application/json", "User-Agent": CHROME_UA },
        }
      );
      clearTimeout(t);

      if (!r.ok) {
        console.warn(`[mobile-audio] Invidious ${base} returned ${r.status}`);
        continue;
      }

      const data = await r.json() as {
        adaptiveFormats?: Array<{ type?: string; url?: string; bitrate?: string }>;
        formatStreams?: Array<{ url?: string }>;
      };

      // Prefer audio-only adaptive formats
      const adaptive = Array.isArray(data.adaptiveFormats) ? data.adaptiveFormats : [];
      const audioOnly = adaptive.filter((f) => f.type?.includes("audio") && f.url);
      if (audioOnly.length > 0) {
        audioOnly.sort((a, b) => (parseInt(b.bitrate ?? "0") || 0) - (parseInt(a.bitrate ?? "0") || 0));
        console.log(`[mobile-audio] Got Invidious audio URL from ${base}`);
        return audioOnly[0].url!;
      }

      // Fall back to combined format streams (audio+video, still playable as audio)
      const formatStreams = Array.isArray(data.formatStreams) ? data.formatStreams : [];
      if (formatStreams.length > 0 && formatStreams[0].url) {
        console.log(`[mobile-audio] Got Invidious formatStream URL from ${base}`);
        return formatStreams[0].url;
      }
    } catch (e) {
      clearTimeout(t);
      console.warn(`[mobile-audio] Invidious ${base} failed:`, e instanceof Error ? e.message : e);
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const videoId = req.nextUrl.searchParams.get("videoId");
  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  console.log(`[mobile-audio] Resolving audio for videoId: ${videoId}`);

  // 1. Try Invidious
  let url = await getInvidiousAudioUrl(videoId);

  // 2. Fall back to Piped
  if (!url) {
    console.log(`[mobile-audio] Invidious failed, trying Piped...`);
    url = await getPipedAudioUrl(videoId);
  }

  if (!url) {
    return NextResponse.json(
      { error: "Unable to resolve audio URL", videoId },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { url },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
