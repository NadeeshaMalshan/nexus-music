import { NextResponse } from "next/server";
import {
  fetchLikedSongs,
  fetchRecentMusicActivities,
  type YouTubeTrack,
} from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { appendUniqueTaste } from "@/lib/mergeTasteHistory";
import { formatDuration } from "@/lib/format";
import { getPublicYTMusic } from "@/lib/ytmClient";
import {
  selectDiverseRecommendations,
  parseRefreshOffset,
  type CandidateTrack,
} from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

const MAX_SONG_LIST_SECONDS = 30 * 60;

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

type YtmAudioResult = {
  youtubeId: string;
  title: string;
  artist: string;
  duration: string;
  durationSeconds: number;
  thumbnailUrl: string;
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

function ytmToAudioResult(item: any): YtmAudioResult | null {
  const youtubeId = String(item?.videoId || item?.youtubeId || "").trim();
  if (!youtubeId) return null;

  let artist = "Unknown Artist";
  if (Array.isArray(item?.artists)) {
    artist = item.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ");
  } else if (typeof item?.artists === "object") {
    artist = item.artists?.name || artist;
  } else if (typeof item?.artist === "string") {
    artist = item.artist;
  } else if (typeof item?.artist === "object") {
    artist = item.artist?.name || artist;
  }

  let durationSeconds = 0;
  let duration = "0:00";
  if (typeof item?.duration === "number") {
    durationSeconds = item.duration;
    duration = formatDuration(durationSeconds);
  } else if (typeof item?.duration === "object" && item.duration) {
    durationSeconds = item.duration.totalSeconds || 0;
    duration = item.duration.label || formatDuration(durationSeconds);
  } else if (typeof item?.duration === "string") {
    duration = item.duration;
    durationSeconds = durationLabelToSeconds(duration);
  }

  return {
    youtubeId,
    title: String(item?.title || item?.name || "Unknown title").trim(),
    artist: artist.replace(/\s*-\s*Topic$/i, "").trim() || "Unknown Artist",
    duration,
    durationSeconds,
    thumbnailUrl: item?.thumbnails?.[item.thumbnails.length - 1]?.url || item?.thumbnail?.url || item?.thumbnail || "",
  };
}

function isProbablyMusicVideo(item: YtmAudioResult): boolean {
  const title = item.title.toLowerCase();
  return /\b(official\s+music\s+video|music\s+video|official\s+video|mv|video\s+clip|visualizer|lyric\s+video|lyrics\s+video)\b/.test(title);
}

async function getYtmRelatedAudio(videoId: string): Promise<YtmAudioResult[]> {
  try {
    const ytm = await getPublicYTMusic();
    const rows = await ytm.getUpNexts(videoId);
    return (rows || []).map(ytmToAudioResult).filter((x): x is YtmAudioResult => x !== null);
  } catch (e) {
    console.warn("[audio/personalized] YT Music up-next failed:", e);
    return [];
  }
}

async function searchYtmSongs(query: string): Promise<YtmAudioResult[]> {
  try {
    const ytm = await getPublicYTMusic();
    const rows = await ytm.searchSongs(query);
    return (rows || []).map(ytmToAudioResult).filter((x): x is YtmAudioResult => x !== null);
  } catch (e) {
    console.warn("[audio/personalized] YT Music song search failed:", e);
    return [];
  }
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
 * Taste: YouTube account activity + liked music via OAuth.
 * Results: public YouTube Music song ranking / Up Next only. No YTM_COOKIE and no Gemini/Gemma.
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
        mode: "no_taste_signals",
        signals: {
          youtubeActivityRows: activities.length,
          likedRows: liked.length,
        },
        hint: "No music-tagged activity or liked videos in range; play/like more on YouTube (music) to tune this row.",
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

    // Fetch related audio and artist songs concurrently to build candidate pool
    const [relatedResults, searchResults] = await Promise.all([
      Promise.all(seedsToUse.map((id) => getYtmRelatedAudio(id))),
      Promise.all(artistsToUse.map((artist) => searchYtmSongs(`${artist} audio`))),
    ]);

    const candidates: CandidateTrack[] = [];
    for (const group of [...relatedResults, ...searchResults]) {
      for (const t of group) {
        if (!t?.youtubeId) continue;
        if (isProbablyMusicVideo(t)) continue;
        const sec = t.durationSeconds || durationLabelToSeconds(t.duration);
        if (sec > MAX_SONG_LIST_SECONDS) continue;
        candidates.push({
          videoId: t.youtubeId,
          title: t.title,
          artist: t.artist,
          duration: t.duration,
          durationSeconds: sec,
          thumbnail: t.thumbnailUrl || `https://i.ytimg.com/vi/${t.youtubeId}/hqdefault.jpg`,
        });
      }
    }

    // If candidate pool is shallow, fetch fallback candidates from primary artist
    if (candidates.length < 8 && topArtists[0]) {
      const more = await searchYtmSongs(`${topArtists[0]} official audio`);
      for (const row of more) {
        if (!row?.youtubeId) continue;
        if (isProbablyMusicVideo(row)) continue;
        const sec = row.durationSeconds || durationLabelToSeconds(row.duration);
        if (sec > MAX_SONG_LIST_SECONDS) continue;
        candidates.push({
          videoId: row.youtubeId,
          title: row.title,
          artist: row.artist,
          duration: row.duration,
          durationSeconds: sec,
          thumbnail: row.thumbnailUrl || `https://i.ytimg.com/vi/${row.youtubeId}/hqdefault.jpg`,
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
      mode: "youtube_history_to_ytm_audio",
      source: "music.youtube.com",
      signals: {
        youtubeActivityRows: activities.length,
        likedRows: liked.length,
        historyMergedForSeeds: history.length,
      },
      hint: "Taste from YouTube account history/likes; suggestions from public YouTube Music songs and Up Next only. No cookies, music-video search, or generative model.",
    });
  } catch (e: any) {
    console.error("[audio/personalized]", e);
    return NextResponse.json(
      { error: "Failed to load personalized audio picks", detail: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
