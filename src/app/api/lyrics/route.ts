import { NextResponse } from "next/server";
import { parseLrcContent } from "@/lib/lrc";

type LyricsSource = "LRCLIB" | "Lyrics.ovh";

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
  "User-Agent": "EchoAI/1.0 (music dashboard)",
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const track = searchParams.get("track")?.trim();
  const artist = searchParams.get("artist")?.trim();
  const durationRaw = searchParams.get("duration");
  const albumName = searchParams.get("album")?.trim() || "Unknown";
  const durationSeconds =
    durationRaw && !Number.isNaN(Number(durationRaw)) ? Number(durationRaw) : null;

  if (!track || !artist) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required query params: track and artist",
      },
      { status: 400 }
    );
  }

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

    const plainFromOvh = lyricsOvhData?.lyrics?.trim() || null;

    const lyricsContent = synced || plainFromLrcLib || plainFromOvh;
    const lyricsSource: LyricsSource | null = synced || plainFromLrcLib ? "LRCLIB" : plainFromOvh ? "Lyrics.ovh" : null;

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
      },
    };

    return NextResponse.json(fallbackPayload);
  }
}
