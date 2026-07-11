import redis from "@/lib/redis";
import { getPendingActions, setPendingActions, LIBRARY_KEY_PREFIX } from "@/lib/userLibrary";
import { rateVideo, createPlaylist, addSongToPlaylist, subscribeToChannel } from "@/lib/youtubeData";
import { YouTubeQuotaError } from "@/lib/youtubeApiErrors";

/**
 * Processes the offline sync queue for a user.
 * Tries to push all pending actions (likes, playlist creates) to YouTube.
 * If quota is exceeded during sync, stops and leaves remaining items in the queue.
 * Returns true if all actions were flushed, false if quota was hit.
 */
export async function processSyncQueue(email: string, accessToken: string): Promise<boolean> {
  if (!redis) return true;

  const actions = await getPendingActions(email);
  if (!actions || actions.length === 0) return true;

  console.log(`[syncQueue] Processing ${actions.length} pending actions for ${email}`);

  const remaining: any[] = [];

  for (const action of actions) {
    try {
      if (action.type === "LIKE_SONG") {
        const { videoId, rating } = action.data;
        await rateVideo(accessToken, videoId, rating);
        console.log(`[syncQueue] Synced LIKE_SONG: ${videoId} = ${rating}`);
      } else if (action.type === "SUBSCRIBE_CHANNEL") {
        const { channelId } = action.data;
        await subscribeToChannel(accessToken, channelId);
        console.log(`[syncQueue] Synced SUBSCRIBE_CHANNEL: ${channelId}`);
      } else if (action.type === "CREATE_PLAYLIST") {
        const { tempPlaylistId, title, description, videoIds, trackDetails } = action.data;

        // Create the real playlist on YouTube
        const realPlaylistId = await createPlaylist(accessToken, title, description);

        if (videoIds && videoIds.length > 0) {
          for (const videoId of videoIds) {
            await addSongToPlaylist(accessToken, realPlaylistId, videoId);
          }
        }

        // Update the cached playlist: replace temp ID with real ID
        if (redis) {
          const playlistsKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
          const existingStr = await redis.get(playlistsKey);
          let existing: any[] = [];
          if (typeof existingStr === "string") {
            try { existing = JSON.parse(existingStr); } catch {}
          } else if (Array.isArray(existingStr)) {
            existing = existingStr;
          }
          const updated = existing.map((p: any) =>
            p.id === tempPlaylistId
              ? { ...p, id: realPlaylistId, pending: false }
              : p
          );
          await redis.set(playlistsKey, JSON.stringify(updated));

          // Migrate tracks key to the new real playlist ID
          const oldTracksKey = `${LIBRARY_KEY_PREFIX}:playlist_tracks:${tempPlaylistId}:${email}`;
          const newTracksKey = `${LIBRARY_KEY_PREFIX}:playlist_tracks:${realPlaylistId}:${email}`;
          const cachedTracks = await redis.get(oldTracksKey);
          if (cachedTracks) {
            await redis.set(newTracksKey, typeof cachedTracks === "string" ? cachedTracks : JSON.stringify(cachedTracks));
            await redis.expire(newTracksKey, 7 * 24 * 60 * 60);
            await redis.del(oldTracksKey);
          }
        }

        console.log(`[syncQueue] Synced CREATE_PLAYLIST: "${title}" -> ${realPlaylistId}`);
      }
    } catch (err) {
      if (err instanceof YouTubeQuotaError) {
        // Quota hit mid-sync: stop and keep remaining actions
        console.warn("[syncQueue] Quota exceeded during sync, stopping.");
        remaining.push(action);
        // Re-add all remaining unprocessed actions
        const actionIndex = actions.indexOf(action);
        for (let i = actionIndex + 1; i < actions.length; i++) {
          remaining.push(actions[i]);
        }
        break;
      }
      // For other errors, log and skip (don't block the rest of sync)
      console.error("[syncQueue] Failed to sync action, skipping:", action, err);
    }
  }

  await setPendingActions(email, remaining);
  return remaining.length === 0;
}
