import { NextResponse } from "next/server";
import { searchSongsRobust } from "@/lib/ytmSearchService";

type SearchItem = {
  videoId: string;
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
};

function youtubeHqThumbnail(videoId: string): string {
  // hqdefault (480x360) is universally available and safe.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function upgradeYtMusicThumbnail(url: string): string {
  if (!url) return url;
  // YT Music thumbnails often have =w120-h120-... or similar. We replace with high res.
  if (url.includes("=w") && url.includes("-h")) {
    return url.replace(/=w\d+-h\d+/, "=w1024-h1024");
  }
  // Some other patterns exist
  return url;
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
    (m as any).durationObj?.label ||
    m.duration?.label ||
    ((m as any).durationObj?.totalSeconds != null ? formatSeconds((m as any).durationObj.totalSeconds) : 
     (m.duration?.totalSeconds != null ? formatSeconds(m.duration.totalSeconds) : 
      (typeof m.duration === 'string' ? m.duration : "0:00")));

  let thumb = m.thumbnailUrl?.trim() || youtubeHqThumbnail(id);
  thumb = upgradeYtMusicThumbnail(thumb);

  return {
    videoId: id,
    title: m.title?.trim() || "Unknown title",
    author: artist,
    duration: dur,
    thumbnail: thumb,
  };
}

async function searchYouTubeMusic(query: string): Promise<SearchItem[]> {
  const results = await searchSongsRobust(query);
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
