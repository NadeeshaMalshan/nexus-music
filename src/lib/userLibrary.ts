import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchGoogleUserEmail } from "@/lib/googleUserFromAccessToken";
import redis from "@/lib/redis";

export const LIBRARY_KEY_PREFIX = "user:library";

export function bearerToken(request: Request): string | null {
  const h = request.headers.get("authorization") || request.headers.get("Authorization");
  const m = h?.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

export async function resolveUserEmail(request: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) return session.user.email;

  const token = bearerToken(request);
  if (!token) return null;
  return fetchGoogleUserEmail(token);
}

export async function addPendingAction(email: string, action: any) {
  if (!redis) return;
  const key = `${LIBRARY_KEY_PREFIX}:pending_actions:${email}`;
  const existing = await redis.get(key);
  let actions: any[] = [];
  if (typeof existing === "string") {
    try {
      actions = JSON.parse(existing);
    } catch {
      actions = [];
    }
  } else if (Array.isArray(existing)) {
    actions = existing;
  }
  
  // If it's a like/unlike, filter out previous conflicting actions for the same video
  if (action.type === "LIKE_SONG") {
    actions = actions.filter((a: any) => !(a.type === "LIKE_SONG" && a.data.videoId === action.data.videoId));
  }
  
  actions.push(action);
  await redis.set(key, JSON.stringify(actions));
}

export async function getPendingActions(email: string) {
  if (!redis) return [];
  const key = `${LIBRARY_KEY_PREFIX}:pending_actions:${email}`;
  const existing = await redis.get(key);
  if (typeof existing === "string") {
    try {
      return JSON.parse(existing);
    } catch {
      return [];
    }
  } else if (Array.isArray(existing)) {
    return existing;
  }
  return [];
}

export async function setPendingActions(email: string, actions: any[]) {
  if (!redis) return;
  const key = `${LIBRARY_KEY_PREFIX}:pending_actions:${email}`;
  await redis.set(key, JSON.stringify(actions));
}

export async function mergeUserLibraryData(email: string, newPlaylists: any[], newLiked: any[], newHistory: any = null) {
  if (!redis) return;

  const playlistsKey = `${LIBRARY_KEY_PREFIX}:playlists:${email}`;
  const likedKey = `${LIBRARY_KEY_PREFIX}:liked:${email}`;
  const historyKey = `${LIBRARY_KEY_PREFIX}:history:${email}`;

  const [existingPlaylistsStr, existingLikedStr] = await Promise.all([
    redis.get(playlistsKey),
    redis.get(likedKey)
  ]);

  let existingPlaylists: any[] = [];
  if (typeof existingPlaylistsStr === "string") {
    try { existingPlaylists = JSON.parse(existingPlaylistsStr); } catch {}
  } else if (Array.isArray(existingPlaylistsStr)) {
    existingPlaylists = existingPlaylistsStr;
  }

  let existingLiked: any[] = [];
  if (typeof existingLikedStr === "string") {
    try { existingLiked = JSON.parse(existingLikedStr); } catch {}
  } else if (Array.isArray(existingLikedStr)) {
    existingLiked = existingLikedStr;
  }

  // Merge Playlists (prefer existing local if they have a 'local_id' or 'pending', otherwise YT overwrites)
  // Actually, merge by ID.
  const mergedPlaylists = [...existingPlaylists];
  const mergedPlaylistsMap = new Map(mergedPlaylists.map(p => [p.id, p]));
  for (const p of newPlaylists) {
    mergedPlaylistsMap.set(p.id, p);
  }
  // Remove temporary local playlists if they were synced (their ID might have changed? For now, we assume standard sync doesn't match local IDs, so local IDs persist until sync pending replaces them)

  // Merge Liked Songs by videoId
  const mergedLiked = [...existingLiked];
  const mergedLikedMap = new Map(mergedLiked.map(s => [s.videoId || s.id, s]));
  for (const s of newLiked) {
    mergedLikedMap.set(s.videoId || s.id, s);
  }

  const promises = [
    redis.set(playlistsKey, JSON.stringify(Array.from(mergedPlaylistsMap.values()))),
    redis.set(likedKey, JSON.stringify(Array.from(mergedLikedMap.values()))),
    redis.set(`${LIBRARY_KEY_PREFIX}:synced_at:${email}`, String(Date.now())),
  ];

  if (newHistory) {
    promises.push(redis.set(historyKey, JSON.stringify(newHistory)));
  }

  await Promise.all(promises);
}
