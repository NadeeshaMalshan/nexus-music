import { searchSongsRobust } from "./ytmSearchService";
import { formatDuration } from "./format";

let ytmusicInstance: any = null;
async function getYTMusic() {
  if (!ytmusicInstance) {
    const m = await import("ytmusic-api");
    ytmusicInstance = new m.default();
    await ytmusicInstance.initialize();
  }
  return ytmusicInstance;
}

const RETRIES = 2;
const RETRY_DELAY_MS = 400;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSuggestionsWithRetry(videoId: string): Promise<any[]> {
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const ytmusic = await getYTMusic();
      const suggestions = await ytmusic.getUpNexts(videoId);

      if (suggestions && suggestions.length > 0) {
        return suggestions.map((item: any) => {
          let artistName = "Unknown Artist";
          if (item.artists) {
            if (Array.isArray(item.artists)) {
              artistName = item.artists.map((a: any) => typeof a === 'string' ? a : (a.name || "Unknown Artist")).join(", ");
            } else if (typeof item.artists === 'object') {
              artistName = item.artists.name || "Unknown Artist";
            } else if (typeof item.artists === 'string') {
              artistName = item.artists;
            }
          } else if (item.artist) {
            if (typeof item.artist === 'object') {
              artistName = item.artist.name || "Unknown Artist";
            } else if (typeof item.artist === 'string') {
              artistName = item.artist;
            }
          }
          
          const durationSec = typeof item.duration === 'number' ? item.duration : 0;
          const formattedDuration = formatDuration(durationSec);

          return {
            youtubeId: item.videoId,
            title: item.title || item.name || "Unknown Title",
            artists: [{ name: artistName }], // Plural for backward compat
            artist: artistName,               // Singular for Song type
            duration: formattedDuration,      // String for Song type
            durationObj: { totalSeconds: durationSec, label: formattedDuration }, // Object for legacy routes
            thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnail?.url || item.thumbnail || "",
            thumbnailUrl: item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnail?.url || item.thumbnail || "" // Backward compat
          };
        });
      }
    } catch (err) {
      console.warn(`[youtubeMusicRelated] Attempt ${i + 1} failed for ${videoId}:`, err);
      if (i < RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  return [];
}

/**
 * Returns related tracks for a given YouTube Music videoId.
 * Falls back to searchMusics("trending hits") if suggestions fail.
 */
export async function getRelatedTracksRobust(videoId: string): Promise<any[]> {
  if (!videoId?.trim()) return [];

  const suggestions = await fetchSuggestionsWithRetry(videoId.trim());
  if (suggestions.length > 0) return suggestions;

  // Fallback: search for popular tracks
  console.warn("[youtubeMusicRelated] Falling back to trending search for:", videoId);
  try {
    const fallback = await searchSongsRobust("trending hits");
    return fallback || [];
  } catch {
    return [];
  }
}

