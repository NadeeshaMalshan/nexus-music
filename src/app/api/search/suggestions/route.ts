import { NextResponse } from "next/server";
import { getYTMusic } from "@/lib/ytmClient";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ textSuggestions: [], richResults: [] });
    }

    const ytmusic = await getYTMusic();

    // Fetch text suggestions, search results, and users concurrently
    const [suggestions, searchResults, userResults] = await Promise.all([
      ytmusic.getSearchSuggestions(q).catch((err) => {
        console.error("[Suggestions API] getSearchSuggestions failed:", err);
        return [] as string[];
      }),
      ytmusic.search(q).catch((err) => {
        console.error("[Suggestions API] search failed:", err);
        return [] as any[];
      }),
      fetch(`${new URL(request.url).origin}/api/user/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []),
    ]);

    const richResults: any[] = [];

    // Add matching users
    for (const user of (userResults || [])) {
      richResults.push({
        youtubeId: user.email || user.name || "",
        title: user.name || user.email || "",
        artists: ["User"],
        thumbnailUrl: user.avatarUrl || user.image || user.thumbnail || "",
        type: "user",
        user,
      });
    }

    // Add songs, videos, artists, albums, playlists
    for (const item of (searchResults || [])) {
      const type = item.type?.toLowerCase();
      if (type === "song" || type === "video" || type === "artist" || type === "album" || type === "playlist") {
        let artists: string[] = [];
        if (item.artist) {
          artists = [item.artist.name || ""];
        } else if (item.artists) {
          artists = Array.isArray(item.artists)
            ? item.artists.map((a: any) => (typeof a === "string" ? a : a.name || ""))
            : [item.artists.name || ""];
        }
        
        const youtubeId = item.videoId || item.artistId || item.albumId || item.playlistId || "";
        if (!youtubeId) continue;

        const thumbnailUrl = item.thumbnails?.[item.thumbnails.length - 1]?.url || "";

        richResults.push({
          youtubeId,
          title: item.name || item.title || "",
          artists: artists.filter(Boolean),
          thumbnailUrl,
          type: type as "song" | "video" | "artist" | "album" | "playlist",
        });
      }
    }

    return NextResponse.json({
      textSuggestions: suggestions || [],
      richResults: richResults.slice(0, 6),
    });
  } catch (error) {
    console.error("[Suggestions API] Route error:", error);
    return NextResponse.json({ textSuggestions: [], richResults: [] });
  }
}
