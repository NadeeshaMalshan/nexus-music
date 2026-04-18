import { fetchUserPlaylists } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { YouTubeQuotaError } from "@/lib/youtubeApiErrors";

export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const playlists = await fetchUserPlaylists(accessToken);
    return NextResponse.json(playlists);
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
    console.error("Error fetching YouTube playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
