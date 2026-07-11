import { NextResponse } from "next/server";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { resolveUserEmail, getPendingActions, setPendingActions, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";
import { createPlaylist, addSongToPlaylist, rateVideo, subscribeToChannel } from "@/lib/youtubeData";
import redis from "@/lib/redis";

export async function POST(request: Request) {
  const accessToken = await getRequestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await resolveUserEmail(request);
  if (!email || !redis) {
    return NextResponse.json({ success: false });
  }

  const pendingActions = await getPendingActions(email);
  if (pendingActions.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let processedCount = 0;
  let hasQuotaError = false;
  const remainingActions = [...pendingActions];

  for (let i = 0; i < pendingActions.length; i++) {
    const action = pendingActions[i];
    try {
      if (action.type === "CREATE_PLAYLIST") {
        const { tempPlaylistId, title, description, videoIds } = action.data;
        const newPlaylistId = await createPlaylist(accessToken, title, description);
        if (videoIds && videoIds.length > 0) {
          for (const videoId of videoIds) {
            await addSongToPlaylist(accessToken, newPlaylistId, videoId);
          }
        }
        
        // Update local DB to swap tempId with real ID
        const playlistsKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
        const existingStr = await redis.get(playlistsKey);
        if (typeof existingStr === "string") {
          let existing = JSON.parse(existingStr);
          const index = existing.findIndex((p: any) => p.id === tempPlaylistId);
          if (index !== -1) {
            existing[index].id = newPlaylistId;
            delete existing[index].pending;
            await redis.set(playlistsKey, JSON.stringify(existing));
          }
        }
      } else if (action.type === "LIKE_SONG") {
        const { videoId } = action.data;
        await rateVideo(accessToken, videoId, "like");
      } else if (action.type === "UNLIKE_SONG") {
        const { videoId } = action.data;
        await rateVideo(accessToken, videoId, "none");
      } else if (action.type === "SUBSCRIBE_CHANNEL") {
        const { channelId } = action.data;
        await subscribeToChannel(accessToken, channelId);
      }
      
      // If we got here, it succeeded
      processedCount++;
      // remove from remaining
      remainingActions.shift();
    } catch (error: any) {
      console.error("Pending sync error:", error);
      // Assume quota exceeded or network error, stop processing
      hasQuotaError = true;
      break;
    }
  }

  if (processedCount > 0 || pendingActions.length !== remainingActions.length) {
    await setPendingActions(email, remainingActions);
  }

  return NextResponse.json({ 
    success: !hasQuotaError, 
    processed: processedCount, 
    remaining: remainingActions.length 
  });
}
