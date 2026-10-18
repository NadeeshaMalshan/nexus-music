import { NextResponse } from "next/server";
import {
  fetchLikedSongs,
  fetchRecentMusicActivities,
  type YouTubeTrack,
} from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { appendUniqueTaste } from "@/lib/mergeTasteHistory";
import { searchPlaylistsRobust } from "@/lib/ytmSearchService";
import {
  selectDiversePlaylists,
  normalizeArtistName,
  parseRefreshOffset,
  type CandidatePlaylist,
} from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

export type PlaylistSearchItem = {
  type: "PLAYLIST";
  id: string;
  title: string;
  author: string;
  thumbnail: string;
};

const CURATED_PLAYLIST_GENRES = [
  "Trending Hits Mix",
  "Chill Vibes Mix",
  "Night Drive Mix",
  "Acoustic Relax Mix",
  "Electronic Energy Mix",
  "R&B Slow Jams Mix",
  "Indie Feel Good Mix",
  "Workout Motivation Mix",
  "Focus Ambient Mix",
  "Pop Party Mix",
  "Synthwave Sunset Mix",
  "Sad Acoustic Mix",
];

function extractTopArtists(tracks: YouTubeTrack[], max = 10): string[] {
  const counts = new Map<string, { n: number; display: string }>();
  for (const t of tracks) {
    const raw = (t.artist || "").replace(/\s*-\s*Topic$/i, "").trim();
    if (
      !raw ||
      raw.toLowerCase() === "unknown" ||
      raw.toLowerCase() === "unknown artist"
    ) {
      continue;
    }
    const norm = normalizeArtistName(raw);
    if (!norm) continue;
    const prev = counts.get(norm);
    if (prev) {
      prev.n += 1;
    } else {
      counts.set(norm, { n: 1, display: raw });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .map((x) => x.display)
    .slice(0, max);
}

export async function GET(request: Request) {
  const accessToken = await getRequestAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [activities, liked] = await Promise.all([
      fetchRecentMusicActivities(accessToken, 50).catch(
        () => [] as YouTubeTrack[]
      ),
      fetchLikedSongs(accessToken).catch(() => [] as YouTubeTrack[]),
    ]);

    const tasteTracks = appendUniqueTaste(activities, liked);
    const refreshOffset = parseRefreshOffset(request);
    const topArtists = extractTopArtists(tasteTracks, 12);

    // Build diverse playlist search queries combining user favorite artists & curated genres
    const queries: string[] = [];

    if (topArtists.length > 0) {
      let rotatedArtists = topArtists;
      if (refreshOffset > 0 && topArtists.length > 3) {
        const shift = refreshOffset % topArtists.length;
        rotatedArtists = [
          ...topArtists.slice(shift),
          ...topArtists.slice(0, shift),
        ];
      }
      for (const artist of rotatedArtists.slice(0, 4)) {
        queries.push(`${artist} mix playlist`);
      }
    }

    // Add curated genres
    let rotatedGenres = CURATED_PLAYLIST_GENRES;
    if (refreshOffset > 0) {
      const shift = refreshOffset % CURATED_PLAYLIST_GENRES.length;
      rotatedGenres = [
        ...CURATED_PLAYLIST_GENRES.slice(shift),
        ...CURATED_PLAYLIST_GENRES.slice(0, shift),
      ];
    }
    for (const g of rotatedGenres.slice(0, 4)) {
      queries.push(`${g} playlist`);
    }

    // Execute playlist searches concurrently
    const searchPromises = queries.map((q) =>
      searchPlaylistsRobust(q).catch(() => [] as any[])
    );
    const results = await Promise.all(searchPromises);

    const candidates: CandidatePlaylist[] = [];
    for (const list of results) {
      for (const p of list) {
        if (!p?.id) continue;
        candidates.push({
          type: "PLAYLIST",
          id: p.id,
          title: p.title || "Mix Playlist",
          author: p.author || "YouTube Music",
          thumbnail: p.thumbnail || "",
        });
      }
    }

    // Apply diversity rules: deduplicate IDs, avoid duplicate titles, cap 2 per curator
    const diversePlaylists = selectDiversePlaylists(candidates, {
      targetCount: 12,
      maxPerAuthor: 2,
      offset: refreshOffset,
    });

    return NextResponse.json({
      items: diversePlaylists,
      topArtists: topArtists.slice(0, 6),
      source: "music.youtube.com",
    });
  } catch (error) {
    console.error("[playlists/personalized] Route failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch personalized playlists" },
      { status: 500 }
    );
  }
}
