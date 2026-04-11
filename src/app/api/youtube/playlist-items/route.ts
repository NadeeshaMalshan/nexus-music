import { fetchPlaylistItems } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const playlistId = searchParams.get("playlistId");

  if (!playlistId) {
    return NextResponse.json({ error: "Playlist ID is required" }, { status: 400 });
  }

  const accessToken = await getRequestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const musicOnly = playlistId === "LL";
    const items = await fetchPlaylistItems(accessToken, playlistId, musicOnly);
    return NextResponse.json(items);
  } catch (error) {
    console.error("Error fetching YouTube playlist items:", error);
    return NextResponse.json({ error: "Failed to fetch playlist items" }, { status: 500 });
  }
}
