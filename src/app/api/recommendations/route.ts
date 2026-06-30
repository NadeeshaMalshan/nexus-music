import { NextResponse } from "next/server";
import { fetchRecentMusicActivities } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";
import { searchSongsRobust } from "@/lib/ytmSearchService";

export const dynamic = "force-dynamic";

/**
 * POST /api/recommendations
 * Routes to the Python AI Backend deployed on Hugging Face Spaces or fetches related tracks locally.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { prompt, recentTrackId } = body;

  try {
    if (recentTrackId) {
      console.log(`[Next.js API] Fetching related tracks for: ${recentTrackId}`);
      const related = await getRelatedTracksRobust(recentTrackId);
      const recommendations = related.map((t: any) => ({
        youtubeId: t.youtubeId,
        title: t.title,
        artist: t.artist,
        thumbnail: t.thumbnail || t.thumbnailUrl,
        duration: t.duration,
        reason: "Related to playing track"
      }));
      return NextResponse.json({
        title: "More songs like current song",
        description: "Recommended tracks similar to the current song",
        cover_url: recommendations[0]?.thumbnail || "",
        recommendations
      });
    }

    const accessToken = await getRequestAccessToken(request);
    let rawHistory: any[] = [];
    
    // 1. Fetch user's raw music history from YouTube API
    if (accessToken) {
      try {
        rawHistory = await fetchRecentMusicActivities(accessToken, 50);
      } catch (e) {
        console.warn("[Next.js] Failed to fetch YT activities:", e);
      }
    }

    // 2. Call the Hugging Face Space backend
    const backendBaseUrl = process.env.PYTHON_AI_BACKEND_URL || "https://nadeeshamalshan-nexusai.hf.space";
    const pythonEndpoint = `${backendBaseUrl}/api/recommendations`;

    console.log(`[Next.js API] Calling Python AI Backend at: ${pythonEndpoint}`);

    const pythonRes = await fetch(pythonEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: "default_user", // Replace with session user ID if available
        prompt: prompt || "Personalized Mix",
        raw_history: rawHistory.map(track => ({
          title: track.title,
          artist: track.artist
        }))
      }),
    });

    if (!pythonRes.ok) {
      throw new Error(`Python API responded with status ${pythonRes.status}`);
    }

    const data = await pythonRes.json();
    
    let recommendations: any[] = [];

    // 3. Search queries on Next.js side (avoiding HF IP blocking)
    if (data.queries && data.queries.length > 0) {
      console.log("[Next.js] Searching generated queries from Next.js backend...");
      const seenIds = new Set<string>();
      for (const q of data.queries) {
        if (recommendations.length >= 20) break;
        try {
          const results = await searchSongsRobust(q);
          for (const item of results) {
            if (item.youtubeId && !seenIds.has(item.youtubeId)) {
              seenIds.add(item.youtubeId);
              recommendations.push({
                youtubeId: item.youtubeId,
                title: item.title,
                artist: item.artist,
                thumbnail: item.thumbnail,
                reason: "AI Taste Prediction"
              });
              if (recommendations.length >= 20) break;
            }
          }
        } catch (err) {
          console.error(`[Next.js] Search failed for query "${q}":`, err);
        }
      }
    }

    // If search on Next.js side didn't yield anything, return a 400 Bad Request
    if (recommendations.length === 0) {
      return NextResponse.json(
        { error: "No playable tracks found on YouTube Music. Please try a different query." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      title: data.title,
      description: data.description,
      cover_url: data.cover_url,
      taste_vibe: data.taste_vibe,
      recommendations
    });

  } catch (error: any) {
    console.error("[Recommendations Proxy] Error connecting to Hugging Face:", error);
    return NextResponse.json(
      { error: "AI backend error", detail: error.message },
      { status: 500 }
    );
  }
}


export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
