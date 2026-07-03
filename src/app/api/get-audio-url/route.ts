import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { getYoutubeDirectAudioUrl } from "@/lib/youtubeDirectAudioUrl";

const redis = Redis.fromEnv();

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

  const cacheKey = `audiourl:${videoId}:${isLive}`;

  try {
    const cachedUrl = await redis.get<string>(cacheKey);
    if (cachedUrl) {
      console.log(`[get-audio-url] Serving cached URL for ${videoId} from Redis`);
      return NextResponse.json(
        { url: cachedUrl },
        {
          headers: {
            "Cache-Control": "public, max-age=7200, s-maxage=7200, stale-while-revalidate=600",
          },
        }
      );
    }
  } catch (err) {
    console.error("[get-audio-url] Redis read error:", err);
  }

  console.log(`[get-audio-url] Cache miss. videoId: ${videoId}, isLive: ${isLive}. Extracting...`);
  const url = await getYoutubeDirectAudioUrl(videoId, isLive);

  if (!url) {
    return NextResponse.json(
      { error: "Failed to extract audio URL", details: "ytdl and play-dl both failed" },
      { status: 500 }
    );
  }

  try {
    // Cache for 2 hours (7200 seconds)
    await redis.set(cacheKey, url, { ex: 7200 });
    console.log(`[get-audio-url] Saved ${videoId} URL to Redis cache`);
  } catch (err) {
    console.error("[get-audio-url] Redis write error:", err);
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
