/**
 * /api/stream/route.ts
 * Streams audio from YouTube Music using @distube/ytdl-core.
 * Usage: GET /api/stream?id=<youtubeVideoId>&quality=<low|medium|high>
 *
 * "quality" maps to ytdl audio quality:
 *   high   → highestaudio (default, best available)
 *   medium → opus/128kbps
 *   low    → lowestaudio (smallest size, useful for slow connections)
 */

import { NextResponse } from "next/server";
import { getInfo, chooseFormat } from "@distube/ytdl-core";

export const runtime = "nodejs";
// Allow up to 30 seconds for the stream to begin (avoids Vercel 25s limit for starters)
export const maxDuration = 30;

type AudioQuality = "low" | "medium" | "high";

interface FormatOptions {
  quality?: "highestaudio" | "lowestaudio";
  filter?: "audioonly";
}

function getFormatOptions(quality: AudioQuality): FormatOptions {
  if (quality === "low") return { quality: "lowestaudio", filter: "audioonly" };
  if (quality === "medium") return { filter: "audioonly" };
  return { quality: "highestaudio", filter: "audioonly" }; // high (default)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const qualityParam = (searchParams.get("quality") ?? "high") as AudioQuality;

  if (!id) {
    return NextResponse.json({ error: "Missing required param: id" }, { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${id}`;

  try {
    // Validate the video is accessible before streaming
    const info = await getInfo(videoUrl);
    const title = info.videoDetails.title;
    const artist = typeof info.videoDetails.author === "string"
      ? info.videoDetails.author
      : (info.videoDetails.author as any)?.name ?? "Unknown Artist";

    // Choose format — audioonly + quality preference
    const fmtOptions = getFormatOptions(qualityParam);
    const format = chooseFormat(info.formats, fmtOptions);

    if (!format?.url) {
      return NextResponse.json({ error: "No suitable audio format found" }, { status: 404 });
    }

    // Return the direct CDN URL for the client to stream natively.
    // This avoids buffering the entire stream through Next.js.
    return NextResponse.json({
      id,
      title,
      artist,
      streamUrl: format.url,
      mimeType: format.mimeType ?? "audio/webm",
      bitrate: format.audioBitrate ?? null,
      quality: qualityParam,
      source: "music.youtube.com",
    });
  } catch (error: any) {
    console.error("[Stream] Failed to get stream URL for", id, error);
    return NextResponse.json(
      { error: "Failed to retrieve audio stream.", detail: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
