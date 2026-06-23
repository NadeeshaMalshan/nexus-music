import { NextResponse } from "next/server";

import { getYoutubeDirectAudioUrl } from "@/lib/youtubeDirectAudioUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Returns a direct CDN URL for clients that need a string (e.g. some web players).
 * Extraction uses ytdl-core, then play-dl — see `getYoutubeDirectAudioUrl`.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId") || searchParams.get("id");
  const isLive = searchParams.get("isLive") === "true";

  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  const title = searchParams.get("title");
  const artist = searchParams.get("artist");

  console.log(`[get-audio-url] videoId: ${videoId}, isLive: ${isLive}`);
  let url = await getYoutubeDirectAudioUrl(videoId, isLive);

  // Vercel Block Fallback
  if (!url && title && artist && !isLive) {
    try {
      console.log(`[get-audio-url] Blocked. Falling back to Topic for: ${title} - ${artist}`);
      const { searchSongsRobust } = await import("@/lib/ytmSearchService");
      const searchResults = await searchSongsRobust(`${title} ${artist} Topic`);
      const topicVideo = searchResults.find((r: any) => r.youtubeId && r.youtubeId !== videoId);
      if (topicVideo?.youtubeId) {
        console.log(`[get-audio-url] Found Topic fallback videoId: ${topicVideo.youtubeId}`);
        url = await getYoutubeDirectAudioUrl(topicVideo.youtubeId, false);
      }
    } catch (e) {
      console.error("[get-audio-url] Topic fallback failed", e);
    }
  }

  if (!url) {
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: "ytdl and play-dl both failed" },
      { status: 500 }
    );
  }

  console.log(`[get-audio-url] OK (len ${url.length})`);
  return NextResponse.json({ url });
}
