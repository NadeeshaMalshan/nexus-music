import { NextResponse } from "next/server";

import { resolveAudioUrlWithFallback } from "@/lib/youtubeDirectAudioUrl";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Returns a direct CDN URL for clients that need a string (e.g. some web players).
 * Extraction uses ytdl-core, play-dl, and automatic alternative resolution if videoId is dead/blocked.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId") || searchParams.get("id");
  const isLive = searchParams.get("isLive") === "true";
  const title = searchParams.get("title")?.trim() || undefined;
  const artist = searchParams.get("artist")?.trim() || undefined;
  const allowFallback = searchParams.get("fallback") === "true";

  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  console.log(`[get-audio-url] Requesting direct URL. videoId: ${videoId}, isLive: ${isLive}, fallback: ${allowFallback}, title: "${title || ''}", artist: "${artist || ''}".`);
  const result = await resolveAudioUrlWithFallback(videoId, isLive, title, artist, allowFallback);

  if (!result || (!result.url && !result.isAlternative)) {
    return NextResponse.json(
      { error: "Direct stream not available" },
      { status: 404 }
    );
  }

  console.log(`[get-audio-url] OK (resolved: ${result.resolvedVideoId}, isAlt: ${result.isAlternative}, len ${result.url?.length || 0})`);
  return NextResponse.json(
    { url: result.url || undefined, resolvedVideoId: result.resolvedVideoId, isAlternative: result.isAlternative },
    {
      headers: {
        "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=600",
      },
    }
  );
}
