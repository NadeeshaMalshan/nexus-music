import { NextResponse } from "next/server";
import { LyricsRepository } from "@/lib/lyrics/LyricsRepository";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTrack = searchParams.get("track")?.trim();
  const rawArtist = searchParams.get("artist")?.trim();
  const durationRaw = searchParams.get("duration");
  const albumName = searchParams.get("album")?.trim() || "Unknown";
  const durationSeconds =
    durationRaw && !Number.isNaN(Number(durationRaw)) ? Number(durationRaw) : null;

  if (!rawTrack || !rawArtist) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing required query params: track and artist",
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const repository = LyricsRepository.getInstance();
    const result = await repository.getLyrics(
      rawTrack,
      rawArtist,
      albumName,
      durationSeconds,
      controller.signal
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Lyrics fetching failed:", error);
    return NextResponse.json({
      success: true,
      lyrics: {
        isSynced: false,
        isWordSynced: false,
        syncType: "unsynced",
        content: null,
        format: "plain",
        source: null,
        lines: [],
      },
      geniusData: {
        found: false,
        songId: null,
        url: null,
        thumbnail: null,
        description: null,
        writers: null,
        producers: null,
        releaseYear: null,
      },
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
