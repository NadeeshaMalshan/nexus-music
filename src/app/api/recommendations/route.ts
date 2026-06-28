import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";

export const dynamic = "force-dynamic";

/**
 * POST /api/recommendations
 * Standard, non-AI recommendation provider.
 * Uses direct YouTube Music searches and YTM related track mappings.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { prompt, recentTrackId } = body;

  try {
    // 1. If recentTrackId is provided, pull YTM related tracks (non-AI related algorithm)
    if (recentTrackId) {
      console.log(`[Recommendations] Fetching YTM Related Tracks for: ${recentTrackId}`);
      try {
        const { getRelatedTracksRobust } = await import("@/lib/youtubeMusicRelated");
        const rawSuggestions = await getRelatedTracksRobust(recentTrackId);

        const recommendations = rawSuggestions.slice(0, 20).map((t: any) => ({
          youtubeId: t.youtubeId,
          title: t.title,
          artist: t.artists ? t.artists[0]?.name : "Unknown Artist",
          thumbnail: t.thumbnail || t.thumbnailUrl || "",
          duration: t.duration || "0:00",
          reason: "Similar to recent playback"
        })).filter((t: any) => t.youtubeId && t.youtubeId !== recentTrackId);

        if (recommendations.length > 0) {
          return NextResponse.json({ recommendations });
        }
      } catch (fallbackError: any) {
        console.error("[Recommendations] YTM Related tracks fetch failed:", fallbackError);
      }
    }

    // 2. Default: Perform a standard YTMusic search for the prompt (completely non-AI search query)
    const query = prompt?.trim() || "Popular Songs";
    console.log(`[Recommendations] Performing direct YTMusic search for prompt: "${query}"`);
    
    const searchResults = await searchSongsRobust(query);
    const recommendations = (searchResults || []).slice(0, 20).map((t: any) => ({
      youtubeId: t.youtubeId,
      title: t.title,
      artist: t.artist,
      thumbnail: t.thumbnailUrl,
      duration: t.duration || "0:00",
      reason: "Curated search match"
    }));

    return NextResponse.json({ recommendations });
  } catch (error: any) {
    console.error("[Recommendations] Search recommendation failed:", error);
    return NextResponse.json({ error: "Failed to generate recommendations", detail: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
