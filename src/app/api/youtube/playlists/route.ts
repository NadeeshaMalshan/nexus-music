import { fetchUserPlaylists } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const playlists = await fetchUserPlaylists(accessToken);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error("Error fetching YouTube playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
