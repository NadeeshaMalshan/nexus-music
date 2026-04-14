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

async function searchYouTubeMusicVideos(query: string): Promise<SearchItem[]> {
  const { searchVideosRobust } = await import("@/lib/ytmSearchService");
  const results = await searchVideosRobust(query);
  const items: SearchItem[] = [];
  for (const r of results) {
    const item = musicVideoToItem(r);
    if (item) items.push(item);
    if (items.length >= 12) break;
  }
  return items;
}

async function searchYouTubeMusicAlbums(query: string) {
  const { searchAlbumsRobust } = await import("@/lib/ytmSearchService");
  const results = await searchAlbumsRobust(query);

  return (results || [])
    .map((a: any) => ({
      type: "ALBUM" as const,
      id: (a as any).browseId || (a as any).albumId || (a as any).id || "",
      title: a.title || a.name || "Unknown Album",
      author:
        a.artist?.name ||
        a.artist ||
        a.author ||
        (a.artists?.map((x: any) => x?.name).filter(Boolean).join(", ") || "Unknown Artist"),
      thumbnail: a.thumbnailUrl || a.thumbnail || "",
      year: (a as any).year,
    }))
    .filter((x: any) => x.id)
    .slice(0, 12);
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

    if (type === "albums") {
      const albums = await searchYouTubeMusicAlbums(q);
      return NextResponse.json({ items: albums, source: "music.youtube.com" as const });
    }

    if (type === "videos" || type === "musicVideos" || type === "live") {
      let finalItems: any[] = [];
      const apiKey = process.env.YOUTUBE_API_KEY;

      if (type === "live") {
        // Use YouTube v3 API directly for live streams
        try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);

          const headers: any = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const url = new URL("https://www.googleapis.com/youtube/v3/search");
          url.searchParams.set("part", "snippet");
          url.searchParams.set("q", q + " live");
          url.searchParams.set("type", "video");
          url.searchParams.set("eventType", "live");
          url.searchParams.set("maxResults", "12");
          if (apiKey) url.searchParams.set("key", apiKey);

          const liveRes = await fetch(url.toString(), { headers });
          if (liveRes.ok) {
            const liveData = await liveRes.json();
            finalItems = (liveData.items || []).map((item: any) => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              author: item.snippet.channelTitle,
              duration: "LIVE",
              thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default?.url,
              isLive: true
            }));
          }
        } catch (err) {
          console.error("[Search API] Live fetch failed:", err);
        }
      } else {
        finalItems = await searchYouTubeMusicVideos(q);
      }

      // Batch fetch view counts for videos
      const ids = finalItems.map((i) => i.videoId).filter(Boolean);
      if (ids.length > 0) {
        try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);

          const url = new URL("https://www.googleapis.com/youtube/v3/videos");
          url.searchParams.set("part", "statistics");
          url.searchParams.set("id", ids.join(","));
          if (apiKey) url.searchParams.set("key", apiKey);

          const headers: any = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetch(url.toString(), { headers });
          if (vidRes.ok) {
            const vidData = await vidRes.json();
            const viewsMap: Record<string, string> = {};
            vidData.items?.forEach((v: any) => {
              viewsMap[v.id] = v.statistics?.viewCount || "0";
            });

            finalItems = finalItems.map((item) => ({ ...item, views: viewsMap[item.videoId] || "0" }));
          }
        } catch (err) {
          console.warn("[Search API] View count batch fetch failed:", err);
        }
      }

      return NextResponse.json({ items: finalItems.slice(0, 12), source: "music.youtube.com" as const });
    }

    // Default: Songs (with Top Artist Heuristic)
    const { searchArtistsRobust } = await import("@/lib/ytmSearchService");
    const [artists, songs] = await Promise.all([
      searchArtistsRobust(q),
      searchYouTubeMusic(q)
    ]);
    const apiKey = process.env.YOUTUBE_API_KEY;

    // Interleave
    const topArtist = artists[0] ? { ...artists[0], type: "ARTIST" } : null;
    let finalItems: any[] = topArtist ? [topArtist, ...songs] : songs;
    
    // Batch fetch view counts for songs
    const videoIds = finalItems
      .filter((i) => i && i.videoId && i.type !== "ARTIST" && i.type !== "PLAYLIST")
      .map((s) => s.videoId);
    if (videoIds.length > 0) {
       try {
          const { getServerSession } = await import("next-auth/next");
          const { authOptions } = await import("@/lib/auth");
          const session = await getServerSession(authOptions);
          
          const url = new URL("https://www.googleapis.com/youtube/v3/videos");
          url.searchParams.set("part", "statistics");
          url.searchParams.set("id", videoIds.join(","));
          if (apiKey) url.searchParams.set("key", apiKey);

          const headers: any = {};
          if (session?.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;

          const vidRes = await fetch(url.toString(), { headers });
          if (vidRes.ok) {
             const vidData = await vidRes.json();
             const viewsMap: Record<string, string> = {};
             vidData.items?.forEach((v: any) => {
                viewsMap[v.id] = v.statistics?.viewCount || "0";
             });
             
             finalItems = finalItems.map(item => {
                if (item && item.videoId && item.type !== "ARTIST" && item.type !== "PLAYLIST") {
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
