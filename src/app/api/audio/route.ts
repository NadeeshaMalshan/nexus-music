import { NextResponse } from "next/server";
import { searchSongsRobust, searchVideosRobust } from "@/lib/ytmSearchService";
import ytdl from "@distube/ytdl-core";

function youtubeHqThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function upgradeThumbnail(url?: string, videoId?: string): string {
  if (!url && videoId) return youtubeHqThumbnail(videoId);
  if (!url) return "";
  if (url.includes("=w") && url.includes("-h")) {
    return url.replace(/=w\d+-h\d+(-.*?)?$/, "=w1024-h1024");
  }
  return url;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const directVideoId = searchParams.get("videoId")?.trim();
  const isVideo = searchParams.get("isVideo") === "true";
  const passedArtist = searchParams.get("artist")?.trim();
  const passedTitle = searchParams.get("title")?.trim();

  if (!query && !directVideoId) {
    return NextResponse.json(
      { error: "Missing required param: query or videoId" },
      { status: 400 }
    );
  }

  try {
    let videoId: string | undefined = directVideoId;
    let trackName = passedTitle || query || "YouTube Video";
    let artist = passedArtist || "Unknown Artist";
    let thumbnailUrl = directVideoId ? youtubeHqThumbnail(directVideoId) : "";
    let musicVideoId = directVideoId;

    if (isVideo && directVideoId) {
       // For standard videos, we prioritize the passed metadata (from YouTube oembed)
       // This ensures channel name -> artist and video title -> trackName
    } else {
      // Fetch refined metadata from YouTube Music based on the query
      const searchResults = await searchSongsRobust(query || "");
      
      // Try to find an exact ID match, but fallback to the first result for metadata if needed
      const exactMatch = directVideoId ? searchResults.find((r: any) => r.youtubeId === directVideoId) : null;
      const metadataSource = exactMatch || searchResults[0];

      if (metadataSource) {
        if (!directVideoId) videoId = metadataSource.youtubeId?.trim();
        
        trackName = metadataSource.title?.trim() || trackName;
        artist = metadataSource.artist || 
                 metadataSource.artists?.map((a: any) => a.name).filter(Boolean).join(", ") || 
                 "Unknown Artist";
        thumbnailUrl = metadataSource.thumbnailUrl || metadataSource.thumbnail || thumbnailUrl;
        
        // Try to find the exact Music Video for this track if we don't have a direct ID
        if (!directVideoId) {
          const videoResults = await searchVideosRobust(`${artist} ${trackName} music video`);
          musicVideoId = videoResults?.[0]?.youtubeId?.trim() || videoId;
        }
      }
    }

    // Fallback cleanup
    if ((!artist || artist === "Unknown Artist" || (isVideo && artist === "YouTube")) && query?.includes(" - ")) {
       const parts = query.split(" - ");
       artist = parts[0].trim();
       if (!trackName || trackName === "YouTube Video") trackName = parts[1].trim();
    }

    if (!videoId && !directVideoId) {
      return NextResponse.json(
        { error: "No track found and no direct ID provided" },
        { status: 404 }
      );
    }

    const finalVideoId = videoId || directVideoId!;
    const thumbnail = upgradeThumbnail(thumbnailUrl, finalVideoId);

    const payload = {
      audioUrl: `https://www.youtube.com/watch?v=${finalVideoId}`,
      trackName,
      artist: artist.replace(/\s*-\s*Topic\s*$/i, ""),
      coverArt: thumbnail,
      videoId: finalVideoId,
      musicVideoId: musicVideoId || finalVideoId,
      source: directVideoId ? "youtube.com" : "music.youtube.com",
    };

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("[audio] Failed to resolve audio for query:", query, error);
    return NextResponse.json(
      {
        error: "Failed to resolve audio metadata.",
        detail: error?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
