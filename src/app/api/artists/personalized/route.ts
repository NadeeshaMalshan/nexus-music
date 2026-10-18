import { NextResponse } from "next/server";
import {
  fetchLikedSongs,
  fetchRecentMusicActivities,
  type YouTubeTrack,
} from "@/lib/youtubeData";
import { getRequestAccessToken } from "@/lib/requestAccessToken";
import { appendUniqueTaste } from "@/lib/mergeTasteHistory";
import { searchArtistsRobust } from "@/lib/ytmSearchService";
import {
  deduplicateArtists,
  normalizeArtistName,
  parseRefreshOffset,
} from "@/lib/recommendations/recommendationEngine";

export const dynamic = "force-dynamic";

export type ArtistSearchItem = {
  type: "ARTIST";
  id: string;
  name: string;
  thumbnail: string;
};

const artistLookupCache = new Map<
  string,
  { item: ArtistSearchItem; expiresAt: number }
>();
const ARTIST_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const CURATED_POPULAR_ARTISTS = [
  "The Weeknd",
  "Taylor Swift",
  "Kendrick Lamar",
  "Billie Eilish",
  "Dua Lipa",
  "Drake",
  "Post Malone",
  "Bruno Mars",
  "Ed Sheeran",
  "SZA",
  "Coldplay",
  "Ariana Grande",
  "Olivia Rodrigo",
  "Harry Styles",
  "Adele",
  "Rihanna",
];

function extractTopArtists(tracks: YouTubeTrack[], max = 25): string[] {
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

async function resolveArtistProfile(
  artistName: string
): Promise<ArtistSearchItem | null> {
  const norm = normalizeArtistName(artistName);
  if (!norm) return null;

  const cached = artistLookupCache.get(norm);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.item;
  }

  try {
    const results = await searchArtistsRobust(artistName);
    if (!results || results.length === 0) return null;

    // Pick best match: prefer exact/normalized name match, or first result
    let best = results.find(
      (r: any) => normalizeArtistName(r.name) === norm
    );
    if (!best) best = results[0];

    const cleanName = (best.name || artistName)
      .replace(/\s*-\s*Topic$/i, "")
      .trim();

    const item: ArtistSearchItem = {
      type: "ARTIST",
      id: best.id || `artist_${norm}`,
      name: cleanName,
      thumbnail: best.thumbnail || "",
    };

    artistLookupCache.set(norm, {
      item,
      expiresAt: Date.now() + ARTIST_CACHE_TTL_MS,
    });
    return item;
  } catch (err) {
    console.warn(`[artists/personalized] Failed to resolve artist: ${artistName}`, err);
    return null;
  }
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

    if (tasteTracks.length === 0) {
      return NextResponse.json({
        items: [] as ArtistSearchItem[],
        topArtists: [] as string[],
        signals: {
          youtubeActivityRows: activities.length,
          likedRows: liked.length,
        },
        hint: "No music-tagged activity or liked videos found to personalize artists.",
      });
    }

    const refreshOffset = parseRefreshOffset(request);
    const topArtists = extractTopArtists(tasteTracks, 25);

    // Rotate top artists by refresh offset if available
    let artistPool = topArtists;
    if (refreshOffset > 0 && topArtists.length > 6) {
      const shift = refreshOffset % topArtists.length;
      artistPool = [...topArtists.slice(shift), ...topArtists.slice(0, shift)];
    }

    // Combine with curated artists if user has few top artists
    const candidateNames = [...artistPool];
    for (const curated of CURATED_POPULAR_ARTISTS) {
      const norm = normalizeArtistName(curated);
      if (!candidateNames.some((c) => normalizeArtistName(c) === norm)) {
        candidateNames.push(curated);
      }
    }

    // Resolve artist profiles concurrently in chunks to avoid slamming API
    const targetsToResolve = candidateNames.slice(0, 16);
    const resolvePromises = targetsToResolve.map((name) =>
      resolveArtistProfile(name)
    );
    const resolved = (await Promise.all(resolvePromises)).filter(
      (x): x is ArtistSearchItem => x !== null
    );

    // Deduplicate strictly by normalized artist name and limit to 12
    const diverseArtists = deduplicateArtists(resolved, {
      targetCount: 12,
    });

    return NextResponse.json({
      items: diverseArtists,
      topArtists: topArtists.slice(0, 12),
      source: "music.youtube.com",
    });
  } catch (error) {
    console.error("[artists/personalized] Route failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch personalized artists" },
      { status: 500 }
    );
  }
}
