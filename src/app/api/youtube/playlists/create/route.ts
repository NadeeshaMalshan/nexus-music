import { createPlaylist, addSongToPlaylist } from "@/lib/youtubeData";
import { NextResponse } from "next/server";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { addPendingAction, resolveUserEmail, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";
import redis from "@/lib/redis";

export async function POST(request: Request) {
  const accessToken = await getRequestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await resolveUserEmail(request);

  const { title, description, videoIds, trackDetails } = await request.json();

  if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  try {
    // 1. Create the playlist
    const playlistId = await createPlaylist(accessToken, title, description);

    // 2. Add songs to it
    if (videoIds && videoIds.length > 0) {
      // YouTube API prefers sequential or limited parallel for item insertion
      for (const videoId of videoIds) {
        await addSongToPlaylist(accessToken, playlistId, videoId);
      }
    }

    // 3. Save to local Redis DB
    if (email && redis) {
      const playlistsKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
      const existingPlaylistsStr = await redis.get(playlistsKey);
      let existingPlaylists: any[] = [];
      if (typeof existingPlaylistsStr === "string") {
        try { existingPlaylists = JSON.parse(existingPlaylistsStr); } catch {}
      } else if (Array.isArray(existingPlaylistsStr)) {
        existingPlaylists = existingPlaylistsStr;
      }

      const newLocalPlaylist = {
        id: playlistId,
        title,
        description: description || "",
        thumbnailUrl: trackDetails?.[0]?.artwork || trackDetails?.[0]?.thumbnailUrl || "",
        itemCount: videoIds?.length || 0,
      };

      existingPlaylists.unshift(newLocalPlaylist);
      await redis.set(playlistsKey, JSON.stringify(existingPlaylists));
    }

    return NextResponse.json({ success: true, playlistId });
  } catch (error: any) {
    console.error("Error creating playlist:", error);

    // Do NOT save to pending queue or return success.
    // Inform the user that the action failed due to rate limit or network error.
    return NextResponse.json({ error: "Failed to create playlist. Please try again later." }, { status: 500 });
  }
}
