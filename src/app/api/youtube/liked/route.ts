import { NextResponse } from "next/server";
import { fetchLikedSongs } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { YouTubeQuotaError } from "@/lib/youtubeApiErrors";

export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tracks = await fetchLikedSongs(accessToken);
    return NextResponse.json(tracks);
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
    console.error("API Fetch Liked Songs Error:", error);
    return NextResponse.json({ error: "Failed to fetch liked songs" }, { status: 500 });
  }
}
