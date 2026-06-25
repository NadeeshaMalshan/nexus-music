import { NextResponse } from "next/server";
import { fetchLikedSongs } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { YouTubeQuotaError } from "@/lib/youtubeApiErrors";
import { resolveUserEmail, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";
import { processSyncQueue } from "@/lib/youtubeSync";
import redis from "@/lib/redis";

export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await resolveUserEmail(req);

  // 1. First, try to flush any pending offline actions (sync queue)
  if (email) {
    try {
      await processSyncQueue(email, accessToken);
    } catch {
      // Sync queue processing is best-effort, don't block the main request
    }
  }

  try {
    // 2. Fetch fresh data from YouTube
    const tracks = await fetchLikedSongs(accessToken);

    // 3. Cache the fresh result in Redis
    if (email && redis) {
      const cacheKey = `${LIBRARY_KEY_PREFIX}:liked:${email}`;
      await redis.set(cacheKey, JSON.stringify(tracks));
    }

    return NextResponse.json(tracks);
  } catch (error) {
    if (error instanceof YouTubeQuotaError) {
      // 4. Quota exceeded: serve from Redis cache
      if (email && redis) {
        const cacheKey = `${LIBRARY_KEY_PREFIX}:liked:${email}`;
        const cached = await redis.get(cacheKey);
        let cachedData: any[] = [];
        if (typeof cached === "string") {
          try { cachedData = JSON.parse(cached); } catch {}
        } else if (Array.isArray(cached)) {
          cachedData = cached;
        }

        if (cachedData.length > 0) {
          console.log(`[liked] Serving ${cachedData.length} songs from Redis cache (quota exceeded)`);
          return NextResponse.json(cachedData, {
            headers: { "X-Served-From-Cache": "true" },
          });
        }
      }

      return NextResponse.json(
        {
          error: "quotaExceeded",
          message:
            "YouTube Data API daily quota is used up. It resets at midnight Pacific Time, or raise quota in Google Cloud Console.",
        },
        { status: 503 }
      );
    }
    console.error("API Fetch Liked Songs Error:", error);
    return NextResponse.json({ error: "Failed to fetch liked songs" }, { status: 500 });
  }
}
