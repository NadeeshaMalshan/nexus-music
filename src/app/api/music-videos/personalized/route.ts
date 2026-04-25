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

function trackToSearchItem(t: YouTubeTrack): SearchItem {
  const id = t.videoId;
  const thumb = t.thumbnailUrl?.trim() || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  return {
    videoId: id,
    title: t.title || "Unknown title",
    author: t.artist || "Unknown Artist",
    duration: t.duration || "0:00",
    thumbnail: thumb,
  };
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
    const topArtists = topArtistsFromTracks(tasteTracks, 8);

    const seen = new Set<string>();
    const out: SearchItem[] = [];

    const pushIfOk = (t: YouTubeTrack) => {
      if (!t.videoId || seen.has(t.videoId)) return;
      const sec = durationLabelToSeconds(t.duration);
      if (sec > MAX_MUSIC_VIDEO_SECONDS) return;
      seen.add(t.videoId);
      out.push(trackToSearchItem(t));
    };

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
      if (uniqueSeeds.length >= 4) break;
    }

    for (const videoId of uniqueSeeds) {
      if (out.length >= 12) break;
      const related = await fetchRelatedVideos(accessToken, videoId);
      for (const r of related) {
        pushIfOk(r);
        if (out.length >= 12) break;
      }
    }

    for (const artist of topArtists.slice(0, 3)) {
      if (out.length >= 12) break;
      const found = await searchYouTubeMusicCategoryVideos(
        accessToken,
        `${artist} official music video`,
        12
      );
      for (const row of found) {
        pushIfOk(row);
        if (out.length >= 12) break;
      }
    }

    if (out.length < 4 && topArtists[0]) {
      const more = await searchYouTubeMusicCategoryVideos(accessToken, `${topArtists[0]} music video`, 12);
      for (const row of more) {
        pushIfOk(row);
        if (out.length >= 12) break;
      }
    }

    return NextResponse.json({
      items: out.slice(0, 12),
      topArtists: topArtists.slice(0, 5),
      historySeeds: uniqueSeeds.length,
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
