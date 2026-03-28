import { NextResponse } from "next/server";
import { searchMusics } from "node-youtube-music";
import { searchSongsRobust } from "@/lib/youtubeMusicSearch";

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

function youtubeHqThumbnail(videoId: string): string {
  // sddefault is usually available and significantly sharper than low-res shelf thumbs.
  return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
}

function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function musicVideoToItem(m: {
  youtubeId?: string;
  title?: string;
  artists?: { name: string }[];
  duration?: { label: string; totalSeconds: number };
  thumbnailUrl?: string;
}): SearchItem | null {
  const id = m.youtubeId?.trim();
  if (!id) return null;
  const artist = m.artists?.map((a) => a.name).filter(Boolean).join(", ") || "Unknown Artist";
  const dur =
    m.duration?.label ||
    (m.duration?.totalSeconds != null ? formatSeconds(m.duration.totalSeconds) : "0:00");

  return {
    videoId: id,
    title: m.title?.trim() || "Unknown title",
    author: artist,
    duration: dur,
    thumbnail: m.thumbnailUrl?.trim() || youtubeHqThumbnail(id),
  };
}

async function searchYouTubeMusic(query: string): Promise<SearchItem[]> {
  let results: Awaited<ReturnType<typeof searchMusics>> = [];
  try {
    results = await searchMusics(query);
  } catch {
    /* library parser often fails on ambiguous queries; fall back below */
  }
  if (results.length === 0) {
    results = await searchSongsRobust(query);
  }
  const items: SearchItem[] = [];
  for (const r of results) {
    const item = musicVideoToItem(r);
    if (item) items.push(item);
    if (items.length >= 12) break;
  }
  return items;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ error: "Missing required query param: q" }, { status: 400 });
    }

    const items = await searchYouTubeMusic(q);

    return NextResponse.json({ items, source: "music.youtube.com" as const });
  } catch (error) {
    console.error("Search route failed:", error);
    return NextResponse.json({ error: "Failed to search tracks." }, { status: 500 });
  }
}
