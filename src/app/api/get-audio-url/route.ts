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

  if (!videoId || videoId === "undefined" || videoId === "null") {
    return NextResponse.json({ error: "Invalid or missing videoId" }, { status: 400 });
  }

  console.log(`[get-audio-url] videoId: ${videoId}`);
  const url = await getYoutubeDirectAudioUrl(videoId);

  if (!url) {
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: "ytdl and play-dl both failed" },
      { status: 500 }
    );
  }

  console.log(`[get-audio-url] OK (len ${url.length})`);
  return NextResponse.json({ url });
}
