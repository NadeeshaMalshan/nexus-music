import { NextResponse } from "next/server";
import { fetchRecentMusicActivities } from "@/lib/youtubeData";
import { fetchYTMusicBrowseHistory } from "@/lib/ytmHistoryBrowse";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

/**
 * History for the library tab:
 * - Always: recent music-tagged uploads / social / playlist activity via YouTube Data API (OAuth).
 * - Optional: YouTube Music app "History" shelf (FEmusic_history) via InnerTube when `YTM_COOKIE`
 *   is configured on the server. Set `YTM_MERGE_BROWSE_HISTORY=1` to prepend that list and de-dupe by
 *   video id (typical for single-account / self-hosted installs where the cookie matches the OAuth user).
 */
export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [activities, ytmBrowse] = await Promise.all([
      fetchRecentMusicActivities(accessToken, 50),
      (async () => {
        try {
          return await fetchYTMusicBrowseHistory();
        } catch (e) {
          console.warn("[youtube/history] YTM browse history skipped:", e);
          return [];
        }
      })(),
    ]);

    const mergeBrowse =
      process.env.YTM_MERGE_BROWSE_HISTORY === "1" &&
      process.env.YTM_COOKIE &&
      ytmBrowse.length > 0;

    let tracks = activities;
    let source: "youtube.mixed" | "youtube.activities" | "youtube.ytm_browse" = "youtube.activities";

    if (mergeBrowse) {
      const seen = new Set(ytmBrowse.map((t) => t.videoId));
      tracks = [...ytmBrowse, ...activities.filter((a) => !seen.has(a.videoId))];
      source = "youtube.mixed";
    } else if (activities.length === 0 && ytmBrowse.length > 0 && process.env.YTM_COOKIE) {
      // Same-account deploy: show browse history when OAuth activity feed is empty
      tracks = ytmBrowse;
      source = "youtube.ytm_browse";
    }

    return NextResponse.json({
      tracks,
      source,
      ytmBrowseAvailable: ytmBrowse.length > 0,
      hint:
        source === "youtube.mixed"
          ? "Merged YouTube Music history (server cookie) with your channel activity (OAuth)."
          : source === "youtube.ytm_browse"
            ? "Showing YouTube Music history from server InnerTube session (YTM_COOKIE)."
            : "From your YouTube channel activity (music). For the full YT Music history list, configure YTM_COOKIE (and optionally YTM_MERGE_BROWSE_HISTORY=1).",
    });
  } catch (error) {
    console.error("API /youtube/history:", error);
    return NextResponse.json({ error: "Failed to load history feed" }, { status: 500 });
  }
}
