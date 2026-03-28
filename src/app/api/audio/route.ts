import { NextResponse } from "next/server";
import { searchMusics } from "node-youtube-music";
import { searchSongsRobust } from "@/lib/youtubeMusicSearch";

type MusicVideo = Awaited<ReturnType<typeof searchMusics>>[number];

/**
 * YouTube Music "Songs" tab results (via searchMusics) are catalog song rows — official audio
 * entries rather than the separate "Videos" tab (music videos / uploads).
 */
function pickFirstSong(results: MusicVideo[]): MusicVideo | null {
  for (const r of results) {
    const id = r.youtubeId?.trim();
    if (!id) continue;
    return r;
  }
  return null;
}

function formatArtists(m: MusicVideo): string {
  const joined = m.artists?.map((a) => a.name).filter(Boolean).join(", ").trim();
  return joined || "Unknown Artist";
}

function youtubeHqThumbnail(videoId: string): string {
  // sddefault is generally available and cleaner than low-res shelf thumbnail URLs.
  return `https://i.ytimg.com/vi/${videoId}/sddefault.jpg`;
}

function coverFromMusicVideo(m: MusicVideo, youtubeId: string): string {
  return m.thumbnailUrl?.trim() || youtubeHqThumbnail(youtubeId);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim();

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query param: query" },
        { status: 400 }
      );
    }

    let results: MusicVideo[] = [];
    try {
      results = await searchMusics(query);
    } catch (err) {
      console.warn("searchMusics failed (will try robust parser):", err);
    }
    if (results.length === 0) {
      results = await searchSongsRobust(query);
    }

    const song = pickFirstSong(results);
    if (!song?.youtubeId) {
      return NextResponse.json(
        { error: "No matching song found on YouTube Music. Try a different search." },
        { status: 404 }
      );
    }

    const youtubeId = song.youtubeId.trim();
    const trackName = song.title?.trim() || "Unknown Track";
    const artist = formatArtists(song);
    const coverArt = coverFromMusicVideo(song, youtubeId);

    return NextResponse.json({
      audioUrl: "",
      trackName,
      artist,
      coverArt,
      videoId: youtubeId,
    });
  } catch (error) {
    console.error("Audio route failed:", error);
    return NextResponse.json(
      { error: "Unexpected error while loading audio." },
      { status: 500 }
    );
  }
}
