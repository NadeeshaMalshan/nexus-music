import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createPlaylist, addSongToPlaylist } from "@/lib/youtubeData";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { title, description, videoIds } = await request.json();

    if (!title) {
       return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // 1. Create the playlist
    const playlistId = await createPlaylist(session.accessToken, title, description);

    // 2. Add songs to it
    if (videoIds && videoIds.length > 0) {
      // YouTube API prefers sequential or limited parallel for item insertion
      for (const videoId of videoIds) {
        await addSongToPlaylist(session.accessToken, playlistId, videoId);
      }
    }

    return NextResponse.json({ success: true, playlistId });
  } catch (error) {
    console.error("Error creating playlist:", error);
    return NextResponse.json({ error: "Failed to create playlist and add songs" }, { status: 500 });
  }
}
