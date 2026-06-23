import { NextResponse } from "next/server";

import { getYoutubeDirectAudioUrl } from "@/lib/youtubeDirectAudioUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Returns a direct CDN URL for clients that need a string (e.g. some web players).
 * Extraction uses ytdl-core, then play-dl, then Piped API — see `getYoutubeDirectAudioUrl`.
 *
 * On serverless (Vercel) environments ytdl-core often fails due to IP blocks from YouTube.
 * In that case the Piped API returns a googlevideo URL which can be served directly
 * as browsers can play them. We return it as-is and also expose a /api/audio/proxy
 * fallback endpoint for cases where direct CDN serving fails.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId") || searchParams.get("id");
  const isLive = searchParams.get("isLive") === "true";

  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  console.log(`[get-audio-url] videoId: ${videoId}, isLive: ${isLive}`);
  const url = await getYoutubeDirectAudioUrl(videoId, isLive);

  if (!url) {
    // Final fallback: return proxy URL which will stream via server
    const proxyUrl = `/api/audio/stream?videoId=${videoId}`;
    console.log(`[get-audio-url] All extraction methods failed, returning proxy: ${proxyUrl}`);
    return NextResponse.json({ url: proxyUrl, source: "proxy" });
  }

  // If the URL is a direct googlevideo CDN url, it is IP-locked to Vercel's IP.
  // The client's browser will fail to stream it (plays 1 sec then 403 Forbidden).
  // So we must force these to use the proxy.
  if (url.includes("googlevideo.com")) {
    const proxyUrl = `/api/audio/stream?videoId=${videoId}`;
    console.log(`[get-audio-url] googlevideo URL detected, forcing proxy: ${proxyUrl}`);
    return NextResponse.json({ url: proxyUrl, source: "proxy_forced" });
  }

  console.log(`[get-audio-url] OK (len ${url.length})`);
  return NextResponse.json({ url });
}
