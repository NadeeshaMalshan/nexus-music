import { NextResponse } from "next/server";
import ytdl from "@distube/ytdl-core";
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

/** Default ytdl clients omit WEB; many YT Music / official tracks only expose streams via WEB. */
const YTDL_PLAYER_CLIENTS: NonNullable<
  Parameters<typeof ytdl.getInfo>[1]
>["playerClients"] = ["WEB", "WEB_EMBEDDED", "IOS", "ANDROID", "TV"];

function pickAudioStreamUrl(
  formats: Parameters<typeof ytdl.chooseFormat>[0]
): string {
  const attempts: { filter: "audioonly" | "audio"; quality: string }[] = [
    { filter: "audioonly", quality: "highestaudio" },
    { filter: "audioonly", quality: "highest" },
    { filter: "audio", quality: "highestaudio" },
    { filter: "audio", quality: "highest" },
  ];
  for (const opts of attempts) {
    try {
      const format = ytdl.chooseFormat(formats, opts);
      if (format?.url) return format.url;
    } catch {
      /* try next */
    }
  }
  const withAudio = ytdl.filterFormats(formats, "audio");
  if (withAudio.length > 0) {
    withAudio.sort((a, b) => (b.audioBitrate ?? 0) - (a.audioBitrate ?? 0));
    const best = withAudio[0];
    if (best?.url) return best.url;
  }
  throw new Error("No usable audio stream URL");
}

async function resolveAudioOnlyStreamUrl(youtubeId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
  const info = await ytdl.getInfo(watchUrl, {
    playerClients: YTDL_PLAYER_CLIENTS,
  });
  return pickAudioStreamUrl(info.formats);
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

    let audioUrl: string;
    try {
      audioUrl = await resolveAudioOnlyStreamUrl(youtubeId);
    } catch (err) {
      console.error("Audio stream resolution failed:", err);
      return NextResponse.json(
        { error: "Could not resolve an audio stream for this track." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      audioUrl,
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
