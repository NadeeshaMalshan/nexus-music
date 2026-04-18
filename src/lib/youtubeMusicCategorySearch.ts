import { parseISO8601Duration } from "@/lib/youtubeData";
import {
  fetchYoutubeDataApiWithKeyRotation,
  getYoutubeDataApiKeys,
} from "@/lib/youtubeDataApiFetch";

export type YouTubeMusicSearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

function pickThumb(snippet: any): string {
  const t = snippet?.thumbnails;
  return (
    t?.maxres?.url ||
    t?.standard?.url ||
    t?.high?.url ||
    t?.medium?.url ||
    t?.default?.url ||
    ""
  );
}

function cleanAuthor(author: string): string {
  return (author || "Unknown Artist").replace(/\s*-\s*Topic$/, "");
}

export async function searchYouTubeMusicCategory(
  query: string,
  maxResults = 12
): Promise<YouTubeMusicSearchItem[]> {
  const q = query?.trim();
  if (!q) return [];

  if (getYoutubeDataApiKeys().length === 0) {
    return [];
  }

  const capped = Math.max(1, Math.min(25, Math.floor(maxResults)));

  const searchRes = await fetchYoutubeDataApiWithKeyRotation((apiKey) => {
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("videoCategoryId", "10"); // Music
    searchUrl.searchParams.set("q", q);
    searchUrl.searchParams.set("maxResults", String(capped));
    if (apiKey) searchUrl.searchParams.set("key", apiKey);
    return searchUrl.toString();
  }, { cache: "no-store" });
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();

  const ids: string[] = (searchData?.items || [])
    .map((it: any) => it?.id?.videoId)
    .filter(Boolean);

  if (ids.length === 0) return [];

  // Hydrate durations + better thumbnails via videos.list
  const videosRes = await fetchYoutubeDataApiWithKeyRotation((apiKey) => {
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "contentDetails,snippet");
    videosUrl.searchParams.set("id", ids.join(","));
    if (apiKey) videosUrl.searchParams.set("key", apiKey);
    return videosUrl.toString();
  }, { cache: "no-store" });
  if (!videosRes.ok) return [];
  const videosData = await videosRes.json();

  const byId = new Map<string, YouTubeMusicSearchItem>();
  for (const v of videosData?.items || []) {
    const videoId = v?.id;
    if (!videoId) continue;
    const snippet = v?.snippet;
    byId.set(videoId, {
      videoId,
      title: snippet?.title || "Unknown title",
      author: cleanAuthor(snippet?.channelTitle || "Unknown Artist"),
      duration: parseISO8601Duration(v?.contentDetails?.duration || ""),
      thumbnail: pickThumb(snippet),
    });
  }

  // Preserve original search order.
  const out: YouTubeMusicSearchItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) out.push(item);
    if (out.length >= capped) break;
  }
  return out;
}

