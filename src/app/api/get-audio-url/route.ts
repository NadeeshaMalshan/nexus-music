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

  console.log(`[get-audio-url] Requesting direct URL. videoId: ${videoId}, isLive: ${isLive}.`);
  const url = await getYoutubeDirectAudioUrl(videoId, isLive);

  if (!url) {
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: "Extraction failed" },
      { status: 500 }
    );
  }

  console.log(`[get-audio-url] OK (len ${url.length})`);
  return NextResponse.json(
    { url },
    {
      headers: {
        "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=600",
      },
    }
  );
}
