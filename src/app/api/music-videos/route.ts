/**
 * /api/music-videos/route.ts
 * Searches and browses Music Videos on YouTube Music (music.youtube.com).
 *
 * GET /api/music-videos?q=<query>         → search music videos
 * GET /api/music-videos?related=<videoId> → get related music videos
 * GET /api/music-videos?trending=true     → trending/popular music videos
 *
 * Results are filtered to keep only items with valid youtubeIds.
 * Thumbnails are upgraded to the highest available resolution.
 */

import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";
import { getRelatedTracksRobust } from "@/lib/youtubeMusicRelated";

const MAX_RESULTS = 15;

// ─── Helpers ────────────────────────────────────────────────────────────────

function youtubeHqThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
}

function upgradeThumbnail(url?: string, videoId?: string): string {
  if (!url && videoId) return youtubeHqThumbnail(videoId);
  if (!url) return "";
  // Replace sizing params in YTM thumbnail URLs
  if (url.includes("=w") && url.includes("-h")) {
    return url.replace(/=w\d+-h\d+(-.*?)?$/, "=w1920-h1080");
  }
  return url;
}

function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

interface MusicVideoResult {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  durationSeconds: number;
  isExplicit: boolean;
  album: string | null;
  source: "music.youtube.com";
}

function mapToResult(m: any): MusicVideoResult | null {
  const id = m.youtubeId?.trim();
  if (!id) return null;

  const artist =
    m.artists
      ?.map((a: any) => a.name)
      .filter(Boolean)
      .join(", ") || "Unknown Artist";

  const durationSec = m.duration?.totalSeconds ?? 0;
  const duration = m.duration?.label || formatSeconds(durationSec);
  const thumbnail = upgradeThumbnail(m.thumbnailUrl, id);

  return {
    id,
    title: m.title?.trim() || "Unknown Title",
    artist,
    thumbnail,
    duration,
    durationSeconds: durationSec,
    isExplicit: m.isExplicit ?? false,
    album: m.album ?? null,
    source: "music.youtube.com",
  };
}

// ─── Trending fallback queries ───────────────────────────────────────────────

const TRENDING_QUERIES = [
  "official music video 2024",
  "new music video 2025",
  "top hits music video",
];

async function fetchTrending(): Promise<MusicVideoResult[]> {
  const query = TRENDING_QUERIES[Math.floor(Math.random() * TRENDING_QUERIES.length)];
  try {
    const results = await searchSongsRobust(query);
    return (results || [])
      .map(mapToResult)
      .filter((r): r is MusicVideoResult => r !== null)
      .slice(0, MAX_RESULTS);
  } catch (err) {
    console.error("[music-videos] trending fetch failed:", err);
    return [];
  }
}

async function fetchByQuery(q: string): Promise<MusicVideoResult[]> {
  try {
    const results = await searchSongsRobust(q);
    return (results || [])
      .map(mapToResult)
      .filter((r): r is MusicVideoResult => r !== null)
      .slice(0, MAX_RESULTS);
  } catch (err) {
    console.error("[music-videos] search failed for query:", q, err);
    return [];
  }
}

async function fetchRelated(videoId: string): Promise<MusicVideoResult[]> {
  try {
    const results = await getRelatedTracksRobust(videoId);
    return (results || [])
      .map(mapToResult)
      .filter((r): r is MusicVideoResult => r !== null)
      .slice(0, MAX_RESULTS);
  } catch (err) {
    console.error("[music-videos] getSuggestions failed for:", videoId, err);
    // Fall back to search for related
    return fetchTrending();
  }
}

// ─── Route Handler ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get("q")?.trim();
  const relatedId = searchParams.get("related")?.trim();
  const trending = searchParams.get("trending");

  try {
    let items: MusicVideoResult[] = [];
    let mode: string;

    if (relatedId) {
      mode = "related";
      items = await fetchRelated(relatedId);
    } else if (query) {
      mode = "search";
      items = await fetchByQuery(query);
    } else {
      mode = "trending";
      items = await fetchTrending();
    }

    return NextResponse.json({
      items,
      total: items.length,
      mode,
      source: "music.youtube.com",
    });
  } catch (error: any) {
    console.error("[music-videos] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch music videos.", detail: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
