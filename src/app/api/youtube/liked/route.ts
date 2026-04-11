import { NextResponse } from "next/server";
import { fetchLikedSongs } from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";

export async function GET(req: Request) {
  const accessToken = await getRequestAccessToken(req);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tracks = await fetchLikedSongs(accessToken);
    return NextResponse.json(tracks);
  } catch (error) {
    console.error("API Fetch Liked Songs Error:", error);
    return NextResponse.json({ error: "Failed to fetch liked songs" }, { status: 500 });
  }
}
