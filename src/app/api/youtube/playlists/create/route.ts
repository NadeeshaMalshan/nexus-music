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
      const tracksKey = `${LIBRARY_KEY_PREFIX}:playlist_tracks:${playlistId}:${email}`;
      
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

      // Save tracks to Redis so they are immediately available locally
      if (trackDetails && trackDetails.length > 0) {
        await redis.set(tracksKey, JSON.stringify(trackDetails));
        await redis.expire(tracksKey, 7 * 24 * 60 * 60);
      }
    }

    return NextResponse.json({ success: true, playlistId });
  } catch (error: any) {
    console.error("Error creating playlist:", error);

    // Save to pending queue so it can be synced after quota resets
    if (email) {
      const tempPlaylistId = `temp_${Date.now()}`;
      try {
        await addPendingAction(email, {
          type: "CREATE_PLAYLIST",
          data: {
            tempPlaylistId,
            title,
            description: description || "",
            videoIds,
            trackDetails
          }
        });

        // Save the temp playlist to local Redis database with pending: true status
        if (redis) {
          const playlistsKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
          const tracksKey = `${LIBRARY_KEY_PREFIX}:playlist_tracks:${tempPlaylistId}:${email}`;
          
          const existingPlaylistsStr = await redis.get(playlistsKey);
          let existingPlaylists: any[] = [];
          if (typeof existingPlaylistsStr === "string") {
            try { existingPlaylists = JSON.parse(existingPlaylistsStr); } catch {}
          } else if (Array.isArray(existingPlaylistsStr)) {
            existingPlaylists = existingPlaylistsStr;
          }

          const newLocalPlaylist = {
            id: tempPlaylistId,
            title,
            description: description || "",
            thumbnailUrl: trackDetails?.[0]?.artwork || trackDetails?.[0]?.thumbnailUrl || "",
            itemCount: videoIds?.length || 0,
            pending: true // Mark as pending sync!
          };

          existingPlaylists.unshift(newLocalPlaylist);
          await redis.set(playlistsKey, JSON.stringify(existingPlaylists));

          // Save tracks to Redis for the temp playlist
          if (trackDetails && trackDetails.length > 0) {
            await redis.set(tracksKey, JSON.stringify(trackDetails));
            await redis.expire(tracksKey, 7 * 24 * 60 * 60);
          }
        }

        return NextResponse.json({ 
          success: true, 
          playlistId: tempPlaylistId, 
          pending: true,
          message: "Saved to sync queue. Playlist will be created on YouTube once quota resets." 
        });
      } catch (redisErr) {
        console.error("Failed to save pending action to Redis:", redisErr);
      }
    }

    return NextResponse.json({ error: "Failed to create playlist. Please try again later." }, { status: 500 });
  }
}
