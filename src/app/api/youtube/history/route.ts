import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchRecentMusicActivities } from "@/lib/youtubeData";

/**
 * Recent music-related activity for the signed-in Google account (YouTube Data API).
 * True YouTube Music "History" (FEmusic_history) requires cookie auth to InnerTube, not OAuth alone.
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tracks = await fetchRecentMusicActivities(session.accessToken as string);
    return NextResponse.json({
      tracks,
      source: "youtube.activities" as const,
      hint:
        "Derived from your YouTube channel activity (music videos). Full YT Music history needs YouTube Music app cookies.",
    });
  } catch (error) {
    console.error("API /youtube/history:", error);
    return NextResponse.json({ error: "Failed to load history feed" }, { status: 500 });
  }
}
