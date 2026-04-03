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
    const type = searchParams.get("type") || "songs";

    if (!q) {
      return NextResponse.json({ error: "Missing required query param: q" }, { status: 400 });
    }

    if (type === "artists") {
       const { searchArtistsRobust } = await import("@/lib/ytmSearchService");
       const artists = await searchArtistsRobust(q);
       return NextResponse.json({ items: artists, source: "music.youtube.com" });
    }

    if (type === "playlists") {
       const { searchPlaylistsRobust } = await import("@/lib/ytmSearchService");
       const playlists = await searchPlaylistsRobust(q);
       return NextResponse.json({ items: playlists, source: "music.youtube.com" });
    }

    // Default: Songs (with Top Artist Heuristic)
    const { searchArtistsRobust } = await import("@/lib/ytmSearchService");
    const [artists, songs] = await Promise.all([
      searchArtistsRobust(q),
      searchYouTubeMusic(q)
    ]);

    // Interleave
    const topArtist = artists[0] ? { ...artists[0], type: "ARTIST" } : null;
    let finalItems: any[] = topArtist ? [topArtist, ...songs] : songs;
    
    // Batch fetch view counts for songs
    const songIds = finalItems.filter(i => !i.type || i.type === "SONG").map(s => s.videoId);
    if (songIds.length > 0) {
       try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);
          
          const headers: any = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${songIds.join(",")}`,
            { headers }
          );
          if (vidRes.ok) {
             const vidData = await vidRes.json();
             const viewsMap: Record<string, string> = {};
             vidData.items?.forEach((v: any) => {
                viewsMap[v.id] = v.statistics?.viewCount || "0";
             });
             
             finalItems = finalItems.map(item => {
                if (!item.type || item.type === "SONG") {
                   return { ...item, views: viewsMap[item.videoId] || "0" };
                }
                return item;
             });
          }
       } catch (err) {
          console.warn("[Search API] View count batch fetch failed:", err);
       }
    }

    return NextResponse.json({ items: finalItems.slice(0, 12), source: "music.youtube.com" as const });
  } catch (error) {
    console.error("Search route failed:", error);
    return NextResponse.json({ error: "Failed to search tracks." }, { status: 500 });
  }
}
