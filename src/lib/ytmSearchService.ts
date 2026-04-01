/**
 * ytmSearchService.ts
 * Robust YouTube Music search with multiple fallback strategies.
 * All results come from music.youtube.com (node-youtube-music).
 */

let ytmusicInstance: any = null;
async function getYTMusic() {
  if (!ytmusicInstance) {
    const m = await import("ytmusic-api");
    ytmusicInstance = new m.default();
    await ytmusicInstance.initialize();
  }
  return ytmusicInstance;
}
const RETRY_DELAY_MS = 300;
const RETRIES = 2;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strips bracketed noise from a query and retries search */
async function searchWithRetry(query: string, type: "songs" | "videos" = "songs"): Promise<any[]> {
  let lastErr: unknown;
  for (let i = 0; i <= RETRIES; i++) {
    try {
      const ytmusic = await getYTMusic();
      const results = type === "songs" ? await ytmusic.searchSongs(query) : await ytmusic.searchVideos(query);
      if (results && results.length > 0) return results.map(mapYTMToMusicVideo);
    } catch (err) {
      lastErr = err;
      if (i < RETRIES) await sleep(RETRY_DELAY_MS);
    }
  }
  console.warn("[ytmSearchService] ytmusic.search failed after retries:", lastErr);
  return [];
}

import { formatDuration } from "./format";

function mapYTMToMusicVideo(item: any) {
  // Handle both "artists" (array/object) and "artist" (object) from different versions/methods
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
    title: item.name || item.title || "Unknown Title",
    artists: [{ name: artistName }], // Plural for backward compat
    artist: artistName,               // Singular for Song type
    duration: formattedDuration,      // String for Song type
    durationObj: { totalSeconds: durationSec, label: formattedDuration }, // Object for legacy routes
    thumbnail: item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnail?.url || item.thumbnail || "",
    thumbnailUrl: item.thumbnails?.[item.thumbnails.length - 1]?.url || item.thumbnail?.url || item.thumbnail || "" // Backward compat
  };
}

/**
 * Searches YouTube Music with progressive fallback strategies:
 * 1. Full query
 * 2. Stripped query (removes feat., (), [] noise)
 * 3. First 3 words of query
 */
export async function searchSongsRobust(query: string): Promise<any[]> {
  if (!query?.trim()) return [];

  // Strategy 1: full query
  const full = await searchWithRetry(query.trim());
  if (full.length >= 3) return full;

  // Strategy 2: clean noise
  const stripped = query
    .replace(/\(feat\.?.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (stripped !== query.trim()) {
    const clean = await searchWithRetry(stripped);
    if (clean.length >= 3) return clean;
  }

  // Strategy 3: first 3 meaningful words
  const words = stripped.split(/\s+/).slice(0, 3).join(" ");
  if (words !== stripped) {
    const short = await searchWithRetry(words);
    if (short.length > 0) return short;
  }

  // Return whatever we have
  return full.length > 0 ? full : [];
}

export async function searchVideosRobust(query: string): Promise<any[]> {
  if (!query?.trim()) return [];
  const res = await searchWithRetry(query, "videos");
  return res || [];
}
