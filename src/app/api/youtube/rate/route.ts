import { NextResponse } from "next/server";
import { rateVideo } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { addPendingAction, resolveUserEmail, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";
import redis from "@/lib/redis";

export async function POST(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await resolveUserEmail(req);

  const { videoId, rating, track } = (await req.json()) as { videoId: string; rating: "like" | "none", track?: any };

  if (!videoId || !["like", "none"].includes(rating)) {
    return NextResponse.json({ error: "Invalid videoId or rating" }, { status: 400 });
  }

  try {
    await rateVideo(accessToken, videoId, rating);
    
    // Update local DB since it succeeded
    if (email && redis && track) {
      const likedKey = `${LIBRARY_KEY_PREFIX}:liked:${email}`;
      const existingLikedStr = await redis.get(likedKey);
      let existingLiked: any[] = [];
      if (typeof existingLikedStr === "string") {
        try { existingLiked = JSON.parse(existingLikedStr); } catch {}
      } else if (Array.isArray(existingLikedStr)) {
        existingLiked = existingLikedStr;
      }

      if (rating === "like") {
        if (!existingLiked.find((s: any) => (s.videoId || s.id) === videoId)) {
          existingLiked.push(track);
          await redis.set(likedKey, JSON.stringify(existingLiked));
        }
      } else {
        existingLiked = existingLiked.filter((s: any) => (s.videoId || s.id) !== videoId);
        await redis.set(likedKey, JSON.stringify(existingLiked));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API Rate Video Error:", error);

    // Save to pending queue (so it syncs later) and return success with pendingSync: true
    if (email && redis) {
      try {
        await addPendingAction(email, {
          type: rating === "like" ? "LIKE_SONG" : "UNLIKE_SONG",
          data: { videoId, track }
        });
        
        // Also update local DB so the UI stays liked immediately in the app!
        if (track) {
          const likedKey = `${LIBRARY_KEY_PREFIX}:liked:${email}`;
          const existingLikedStr = await redis.get(likedKey);
          let existingLiked: any[] = [];
          if (typeof existingLikedStr === "string") {
            try { existingLiked = JSON.parse(existingLikedStr); } catch {}
          } else if (Array.isArray(existingLikedStr)) {
            existingLiked = existingLikedStr;
          }

          if (rating === "like") {
            if (!existingLiked.find((s: any) => (s.videoId || s.id) === videoId)) {
              existingLiked.push(track);
              await redis.set(likedKey, JSON.stringify(existingLiked));
            }
          } else {
            existingLiked = existingLiked.filter((s: any) => (s.videoId || s.id) !== videoId);
            await redis.set(likedKey, JSON.stringify(existingLiked));
          }
        }

        console.log(`[Rate API] Queued pending action for ${videoId} (${rating})`);
        return NextResponse.json({ success: true, pendingSync: true });
      } catch (queueErr) {
        console.error("Failed to queue pending action:", queueErr);
      }
    }

    return NextResponse.json({ error: "Failed to rate video. Please try again later." }, { status: 500 });
  }
}
