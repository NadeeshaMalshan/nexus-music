import { NextResponse } from "next/server";
import {
  fetchLikedSongs,
  fetchRecentMusicActivities,
  fetchRelatedVideos,
  searchYouTubeMusicCategoryVideos,
  type YouTubeTrack,
} from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { appendUniqueTaste } from "@/lib/mergeTasteHistory";
import {
  selectDiverseRecommendations,
  parseRefreshOffset,
  isArtistMatch,
  type CandidateTrack,
} from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

const MAX_MUSIC_VIDEO_SECONDS = 30 * 60;

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

function durationLabelToSeconds(label: string | undefined): number {
  if (!label) return 0;
  const p = String(label)
    .split(":")
    .map((x) => parseInt(x, 10))
    .filter((n) => !Number.isNaN(n));
  if (p.length === 2) return p[0] * 60 + p[1];
  if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
  return 0;
}

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

/**
 * YouTube Data API (OAuth) only: activity + liked taste, `search` + `related` for music. No YTM / cookies.
 * Enforces artist diversity with max 3 per artist and round-robin interleaving.
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

    if (tasteTracks.length === 0) {
      return NextResponse.json({
        items: [] as SearchItem[],
        topArtists: [] as string[],
        historySeeds: 0,
        mode: "youtube_data_api",
        signals: {
          youtubeActivityRows: activities.length,
          likedRows: liked.length,
          historyMergedForSeeds: history.length,
        },
        hint: "No music-tagged activity or liked videos in range; play/like more on YouTube to tune this row.",
      });
    }

    const refreshOffset = parseRefreshOffset(request);
    const topArtists = topArtistsFromTracks(tasteTracks, 8);

    const hisIds = history
      .map((t) => t.videoId)
      .filter((id) => id && /^[a-zA-Z0-9_-]{11}$/.test(id));
    const likeIds = liked
      .map((t) => t.videoId)
      .filter((id) => id && /^[a-zA-Z0-9_-]{11}$/.test(id));
    const uniqueSeeds: string[] = [];
    const seenSeed = new Set<string>();
    for (const id of [...hisIds, ...likeIds]) {
      if (seenSeed.has(id)) continue;
      seenSeed.add(id);
      uniqueSeeds.push(id);
    }

    // Select up to 4 seeds, rotating with refresh offset if multiple seeds exist
    const seedOffset = uniqueSeeds.length > 0 ? refreshOffset % uniqueSeeds.length : 0;
    const seedsToUse = [
      ...uniqueSeeds.slice(seedOffset),
      ...uniqueSeeds.slice(0, seedOffset),
    ].slice(0, 4);

    const artistsToUse = topArtists.slice(0, 4);

    // Fetch candidates from related-video requests and artist-based official music video searches concurrently
    const [relatedResults, searchResults] = await Promise.all([
      Promise.all(
        seedsToUse.map((id) =>
          fetchRelatedVideos(accessToken, id).catch(() => [] as YouTubeTrack[])
        )
      ),
      Promise.all(
        artistsToUse.map((artist) =>
          searchYouTubeMusicCategoryVideos(
            accessToken,
            `${artist} official music video`,
            12
          ).catch(() => [] as YouTubeTrack[])
        )
      ),
    ]);

    const candidates: CandidateTrack[] = [];

    // Related video candidates from seeds
    for (const group of relatedResults) {
      for (const t of group) {
        if (!t?.videoId) continue;
        const sec = durationLabelToSeconds(t.duration);
        if (sec > MAX_MUSIC_VIDEO_SECONDS) continue;
        candidates.push({
          videoId: t.videoId,
          title: t.title || "Unknown title",
          artist: t.artist || "Unknown Artist",
          duration: t.duration || "0:00",
          durationSeconds: sec,
          thumbnail: t.thumbnailUrl?.trim() || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
        });
      }
    }

    // Artist-search video candidates: verify that the video is ACTUALLY performed by or explicitly features the target artist
    for (let i = 0; i < artistsToUse.length; i++) {
      const targetArtist = artistsToUse[i];
      const group = searchResults[i] || [];
      for (const t of group) {
        if (!t?.videoId) continue;
        const sec = durationLabelToSeconds(t.duration);
        if (sec > MAX_MUSIC_VIDEO_SECONDS) continue;
        if (!isArtistMatch(t.artist, t.title, targetArtist)) {
          continue;
        }
        candidates.push({
          videoId: t.videoId,
          title: t.title || "Unknown title",
          artist: t.artist || "Unknown Artist",
          duration: t.duration || "0:00",
          durationSeconds: sec,
          thumbnail: t.thumbnailUrl?.trim() || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
        });
      }
    }

    // If candidate pool is sparse, fetch fallback official videos from top artist
    if (candidates.length < 8 && topArtists[0]) {
      const more = await searchYouTubeMusicCategoryVideos(
        accessToken,
        `${topArtists[0]} music video`,
        12
      ).catch(() => [] as YouTubeTrack[]);
      for (const row of more) {
        if (!row?.videoId) continue;
        const sec = durationLabelToSeconds(row.duration);
        if (sec > MAX_MUSIC_VIDEO_SECONDS) continue;
        if (!isArtistMatch(row.artist, row.title, topArtists[0])) {
          continue;
        }
        candidates.push({
          videoId: row.videoId,
          title: row.title || "Unknown title",
          artist: row.artist || "Unknown Artist",
          duration: row.duration || "0:00",
          durationSeconds: sec,
          thumbnail: row.thumbnailUrl?.trim() || `https://i.ytimg.com/vi/${row.videoId}/hqdefault.jpg`,
        });
      }
    }

    // Apply artist diversity: round-robin, max 3 per artist, preferred 2, collaborator-aware
    const diverseTracks = selectDiverseRecommendations(candidates, {
      preferredArtists: topArtists,
      targetCount: 12,
      maxPerArtist: 3,
      preferredMaxPerArtist: 2,
      offset: refreshOffset,
    });

    const items: SearchItem[] = diverseTracks.map((t) => ({
      videoId: t.videoId,
      title: t.title,
      author: t.artist,
      duration: t.duration || "0:00",
      thumbnail: t.thumbnail || `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg`,
    }));

    return NextResponse.json({
      items,
      topArtists: topArtists.slice(0, 5),
      historySeeds: seedsToUse.length,
      mode: "youtube_data_api",
      signals: {
        youtubeActivityRows: activities.length,
        likedRows: liked.length,
        historyMergedForSeeds: history.length,
      },
      hint:
        "Taste from YouTube channel activity (music) + liked videos, via YouTube Data API search/related. No YTM cookies.",
    });
  } catch (e: any) {
    console.error("[music-videos/personalized]", e);
    return NextResponse.json(
      { error: "Failed to load personalized music videos", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
