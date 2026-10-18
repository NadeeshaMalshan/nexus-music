import { NextResponse } from "next/server";
import {
  fetchLikedSongs,
  fetchRecentMusicActivities,
  type YouTubeTrack,
} from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { appendUniqueTaste } from "@/lib/mergeTasteHistory";
import { fetchYoutubeDataApiWithKeyRotation } from "@/lib/youtubeDataApiFetch";
import {
  selectDiverseRecommendations,
  parseRefreshOffset,
  isLikelyMusicLiveStream,
  type CandidateTrack,
} from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  isLive?: boolean;
};

function normArtistName(raw: string | undefined | null): string {
  return (raw || "")
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function topArtistsFromTracks(tracks: YouTubeTrack[], max = 8): string[] {
  const counts = new Map<string, { n: number; display: string }>();
  for (const t of tracks) {
    const a = normArtistName(t.artist);
    if (!a || a.toLowerCase() === "unknown" || a.toLowerCase() === "unknown artist") continue;
    const key = a.toLowerCase();
    const prev = counts.get(key);
    if (prev) prev.n += 1;
    else counts.set(key, { n: 1, display: a });
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .map((x) => x.display)
    .slice(0, max);
}

const CURATED_LIVE_GENRES = [
  "Live Acoustic Session",
  "Electronic DJ Set live",
  "Chillout Live music",
  "Jazz Session live",
  "Synthwave live",
  "Festival Live Set",
  "Piano Live stream",
  "Lofi Hip Hop Radio live",
];

async function searchLiveStreamsForQuery(
  query: string,
  accessToken?: string
): Promise<CandidateTrack[]> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const searchRes = await fetchYoutubeDataApiWithKeyRotation(
      (apiKey) => {
        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("part", "snippet");
        url.searchParams.set("q", query);
        url.searchParams.set("type", "video");
        url.searchParams.set("eventType", "live");
        url.searchParams.set("videoCategoryId", "10"); // Music category only
        url.searchParams.set("maxResults", "15");
        if (apiKey) url.searchParams.set("key", apiKey);
        return url.toString();
      },
      { headers }
    );

    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const items = searchData.items || [];

    const candidates: CandidateTrack[] = [];
    for (const item of items) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      const title = item.snippet?.title || "Unknown Live";
      const author = (item.snippet?.channelTitle || "Unknown Channel").replace(
        /\s*-\s*Topic$/,
        ""
      );

      // Verify music relevance and reject non-music/junk
      if (
        !isLikelyMusicLiveStream({
          title,
          author,
          categoryId: "10",
        })
      ) {
        continue;
      }

      const thumbnail =
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      candidates.push({
        videoId,
        title,
        artist: author,
        duration: "LIVE",
        thumbnail,
      });
    }

    return candidates;
  } catch (err) {
    console.warn(`[live/personalized] Search failed for query "${query}":`, err);
    return [];
  }
}

/**
 * Personalized live stream recommendations based on user's YouTube activity & likes.
 * Enforces artist and channel diversity (max 2 per channel) and strictly filters out
 * subscriber counters, cartoons, gaming, and celebrity gossip streams.
 */
export async function GET(request: Request) {
  const accessToken = await getRequestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [activities, liked] = await Promise.all([
      fetchRecentMusicActivities(accessToken, 50).catch(() => [] as YouTubeTrack[]),
      fetchLikedSongs(accessToken).catch(() => [] as YouTubeTrack[]),
    ]);

    const history = activities;
    const tasteTracks = appendUniqueTaste(history, liked);
    const refreshOffset = parseRefreshOffset(request);
    const topArtists = topArtistsFromTracks(tasteTracks, 8);

    // Queries to execute: combine user top artists with curated live music genres
    const queries: string[] = [];

    // Add up to 3 top artists
    for (const artist of topArtists.slice(0, 3)) {
      queries.push(`${artist} live`);
    }

    // Add 2-3 curated live genres rotated by refresh offset
    const genreOffset = refreshOffset % CURATED_LIVE_GENRES.length;
    const rotatedGenres = [
      ...CURATED_LIVE_GENRES.slice(genreOffset),
      ...CURATED_LIVE_GENRES.slice(0, genreOffset),
    ];
    queries.push(...rotatedGenres.slice(0, 3));

    // Fetch candidate streams concurrently
    const candidateBatches = await Promise.all(
      queries.map((q) => searchLiveStreamsForQuery(q, accessToken))
    );

    const candidates: CandidateTrack[] = candidateBatches.flat();

    // Apply diversity: max 2 streams per channel/artist, preferred 1 for maximum variety
    const diverse = selectDiverseRecommendations(candidates, {
      preferredArtists: topArtists,
      targetCount: 12,
      maxPerArtist: 2,
      preferredMaxPerArtist: 1,
      offset: refreshOffset,
    });

    const items: SearchItem[] = diverse.map((t) => ({
      videoId: t.videoId,
      title: t.title,
      author: t.artist,
      duration: "LIVE",
      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
      isLive: true,
    }));

    return NextResponse.json({
      items,
      topArtists: topArtists.slice(0, 5),
      mode: "youtube_data_api_live",
      signals: {
        youtubeActivityRows: activities.length,
        likedRows: liked.length,
      },
    });
  } catch (e: any) {
    console.error("[live/personalized]", e);
    return NextResponse.json(
      { error: "Failed to load personalized live streams", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
