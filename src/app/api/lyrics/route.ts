import { NextResponse } from "next/server";
import { parseLrcContent } from "@/lib/lrc";

// Performance hint for Next.js 16+
export const dynamic = "force-dynamic";
export const maxDuration = 30; // Max serverless duration on Vercel

type LyricsSource = "LRCLIB" | "Lyrics.ovh" | "Genius";

interface LrcLibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

interface LrcLibResponse {
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
}

interface LyricsOvhResponse {
  lyrics?: string;
}

interface GeniusSearchHit {
  result?: {
    id?: number;
    url?: string;
    song_art_image_thumbnail_url?: string;
  };
}

interface GeniusSearchResponse {
  response?: {
    hits?: GeniusSearchHit[];
  };
}

interface UnifiedLyricsPayload {
  success: boolean;
  lyrics: {
    isSynced: boolean;
    content: string | null;
    source: LyricsSource | null;
  };
  geniusData: {
    found: boolean;
    songId: number | null;
    url: string | null;
    thumbnail: string | null;
    description: string | null;
    writers: string[] | null;
  };
}

const FETCH_TIMEOUT_MS = 7000;

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

const LRCLIB_HEADERS = {
  "User-Agent": "Nexus/1.0 (music dashboard)",
};

function pickLrcLibRecord(records: LrcLibRecord[]): LrcLibRecord | null {
  const withSync = records.find(
    (r) => !r.instrumental && Boolean(r.syncedLyrics?.trim())
  );
  if (withSync) return withSync;
  return (
    records.find((r) => !r.instrumental && Boolean(r.plainLyrics?.trim())) ?? null
  );
}

async function fetchLrcLibSearch(
  track: string,
  artist: string
): Promise<LrcLibRecord[]> {
  const endpoint = new URL("https://lrclib.net/api/search");
  endpoint.searchParams.set("track_name", track);
  endpoint.searchParams.set("artist_name", artist);

  const res = await fetchWithTimeout(endpoint.toString(), {
    headers: LRCLIB_HEADERS,
  });
  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as LrcLibRecord[]) : [];
}

async function fetchLrcLibSearchQuery(q: string): Promise<LrcLibRecord[]> {
  const endpoint = new URL("https://lrclib.net/api/search");
  endpoint.searchParams.set("q", q);

  const res = await fetchWithTimeout(endpoint.toString(), {
    headers: LRCLIB_HEADERS,
  });
  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as LrcLibRecord[]) : [];
}

async function fetchLrcLibGetById(id: number): Promise<LrcLibResponse | null> {
  const res = await fetchWithTimeout(`https://lrclib.net/api/get/${id}`, {
    headers: LRCLIB_HEADERS,
  });
  if (!res.ok) {
    return null;
  }
  return (await res.json()) as LrcLibResponse;
}

async function fetchLrcLibGetExact(
  track: string,
  artist: string,
  albumName: string,
  durationSeconds: number
): Promise<LrcLibResponse | null> {
  const endpoint = new URL("https://lrclib.net/api/get");
  endpoint.searchParams.set("track_name", track);
  endpoint.searchParams.set("artist_name", artist);
  endpoint.searchParams.set("album_name", albumName);
  endpoint.searchParams.set("duration", String(Math.round(durationSeconds)));

  const res = await fetchWithTimeout(endpoint.toString(), {
    headers: LRCLIB_HEADERS,
  });
  if (!res.ok) {
    return null;
  }

  return (await res.json()) as LrcLibResponse;
}

async function fetchLyricsOvh(track: string, artist: string): Promise<LyricsOvhResponse | null> {
  const endpoint = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(track)}`;
  const res = await fetchWithTimeout(endpoint);
  if (!res.ok) {
    return null;
  }

  return (await res.json()) as LyricsOvhResponse;
}

async function fetchGenius(track: string, artist: string): Promise<GeniusSearchHit["result"] | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) {
    return null;
  }

  const endpoint = new URL("https://api.genius.com/search");
  endpoint.searchParams.set("q", `${artist} ${track}`);

  const res = await fetchWithTimeout(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    return null;
  }

  const data = (await res.json()) as GeniusSearchResponse;
  return data.response?.hits?.[0]?.result ?? null;
}

async function fetchGeniusDetails(id: number): Promise<{ description: string | null; writers: string[] | null } | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetchWithTimeout(`https://api.genius.com/songs/${id}?text_format=plain`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const song = data.response?.song;
  
  const writers = (song?.writer_artists || []).map((w: any) => w.name as string);
  
  return {
    description: song?.description?.plain || null,
    writers: writers.length > 0 ? writers : null
  };
}

/**
 * Scrapes plain text lyrics from a Genius URL.
 */
async function scrapeGeniusLyrics(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const html = await res.text();
    
    // Modern Genius lyrics container
    let lyrics = "";
    const containerRegex = /<div class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/g;
    let match;
    while ((match = containerRegex.exec(html)) !== null) {
      lyrics += match[1] + "\n";
    }

    if (lyrics) {
      return lyrics
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#39;/g, "'")
        .trim();
    }

    // Older Genius lyrics container fallback
    const oldContainerMatch = html.match(/<div class="lyrics">([\s\S]*?)<\/div>/);
    if (oldContainerMatch) {
      return oldContainerMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .trim();
    }

    return null;
  } catch (err) {
    console.error("Genius scraping failed:", err);
    return null;
  }
}

function cleanLyricsQuery(track: string, artist: string): { track: string; artist: string } {
  let cleanArtist = artist
    .replace(/\s*-\s*Topic$/i, "")
    .replace(/\s*VEVO$/i, "")
    .trim();
  
  // 1. Clean track title by removing common YouTube suffixes in brackets/parentheses
  let cleanTrack = track
    .replace(/\s*[\(\[][^)]*?(official|music|video|audio|lyric|visualizer|remaster|edit|version|feat|ft|with|clip|cover|tribute|karaoke|instrumental|hd|4k|mv|m\/v)[^)]*?[\)\]]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 2. If the track title contains the artist's name, clean it up (e.g. "Adele - Hello" -> "Hello")
  // Normalize em-dash and en-dash to standard hyphen
  const normalizedTrack = cleanTrack.replace(/[\u2013\u2014]/g, "-");
  const hyphenIndex = normalizedTrack.indexOf(" - ");
  if (hyphenIndex !== -1) {
    const part1 = cleanTrack.substring(0, hyphenIndex).trim();
    const part2 = cleanTrack.substring(hyphenIndex + 3).trim();
    
    const part1Lower = part1.toLowerCase();
    const artistLower = cleanArtist.toLowerCase();
    
    if (part1Lower.includes(artistLower) || artistLower.includes(part1Lower)) {
      cleanTrack = part2;
    } else if (artistLower === "unknown artist" || artistLower === "unknown") {
      cleanTrack = part2;
      cleanArtist = part1;
    } else {
      // Fallback: If hyphen is present, part2 is usually the track name
      cleanTrack = part2;
    }
  }

  // 3. Strip any remaining feat/ft details not inside parentheses
  cleanTrack = cleanTrack.replace(/\s+(feat|ft|with)\.?\s+.*$/gi, "").trim();

  return { track: cleanTrack, artist: cleanArtist };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTrack = searchParams.get("track")?.trim();
  const rawArtist = searchParams.get("artist")?.trim();
  const durationRaw = searchParams.get("duration");
  const albumName = searchParams.get("album")?.trim() || "Unknown";
  const durationSeconds =
    durationRaw && !Number.isNaN(Number(durationRaw)) ? Number(durationRaw) : null;

  if (!rawTrack || !rawArtist) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required query params: track and artist",
      },
      { status: 400 }
    );
  }

  const { track, artist } = cleanLyricsQuery(rawTrack, rawArtist);
  console.log(`[lyrics] Cleaned "${rawTrack}" by "${rawArtist}" -> "${track}" by "${artist}"`);

  try {
    // Run all external sources concurrently for maximum responsiveness.
    const [lrcSearchSettled, lrcExactSettled, lyricsOvhSettled, geniusSettled] =
      await Promise.allSettled([
        fetchLrcLibSearch(track, artist),
        durationSeconds != null
          ? fetchLrcLibGetExact(track, artist, albumName, durationSeconds)
          : Promise.resolve(null),
        fetchLyricsOvh(track, artist),
        fetchGenius(track, artist),
      ]);

    const searchRecords =
      lrcSearchSettled.status === "fulfilled" ? lrcSearchSettled.value : [];
    const exactData =
      lrcExactSettled.status === "fulfilled" ? lrcExactSettled.value : null;

    const exactSynced = exactData?.syncedLyrics?.trim() || null;
    const exactPlain = exactData?.plainLyrics?.trim() || null;

    let searchHydrated: LrcLibResponse | null = null;
    const pickSearch = pickLrcLibRecord(searchRecords);
    if (pickSearch) {
      const byId = await fetchLrcLibGetById(pickSearch.id);
      searchHydrated = {
        syncedLyrics: byId?.syncedLyrics ?? pickSearch.syncedLyrics ?? null,
        plainLyrics: byId?.plainLyrics ?? pickSearch.plainLyrics ?? null,
      };
    }

    const searchSynced = searchHydrated?.syncedLyrics?.trim() || null;
    const searchPlain = searchHydrated?.plainLyrics?.trim() || null;

    let synced = exactSynced || searchSynced || null;
    let plainFromLrcLib = exactPlain || searchPlain || null;

    if (!synced && !plainFromLrcLib) {
      const fallbackRecords = await fetchLrcLibSearchQuery(`${artist} ${track}`);
      const fallbackPick = pickLrcLibRecord(fallbackRecords);
      if (fallbackPick) {
        const byId = await fetchLrcLibGetById(fallbackPick.id);
        synced = byId?.syncedLyrics?.trim() || fallbackPick.syncedLyrics?.trim() || null;
        plainFromLrcLib =
          byId?.plainLyrics?.trim() || fallbackPick.plainLyrics?.trim() || null;
      }
    }

    const lyricsOvhData = lyricsOvhSettled.status === "fulfilled" ? lyricsOvhSettled.value : null;
    const geniusResult = geniusSettled.status === "fulfilled" ? geniusSettled.value : null;

    let geniusDescription: string | null = null;
    let geniusWriters: string[] | null = null;
    if (geniusResult?.id) {
      const details = await fetchGeniusDetails(geniusResult.id);
      geniusDescription = details?.description || null;
      geniusWriters = details?.writers || null;

      // Clean up the description if it's just a placeholder like "No description available."
      if (geniusDescription?.toLowerCase().includes("no description available") || geniusDescription?.length && geniusDescription.length < 5) {
        geniusDescription = null;
      }
    }

    const plainFromOvh = lyricsOvhData?.lyrics?.trim() || null;
    let plainFromGenius: string | null = null;

    if (!synced && !plainFromLrcLib && geniusResult?.url) {
      plainFromGenius = await scrapeGeniusLyrics(geniusResult.url);
    }

    const lyricsContent = synced || plainFromLrcLib || plainFromGenius || plainFromOvh;
    const lyricsSource: LyricsSource | null = synced || plainFromLrcLib 
      ? "LRCLIB" 
      : plainFromGenius 
        ? "Genius" 
        : plainFromOvh 
          ? "Lyrics.ovh" 
          : null;

    const lrcTimedLines = parseLrcContent(lyricsContent || "");
    const isSynced = lrcTimedLines.length > 0;

    const responsePayload: UnifiedLyricsPayload = {
      success: true,
      lyrics: {
        isSynced,
        content: lyricsContent ?? null,
        source: lyricsSource,
      },
      geniusData: {
        found: Boolean(geniusResult?.id),
        songId: geniusResult?.id ?? null,
        url: geniusResult?.url ?? null,
        thumbnail: geniusResult?.song_art_image_thumbnail_url ?? null,
        description: geniusDescription,
        writers: geniusWriters,
      },
    };

    return NextResponse.json(responsePayload);
  } catch (error) {
    console.error("Lyrics & insights aggregation failed:", error);
    const fallbackPayload: UnifiedLyricsPayload = {
      success: true,
      lyrics: {
        isSynced: false,
        content: null,
        source: null,
      },
      geniusData: {
        found: false,
        songId: null,
        url: null,
        thumbnail: null,
        description: null,
        writers: null,
      },
    };

    return NextResponse.json(fallbackPayload);
  }
}
