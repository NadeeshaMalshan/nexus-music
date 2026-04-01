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

  if (!query) {
    return NextResponse.json(
      { error: "Missing required param: query" },
      { status: 400 }
    );
  }

  try {
    const results = await searchSongsRobust(query);

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "No tracks found for query: " + query },
        { status: 404 }
      );
    }

    const best = results[0];
    const videoId = best.youtubeId?.trim();

    if (!videoId) {
      return NextResponse.json(
        { error: "Track found but has no YouTube ID" },
        { status: 404 }
      );
    }

    const artist =
      best.artists
        ?.map((a: any) => a.name)
        .filter(Boolean)
        .join(", ") || "Unknown Artist";

    // Try to find the exact Music Video for this track so the UI's video tab works
    const videoResults = await searchVideosRobust(`${artist} ${best.title || query} music video`);
    const musicVideoId = videoResults?.[0]?.youtubeId?.trim() || videoId;

    const thumbnail = upgradeThumbnail(best.thumbnailUrl, videoId);

    const payload = {
      audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
      trackName: best.title?.trim() || query,
      artist,
      coverArt: thumbnail,
      videoId,
      musicVideoId: musicVideoId,
      source: "music.youtube.com",
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
