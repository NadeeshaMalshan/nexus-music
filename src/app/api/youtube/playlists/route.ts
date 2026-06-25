import { fetchUserPlaylists } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
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
    const playlists = await fetchUserPlaylists(accessToken);

    // 3. Cache fresh result in Redis, but preserve any locally-pending playlists
    if (email && redis) {
      const cacheKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
      const existingStr = await redis.get(cacheKey);
      let existing: any[] = [];
      if (typeof existingStr === "string") {
        try { existing = JSON.parse(existingStr); } catch {}
      } else if (Array.isArray(existingStr)) {
        existing = existingStr;
      }

      // Keep any pending (offline-created) playlists that aren't on YT yet
      const pendingPlaylists = existing.filter((p: any) => p.pending === true);

      // Merge: YT playlists first, then pending ones at top
      const merged = [...pendingPlaylists, ...playlists];
      await redis.set(cacheKey, JSON.stringify(merged));

      return NextResponse.json(merged);
    }

    return NextResponse.json(playlists);
  } catch (error) {
    if (error instanceof YouTubeQuotaError) {
      // 4. Quota exceeded: serve from Redis cache
      if (email && redis) {
        const cacheKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
        const cached = await redis.get(cacheKey);
        let cachedData: any[] = [];
        if (typeof cached === "string") {
          try { cachedData = JSON.parse(cached); } catch {}
        } else if (Array.isArray(cached)) {
          cachedData = cached;
        }

        if (cachedData.length > 0) {
          console.log(`[playlists] Serving ${cachedData.length} playlists from Redis cache (quota exceeded)`);
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
    console.error("Error fetching YouTube playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
