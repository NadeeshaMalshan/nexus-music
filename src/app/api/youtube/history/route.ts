import { NextResponse } from "next/server";
import { fetchRecentMusicActivities } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { YouTubeQuotaError } from "@/lib/youtubeApiErrors";

/**
 * Music-related channel activity (YouTube Data API, OAuth). YouTube does not expose full watch
 * history to third parties; this is the official substitute. No YTM / InnerTube / cookies.
 */
export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activities = await fetchRecentMusicActivities(accessToken, 50);
    return NextResponse.json({
      tracks: activities,
      source: "youtube.activities" as const,
      ytmBrowseAvailable: false,
      hint: "YouTube Data API: music-tagged channel activity. Sign in and play music; full watch history is not available to apps.",
    });
  } catch (error) {
    if (error instanceof YouTubeQuotaError) {
      return NextResponse.json(
        {
          error: "quotaExceeded",
          message:
            "YouTube Data API daily quota is used up. It resets at midnight Pacific Time, or raise quota in Google Cloud Console.",
        },
        { status: 503 }
      );
    }
    console.error("API /youtube/history:", error);
    return NextResponse.json({ error: "Failed to load history feed" }, { status: 500 });
  }
}
