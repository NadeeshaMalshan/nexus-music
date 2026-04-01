import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchUserPlaylists } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const playlists = await fetchUserPlaylists(session.accessToken);
    return NextResponse.json(playlists);
  } catch (error) {
    console.error("Error fetching YouTube playlists:", error);
    return NextResponse.json({ error: "Failed to fetch playlists" }, { status: 500 });
  }
}
